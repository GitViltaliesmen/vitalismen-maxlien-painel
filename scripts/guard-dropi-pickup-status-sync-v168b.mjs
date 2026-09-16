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

console.log('DROPI_PICKUP_STATUS_SYNC_V168B_GUARD=PASS');
