import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

await import('./lib/ec-runtime-successor-v147-r3-context.mjs');

const manifestUrl = new URL('../docs/freeze/ec-payment-bonus-guard-v147-r3-20260910.json', import.meta.url);
const manifestText = fs.readFileSync(manifestUrl, 'utf8');
const manifest = JSON.parse(manifestText);
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const read = (relativePath) => fs.readFileSync(new URL(`../${relativePath}`, import.meta.url));
const readText = (relativePath) => read(relativePath).toString('utf8');

assert.equal(manifestText, `${JSON.stringify(manifest, null, 2)}\n`, 'manifesto V147-R3 não canônico');
assert.equal(manifest.freezeId, 'EC_PAYMENT_BONUS_GUARD_V147_R3_20260910');
assert.equal(manifest.layer, 'V147-R3');
assert.equal(manifest.parentCommit, '1878f956d6e2b7d44ef3057ff50f4b000097cd4c');
assert.equal(manifest.parentTree, 'e6b09121a270bea8d175808ee6342ad76e300647');
assert.equal(manifest.parentTag, 'candidate-v147-r2-postsale-complete-20260910');
assert.equal(manifest.parentFreezeTag, 'freeze-candidate-v147-r2-postsale-complete-20260910');
assert.equal(manifest.p5.unchanged, true);
assert.equal(manifest.p5.mediaSha256, 'bd6ce39a51cb67be469aa6aeb6c0ca94c2f53e4ab27dba46dabd2efc93a5adfd');
assert.equal(manifest.payment.deliveryNeverImpliesPayment, true);
assert.equal(manifest.payment.missingAmbiguousOrUnknownFailsClosed, true);
assert.equal(manifest.payment.proofExists, false);
assert.equal(manifest.payment.source, 'NONE');
assert.equal(manifest.payment.provider, 'NONE');
assert.equal(manifest.payment.classification, 'UNKNOWN');
assert.equal(manifest.payment.confidence, 'CANONICAL_PROVIDER_SOURCE_UNAVAILABLE');
assert.equal(manifest.payment.liveInventory.derivedEventOccurrencesRejected, 6);
assert.equal(manifest.payment.liveInventory.validCanonicalShipments, 0);
assert.equal(manifest.payment.liveInventory.rejectedSourceOccurrences, 0);
assert.equal(manifest.sequence.p6RequiresPayment, true);
assert.equal(manifest.sequence.p7RequiresPayment, true);
assert.equal(manifest.sequence.p7RequiresP6AcceptedOrRecovered, true);
assert.equal(manifest.sequence.p7HasIndependentLedgerAndMarker, true);
assert.equal(manifest.sequence.providerPacingRequired, true);
assert.equal(manifest.target.canonicalStatus, 'ENTERING_AGENCY');
assert.equal(manifest.target.canPickup, false);
assert.equal(manifest.target.a07Send, 0);
assert.equal(manifest.target.p5Send, 0);
assert.equal(manifest.target.p6Send, 0);
assert.equal(manifest.target.p7Send, 0);
assert.equal(manifest.policy.productionChanged, false);
assert.equal(manifest.policy.publicationAllowed, false);
assert.equal(manifest.policy.currentSwitchAllowed, false);
assert.equal(manifest.policy.pm2RestartAllowed, false);
assert.equal(manifest.policy.realMessagesSent, 0);
assert.equal(manifest.policy.transport, 'SINK');
assert.equal(manifest.policy.operatorApprovalRequired, true);
assert.equal(globalThis.__VITALISMEN_V147_R3_CONTEXT?.loaded, true, 'preload oficial V147-R3 ausente');
assert.equal(globalThis.__VITALISMEN_V147_R2_CONTEXT?.loaded, true, 'ancestral V147-R2 ausente');
assert.equal(globalThis.__VITALISMEN_V147_CONTEXT?.loaded, true, 'ancestral V147 ausente');

for (const [relativePath, expectedHash] of Object.entries(manifest.protectedFiles || {})) {
    assert.equal(sha256(read(relativePath)), expectedHash, `V147-R3 divergente: ${relativePath}`);
}

const media = read(manifest.p5.source);
assert.equal(sha256(media), manifest.p5.mediaSha256);
assert.equal(media.byteLength, manifest.p5.mediaBytes);

