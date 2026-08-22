import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const packageJson = JSON.parse(read('package.json'));
const model = read('src/models/ContactState.js');
const zapi = read('src/routes/zapi.js');
const whatsapp = read('src/routes/whatsapp.js');
const router = read('src/services/agentRouter.js');
const panel = read('public/qr.html');
const legacyRepair = read('scripts/repair-ec-panel-customer-drafts.mjs');
const deploy = read('scripts/deploy-vps-ready.mjs');
const manifest = JSON.parse(read('docs/freeze/ec-multiproduct-core-v48-20260822.json'));

assert.equal(manifest.status, 'activation_approved');
assert.equal(manifest.policy.productInAssignedAgentAllowed, false);
assert.equal(manifest.policy.unknownProductDefaultsToVitPower, false);
assert.equal(manifest.policy.vslOriginImmutable, true);
assert.equal(manifest.policy.manualProductOverridePreserved, true);
assert.match(model, /assignedAgent:\s*\{[\s\S]*?default:\s*null/);
assert.doesNotMatch(zapi, /targetState\.assignedAgent\s*=/);
assert.doesNotMatch(router, /state\.assignedAgent\s*=/);
assert.doesNotMatch(whatsapp, /state\.assignedAgent\s*=\s*cleanDraft\.productKey/);
assert.doesNotMatch(legacyRepair, /assignedAgent:\s*productInfo\.key/);
assert.match(legacyRepair, /legacyProductInAssignedAgent/);
assert.match(deploy, /\/home\/codex\/workspaces\/maxlien-vitalismen/);
assert.match(router, /unknown_product_requires_review/);
assert.match(zapi, /routeToBot:\s*newMessage\s*&&/);
assert.match(whatsapp, /panelAuditTransition/);
assert.match(panel, /<select id="customerProductInput">/);
assert.match(panel, /identityKeepCurrentBtn/);
assert.match(packageJson.scripts.test, /guard:ec-multiproduct-v48/);
assert.match(packageJson.scripts['guard:ec-multiproduct-v48'], /guard-ec-multiproduct-core-v48\.mjs/);
assert.match(packageJson.scripts['guard:ec-multiproduct-v48'], /ec-multiproduct-core-v48\.test\.mjs/);
assert.match(packageJson.scripts['deploy:v48'], /assert-ec-multiproduct-core-activation-approved-v48\.mjs/);
assert.match(packageJson.scripts['deploy:v48'], /deploy:vps/);

console.log('EC_MULTIPRODUCT_CORE_V48_GUARD=OK');
