import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('../src/services/texUltraDeliveryClosureFreezeRuntimeGuardV54.js');

const read = (file) => fs.readFileSync(file, 'utf8');
const packageJson = JSON.parse(read('package.json'));
const entryGuard = read('src/services/ecEngagementFreezeRuntimeGuardV40.js');
const funnel = read('src/services/texUltraFunnelService.js');
const resolver = read('src/services/customerDataResolutionService.js');
const agency = read('src/services/servientregaEcuadorAgencyService.js');
const repair = read('scripts/repair-tex-ultra-agency-order-v54.mjs');
const manifest = JSON.parse(read('docs/freeze/tex-ultra-delivery-closure-v54-20260824.json'));

assert.equal(manifest.status, 'activation_approved');
assert.equal(manifest.policy.canonicalAgencyRegistryOnly, true);
assert.equal(manifest.policy.agencyReferenceNotApplicable, true);
assert.equal(manifest.policy.ambiguousAgencyRequiresLetterSelection, true);
assert.equal(manifest.policy.homeModeAloneIsNotAddress, true);
assert.equal(manifest.policy.exactOrderRepairWithBackup, true);
assert.equal(manifest.policy.realClientCanaryAuthorized, false);
assert.equal(manifest.policy.metaPurchaseResendAllowed, false);
assert.equal(manifest.policy.automaticDropiAuthorization, false);
assert.match(entryGuard, /texUltraDeliveryClosureFreezeRuntimeGuardV54\.js/);
assert.match(funnel, /texUltraAgencyCandidatesText/);
assert.match(funnel, /awaiting_agency_selection/);
assert.match(funnel, /texUltraConfirmationCorrections/);
assert.match(funnel, /authorizedAgencyOrderAddress/);
assert.match(resolver, /operationalHomeAddress/);
assert.match(resolver, /CUSTOMER_DATA_STATUS\.NOT_APPLICABLE/);
assert.match(agency, /hasUniqueBestScore/);
assert.match(agency, /'PLAZA'/);
assert.match(repair, /TEX_ULTRA_AGENCY_ORDER_V54_CONTROLLED_REPAIR/);
assert.match(repair, /noMetaResend: true/);
assert.match(repair, /noDropiSubmit: true/);
assert.doesNotMatch(repair, /sendPurchaseEventForOrder|sendText\(|sendAudio\(|sendImage\(/);
assert.match(packageJson.scripts.test, /guard:tex-ultra-delivery-v54/);
assert.match(packageJson.scripts['senior:check'], /whatsapp-outage-recovery-v49\.test\.mjs/);
assert.match(packageJson.scripts['senior:check'], /tex-ultra-delivery-closure-v54\.test\.mjs/);
assert.match(packageJson.scripts['deploy:v54'], /assert-tex-ultra-delivery-closure-activation-approved-v54\.mjs/);

console.log('TEX_ULTRA_DELIVERY_CLOSURE_V54_GUARD=OK');
