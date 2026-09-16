import assert from 'node:assert/strict';
import fs from 'node:fs';

import './lib/ec-runtime-successor-v168b-dropi-status-context.mjs';
import {
    authoritativeDropiPickupReleaseV168B,
    pickupReadyVerifiedSourceAllowedV168B
} from '../src/services/dropiPickupReleaseV168BService.js';

const read = (relative) => fs.readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');

assert.equal(globalThis.__VITALISMEN_V168B_DROPI_STATUS_CONTEXT?.loaded, true);
assert.equal(pickupReadyVerifiedSourceAllowedV168B('carrier_tracking'), true);
assert.equal(pickupReadyVerifiedSourceAllowedV168B('dropi_orders_api'), true);
assert.equal(pickupReadyVerifiedSourceAllowedV168B('dropi_panel'), false);
assert.equal(authoritativeDropiPickupReleaseV168B({
    status: 'PARA RETIRO EN AGENCIA SERVIENTREGA',
    source: 'dropi_orders_api',
    dropiOrderId: '7123456',
    trackingNumber: '189999999',
    agencyPickup: true,
    distributionCompany: 'SERVIENTREGA'
}), true);
assert.equal(authoritativeDropiPickupReleaseV168B({
    status: 'INGRESANDO EN AGENCIA',
    source: 'dropi_orders_api',
    dropiOrderId: '7123456',
    trackingNumber: '189999999',
    agencyPickup: true,
    distributionCompany: 'SERVIENTREGA'
}), false);

const dispatcher = read('src/services/shipmentStatusDispatcherService.js');
const dropiBrowser = read('src/services/droppiEcuadorBrowserService.js');
const dropiService = read('src/services/droppiEcuadorService.js');
const v155Context = read('scripts/lib/ec-runtime-successor-v155-context.mjs');
const v101Guard = read('src/services/protocoloGSuccessorGuardV101Service.js');
assert.match(dropiBrowser, /rawStatus: String\(row\?\.status \|\| ''\)\.trim\(\)/);
assert.match(dropiBrowser, /dropiRawStatus: result\.source === 'orders_api_v2' \? result\.rawStatus : ''/);
assert.match(dropiService, /const dropiStatusEvidence = payload\.dropiRawStatus \|\| payload\.status \|\| normalizedStatus/);
assert.match(dropiService, /dropiStatus: payload\.status && !payload\.dropiRawStatus[\s\S]*?dropiStatusEvidence \|\| ''/);
assert.match(v155Context, /v168aPrContext\.guardIntegrationFiles\?\.\[file\] \|\| expected/);
assert.match(v101Guard, /v168bBrowserIdentityAccepted/);
assert.match(v101Guard, /__VITALISMEN_V168B_DROPI_STATUS_CONTEXT/);
const mutablePath = dispatcher.slice(dispatcher.indexOf('let shipmentForSend = lockedShipment'));
assert.ok(mutablePath.indexOf('await refreshShipmentBeforeDispatch(') >= 0);
assert.ok(
    mutablePath.indexOf('const priorDecision = await decideDispatchNotificationV147R6')
    > mutablePath.indexOf('await refreshShipmentBeforeDispatch(')
);
assert.match(dispatcher, /preserveDropiPickupReleaseAgainstCarrierV168B/);
assert.match(dispatcher, /dropi_orders_api/);

const lifecycle = read('src/services/shipmentLifecycleStatusService.js');
const communication = read('src/services/logisticsCommunicationV29.js');
const decision = read('src/services/postSaleNotificationDecisionService.js');
assert.match(lifecycle, /pickupReadyVerifiedSourceAllowedV168B/);
assert.match(communication, /pickupReadyVerifiedSourceAllowedV168B/);
assert.match(decision, /matching_human_message_history/);
assert.match(decision, /persistTerminalSafetyDecision/);
assert.doesNotMatch(decision, /const history = canonicalEvent \? null/);
assert.match(decision, /const history = await outboundHistoryDecision/);

console.log('DROPI_PICKUP_STATUS_SYNC_V168B_GUARD=PASS');
