import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
    CANARY_V75_QA_PHONE,
    CANARY_V75_RECIPIENT_LIST_FLAGS,
    CANARY_V75_REQUIRED_FALSE_FLAGS,
    CANARY_V75_REQUIRED_TRUE_FLAGS,
    resolveCanaryV75Configuration
} from '../src/services/canaryIsolationV75Service.js';

const read = (file) => fs.readFileSync(file, 'utf8');
const json = (file) => JSON.parse(read(file));
const service = read('src/services/canaryIsolationV75Service.js');
const index = read('src/index.js');
const agentRouter = read('src/services/agentRouter.js');
const nitrix = read('src/services/nitrixFastStateService.js');
const whatsappRoute = read('src/routes/whatsapp.js');
const zapiRoute = read('src/routes/zapi.js');
const zapiClient = read('src/services/zapiClient.js');
const dispatcher = read('src/whatsapp/dispatcher.js');
const connection = read('src/whatsapp/connection.js');
const outbound = read('src/whatsapp/outboundGuard.js');
const automation = read('src/whatsapp/automationSafety.js');
const status = read('src/services/shipmentStatusDispatcherService.js');
const pickup = read('src/services/shipmentMessageService.js');
const expanded = read('src/services/postSalePickupReconciliationService.js');
const decision = read('src/services/postSaleNotificationDecisionService.js');
const meta = read('src/services/metaConversionsService.js');
const dropi = read('src/services/droppiEcuadorBrowserService.js');
const senior = read('scripts/senior-guard.mjs');
const architecture = read('docs/ARQUITETURA_AUTOMACAO_OFICIAL.md');
const freeze = read('docs/CANARY_ISOLATION_SAFETY_FREEZE_V75_20260828.md');
const packageJson = json('package.json');

const env = {
    NODE_ENV: 'production',
    DISABLE_SCHEDULER: '0',
    DROPPI_EC_ACTIVE_SYNC_MODE: 'REPORT_ONLY',
    POST_SALE_V66_MUTATIONS_AUTHORIZATION: 'I_UNDERSTAND_V66_OPERATIONAL_MUTATIONS',
    META_TEST_EVENT_CODE_EC: '',
    META_TEST_EVENT_CODE: '',
    VITALISMEN_CANARY_V75_ENABLED: 'true'
};
for (const flag of CANARY_V75_REQUIRED_TRUE_FLAGS) env[flag] = 'true';
for (const flag of CANARY_V75_REQUIRED_FALSE_FLAGS) env[flag] = 'false';
for (const flag of CANARY_V75_RECIPIENT_LIST_FLAGS) env[flag] = CANARY_V75_QA_PHONE;

assert.equal(CANARY_V75_QA_PHONE, '5515998038637');
assert.equal(resolveCanaryV75Configuration(env).ready, true);
assert.equal(CANARY_V75_RECIPIENT_LIST_FLAGS.length, 5);
assert.match(service, /target === CANARY_V75_QA_PHONE/);
assert.doesNotMatch(service, /target\.endsWith|target\.startsWith|slice\(-9\)|slice\(-10\)/);
assert.match(service, /return \{ _id: \{ \$exists: false \} \}/);
assert.match(service, /canary_v75_configuration_invalid/);
assert.match(index, /assertCanaryV75RuntimeConfiguration\(process\.env\)/);

assert.match(zapiRoute, /surface: 'zapi_inbound_persistence'/);
assert.match(zapiRoute, /canaryV75InboundDecision\(payload, 'zapi_received_webhook'\)/);
assert.match(whatsappRoute, /vslCanaryV75AcceptedPayload\(body, country, 'vsl_entry'\)/);
assert.match(whatsappRoute, /vslCanaryV75AcceptedPayload\(body, 'EC', 'vsl_stage'\)/);
assert.match(dispatcher, /surface: 'baileys_dispatcher_inbound'/);
assert.match(connection, /surface: 'baileys_call_inbound'/);
assert.match(agentRouter, /surface: 'agent_router_inbound'/);
assert.match(outbound, /surface: `outbound_guard_\$\{kind\}`/);
assert.match(automation, /buildCanaryV75RecipientQuery/);

const textBoundary = zapiClient.indexOf("assertCanaryV75Recipient(cleanPhone, { surface: 'zapi_provider_text' })");
assert.ok(textBoundary >= 0 && textBoundary < zapiClient.indexOf('await axios.post', textBoundary));
assert.match(zapiClient, /zapi_provider_\$\{payloadKey \|\| 'media'\}/);

for (const source of [status, pickup, expanded]) {
    assert.match(source, /buildCanaryV75RecipientQuery\('client\.phone'\)/);
    assert.match(source, /canaryV75SchedulerShipmentAllowed/);
}
assert.match(decision, /canaryV75SchedulerShipmentAllowed/);
assert.match(status, /processCarrierStatusSweep[\s\S]*canaryV75SchedulerShipmentAllowed/);
assert.match(pickup, /processPickupProofSweep[\s\S]*canaryV75SchedulerShipmentAllowed/);
assert.match(pickup, /processShipmentPickupReminders[\s\S]*canaryV75SchedulerShipmentAllowed/);
assert.match(expanded, /processExpandedPickupConfirmationSweep[\s\S]*canaryV75SchedulerShipmentAllowed/);

assert.match(meta, /canaryV75BlockedResult\('meta'/);
assert.match(dropi, /assertCanaryV75ExternalEffectBlocked\('dropi'\)/);
assert.match(dropi, /canaryV75BlockedResult\('dropi'\)/);
assert.match(senior, /PICKUP_PROOF_SWEEP_ENABLED', 'true'/);
assert.match(senior, /PICKUP_PROOF_SWEEP_ENABLED', 'false'/);

assert.match(whatsappRoute, /texUltraNRoute \|\| texUltraSignal/);
assert.match(agentRouter, /if \(values\.some\(isTexUltraNOrigin\)\) return false/);
assert.match(nitrix, /if \(texUltraNOrigin\) return false/);
assert.doesNotMatch(nitrix, /value\.startsWith\('\/n'\).*nitrix/s);

assert.equal(
    packageJson.scripts['guard:runtime-chain-v71'],
    'node src/services/canaryIsolationSafetyFreezeRuntimeGuardV75.js'
);
assert.match(packageJson.scripts['guard:predeploy-v71'], /guard:canary-v75/);
assert.equal(
    packageJson.scripts['guard:canary-v75'],
    'node src/services/canaryIsolationSafetyFreezeRuntimeGuardV75.js && node scripts/guard-canary-isolation-v75.mjs && node --test tests/canary-isolation-v75.test.mjs'
);
assert.match(architecture, /V75: isolamento local de canário/);
assert.match(freeze, /candidata exclusivamente local/);
assert.match(freeze, /Dropi e Meta continuam negados/);

console.log('CANARY_ISOLATION_SAFETY_V75_STATIC=OK');
console.log(`CANARY_QA_PHONE=${CANARY_V75_QA_PHONE}`);
console.log('NON_QA_RECIPIENTS_ALLOWED=0');
console.log('DROPI_ALLOWED=0');
console.log('META_ALLOWED=0');
console.log('REMOTE_MUTATIONS_EXECUTED=0');
