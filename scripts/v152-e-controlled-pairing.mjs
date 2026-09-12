#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import pino from 'pino';
import QRCode from 'qrcode';
import { fetchLatestBaileysVersion, makeWASocket, useMultiFileAuthState } from '@whiskeysockets/baileys';
import { SessionManager } from '../src/whatsapp/core/SessionManager.js';
import { ChannelRegistry } from '../src/whatsapp/core/ChannelRegistry.js';
import {
    ControlledCanaryLedger,
    V152_E_FIXED_OUTBOUND_TEXT,
    assertNativePairingCode,
    assertPairedPhoneAllowed,
    candidatePhoneFromMessage,
    ensureSecureDirectory,
    hardenSessionTree,
    maskPhone,
    phoneFingerprint,
    readJsonIfPresent,
    removePairingCodeSecret,
    removeEphemeralQr,
    resolveV152EConfig,
    safePairedIdentity,
    sanitizeInboundEvidence,
    v152EPolicyStatus,
    writeEphemeralQr,
    writeJsonAtomic
} from '../src/whatsapp/core/ControlledRealPairingV152E.js';

process.umask(0o077);

const command = String(process.argv[2] || 'audit').toLowerCase();
const confirmation = String(process.argv[3] || '');
const config = resolveV152EConfig(process.env);
const identityFile = path.join(config.evidenceRoot, 'paired-channel-v152-e-r1.json');
const inboundEvidenceFile = path.join(config.evidenceRoot, 'controlled-inbound-v152-e-r1.json');
const connectionsEvidenceFile = path.join(config.evidenceRoot, 'connections-panel-v152-e-r1.json');
const pairingEvidenceFile = path.join(config.evidenceRoot, 'pairing-proof-v152-e-r1.json');
const restartEvidenceFile = path.join(config.evidenceRoot, 'restart-persistence-v152-e-r1.json');
const safeLogger = pino({ level: 'silent' });
const sessionManager = new SessionManager({ storageRoot: config.sessionStorageRoot });
let socket = null;
let authState = null;
let saveCredentials = null;
let credentialWrites = Promise.resolve();
let activePairingMethod = 'QR';

const emit = (record) => process.stdout.write(`${JSON.stringify(record)}\n`);
const emitEvent = (event, extra = {}) => emit({ phase: config.phase, event, ...extra });

const closeSocket = async () => {
    if (!socket) return;
    try { socket.ev?.removeAllListeners?.(); } catch {}
    try { socket.end?.(undefined); } catch {}
    socket = null;
};

const ownPhone = () => String(socket?.user?.id || '').split('@')[0].split(':')[0].replace(/\D/g, '');

const createSocket = async ({ allowQr, pairingMethod = 'QR' }) => {
    await ensureSecureDirectory(config.sessionStorageRoot);
    const managedSessionDirectory = await sessionManager.ensureNamespace(config.sessionNamespace);
    if (path.resolve(managedSessionDirectory) !== path.resolve(config.sessionDirectory)) {
        throw new Error('v152_e_session_manager_directory_mismatch');
    }
    await ensureSecureDirectory(managedSessionDirectory);
    await ensureSecureDirectory(config.evidenceRoot);
    const { state, saveCreds } = await useMultiFileAuthState(config.sessionDirectory);
    authState = state;
    saveCredentials = saveCreds;
    activePairingMethod = pairingMethod;
    credentialWrites = Promise.resolve();
    const { version } = await fetchLatestBaileysVersion();
    socket = makeWASocket({
        version,
        auth: state,
        logger: safeLogger,
        printQRInTerminal: false,
        browser: ['Vitalismen V152-E Controlled Pairing', 'Chrome', '1.0.0'],
        syncFullHistory: false,
        markOnlineOnConnect: false,
        emitOwnEvents: false,
        generateHighQualityLinkPreview: false,
        getMessage: async () => undefined
    });
    socket.ev.on('creds.update', () => {
        credentialWrites = credentialWrites.then(async () => {
            if (activePairingMethod === 'PAIRING_CODE' && state.creds.pairingCode && !state.creds.registered) {
                return;
            }
            if (activePairingMethod === 'PAIRING_CODE') removePairingCodeSecret(state.creds);
            await saveCreds();
            await hardenSessionTree(config.sessionDirectory);
        });
        void credentialWrites.catch(() => emitEvent('CREDENTIAL_PERSISTENCE_FAILED'));
    });
    if (!allowQr) {
        socket.ev.on('connection.update', (update) => {
            if (update.qr) emitEvent('UNEXPECTED_QR_BLOCKED');
        });
    }
    return socket;
};

