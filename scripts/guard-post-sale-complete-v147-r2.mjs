import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

await import('./lib/ec-runtime-successor-v147-r2-context.mjs');

const manifestUrl = new URL('../docs/freeze/ec-postsale-complete-v147-r2-20260910.json', import.meta.url);
const manifestText = fs.readFileSync(manifestUrl, 'utf8');
const manifest = JSON.parse(manifestText);
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const read = (relativePath) => fs.readFileSync(new URL(`../${relativePath}`, import.meta.url));

assert.equal(manifestText, `${JSON.stringify(manifest, null, 2)}\n`, 'manifesto V147-R2 não canônico');
assert.equal(manifest.freezeId, 'EC_POSTSALE_COMPLETE_V147_R2_20260910');
assert.equal(manifest.layer, 'V147-R2');
assert.equal(manifest.parentCommit, 'dfff5d9e465d48538fce5f325cb756885b038101');
assert.equal(manifest.parentTree, 'a8d36e27ac7b4be1ead6fb8f66dbece77dbbc6de');
assert.equal(manifest.parentTag, 'candidate-v147-postsale-canonical-restoration-20260909');
assert.equal(manifest.parentFreezeTag, 'freeze-candidate-v147-postsale-canonical-restoration-20260909');
assert.equal(manifest.p5.templateId, 'P5_DELIVERED_THANKYOU_NEUTRAL');
assert.equal(manifest.p5.label, 'OBRIGADO_PAGOU');
assert.equal(manifest.p5.trigger, 'carrier_delivered');
assert.equal(manifest.p5.productScope, 'all_ec_products');
assert.equal(manifest.p5.mediaSha256, 'bd6ce39a51cb67be469aa6aeb6c0ca94c2f53e4ab27dba46dabd2efc93a5adfd');
assert.equal(manifest.policy.productionChanged, false);
assert.equal(manifest.policy.publicationAllowed, false);
assert.equal(manifest.policy.currentSwitchAllowed, false);
assert.equal(manifest.policy.pm2RestartAllowed, false);
assert.equal(manifest.policy.realMessagesSent, 0);
assert.equal(manifest.policy.transport, 'SINK');
assert.equal(manifest.policy.historicalBackfillAllowed, false);
assert.equal(manifest.policy.operatorApprovalRequired, true);
assert.equal(globalThis.__VITALISMEN_V147_R2_CONTEXT?.loaded, true, 'preload oficial V147-R2 ausente');
assert.equal(globalThis.__VITALISMEN_V147_CONTEXT?.loaded, true, 'ancestral V147 ausente');
assert.equal(globalThis.__VITALISMEN_V146_CONTEXT?.loaded, true, 'ancestral V146 ausente');

for (const [relativePath, expectedHash] of Object.entries(manifest.protectedFiles || {})) {
    assert.equal(sha256(read(relativePath)), expectedHash, `V147-R2 divergente: ${relativePath}`);
}

const media = read('public/media/templates/EC/OBRIGADO_PAGOU.ogg');
assert.equal(sha256(media), manifest.p5.mediaSha256);
assert.equal(media.byteLength, manifest.p5.mediaBytes);

const catalog = read('src/services/postSaleTemplateCatalogV147Service.js').toString('utf8');
const shipmentMessages = read('src/services/shipmentMessageService.js').toString('utf8');
const dispatcher = read('src/services/shipmentStatusDispatcherService.js').toString('utf8');
const p5Block = shipmentMessages.split('export const notifyDeliveredThankYou')[1].split('export const notifyPickupBonus')[0];
const p6p7Block = shipmentMessages.split('export const notifyPickupBonus')[1].split('const calculateTreatmentDates')[0];
assert.match(catalog, /P5_DELIVERED_THANKYOU_NEUTRAL[\s\S]*OBRIGADO_PAGOU[\s\S]*enabled:\s*true/);
assert.match(p5Block, /POST_SALE_VARIANTS\.DELIVERED_THANK_YOU_AUDIO/);
assert.match(p5Block, /deliveredThankYouDedupeValueV147/);
assert.match(p5Block, /shipment_delivered_thank_you_audio/);
assert.doesNotMatch(p5Block, /shipment_pickup_bonus_text|pickup_bonus_how_to_use/);
assert.doesNotMatch(p6p7Block, /OBRIGADO_PAGOU|shipment_delivered_thank_you_audio/);
assert.ok(dispatcher.indexOf('await notifyDeliveredThankYou(refreshed)') < dispatcher.indexOf('await notifyPickupBonus(afterThankYou)'));

console.log('EC_POSTSALE_COMPLETE_V147_R2=PASS');
console.log(`V147_R2_MANIFEST_SHA256=${sha256(manifestText)}`);
console.log(`P5_MEDIA_SHA256=${sha256(media)}`);
