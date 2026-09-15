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
import {
    V167BAuthorizedWebControlServer,
    resolveV167BConfig
} from '../src/whatsapp/core/AuthorizedWebCanaryV167B.js';

process.umask(0o077);

const workerConfig = resolveV152ER4Config(process.env);
const canaryConfig = resolveV167BConfig(process.env);
const stateStore = new V152ER4StateStore({ config: workerConfig });
const logger = pino({ level: 'silent' });

const assertExistingPairedSession = async () => {
    const stat = await fs.lstat(workerConfig.sessionDirectory).catch((error) => {
        if (error?.code === 'ENOENT') throw new Error('v167b_session_not_paired');
        throw error;
    });
    if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0) {
        throw new Error('v167b_session_path_invalid');
    }
    const canonical = await fs.realpath(workerConfig.sessionDirectory);
    if (path.resolve(canonical) !== path.resolve(workerConfig.sessionDirectory)) {
        throw new Error('v167b_session_path_invalid');
    }
    const creds = JSON.parse(await fs.readFile(path.join(workerConfig.sessionDirectory, 'creds.json'), 'utf8'));
    if (!inspectBaileysAuthStateForRestart(creds).structurallyComplete) {
        throw new Error('v167b_session_not_restorable');
    }
};

const socketFactory = async () => {
    await assertExistingPairedSession();
    const { state, saveCreds } = await useMultiFileAuthState(workerConfig.sessionDirectory);
    if (!inspectBaileysAuthStateForRestart(state?.creds).structurallyComplete) {
        throw new Error('v167b_session_not_restorable');
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

const worker = new PersistentShadowWorkerV152ER4({ config: workerConfig, stateStore, socketFactory });
const controlServer = new V167BAuthorizedWebControlServer({ worker, config: canaryConfig });
const writeRecord = (record) => new Promise((resolve, reject) => {
    process.stdout.write(`${JSON.stringify(record)}\n`, (error) => error ? reject(error) : resolve());
});

let resolveShutdown;
const shutdownSignal = new Promise((resolve) => { resolveShutdown = resolve; });
let shutdownStarted = false;
const shutdown = (signal) => {
    if (shutdownStarted) return;
    shutdownStarted = true;
    void controlServer.stop()
        .catch(() => {})
        .then(() => worker.stop())
        .catch(() => {})
        .finally(() => resolveShutdown(signal));
};

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));

try {
    await worker.start();
    await controlServer.start();
    await writeRecord({
        phase: 'V167B_AUTHORIZED_WEB_CANARY',
        event: 'AUTHORIZED_CONTROL_PORT_STARTED',
        processName: workerConfig.processName,
        channelId: workerConfig.channelId,
        provider: workerConfig.provider,
        shadow: true,
        draining: true,
        weight: 0,
        capacity: 0,
        maxConcurrentSockets: 1,
        authorizedRecipients: 1,
        qrGeneration: false,
        pairingRequests: 0,
        generalOutboundQueueConsumption: 0,
        customerInboundRouting: 0,
        secretsPrinted: false
    });
    await shutdownSignal;
    await writeRecord({
        phase: 'V167B_AUTHORIZED_WEB_CANARY',
        event: 'AUTHORIZED_CONTROL_PORT_STOPPED',
        cleanShutdown: true,
        secretsPrinted: false
    });
    process.exit(0);
} catch {
    await controlServer.stop().catch(() => {});
    await worker.stop().catch(() => {});
    await writeRecord({
        phase: 'V167B_AUTHORIZED_WEB_CANARY',
        event: 'AUTHORIZED_CONTROL_PORT_FAILED_CLOSED',
        errorClass: 'WORKER_START_FAILED',
        pairingRequests: 0,
        qrGeneration: false,
        secretsPrinted: false
    }).catch(() => {});
    process.exit(1);
}
