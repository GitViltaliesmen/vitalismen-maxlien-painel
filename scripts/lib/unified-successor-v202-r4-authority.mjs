import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const R4_CHECKPOINT_PATH =
    '/var/lib/vitalismen-deploy/CHECKPOINT_R4_V78_PAYLOAD_AUTHORITY.json';
export const R4_SUCCESSOR_CHECKPOINT_PATH =
    '/var/lib/vitalismen-deploy/CHECKPOINT_R4_V78_CONTROL_PLANE_AUTHORITY.json';
export const R4_PARENT_CHECKPOINT_SHA256 =
    '8ba9fd21befdb6a73698d726aea7e340dce0dc93cbb4f0ff91d3b3c507f5be6d';
export const R4_PARENT_COMMIT = 'da2983faac199b7bc9fe11c4ba47539b5baa6674';
export const R4_PARENT_TREE = '6a20e48807cae3f1c2b4cd6b18e7e46df76a0a59';
export const R4_ATTESTATION_NAME = '.r4-operational-attestation.json';
export const R4_MANIFEST_PATH = 'docs/freeze/unified-successor-v47-v77h2-v202-r4-v78-payload-20260925.json';
export const R4_SUCCESSOR_MANIFEST_PATH =
    'docs/freeze/unified-successor-v202-r4-v78-control-plane-20260925.json';
export const R4_PRELOAD_PATH = 'scripts/lib/unified-successor-v202-r4-preload.mjs';
export const R4_GUARD_PATH = 'scripts/guard-unified-successor-v202-r4.mjs';
export const R4_RUNNER_PATH = 'scripts/run-unified-successor-v202-r4.mjs';
export const R4_FREEZE_LOCK_SUCCESSOR_PATH = 'scripts/guard-freeze-lock-successor-v202-r4.mjs';
export const R4_FINAL_VALIDATOR_PATH =
    'scripts/guard-final-release-validator-successor-v202-r4.mjs';
export const V201_COMMIT = '641759b160c2b91e95a3f1df371ad372a74d72e1';
export const V201_TREE = '1feb02ad1a3f2ae266ef519bf33426b91ac80aa3';
export const V201_MANIFEST_SHA256 = 'e8b82901e8faa4cda1d37a013fd2698401bad9c2039b702e637b88d5e4e56bee';
export const SHIPMENTS_SHA256 =
    'c083862ea7123d854fd7260375632d1f4535451b26a53f1e9edf38d7b6ab0ef8';
export const V168B_SHA256 =
    'e1ce8093e54f4b3bcf976a140cede0aab06e6b8b3211ceceb94b8b2ccf44dcb3';
export const META_DATASET_ID = '920532663934291';
const LEGACY_RELEASE = '20260920T163629Z_production-20260920-8c25ed9';
const LEGACY_COMMIT = '8c25ed9912abc4aabee2656cf9192420389934c6';
const LEGACY_TREE = '44d310be637e71d6f6f5fb5d28f06c47f2bf7283';
const SHA1 = /^[a-f0-9]{40}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const RELEASE = /^[0-9]{8}T[0-9]{6}Z_production-[0-9]{8}-[a-f0-9]{7}$/;
const SUCCESSOR_FILE_HASHES = Object.freeze({
    'scripts/lib/unified-successor-v202-r4-authority.mjs': 'r4AuthoritySha256',
    'ops/vitalismen-stage': 'r4StageHelperSha256',
    'ops/ec-bot-core-v78-successor-r4': 'r4WrapperSha256',
    'scripts/lib/ec-bot-core-parent-protection-r4.mjs': 'r4ParentProtectionSha256',
    'src/services/ecBotCoreOperationalV78Service.js': 'r4V78SelectorSha256',
    'scripts/lib/ec-bot-core-operational-contract-v78.mjs': 'r4V78ContractSha256',
    'scripts/lib/pm2-target-env-restart-v78-r4.mjs': 'r4Pm2ControllerSha256',
    'ops/vitalismen-rollback-v201-r4.mjs': 'r4RollbackExecutorSha256',
    'scripts/verify-unified-successor-v202-r4-stage.mjs': 'r4StageVerifierSha256'
});
export const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const exactKeys = (value, keys, label) =>
    assert.deepEqual(Object.keys(value || {}).sort(), [...keys].sort(), label);
