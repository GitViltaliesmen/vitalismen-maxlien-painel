import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const V152_E_PHASE = 'V152_E_CONTROLLED_REAL_PAIRING';
export const V152_E_CHANNEL_ID = 'WHATSAPP_WEB_CONTROLLED_TEST_01';
export const V152_E_SESSION_NAMESPACE = 'v152-e-controlled-test-01';
export const V152_E_ALLOWED_PEER_PHONE = '5515998038637';
export const V152_E_FIXED_OUTBOUND_TEXT = 'Prueba técnica controlada V152-E. No requiere respuesta comercial.';
export const V152_E_FORBIDDEN_PAIRED_PHONES = Object.freeze([
    '5531971862958',
    '5515991418416'
]);

const SAFE_NAMESPACE = /^[a-z0-9][a-z0-9_-]{1,79}$/i;
const digits = (value) => String(value || '').replace(/\D/g, '');
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

export const phoneFingerprint = (value) => sha256(digits(value));
export const maskPhone = (value) => {
    const normalized = digits(value);
    return normalized ? `***${normalized.slice(-4)}` : '';
};

const isInside = (parent, candidate) => {
    const relative = path.relative(path.resolve(parent), path.resolve(candidate));
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

const boundedInteger = (value, fallback, minimum, maximum) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) return fallback;
    return Math.min(maximum, Math.max(minimum, parsed));
};

export const resolveV152EConfig = (env = process.env, { releaseRoot = process.cwd() } = {}) => {
    if (String(env.V152_E_CONTROLLED_REAL_PAIRING_APPROVED || '') !== 'true') {
        throw new Error('v152_e_explicit_pairing_approval_required');
    }
    const channelId = String(env.V152_E_CHANNEL_ID || '');
    const sessionNamespace = String(env.V152_E_SESSION_NAMESPACE || '');
    const allowedPeerPhone = digits(env.V152_E_ALLOWED_PEER_PHONE);
    const rawPaths = {
        session_storage: String(env.WHATSAPP_SESSION_STORAGE_ROOT || ''),
        qr_runtime: String(env.V152_E_QR_RUNTIME_ROOT || ''),
        evidence: String(env.V152_E_EVIDENCE_ROOT || '')
    };
    for (const [label, configuredPath] of Object.entries(rawPaths)) {
        if (!configuredPath || !path.isAbsolute(configuredPath)) {
            throw new Error(`v152_e_${label}_absolute_path_required`);
        }
    }
    const sessionStorageRoot = path.resolve(rawPaths.session_storage);
    const qrRuntimeRoot = path.resolve(rawPaths.qr_runtime);
    const evidenceRoot = path.resolve(rawPaths.evidence);

    if (channelId !== V152_E_CHANNEL_ID) throw new Error('v152_e_channel_id_mismatch');
    if (sessionNamespace !== V152_E_SESSION_NAMESPACE || !SAFE_NAMESPACE.test(sessionNamespace)) {
        throw new Error('v152_e_session_namespace_mismatch');
    }
    if (allowedPeerPhone !== V152_E_ALLOWED_PEER_PHONE) throw new Error('v152_e_peer_phone_mismatch');
    for (const [label, configuredPath] of [
        ['session_storage', sessionStorageRoot],
        ['qr_runtime', qrRuntimeRoot],
        ['evidence', evidenceRoot]
    ]) {
        if (configuredPath === path.parse(configuredPath).root) {
            throw new Error(`v152_e_${label}_absolute_path_required`);
        }
        if (isInside(releaseRoot, configuredPath)) throw new Error(`v152_e_${label}_inside_release_forbidden`);
    }
    if (isInside(sessionStorageRoot, qrRuntimeRoot) || isInside(qrRuntimeRoot, sessionStorageRoot)) {
        throw new Error('v152_e_qr_and_session_storage_must_be_separate');
    }

    return Object.freeze({
        phase: V152_E_PHASE,
        channelId,
        sessionNamespace,
        allowedPeerPhone,
        sessionStorageRoot,
        sessionDirectory: path.join(sessionStorageRoot, sessionNamespace),
        qrRuntimeRoot,
        qrFile: path.join(qrRuntimeRoot, `${channelId}.png`),
        evidenceRoot,
        connectTimeoutMs: boundedInteger(env.V152_E_CONNECT_TIMEOUT_MS, 120000, 10000, 300000),
        inboundTimeoutMs: boundedInteger(env.V152_E_INBOUND_TIMEOUT_MS, 300000, 10000, 600000),
        forbiddenPairedPhones: V152_E_FORBIDDEN_PAIRED_PHONES
    });
};

