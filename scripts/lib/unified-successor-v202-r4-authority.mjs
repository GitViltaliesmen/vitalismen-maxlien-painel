import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const R4_CHECKPOINT_PATH =
    '/var/lib/vitalismen-deploy/CHECKPOINT_UNIFIED_SUCCESSOR_OPERATIONAL_R4_READY.json';
export const R4_ATTESTATION_NAME = '.r4-operational-attestation.json';
export const R4_MANIFEST_PATH = 'docs/freeze/unified-successor-v47-v77h2-v202-r4-20260924.json';
export const R4_PRELOAD_PATH = 'scripts/lib/unified-successor-v202-r4-preload.mjs';
export const R4_GUARD_PATH = 'scripts/guard-unified-successor-v202-r4.mjs';
export const R4_RUNNER_PATH = 'scripts/run-unified-successor-v202-r4.mjs';
export const V201_COMMIT = '641759b160c2b91e95a3f1df371ad372a74d72e1';
export const V201_TREE = '1feb02ad1a3f2ae266ef519bf33426b91ac80aa3';
export const V201_MANIFEST_SHA256 = 'e8b82901e8faa4cda1d37a013fd2698401bad9c2039b702e637b88d5e4e56bee';
export const SHIPMENTS_SHA256 =
    'c083862ea7123d854fd7260375632d1f4535451b26a53f1e9edf38d7b6ab0ef8';
const LEGACY_RELEASE = '20260920T163629Z_production-20260920-8c25ed9';
const LEGACY_COMMIT = '8c25ed9912abc4aabee2656cf9192420389934c6';
const LEGACY_TREE = '44d310be637e71d6f6f5fb5d28f06c47f2bf7283';
const SHA1 = /^[a-f0-9]{40}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const RELEASE = /^[0-9]{8}T[0-9]{6}Z_production-[0-9]{8}-[a-f0-9]{7}$/;
export const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const exactKeys = (value, keys, label) =>
    assert.deepEqual(Object.keys(value || {}).sort(), [...keys].sort(), label);
