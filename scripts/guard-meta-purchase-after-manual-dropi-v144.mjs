import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertV141V142ConvergenceV143 } from './guard-v141-v142-convergence-v143.mjs';

const root = process.cwd();
const manifestPath = 'docs/freeze/ec-meta-purchase-after-manual-dropi-v144-20260908.json';
const parentManifestPath = 'docs/freeze/ec-v141-v142-convergence-v143-20260908.json';
const successorManifestPath = 'docs/freeze/ec-integration-health-capi-queue-v145-20260908.json';
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

export const assertMetaPurchaseAfterManualDropiV144 = () => {
    const manifestText = read(manifestPath);
    const manifest = JSON.parse(manifestText);
    assert.equal(manifestText, `${JSON.stringify(manifest, null, 2)}\n`, 'manifesto V144 não canônico');
    assert.equal(manifest.freezeId, 'EC_META_PURCHASE_AFTER_MANUAL_DROPI_V144_20260908');
    assert.equal(manifest.layer, 'V144');
    assert.equal(manifest.country, 'EC');
    assert.equal(manifest.parentCommit, '8cbc5b0ca427af9ab27aeaad085c2bd70d5ca668');
    assert.equal(manifest.parentTree, '3e1081a7428c09e20b71f7ea0830768f0693a6d8');
    assert.equal(manifest.parentManifestSha256, '6141b4f0184765239600ad1c7b069e99bffe2920f75dac6f7a583df66936cd95');
    assert.equal(sha256(read(parentManifestPath)), manifest.parentManifestSha256);

    const verifiedSuccessorOverrides = new Set();
    const successorContext = globalThis.__VITALISMEN_V145_R2_CONTEXT;
    if (successorContext?.loaded === true) {
        const successorText = read(successorManifestPath);
        const successor = JSON.parse(successorText);
        assert.equal(successorText, `${JSON.stringify(successor, null, 2)}\n`, 'manifesto V145-R2 não canônico');
        assert.equal(successor.freezeId, 'EC_INTEGRATION_HEALTH_CAPI_QUEUE_V145_R2_20260908');
        assert.equal(successor.layer, 'V145-R2');
        assert.equal(successorContext.freezeId, successor.freezeId);
        assert.equal(successorContext.manifestSha256, sha256(successorText));
        assert.deepEqual(successorContext.overrides, successor.overrides);
        for (const file of successor.overrides || []) {
            assert.equal(sha256(read(file)), successor.protectedFiles?.[file], `V145-R2 override divergente: ${file}`);
            verifiedSuccessorOverrides.add(file);
        }
    }

    for (const key of ['__VITALISMEN_SUCCESSOR_OVERRIDE_FILES']) {
        globalThis[key] = [...new Set([...(globalThis[key] || []), ...(manifest.overrides || [])])];
    }
    assertV141V142ConvergenceV143();

    assert.deepEqual(Object.keys(manifest.protectedFiles || {}).sort(), [...(manifest.overrides || [])].sort());
    for (const [file, expected] of Object.entries(manifest.protectedFiles || {})) {
        if (verifiedSuccessorOverrides.has(file)) continue;
        assert.equal(sha256(read(file)), expected, `V144 protegida divergente: ${file}`);
    }

    const runtime = read('src/services/ecBotCoreOperationalV78Service.js');
    const canary = read('src/services/canaryIsolationV75Service.js');
    const permission = read('src/services/ecManualDropiMetaPurchaseV144Service.js');
    const meta = read('src/services/metaConversionsService.js');
    const shipments = read('src/routes/shipments.js');
    const panel = read('public/leads-window.html');
    const packageJson = read('package.json');
    const v97 = read('scripts/lib/ec-runtime-successor-v97-context.mjs');

    assert.match(runtime, /VITALISMEN_META_PURCHASE_ENABLED/);
    assert.match(runtime, /metaPurchaseAllowed:\s*false/);
    assert.match(meta, /canaryV75BlockedResult\('meta_purchase'/);
    assert.match(canary, /ecManualDropiMetaPurchaseAllowedV144/);
    assert.ok(canary.indexOf('ecManualDropiMetaPurchaseAllowedV144') < canary.indexOf('ecBotCoreV78BlockedResult(effect'));
    assert.match(permission, /manualDropiOperation !== 'submit'/);
    assert.match(permission, /humanDropiActionV138 !== true/);
    assert.match(permission, /humanDropiActorId/);
    assert.match(permission, /humanDropiRequestedOrderId/);
    assert.match(permission, /resolveEcBotCoreV78Configuration\(env\)\.ready/);
    assert.match(shipments, /historical_or_existing_dropi_submission/);
    assert.match(shipments, /freshDropiSubmission:\s*true/);
    assert.match(shipments, /meta_purchase_not_accepted/);
    assert.match(shipments, /events_received/);
    assert.match(panel, /metaPurchaseSentAt/);
    assert.match(panel, /metaPurchaseResponse/);
    assert.match(panel, /Meta Purchase enviado/);
    assert.match(panel, /Meta erro/);
    assert.match(packageJson, /run-with-v144-context\.mjs/);
    assert.match(packageJson, /test:v144-all/);
    assert.match(v97, /^import '\.\/ec-runtime-successor-v144-bootstrap-context\.mjs';/);

    assert.equal(manifest.policy.productionChanged, false);
    assert.equal(manifest.policy.metaAdsMutationAllowed, false);
    assert.equal(manifest.policy.realRetroPurchaseAllowed, false);
    assert.equal(manifest.policy.purchaseRequiresFreshDropiSuccess, true);
    assert.equal(manifest.policy.purchaseRequiresAuthenticatedHumanSubmit, true);
    assert.equal(manifest.policy.metaAcceptanceRequiresEventsReceived, true);
    assert.equal(manifest.policy.automaticDropiSend, false);
    assert.equal(manifest.policy.automaticShipmentCreation, false);
    assert.equal(manifest.policy.crossLayerIsolation, true);
    assert.equal(manifest.policy.vslProductionLock, true);
    return manifest;
};

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
    const manifest = assertMetaPurchaseAfterManualDropiV144();
    console.log('EC_META_PURCHASE_AFTER_MANUAL_DROPI_V144=PASS');
    console.log(`FREEZE_ID=${manifest.freezeId}`);
}
