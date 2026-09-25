import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    R4_CHECKPOINT_PATH, R4_MANIFEST_PATH, R4_PRELOAD_PATH, R4_GUARD_PATH,
    R4_RUNNER_PATH, R4_FREEZE_LOCK_SUCCESSOR_PATH, R4_FINAL_VALIDATOR_PATH,
    V201_COMMIT, V201_TREE, V201_MANIFEST_SHA256,
    SHIPMENTS_SHA256, V168B_SHA256, META_DATASET_ID,
    readCanonicalJson, readAuthorizedCheckpoint, validateCheckpoint,
    validateR4Manifest, sha256
} from './lib/unified-successor-v202-r4-authority.mjs';
import { assertGitReleaseIdentity } from './verify-unified-successor-v202-r4-stage.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const parentCommit = '9d640d2700f91675f06b136cd6fe02695596e8cf';
const parentTree = '20c9ea0925cffd8ad2c06a73abd811837330339c';
const parentPath = '/var/lib/vitalismen-deploy/CHECKPOINT_R4_STARTUP_SUCCESSOR_READY.json';
const parentSha256 = 'd85725ac5b1b5b70bb104f750af42ce34eeec61dc309f6d655b40785655b4986';
const git = (...args) => execFileSync('/usr/bin/git', args, {
    cwd: root, encoding: 'utf8', env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1' }
}).trim();

assert.equal(process.platform, 'linux', 'R4_CONTROL_PLANE_AUTHORITY_LINUX_ONLY');
assert.equal(process.getuid?.(), 0, 'R4_CONTROL_PLANE_AUTHORITY_ROOT_ONLY');
assert.equal(process.argv.length, 2, 'R4_CONTROL_PLANE_AUTHORITY_NO_ARGUMENTS');
assert.equal(fs.existsSync(R4_CHECKPOINT_PATH), false, 'R4_CONTROL_PLANE_AUTHORITY_EXISTS');
assert.equal(git('status', '--porcelain=v1', '--untracked-files=all'), '',
    'R4_CONTROL_PLANE_SOURCE_DIRTY');
const commit = git('rev-parse', 'HEAD');
const tree = git('rev-parse', 'HEAD^{tree}');
const parents = git('rev-list', '--parents', '-n', '1', 'HEAD').split(' ');
assert.deepEqual(parents, [commit, parentCommit], 'R4_CONTROL_PLANE_NOT_SINGLE_SUCCESSOR');
assert.equal(git('rev-parse', `${parentCommit}^{tree}`), parentTree,
    'R4_CONTROL_PLANE_PARENT_TREE_CHANGED');
assert.equal(sha256(readCanonicalJson(parentPath).bytes), parentSha256,
    'R4_CONTROL_PLANE_PARENT_CHECKPOINT_CHANGED');
const manifestFile = readCanonicalJson(path.join(root, R4_MANIFEST_PATH));
const manifest = validateR4Manifest(manifestFile.value);
const digest = relative => sha256(fs.readFileSync(path.join(root, relative)));
const checkpoint = validateCheckpoint({
    checkpointId: 'CHECKPOINT_R4_CONTROL_PLANE_SUCCESSOR_AUTHORITY',
    status: 'FROZEN',
    parentCheckpoint: 'CHECKPOINT_R4_STARTUP_SUCCESSOR_READY',
    parentR4Commit: parentCommit,
    parentR4Tree: parentTree,
    parentAuthorityCheckpointSha256: parentSha256,
    project: 'MAXLIEN EC — VITALISMEN OFICIAL',
    r4OperationalCommit: commit,
    r4OperationalTree: tree,
    r4OperationalManifestSha256: digest(R4_MANIFEST_PATH),
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
});
assertGitReleaseIdentity(root, checkpoint, manifest);
for (const directory of ['/var', '/var/lib', path.dirname(R4_CHECKPOINT_PATH)]) {
    const stat = fs.lstatSync(directory);
    assert.ok(stat.isDirectory() && !stat.isSymbolicLink() && stat.uid === 0
        && stat.gid === 0 && (stat.mode & 0o022) === 0, 'R4_CHECKPOINT_PARENT_UNSAFE');
}
const temporary = `${R4_CHECKPOINT_PATH}.${process.pid}.tmp`;
const file = fs.openSync(temporary, 'wx', 0o400);
try {
    fs.writeFileSync(file, `${JSON.stringify(checkpoint, null, 2)}\n`);
    fs.fsyncSync(file);
} finally {
    fs.closeSync(file);
}
fs.renameSync(temporary, R4_CHECKPOINT_PATH);
fs.chmodSync(R4_CHECKPOINT_PATH, 0o400);
const directory = fs.openSync(path.dirname(R4_CHECKPOINT_PATH), 'r');
try { fs.fsyncSync(directory); } finally { fs.closeSync(directory); }
const verified = readAuthorizedCheckpoint();
assert.equal(verified.value.r4OperationalCommit, commit);
assert.equal(verified.value.r4OperationalTree, tree);
process.stdout.write(`R4_CONTROL_PLANE_AUTHORITY=${R4_CHECKPOINT_PATH}\n`);
process.stdout.write(`COMMIT=${commit}\nTREE=${tree}\nSHA256=${verified.sha256}\n`);
