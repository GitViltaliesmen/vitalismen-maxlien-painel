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
    readCanonicalJson, readAuthorizedCheckpoint,
    validateR4Manifest, sha256
} from './lib/unified-successor-v202-r4-authority.mjs';
import { assertGitReleaseIdentity } from './verify-unified-successor-v202-r4-stage.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const git = (...args) => execFileSync('/usr/bin/git', args, {
    cwd: root, encoding: 'utf8'
}).trim();
assert.equal(process.platform, 'linux', 'R4_CHECKPOINT_WRITER_LINUX_ONLY');
assert.equal(process.getuid?.(), 0, 'R4_CHECKPOINT_WRITER_ROOT_ONLY');
assert.equal(process.argv.length, 2, 'R4_CHECKPOINT_WRITER_NO_ARGUMENTS');
assert.ok(!fs.existsSync(R4_CHECKPOINT_PATH), 'R4_CHECKPOINT_ALREADY_EXISTS');
assert.equal(git('status', '--porcelain=v1', '--untracked-files=no'), '',
    'R4_CHECKPOINT_SOURCE_DIRTY');
const commit = git('rev-parse', 'HEAD');
const tree = git('rev-parse', 'HEAD^{tree}');
const parent = 'f148a7fcb4de71a243d40f9804a8a6a5b46c7dbc';
assert.equal(git('merge-base', parent, commit), parent, 'R4_LOCAL_CHECKPOINT_NOT_ANCESTOR');
assert.equal(git('rev-parse', `${parent}^{tree}`),
    '92ba262bf144ab08678a311b2c3473f3a9c80732');
const parentR4Commit = parent;
const parentR4Tree = '92ba262bf144ab08678a311b2c3473f3a9c80732';
const parentAuthorityPath =
    '/var/lib/vitalismen-deploy/CHECKPOINT_R4_V78_SUCCESSOR_READY_FOR_RESTAGE.json';
const parentAuthoritySha256 =
    'e69608b456868b18b88767d903657dc8983a3b5da365f84b9e62638ba07ced79';
assert.equal(git('merge-base', parentR4Commit, commit), parentR4Commit,
    'R4_FREEZE_SUCCESSOR_PARENT_NOT_ANCESTOR');
assert.equal(git('rev-parse', `${parentR4Commit}^{tree}`), parentR4Tree,
    'R4_FREEZE_SUCCESSOR_PARENT_TREE_CHANGED');
assert.equal(sha256(readCanonicalJson(parentAuthorityPath).bytes), parentAuthoritySha256,
    'R4_FREEZE_SUCCESSOR_PARENT_AUTHORITY_CHANGED');
const manifestFile = readCanonicalJson(path.join(root, R4_MANIFEST_PATH));
const manifest = validateR4Manifest(manifestFile.value);
const digest = relative => sha256(fs.readFileSync(path.join(root, relative)));
const checkpoint = {
    checkpointId: 'CHECKPOINT_R4_STARTUP_SUCCESSOR_READY',
    status: 'FROZEN',
    parentCheckpoint: 'CHECKPOINT_R4_V78_SUCCESSOR_READY_FOR_RESTAGE',
    parentR4Commit,
    parentR4Tree,
    parentAuthorityCheckpointSha256: parentAuthoritySha256,
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
};
assertGitReleaseIdentity(root, checkpoint, manifest);
const parentPath = path.dirname(R4_CHECKPOINT_PATH);
for (const directory of ['/var', '/var/lib']) {
    const stat = fs.lstatSync(directory);
    assert.ok(stat.isDirectory() && !stat.isSymbolicLink() && stat.uid === 0
        && stat.gid === 0 && (stat.mode & 0o022) === 0,
    'R4_CHECKPOINT_PARENT_UNSAFE');
}
if (!fs.existsSync(parentPath)) fs.mkdirSync(parentPath, { mode: 0o700 });
const parentStat = fs.lstatSync(parentPath);
assert.ok(parentStat.isDirectory() && !parentStat.isSymbolicLink()
    && parentStat.uid === 0 && parentStat.gid === 0 && (parentStat.mode & 0o022) === 0,
'R4_CHECKPOINT_DIRECTORY_UNSAFE');
const temporary = path.join(parentPath, `.r4-checkpoint-${process.pid}.tmp`);
const file = fs.openSync(temporary, 'wx', 0o400);
try {
    fs.writeFileSync(file, `${JSON.stringify(checkpoint, null, 2)}\n`);
    fs.fsyncSync(file);
} finally {
    fs.closeSync(file);
}
fs.renameSync(temporary, R4_CHECKPOINT_PATH);
fs.chmodSync(R4_CHECKPOINT_PATH, 0o400);
const directory = fs.openSync(parentPath, 'r');
try { fs.fsyncSync(directory); } finally { fs.closeSync(directory); }
const verified = readAuthorizedCheckpoint();
assert.equal(verified.value.r4OperationalCommit, commit);
assert.equal(verified.value.r4OperationalTree, tree);
process.stdout.write(`R4_CHECKPOINT_CREATED=${R4_CHECKPOINT_PATH}\n`);
process.stdout.write(`R4_OPERATIONAL_COMMIT=${commit}\nR4_OPERATIONAL_TREE=${tree}\n`);