const regularFile = file => {
    const stat = fs.lstatSync(file);
    assert.ok(stat.isFile() && !stat.isSymbolicLink(), `R4_UNSAFE_FILE:${file}`);
    return stat;
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
    exactKeys(value, ['checkpointId', 'status', 'parentCheckpoint', 'project',
        'r4OperationalCommit', 'r4OperationalTree', 'r4OperationalManifestSha256',
        'r4OperationalPreloadSha256', 'r4OperationalGuardSha256',
        'r4OperationalRunnerSha256', 'allowlistCount', 'v201PublishedCommit',
        'v201PublishedTree', 'v201ManifestSha256', 'shipmentsSha256'],
    'R4_CHECKPOINT_FIELDS_INVALID');
    assert.equal(value.checkpointId, 'CHECKPOINT_UNIFIED_SUCCESSOR_OPERATIONAL_R4_READY');
    assert.equal(value.status, 'FROZEN');
    assert.equal(value.parentCheckpoint, 'CHECKPOINT_UNIFIED_SUCCESSOR_LOCAL_READY');
    assert.equal(value.project, 'MAXLIEN EC — VITALISMEN OFICIAL');
    assert.match(value.r4OperationalCommit, SHA1);
    assert.match(value.r4OperationalTree, SHA1);
    for (const field of ['r4OperationalManifestSha256', 'r4OperationalPreloadSha256',
        'r4OperationalGuardSha256', 'r4OperationalRunnerSha256']) {
        assert.match(value[field], SHA256, `R4_CHECKPOINT_HASH_INVALID:${field}`);
    }
    assert.equal(value.allowlistCount, 83);
    assert.equal(value.v201PublishedCommit, V201_COMMIT);
    assert.equal(value.v201PublishedTree, V201_TREE);
    assert.equal(value.v201ManifestSha256, V201_MANIFEST_SHA256);
    assert.equal(value.shipmentsSha256, SHIPMENTS_SHA256);
    return value;
}
export function readAuthorizedCheckpoint() {
    for (const directory of ['/var', '/var/lib', path.dirname(R4_CHECKPOINT_PATH)]) {
        const stat = fs.lstatSync(directory);
        assert.ok(stat.isDirectory() && !stat.isSymbolicLink(),
            'R4_CHECKPOINT_PARENT_UNSAFE');
        assert.equal(stat.uid, 0, 'R4_CHECKPOINT_PARENT_OWNER_INVALID');
        assert.equal(stat.gid, 0, 'R4_CHECKPOINT_PARENT_GROUP_INVALID');
        assert.equal(stat.mode & 0o022, 0, 'R4_CHECKPOINT_PARENT_WRITABLE');
    }
    const stat = regularFile(R4_CHECKPOINT_PATH);
    assert.equal(stat.uid, 0, 'R4_CHECKPOINT_OWNER_INVALID');
    assert.equal(stat.gid, 0, 'R4_CHECKPOINT_GROUP_INVALID');
    assert.equal(stat.mode & 0o777, 0o400, 'R4_CHECKPOINT_MODE_INVALID');
    const { bytes, value } = readCanonicalJson(R4_CHECKPOINT_PATH);
    return Object.freeze({ value: validateCheckpoint(value), sha256: sha256(bytes) });
}
export function validateR4Manifest(manifest) {
    assert.equal(manifest.successorId,
        'MAXLIEN_EC_V47_V77H2_UNIFIED_SUCCESSOR_V202_R4_20260924');
    assert.equal(manifest.version, 'V202-R4');
    assert.equal(manifest.operationalRevision,
        'EXTERNAL_FROZEN_CHECKPOINT_AND_RELEASE_ATTESTATION');
    assert.equal(manifest.allowlistCount, 83);
    assert.equal(manifest.allowlist?.length, 83);
    assert.equal(new Set(manifest.allowlist.map(entry => entry.path)).size, 83);
    assert.equal(manifest.allowlist.filter(entry => entry.authority === 'OPERATOR_DECISION').length, 2);
    assert.equal(manifest.allowlist.filter(entry =>
        entry.authority === 'FREEZE_SUCCESSOR_EVIDENCE').length, 81);
    const stage = manifest.allowlist.find(entry => entry.path === 'ops/vitalismen-stage');
    assert.equal(stage?.authority, 'OPERATOR_DECISION');
    assert.equal(stage?.evidence, 'CHECKPOINT_UNIFIED_SUCCESSOR_OPERATIONAL_R4_READY');
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
        [R4_MANIFEST_PATH, checkpoint.r4OperationalManifestSha256],
        [R4_PRELOAD_PATH, checkpoint.r4OperationalPreloadSha256],
        [R4_GUARD_PATH, checkpoint.r4OperationalGuardSha256],
        [R4_RUNNER_PATH, checkpoint.r4OperationalRunnerSha256]
    ];
    for (const [relative, digest] of expected) {
        const file = path.join(root, relative);
        regularFile(file);
        assert.equal(sha256(fs.readFileSync(file)), digest, `R4_RELEASE_HASH_CHANGED:${relative}`);
    }
    const manifestFile = readCanonicalJson(path.join(root, R4_MANIFEST_PATH));
    assert.equal(sha256(manifestFile.bytes), checkpoint.r4OperationalManifestSha256);
    assert.deepEqual(manifestFile.value, manifest, 'R4_MANIFEST_OBJECT_CHANGED');
    return true;
}
export function validateAttestation(attestation, checkpoint, checkpointSha256, manifest) {
    exactKeys(attestation, ['attestationId', 'checkpointId', 'checkpointSha256',
        'releaseName', 'commit', 'tree', 'manifestSha256', 'preloadSha256',
        'guardSha256', 'runnerSha256', 'allowlistCount', 'materializedFileHashes',
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
        const manifest = path.join(resolved,
            'docs/freeze/ec-bot-core-overlay-preload-v201-20260924.json');
        regularFile(manifest);
        assert.equal(sha256(fs.readFileSync(manifest)), V201_MANIFEST_SHA256,
            'R4_SELECTOR_V201_MANIFEST_INVALID');
        return 'scripts/lib/ec-runtime-successor-v199-context.mjs';
    }
    const checkpoint = readAuthorizedCheckpoint();
    assert.equal(commit, checkpoint.value.r4OperationalCommit, 'R4_SELECTOR_UNKNOWN_COMMIT');
    assert.equal(tree, checkpoint.value.r4OperationalTree, 'R4_SELECTOR_UNKNOWN_TREE');
    const manifest = validateR4Manifest(
        readCanonicalJson(path.join(resolved, R4_MANIFEST_PATH)).value);
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
    const rootStat = fs.lstatSync(resolved);
    assert.ok(rootStat.isDirectory() && !rootStat.isSymbolicLink()
        && rootStat.uid === 0 && rootStat.gid === 0
        && (rootStat.mode & 0o022) === 0, 'R4_RELEASE_ROOT_WRITABLE_OR_UNSAFE');
    const checkpoint = readAuthorizedCheckpoint();
    const manifestFile = readCanonicalJson(path.join(resolved, R4_MANIFEST_PATH));
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
        const file = path.join(resolved, entry.path);
        regularFile(file);
        const digest = sha256(fs.readFileSync(file));
        assert.equal(digest, entry.canonicalSha256, `R4_FILE_CHANGED:${entry.path}`);
    }
    const historical = validateV201ContextRoot(attestation.v201ContextReleasePath);
    assert.notEqual(historical, resolved, 'R4_V201_CONTEXT_IS_CURRENT');
    return Object.freeze({ checkpoint: checkpoint.value, checkpointSha256: checkpoint.sha256,
        attestation, manifest, historicalRoot: historical, root: resolved });
}
