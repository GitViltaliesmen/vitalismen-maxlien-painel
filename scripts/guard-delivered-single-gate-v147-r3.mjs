import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

await import('./lib/ec-runtime-successor-v147-r3-context.mjs');

const manifestUrl = new URL('../docs/freeze/ec-delivered-single-gate-v147-r3-20260910.json', import.meta.url);
const manifestText = fs.readFileSync(manifestUrl, 'utf8');
const manifest = JSON.parse(manifestText);
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const read = (relativePath) => fs.readFileSync(new URL(`../${relativePath}`, import.meta.url));
const text = (relativePath) => read(relativePath).toString('utf8');
const block = (source, start, end) => source.slice(source.indexOf(start), source.indexOf(end));

assert.equal(manifestText, `${JSON.stringify(manifest, null, 2)}\n`, 'manifesto V147-R3 não canônico');
assert.equal(manifest.freezeId, 'EC_DELIVERED_SINGLE_GATE_V147_R3_20260910');
assert.equal(manifest.layer, 'V147-R3');
assert.equal(manifest.parentCommit, '5e3f4019bbdffebf06f2e66a74e58db52e1206da');
assert.equal(manifest.parentTree, '803c184510a80d924b5c223b7c401fbe60ad3802');
assert.equal(manifest.derivedFromFrozenCandidate, true);
assert.equal(manifest.completion.sourceOfTruth, 'SERVIENTREGA_CANONICAL_DELIVERED');
assert.deepEqual(manifest.completion.eligibleStatuses, ['DELIVERED']);
assert.equal(manifest.completion.pickupProofShortcutAllowed, false);
assert.equal(manifest.payment.p5GuardRequired, false);
assert.equal(manifest.payment.p6GuardRequired, false);
assert.equal(manifest.payment.p7GuardRequired, false);
assert.equal(manifest.sequence.p5RequiresDelivered, true);
assert.equal(manifest.sequence.p6RequiresDeliveredAndP5, true);
assert.equal(manifest.sequence.p7RequiresDeliveredAndP6, true);
assert.equal(manifest.sequence.providerPacingRequired, true);
assert.equal(manifest.sequence.burstAllowed, false);
assert.equal(manifest.p5.mediaSha256, 'bd6ce39a51cb67be469aa6aeb6c0ca94c2f53e4ab27dba46dabd2efc93a5adfd');
assert.equal(manifest.p5.semanticGate, 'PASS');
assert.equal(manifest.policy.productionChanged, false);
assert.equal(manifest.policy.publicationAllowed, false);
assert.equal(manifest.policy.pm2RestartAllowed, false);
assert.equal(manifest.policy.realMessagesSent, 0);
assert.equal(manifest.policy.transport, 'SINK');
assert.equal(manifest.policy.operatorApprovalRequired, true);
assert.equal(globalThis.__VITALISMEN_V147_R3_CONTEXT?.loaded, true, 'preload oficial V147-R3 ausente');
assert.equal(globalThis.__VITALISMEN_V147_R2_CONTEXT?.loaded, true, 'ancestral V147-R2 ausente');
assert.equal(globalThis.__VITALISMEN_V147_CONTEXT?.loaded, true, 'ancestral V147 ausente');

for (const [relativePath, expectedHash] of Object.entries(manifest.protectedFiles || {})) {
    const successorHash = globalThis.__VITALISMEN_V147_R4_CONTEXT?.protectedFiles?.[relativePath];
    assert.equal(sha256(read(relativePath)), successorHash || expectedHash, `V147-R3 divergente: ${relativePath}`);
}

const media = read(manifest.p5.source);
assert.equal(sha256(media), manifest.p5.mediaSha256);
assert.equal(media.byteLength, manifest.p5.mediaBytes);

const canonical = text('src/services/canonicalLogisticsStatusV147Service.js');
assert.match(canonical, /export const servientregaCanonicalDeliveredV147/);
assert.match(canonical, /provider !== 'SERVIENTREGA'/);
assert.match(canonical, /source !== 'CARRIER_TRACKING'/);
assert.match(canonical, /evidenceProjection\.canonicalStatus === 'DELIVERED'/);
assert.match(canonical, /export const servientregaPostSaleCompletionEligibleV147/);
assert.match(canonical, /canonicalPostSaleIdentityV147\(shipment\)\.valid/);

const messages = text('src/services/shipmentMessageService.js');
const p5 = block(messages, 'export const notifyDeliveredThankYou', 'export const notifyPickupBonus');
const p6 = block(messages, 'export const notifyPickupBonus', 'export const notifyProductUsage');
const p7 = block(messages, 'export const notifyProductUsage', 'const phoneQueryForChatId');
for (const stage of [p5, p6, p7]) {
    assert.doesNotMatch(stage, /paymentEvidence|paymentConfirmedCanonical|shipmentPaymentConfirmed/);
}
assert.match(p5, /servientregaPostSaleCompletionEligibleV147\(shipment\)/);
assert.match(p6, /pickupBonusEligibility\(shipment\)/);
assert.match(p7, /servientregaPostSaleCompletionEligibleV147\(shipment\)/);
assert.match(messages, /const p5AcceptedOrConfirmed/);
assert.match(p7, /pickupBonusAcceptedOrConfirmed\(shipment\)/);
assert.match(p7, /texUltraHowToUseAudioDedupeValue\(baseName\)/);
assert.ok(p6.indexOf('await waitFn(') < p6.indexOf('await sendTextFn('), 'P6 sem pacing antes do provider');
assert.ok(p7.indexOf('await waitFn(') < p7.indexOf('await sendAudioFileFn('), 'P7 sem pacing antes do provider');
assert.match(messages, /export const shipmentPaymentConfirmed/);

