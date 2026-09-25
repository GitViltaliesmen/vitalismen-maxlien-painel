import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    R4_SUCCESSOR_CHECKPOINT_PATH, R4_CONTROLLER_PIN_CHECKPOINT_PATH,
    R4_SUCCESSOR_CHECKPOINT_SHA256, R4_SUCCESSOR_COMMIT, R4_SUCCESSOR_TREE,
    R4_SUCCESSOR_MANIFEST_PATH, R4_CONTROLLER_PIN_MANIFEST_PATH, R4_PRELOAD_PATH,
    R4_GUARD_PATH, R4_RUNNER_PATH, R4_FREEZE_LOCK_SUCCESSOR_PATH,
    R4_FINAL_VALIDATOR_PATH, V201_COMMIT, V201_TREE, V201_MANIFEST_SHA256,
    SHIPMENTS_SHA256, V168B_SHA256, META_DATASET_ID,
    readCanonicalJson, validateCheckpoint,
    validateR4Manifest, assertReleaseFileHashes, sha256
} from './lib/unified-successor-v202-r4-authority.mjs';
import { assertGitReleaseIdentity } from './verify-unified-successor-v202-r4-stage.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const git = (...args) => execFileSync('/usr/bin/git', args, {
    cwd: root, encoding: 'utf8', env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1' }
}).trim();
const digest = relative => {
    const file = path.join(root, relative);
    const stat = fs.lstatSync(file);
    assert.ok(stat.isFile() && !stat.isSymbolicLink(),
        `R4_SUCCESSOR_SOURCE_UNSAFE:${relative}`);
    return sha256(fs.readFileSync(file));
};

assert.equal(process.platform, 'linux', 'R4_CONTROLLER_PIN_AUTHORITY_LINUX_ONLY');
assert.equal(process.getuid?.(), 0, 'R4_CONTROLLER_PIN_AUTHORITY_ROOT_ONLY');
assert.equal(process.argv.length, 2, 'R4_CONTROLLER_PIN_AUTHORITY_NO_ARGUMENTS');
assert.equal(fs.existsSync(R4_CONTROLLER_PIN_CHECKPOINT_PATH), false,
    'R4_CONTROLLER_PIN_AUTHORITY_EXISTS');
assert.equal(git('status', '--porcelain=v1', '--untracked-files=all'), '',
    'R4_SUCCESSOR_SOURCE_DIRTY');
const commit = git('rev-parse', 'HEAD');
const tree = git('rev-parse', 'HEAD^{tree}');
assert.deepEqual(git('rev-list', '--parents', '-n', '1', 'HEAD').split(' '),
    [commit, R4_SUCCESSOR_COMMIT], 'R4_CONTROLLER_PIN_NOT_SINGLE_CHILD');
assert.equal(git('rev-parse', `${R4_SUCCESSOR_COMMIT}^{tree}`), R4_SUCCESSOR_TREE,
    'R4_CONTROLLER_PIN_PARENT_TREE_CHANGED');
const parent = readCanonicalJson(R4_SUCCESSOR_CHECKPOINT_PATH);
assert.equal(sha256(parent.bytes), R4_SUCCESSOR_CHECKPOINT_SHA256);
validateCheckpoint(parent.value);
assert.equal(digest(R4_SUCCESSOR_MANIFEST_PATH), parent.value.r4OperationalManifestSha256,
    'R4_CONTROLLER_PIN_PARENT_MANIFEST_CHANGED');
const manifest = validateR4Manifest(
    readCanonicalJson(path.join(root, R4_CONTROLLER_PIN_MANIFEST_PATH)).value);
