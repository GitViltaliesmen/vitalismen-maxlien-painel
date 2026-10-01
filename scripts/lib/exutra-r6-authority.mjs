import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { verifyR5MaterializedRelease } from './unified-successor-v202-r5-authority.mjs';

export const R6_PARENT_RELEASE = '20260927T045400Z_production-20260927-87cc584';
export const R6_PARENT_COMMIT = '87cc5842948695e6a0b80b7d4d1c904c5cef6290';
export const R6_PARENT_TREE = '40457d45e6a8b6c5a5717c3f0db19f1f5441bb66';
export const R6_PARENT_CHECKPOINT_SHA = 'ef5b6c61119aa0fe694d83a323cca30ad8655246d40af28f887cf6ed133b1bd3';
export const R6_CHECKPOINT = '/var/lib/vitalismen-deploy/CHECKPOINT_EXUTRA_R6_CAPTURE_HOLD.json';
export const R6_MANIFEST = 'docs/freeze/exutra-r6-capture-hold-20261001.json';
export const R6_PRELOAD = 'scripts/lib/exutra-r6-preload.mjs';
export const R6_ATTESTATION = '.exutra-r6-attestation.json';
export const R6_FUNCTIONAL = 'src/routes/zapi.js';
export const R6_CONTROLS = Object.freeze([
    'ops/vitalismen-stage', 'ops/ec-bot-core-v78-successor-r4',
    'ops/exutra-r6-rollback.mjs',
    'scripts/lib/pm2-target-env-restart-v78-r4.mjs',
    'scripts/lib/ec-bot-core-operational-contract-v78.mjs',
    'src/services/ecBotCoreOperationalV78Service.js',
    'scripts/lib/exutra-r6-authority.mjs', R6_PRELOAD,
    'scripts/exutra-r6-release.mjs', 'scripts/exutra-r6-guard.mjs',
    'scripts/exutra-r6-checkpoint.mjs'
].sort());
export const R6_ALLOWED = Object.freeze([R6_FUNCTIONAL, ...R6_CONTROLS,
    R6_MANIFEST, 'tests/exutra-capture-hold-r6.test.mjs',
    'tests/exutra-r6-contract.test.mjs', 'docs/EXUTRA_R6_CAPTURE_HOLD_20261001.md'
].sort());
export const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const git = (root, ...args) => execFileSync('git', ['-C', root, ...args],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const regular = (file, mode) => {
    const s = fs.lstatSync(file);
    assert.ok(s.isFile() && !s.isSymbolicLink(), 'R6_UNSAFE_FILE:' + file);
    if (mode !== undefined) {
        assert.equal(s.uid, 0); assert.equal(s.gid, 0);
        assert.equal(s.mode & 0o777, mode, 'R6_FILE_MODE:' + file);
    }
};
export function readJson(file, mode) {
    regular(file, mode); const bytes = fs.readFileSync(file);
    const value = JSON.parse(bytes);
    assert.equal(bytes.toString(), JSON.stringify(value, null, 2) + '\n', 'R6_NONCANONICAL_JSON');
    return { value, sha256: sha(bytes) };
}
export function r6File(root, relative) {
    assert.match(relative, /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9_.\-/]+$/);
    let file = root;
    for (const part of relative.split('/')) {
        file = path.join(file, part);
        assert.equal(fs.lstatSync(file).isSymbolicLink(), false, 'R6_SYMLINK_ESCAPE');
    }
    regular(file); return file;
}
export function readR6Checkpoint() {
    const result = readJson(R6_CHECKPOINT, 0o400); const c = result.value;
    assert.equal(c.checkpointId, 'EXUTRA_R6_CAPTURE_HOLD_ONLY');
    assert.equal(c.parentCommit, R6_PARENT_COMMIT);
    assert.equal(c.parentTree, R6_PARENT_TREE);
    assert.equal(c.parentCheckpointSha256, R6_PARENT_CHECKPOINT_SHA);
    assert.equal(sha(fs.readFileSync('/var/lib/vitalismen-deploy/CHECKPOINT_R5_TEX_ULTRA_LOCALITY_ANTIREPEAT_AUTHORITY.json')),
        R6_PARENT_CHECKPOINT_SHA, 'R6_PARENT_CHECKPOINT_CHANGED');
    for (const field of ['commit', 'tree']) assert.match(c[field], /^[a-f0-9]{40}$/);
    assert.match(c.manifestSha256, /^[a-f0-9]{64}$/);
    return result;
}
export function verifyR6Manifest(root, checkpoint) {
    const m = readJson(r6File(root, R6_MANIFEST));
    assert.equal(m.sha256, checkpoint.manifestSha256, 'R6_MANIFEST_HASH');
    assert.equal(m.value.freezeId, 'EXUTRA_R6_CAPTURE_HOLD_ONLY');
    assert.deepEqual(m.value.allowedDeltaPaths, R6_ALLOWED, 'R6_SCOPE_EXPANSION');
    assert.deepEqual(Object.keys(m.value.functionalFiles), [R6_FUNCTIONAL]);
    assert.deepEqual(Object.keys(m.value.controlFiles).sort(), R6_CONTROLS);
    assert.deepEqual(m.value.policy, { otherFunnelsChanged: false, metaChanged: false,
        providerChanged: false, humanHoldPreserved: true, parentGuardsRequired: true });
    for (const [file, digest] of Object.entries({ ...m.value.functionalFiles, ...m.value.controlFiles })) {
        assert.match(digest, /^[a-f0-9]{64}$/);
        assert.equal(sha(fs.readFileSync(r6File(root, file))), digest, 'R6_HASH_CHANGED:' + file);
    }
    return m.value;
}
export function verifyR6GitCandidate(root) {
    const c = readR6Checkpoint().value;
    const m = verifyR6Manifest(root, c);
    assert.equal(git(root, 'rev-parse', 'HEAD'), c.commit);
    assert.equal(git(root, 'rev-parse', 'HEAD^{tree}'), c.tree);
    assert.equal(git(root, 'merge-base', R6_PARENT_COMMIT, c.commit), R6_PARENT_COMMIT);
    assert.equal(git(root, 'status', '--porcelain=v1', '--untracked-files=no'), '');
    const delta = git(root, 'diff', '--name-only', R6_PARENT_COMMIT, 'HEAD').split(/\r?\n/).filter(Boolean).sort();
    assert.deepEqual(delta, R6_ALLOWED, 'R6_UNAUTHORIZED_GIT_DELTA');
    const hashes = {};
    for (const file of git(root, 'ls-files').split(/\r?\n/).filter(Boolean)) {
        const bytes = fs.readFileSync(r6File(root, file));
        const committed = execFileSync('git', ['-C', root, 'show', 'HEAD:' + file],
            { maxBuffer: 64 * 1024 * 1024 });
        assert.deepEqual(bytes, committed, 'R6_WORKTREE_CHANGED:' + file);
        hashes[file] = sha(bytes);
    }
    return { checkpoint: c, manifest: m, hashes };
}
export function verifyR6Release(root, { requireGitAbsent = true } = {}) {
    root = fs.realpathSync(root);
    assert.equal(path.dirname(root), '/opt/vitalismen-automacao/releases');
    assert.match(path.basename(root), /^\d{8}T\d{6}Z_production-\d{8}-[a-f0-9]{7}$/);
    const s = fs.lstatSync(root); assert.equal(s.uid, 0); assert.equal(s.gid, 0);
    assert.equal(s.mode & 0o022, 0);
    const selected = readR6Checkpoint(); const c = selected.value;
    assert.ok(path.basename(root).endsWith('-' + c.commit.slice(0, 7)), 'R6_RELEASE_NAME_COMMIT');
    const parentRoot = path.join('/opt/vitalismen-automacao/releases', R6_PARENT_RELEASE);
    const parent = verifyR5MaterializedRelease(parentRoot);
    assert.equal(parent.attestation.commit, R6_PARENT_COMMIT);
    assert.equal(parent.attestation.tree, R6_PARENT_TREE);
    const manifest = verifyR6Manifest(root, c);
    const source = readJson(path.join(root, '.release-source.json'), 0o400).value;
    assert.equal(source.functionalCommit, c.commit); assert.equal(source.functionalTree, c.tree);
    assert.equal(source.releaseName, path.basename(root));
    const a = readJson(path.join(root, R6_ATTESTATION), 0o400).value;
    assert.equal(a.checkpointSha256, selected.sha256);
    assert.equal(a.commit, c.commit); assert.equal(a.tree, c.tree);
    assert.equal(a.releaseName, path.basename(root)); assert.equal(a.gitValidated, true);
    assert.deepEqual(a.changedPaths, R6_ALLOWED);
    assert.deepEqual(a.fileHashes, c.fileHashes, 'R6_ATTESTATION_HASH_LIST_CHANGED');
    assert.ok(Object.keys(a.fileHashes).length > R6_ALLOWED.length, 'R6_INHERITANCE_MISSING');
    for (const [file, digest] of Object.entries(a.fileHashes)) {
        assert.equal(sha(fs.readFileSync(r6File(root, file))), digest, 'R6_ATTESTED_FILE_CHANGED:' + file);
        if (!R6_ALLOWED.includes(file)) assert.equal(sha(fs.readFileSync(r6File(parentRoot, file))), digest,
            'R6_ANCESTRAL_FILE_CHANGED:' + file);
    }
    if (requireGitAbsent) assert.equal(fs.existsSync(path.join(root, '.git')), false);
    return { root, checkpoint: c, checkpointSha256: selected.sha256, manifest, attestation: a, parent };
}

export function assertR6ParentProcess(verified, app) {
    const parent = '/opt/vitalismen-automacao/releases/' + R6_PARENT_RELEASE;
    const env = app?.pm2_env || {};
    assert.equal(app?.name, 'vitalismen-automation'); assert.equal(env.status, 'online');
    assert.equal(app.pid, verified.checkpoint.parentPid, 'R6_PARENT_PID_DIVERGED');
    assert.ok([parent, '/opt/vitalismen-automacao/current'].includes(env.pm_cwd));
    assert.ok([parent + '/src/index.js', '/opt/vitalismen-automacao/current/src/index.js'].includes(env.pm_exec_path));
    assert.equal(env.NODE_OPTIONS,
        '--import=file:///opt/vitalismen-automacao/current/scripts/lib/unified-successor-v202-r5-preload.mjs');
    return true;
}
