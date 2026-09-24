import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readCanonicalJson, verifyMaterializedRelease, SHIPMENTS_SHA256 } from
    './lib/unified-successor-v202-r4-authority.mjs';
import { assertFreezeLockSuccessorR4 } from './guard-freeze-lock-successor-v202-r4.mjs';
import { assertExternalLocks, assertRequiredContexts } from './guard-unified-successor-v202-r4.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHA256 = /^[a-f0-9]{64}$/;
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const regularFile = (file, mode) => {
    const stat = fs.lstatSync(file);
    assert.ok(stat.isFile() && !stat.isSymbolicLink()
        && stat.uid === 0 && stat.gid === 0 && (stat.mode & 0o777) === mode,
    `R4_FINAL_UNSAFE_FILE:${file}`);
    return fs.readFileSync(file);
};

export function assertR4FinalStagingContract({ source, staging, checkpoint,
    releaseName, sourceSha256, overlaySha256, baseEnvSha256 }) {
    assert.equal(source.releaseName, releaseName, 'R4_FINAL_SOURCE_RELEASE_INVALID');
    assert.equal(source.functionalCommit, checkpoint.r4OperationalCommit,
        'R4_FINAL_SOURCE_COMMIT_INVALID');
    assert.equal(source.functionalTree, checkpoint.r4OperationalTree,
        'R4_FINAL_SOURCE_TREE_INVALID');
    assert.equal(source.publicationStatus, 'staged_candidate',
        'R4_FINAL_SOURCE_STATUS_INVALID');
    assert.equal(source.strictReadOnly, true, 'R4_FINAL_SOURCE_STRICT_INVALID');
    assert.equal(source.safeObservationPolicy, 'STRICT_READ_ONLY',
        'R4_FINAL_SOURCE_POLICY_INVALID');
    assert.deepEqual(source.allowedWriteClasses, [], 'R4_FINAL_SOURCE_WRITES_INVALID');
    assert.equal(source.productionBranchChanged, false,
        'R4_FINAL_SOURCE_PRODUCTION_CHANGED');
    assert.equal(staging.status, 'complete', 'R4_FINAL_STAGING_INCOMPLETE');
    assert.equal(staging.publicationStatus, 'staged_candidate',
        'R4_FINAL_STAGING_STATUS_INVALID');
    assert.equal(staging.releaseName, releaseName, 'R4_FINAL_STAGING_RELEASE_INVALID');
    assert.equal(staging.commit, checkpoint.r4OperationalCommit,
        'R4_FINAL_STAGING_COMMIT_INVALID');
    assert.equal(staging.functionalCommit, checkpoint.r4OperationalCommit,
        'R4_FINAL_STAGING_FUNCTIONAL_COMMIT_INVALID');
    assert.equal(staging.functionalTree, checkpoint.r4OperationalTree,
        'R4_FINAL_STAGING_TREE_INVALID');
    assert.equal(staging.sourceRef, source.sourceRef, 'R4_FINAL_STAGING_REF_INVALID');
    assert.equal(staging.sourceRefResolvedCommit, checkpoint.r4OperationalCommit,
        'R4_FINAL_STAGING_RESOLVED_COMMIT_INVALID');
    assert.equal(staging.releaseMetadataSha256, sourceSha256,
        'R4_FINAL_STAGING_SOURCE_HASH_INVALID');
    assert.equal(staging.safeOverlaySha256, overlaySha256,
        'R4_FINAL_STAGING_OVERLAY_HASH_INVALID');
    assert.equal(staging.baseEnvSha256, baseEnvSha256,
        'R4_FINAL_STAGING_ENV_HASH_INVALID');
    assert.match(staging.functionalPayloadSha256, SHA256,
        'R4_FINAL_STAGING_PAYLOAD_HASH_INVALID');
    assert.match(staging.nodeModulesSha256, SHA256,
        'R4_FINAL_STAGING_NODE_MODULES_HASH_INVALID');
    assert.equal(staging.productionBranchCommitAfter,
        staging.productionBranchCommitBefore, 'R4_FINAL_PRODUCTION_BRANCH_CHANGED');
    assert.equal(staging.productionBranchChanged, false,
        'R4_FINAL_STAGING_PRODUCTION_CHANGED');
    assert.equal(staging.currentUnchanged, true, 'R4_FINAL_CURRENT_CHANGED');
    assert.equal(staging.pm2Unchanged, true, 'R4_FINAL_PM2_CHANGED');
    assert.equal(staging.strictReadOnly, true, 'R4_FINAL_STAGING_STRICT_INVALID');
    assert.equal(staging.safeObservationPolicy, 'STRICT_READ_ONLY',
        'R4_FINAL_STAGING_POLICY_INVALID');
    assert.deepEqual(staging.allowedWriteClasses, [], 'R4_FINAL_STAGING_WRITES_INVALID');
    assert.equal(staging.postSaleCompatibilityPreflight, 'PASS_SAFE_BOOT',
        'R4_FINAL_V66_PREFLIGHT_INVALID');
    assert.equal(staging.v66SafeObservationRequired, true,
        'R4_FINAL_V66_SAFE_MODE_INVALID');
    return true;
}

