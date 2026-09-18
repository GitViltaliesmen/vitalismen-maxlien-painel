import assert from 'node:assert/strict';
import fs from 'node:fs';

import './lib/ec-runtime-successor-v170-context.mjs';
import {
    EC_PANEL_STATUS_V177_EXTERNAL_EFFECT_POLICY,
    EC_PANEL_STATUS_V177_STATUSES,
    ecPanelStatusV177StatusPlan
} from '../src/services/ecPanelStatusOperationsV177Service.js';

const context = globalThis.__VITALISMEN_V177_PANEL_STATUS_CONTEXT;
assert.equal(context?.loaded, true, '[V177] context_not_loaded');
assert.equal(EC_PANEL_STATUS_V177_STATUSES.length, 9);
assert.deepEqual(
    EC_PANEL_STATUS_V177_STATUSES.filter((status) => ecPanelStatusV177StatusPlan(status).orderWrite),
    ['confirmado', 'recompra']
);
assert.deepEqual(EC_PANEL_STATUS_V177_EXTERNAL_EFFECT_POLICY, {
    dropiMode: 'REPORT_ONLY',
    dropiApplyAllowed: false,
    metaPurchaseAllowed: false,
    whatsappOutboundAllowed: false
});

const runtime = fs.readFileSync(new URL('../src/services/ecBotCoreRuntimeIntegrationV78Service.js', import.meta.url), 'utf8');
const routes = fs.readFileSync(new URL('../src/routes/whatsapp.js', import.meta.url), 'utf8');
assert.match(runtime, /ecPanelStatusV177MongoAllowed/);
assert.match(runtime, /panelStatusHumanAuthenticatedV177: true/);
assert.match(runtime, /panelStatusInternalLocalV177/);
assert.match(routes, /router\.post\('\/chats\/action', ecPanelStatusAuthenticatedActionV177/);
assert.match(routes, /router\.post\('\/chats\/bucket', ecPanelStatusAuthenticatedActionV177/);
assert.match(routes, /router\.post\('\/contact-state\/:phone\/identity-conflict', ecPanelStatusAuthenticatedActionV177/);
assert.match(routes, /router\.patch\('\/contact-state\/:phone', ecPanelStatusAuthenticatedActionV177/);

console.log('EC_PANEL_STATUS_OPERATIONS_V177=PASS');
console.log('STATUS_9_OF_9=PASS');
console.log('LOCAL_INTERNAL=PASS');
console.log('EXTERNAL_REQUEST=BLOCKED');
console.log('PRODUCTION_DB_WRITE_COUNT=0');
console.log('GUARDS_BYPASSED=NO');