const shipmentMessages = readText('src/services/shipmentMessageService.js');
const normalizedShipmentMessages = shipmentMessages.replace(/\r\n/g, '\n');
const p5Block = normalizedShipmentMessages.split('export const notifyDeliveredThankYou')[1].split('export const notifyPickupBonus')[0];
const p6Block = shipmentMessages.split('export const notifyPickupBonus')[1].split('export const notifyProductUsage')[0];
const p7Block = shipmentMessages.split('export const notifyProductUsage')[1].split('const calculateTreatmentDates')[0];
assert.equal(sha256(`export const notifyDeliveredThankYou${p5Block}`), manifest.p5.implementationSha256, 'P5 foi alterado');
assert.doesNotMatch(p5Block, /shipmentPaymentConfirmed|shipmentCanonicalPaymentEvidence|pickupBonusEligibility/);
assert.match(p6Block, /pickupBonusEligibility\(shipment, \{ paymentEvidenceFn \}\)/);
assert.match(p6Block, /paymentSource:\s*eligibility\.payment\.source/);
assert.doesNotMatch(p6Block, /sendAudioFileFn|shipment_product_usage_audio/);
assert.match(p7Block, /paymentEvidenceFn\(shipment\)/);
assert.match(p7Block, /pickupBonusAcceptedOrConfirmed\(shipment\)/);
assert.match(p7Block, /automation\?\.usageNotifiedAt/);
assert.match(p7Block, /POST_SALE_VARIANTS\.PRODUCT_USAGE_AUDIO/);
assert.match(p7Block, /shipment_product_usage_audio/);
assert.match(p7Block, /texUltraHowToUseAudioDedupeValue\(baseName\)/);
assert.match(p7Block, /findExistingTexUltraAudioFn/);
assert.match(p7Block, /recoveredFromExistingAudio:\s*true/);
assert.ok(p6Block.indexOf('await waitFn(') < p6Block.indexOf('await sendTextFn('), 'P6 sem pacing antes do provider');
assert.ok(p7Block.indexOf('await waitFn(') < p7Block.indexOf('await sendAudioFileFn('), 'P7 sem pacing antes do provider');

for (const token of [
    'UNKNOWN',
    'CANONICAL_PROVIDER_SOURCE_UNAVAILABLE',
    'paymentEvidenceFn'
]) assert.match(shipmentMessages, new RegExp(token.replaceAll('.', '\\.')));
for (const rejectedSource of [
    'raw.paymentConfirmedAt',
    'raw.payment.confirmedAt',
    'raw.payment.status',
    'raw.latestDroppiPayload.paymentStatus'
]) assert.doesNotMatch(shipmentMessages, new RegExp(rejectedSource.replaceAll('.', '\\.')));
assert.doesNotMatch(shipmentMessages, /dropi_payment_claim_skipped_paid|dropi_already_delivered_green/);

const safety = readText('src/services/postSaleSafetyV66Service.js');
const decision = readText('src/services/postSaleNotificationDecisionService.js');
const model = readText('src/models/Shipment.js');
const dispatcher = readText('src/services/shipmentStatusDispatcherService.js');
const route = readText('src/routes/shipments.js');
const matrixTests = readText('tests/post-sale-payment-bonus-v147-r3.test.mjs');
assert.match(safety, /PRODUCT_USAGE:\s*'PRODUCT_USAGE'/);
assert.match(safety, /PRODUCT_USAGE_AUDIO:\s*'product_usage_audio'/);
assert.match(decision, /product_usage:\s*LEGACY_MARKERS_BY_STAGE\[POST_SALE_STAGES\.PRODUCT_USAGE\]/);
assert.match(model, /usageNotifiedAt:\s*\{ type: Date, default: null \}/);
assert.ok(dispatcher.indexOf('await notifyDeliveredThankYou(refreshed)') < dispatcher.indexOf('await notifyPickupBonus(afterThankYou)'));
assert.ok(dispatcher.indexOf('await notifyPickupBonus(afterThankYou)') < dispatcher.indexOf('await notifyProductUsage(afterBonus)'));
assert.ok(route.indexOf('await notifyDeliveredThankYou(shipment)') < route.indexOf('await notifyPickupBonus(afterThankYou)'));
assert.ok(route.indexOf('await notifyPickupBonus(afterThankYou)') < route.indexOf('await notifyProductUsage(afterBonus)'));
for (const matrix of ['matriz A', 'matrizes B e C', 'matriz D', 'matriz E', 'matriz F']) {
    assert.match(matrixTests, new RegExp(matrix));
}
assert.match(matrixTests, /P6_PACING[\s\S]*P6_PROVIDER[\s\S]*P7_PACING[\s\S]*P7_PROVIDER/);
assert.match(matrixTests, /restart após P5\/P6\/P7 envia zero duplicatas/);
assert.match(matrixTests, /recupera o envio manual prévio de Tex Ultra sem novo provider/);

console.log('EC_PAYMENT_BONUS_GUARD_V147_R3=PASS');
console.log(`V147_R3_MANIFEST_SHA256=${sha256(manifestText)}`);
console.log(`P5_MEDIA_SHA256=${sha256(media)}`);
console.log(`P5_IMPLEMENTATION_SHA256=${manifest.p5.implementationSha256}`);