export function assertR4FinalContext(context, checkpoint) {
    assert.equal(context?.loaded, true, 'R4_FINAL_CONTEXT_MISSING');
    assert.equal(context.releaseAttestationValidated, true,
        'R4_FINAL_ATTESTATION_MISSING');
    assert.equal(context.releaseCommit, checkpoint.r4OperationalCommit,
        'R4_FINAL_CONTEXT_COMMIT_INVALID');
    assert.equal(context.releaseTree, checkpoint.r4OperationalTree,
        'R4_FINAL_CONTEXT_TREE_INVALID');
    assert.equal(context.shipmentsSha256, SHIPMENTS_SHA256,
        'R4_FINAL_SHIPMENTS_INVALID');
    return true;
}

export async function assertR4FinalReleaseValidator(root = ROOT) {
    const resolved = fs.realpathSync(root);
    assert.ok(resolved.startsWith('/opt/vitalismen-automacao/releases/'),
        'R4_FINAL_RELEASE_PATH_INVALID');
    const verified = verifyMaterializedRelease(resolved);
    assertRequiredContexts({
        v199: globalThis.__VITALISMEN_V199_EC_BOT_CORE_HEALTH_META_CONTEXT?.loaded,
        v146: globalThis.__VITALISMEN_V146_CONTEXT?.loaded
    });
    assertR4FinalContext(globalThis.__VITALISMEN_R4_OPERATIONAL_CONTEXT,
        verified.checkpoint);
    assertExternalLocks(verified.manifest.externalEffectLocks, process.env);
    const sourcePath = path.join(resolved, '.release-source.json');
    const stagingPath = path.join(resolved, '.staging-complete.json');
    const overlayPath = path.join(resolved, '.env.v66-safe-observation');
    const envPath = path.join(resolved, '.env');
    const sourceBytes = regularFile(sourcePath, 0o400);
    const stagingBytes = regularFile(stagingPath, 0o400);
    const overlayBytes = regularFile(overlayPath, 0o400);
    const envBytes = regularFile(envPath, 0o600);
    const modules = fs.lstatSync(path.join(resolved, 'node_modules'));
    assert.ok(modules.isDirectory() && !modules.isSymbolicLink(),
        'R4_FINAL_NODE_MODULES_INVALID');
    const source = readCanonicalJson(sourcePath).value;
    const staging = readCanonicalJson(stagingPath).value;
    assertR4FinalStagingContract({ source, staging,
        checkpoint: verified.checkpoint, releaseName: path.basename(resolved),
        sourceSha256: sha256(sourceBytes), overlaySha256: sha256(overlayBytes),
        baseEnvSha256: sha256(envBytes) });
    await assertFreezeLockSuccessorR4(resolved);
    console.log('FINAL_RELEASE_VALIDATOR_R4=PASS');
    console.log('R4_STAGING_INTEGRITY=PASS');
    return Object.freeze({ verified, staging });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    await assertR4FinalReleaseValidator();
}
