#!/usr/bin/env node
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
    PersistentShadowWorkerV152ER4,
    V152ER4StateStore,
    resolveV152ER4Config
} from '../../src/whatsapp/core/PersistentShadowWorkerV152ER4.js';

const releaseRoot = path.resolve(process.env.V152_E_R4_FIXTURE_RELEASE_ROOT || process.cwd());
const config = resolveV152ER4Config(process.env, { releaseRoot });
const credsPath = path.join(config.sessionDirectory, 'creds.json');
const credsBefore = await fs.readFile(credsPath);
let socketCount = 0;
let peakSocketCount = 0;
let outboundCalls = 0;
let qrEvents = 0;
let currentEvents;

const socketFactory = async () => {
    socketCount += 1;
    peakSocketCount = Math.max(peakSocketCount, socketCount);
    const ev = new EventEmitter();
    currentEvents = ev;
    const socket = {
        ev,
        user: { id: '5531983002800@s.whatsapp.net' },
        async end() { socketCount -= 1; }
    };
    return {
        socket,
        async saveCreds() { outboundCalls += 0; }
    };
};

const worker = new PersistentShadowWorkerV152ER4({
    config,
    stateStore: new V152ER4StateStore({ config }),
    socketFactory,
    setIntervalFn: () => null,
    clearIntervalFn: () => {}
});

await worker.start();
currentEvents.emit('connection.update', { connection: 'open' });
await worker.whenIdle();
const active = worker.snapshot();
await worker.stop();
const credsAfter = await fs.readFile(credsPath);
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

process.stdout.write(`${JSON.stringify({
    phase: config.phase,
    connected: active.connectionState === 'CONNECTED' && active.health === 'PASS',
    phone: active.phone,
    peakSocketCount,
    qrEvents,
    pairingRequests: 0,
    outboundCalls,
    sessionHashBefore: sha256(credsBefore),
    sessionHashAfter: sha256(credsAfter),
    stopped: worker.snapshot().connectionState === 'STOPPED'
})}\n`);
