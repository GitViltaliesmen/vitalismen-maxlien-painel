import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { classifyPostSaleContentV147R6, resolvePostSaleEventV147R6, acceptedPostSaleEvidenceV147R6,
    LEGACY_PANEL_P6_TEXT_V147R6 } from '../src/services/postSaleUnifiedEventV147R6Service.js';
import { sendCanonicalPanelPostSaleV147R6 } from '../src/services/postSaleManualPanelV147R6Service.js';

test('real panel audio shape and exact P6 template resolve without fuzzy body matching', () => {
    assert.equal(classifyPostSaleContentV147R6({ body: '[Audio]', mediaUrl: '/media/templates/EC/OBRIGADO_PAGOU.ogg' }).canonicalEvent, 'P5');
    assert.equal(classifyPostSaleContentV147R6({ mediaUrl: '/opt/vitalismen-automacao/releases/20260910T185730Z_production-20260910-dbb3d14/public/media/templates/EC/OBRIGADO_PAGOU.ogg' }).canonicalEvent, 'P5');
    assert.equal(classifyPostSaleContentV147R6({ body: LEGACY_PANEL_P6_TEXT_V147R6 }).templateId, 'P6_BONUS_ACCESS');
    assert.equal(classifyPostSaleContentV147R6({ body: '[Audio]', mediaUrl: '/media/templates/EC/MODO_DE_USO_TEX_ULTRA.ogg' }).product, 'tex_ultra_ec');
    assert.equal(classifyPostSaleContentV147R6({ body: 'Gracias! Tu bono ya está listo, mira otro enlace.' }), null);
    assert.equal(classifyPostSaleContentV147R6({ mediaUrl: '/media/uploads/OBRIGADO_PAGOU.ogg' }), null);
    assert.equal(classifyPostSaleContentV147R6({ mediaUrl: '/media/templates/EC/Chegou_01.ogg' }).canonicalEvent, 'A07');
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
    assert.match(route, /canonicalPostSale: true, outboundContext: 'shipment_status'/);
    const helper = fs.readFileSync(new URL('../src/routes/whatsapp.js', import.meta.url), 'utf8').split('const sendWhatsAppMessage = async')[1].split('const buildLeadRecoveryTemplates')[0];
    assert.match(helper, /dedupeValue: options.dedupeValue, outboundContext: 'shipment_status'/);
    const dispatcher = fs.readFileSync(new URL('../src/services/shipmentStatusDispatcherService.js', import.meta.url), 'utf8');
    assert.equal((dispatcher.match(/shipmentForSend = await reconcileDeliveredPostSaleSequenceV147R6/g) || []).length, 1);
    assert.match(dispatcher, /action === 'delivered_bonus' && !dryRun/);
});

test('R6R2 successor recognizes the manual audio evidence from the R6 gap audit', async () => {
    const { decidePostSaleNotification } = await import('../src/services/postSaleNotificationDecisionService.js');
    const shipment = { _id: 'audit-only', orderId: 'audit-order', country: 'EC', client: { phone: '593999000147' },
        logistics: { status: 'READY_FOR_PICKUP', canonicalStatus: 'READY_FOR_PICKUP', trackingNumber: '189147600',
            agencyPickup: true, pickupReadyVerified: true, pickupReadyVerifiedSource: 'carrier_tracking',
            canonicalEvidence: { source: 'carrier_tracking', provider: 'servientrega', observedAt: new Date() } } };
    for (const [kind, label] of [['ready_for_pickup', 'Chegou_01'], ['pickup_reminder_day3', 'Chegou_02'], ['pickup_reminder_day5', 'Chegou_03']]) {
        const row = { isFromMe: true, isBot: false, body: '[Audio]', mediaUrl: '/media/templates/EC/' + label + '.ogg', providerMessageId: 'accepted-audit-' + label, ack: 2, peerPhone: shipment.client.phone, createdAt: new Date() };
        shipment.createdAt = new Date(Date.now() - 60000);
        assert.ok(classifyPostSaleContentV147R6(row));
        const messageModel = { find() { return { sort() { return this; }, limit() { return this; }, async lean() { return [row]; } }; } };
        const contactStateModel = { findOne() { return { sort() { return this; }, select() { return this; }, async lean() { return null; } }; } };
        const decision = await decidePostSaleNotification({ shipment, kind, a07Component: kind === 'ready_for_pickup' ? 'AUDIO' : '', messageModel, contactStateModel, acquireLock: false });
        assert.equal(decision.decision, 'ALREADY_NOTIFIED_MANUALLY');
    }
});

test('dispatcher continues the missing stage when P6 was manual and stops on ambiguous P5', async () => {
    const { decidePostSaleSequenceV147R6 } = await import('../src/services/postSaleNotificationDecisionService.js');
    const shipment = { _id: 'sequence-fixture', orderId: 'sequence-order', country: 'EC', productName: 'Tex Ultra',
        client: { phone: '593999000147', customerId: 'fixture-customer' },
        logistics: { canonicalStatus: 'DELIVERED', trackingNumber: '189147611', canonicalEvidence: {
            provider: 'servientrega', source: 'carrier_tracking', rawStatus: 'Entregado', observedAt: new Date() } },
        automation: { bonusNotifiedAt: new Date() } };
    const messageModel = { find() { return { sort() { return this; }, limit() { return this; }, async lean() { return []; } }; } };
    const contactStateModel = { findOne() { return { sort() { return this; }, select() { return this; }, async lean() { return null; } }; } };
    const decide = () => decidePostSaleSequenceV147R6({ shipment, messageModel, contactStateModel });
    assert.equal((await decide()).stage, 'DELIVERED_THANK_YOU');
    shipment.automation.postSaleSafetyLedger = { DELIVERED_THANK_YOU: { state: 'INTENDED' } };
    assert.equal((await decide()).reason, 'intended_event_requires_reconciliation');
    shipment.automation.deliveredThankYouNotifiedAt = new Date();
    assert.equal((await decide()).stage, 'PRODUCT_USAGE');
    shipment.automation.usageNotifiedAt = new Date();
    assert.equal((await decide()).reason, 'canonical_postsale_sequence_satisfied');
});
