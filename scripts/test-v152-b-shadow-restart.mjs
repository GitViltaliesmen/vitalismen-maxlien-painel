import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'v152-b-restart-'));
const child = path.join(process.cwd(), 'scripts', 'fixtures', 'v152-b-shadow-child.mjs');
try {
    const states = [];
    for (let run = 0; run < 2; run += 1) {
        const result = spawnSync(process.execPath, [child], {
            cwd: process.cwd(),
            env: { ...process.env, WHATSAPP_SESSION_STORAGE_ROOT: root },
            encoding: 'utf8'
        });
        assert.equal(result.status, 0, result.stderr);
        states.push(JSON.parse(result.stdout));
    }
    assert.deepEqual(states.map((state) => state.generation), [1, 2]);
    assert.deepEqual(states.map((state) => state.paired), [false, false]);
    assert.deepEqual(states.map((state) => state.networkCalls), [0, 0]);
    process.stdout.write('V152_B_RESTART_SUITE=PASS restarts=2 real_pairing=0 network_calls=0\n');
} finally {
    fs.rmSync(root, { recursive: true, force: true });
}
