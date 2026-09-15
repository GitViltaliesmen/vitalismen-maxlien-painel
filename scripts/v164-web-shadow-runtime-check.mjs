#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

import { inspectBaileysAuthStateForRestart } from '../src/whatsapp/core/ControlledPairingRecoveryV152ER3.js';

const command = process.argv[2];
const target = path.resolve(String(process.argv[3] || ''));
const expectedPid = Number(process.argv[4] || 0);

const safeStat = async (value, expectedMode) => {
    const stat = await fs.lstat(value);
    assert.equal(stat.isSymbolicLink(), false);
    assert.equal(stat.mode & 0o777, expectedMode);
    assert.equal(stat.uid, 0);
    assert.equal(stat.gid, 0);
    assert.equal(path.resolve(await fs.realpath(value)), path.resolve(value));
    return stat;
};

if (command === 'session') {
    await safeStat(target, 0o700);
    const credsPath = path.join(target, 'creds.json');
    await safeStat(credsPath, 0o600);
    const creds = JSON.parse(await fs.readFile(credsPath, 'utf8'));
    assert.equal(inspectBaileysAuthStateForRestart(creds).structurallyComplete, true);
    process.stdout.write([
        'SESSION_RESTORABLE=YES',
        'CREDS_REUSED=YES',
        'NEW_PAIRING_REQUIRED=NO'
    ].join('\n') + '\n');
    process.exit(0);
}

if (command === 'health') {
    await safeStat(target, 0o600);
    const state = JSON.parse(await fs.readFile(target, 'utf8'));
    assert.equal(state.schema, 'V152_E_R4_SHADOW_WORKER_STATE_V1');
    assert.equal(state.channelId, 'V152_TEST_WEB_01');
    assert.equal(state.provider, 'WHATSAPP_WEB');
    assert.equal(state.phone, '5531983002800');
    assert.equal(state.sessionNamespace, 'V152_TEST_WEB_01');
    assert.equal(state.sessionState, 'RESTORED');
    assert.equal(state.connectionState, 'CONNECTED');
    assert.equal(state.status, 'ACTIVE');
    assert.equal(state.health, 'PASS');
    assert.equal(state.pairingRequired, 'NO');
    assert.equal(state.shadow, true);
    assert.equal(state.draining, true);
    assert.equal(state.weight, 0);
    assert.equal(state.capacity, 0);
    assert.equal(state.workerPid, expectedPid);
    assert.ok(Date.now() - new Date(state.heartbeatAt).getTime() <= 45000);
    process.stdout.write([
        'WEB_WORKER_HEALTH=PASS',
        'SESSION_RESTORED=YES',
        'WEB_SHADOW=true',
        'WEB_DRAINING=true',
        'WEB_WEIGHT=0',
        'WEB_CAPACITY=0',
        'PAIRING_REQUIRED=NO'
    ].join('\n') + '\n');
    process.exit(0);
}

throw new Error('usage: v164-web-shadow-runtime-check.mjs session DIRECTORY | health STATE_FILE EXPECTED_PID');