export const ensureSecureDirectory = async (directory, fsApi = fs) => {
    await fsApi.mkdir(directory, { recursive: true, mode: 0o700 });
    const stat = await fsApi.lstat(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('v152_e_secure_directory_invalid');
    const canonical = await fsApi.realpath(directory);
    if (path.resolve(canonical) !== path.resolve(directory)) throw new Error('v152_e_secure_directory_symlink_path_forbidden');
    await fsApi.chmod(directory, 0o700);
    return directory;
};

export const hardenSessionTree = async (directory, fsApi = fs) => {
    const rootStat = await fsApi.lstat(directory);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('v152_e_session_root_invalid');
    await fsApi.chmod(directory, 0o700);
    const entries = await fsApi.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
        const target = path.join(directory, entry.name);
        if (entry.isSymbolicLink()) throw new Error('v152_e_session_symlink_forbidden');
        if (entry.isDirectory()) await hardenSessionTree(target, fsApi);
        else if (entry.isFile()) await fsApi.chmod(target, 0o600);
    }
};

export const writeJsonAtomic = async (target, value, fsApi = fs) => {
    await ensureSecureDirectory(path.dirname(target), fsApi);
    const temporary = `${target}.${process.pid}.${crypto.randomUUID()}.tmp`;
    await fsApi.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
    await fsApi.chmod(temporary, 0o600);
    await fsApi.rename(temporary, target);
    await fsApi.chmod(target, 0o600);
    return target;
};

export const readJsonIfPresent = async (target, fsApi = fs) => {
    try {
        return JSON.parse(await fsApi.readFile(target, 'utf8'));
    } catch (error) {
        if (error?.code === 'ENOENT') return null;
        throw error;
    }
};

export const writeEphemeralQr = async (qrMaterial, config, { encoder, fsApi = fs } = {}) => {
    if (!qrMaterial || typeof encoder !== 'function') throw new Error('v152_e_qr_encoder_required');
    await ensureSecureDirectory(config.qrRuntimeRoot, fsApi);
    const png = await encoder(qrMaterial);
    if (!Buffer.isBuffer(png) || png.length < 64) throw new Error('v152_e_qr_png_invalid');
    const temporary = `${config.qrFile}.${process.pid}.tmp`;
    await fsApi.writeFile(temporary, png, { mode: 0o600, flag: 'wx' });
    await fsApi.chmod(temporary, 0o600);
    await fsApi.rename(temporary, config.qrFile);
    await fsApi.chmod(config.qrFile, 0o600);
    return Object.freeze({ path: config.qrFile, bytes: png.length, sha256: sha256(png) });
};

export const removeEphemeralQr = async (config, fsApi = fs) => {
    try {
        await fsApi.unlink(config.qrFile);
        return true;
    } catch (error) {
        if (error?.code === 'ENOENT') return false;
        throw error;
    }
};

export const assertPairedPhoneAllowed = (phone, config) => {
    const normalized = digits(phone);
    if (!normalized) throw new Error('v152_e_paired_phone_unavailable');
    if (config.forbiddenPairedPhones.some((blocked) => normalized === blocked || normalized.endsWith(blocked))) {
        throw new Error('v152_e_same_phone_dual_provider_forbidden');
    }
    return normalized;
};

export const safePairedIdentity = (phone, config, now = new Date()) => {
    const normalized = assertPairedPhoneAllowed(phone, config);
    return Object.freeze({
        phase: config.phase,
        channelId: config.channelId,
        sessionNamespace: config.sessionNamespace,
        provider: 'WHATSAPP_WEB',
        pairedPhoneMasked: maskPhone(normalized),
        pairedPhoneSha256: phoneFingerprint(normalized),
        pairedAt: now.toISOString(),
        status: 'PAIRED_CONTROLLED',
        customerRouting: false,
        handoff: false,
        failover: false,
        cutover: false,
        zapiPreserved: true
    });
};

export const sanitizeConnectionUpdate = (update = {}) => Object.freeze({
    connection: String(update.connection || 'pending'),
    qrAvailable: Boolean(update.qr),
    disconnectCode: Number(update.disconnectCode || 0) || null
});

const detectMessageKind = (message = {}) => {
    const payload = message.message || message;
    if (payload.audioMessage) return 'audio';
    if (payload.imageMessage) return 'image';
    if (payload.videoMessage) return 'video';
    if (payload.documentMessage) return 'document';
    return 'text';
};

export const candidatePhoneFromMessage = (message = {}) => {
    const key = message.key || {};
    const candidates = [key.remoteJidAlt, key.participantAlt, key.participant, key.remoteJid];
    return candidates.map(digits).find((candidate) => candidate.length >= 10) || '';
};