const proof = block(messages, 'export const confirmPickupFromProof', 'export const handlePickupProofInbound');
assert.match(proof, /completionGate: 'servientrega_canonical_delivered'/);
assert.doesNotMatch(proof, /logistics\.status = 'ENTREGADO'|outcomes\.delivered = true|notifyDeliveredThankYou|notifyPickupBonus|notifyProductUsage|markSenderWalletDelivered/);
const routes = text('src/routes/shipments.js');
const routeProof = block(routes, "router.post('/:orderId/confirm-pickup'", "router.post('/:orderId/notify-bonus'");
assert.match(routeProof, /completionGate: 'servientrega_canonical_delivered'/);
assert.doesNotMatch(routeProof, /logistics\.status = 'ENTREGADO'|outcomes\.delivered = true|notifyDeliveredThankYou|notifyPickupBonus|notifyProductUsage|markSenderWalletDelivered/);

const dispatcher = text('src/services/shipmentStatusDispatcherService.js');
assert.match(dispatcher, /if \(servientregaPostSaleCompletionEligibleV147\(shipment\)\) return 'delivered_bonus'/);
assert.ok(dispatcher.indexOf('await notifyDeliveredThankYou(refreshed)') < dispatcher.indexOf('await notifyPickupBonus(afterThankYou)'));
assert.ok(dispatcher.indexOf('await notifyPickupBonus(afterThankYou)') < dispatcher.indexOf('await notifyProductUsage(afterBonus)'));
assert.match(dispatcher, /'automation\.notificationLocks\.PICKUP_REMINDER_DAY3': null/);
assert.match(dispatcher, /'automation\.notificationLocks\.PICKUP_REMINDER_DAY5': null/);

const reminder = block(messages, 'export const notifyShipmentReminder', 'export const notifyDeliveredThankYou');
for (const required of [
    /'logistics\.canonicalStatus': 'READY_FOR_PICKUP'/,
    /'logistics\.pickupReadyVerifiedSource': 'carrier_tracking'/,
    /'outcomes\.delivered': \{ \$ne: true \}/,
    /'outcomes\.returned': \{ \$ne: true \}/
]) assert.match(reminder, required);

const catchup = text('src/services/postSaleCatchupV147Service.js');
for (const divergenceClass of manifest.audit.divergenceClasses) assert.match(catchup, new RegExp(divergenceClass));
assert.match(catchup, /buildReadyCatchupCandidateV147/);
assert.match(catchup, /buildDeliveredCatchupCandidateV147/);
assert.match(catchup, /listHashV147/);
assert.match(catchup, /CANONICAL_PRODUCTS\.has\(productToken\(productName\)\)/);

const catalog = text('src/services/postSaleTemplateCatalogV147Service.js');
assert.match(catalog, /servientrega_delivered_after_p5/);
assert.match(catalog, /servientrega_delivered_after_p6/);
assert.doesNotMatch(catalog, /canonical_payment|payment_guard|payment_confirmed/i);

const v116 = text('ops/post-sale-v116');
assert.match(v116, /staging-check/);
assert.match(v116, /post-sale-transactional-batch-v116\.mjs"? plan/);
assert.match(v116, /cd "\$current" && node "\$candidate\/scripts\/post-sale-transactional-batch-v116\.mjs" plan/);
assert.match(v116, /NODE_OPTIONS= node - "\$output"/);
assert.match(v116, /raw\.lastIndexOf\(marker\)/);
assert.match(v116, /result_json_missing/);
assert.match(v116, /candidate\/scripts\/lib\/ec-runtime-successor-v97-context\.mjs/);
assert.match(v116, /--import=file:\/\/\/opt\/vitalismen-automacao\/current\/scripts\/lib\/ec-runtime-successor-v97-context\.mjs/);
assert.match(v116, /NO_EROFS=YES/);
assert.doesNotMatch(v116, /pm2 jlist/);

const tests = text('tests/post-sale-delivered-single-gate-v147-r3.test.mjs');
for (const evidence of [
    'pagamento paid sem DELIVERED envia zero P5/P6/P7',
    'DELIVERED sem campo de pagamento segue P5',
    'dois workers produzem no máximo uma chamada P5',
    'restart preserva P5/P6/P7 at-most-once',
    'comprovante de retirada é somente evidência',
    'revalida fila READY sob lock',
    'seletores READY e DELIVERED geram listas finitas'
]) assert.match(tests, new RegExp(evidence));

console.log('EC_DELIVERED_SINGLE_GATE_V147_R3=PASS');
console.log(`V147_R3_MANIFEST_SHA256=${sha256(manifestText)}`);
console.log(`P5_MEDIA_SHA256=${sha256(media)}`);