const regularFile = file => {
    const stat = fs.lstatSync(file);
    assert.ok(stat.isFile() && !stat.isSymbolicLink(), `R4_UNSAFE_FILE:${file}`);
    return stat;
};
const releaseFile = (root, relative) => {
    assert.match(relative, /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9_.\-/]+$/,
        'R4_RELEASE_RELATIVE_PATH_INVALID');
    let current = root;
    const segments = relative.split('/');
    for (let index = 0; index < segments.length; index += 1) {
        current = path.join(current, segments[index]);
        const stat = fs.lstatSync(current);
        assert.equal(stat.isSymbolicLink(), false,
            `R4_RELEASE_SYMLINK_ESCAPE:${relative}`);
        if (index < segments.length - 1) assert.ok(stat.isDirectory(),
            `R4_RELEASE_DIRECTORY_INVALID:${relative}`);
        else assert.ok(stat.isFile(), `R4_RELEASE_FILE_INVALID:${relative}`);
    }
    return current;
};
export function readCanonicalJson(file) {
    regularFile(file);
    const bytes = fs.readFileSync(file);
    const value = JSON.parse(bytes.toString('utf8'));
    assert.equal(bytes.toString('utf8'), `${JSON.stringify(value, null, 2)}\n`,
        `R4_NONCANONICAL_JSON:${file}`);
    return { bytes, value };
}
export function validateCheckpoint(value) {
    if (value?.checkpointId === 'CHECKPOINT_R4_V78_CONTROL_PLANE_AUTHORITY') {
        exactKeys(value, ['checkpointId', 'status', 'parentCheckpoint',
            'parentCheckpointSha256', 'parentR4Commit', 'parentR4Tree', 'project',
            'r4OperationalCommit', 'r4OperationalTree', 'r4OperationalManifestSha256',
            'r4OperationalPreloadSha256', 'r4OperationalGuardSha256',
            'r4OperationalRunnerSha256', 'r4FreezeLockSuccessorSha256',
            'r4FinalValidatorSha256', ...Object.values(SUCCESSOR_FILE_HASHES),
            'allowlistCount', 'v201PublishedCommit', 'v201PublishedTree',
            'v201ManifestSha256', 'shipmentsSha256', 'v168bSha256', 'metaDatasetId'],
        'R4_SUCCESSOR_CHECKPOINT_FIELDS_INVALID');
        assert.equal(value.status, 'FROZEN');
        assert.equal(value.parentCheckpoint, 'CHECKPOINT_R4_V78_PAYLOAD_AUTHORITY');
        assert.equal(value.parentCheckpointSha256, R4_PARENT_CHECKPOINT_SHA256);
        assert.equal(value.parentR4Commit, R4_PARENT_COMMIT);
        assert.equal(value.parentR4Tree, R4_PARENT_TREE);
        assert.equal(value.project, 'MAXLIEN EC — VITALISMEN OFICIAL');
        assert.match(value.r4OperationalCommit, SHA1);
        assert.match(value.r4OperationalTree, SHA1);
        for (const field of ['r4OperationalManifestSha256', 'r4OperationalPreloadSha256',
            'r4OperationalGuardSha256', 'r4OperationalRunnerSha256',
            'r4FreezeLockSuccessorSha256', 'r4FinalValidatorSha256',
            ...Object.values(SUCCESSOR_FILE_HASHES)]) {
            assert.match(value[field], SHA256, `R4_SUCCESSOR_HASH_INVALID:${field}`);
        }
        assert.equal(value.allowlistCount, 83);
        assert.equal(value.v201PublishedCommit, V201_COMMIT);
        assert.equal(value.v201PublishedTree, V201_TREE);
        assert.equal(value.v201ManifestSha256, V201_MANIFEST_SHA256);
        assert.equal(value.shipmentsSha256, SHIPMENTS_SHA256);
        assert.equal(value.v168bSha256, V168B_SHA256);
        assert.equal(value.metaDatasetId, META_DATASET_ID);
        return value;
    }
    exactKeys(value, ['checkpointId', 'status', 'parentCheckpoint', 'parentR4Commit',
        'parentR4Tree', 'parentAuthorityCheckpointSha256', 'project',
        'r4OperationalCommit', 'r4OperationalTree', 'r4OperationalManifestSha256',
        'r4OperationalPreloadSha256', 'r4OperationalGuardSha256',
        'r4OperationalRunnerSha256', 'r4FreezeLockSuccessorSha256',
        'r4FinalValidatorSha256',
        'allowlistCount', 'v201PublishedCommit',
        'v201PublishedTree', 'v201ManifestSha256', 'shipmentsSha256',
        'v168bSha256', 'metaDatasetId'],
    'R4_CHECKPOINT_FIELDS_INVALID');
    assert.equal(value.checkpointId, 'CHECKPOINT_R4_V78_PAYLOAD_AUTHORITY');
    assert.equal(value.status, 'FROZEN');
    assert.equal(value.parentCheckpoint, 'CHECKPOINT_R4_CONTROL_PLANE_SUCCESSOR_AUTHORITY');
    assert.equal(value.parentR4Commit, 'b842b1e366160b50dd15322dd212da309c1b92b2');
    assert.equal(value.parentR4Tree, '186e601d07fb4242c648f95d71cc71eb9433444a');
    assert.equal(value.parentAuthorityCheckpointSha256,
        'e7f7f6fbbea1359f8802c98ebf8ced2ffd201e049329e60cd8eb1c7f08c480c9');
    assert.equal(value.project, 'MAXLIEN EC — VITALISMEN OFICIAL');
    assert.match(value.r4OperationalCommit, SHA1);
    assert.match(value.r4OperationalTree, SHA1);
    for (const field of ['r4OperationalManifestSha256', 'r4OperationalPreloadSha256',
        'r4OperationalGuardSha256', 'r4OperationalRunnerSha256',
        'r4FreezeLockSuccessorSha256', 'r4FinalValidatorSha256']) {
        assert.match(value[field], SHA256, `R4_CHECKPOINT_HASH_INVALID:${field}`);
    }
    assert.equal(value.allowlistCount, 83);
    assert.equal(value.v201PublishedCommit, V201_COMMIT);
    assert.equal(value.v201PublishedTree, V201_TREE);
    assert.equal(value.v201ManifestSha256, V201_MANIFEST_SHA256);
    assert.equal(value.shipmentsSha256, SHIPMENTS_SHA256);
    assert.equal(value.v168bSha256, V168B_SHA256);
    assert.equal(value.metaDatasetId, META_DATASET_ID);
    return value;
}
const readStrictCheckpoint = checkpointPath => {
    for (const directory of ['/var', '/var/lib', path.dirname(checkpointPath)]) {
        const stat = fs.lstatSync(directory);
        assert.ok(stat.isDirectory() && !stat.isSymbolicLink(),
            'R4_CHECKPOINT_PARENT_UNSAFE');
        assert.equal(stat.uid, 0, 'R4_CHECKPOINT_PARENT_OWNER_INVALID');
        assert.equal(stat.gid, 0, 'R4_CHECKPOINT_PARENT_GROUP_INVALID');
        assert.equal(stat.mode & 0o022, 0, 'R4_CHECKPOINT_PARENT_WRITABLE');
    }
    const stat = regularFile(checkpointPath);
    assert.equal(stat.uid, 0, 'R4_CHECKPOINT_OWNER_INVALID');
    assert.equal(stat.gid, 0, 'R4_CHECKPOINT_GROUP_INVALID');
    assert.equal(stat.mode & 0o777, 0o400, 'R4_CHECKPOINT_MODE_INVALID');
    const { bytes, value } = readCanonicalJson(checkpointPath);
    return Object.freeze({ value: validateCheckpoint(value), sha256: sha256(bytes) });
};
export function readAuthorizedCheckpoint(root) {
    const parent = readStrictCheckpoint(R4_CHECKPOINT_PATH);
    assert.equal(parent.sha256, R4_PARENT_CHECKPOINT_SHA256,
        'R4_PARENT_CHECKPOINT_CHANGED');
    assert.equal(parent.value.r4OperationalCommit, R4_PARENT_COMMIT);
    assert.equal(parent.value.r4OperationalTree, R4_PARENT_TREE);
    if (!root) return parent;
    const resolved = fs.realpathSync(root);
    const source = readCanonicalJson(path.join(resolved, '.release-source.json')).value;
    assert.equal(source.releaseName, path.basename(resolved), 'R4_AUTHORITY_RELEASE_NAME');
    if (source.functionalCommit === R4_PARENT_COMMIT
        && source.functionalTree === R4_PARENT_TREE) return parent;
    const successor = readStrictCheckpoint(R4_SUCCESSOR_CHECKPOINT_PATH);
    assert.equal(successor.value.checkpointId,
        'CHECKPOINT_R4_V78_CONTROL_PLANE_AUTHORITY');
    assert.equal(successor.value.parentCheckpointSha256, parent.sha256);
    assert.equal(source.functionalCommit, successor.value.r4OperationalCommit,
        'R4_SUCCESSOR_UNKNOWN_COMMIT');
    assert.equal(source.functionalTree, successor.value.r4OperationalTree,
        'R4_SUCCESSOR_UNKNOWN_TREE');
    return successor;
}
export const manifestPathForCheckpoint = checkpoint =>
    checkpoint.checkpointId === 'CHECKPOINT_R4_V78_CONTROL_PLANE_AUTHORITY'
        ? R4_SUCCESSOR_MANIFEST_PATH : R4_MANIFEST_PATH;
