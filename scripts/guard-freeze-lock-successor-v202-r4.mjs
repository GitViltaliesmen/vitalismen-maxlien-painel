import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    readCanonicalJson, verifyMaterializedRelease, SHIPMENTS_SHA256
} from './lib/unified-successor-v202-r4-authority.mjs';
import {
    assertFreezeLockEcMetaDynamicV74,
    loadFreezeLockEcMetaDynamicV74Workspace
} from './lib/freeze-lock-ec-meta-dynamic-v74-contract.mjs';
import { assertExternalLocks, assertRequiredContexts } from './guard-unified-successor-v202-r4.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HISTORICAL_MANIFESTS = Object.freeze([
    'docs/freeze/ec-v51-browser-successor-v181-20260918.json',
    'docs/freeze/ec-panel-only-agency-city-scope-v183-20260918.json',
    'docs/freeze/ec-v181-v183-canonical-successor-v184-20260918.json',
    'docs/freeze/vsl-first-response-watchdog-v193-20260919.json',
    'docs/freeze/post-sale-dropi-reconciler-v194-20260920.json'
]);
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

export function assertHistoricalProtectedEquivalence({ currentRoot, historicalRoot, manifest }) {
    const protectedFiles = new Set();
    for (const relative of HISTORICAL_MANIFESTS) {
        const current = readCanonicalJson(path.join(currentRoot, relative));
        const historical = readCanonicalJson(path.join(historicalRoot, relative));
        assert.equal(sha256(path.join(currentRoot, relative)),
            sha256(path.join(historicalRoot, relative)), `R4_HISTORICAL_MANIFEST_CHANGED:${relative}`);
        for (const record of [current.value, historical.value]) {
            for (const key of ['protectedFiles', 'inheritedProtectedFiles']) {
                for (const file of Object.keys(record[key] || {})) protectedFiles.add(file);
            }
            const runtime = record.runtimeGuardSuccessor || {};
            for (const key of ['protectedFiles', 'inheritedProtectedFiles']) {
                for (const file of Object.keys(runtime[key] || {})) protectedFiles.add(file);
            }
        }
    }
    assert.equal(protectedFiles.size, 52, 'R4_HISTORICAL_PROTECTED_COUNT_CHANGED');
    const allowed = new Map(manifest.allowlist.map(entry => [entry.path, entry.canonicalSha256]));
    const changed = [];
    for (const relative of [...protectedFiles].sort()) {
        const currentHash = sha256(path.join(currentRoot, relative));
        const historicalHash = sha256(path.join(historicalRoot, relative));
        if (currentHash === historicalHash) continue;
        assert.equal(relative, 'src/routes/shipments.js', `R4_HISTORICAL_FILE_CHANGED:${relative}`);
        assert.equal(currentHash, SHIPMENTS_SHA256, 'R4_SHIPMENTS_IDENTITY_INVALID');
        assert.equal(allowed.get(relative), SHIPMENTS_SHA256, 'R4_SHIPMENTS_NOT_AUTHORIZED');
        changed.push(relative);
    }
    assert.deepEqual(changed, ['src/routes/shipments.js'], 'R4_HISTORICAL_DELTA_INVALID');
    return Object.freeze({ protectedFiles: 52, successorIdentities: 1 });
}

export async function assertFreezeLockSuccessorR4(root = ROOT) {
    const verified = verifyMaterializedRelease(root);
    const context = globalThis.__VITALISMEN_R4_OPERATIONAL_CONTEXT;
    assert.equal(context?.loaded, true, 'R4_FREEZE_CONTEXT_MISSING');
    assert.equal(context.releaseCommit, verified.attestation.commit, 'R4_FREEZE_COMMIT_MISMATCH');
    assert.equal(context.releaseTree, verified.attestation.tree, 'R4_FREEZE_TREE_MISMATCH');
    assert.equal(context.releaseAttestationValidated, true, 'R4_FREEZE_ATTESTATION_MISSING');
    assert.equal(context.allowlistCount, 83, 'R4_FREEZE_ALLOWLIST_INVALID');
    assert.equal(context.shipmentsSha256, SHIPMENTS_SHA256, 'R4_FREEZE_SHIPMENTS_MISMATCH');
    assertRequiredContexts({
        v199: globalThis.__VITALISMEN_V199_EC_BOT_CORE_HEALTH_META_CONTEXT?.loaded,
        v146: globalThis.__VITALISMEN_V146_CONTEXT?.loaded
    });
    assertExternalLocks(verified.manifest.externalEffectLocks, process.env);
    const legacy = readCanonicalJson(path.join(root, 'FREEZE_LOCK_EC.json')).value;
    assert.equal(legacy.rules.length, 19, 'R4_FREEZE_LEGACY_RULE_COUNT_CHANGED');
    assert.equal(legacy.rules.reduce((count, rule) => count + (rule.checks?.length || 0), 0),
        118, 'R4_FREEZE_LEGACY_CHECK_COUNT_CHANGED');
    const result = assertFreezeLockEcMetaDynamicV74(loadFreezeLockEcMetaDynamicV74Workspace(root));
    assert.equal(result.legacyActiveRuleCount, 19, 'R4_FREEZE_ACTIVE_RULES_CHANGED');
    assert.equal(result.overridesApplied.length, 3, 'R4_FREEZE_V74_OVERRIDES_CHANGED');
    const equivalence = assertHistoricalProtectedEquivalence({
        currentRoot: root, historicalRoot: verified.historicalRoot, manifest: verified.manifest
    });
    await import('./guard-meta-capi-routing-freeze-v61.mjs');
    console.log('FREEZE_LOCK_SUCCESSOR_R4=PASS');
    console.log('LEGACY_FREEZE_CHECKS=118/118_PRESERVED');
    console.log(`HISTORICAL_PROTECTED_FILES=${equivalence.protectedFiles}/52_PRESERVED`);
    console.log('R4_SHIPMENTS_SUCCESSOR_IDENTITY=PASS');
    return Object.freeze({ verified, equivalence, legacyChecks: 118 });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    await assertFreezeLockSuccessorR4();
}
