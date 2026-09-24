import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { assertHistoricalProtectedEquivalence } from
    '../scripts/guard-freeze-lock-successor-v202-r4.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifests = [
    'docs/freeze/ec-v51-browser-successor-v181-20260918.json',
    'docs/freeze/ec-panel-only-agency-city-scope-v183-20260918.json',
    'docs/freeze/ec-v181-v183-canonical-successor-v184-20260918.json',
    'docs/freeze/vsl-first-response-watchdog-v193-20260919.json',
    'docs/freeze/post-sale-dropi-reconciler-v194-20260920.json'
];
const manifest = JSON.parse(fs.readFileSync(path.join(root,
    'docs/freeze/unified-successor-v47-v77h2-v202-r4-20260924.json')));
const historicalShipments = execFileSync('git', [
    'show', '641759b160c2b91e95a3f1df371ad372a74d72e1:src/routes/shipments.js'
], { cwd: root });
const protectedFiles = new Set();
for (const relative of manifests) {
    const record = JSON.parse(fs.readFileSync(path.join(root, relative)));
    for (const section of [record, record.runtimeGuardSuccessor || {}]) {
        for (const key of ['protectedFiles', 'inheritedProtectedFiles']) {
            for (const file of Object.keys(section[key] || {})) protectedFiles.add(file);
        }
    }
}
const fixtureBlobs = new Map([...new Set([...manifests, ...protectedFiles])].map(relative => [
    relative, execFileSync('git', ['show', `HEAD:${relative}`], { cwd: root })
]));

function fixture(t) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vitalismen-r4-freeze-lock-'));
    t.after(() => {
        assert.ok(path.basename(directory).startsWith('vitalismen-r4-freeze-lock-'));
        fs.rmSync(directory, { recursive: true, force: true });
    });
    const currentRoot = path.join(directory, 'current');
    const historicalRoot = path.join(directory, 'historical');
    fs.mkdirSync(currentRoot);
    fs.mkdirSync(historicalRoot);
    for (const [relative, bytes] of fixtureBlobs) {
        for (const target of [currentRoot, historicalRoot]) {
            const destination = path.join(target, relative);
            fs.mkdirSync(path.dirname(destination), { recursive: true });
            fs.writeFileSync(destination, bytes);
        }
    }
    fs.writeFileSync(path.join(historicalRoot, 'src/routes/shipments.js'), historicalShipments);
    return { currentRoot, historicalRoot, manifest: structuredClone(manifest) };
}

test('R4 preserva 52 arquivos protegidos com só a sucessão canônica de shipments', t => {
    const input = fixture(t);
    const result = assertHistoricalProtectedEquivalence(input);
    assert.equal(result.protectedFiles, 52);
    assert.equal(result.successorIdentities, 1);
});

test('hash desconhecido de shipments no R4 bloqueia', t => {
    const input = fixture(t);
    fs.appendFileSync(path.join(input.currentRoot, 'src/routes/shipments.js'), '\n// teste negativo\n');
    assert.throws(() => assertHistoricalProtectedEquivalence(input), /R4_SHIPMENTS_IDENTITY_INVALID/);
});

test('hash histórico de shipments sob identidade R4 bloqueia', t => {
    const input = fixture(t);
    fs.writeFileSync(path.join(input.currentRoot, 'src/routes/shipments.js'), historicalShipments);
    assert.throws(() => assertHistoricalProtectedEquivalence(input), /R4_HISTORICAL_DELTA_INVALID/);
});

test('hash R4 de shipments sob baseline V201 bloqueia', t => {
    const input = fixture(t);
    fs.writeFileSync(path.join(input.historicalRoot, 'src/routes/shipments.js'),
        fixtureBlobs.get('src/routes/shipments.js'));
    assert.throws(() => assertHistoricalProtectedEquivalence(input), /R4_HISTORICAL_DELTA_INVALID/);
});

test('mudança de outro arquivo histórico bloqueia mesmo se estiver na allowlist', t => {
    const input = fixture(t);
    fs.appendFileSync(path.join(input.currentRoot, 'src/routes/zapi.js'), '\n// teste negativo\n');
    assert.throws(() => assertHistoricalProtectedEquivalence(input), /R4_HISTORICAL_FILE_CHANGED/);
});

test('manifesto histórico adulterado bloqueia', t => {
    const input = fixture(t);
    fs.appendFileSync(path.join(input.currentRoot, manifests[0]), ' ');
    assert.throws(() => assertHistoricalProtectedEquivalence(input));
});
