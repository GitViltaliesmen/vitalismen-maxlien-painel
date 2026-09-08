import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

export const assertEcPhoneServientregaReconciliationV140 = () => {
    const manifest = JSON.parse(read('docs/freeze/ec-phone-servientrega-reconciliation-v140-20260907.json'));
    const parentPath = 'docs/freeze/ec-dropi-status-postsale-v139-20260907.json';
    const parent = JSON.parse(read(parentPath));
    assert.equal(manifest.parentCommit, 'b0e5f51cfc71995c9c0c26c6fbbf1ac0b74c9e69');
    assert.equal(manifest.parentTree, 'f2afcb2daa9c3f288c2a0ab07160c3a9874b239d');
    assert.equal(manifest.parentManifestSha256, sha256(fs.readFileSync(path.join(root, parentPath))));
    for (const [file, expected] of Object.entries(parent.protectedFiles)) {
        if (manifest.overrides.includes(file)) continue;
        assert.equal(sha256(fs.readFileSync(path.join(root, file))), expected, `V139 alterada fora do override V140: ${file}`);
    }
    for (const [file, expected] of Object.entries(manifest.protectedFiles)) {
        assert.equal(sha256(fs.readFileSync(path.join(root, file))), expected, `V140 protegida divergente: ${file}`);
    }

    const service = read('src/services/ecPhoneServientregaReconciliationV140Service.js');
    const browser = read('src/services/droppiEcuadorBrowserService.js');
    const scheduler = read('src/services/schedulerService.js');
    const adminPanelStatus = read('src/services/adminPanelStatusService.js');
    const historicalImporter = read('src/services/droppiEcuadorImportService.js');
    const droppiService = read('src/services/droppiEcuadorService.js');
    const lifecycle = read('src/services/shipmentLifecycleStatusService.js');
    const postSale = read('src/services/ecDropiStatusPostSaleV139Service.js');
    const v139RuntimeBridge = read('scripts/lib/ec-runtime-successor-v139-context.mjs');
    const v97RuntimeContext = read('scripts/lib/ec-runtime-successor-v97-context.mjs');
    assert.match(service, /canonicalEcPhoneE164V140/);
    assert.match(service, /\^5939\\d\{8\}\$/);
    assert.match(service, /multiple_phone_orders_remain_ambiguous/);
    assert.match(service, /multiple_dropi_orders_for_external_phone/);
    assert.match(service, /missing_human_dropi_authorization/);
    assert.match(service, /trackServientregaGuide/);
    assert.match(service, /applyShipmentLifecycleStatus/);
    assert.match(service, /restoreHistoricalExternalDroppiBinding/);
    assert.match(service, /historical_sent_notice_review_required/);
    assert.match(service, /suppressedNotificationKinds/);
    assert.doesNotMatch(service, /submitDroppiEcuadorOrder|new Shipment|Shipment\.create|new Order|Order\.create/);
    const restoreFunction = historicalImporter.split('export const restoreHistoricalExternalDroppiBinding')[1]
        ?.split('const phoneTailCandidates')[0] || '';
    assert.match(restoreFunction, /HISTORICAL_EXTERNAL_RECONCILIATION_SOURCE/);
    assert.match(historicalImporter, /phone_identity_conflict/);
    assert.match(restoreFunction, /sourceDropi: true/);
    assert.match(restoreFunction, /sourceServientrega: true/);
    assert.match(restoreFunction, /messagesSent: 0/);
    assert.doesNotMatch(restoreFunction, /notifyReadyForPickup|notifyShipmentGuideGenerated|submitDroppiEcuadorOrder|Order\.create/);
    assert.match(droppiService, /historicalIdentityOnly/);
    assert.match(droppiService, /historical_external_reconciliation_restored/);
    assert.match(lifecycle, /historical_external_customer_conflict/);
    assert.match(lifecycle, /syncContactDraftToOnlineAdminPanel/);
    assert.match(postSale, /historicalExternalPostSaleEvidenceV140/);
    assert.match(postSale, /historical_external_event_verified/);
    const sourceFunction = browser.split('export const fetchDroppiEcuadorOrdersApiReadOnly')[1]
        ?.split('export const inspectDroppiEcuadorProductTarget')[0] || '';
    assert.match(sourceFunction, /fetchOrdersApiRows/);
    assert.doesNotMatch(sourceFunction, /persistStorageState|startDropiSyncCycle|upsertDroppiEcuadorShipment/);
    const schedulerFunction = scheduler.split('const checkPhoneServientregaReconciliationV140')[1] || '';
    assert.ok(schedulerFunction.indexOf('dryRun: true') < schedulerFunction.indexOf('dryRun: false'));
    assert.match(schedulerFunction, /messages=0/);
    assert.match(adminPanelStatus, /maxBuffer: 16 \* 1024 \* 1024/);
    assert.match(v139RuntimeBridge, /ec-runtime-successor-v140-context\.mjs/);
    assert.match(v97RuntimeContext, /^import '\.\/ec-runtime-successor-v140-bootstrap-context\.mjs';/);
    assert.equal(manifest.policy.automaticDropiSend, false);
    assert.equal(manifest.policy.automaticShipmentCreation, false);
    assert.equal(manifest.policy.humanDropiAuthorizationRequired, true);
    assert.equal(manifest.policy.historicalExternalShipmentMirrorRestoration, true);
    assert.equal(manifest.policy.historicalExternalOrderCreation, false);
    assert.deepEqual(manifest.policy.historicalExternalIdentityRequires, [
        'phone',
        'dropiOrderId',
        'guide',
        'customerId',
        'leadId',
        'servientregaDirect'
    ]);
    assert.equal(manifest.policy.unknownProductQuantityValueInferred, false);
    assert.equal(manifest.policy.historicalRestorationMessages, 0);
    assert.equal(manifest.policy.postSaleActiveFromNextRealEvent, true);
    assert.equal(manifest.policy.restoredCases.length, 4);
    assert.equal(manifest.policy.dryRunWrites, 0);
    assert.equal(manifest.policy.dryRunMessages, 0);
    return manifest;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const successorPath = path.join(root, 'docs/freeze/ec-meta-funnel-reconciliation-v141-20260908.json');
    if (fs.existsSync(successorPath)) {
        const { assertEcMetaFunnelReconciliationV141 } = await import('./guard-ec-meta-funnel-reconciliation-v141.mjs');
        assertEcMetaFunnelReconciliationV141();
        console.log('EC_PHONE_SERVIENTREGA_RECONCILIATION_V140_GUARD=PASS_SUCCESSOR_V141');
    } else {
        assertEcPhoneServientregaReconciliationV140();
        console.log('EC_PHONE_SERVIENTREGA_RECONCILIATION_V140_GUARD=PASS');
    }
}
