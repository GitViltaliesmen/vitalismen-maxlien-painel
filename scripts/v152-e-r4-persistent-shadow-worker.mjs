#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import pino from 'pino';
import { Browsers, fetchLatestWaWebVersion, makeWASocket, useMultiFileAuthState } from '@whiskeysockets/baileys';
import { inspectBaileysAuthStateForRestart } from '../src/whatsapp/core/ControlledPairingRecoveryV152ER3.js';
import {
    PersistentShadowWorkerV152ER4,
    V152ER4StateStore,
    resolveV152ER4Config
} from '../src/whatsapp/core/PersistentShadowWorkerV152ER4.js';

process.umask(0o077);

const config = resolveV152ER4Config(process.env);
const stateStore = new V152ER4StateStore({ config });
const logger = pino({ level: 'silent' });

const assertExistingPairedSession = async () => {
    const stat = await fs.lstat(config.sessionDirectory).catch((error) => {
        if (error?.code === 'ENOENT') throw new Error('v152_e_r4_session_not_paired');
        throw error;
    });
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('v152_e_r4_session_path_invalid');
    if ((stat.mode & 0o077) !== 0) throw new Error('v152_e_r4_session_permissions_invalid');
    const canonical = await fs.realpath(config.sessionDirectory);
    if (path.resolve(canonical) !== path.resolve(config.sessionDirectory)) {
        throw new Error('v152_e_r4_session_path_invalid');
    }
    const persisted = JSON.parse(await fs.readFile(path.join(config.sessionDirectory, 'creds.json'), 'utf8'));
    if (!inspectBaileysAuthStateForRestart(persisted).structurallyComplete) {
        throw new Error('v152_e_r4_session_not_restorable');
    }
};

const socketFactory = async () => {
    await assertExistingPairedSession();
    const { state, saveCreds } = await useMultiFileAuthState(config.sessionDirectory);
    if (!inspectBaileysAuthStateForRestart(state?.creds).structurallyComplete) {
        throw new Error('v152_e_r4_session_not_restorable');
    }
    const { version } = await fetchLatestWaWebVersion();
    const socket = makeWASocket({
        version,
        auth: state,
        logger,
        printQRInTerminal: false,
        browser: Browsers.windows('Chrome'),
        syncFullHistory: false,
        markOnlineOnConnect: false,
        emitOwnEvents: false,
        generateHighQualityLinkPreview: false,
        getMessage: async () => undefined
    });
    return { socket, saveCreds };
};

const worker = new PersistentShadowWorkerV152ER4({ config, stateStore, socketFactory });
const writeSanitizedRecord = (record) => new Promise((resolve, reject) => {
    process.stdout.write(`${JSON.stringify(record)}\n`, (error) => error ? reject(error) : resolve());
});
let resolveShutdown;
const shutdownSignal = new Promise((resolve) => {
    resolveShutdown = resolve;
});
let shutdownStarted = false;
const shutdown = (signal) => {
    if (shutdownStarted) return;
    shutdownStarted = true;
    void worker.stop().catch(() => {}).finally(() => resolveShutdown(signal));
};

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));

try {
    await worker.start();
    await writeSanitizedRecord({
        phase: config.phase,
        event: 'PERSISTENT_SHADOW_WORKER_STARTED',
        processName: config.processName,
        channelId: config.channelId,
        provider: config.provider,
        shadow: true,
        draining: true,
        weight: 0,
        capacity: 0,
        qrGeneration: false,
        pairingRequests: 0,
        outboundQueueConsumption: 0,
        customerInboundRouting: 0,
        secretsPrinted: false
    });
    await shutdownSignal;
    await writeSanitizedRecord({
        phase: config.phase,
        event: 'PERSISTENT_SHADOW_WORKER_STOPPED',
        channelId: config.channelId,
        cleanShutdown: true,
        secretsPrinted: false
    });
    process.exit(0);
} catch {
    await worker.stop().catch(() => {});
    await writeSanitizedRecord({
        phase: config.phase,
        event: 'PERSISTENT_SHADOW_WORKER_FAILED_CLOSED',
        errorClass: 'WORKER_START_FAILED',
        pairingRequests: 0,
        qrGeneration: false,
        secretsPrinted: false
    }).catch(() => {});
    process.exit(1);
}