const waitForOpen = async ({ allowQr, ignoreQr = false }) => new Promise((resolve, reject) => {
    let settled = false;
    let qrWrites = Promise.resolve();
    let timer;

    const finish = (error, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        socket?.ev?.off?.('connection.update', onUpdate);
        if (error) reject(error);
        else resolve(value);
    };

    const onUpdate = (update = {}) => {
        if (update.qr) {
            if (!allowQr && ignoreQr) return;
            if (!allowQr) return finish(new Error('v152_e_existing_session_required'));
            qrWrites = qrWrites.then(async () => {
                await writeEphemeralQr(update.qr, config, {
                    encoder: (value) => QRCode.toBuffer(value, { type: 'png', errorCorrectionLevel: 'M', margin: 2, scale: 7 })
                });
                emitEvent('PAIRING_QR_READY', { qrAvailable: true, qrLogged: false });
            }).catch(() => finish(new Error('v152_e_qr_render_failed')));
        }
        if (update.connection === 'open') {
            void qrWrites.then(async () => {
                await credentialWrites;
                if (activePairingMethod === 'PAIRING_CODE') {
                    if (!authState?.creds?.registered) throw new Error('v152_e_r2_pairing_not_registered');
                    removePairingCodeSecret(authState.creds);
                    await saveCredentials();
                    const persistedCreds = await fs.readFile(path.join(config.sessionDirectory, 'creds.json'), 'utf8');
                    if (/pairingCode/i.test(persistedCreds)) {
                        throw new Error('v152_e_r2_pairing_code_persistence_detected');
                    }
                }
                await hardenSessionTree(config.sessionDirectory);
                let phone;
                try {
                    phone = assertPairedPhoneAllowed(ownPhone(), config);
                } catch (error) {
                    await socket?.logout?.().catch(() => {});
                    await fs.rm(config.sessionDirectory, { recursive: true, force: true }).catch(() => {});
                    throw error;
                }
                const identity = safePairedIdentity(phone, config);
                const previous = await readJsonIfPresent(identityFile);
                if (previous?.pairedPhoneSha256 && previous.pairedPhoneSha256 !== identity.pairedPhoneSha256) {
                    throw new Error('v152_e_paired_identity_changed');
                }
                await writeJsonAtomic(identityFile, previous ? { ...previous, lastVerifiedAt: new Date().toISOString() } : identity);
                await removeEphemeralQr(config);
                finish(null, identity);
            }).catch(finish);
        }
        if (update.connection === 'close') {
            const disconnectCode = Number(
                update?.lastDisconnect?.error?.output?.statusCode
                || update?.lastDisconnect?.error?.statusCode
                || 0
            );
            finish(new Error(`v152_e_connection_closed_before_ready_${disconnectCode || 'unknown'}`));
        }
    };

    timer = setTimeout(() => finish(new Error('v152_e_connection_timeout')), config.connectTimeoutMs);
    socket.ev.on('connection.update', onUpdate);
});

const connectControlled = async ({ allowQr = false } = {}) => {
    await createSocket({ allowQr });
    const identity = await waitForOpen({ allowQr });
    emitEvent('SESSION_READY', {
        channelId: config.channelId,
        phone: identity.pairedPhoneMasked,
        phoneSha256: identity.pairedPhoneSha256,
        zapiPreserved: true,
        customerRouting: false
    });
    const channel = ChannelRegistry.v152ER1Projection({ connected: true })
        .find((entry) => entry.channelId === config.channelId);
    if (!channel || channel.phoneNumber !== config.testChannelPhone || channel.weight !== 0
        || channel.capacity !== 0 || channel.draining !== true || channel.shadow !== true) {
        throw new Error('v152_e_connections_projection_invalid');
    }
    await writeJsonAtomic(connectionsEvidenceFile, {
        phase: config.phase,
        channelId: channel.channelId,
        phoneNumber: channel.phoneNumber,
        provider: channel.provider,
        session: 'CONNECTED',
        health: 'PASS',
        shadow: true,
        draining: true,
        weight: 0,
        capacity: 0,
        customerRouting: 0,
        handoff: 0,
        failover: 0,
        observedAt: new Date().toISOString()
    });
    emitEvent('CONNECTIONS_PANEL_PROJECTION_PASS', {
        channelId: channel.channelId,
        phone: maskPhone(channel.phoneNumber),
        provider: channel.provider,
        health: 'PASS',
        shadow: true,
        draining: true,
        weight: 0,
        capacity: 0
    });
    return identity;
};

