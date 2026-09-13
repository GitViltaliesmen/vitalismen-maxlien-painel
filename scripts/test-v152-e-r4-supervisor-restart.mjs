#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'v152-e-r4-supervisor-'));
const sessionRoot = path.join(root, 'sessions');
const sessionDirectory = path.join(sessionRoot, 'V152_TEST_WEB_01');
const stateRoot = path.join(root, 'state');
await fs.mkdir(sessionDirectory, { recursive: true, mode: 0o700 });
await fs.chmod(sessionRoot, 0o700);
await fs.chmod(sessionDirectory, 0o700);
const creds = `${JSON.stringify({ registered: true, me: { id: '5531983002800@s.whatsapp.net' } })}\n`;
await fs.writeFile(path.join(sessionDirectory, 'creds.json'), creds, { mode: 0o600 });
const initialHash = crypto.createHash('sha256').update(creds).digest('hex');
const child = path.resolve('scripts/fixtures/v152-e-r4-shadow-worker-child.mjs');
const env = {
    ...process.env,
    V152_E_R4_PERSISTENT_SHADOW_APPROVED: 'true',
    V152_E_CHANNEL_ID: 'V152_TEST_WEB_01',
    V152_E_SESSION_NAMESPACE: 'V152_TEST_WEB_01',
    V152_E_TEST_CHANNEL_PHONE: '5531983002800',
    WHATSAPP_SESSION_STORAGE_ROOT: sessionRoot,
    V152_E_R4_STATE_ROOT: stateRoot,
    V152_E_R4_FIXTURE_RELEASE_ROOT: path.resolve('scripts')
};

const runGeneration = () => {
    const result = spawnSync(process.execPath, [child], { cwd: process.cwd(), env, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const lines = result.stdout.trim().split(/\r?\n/).filter(Boolean);
    assert.equal(lines.length, 1, 'fixture must emit one sanitized JSON line');
    return JSON.parse(lines[0]);
};

try {
    const first = runGeneration();
    const second = runGeneration();
    for (const generation of [first, second]) {
        assert.equal(generation.connected, true);
        assert.equal(generation.phone, '5531983002800');
        assert.equal(generation.peakSocketCount, 1);
        assert.equal(generation.qrEvents, 0);
        assert.equal(generation.pairingRequests, 0);
        assert.equal(generation.outboundCalls, 0);
        assert.equal(generation.sessionHashBefore, initialHash);
        assert.equal(generation.sessionHashAfter, initialHash);
        assert.equal(generation.stopped, true);
    }
    process.stdout.write([
        'SUPERVISOR_RESTART_SIMULATION=PASS',
        'START_STOP_START=PASS',
        'SESSION_RESTORED_AFTER_RESTART=YES',
        'NEW_QR_REQUIRED=NO',
        'CONNECTED_PHONE=5531983002800',
        'MAX_CONCURRENT_SOCKETS=1',
        'PAIRING_REQUESTS=0',
        'OUTBOUND_PROVIDER_CALLS=0'
    ].join('\n') + '\n');
} finally {
    await fs.rm(root, { recursive: true, force: true });
}