export function validateR4Manifest(manifest) {
    const successor = manifest.successorId ===
        'MAXLIEN_EC_V47_V77H2_UNIFIED_SUCCESSOR_V202_R4_V78_CONTROL_PLANE_20260925';
    if (!successor) assert.equal(manifest.successorId,
        'MAXLIEN_EC_V47_V77H2_UNIFIED_SUCCESSOR_V202_R4_V78_PAYLOAD_20260925');
    assert.equal(manifest.version, 'V202-R4');
    assert.equal(manifest.operationalRevision,
        successor ? 'R4_V78_CONTROL_PLANE_AUTHORITY_SUCCESSOR'
            : 'R4_V78_GENERATED_ATTESTATION_EXCLUDED_FROM_FUNCTIONAL_PAYLOAD');
    assert.equal(manifest.parentControlPlaneCommit,
        successor ? R4_PARENT_COMMIT : 'b842b1e366160b50dd15322dd212da309c1b92b2');
    assert.equal(manifest.parentControlPlaneTree,
        successor ? R4_PARENT_TREE : '186e601d07fb4242c648f95d71cc71eb9433444a');
    assert.equal(manifest.parentAuthoritySha256,
        successor ? R4_PARENT_CHECKPOINT_SHA256
            : 'e7f7f6fbbea1359f8802c98ebf8ced2ffd201e049329e60cd8eb1c7f08c480c9');
    if (successor) assert.equal(manifest.parentManifestSha256,
        '9acfab5aebf315ffc3451074d225a7f95a8f2789cac86eae6cbb2075249154a0');
    assert.equal(manifest.allowlistCount, 83);
    assert.equal(manifest.allowlist?.length, 83);
    assert.equal(new Set(manifest.allowlist.map(entry => entry.path)).size, 83);
    assert.equal(manifest.allowlist.filter(entry => entry.authority === 'OPERATOR_DECISION').length, 2);
    assert.equal(manifest.allowlist.filter(entry =>
        entry.authority === 'FREEZE_SUCCESSOR_EVIDENCE').length, 81);
    const stage = manifest.allowlist.find(entry => entry.path === 'ops/vitalismen-stage');
    assert.equal(stage?.authority, 'OPERATOR_DECISION');
    assert.equal(stage?.evidence, successor
        ? 'CHECKPOINT_R4_V78_CONTROL_PLANE_AUTHORITY'
        : 'CHECKPOINT_R4_V78_PAYLOAD_AUTHORITY');
    const shipments = manifest.allowlist.find(entry => entry.path === 'src/routes/shipments.js');
    assert.equal(shipments?.canonicalSha256, SHIPMENTS_SHA256);
    assert.deepEqual(manifest.externalEffectLocks, {
        dropiRealBlocked: true, purchaseRealBlocked: true, productionMutationBlocked: true
    });
    assert.equal(manifest.policy?.failClosed, true);
    assert.equal(manifest.policy?.canonicalBlobSource, 'GIT_OBJECT_DATABASE');
    assert.equal(manifest.policy?.testFixtureRestoresContext, true);
    assert.equal(manifest.policy?.operationalImportKeepsValidatedContext, true);
    assert.equal(manifest.policy?.runtimeGitDependency, false);
    for (const entry of manifest.allowlist) {
        assert.match(entry.path, /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9_.\-/]+$/);
        assert.match(entry.gitBlobOid, SHA1);
        assert.match(entry.canonicalSha256, SHA256);
    }
    return manifest;
}
export function assertReleaseFileHashes(root, checkpoint, manifest) {
    const expected = [
        [manifestPathForCheckpoint(checkpoint), checkpoint.r4OperationalManifestSha256],
        [R4_PRELOAD_PATH, checkpoint.r4OperationalPreloadSha256],
        [R4_GUARD_PATH, checkpoint.r4OperationalGuardSha256],
        [R4_RUNNER_PATH, checkpoint.r4OperationalRunnerSha256],
        [R4_FREEZE_LOCK_SUCCESSOR_PATH, checkpoint.r4FreezeLockSuccessorSha256],
        [R4_FINAL_VALIDATOR_PATH, checkpoint.r4FinalValidatorSha256]
    ];
    if (checkpoint.checkpointId === 'CHECKPOINT_R4_V78_CONTROL_PLANE_AUTHORITY') {
        for (const [relative, field] of Object.entries(SUCCESSOR_FILE_HASHES)) {
            expected.push([relative, checkpoint[field]]);
        }
        const parentManifest = readCanonicalJson(releaseFile(root, R4_MANIFEST_PATH));
        assert.equal(sha256(parentManifest.bytes),
            '9acfab5aebf315ffc3451074d225a7f95a8f2789cac86eae6cbb2075249154a0',
            'R4_PARENT_MANIFEST_CHANGED');
        const parentEntries = parentManifest.value.allowlist;
        assert.equal(parentEntries.length, 83);
        for (let index = 0; index < parentEntries.length; index += 1) {
            const previous = parentEntries[index];
            const current = manifest.allowlist[index];
            assert.equal(current.path, previous.path, 'R4_SUCCESSOR_ALLOWLIST_ORDER');
            if (current.path === 'ops/vitalismen-stage') {
                assert.equal(current.canonicalSha256, checkpoint.r4StageHelperSha256);
                assert.equal(current.authority, 'OPERATOR_DECISION');
            } else {
                assert.deepEqual(current, previous,
                    `R4_SUCCESSOR_UNAUTHORIZED_ALLOWLIST_CHANGE:${current.path}`);
            }
        }
    }
    for (const [relative, digest] of expected) {
        const file = releaseFile(root, relative);
        regularFile(file);
        assert.equal(sha256(fs.readFileSync(file)), digest, `R4_RELEASE_HASH_CHANGED:${relative}`);
    }
    const manifestFile = readCanonicalJson(releaseFile(root,
        manifestPathForCheckpoint(checkpoint)));
    assert.equal(sha256(manifestFile.bytes), checkpoint.r4OperationalManifestSha256);
    assert.deepEqual(manifestFile.value, manifest, 'R4_MANIFEST_OBJECT_CHANGED');
    return true;
}
export function validateAttestation(attestation, checkpoint, checkpointSha256, manifest) {
    exactKeys(attestation, ['attestationId', 'checkpointId', 'checkpointSha256',
        'releaseName', 'commit', 'tree', 'manifestSha256', 'preloadSha256',
        'guardSha256', 'runnerSha256', 'freezeLockSuccessorSha256',
        'finalValidatorSha256',
        'allowlistCount', 'materializedFileHashes',
        'externalEffectLocks', 'v201ContextReleasePath', 'gitValidatedBeforeRemoval'],
    'R4_ATTESTATION_FIELDS_INVALID');
    assert.equal(attestation.attestationId, 'R4_OPERATIONAL_RELEASE_ATTESTATION');
    assert.equal(attestation.checkpointId, checkpoint.checkpointId);
    assert.equal(attestation.checkpointSha256, checkpointSha256);
    assert.equal(attestation.commit, checkpoint.r4OperationalCommit);
    assert.equal(attestation.tree, checkpoint.r4OperationalTree);
    assert.match(attestation.releaseName, RELEASE);
    assert.equal(attestation.releaseName.slice(-7), attestation.commit.slice(0, 7));
    assert.equal(attestation.manifestSha256, checkpoint.r4OperationalManifestSha256);
    assert.equal(attestation.preloadSha256, checkpoint.r4OperationalPreloadSha256);
    assert.equal(attestation.guardSha256, checkpoint.r4OperationalGuardSha256);
    assert.equal(attestation.runnerSha256, checkpoint.r4OperationalRunnerSha256);
    assert.equal(attestation.freezeLockSuccessorSha256,
        checkpoint.r4FreezeLockSuccessorSha256);
    assert.equal(attestation.finalValidatorSha256,
        checkpoint.r4FinalValidatorSha256);
    assert.equal(attestation.allowlistCount, 83);
    assert.equal(attestation.gitValidatedBeforeRemoval, true);
    assert.deepEqual(attestation.externalEffectLocks, manifest.externalEffectLocks);
    assert.equal(attestation.materializedFileHashes?.length, 83);
    assert.deepEqual(attestation.materializedFileHashes.map(item => item.path),
        manifest.allowlist.map(item => item.path));
    for (let i = 0; i < 83; i += 1) {
        const entry = manifest.allowlist[i];
        const materialized = attestation.materializedFileHashes[i];
        exactKeys(materialized, ['path', 'sha256'], 'R4_MATERIALIZED_FIELDS_INVALID');
        assert.equal(materialized.sha256, entry.canonicalSha256,
            `R4_MATERIALIZED_NOT_CANONICAL:${entry.path}`);
    }
    return attestation;
}
export function validateV201ContextRoot(root) {
    const historical = fs.realpathSync(root);
    assert.ok(historical.startsWith('/opt/vitalismen-automacao/releases/'),
        'R4_V201_CONTEXT_PATH_INVALID');
    assert.match(path.basename(historical), RELEASE, 'R4_V201_CONTEXT_RELEASE_INVALID');
    const source = readCanonicalJson(path.join(historical, '.release-source.json')).value;
    assert.equal(source.releaseName, path.basename(historical), 'R4_V201_CONTEXT_RELEASE_CHANGED');
    assert.equal(source.functionalCommit, V201_COMMIT, 'R4_V201_CONTEXT_COMMIT_INVALID');
    assert.equal(source.functionalTree, V201_TREE, 'R4_V201_CONTEXT_TREE_INVALID');
    const published = readCanonicalJson(path.join(historical, '.publication-complete.json')).value;
    assert.equal(published.status, 'complete', 'R4_V201_CONTEXT_NOT_PUBLISHED');
    assert.equal(published.functionalCommit, V201_COMMIT, 'R4_V201_PUBLICATION_COMMIT_INVALID');
    assert.equal(published.functionalTree, V201_TREE, 'R4_V201_PUBLICATION_TREE_INVALID');
    const manifest = path.join(historical,
        'docs/freeze/ec-bot-core-overlay-preload-v201-20260924.json');
    regularFile(manifest);
    assert.equal(sha256(fs.readFileSync(manifest)), V201_MANIFEST_SHA256,
        'R4_V201_CONTEXT_MANIFEST_INVALID');
    regularFile(path.join(historical, 'scripts/lib/ec-runtime-successor-v199-context.mjs'));
    return historical;
}
export function classifyReleasePreload(root, { requireAttestation = false } = {}) {
    const resolved = fs.realpathSync(root);
    const source = readCanonicalJson(path.join(resolved, '.release-source.json')).value;
    const release = source.releaseName;
    const commit = source.functionalCommit;
    const tree = source.functionalTree;
    assert.match(release, RELEASE, 'R4_SELECTOR_RELEASE_INVALID');
    assert.equal(path.basename(resolved), release, 'R4_SELECTOR_RELEASE_PATH_INVALID');
    if (release === LEGACY_RELEASE && commit === LEGACY_COMMIT && tree === LEGACY_TREE) {
        return 'scripts/lib/ec-runtime-successor-v97-context.mjs';
    }
    if (commit === V201_COMMIT && tree === V201_TREE && release.endsWith(commit.slice(0, 7))) {
        const manifest = releaseFile(resolved,
            'docs/freeze/ec-bot-core-overlay-preload-v201-20260924.json');
        regularFile(manifest);
        assert.equal(sha256(fs.readFileSync(manifest)), V201_MANIFEST_SHA256,
            'R4_SELECTOR_V201_MANIFEST_INVALID');
        return 'scripts/lib/ec-runtime-successor-v199-context.mjs';
    }
    const checkpoint = readAuthorizedCheckpoint(resolved);
    assert.equal(commit, checkpoint.value.r4OperationalCommit, 'R4_SELECTOR_UNKNOWN_COMMIT');
    assert.equal(tree, checkpoint.value.r4OperationalTree, 'R4_SELECTOR_UNKNOWN_TREE');
    const manifest = validateR4Manifest(readCanonicalJson(releaseFile(resolved,
        manifestPathForCheckpoint(checkpoint.value))).value);
    assertReleaseFileHashes(resolved, checkpoint.value, manifest);
    if (requireAttestation) verifyMaterializedRelease(resolved);
    return R4_PRELOAD_PATH;
}
export function assertNodeOptionsForRelease(root, nodeOptions, options = {}) {
    const relative = classifyReleasePreload(root, options);
    const expected = `--import=file:///opt/vitalismen-automacao/current/${relative}`;
    assert.equal(nodeOptions, expected, 'R4_PM2_PRELOAD_RELEASE_MISMATCH');
    return expected;
}
export function verifyMaterializedRelease(root, { requireGitAbsent = true } = {}) {
    const resolved = fs.realpathSync(root);
    assert.equal(path.dirname(resolved), '/opt/vitalismen-automacao/releases',
        'R4_RELEASE_OUTSIDE_OFFICIAL_ROOT');
    const rootStat = fs.lstatSync(resolved);
    assert.ok(rootStat.isDirectory() && !rootStat.isSymbolicLink()
        && rootStat.uid === 0 && rootStat.gid === 0
        && (rootStat.mode & 0o022) === 0, 'R4_RELEASE_ROOT_WRITABLE_OR_UNSAFE');
    const checkpoint = readAuthorizedCheckpoint(resolved);
    const manifestFile = readCanonicalJson(releaseFile(resolved,
        manifestPathForCheckpoint(checkpoint.value)));
    const manifest = validateR4Manifest(manifestFile.value);
    assertReleaseFileHashes(resolved, checkpoint.value, manifest);
    const attestationPath = path.join(resolved, R4_ATTESTATION_NAME);
    const attestationStat = regularFile(attestationPath);
    assert.ok(attestationStat.uid === 0 && attestationStat.gid === 0
        && (attestationStat.mode & 0o777) === 0o400,
    'R4_ATTESTATION_OWNER_OR_MODE_INVALID');
    const { value: attestation } = readCanonicalJson(attestationPath);
    validateAttestation(attestation, checkpoint.value, checkpoint.sha256, manifest);
    assert.equal(path.basename(resolved), attestation.releaseName, 'R4_RELEASE_PATH_INVALID');
    if (requireGitAbsent) assert.ok(!fs.existsSync(path.join(resolved, '.git')),
        'R4_RUNTIME_GIT_PRESENT');
    const source = readCanonicalJson(path.join(resolved, '.release-source.json')).value;
    assert.equal(source.releaseName, attestation.releaseName, 'R4_SOURCE_RELEASE_INVALID');
    assert.equal(source.functionalCommit, checkpoint.value.r4OperationalCommit,
        'R4_SOURCE_COMMIT_INVALID');
    assert.equal(source.functionalTree, checkpoint.value.r4OperationalTree,
        'R4_SOURCE_TREE_INVALID');
    for (const entry of manifest.allowlist) {
        const file = releaseFile(resolved, entry.path);
        regularFile(file);
        const digest = sha256(fs.readFileSync(file));
        assert.equal(digest, entry.canonicalSha256, `R4_FILE_CHANGED:${entry.path}`);
    }
    const historical = validateV201ContextRoot(attestation.v201ContextReleasePath);
    assert.notEqual(historical, resolved, 'R4_V201_CONTEXT_IS_CURRENT');
    return Object.freeze({ checkpoint: checkpoint.value, checkpointSha256: checkpoint.sha256,
        attestation, manifest, historicalRoot: historical, root: resolved });
}
