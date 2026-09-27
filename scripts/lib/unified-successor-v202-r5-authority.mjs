import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyMaterializedRelease } from './unified-successor-v202-r4-authority.mjs';

export const R5_PARENT_RELEASE = '20260925T195542Z_production-20260925-fe32da0';
export const R5_PARENT_COMMIT = 'fe32da042617335d11b9fcde2e5dc0d4519c9915';
export const R5_PARENT_TREE = 'fe3c34e7a47d3e291c1d4c349e493ebbc93c9b6c';
export const R5_PARENT_CHECKPOINT_SHA256 =
    'edbc4130dee6d49b3cef5217ea22ad2bdce17447406450efbcac47404ef20ee5';
export const R5_PARENT_MANIFEST_SHA256 =
    '5db4769b20956ae9aba52293e1699b8fdbf4999aaa9ed8f62d74a8e9c7c9c349';
export const R5_ROLLBACK_BUNDLE_HASHES = Object.freeze({
    'ec-bot-core-v78.env':
        '5c1555f85e58c2242bb010d06e74e057c5347569a650eb70409ea29f58db2974',
    'ec-bot-core-v78-attestation.json':
        '7e50927443925f5404decc6127c7825e69560109a974b55678c150f30210b3b0',
    'ec-bot-core-v78-permit.consumed.json':
        '117ef226d7924251b4d531b846f95a105b3bd8fbc482a8e669f71379f0cecc6a'
});
export const R5_CHECKPOINT_PATH =
    '/var/lib/vitalismen-deploy/CHECKPOINT_R5_TEX_ULTRA_LOCALITY_ANTIREPEAT_AUTHORITY.json';
export const R5_MANIFEST_PATH =
    'docs/freeze/unified-successor-v202-r5-tex-ultra-locality-antirepeat-20260927.json';
export const R5_ATTESTATION_NAME = '.r5-operational-attestation.json';
export const R5_PRELOAD_PATH = 'scripts/lib/unified-successor-v202-r5-preload.mjs';
export const R5_CONTROL_PATHS = Object.freeze([
    'ops/ec-bot-core-v78-successor-r4',
    'ops/vitalismen-rollback-v202-r5.mjs',
    'ops/vitalismen-stage',
    'scripts/guard-final-release-validator-successor-v202-r5.mjs',
    'scripts/guard-freeze-lock-successor-v202-r5.mjs',
    'scripts/guard-unified-successor-v202-r5.mjs',
    'scripts/lib/ec-bot-core-operational-contract-v78.mjs',
    'scripts/lib/pm2-target-env-restart-v78-r4.mjs',
    'scripts/lib/unified-successor-v202-r5-authority.mjs',
    'scripts/lib/unified-successor-v202-r5-predeploy-v71-context.mjs',
    R5_PRELOAD_PATH,
    'scripts/run-unified-successor-v202-r5.mjs',
    'scripts/verify-unified-successor-v202-r5-stage.mjs',
    'src/services/ecBotCoreOperationalV78Service.js'
]);
export const R5_ALLOWED_DELTA_PATHS = Object.freeze([
    'docs/EC_V202_R5_PUBLICATION_SUCCESSOR_AUDIT_20260927.md',
    R5_MANIFEST_PATH,
    'ops/ec-bot-core-v78-successor-r4',
    'ops/vitalismen-rollback-v202-r5.mjs',
    'ops/vitalismen-stage',
    'scripts/guard-final-release-validator-successor-v202-r5.mjs',
    'scripts/guard-freeze-lock-successor-v202-r5.mjs',
    'scripts/guard-unified-successor-v202-r5.mjs',
    'scripts/lib/ec-bot-core-operational-contract-v78.mjs',
    'scripts/lib/pm2-target-env-restart-v78-r4.mjs',
    'scripts/lib/unified-successor-v202-r5-authority.mjs',
    'scripts/lib/unified-successor-v202-r5-precommit-context.mjs',
    'scripts/lib/unified-successor-v202-r5-predeploy-v71-context.mjs',
    R5_PRELOAD_PATH,
    'scripts/run-unified-successor-v202-r5.mjs',
    'scripts/run-v202-r5-precommit-senior.mjs',
    'scripts/verify-unified-successor-v202-r5-stage.mjs',
    'src/services/ecBotCoreOperationalV78Service.js',
    'src/services/servientregaEcuadorAgencyService.js',
    'src/whatsapp/sendText.js',
    'tests/ec-bot-core-v78-r5-structural.test.mjs',
    'tests/send-text-history-phone-scope.test.mjs',
    'tests/servientrega-locality-scope.test.mjs',
    'tests/v202-r5-historical-gates.test.mjs',
    'tests/v202-r5-successor-control.test.mjs'
]);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SHA256 = /^[a-f0-9]{64}$/;
const SHA1 = /^[a-f0-9]{40}$/;
const RELEASE = /^\d{8}T\d{6}Z_production-\d{8}-[a-f0-9]{7}$/;
const safeRelative = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9_.\-/]+$/;
export const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const blobOid = (bytes) => crypto.createHash('sha1')
    .update(Buffer.concat([Buffer.from('blob ' + bytes.length + '\0'), bytes])).digest('hex');