const runPair = async () => {
    const identity = await connectControlled({ allowQr: true });
    await writeJsonAtomic(pairingEvidenceFile, {
        phase: config.phase,
        channelId: config.channelId,
        provider: 'WHATSAPP_WEB',
        pairedPhoneSha256: identity.pairedPhoneSha256,
        pairing: 'PASS',
        sessionCreated: true,
        sessionConnected: true,
        channelPhoneMatch: true,
        qrPersisted: false,
        observedAt: new Date().toISOString()
    });
    await closeSocket();
    emitEvent('PAIRING_COMPLETE', { sessionOutsideRelease: true, qrPersisted: false });
};

const runPairCode = async () => {
    await removeEphemeralQr(config);
    await createSocket({ allowQr: false, pairingMethod: 'PAIRING_CODE' });
    if (authState?.creds?.registered || authState?.creds?.me || authState?.creds?.pairingCode) {
        throw new Error('v152_e_r2_clean_session_required');
    }
    let pairingCode;
    try {
        await socket.waitForSocketOpen();
        pairingCode = assertNativePairingCode(await socket.requestPairingCode(config.testChannelPhone));
    } catch {
        throw new Error('v152_e_r2_pairing_code_request_failed');
    }
    emitEvent('PAIRING_CODE_READY', {
        pairingPatch: config.pairingPatch,
        pairingMethod: 'PAIRING_CODE',
        testChannelPhone: config.testChannelPhone,
        pairingCode,
        pairingCodePersisted: false,
        qrAvailable: false,
        qrLogged: false
    });
    const identity = await waitForOpen({ allowQr: false, ignoreQr: true });
    await writeJsonAtomic(pairingEvidenceFile, {
        phase: config.phase,
        pairingPatch: config.pairingPatch,
        channelId: config.channelId,
        provider: 'WHATSAPP_WEB',
        pairedPhoneSha256: identity.pairedPhoneSha256,
        pairingMethod: 'PAIRING_CODE',
        pairing: 'PASS',
        sessionCreated: true,
        sessionConnected: true,
        channelPhoneMatch: true,
        pairingCodePersisted: false,
        qrPersisted: false,
        observedAt: new Date().toISOString()
    });
    await closeSocket();
    emitEvent('PAIRING_COMPLETE', {
        pairingPatch: config.pairingPatch,
        pairingMethod: 'PAIRING_CODE',
        sessionOutsideRelease: true,
        pairingCodePersisted: false,
        qrPersisted: false
    });
};

const runStatus = async () => {
    const identity = await connectControlled({ allowQr: false });
    await writeJsonAtomic(restartEvidenceFile, {
        phase: config.phase,
        channelId: config.channelId,
        provider: 'WHATSAPP_WEB',
        pairedPhoneSha256: identity.pairedPhoneSha256,
        sessionRestored: true,
        newQrRequired: false,
        health: 'PASS',
        observedAt: new Date().toISOString()
    });
    await closeSocket();
    emitEvent('RESTART_PERSISTENCE_PASS', { credentialsReused: true, qrRequired: false });
};

const runInbound = async () => {
    await createSocket({ allowQr: false });
    let inboundTimer;
    let inboundListener;
    const cleanupInbound = () => {
        if (inboundTimer) clearTimeout(inboundTimer);
        if (inboundListener) socket?.ev?.off?.('messages.upsert', inboundListener);
    };
    const inbound = new Promise((resolve, reject) => {
        inboundTimer = setTimeout(() => {
            cleanupInbound();
            reject(new Error('v152_e_inbound_timeout'));
        }, config.inboundTimeoutMs);
        const onMessages = ({ messages = [], type = '' } = {}) => {
            if (type && type !== 'notify') return;
            for (const message of messages) {
                if (message?.key?.fromMe) continue;
                const phone = candidatePhoneFromMessage(message);
                if (phone !== config.allowedPeerPhone && !phone.endsWith(config.allowedPeerPhone)) continue;
                try {
                    const evidence = sanitizeInboundEvidence(message, config);
                    cleanupInbound();
                    resolve(evidence);
                } catch (error) {
                    cleanupInbound();
                    reject(error);
                }
                break;
            }
        };
        inboundListener = onMessages;
        socket.ev.on('messages.upsert', inboundListener);
    });
    try {
        await waitForOpen({ allowQr: false });
        emitEvent('INBOUND_CANARY_WAITING', { allowedPeer: maskPhone(config.allowedPeerPhone) });
        const evidence = await inbound;
        const ledger = new ControlledCanaryLedger({ config });
        const recorded = await ledger.recordInbound(evidence);
        if (!recorded.accepted) {
            emitEvent('INBOUND_CANARY_DUPLICATE_BLOCKED', recorded);
            return;
        }
        await writeJsonAtomic(inboundEvidenceFile, evidence);
        emitEvent('INBOUND_CANARY_PASS', { ...evidence, ledgerRecord: 'PASS', duplicateInbound: 0 });
    } finally {
        cleanupInbound();
        await closeSocket();
    }
};

