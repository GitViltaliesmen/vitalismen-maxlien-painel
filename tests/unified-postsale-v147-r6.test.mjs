import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { classifyPostSaleContentV147R6, resolvePostSaleEventV147R6, acceptedPostSaleEvidenceV147R6,
    LEGACY_PANEL_P6_TEXT_V147R6 } from '../src/services/postSaleUnifiedEventV147R6Service.js';
import { sendCanonicalPanelPostSaleV147R6 } from '../src/services/postSaleManualPanelV147R6Service.js';

test('real panel audio shape and exact P6 template resolve without fuzzy body matching', () => {
    assert.equal(classifyPostSaleContentV147R6({ body: '[Audio]', mediaUrl: '/media/templates/EC/OBRIGADO_PAGOU.ogg' }).canonicalEvent, 'P5');
    assert.equal(classifyPostSaleContentV147R6({ body: LEGACY_PANEL_P6_TEXT_V147R6 }).templateId, 'P6_BONUS_ACCESS');
    assert.equal(classifyPostSaleContentV147R6({ body: '[Audio]', mediaUrl: '/media/templates/EC/MODO_DE_USO_TEX_ULTRA.ogg' }).product, 'tex_ultra_ec');
    assert.equal(classifyPostSaleContentV147R6({ body: 'Gracias! Tu bono ya está listo, mira otro enlace.' }), null);
    assert.equal(classifyPostSaleContentV147R6({ mediaUrl: '/media/uploads/OBRIGADO_PAGOU.ogg' }), null);
    assert.equal(classifyPostSaleContentV147R6({ mediaUrl: '/media/templates/EC/Chegou_01.ogg' }), null);
});
test('identity is shared across sender types and scoped to order, shipment, template and P7 product', async () => {
    const shipment = { _id: 'ship', orderId: 'order', raw: { customerId: 'customer' }, client: { phone: '593999000147' } };
    const a = await resolvePostSaleEventV147R6({ shipment, stage: 'DELIVERED_THANK_YOU' });
    assert.equal(a.dedupeKey, (await resolvePostSaleEventV147R6({ shipment, stage: 'DELIVERED_THANK_YOU' })).dedupeKey);
    assert.notEqual(a.dedupeKey, (await resolvePostSaleEventV147R6({ shipment: { ...shipment, orderId: 'repurchase' }, stage: 'DELIVERED_THANK_YOU' })).dedupeKey);
    const p7 = async (productKey) => resolvePostSaleEventV147R6({ shipment, stage: 'PRODUCT_USAGE', resolveProductFn: async () => ({ productKey }) });
    assert.notEqual((await p7('tex_ultra_ec')).dedupeKey, (await p7('vit_power_ec')).dedupeKey);
    assert.equal(await p7(''), null);
    assert.equal(a.product, '');
});
test('provider proof is mandatory; free human messages remain outside transactional adapter', async () => {
    assert.equal(acceptedPostSaleEvidenceV147R6({ isFromMe: true, body: LEGACY_PANEL_P6_TEXT_V147R6, ack: 2 }), false);
    assert.equal(acceptedPostSaleEvidenceV147R6({ isFromMe: true, providerMessageId: 'real-id', ack: 2, deliveryStatus: 'delivered' }), true);
    assert.equal(acceptedPostSaleEvidenceV147R6({ isFromMe: true, providerMessageId: 'real-id', ack: 1, deliveryStatus: 'request_failed' }), false);
    const result = await sendCanonicalPanelPostSaleV147R6({ request: { sendMode: 'manual_panel', message: 'Hola, estoy revisando su consulta.' },
        sendFn() { throw new Error('free message must stay with original route'); } });
    assert.deepEqual(result, { handled: false });
});
test('authenticated panel and existing dispatcher invoke canonical adapter before providers/preflight', () => {
    const route = fs.readFileSync(new URL('../src/routes/whatsapp.js', import.meta.url), 'utf8').split("router.post('/send', authMiddleware")[1].split('// DEBUG:')[0];
    assert.ok(route.indexOf('sendCanonicalPanelPostSaleV147R6') < route.indexOf('const sendResult = await sendWhatsAppMessage'));
    const dispatcher = fs.readFileSync(new URL('../src/services/shipmentStatusDispatcherService.js', import.meta.url), 'utf8');
    assert.equal((dispatcher.match(/shipmentForSend = await reconcileDeliveredPostSaleSequenceV147R6/g) || []).length, 1);
    assert.match(dispatcher, /action === 'delivered_bonus' && !dryRun/);
});
