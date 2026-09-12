#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import pino from 'pino';
import QRCode from 'qrcode';
import { fetchLatestBaileysVersion, makeWASocket, useMultiFileAuthState } from '@whiskeysockets/baileys';
import {
    ControlledCanaryLedger,
    V152_E_FIXED_OUTBOUND_TEXT,
    assertPairedPhoneAllowed,
    candidatePhoneFromMessage,
    ensureSecureDirectory,
    hardenSessionTree,
    maskPhone,
    phoneFingerprint,
    readJsonIfPresent,
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
const identityFile = path.join(config.evidenceRoot, 'paired-channel.json');
const inboundEvidenceFile = path.join(config.evidenceRoot, 'controlled-inbound.json');
const safeLogger = pino({ level: 'silent' });
let socket = null;

const emit = (record) => process.stdout.write(`${JSON.stringify(record)}\n`);
const emitEvent = (event, extra = {}) => emit({ phase: config.phase, event, ...extra });

const closeSocket = async () => {
    if (!socket) return;
    try { socket.ev?.removeAllListeners?.(); } catch {}
    try { socket.end?.(undefined); } catch {}
    socket = null;
};

const ownPhone = () => String(socket?.user?.id || '').split('@')[0].split(':')[0].replace(/\D/g, '');

const createSocket = async ({ allowQr }) => {
    await ensureSecureDirectory(config.sessionStorageRoot);
    await ensureSecureDirectory(config.sessionDirectory);
    await ensureSecureDirectory(config.evidenceRoot);
    const { state, saveCreds } = await useMultiFileAuthState(config.sessionDirectory);
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
        void saveCreds()
            .then(() => hardenSessionTree(config.sessionDirectory))
            .catch(() => emitEvent('CREDENTIAL_PERSISTENCE_FAILED'));
    });
    if (!allowQr) {
        socket.ev.on('connection.update', (update) => {
            if (update.qr) emitEvent('UNEXPECTED_QR_BLOCKED');
        });
    }
    return socket;
};

const waitForOpen = async ({ allowQr }) => new Promise((resolve, reject) => {
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
                await hardenSessionTree(config.sessionDirectory);
                let phone;
                try {
                    phone = assertPairedPhoneAllowed(ownPhone(), config);
                } catch (error) {
                    if (String(error?.message || '') === 'v152_e_same_phone_dual_provider_forbidden') {
                        await socket?.logout?.().catch(() => {});
                        await hardenSessionTree(config.sessionDirectory).catch(() => {});
                    }
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
        if (update.connection === 'close') finish(new Error('v152_e_connection_closed_before_ready'));
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
    return identity;
};

const runPair = async () => {
    await connectControlled({ allowQr: true });
    await closeSocket();
    emitEvent('PAIRING_COMPLETE', { sessionOutsideRelease: true, qrPersisted: false });
};

const runStatus = async () => {
    await connectControlled({ allowQr: false });
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
        await writeJsonAtomic(inboundEvidenceFile, evidence);
        emitEvent('INBOUND_CANARY_PASS', evidence);
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
    else if (command === 'status') await runStatus();
    else if (command === 'canary-inbound') await runInbound();
    else if (command === 'canary-outbound') await runOutbound();
    else if (command === 'cleanup-qr') emitEvent('QR_CLEANUP', { removed: await removeEphemeralQr(config) });
    else if (command === 'rollback') await runRollback();
    else throw new Error('v152_e_command_invalid');
} catch (error) {
    await closeSocket();
    await removeEphemeralQr(config).catch(() => {});
    emitEvent('FAILED', { code: String(error?.message || 'v152_e_unknown_error') });
    process.exitCode = 1;
}
