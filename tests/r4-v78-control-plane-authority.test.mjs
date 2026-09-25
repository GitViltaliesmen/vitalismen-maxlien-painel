import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    R4_SUCCESSOR_CHECKPOINT_SHA256, R4_SUCCESSOR_COMMIT, R4_SUCCESSOR_TREE,
    R4_SUCCESSOR_MANIFEST_PATH, R4_CONTROLLER_PIN_MANIFEST_PATH, R4_PRELOAD_PATH,
    R4_GUARD_PATH, R4_RUNNER_PATH, R4_FREEZE_LOCK_SUCCESSOR_PATH,
    R4_FINAL_VALIDATOR_PATH, V201_COMMIT, V201_TREE, V201_MANIFEST_SHA256,
    SHIPMENTS_SHA256, V168B_SHA256, META_DATASET_ID,
    validateCheckpoint, validateR4Manifest, assertReleaseFileHashes,
    manifestPathForCheckpoint
} from '../scripts/lib/unified-successor-v202-r4-authority.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bytes = relative => fs.readFileSync(path.join(root, relative));
const sha = relative => crypto.createHash('sha256').update(bytes(relative)).digest('hex');
const parent = JSON.parse(bytes(R4_SUCCESSOR_MANIFEST_PATH));
const successor = JSON.parse(bytes(R4_CONTROLLER_PIN_MANIFEST_PATH));
const hashFields = {
    r4OperationalManifestSha256: R4_CONTROLLER_PIN_MANIFEST_PATH,
    r4OperationalPreloadSha256: R4_PRELOAD_PATH,
    r4OperationalGuardSha256: R4_GUARD_PATH,
    r4OperationalRunnerSha256: R4_RUNNER_PATH,
    r4FreezeLockSuccessorSha256: R4_FREEZE_LOCK_SUCCESSOR_PATH,
    r4FinalValidatorSha256: R4_FINAL_VALIDATOR_PATH,
    r4AuthoritySha256: 'scripts/lib/unified-successor-v202-r4-authority.mjs',
    r4StageHelperSha256: 'ops/vitalismen-stage',
    r4WrapperSha256: 'ops/ec-bot-core-v78-successor-r4',
    r4ParentProtectionSha256: 'scripts/lib/ec-bot-core-parent-protection-r4.mjs',
    r4V78SelectorSha256: 'src/services/ecBotCoreOperationalV78Service.js',
    r4V78ContractSha256: 'scripts/lib/ec-bot-core-operational-contract-v78.mjs',
    r4Pm2ControllerSha256: 'scripts/lib/pm2-target-env-restart-v78-r4.mjs',
    r4RollbackExecutorSha256: 'ops/vitalismen-rollback-v201-r4.mjs',
    r4StageVerifierSha256: 'scripts/verify-unified-successor-v202-r4-stage.mjs'
};
const fixtureCheckpoint = () => ({
    checkpointId: 'CHECKPOINT_R4_V78_CONTROLLER_PIN_AUTHORITY',
    status: 'FROZEN', parentCheckpoint: 'CHECKPOINT_R4_V78_CONTROL_PLANE_AUTHORITY',
    parentCheckpointSha256: R4_SUCCESSOR_CHECKPOINT_SHA256,
    parentR4Commit: R4_SUCCESSOR_COMMIT, parentR4Tree: R4_SUCCESSOR_TREE,
    project: 'MAXLIEN EC — VITALISMEN OFICIAL',
    r4OperationalCommit: 'a'.repeat(40), r4OperationalTree: 'b'.repeat(40),
    ...Object.fromEntries(Object.entries(hashFields).map(([key, relative]) =>
        [key, sha(relative)])),
    allowlistCount: 83, v201PublishedCommit: V201_COMMIT,
    v201PublishedTree: V201_TREE, v201ManifestSha256: V201_MANIFEST_SHA256,
    shipmentsSha256: SHIPMENTS_SHA256, v168bSha256: V168B_SHA256,
    metaDatasetId: META_DATASET_ID
});