const checkpoint = validateCheckpoint({
    checkpointId: 'CHECKPOINT_R4_V78_CONTROLLER_PIN_AUTHORITY',
    status: 'FROZEN',
    parentCheckpoint: parent.value.checkpointId,
    parentCheckpointSha256: sha256(parent.bytes),
    parentR4Commit: R4_SUCCESSOR_COMMIT,
    parentR4Tree: R4_SUCCESSOR_TREE,
    project: 'MAXLIEN EC — VITALISMEN OFICIAL',
    r4OperationalCommit: commit,
    r4OperationalTree: tree,
    r4OperationalManifestSha256: digest(R4_CONTROLLER_PIN_MANIFEST_PATH),
    r4OperationalPreloadSha256: digest(R4_PRELOAD_PATH),
    r4OperationalGuardSha256: digest(R4_GUARD_PATH),
    r4OperationalRunnerSha256: digest(R4_RUNNER_PATH),
    r4FreezeLockSuccessorSha256: digest(R4_FREEZE_LOCK_SUCCESSOR_PATH),
    r4FinalValidatorSha256: digest(R4_FINAL_VALIDATOR_PATH),
    r4AuthoritySha256: digest('scripts/lib/unified-successor-v202-r4-authority.mjs'),
    r4StageHelperSha256: digest('ops/vitalismen-stage'),
    r4WrapperSha256: digest('ops/ec-bot-core-v78-successor-r4'),
    r4ParentProtectionSha256: digest('scripts/lib/ec-bot-core-parent-protection-r4.mjs'),
    r4V78SelectorSha256: digest('src/services/ecBotCoreOperationalV78Service.js'),
    r4V78ContractSha256: digest('scripts/lib/ec-bot-core-operational-contract-v78.mjs'),
    r4Pm2ControllerSha256: digest('scripts/lib/pm2-target-env-restart-v78-r4.mjs'),
    r4RollbackExecutorSha256: digest('ops/vitalismen-rollback-v201-r4.mjs'),
    r4StageVerifierSha256: digest('scripts/verify-unified-successor-v202-r4-stage.mjs'),
    allowlistCount: 83,
    v201PublishedCommit: V201_COMMIT,
    v201PublishedTree: V201_TREE,
    v201ManifestSha256: V201_MANIFEST_SHA256,
    shipmentsSha256: SHIPMENTS_SHA256,
    v168bSha256: V168B_SHA256,
    metaDatasetId: META_DATASET_ID
});
assertReleaseFileHashes(root, checkpoint, manifest);
assertGitReleaseIdentity(root, checkpoint, manifest);
assert.equal(digest('src/routes/shipments.js'), SHIPMENTS_SHA256);
assert.equal(digest('scripts/lib/ec-runtime-successor-v168b-bootstrap-context.mjs'),
    V168B_SHA256);
for (const directory of ['/var', '/var/lib', path.dirname(R4_CONTROLLER_PIN_CHECKPOINT_PATH)]) {
    const stat = fs.lstatSync(directory);
    assert.ok(stat.isDirectory() && !stat.isSymbolicLink() && stat.uid === 0
        && stat.gid === 0 && (stat.mode & 0o022) === 0,
    'R4_SUCCESSOR_CHECKPOINT_PARENT_UNSAFE');
}
const temporary = `${R4_CONTROLLER_PIN_CHECKPOINT_PATH}.${process.pid}.tmp`;
const file = fs.openSync(temporary, 'wx', 0o400);
try {
    fs.writeFileSync(file, `${JSON.stringify(checkpoint, null, 2)}\n`);
    fs.fsyncSync(file);
} finally {
    fs.closeSync(file);
}
fs.renameSync(temporary, R4_CONTROLLER_PIN_CHECKPOINT_PATH);
fs.chmodSync(R4_CONTROLLER_PIN_CHECKPOINT_PATH, 0o400);
const directory = fs.openSync(path.dirname(R4_CONTROLLER_PIN_CHECKPOINT_PATH), 'r');
try { fs.fsyncSync(directory); } finally { fs.closeSync(directory); }
const verified = readCanonicalJson(R4_CONTROLLER_PIN_CHECKPOINT_PATH);
assert.deepEqual(validateCheckpoint(verified.value), checkpoint);
process.stdout.write(`R4_CONTROLLER_PIN_AUTHORITY=${R4_CONTROLLER_PIN_CHECKPOINT_PATH}\n`);
process.stdout.write(`COMMIT=${commit}\nTREE=${tree}\nSHA256=${sha256(verified.bytes)}\n`);