export const sanitizeInboundEvidence = (message, config, now = new Date()) => {
    const phone = candidatePhoneFromMessage(message);
    if (phone !== config.allowedPeerPhone && !phone.endsWith(config.allowedPeerPhone)) {
        throw new Error('v152_e_inbound_peer_not_allowed');
    }
    const providerMessageId = String(message?.key?.id || '');
    if (!providerMessageId) throw new Error('v152_e_inbound_message_id_required');
    const content = JSON.stringify(message?.message || {});
    return Object.freeze({
        phase: config.phase,
        channelId: config.channelId,
        direction: 'inbound',
        peerPhoneMasked: maskPhone(phone),
        peerPhoneSha256: phoneFingerprint(phone),
        providerMessageIdSha256: sha256(providerMessageId),
        contentSha256: sha256(content),
        kind: detectMessageKind(message),
        observedAt: now.toISOString(),
        persistedBody: false,
        routedToBusinessLogic: false,
        autoReply: false
    });
};

export class ControlledCanaryLedger {
    constructor({ config, fsApi = fs, clock = () => new Date() }) {
        this.config = config;
        this.fs = fsApi;
        this.clock = clock;
        this.target = path.join(config.evidenceRoot, 'controlled-canary-ledger.json');
        this.lock = `${this.target}.lock`;
    }

    async #withLock(callback) {
        await ensureSecureDirectory(this.config.evidenceRoot, this.fs);
        let handle;
        try {
            handle = await this.fs.open(this.lock, 'wx', 0o600);
        } catch (error) {
            if (error?.code === 'EEXIST') throw new Error('v152_e_canary_ledger_busy');
            throw error;
        }
        try {
            return await callback();
        } finally {
            await handle.close();
            await this.fs.unlink(this.lock).catch(() => {});
        }
    }

    async reserveOutbound() {
        return this.#withLock(async () => {
            const current = await readJsonIfPresent(this.target, this.fs) || { version: 1 };
            if (['INTENDED', 'SENT', 'AMBIGUOUS'].includes(current.outbound?.status)) {
                return Object.freeze({ accepted: false, duplicate: true, status: current.outbound.status });
            }
            const reservationToken = crypto.randomUUID();
            current.outbound = {
                status: 'INTENDED',
                reservationToken,
                logicalMessageId: 'v152-e-controlled-outbound-canary-v1',
                peerPhoneSha256: phoneFingerprint(this.config.allowedPeerPhone),
                contentSha256: sha256(V152_E_FIXED_OUTBOUND_TEXT),
                intendedAt: this.clock().toISOString(),
                retryAllowed: false
            };
            await writeJsonAtomic(this.target, current, this.fs);
            return Object.freeze({ accepted: true, duplicate: false, reservationToken });
        });
    }

    async completeOutbound(reservationToken, providerMessageId) {
        return this.#withLock(async () => {
            const current = await readJsonIfPresent(this.target, this.fs);
            if (!current?.outbound || current.outbound.reservationToken !== reservationToken) {
                throw new Error('v152_e_canary_reservation_mismatch');
            }
            current.outbound.status = 'SENT';
            current.outbound.sentAt = this.clock().toISOString();
            current.outbound.providerMessageIdSha256 = sha256(String(providerMessageId || ''));
            delete current.outbound.reservationToken;
            await writeJsonAtomic(this.target, current, this.fs);
            return Object.freeze({ status: 'SENT', duplicate: false });
        });
    }

    async markAmbiguous(reservationToken) {
        return this.#withLock(async () => {
            const current = await readJsonIfPresent(this.target, this.fs);
            if (!current?.outbound || current.outbound.reservationToken !== reservationToken) {
                throw new Error('v152_e_canary_reservation_mismatch');
            }
            current.outbound.status = 'AMBIGUOUS';
            current.outbound.ambiguousAt = this.clock().toISOString();
            current.outbound.retryAllowed = false;
            delete current.outbound.reservationToken;
            await writeJsonAtomic(this.target, current, this.fs);
            return Object.freeze({ status: 'AMBIGUOUS', retryAllowed: false });
        });
    }
}

export const v152EPolicyStatus = () => Object.freeze({
    phase: V152_E_PHASE,
    realPairing: 'CONTROLLED_SINGLE_CHANNEL',
    realInbound: 'CONTROLLED_QA_ONLY',
    realOutbound: 'CONTROLLED_QA_SINGLE_MESSAGE',
    customerMigration: false,
    customerRouting: false,
    handoff: false,
    failover: false,
    zapiShutdown: false,
    cutover: false,
    qrLogging: false,
    sessionInsideRelease: false
});