test('manifesto controller-pin conserva 83 entradas e altera somente stage', () => {
    assert.equal(sha(R4_SUCCESSOR_MANIFEST_PATH), successor.parentManifestSha256);
    assert.equal(validateR4Manifest(successor).allowlist.length, 83);
    assert.equal(successor.allowlist.length, parent.allowlist.length);
    const differences = successor.allowlist.filter((entry, index) =>
        JSON.stringify(entry) !== JSON.stringify(parent.allowlist[index]));
    assert.deepEqual(differences.map(entry => entry.path), ['ops/vitalismen-stage']);
    assert.equal(successor.parentAuthoritySha256, R4_SUCCESSOR_CHECKPOINT_SHA256);
});

test('checkpoint sucessor exige pai, identidades e hashes exatos', () => {
    const checkpoint = fixtureCheckpoint();
    assert.equal(validateCheckpoint(checkpoint), checkpoint);
    assert.equal(manifestPathForCheckpoint(checkpoint), R4_CONTROLLER_PIN_MANIFEST_PATH);
    for (const [field, value] of [
        ['parentCheckpoint', 'UNKNOWN'], ['parentCheckpointSha256', '0'.repeat(64)],
        ['parentR4Commit', '0'.repeat(40)], ['parentR4Tree', '0'.repeat(40)],
        ['shipmentsSha256', '0'.repeat(64)], ['v168bSha256', '0'.repeat(64)],
        ['metaDatasetId', '0'], ['r4OperationalCommit', 'wrong'],
        ['r4OperationalTree', 'wrong'], ['r4WrapperSha256', 'wrong']
    ]) {
        assert.throws(() => validateCheckpoint({ ...checkpoint, [field]: value }), field);
    }
    assert.throws(() => validateCheckpoint({ ...checkpoint, unexpected: true }));
});

test('hashes de todos os arquivos de controle são exigidos', () => {
    const checkpoint = fixtureCheckpoint();
    assert.equal(assertReleaseFileHashes(root, checkpoint, successor), true);
    for (const field of ['r4OperationalManifestSha256', 'r4OperationalPreloadSha256',
        'r4OperationalGuardSha256', 'r4OperationalRunnerSha256',
        'r4AuthoritySha256', 'r4StageHelperSha256', 'r4WrapperSha256',
        'r4ParentProtectionSha256', 'r4Pm2ControllerSha256',
        'r4V78SelectorSha256', 'r4V78ContractSha256',
        'r4RollbackExecutorSha256', 'r4StageVerifierSha256']) {
        assert.throws(() => assertReleaseFileHashes(root,
            { ...checkpoint, [field]: '0'.repeat(64) }, successor), field);
    }
});

test('cadeia authority → preload → guard → runner permanece selada', () => {
    const preload = bytes(R4_PRELOAD_PATH).toString('utf8');
    const guard = bytes(R4_GUARD_PATH).toString('utf8');
    const runner = bytes(R4_RUNNER_PATH).toString('utf8');
    const pm2 = bytes('scripts/lib/pm2-target-env-restart-v78-r4.mjs').toString('utf8');
    const rollback = bytes('ops/vitalismen-rollback-v201-r4.mjs').toString('utf8');
    assert.ok(preload.includes(sha('scripts/lib/unified-successor-v202-r4-authority.mjs')));
    assert.ok(pm2.includes(sha('scripts/lib/unified-successor-v202-r4-authority.mjs')));
    assert.ok(rollback.includes(sha('scripts/lib/unified-successor-v202-r4-authority.mjs')));
    assert.ok(guard.includes(sha(R4_PRELOAD_PATH)));
    assert.ok(guard.includes(sha(R4_CONTROLLER_PIN_MANIFEST_PATH)));
    assert.ok(runner.includes(sha(R4_GUARD_PATH)));
    assert.equal(successor.allowlist.find(entry => entry.path === 'ops/vitalismen-stage')
        .canonicalSha256, sha('ops/vitalismen-stage'));
});
