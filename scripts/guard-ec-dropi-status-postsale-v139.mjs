import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

export const assertEcDropiStatusPostSaleV139 = () => {
    const failures = [];
    const requireMatch = (source, expression, reason) => {
        if (!expression.test(source)) failures.push(reason);
    };
    const manifest = JSON.parse(read('docs/freeze/ec-dropi-status-postsale-v139-20260907.json'));
    assert.equal(manifest.parentCommit, 'e6199c8cd98177de1d2f956f07d7e38f3135adb3');
    assert.equal(manifest.parentTree, 'f801f602ebb487061d27630dce6aadfe58d730ad');
    assert.equal(manifest.layer, 'EC_DROPI_STATUS_POSTSALE_V139');
    assert.equal(
        sha256(fs.readFileSync(path.join(root, 'docs/freeze/ec-dropi-human-authorization-v138-20260907.json'))),
        manifest.parentManifestSha256
    );
    for (const [file, expected] of Object.entries(manifest.protectedFiles)) {
        assert.equal(sha256(fs.readFileSync(path.join(root, file))), expected, file);
    }

    const service = read('src/services/ecDropiStatusPostSaleV139Service.js');
    const dropi = read('src/services/droppiEcuadorService.js');
    const dispatcher = read('src/services/shipmentStatusDispatcherService.js');
    const routes = read('src/routes/shipments.js');
    const orderRoutes = read('src/routes/orders.js');
    const panel = read('public/leads-window.html');
    const logistics = read('src/services/logisticsCommunicationV29.js');

    requireMatch(service, /nonRegressingOrderStatusV139/, 'missing_non_regression_guard');
    requireMatch(service, /missing_real_dropi_order_id/, 'missing_real_dropi_id_guard');
    requireMatch(service, /missing_human_dropi_authorization/, 'missing_human_authorization_guard');
    requireMatch(service, /metadata\.customerDraft/, 'missing_contact_state_projection');
    requireMatch(dropi, /persistDropiStatusProjectionV139\(\{ shipment \}\)/, 'dropi_sync_does_not_project_status');
    requireMatch(dispatcher, /dropiPostSaleEvidenceV139/, 'dispatcher_missing_dropi_evidence_gate');
    requireMatch(orderRoutes, /persistManualPanelStatusV139/, 'missing_manual_status_persistence_route');
    requireMatch(orderRoutes, /dropiCalled: false/, 'manual_status_route_missing_dropi_zero_attestation');
    requireMatch(orderRoutes, /postSaleTriggered: false/, 'manual_status_route_missing_postsale_zero_attestation');
    requireMatch(panel, /api\(`\/api\/orders\/\$\{encodeURIComponent\(orderId\)\}`/, 'panel_missing_order_status_bridge');
    requireMatch(logistics, /no vaya todavía a la agencia/i, 'agency_guide_missing_no_pickup_warning');
    requireMatch(logistics, /Le avisaremos por aquí apenas esté disponible para retiro/i, 'agency_guide_missing_later_notice');

    const projectionIndex = dispatcher.indexOf('persistDropiStatusProjectionV139({ shipment: shipmentForSend })');
    const notifyIndex = dispatcher.indexOf('notifyShipmentGuideGenerated(shipmentForSend)');
    if (projectionIndex < 0 || notifyIndex < 0 || projectionIndex >= notifyIndex) {
        failures.push('status_projection_must_precede_customer_notification');
    }

    const manualRoute = orderRoutes.split("router.patch('/:id'")[1]
        ?.split("router.post('/:id/confirm-payment'")[0] || '';
    if (/submitDroppiEcuadorOrder|notifyShipment|notifyReadyForPickup|sendText\(/.test(manualRoute)) {
        failures.push('manual_status_route_has_forbidden_outbound_side_effect');
    }

    const v138Route = routes.split("router.post('/droppi/ec/admin-leads/:leadId/authorize-submit'")[1] || routes;
    requireMatch(v138Route, /dropiSubmitAuthorizedAt/, 'v138_manual_authorization_marker_missing');
    requireMatch(routes, /router\.use\(ecManualDropiHumanActionV138\)/, 'v138_manual_action_middleware_missing');

    if (failures.length) throw new Error(`EC_DROPI_STATUS_POSTSALE_V139_GUARD=FAIL ${failures.join(',')}`);
    return manifest;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    assertEcDropiStatusPostSaleV139();
    console.log('EC_DROPI_STATUS_POSTSALE_V139_GUARD=PASS');
}
