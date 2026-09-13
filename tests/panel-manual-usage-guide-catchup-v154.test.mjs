import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { sendCanonicalPanelPostSaleV147R6 } from '../src/services/postSaleManualPanelV147R6Service.js';

test('V154 manual official P7 library audio stays on the manual route without shipment lookup', async () => {
    let lookups = 0;
    const shipmentModel = { find() { lookups += 1; throw new Error('shipment lookup must not run'); } };
    const result = await sendCanonicalPanelPostSaleV147R6({
        request: { sendMode: 'manual_panel', phone: '593999000147', isMedia: true, recordedAudio: true,
            message: '/media/templates/EC/MODO_DE_USO_TEX_ULTRA.ogg' },
        shipmentModel
    });
    assert.deepEqual(result, { handled: false });
    assert.equal(lookups, 0);
});

test('V154 never opens a manual-library bypass for Chegou pickup audio', async () => {
    const shipmentModel = { find() { return { sort() { return this; }, limit() { return this; }, async lean() { return []; } }; } };
    const result = await sendCanonicalPanelPostSaleV147R6({
        request: { sendMode: 'manual_panel', phone: '593999000147', isMedia: true, recordedAudio: true,
            message: '/media/templates/EC/Chegou_01.ogg' }, shipmentModel
    });
    assert.equal(result.handled, true);
    assert.equal(result.success, false);
    assert.equal(result.error, 'canonical_shipment_missing_or_ambiguous');
});

test('V154 bootstrap is installed before V153 while V97 keeps its frozen first import', () => {
    const v97 = fs.readFileSync(new URL('../scripts/lib/ec-runtime-successor-v97-context.mjs', import.meta.url), 'utf8');
    assert.match(v97, /^import '\.\/ec-runtime-successor-v144-bootstrap-context\.mjs';/);
    const bootstrap = fs.readFileSync(new URL('../scripts/lib/ec-runtime-successor-v144-bootstrap-context.mjs', import.meta.url), 'utf8');
    assert.ok(bootstrap.indexOf("ec-runtime-successor-v154-context.mjs") < bootstrap.indexOf("ec-runtime-successor-v153-context.mjs"));
});


test('V154 guide catch-up is single-order, carrier-refreshed and explicitly authorized', () => {
    const script = fs.readFileSync(new URL('../scripts/guide-catchup-v154.mjs', import.meta.url), 'utf8');
    assert.match(script, /V154_GUIDE_CATCHUP_AUTHORIZATION/);
    assert.match(script, /I_UNDERSTAND_V154_SINGLE_GUIDE/);
    assert.match(script, /Shipment\.findOne\(\{ orderId, country: 'EC' \}\)/);
    assert.match(script, /live\.canonicalStatus\) !== 'GUIDE_CREATED'/);
    assert.match(script, /\$pull: \{ 'review\.suppressedNotificationKinds': 'guide' \}/);
    assert.match(script, /notifyShipmentGuideGenerated\(shipment, \{ force: false \}\)/);
    assert.doesNotMatch(script, /updateMany|deleteMany|bulkWrite/);
});
