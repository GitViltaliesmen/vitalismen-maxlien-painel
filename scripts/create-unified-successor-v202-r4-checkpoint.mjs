import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    R4_CHECKPOINT_PATH, R4_MANIFEST_PATH, R4_PRELOAD_PATH, R4_GUARD_PATH,
    R4_RUNNER_PATH, V201_COMMIT, V201_TREE, V201_MANIFEST_SHA256,
    SHIPMENTS_SHA256, readCanonicalJson, readAuthorizedCheckpoint,
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
const parent = '040969f90a92a8121c9e6eb723e0b0c6c9e390ae';
assert.equal(git('merge-base', parent, commit), parent, 'R4_LOCAL_CHECKPOINT_NOT_ANCESTOR');
assert.equal(git('rev-parse', `${parent}^{tree}`),
    '1bf75f613c6befece285e3ce9a71dc41bfffaa20');
const parentR4Commit = 'd965572e5ada1acae697953af162eaceae3ca3b6';
const parentR4Tree = 'c2db82792192f7aafb6b8ca45ea2acd8fc1fdace';
const parentAuthorityPath =
    '/var/lib/vitalismen-deploy/CHECKPOINT_UNIFIED_SUCCESSOR_OPERATIONAL_R4_READY.json';
const parentAuthoritySha256 =
    'b5b9a04e38e1f7560dfae7b1f209ed3bc6933066cb3313748dbad6e1fa7fb09e';
assert.equal(git('merge-base', parentR4Commit, commit), parentR4Commit,
    'R4_STAGEFIX_PARENT_NOT_ANCESTOR');
assert.equal(git('rev-parse', `${parentR4Commit}^{tree}`), parentR4Tree,
    'R4_STAGEFIX_PARENT_TREE_CHANGED');
assert.equal(sha256(readCanonicalJson(parentAuthorityPath).bytes), parentAuthoritySha256,
    'R4_STAGEFIX_PARENT_AUTHORITY_CHANGED');
const manifestFile = readCanonicalJson(path.join(root, R4_MANIFEST_PATH));
const manifest = validateR4Manifest(manifestFile.value);
const digest = relative => sha256(fs.readFileSync(path.join(root, relative)));
const checkpoint = {
    checkpointId: 'CHECKPOINT_UNIFIED_SUCCESSOR_OPERATIONAL_R4_STAGEFIX_READY',
    status: 'FROZEN',
    parentCheckpoint: 'CHECKPOINT_UNIFIED_SUCCESSOR_OPERATIONAL_R4_READY',
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
    allowlistCount: 83,
    v201PublishedCommit: V201_COMMIT,
    v201PublishedTree: V201_TREE,
    v201ManifestSha256: V201_MANIFEST_SHA256,
    shipmentsSha256: SHIPMENTS_SHA256
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
