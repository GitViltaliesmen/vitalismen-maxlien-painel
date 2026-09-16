import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

import { EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY } from '../../src/services/ecOperationalGuardContextV97Service.js';
import './ec-runtime-successor-v168b-dropi-status-context.mjs';

const v168bDropiStatusContext = globalThis.__VITALISMEN_V168B_DROPI_STATUS_CONTEXT;
assert.equal(v168bDropiStatusContext?.loaded, true);

export const V168A_PR_PROTECTED_FILE = 'src/services/metaFunnelV148ContractService.js';
export const V168A_PR_GUARD_INTEGRATION_FILE = 'scripts/lib/ec-runtime-successor-v155-context.mjs';
export const V168A_PR_PARENT_SHA256 = 'b7fbd1159d2c3c17253fb5240097c07e94e23d5d5e9f217850a57661f0e7429f';
export const V168A_PR_SUCCESSOR_SHA256 = 'adc2b946c5fac827ba8bb4f63521fb625ebeaeaad8a5f23843f75d208fb4b88e';

const hashBuffer = (value) => crypto.createHash('sha256').update(value).digest('hex');
const hashFile = (relative) => hashBuffer(fs.readFileSync(new URL(`../../${relative}`, import.meta.url)));
const canonicalJson = (relative) => {
    const text = fs.readFileSync(new URL(`../../${relative}`, import.meta.url), 'utf8');
    const value = JSON.parse(text);
    assert.equal(text, `${JSON.stringify(value, null, 2)}\n`, `${relative} must be canonical JSON`);
    return { text, value };
};

const exactKeys = (value, expected, label) => {
    assert.deepEqual(Object.keys(value || {}).sort(), [...expected].sort(), label);
};

export const assertV168aPrGuardContract = ({
    manifest,
    parentV148,
    parentV153,
    currentFileSha256,
    guardIntegrationHashes
} = {}) => {
    assert.equal(manifest?.freezeId, 'EC_V148_BROWSER_PIXEL_GUARD_SUCCESSOR_V168A_P_R_20260916');
    assert.equal(manifest?.version, 'V168A-P-R');
    assert.equal(manifest?.parentGuard, 'V153');
    assert.equal(manifest?.trustedProductionParentCommit, 'ecf9ab51c7f65dba00f27a8b9d4d9ffb901639f3');
    assert.equal(manifest?.v168aPCommit, '590b423da6dc7447214b9d45b435c3ddf8fe51af');
    assert.equal(manifest?.parentProtectedFile, V168A_PR_PROTECTED_FILE);
    assert.equal(manifest?.expectedParentSha256, V168A_PR_PARENT_SHA256);
    assert.equal(manifest?.authorizedSuccessorSha256, V168A_PR_SUCCESSOR_SHA256);

    assert.equal(parentV153?.freezeId, 'EC_AUDIO_POSTSALE_RECOVERY_V153_20260913');
    assert.equal(manifest?.historicalV153ManifestSha256, hashBuffer(Buffer.from(`${JSON.stringify(parentV153, null, 2)}\n`)));
    assert.equal(parentV148?.freezeId, 'EC_META_FUNNEL_V148_20260910');
    assert.equal(parentV148?.protectedFiles?.[V168A_PR_PROTECTED_FILE], V168A_PR_PARENT_SHA256);

    assert.equal(manifest?.authorizedOverrideFilesCount, 1);
    assert.deepEqual(manifest?.authorizedOverrideFiles, [V168A_PR_PROTECTED_FILE]);
    assert.deepEqual(manifest?.overrides, [V168A_PR_PROTECTED_FILE]);
    assert.equal(manifest.authorizedOverrideFiles.some((file) => /[*?\[\]]/.test(file)), false);
    exactKeys(manifest?.protectedFiles, [V168A_PR_PROTECTED_FILE], 'functional protected files must be exact');
    assert.equal(manifest.protectedFiles[V168A_PR_PROTECTED_FILE], V168A_PR_SUCCESSOR_SHA256);
    assert.equal(currentFileSha256, V168A_PR_SUCCESSOR_SHA256);

    exactKeys(manifest?.guardIntegrationFiles, [V168A_PR_GUARD_INTEGRATION_FILE], 'guard integration files must be exact');
    exactKeys(guardIntegrationHashes, [V168A_PR_GUARD_INTEGRATION_FILE], 'guard integration hashes must be exact');
    assert.equal(
        guardIntegrationHashes[V168A_PR_GUARD_INTEGRATION_FILE],
        v168bDropiStatusContext.protectedFiles?.[V168A_PR_GUARD_INTEGRATION_FILE]
            || manifest.guardIntegrationFiles[V168A_PR_GUARD_INTEGRATION_FILE]
    );

    assert.equal(manifest?.policy?.scope, 'V148_BROWSER_PIXEL_ALLOWLIST_ONLY');
    assert.equal(manifest?.policy?.approvedBrowserPixel, '920532663934291');
    assert.equal(manifest?.policy?.canonicalCapiDataset, '1468946114265008');
    assert.equal(manifest?.policy?.globalDatasetReplacement, false);
    assert.equal(manifest?.policy?.wildcardOverridesAllowed, false);
    assert.equal(manifest?.policy?.historicalV153Preserved, true);
    for (const field of [
        'capiDestinationChanged',
        'purchaseRoutingChanged',
        'initiateCheckoutDestinationChanged',
        'leadDestinationChanged',
        'globalPixelChanged',
        'whatsappProviderChanged',
        'baileysChanged',
        'zapiChanged',
        'conversationEngineChanged',
        'queueChanged',
        'dropiChanged',
        'ordersChanged',
        'postSaleChanged',
        'shipmentChanged',
        'mediaChanged',
        'audioChanged',
        'dashboardChanged',
        'webWorkerChanged'
    ]) assert.equal(manifest.policy[field], false, `${field} must remain false`);

    return Object.freeze({
        protectedFiles: Object.freeze({ ...manifest.protectedFiles }),
        guardIntegrationFiles: Object.freeze({ ...manifest.guardIntegrationFiles })
    });
};

const current = canonicalJson('docs/freeze/ec-v148-browser-pixel-guard-successor-v168a-pr-20260916.json');
const parentV148 = canonicalJson('docs/freeze/ec-meta-funnel-v148-20260910.json');
const parentV153 = canonicalJson('docs/freeze/ec-audio-postsale-recovery-v153-20260913.json');
const identity = assertV168aPrGuardContract({
    manifest: current.value,
    parentV148: parentV148.value,
    parentV153: parentV153.value,
    currentFileSha256: hashFile(V168A_PR_PROTECTED_FILE),
    guardIntegrationHashes: {
        [V168A_PR_GUARD_INTEGRATION_FILE]: hashFile(V168A_PR_GUARD_INTEGRATION_FILE)
    }
});

globalThis.__VITALISMEN_V168A_PR_CONTEXT = Object.freeze({
    loaded: true,
    freezeId: current.value.freezeId,
    manifestSha256: hashBuffer(current.text),
    protectedFiles: identity.protectedFiles,
    guardIntegrationFiles: Object.freeze({
        ...identity.guardIntegrationFiles,
        ...v168bDropiStatusContext.protectedFiles
    })
});
for (const key of ['__VITALISMEN_SUCCESSOR_OVERRIDE_FILES', EC_OPERATIONAL_GUARD_CONTEXT_V97_OVERRIDE_KEY]) {
    globalThis[key] = [...new Set([...(globalThis[key] || []), ...current.value.authorizedOverrideFiles])];
}
