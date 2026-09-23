import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
    classifyEcuadorCommercialDecisionV161,
    EC_NEGATIVE_INTENT_V161_DECISIONS,
    EC_NEGATIVE_INTENT_V161_POLICY
} from '../src/services/ecNegativeIntentBuyLaterV161Service.js';

const read = relative => fs.readFileSync(path.resolve(relative), 'utf8');
const hash = relative => crypto.createHash('sha256').update(fs.readFileSync(path.resolve(relative))).digest('hex');
const manifestPath = 'docs/freeze/ec-negative-intent-buy-later-v161-20260914.json';
const text = read(manifestPath);
const manifest = JSON.parse(text);
const v162Overrides = new Set(globalThis.__VITALISMEN_V162_CONTEXT?.protectedFiles
    ? Object.keys(globalThis.__VITALISMEN_V162_CONTEXT.protectedFiles)
    : []);

assert.equal(text, `${JSON.stringify(manifest, null, 2)}\n`);
assert.equal(manifest.freezeId, 'EC_NEGATIVE_INTENT_BUY_LATER_V161_20260914');
assert.equal(manifest.version, 161);
assert.equal(manifest.parentCommit, '0902194ecd5454d0f720466c4bd2bc081cfd97a0');
assert.equal(manifest.parentTree, '462aaa34a289ca596bec28158985f42c0ad6322c');
assert.equal(manifest.parentManifest, 'docs/freeze/ec-panel-manual-attendant-v160-20260914.json');
assert.equal(manifest.parentManifestSha256, 'f0a0b247c813ff46c8bfb6be8250800f7f720b1614f3d5eb7e2eab95d2bb39eb');
assert.deepEqual([...manifest.overrides].sort(), Object.keys(manifest.protectedFiles).sort());
for (const [relative, expected] of Object.entries(manifest.protectedFiles)) {
    if (v162Overrides.has(relative)) continue;
    assert.equal(hash(relative), expected, `V161 protected file diverged: ${relative}`);
}
for (const [relative, expected] of Object.entries(manifest.preservedFiles)) {
    assert.equal(hash(relative), expected, `V161 preserved file diverged: ${relative}`);
}

const fixedNow = new Date('2026-09-15T01:00:00.000Z');
for (const fixture of manifest.fixtures.cancel) {
    assert.equal(
        classifyEcuadorCommercialDecisionV161(fixture, { now: fixedNow }).decision,
        EC_NEGATIVE_INTENT_V161_DECISIONS.CANCEL,
        fixture
    );
}
for (const fixture of manifest.fixtures.buyLater) {
    assert.equal(
        classifyEcuadorCommercialDecisionV161(fixture, { now: fixedNow }).decision,
        EC_NEGATIVE_INTENT_V161_DECISIONS.BUY_LATER,
        fixture
    );
}
for (const fixture of manifest.fixtures.positive) {
    assert.equal(
        classifyEcuadorCommercialDecisionV161(fixture, { now: fixedNow }).decision,
        EC_NEGATIVE_INTENT_V161_DECISIONS.POSITIVE,
        fixture
    );
}
const mixed = classifyEcuadorCommercialDecisionV161(manifest.fixtures.mixed, { now: fixedNow });
assert.equal(mixed.decision, EC_NEGATIVE_INTENT_V161_DECISIONS.BUY_LATER);
assert.equal(mixed.mixedCancellation, true);

const engine = read('src/services/conversationEngine.js');
const handlerStart = engine.indexOf('export const handleAgentConversation');
const decision = engine.indexOf('handleEcuadorNegativeOrBuyLaterV161({', handlerStart);
assert.ok(handlerStart >= 0 && decision > handlerStart);
for (const marker of [
    'maybeHandleEcuadorDirectProductInquiry({',
    'updateOrderConversationMemory({',
    'const selectedQuantityFromPrice =',
    'const pendingFallbackHandled =',
    'replyText = strictVitalismenFallbackText({'
]) {
    assert.ok(decision < engine.indexOf(marker, handlerStart), `V161 precedence lost before ${marker}`);
}
assert.match(engine, /if \(isNegativeOrBuyLaterDecisionV161\(text\)\) return '';/);
assert.match(engine, /if \(isNegativeOrBuyLaterDecisionV161\(text\)\) return true;/);

const service = read('src/services/ecNegativeIntentBuyLaterV161Service.js');
assert.doesNotMatch(service, /from ['"][^'"]*(?:droppi|dropi|metaConversions|shipmentMessage)[^'"]*['"]/i);
assert.doesNotMatch(service, /(?:orderModel|shipmentModel)\.(?:create|updateOne|findOneAndUpdate|deleteOne|deleteMany)/);
assert.match(service, /String\(agentProfile\?\.key \|\| ''\) !== VIT_POWER_AGENT_KEY/);
assert.match(service, /'human\.mode': 'manual'/);
assert.ok(service.includes("[`${prefix}.pendingCheckoutOrder`]: ''"));
assert.ok(service.includes("[`${prefix}.selectedQuantity`]: ''"));
assert.match(read('src/services/schedulerService.js'), /flagEnabled\('ADMIN_BUY_LATER_FOLLOWUP_ENABLED', false\)/);

assert.deepEqual(EC_NEGATIVE_INTENT_V161_POLICY.protectedOrderStatuses, [
    'confirmed', 'processing', 'shipped', 'delivered', 'returned'
]);
for (const key of [
    'automaticExternalCancellation',
    'createsOrder',
    'createsShipment',
    'callsDropi',
    'callsMeta',
    'enablesBuyLaterScheduler'
]) assert.equal(EC_NEGATIVE_INTENT_V161_POLICY[key], false, key);
assert.equal(EC_NEGATIVE_INTENT_V161_POLICY.anyPersistedOrderFailsClosed, true);

assert.equal(manifest.policy.negativePrecedenceImplemented, true);
assert.equal(manifest.policy.buyLaterPrecedenceImplemented, true);
assert.equal(manifest.policy.existingOrderAutoCancelBlocked, true);
assert.equal(manifest.policy.realWhatsappMessagesByValidation, 0);
assert.equal(manifest.policy.dropiCallsByValidation, 0);
assert.equal(manifest.policy.metaCallsByValidation, 0);
assert.equal(manifest.policy.orderCreatedByTest, 0);
assert.equal(manifest.policy.shipmentCreatedByTest, 0);
assert.equal(manifest.policy.knownResidual0268RepairDeferred, true);
assert.equal(manifest.policy.filesOutsideScope, 0);

console.log('EC_NEGATIVE_INTENT_BUY_LATER_V161=PASS');
