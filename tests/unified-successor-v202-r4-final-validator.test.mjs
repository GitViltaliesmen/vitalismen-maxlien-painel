import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { assertR4FinalStagingContract, assertR4FinalContext } from
    '../scripts/guard-final-release-validator-successor-v202-r4.mjs';
import { assertReleaseFileHashes, SHIPMENTS_SHA256 } from
    '../scripts/lib/unified-successor-v202-r4-authority.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const commit = '494b73f1630956b024bd9b48f69297c3070875f5';
const tree = '326214a6a11d901f119b848117c6d1a03498e72c';
const hash = 'a'.repeat(64);
const releaseName = '20260924T120000Z_production-20260924-494b73f';
const checkpoint = { r4OperationalCommit: commit, r4OperationalTree: tree };
const source = {
    releaseName, functionalCommit: commit, functionalTree: tree,
    publicationStatus: 'staged_candidate', strictReadOnly: true,
    safeObservationPolicy: 'STRICT_READ_ONLY', allowedWriteClasses: [],
    productionBranchChanged: false,
    sourceRef: 'refs/heads/codex/repurchase-purchase-ordering-v202'
};
const staging = {
    status: 'complete', publicationStatus: 'staged_candidate', releaseName,
    commit, functionalCommit: commit, functionalTree: tree,
    sourceRef: source.sourceRef, sourceRefResolvedCommit: commit,
    releaseMetadataSha256: hash, safeOverlaySha256: hash,
    baseEnvSha256: hash, functionalPayloadSha256: hash,
    nodeModulesSha256: hash, productionBranchCommitBefore: commit,
    productionBranchCommitAfter: commit, productionBranchChanged: false,
    currentUnchanged: true, pm2Unchanged: true, strictReadOnly: true,
    safeObservationPolicy: 'STRICT_READ_ONLY', allowedWriteClasses: [],
    postSaleCompatibilityPreflight: 'PASS_SAFE_BOOT', v66SafeObservationRequired: true
};
const input = () => ({ source: structuredClone(source), staging: structuredClone(staging),
    checkpoint: structuredClone(checkpoint), releaseName,
    sourceSha256: hash, overlaySha256: hash, baseEnvSha256: hash });

test('final R4: envelope staged íntegro com identidade e política exatas', () => {
    assert.equal(assertR4FinalStagingContract(input()), true);
});

test('final R4: contexto exato é obrigatório e identidade errada bloqueia', () => {
    const context = { loaded: true, releaseAttestationValidated: true,
        releaseCommit: commit, releaseTree: tree, shipmentsSha256: SHIPMENTS_SHA256 };
    assert.equal(assertR4FinalContext(context, checkpoint), true);
    assert.throws(() => assertR4FinalContext(undefined, checkpoint));
    for (const change of [
        value => { value.releaseAttestationValidated = false; },
        value => { value.releaseCommit = '0'.repeat(40); },
        value => { value.releaseTree = '0'.repeat(40); },
        value => { value.shipmentsSha256 = '0'.repeat(64); }
    ]) {
        const value = structuredClone(context);
        change(value);
        assert.throws(() => assertR4FinalContext(value, checkpoint));
    }
});

test('final R4: arquivo do validator adulterado bloqueia identidade materializada', t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vitalismen-r4-final-hash-'));
    t.after(() => {
        assert.ok(path.basename(directory).startsWith('vitalismen-r4-final-hash-'));
        fs.rmSync(directory, { recursive: true, force: true });
    });
    const files = [
        ['docs/freeze/unified-successor-v47-v77h2-v202-r4-20260924.json',
            'r4OperationalManifestSha256'],
        ['scripts/lib/unified-successor-v202-r4-preload.mjs', 'r4OperationalPreloadSha256'],
        ['scripts/guard-unified-successor-v202-r4.mjs', 'r4OperationalGuardSha256'],
        ['scripts/run-unified-successor-v202-r4.mjs', 'r4OperationalRunnerSha256'],
        ['scripts/guard-freeze-lock-successor-v202-r4.mjs', 'r4FreezeLockSuccessorSha256'],
        ['scripts/guard-final-release-validator-successor-v202-r4.mjs',
            'r4FinalValidatorSha256']
    ];
    const expected = {};
    for (const [relative, key] of files) {
        const bytes = fs.readFileSync(path.join(root, relative));
        expected[key] = crypto.createHash('sha256').update(bytes).digest('hex');
        const destination = path.join(directory, relative);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.writeFileSync(destination, bytes);
    }
    const manifest = JSON.parse(fs.readFileSync(path.join(directory, files[0][0])));
    assert.equal(assertReleaseFileHashes(directory, expected, manifest), true);
    fs.appendFileSync(path.join(directory, files.at(-1)[0]), '\n// tampered\n');
    assert.throws(() => assertReleaseFileHashes(directory, expected, manifest),
        /R4_RELEASE_HASH_CHANGED/);
});

for (const [name, mutate] of [
    ['commit errado', value => { value.staging.commit = '0'.repeat(40); }],
    ['tree errada', value => { value.staging.functionalTree = '0'.repeat(40); }],
    ['origem divergente', value => { value.source.functionalCommit = '0'.repeat(40); }],
    ['ref divergente', value => { value.staging.sourceRef = 'refs/heads/codex/other'; }],
    ['attestation da metadata errada', value => { value.staging.releaseMetadataSha256 = '0'.repeat(64); }],
    ['overlay alterado', value => { value.staging.safeOverlaySha256 = '0'.repeat(64); }],
    ['env alterado', value => { value.staging.baseEnvSha256 = '0'.repeat(64); }],
    ['node_modules sem hash', value => { value.staging.nodeModulesSha256 = '0'; }],
    ['staging incompleto', value => { value.staging.status = 'pending'; }],
    ['production alterada', value => { value.staging.productionBranchChanged = true; }],
    ['current alterado', value => { value.staging.currentUnchanged = false; }],
    ['PM2 alterado', value => { value.staging.pm2Unchanged = false; }],
    ['strict desligado', value => { value.staging.strictReadOnly = false; }],
    ['write class liberada', value => { value.staging.allowedWriteClasses = ['dropi']; }],
    ['V66 não seguro', value => { value.staging.v66SafeObservationRequired = false; }]
]) {
    test(`final R4 bloqueia ${name}`, () => {
        const value = input();
        mutate(value);
        assert.throws(() => assertR4FinalStagingContract(value));
    });
}
