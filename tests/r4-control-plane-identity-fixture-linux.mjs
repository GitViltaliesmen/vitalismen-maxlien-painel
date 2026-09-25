import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
    R4_MANIFEST_PATH, R4_PRELOAD_PATH, R4_GUARD_PATH, R4_RUNNER_PATH,
    R4_FREEZE_LOCK_SUCCESSOR_PATH, R4_FINAL_VALIDATOR_PATH,
    V201_COMMIT, V201_TREE, V201_MANIFEST_SHA256, SHIPMENTS_SHA256,
    V168B_SHA256, META_DATASET_ID, classifyReleasePreload,
    assertNodeOptionsForRelease, readAuthorizedCheckpoint
} from '../scripts/lib/unified-successor-v202-r4-authority.mjs';
import {
    EC_BOT_CORE_R4_NODE_OPTIONS, EC_BOT_CORE_V199_NODE_OPTIONS,
    selectEcBotCoreV78PreloadForRelease
} from '../src/services/ecBotCoreOperationalV78Service.js';

const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const [mode, releaseRoot, state] = process.argv.slice(2);
assert.equal(process.platform, 'linux');
assert.equal(process.getuid(), 0);
assert.equal(process.argv.length, 5);
const release = path.resolve(releaseRoot);
const commit = 'abcdef0123456789abcdef0123456789abcdef01';
const tree = '1234567890abcdef1234567890abcdef12345678';
const releaseName = '20260925T120000Z_production-20260925-abcdef0';
assert.equal(path.basename(release), releaseName);
const manifest = path.join(release, R4_MANIFEST_PATH);
const digest = relative => sha(path.join(release, relative));
const checkpoint = {
    checkpointId: 'CHECKPOINT_R4_V78_PAYLOAD_AUTHORITY',
    status: 'FROZEN',
    parentCheckpoint: 'CHECKPOINT_R4_CONTROL_PLANE_SUCCESSOR_AUTHORITY',
    parentR4Commit: 'b842b1e366160b50dd15322dd212da309c1b92b2',
    parentR4Tree: '186e601d07fb4242c648f95d71cc71eb9433444a',
    parentAuthorityCheckpointSha256:
        'e7f7f6fbbea1359f8802c98ebf8ced2ffd201e049329e60cd8eb1c7f08c480c9',
    project: 'MAXLIEN EC — VITALISMEN OFICIAL',
    r4OperationalCommit: commit,
    r4OperationalTree: tree,
    r4OperationalManifestSha256: sha(manifest),
    r4OperationalPreloadSha256: digest(R4_PRELOAD_PATH),
    r4OperationalGuardSha256: digest(R4_GUARD_PATH),
    r4OperationalRunnerSha256: digest(R4_RUNNER_PATH),
    r4FreezeLockSuccessorSha256: digest(R4_FREEZE_LOCK_SUCCESSOR_PATH),
    r4FinalValidatorSha256: digest(R4_FINAL_VALIDATOR_PATH),
    allowlistCount: 83,
    v201PublishedCommit: V201_COMMIT,
    v201PublishedTree: V201_TREE,
    v201ManifestSha256: V201_MANIFEST_SHA256,
    shipmentsSha256: SHIPMENTS_SHA256,
    v168bSha256: V168B_SHA256,
    metaDatasetId: META_DATASET_ID
};
if (mode === 'prepare') {
    assert.equal(fs.existsSync(path.join(release, '.release-source.json')), false);
    fs.writeFileSync(path.join(release, '.release-source.json'), JSON.stringify({
        releaseName, functionalCommit: commit, functionalTree: tree
    }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    fs.mkdirSync(state, { recursive: true, mode: 0o700 });
    fs.chmodSync(state, 0o700);
    const file = path.join(state, `${checkpoint.checkpointId}.json`);
    fs.writeFileSync(file, JSON.stringify(checkpoint, null, 2) + '\n',
        { flag: 'wx', mode: 0o400 });
    process.stdout.write('FIXTURE_PREPARED=YES\n');
} else if (mode === 'verify') {
    const observed = readAuthorizedCheckpoint();
    assert.deepEqual(observed.value, checkpoint);
    assert.equal(classifyReleasePreload(release), R4_PRELOAD_PATH);
    assert.equal(assertNodeOptionsForRelease(release, EC_BOT_CORE_R4_NODE_OPTIONS),
        EC_BOT_CORE_R4_NODE_OPTIONS);
    assert.throws(() => assertNodeOptionsForRelease(release, EC_BOT_CORE_V199_NODE_OPTIONS));
    const identity = { release: releaseName, commit, tree,
        tag: `production-20260925-${commit.slice(0, 7)}`,
        successorManifestSha256: sha(manifest) };
    const prior = globalThis.__VITALISMEN_R4_OPERATIONAL_CONTEXT;
    globalThis.__VITALISMEN_R4_OPERATIONAL_CONTEXT = Object.freeze({ loaded: true });
    try {
        assert.equal(selectEcBotCoreV78PreloadForRelease(identity),
            EC_BOT_CORE_R4_NODE_OPTIONS);
        for (const changed of [
            { commit: '0'.repeat(40) }, { tree: '0'.repeat(40) },
            { successorManifestSha256: '0'.repeat(64) },
            { release: '20260925T120000Z_production-20260925-0000000' }
        ]) assert.throws(() => selectEcBotCoreV78PreloadForRelease({ ...identity, ...changed }));
    } finally {
        if (prior === undefined) delete globalThis.__VITALISMEN_R4_OPERATIONAL_CONTEXT;
        else globalThis.__VITALISMEN_R4_OPERATIONAL_CONTEXT = prior;
    }
    process.stdout.write('R4_EXACT_SELECTOR=PASS\nV78_EXACT_SELECTOR=PASS\nUNKNOWN_IDENTITY=BLOCK\n');
} else throw new Error('FIXTURE_MODE_INVALID');