const git = (root, ...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const gitBytes = (root, ...args) => execFileSync('git', args, { cwd: root });
const exactKeys = (value, keys, label) =>
    assert.deepEqual(Object.keys(value || {}).sort(), [...keys].sort(), label);
const regular = (file) => {
    const stat = fs.lstatSync(file);
    assert.ok(stat.isFile() && !stat.isSymbolicLink(), 'R5_FILE_UNSAFE:' + file);
    return stat;
};
const releaseFile = (root, relative) => {
    assert.match(relative, safeRelative, 'R5_RELATIVE_PATH_INVALID');
    let current = fs.realpathSync(root);
    for (const [index, segment] of relative.split('/').entries()) {
        current = path.join(current, segment);
        const stat = fs.lstatSync(current);
        assert.equal(stat.isSymbolicLink(), false, 'R5_PATH_SYMLINK:' + relative);
        assert.ok(index === relative.split('/').length - 1
            ? stat.isFile() : stat.isDirectory(), 'R5_PATH_TYPE:' + relative);
    }
    return current;
};
export const readCanonicalJson = (file) => {
    regular(file);
    const bytes = fs.readFileSync(file);
    const value = JSON.parse(bytes.toString('utf8'));
    assert.equal(bytes.toString('utf8'), JSON.stringify(value, null, 2) + '\n',
        'R5_JSON_NOT_CANONICAL:' + file);
    return { bytes, value, sha256: sha256(bytes) };
};

export function validateR5Manifest(manifest) {
    exactKeys(manifest, ['successorId', 'version', 'status', 'parent',
        'inheritedWorkflowSha256', 'functionalFiles', 'regressionFiles',
        'allowedDeltaPaths', 'policy'], 'R5_MANIFEST_FIELDS_INVALID');
    assert.equal(manifest.successorId,
        'MAXLIEN_EC_V202_R5_TEX_ULTRA_LOCALITY_ANTIREPEAT_20260927');
    assert.equal(manifest.version, 'V202-R5');
    assert.equal(manifest.status, 'authorized_only_with_exact_root_checkpoint');
    assert.deepEqual(manifest.parent, {
        release: R5_PARENT_RELEASE,
        commit: R5_PARENT_COMMIT,
        tree: R5_PARENT_TREE,
        checkpointId: 'CHECKPOINT_R4_V78_CONTROLLER_PIN_AUTHORITY',
        checkpointSha256: R5_PARENT_CHECKPOINT_SHA256,
        manifestSha256: R5_PARENT_MANIFEST_SHA256
    });
    assert.equal(manifest.inheritedWorkflowSha256,
        'ce8eba69bdda6bac782190e31b746052317255fd18f50b6131a9dd116416aa46');
    assert.deepEqual(manifest.functionalFiles, {
        'src/services/servientregaEcuadorAgencyService.js':
            'f1628d2a4f25fb1abbb552b2a3d8fa86bb4a6fae99761236d9189a11faefa027',
        'src/whatsapp/sendText.js':
            '81fa2aef922bc0e71cdd30ad3a9d45f5c2aaac2fdbc250bebcbdbe3cd1da09fb'
    });
    assert.deepEqual(manifest.regressionFiles, {
        'tests/send-text-history-phone-scope.test.mjs':
            'c6372c5f9d76b87a90483533e78167670a3973d864b1ad42fe901996582e9c0e',
        'tests/servientrega-locality-scope.test.mjs':
            '4af36ae082f93aac95c87695730d7dda2db9b51ab75aae53975d065d28f4145e'
    });
    assert.deepEqual(manifest.allowedDeltaPaths, [...R5_ALLOWED_DELTA_PATHS],
        'R5_DELTA_NOT_AUTHORIZED');
    for (const relative of manifest.allowedDeltaPaths) assert.match(relative, safeRelative);
    for (const relative of [...Object.keys(manifest.functionalFiles),
        ...Object.keys(manifest.regressionFiles), ...R5_CONTROL_PATHS, R5_MANIFEST_PATH]) {
        assert.ok(manifest.allowedDeltaPaths.includes(relative), 'R5_DELTA_MISSING:' + relative);
    }
    assert.deepEqual(manifest.policy, {
        failClosed: true,
        historicalR4AndV47Unchanged: true,
        newCommitAndTreePinnedByRootCheckpoint: true,
        functionalFilesExactlyTwo: true,
        realWhatsAppMessages: false,
        realDropiOrders: false,
        realPurchaseEvents: false,
        rollbackRelease: R5_PARENT_RELEASE
    });
    return manifest;
}

export function readR5Manifest(root = ROOT) {
    const manifestFile = readCanonicalJson(releaseFile(root, R5_MANIFEST_PATH));
    return { ...manifestFile, value: validateR5Manifest(manifestFile.value) };
}

export function validateR5Checkpoint(checkpoint, manifestSha256,
    manifest = readR5Manifest(ROOT).value) {
    exactKeys(checkpoint, ['checkpointId', 'status', 'parentCheckpointId',
        'parentCheckpointSha256', 'parentCommit', 'parentTree', 'project',
        'commit', 'tree', 'manifestSha256', 'controlHashes', 'functionalHashes',
        'regressionHashes', 'rollbackRelease', 'rollbackBundleHashes'],
    'R5_CHECKPOINT_FIELDS_INVALID');
    assert.equal(checkpoint.checkpointId,
        'CHECKPOINT_R5_TEX_ULTRA_LOCALITY_ANTIREPEAT_AUTHORITY');
    assert.equal(checkpoint.status, 'FROZEN');
    assert.equal(checkpoint.parentCheckpointId, 'CHECKPOINT_R4_V78_CONTROLLER_PIN_AUTHORITY');
    assert.equal(checkpoint.parentCheckpointSha256, R5_PARENT_CHECKPOINT_SHA256);
    assert.equal(checkpoint.parentCommit, R5_PARENT_COMMIT);
    assert.equal(checkpoint.parentTree, R5_PARENT_TREE);
    assert.equal(checkpoint.project, 'MAXLIEN EC - VITALISMEN OFICIAL');
    assert.match(checkpoint.commit, SHA1);
    assert.match(checkpoint.tree, SHA1);
    assert.notEqual(checkpoint.commit, R5_PARENT_COMMIT);
    assert.equal(checkpoint.manifestSha256, manifestSha256);
    assert.deepEqual(Object.keys(checkpoint.controlHashes).sort(), [...R5_CONTROL_PATHS].sort());
    for (const digest of Object.values(checkpoint.controlHashes)) assert.match(digest, SHA256);
    validateR5Manifest(manifest);
    assert.deepEqual(checkpoint.functionalHashes, manifest.functionalFiles);
    assert.deepEqual(checkpoint.regressionHashes, manifest.regressionFiles);
    assert.equal(checkpoint.rollbackRelease, R5_PARENT_RELEASE);
    assert.deepEqual(checkpoint.rollbackBundleHashes, R5_ROLLBACK_BUNDLE_HASHES);
    return checkpoint;
}

export function readRootR5Checkpoint(root = ROOT) {
    for (const directory of ['/var', '/var/lib', path.dirname(R5_CHECKPOINT_PATH)]) {
        const stat = fs.lstatSync(directory);
        assert.ok(stat.isDirectory() && !stat.isSymbolicLink()
            && stat.uid === 0 && stat.gid === 0 && (stat.mode & 0o022) === 0,
        'R5_CHECKPOINT_PARENT_UNSAFE');
    }
    const stat = regular(R5_CHECKPOINT_PATH);
    assert.equal(stat.uid, 0, 'R5_CHECKPOINT_OWNER');
    assert.equal(stat.gid, 0, 'R5_CHECKPOINT_GROUP');
    assert.equal(stat.mode & 0o777, 0o400, 'R5_CHECKPOINT_MODE');
    const parentPath = '/var/lib/vitalismen-deploy/CHECKPOINT_R4_V78_CONTROLLER_PIN_AUTHORITY.json';
    assert.equal(sha256(fs.readFileSync(parentPath)), R5_PARENT_CHECKPOINT_SHA256,
        'R5_PARENT_CHECKPOINT_CHANGED');
    const manifest = readR5Manifest(root);
    const checkpoint = readCanonicalJson(R5_CHECKPOINT_PATH);
    validateR5Checkpoint(checkpoint.value, manifest.sha256, manifest.value);
    return checkpoint;
}

export function assertR5FileHashes(root, manifest, checkpoint) {
    const r4File = readCanonicalJson(releaseFile(root,
        'docs/freeze/unified-successor-v202-r4-v78-controller-pin-20260925.json'));
    assert.equal(r4File.sha256, R5_PARENT_MANIFEST_SHA256, 'R5_R4_MANIFEST_CHANGED');
    const r4 = r4File.value;
    assert.equal(r4.allowlist.length, 83, 'R5_R4_ALLOWLIST_CHANGED');
    const replacements = {
        ...manifest.functionalFiles,
        ...manifest.regressionFiles,
        ...checkpoint.controlHashes
    };
    for (const entry of r4.allowlist) {
        assert.equal(sha256(fs.readFileSync(releaseFile(root, entry.path))),
            replacements[entry.path] || entry.canonicalSha256,
        'R5_R4_PROTECTED_CHANGED:' + entry.path);
    }
    for (const [relative, expected] of Object.entries(replacements)) {
        assert.equal(sha256(fs.readFileSync(releaseFile(root, relative))), expected,
            'R5_PROTECTED_CHANGED:' + relative);
    }
    assert.equal(sha256(fs.readFileSync(releaseFile(root,
        '.github/workflows/ec-panel-quality.yml'))), manifest.inheritedWorkflowSha256,
    'R5_WORKFLOW_CHANGED');
    return true;
}

export function assertR5GitCandidate(root, checkpoint, manifest) {
    assert.equal(git(root, 'rev-parse', 'HEAD'), checkpoint.commit, 'R5_COMMIT_INVALID');
    assert.equal(git(root, 'rev-parse', 'HEAD^{tree}'), checkpoint.tree, 'R5_TREE_INVALID');
    assert.equal(git(root, 'merge-base', R5_PARENT_COMMIT, checkpoint.commit),
        R5_PARENT_COMMIT, 'R5_NOT_DESCENDANT');
    assert.equal(git(root, 'rev-parse', R5_PARENT_COMMIT + '^{tree}'),
        R5_PARENT_TREE, 'R5_PARENT_TREE_CHANGED');
    assert.equal(git(root, 'status', '--porcelain=v1', '--untracked-files=no'), '',
        'R5_TRACKED_DIFF');
    const changed = git(root, 'diff', '--name-only', R5_PARENT_COMMIT + '..HEAD')
        .split(/\r?\n/).filter(Boolean).sort();
    assert.deepEqual(changed, manifest.allowedDeltaPaths, 'R5_UNAUTHORIZED_DELTA');
    assertR5FileHashes(root, manifest, checkpoint);
    for (const relative of changed) {
        const bytes = gitBytes(root, 'show', 'HEAD:' + relative);
        assert.equal(blobOid(bytes), git(root, 'rev-parse', 'HEAD:' + relative),
            'R5_GIT_BLOB_INVALID:' + relative);
        assert.deepEqual(bytes, fs.readFileSync(releaseFile(root, relative)),
            'R5_WORKTREE_DIFF:' + relative);
    }
    return true;
}

export function validateR5Attestation(attestation, checkpoint, checkpointSha256,
    manifest, root) {
    exactKeys(attestation, ['attestationId', 'checkpointId', 'checkpointSha256',
        'releaseName', 'commit', 'tree', 'manifestSha256', 'changedFileHashes',
        'parentRelease', 'gitValidatedBeforeRemoval'], 'R5_ATTESTATION_FIELDS_INVALID');
    assert.equal(attestation.attestationId, 'R5_OPERATIONAL_RELEASE_ATTESTATION');
    assert.equal(attestation.checkpointId, checkpoint.checkpointId);
    assert.equal(attestation.checkpointSha256, checkpointSha256);
    assert.equal(attestation.releaseName, path.basename(root));
    assert.match(attestation.releaseName, RELEASE);
    assert.equal(attestation.releaseName.slice(-7), checkpoint.commit.slice(0, 7));
    assert.equal(attestation.commit, checkpoint.commit);
    assert.equal(attestation.tree, checkpoint.tree);
    assert.equal(attestation.manifestSha256, checkpoint.manifestSha256);
    assert.equal(attestation.parentRelease, R5_PARENT_RELEASE);
    assert.equal(attestation.gitValidatedBeforeRemoval, true);
    assert.deepEqual(Object.keys(attestation.changedFileHashes).sort(),
        manifest.allowedDeltaPaths, 'R5_ATTESTED_DELTA_INVALID');
    for (const [relative, digest] of Object.entries(attestation.changedFileHashes)) {
        assert.match(digest, SHA256);
        assert.equal(sha256(fs.readFileSync(releaseFile(root, relative))), digest,
            'R5_ATTESTED_FILE_CHANGED:' + relative);
    }
    return attestation;
}

export function verifyR5MaterializedRelease(root, {
    requireGitAbsent = true, verifyParentRelease = true
} = {}) {
    const resolved = fs.realpathSync(root);
    assert.equal(path.dirname(resolved), '/opt/vitalismen-automacao/releases',
        'R5_RELEASE_OUTSIDE_OFFICIAL_ROOT');
    const releaseStat = fs.lstatSync(resolved);
    assert.ok(releaseStat.isDirectory() && !releaseStat.isSymbolicLink()
        && releaseStat.uid === 0 && releaseStat.gid === 0
        && (releaseStat.mode & 0o022) === 0, 'R5_RELEASE_ROOT_UNSAFE');
    const manifest = readR5Manifest(resolved);
    const checkpoint = readRootR5Checkpoint(resolved);
    const source = readCanonicalJson(path.join(resolved, '.release-source.json')).value;
    assert.equal(source.releaseName, path.basename(resolved), 'R5_SOURCE_RELEASE_INVALID');
    assert.equal(source.functionalCommit, checkpoint.value.commit, 'R5_SOURCE_COMMIT_INVALID');
    assert.equal(source.functionalTree, checkpoint.value.tree, 'R5_SOURCE_TREE_INVALID');
    assertR5FileHashes(resolved, manifest.value, checkpoint.value);
    for (const relative of manifest.value.allowedDeltaPaths) regular(releaseFile(resolved, relative));
    const attestationFile = path.join(resolved, R5_ATTESTATION_NAME);
    const attestationStat = regular(attestationFile);
    assert.ok(attestationStat.uid === 0 && attestationStat.gid === 0
        && (attestationStat.mode & 0o777) === 0o400,
        'R5_ATTESTATION_OWNER_OR_MODE_INVALID');
    const attestation = readCanonicalJson(attestationFile);
    validateR5Attestation(attestation.value, checkpoint.value, checkpoint.sha256,
        manifest.value, resolved);
    if (requireGitAbsent) assert.equal(fs.existsSync(path.join(resolved, '.git')), false,
        'R5_RUNTIME_GIT_PRESENT');
    if (verifyParentRelease) {
        const parent = path.join('/opt/vitalismen-automacao/releases', R5_PARENT_RELEASE);
        const verified = verifyMaterializedRelease(parent);
        assert.equal(verified.attestation.commit, R5_PARENT_COMMIT, 'R5_PARENT_RELEASE_COMMIT');
        assert.equal(verified.attestation.tree, R5_PARENT_TREE, 'R5_PARENT_RELEASE_TREE');
    }
    return Object.freeze({
        root: resolved, manifest: manifest.value, checkpoint: checkpoint.value,
        checkpointSha256: checkpoint.sha256, attestation: attestation.value
    });
}

export function classifyR5ReleasePreload(root, { requireAttestation = true } = {}) {
    const source = readCanonicalJson(path.join(root, '.release-source.json')).value;
    const checkpoint = readRootR5Checkpoint(root);
    assert.equal(source.functionalCommit, checkpoint.value.commit, 'R5_SELECTOR_COMMIT');
    assert.equal(source.functionalTree, checkpoint.value.tree, 'R5_SELECTOR_TREE');
    if (requireAttestation) verifyR5MaterializedRelease(root);
    return R5_PRELOAD_PATH;
}