const runOutbound = async () => {
    await connectControlled({ allowQr: false });
    const ledger = new ControlledCanaryLedger({ config });
    const reservation = await ledger.reserveOutbound();
    if (!reservation.accepted) {
        await closeSocket();
        emitEvent('OUTBOUND_CANARY_DUPLICATE_BLOCKED', { status: reservation.status });
        return;
    }
    try {
        const jid = `${config.allowedPeerPhone}@s.whatsapp.net`;
        const response = await socket.sendMessage(jid, { text: V152_E_FIXED_OUTBOUND_TEXT });
        const providerMessageId = String(response?.key?.id || '');
        if (!providerMessageId) throw new Error('v152_e_provider_message_id_missing');
        await ledger.completeOutbound(reservation.reservationToken, providerMessageId);
        emitEvent('OUTBOUND_CANARY_PASS', {
            peer: maskPhone(config.allowedPeerPhone),
            peerSha256: phoneFingerprint(config.allowedPeerPhone),
            providerMessageIdSha256: crypto.createHash('sha256').update(providerMessageId).digest('hex'),
            dedupe: 'PERSISTED',
            businessLogic: false
        });
    } catch (error) {
        await ledger.markAmbiguous(reservation.reservationToken);
        throw error;
    } finally {
        await closeSocket();
    }
};

const runRollback = async () => {
    if (confirmation !== 'CONFIRM_V152_E_ROLLBACK') throw new Error('v152_e_rollback_confirmation_required');
    const exists = await fs.stat(config.sessionDirectory).then(() => true).catch((error) => {
        if (error?.code === 'ENOENT') return false;
        throw error;
    });
    if (!exists) {
        await removeEphemeralQr(config);
        emitEvent('ROLLBACK_NO_SESSION', { zapiPreserved: true });
        return;
    }
    await createSocket({ allowQr: false });
    await waitForOpen({ allowQr: false });
    await socket.logout();
    await closeSocket();
    const backupRoot = path.join(path.dirname(config.sessionStorageRoot), 'session-backups');
    await ensureSecureDirectory(backupRoot);
    const archive = path.join(backupRoot, `${config.sessionNamespace}-${new Date().toISOString().replace(/[:.]/g, '')}`);
    await fs.rename(config.sessionDirectory, archive);
    await hardenSessionTree(archive);
    await removeEphemeralQr(config);
    emitEvent('ROLLBACK_COMPLETE', { sessionArchived: true, archive, zapiPreserved: true });
};

try {
    if (command === 'audit') emit({ ...v152EPolicyStatus(), configValidated: true });
    else if (command === 'pair') await runPair();
    else if (command === 'pair-code') await runPairCode();
    else if (command === 'status') await runStatus();
    else if (command === 'canary-inbound') await runInbound();
    else if (command === 'canary-outbound') await runOutbound();
    else if (command === 'cleanup-qr') emitEvent('QR_CLEANUP', { removed: await removeEphemeralQr(config) });
    else if (command === 'rollback') await runRollback();
    else throw new Error('v152_e_command_invalid');
} catch (error) {
    await closeSocket();
    await removeEphemeralQr(config).catch(() => {});
    if (command === 'pair-code' && authState?.creds?.registered !== true) {
        await fs.rm(config.sessionDirectory, { recursive: true, force: true }).catch(() => {});
    }
    emitEvent('FAILED', { code: String(error?.message || 'v152_e_unknown_error') });
    process.exitCode = 1;
}
