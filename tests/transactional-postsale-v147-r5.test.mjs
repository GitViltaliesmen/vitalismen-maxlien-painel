import assert from 'node:assert/strict';
import test from 'node:test';
import { resolvePostSaleProductV147R5, loadPostSaleProductV147R5 } from '../src/services/postSaleProductResolutionV147R5Service.js';
import { decidePostSaleNotification, postSaleTransactionalAllowsManualHumanMode } from '../src/services/postSaleNotificationDecisionService.js';
import { botRepurchaseEligibilityV146 } from '../src/services/ecCommercialCycleV146Service.js';
import { notifyDeliveredThankYou, notifyPickupBonus, notifyProductUsage } from '../src/services/shipmentMessageService.js';
import { buildPostSaleTransactionalV105Overlay } from '../src/services/postSaleTransactionalControlPlaneV105Service.js';

process.env.META_PIXEL_ID_EC = '1468946114265008';
Object.assign(process.env, buildPostSaleTransactionalV105Overlay({ baseEnv: process.env }));
process.env.VITALISMEN_EC_POSTSALE_TRANSACTIONAL_OPERATIONAL = 'true';
process.env.POST_SALE_TRANSACTIONAL_AT_MOST_ONCE_V116_ENABLED = 'true';
const fixture = (status = 'DELIVERED') => ({
    _id: 'shipment-r5', orderId: 'EC-R5', country: 'EC', client: { phone: '593999000147', customerId: 'customer-r5' },
    logistics: { status: status === 'DELIVERED' ? 'ENTREGADO' : status, canonicalStatus: status,
        trackingNumber: '189147500', agencyPickup: true, pickupReadyVerified: true, pickupReadyVerifiedSource: 'carrier_tracking',
        canonicalEvidence: { provider: 'servientrega', source: 'carrier_tracking', rawStatus: status, observedAt: new Date() } },
    automation: { postSaleSafetyLedger: {}, sentMessageHashes: [], notificationLocks: {} },
    raw: {}, review: {}, events: [], notificationLedger: []
});
const contactModel = (optOut = false) => ({ findOne(query) {
    const result = query['engagementAutomation.blockedReason']
        ? optOut ? { engagementAutomation: { blockedReason: 'opt_out' } } : null
        : { _id: 'customer-r5', human: { mode: 'manual' } };
    return { sort() { return this; }, select() { return this; }, async lean() { return result; } };
} });
const messageModel = { find() { return { sort() { return this; }, limit() { return this; }, select() { return this; }, async lean() { return []; } }; } };
for (const [kind, status] of [
    ['ready_for_pickup', 'READY_FOR_PICKUP'], ['pickup_reminder_day3', 'READY_FOR_PICKUP'],
    ['pickup_reminder_day5', 'READY_FOR_PICKUP'], ['delivered_thank_you', 'DELIVERED'],
    ['pickup_bonus', 'DELIVERED'], ['product_usage', 'DELIVERED']
]) test(`manual permite ${kind} canônico sem aprovação por remessa`, async () => {
    const result = await decidePostSaleNotification({ shipment: fixture(status), kind, acquireLock: false,
        contactStateModel: contactModel(), messageModel });
    assert.equal(result.decision, 'SHOULD_SEND');
    const optOut = await decidePostSaleNotification({ shipment: fixture(status), kind, acquireLock: false,
        contactStateModel: contactModel(true), messageModel });
    assert.equal(optOut.reason, 'explicit_contact_opt_out');
});
test('bloqueios explícitos da remessa e histórico continuam fechados', async () => {
    for (const review of [{ manualOnly: true }, { suppressedNotificationKinds: ['delivered_thank_you'] }]) {
        const result = await decidePostSaleNotification({ shipment: { ...fixture(), review }, kind: 'delivered_thank_you', acquireLock: false,
            contactStateModel: contactModel(), messageModel });
        assert.notEqual(result.decision, 'SHOULD_SEND');
    }
    const shipment = fixture(); shipment.logistics.canonicalEvidence.source = 'dropi';
    assert.equal(postSaleTransactionalAllowsManualHumanMode({ shipment, kind: 'delivered_thank_you' }), false);
    assert.equal(postSaleTransactionalAllowsManualHumanMode({ shipment: fixture(), kind: 'treatment_refill_reminder' }), false);
});
test('human takeover comercial permanece bloqueado mesmo após DELIVERED', () => {
    assert.deepEqual(botRepurchaseEligibilityV146({ human: { mode: 'manual' }, explicitNewPurchase: true, delivered: true }),
        { eligible: false, reason: 'human_takeover_active', botSends: 0 });
});
test('fontes do mesmo pedido, aliases oficiais e conflitos sem fallback', async () => {
    const shipment = fixture(); shipment.raw.manualDropiOrderId = '6886247';
    const order = { country: 'EC', orderId: 'EC-ADMIN-3496', dropiOrderId: '6886247', tracking: { productKey: 'tex_ultra_ec' } };
    assert.equal(resolvePostSaleProductV147R5({ shipment, orders: [order] }).productKey, 'tex_ultra_ec');
    assert.equal(resolvePostSaleProductV147R5({ shipment }).classification, 'NO_PRODUCT_EVIDENCE');
    shipment.raw.droppiOrder = { id: '6886247', orderdetails: [{ product: { name: 'VIT POWERSS 1000 ML X1 / COMUNIDAD', id: 103743 } }] };
    assert.equal(resolvePostSaleProductV147R5({ shipment }).productKey, 'vit_power_ec');
    assert.equal(resolvePostSaleProductV147R5({ shipment, orders: [order] }).classification, 'CONFLICTING_PRODUCT_EVIDENCE');
    assert.equal(resolvePostSaleProductV147R5({ shipment, orders: [{ ...order, customer: { phone: '593999000999' } }] }).productKey, '');
    shipment.raw.droppiOrder.id = 'OTHER';
    assert.equal(resolvePostSaleProductV147R5({ shipment }).productKey, '');
    shipment.raw.latestDroppiPayload = { orderId: 'OTHER', productName: 'Nitrix' };
    assert.equal(resolvePostSaleProductV147R5({ shipment }).productKey, '');
    shipment.productName = 'Tex Ultra / Vit Power';
    assert.equal(resolvePostSaleProductV147R5({ shipment }).classification, 'CONFLICTING_PRODUCT_EVIDENCE');
    let query;
    await loadPostSaleProductV147R5({ shipment, orderModel: { find(value) { query = value; return { limit() { return this; }, async lean() { return []; } }; } } });
    assert.deepEqual(query, { country: 'EC', $or: [{ orderId: 'EC-R5' }, { dropiOrderId: { $in: ['6886247'] } }] });
});
for (const [name, expected] of [['', ''], ['Tex Ultra Ecuador', 'MODO_DE_USO_TEX_ULTRA'],
    ['Vit Power', 'COMO_SE_TOMA_VIT_POWER'], ['Nitrix', 'NITRIX_USO_OXIDE_EC'], ['Tex Ultra / Nitrix', '']]) {
    test(`P5/P6 genéricos e P7 correto: ${name || 'UNKNOWN'}`, async () => {
        const shipment = fixture(); shipment.productName = name;
        const trace = [];
        const decideFn = async ({ kind }) => ({ decision: 'SHOULD_SEND', stage: kind, lockToken: 'sink-lock' });
        const complete = (field) => async () => { shipment.automation[field] = new Date(); trace.push(`${field}:ACK`); return { completed: true }; };
        assert.equal(await notifyDeliveredThankYou(shipment, { decideFn, resolveAudioFn: async () => 'SINK/OBRIGADO_PAGOU.ogg',
            sendAudioFileFn: async () => { trace.push('P5'); return { ok: true, providerMessageId: 'sink-p5' }; },
            completeFn: complete('deliveredThankYouNotifiedAt'), appendEventFn: async () => {} }), true);
        assert.equal(await notifyPickupBonus(shipment, { decideFn, findExistingMessageFn: async () => null, findExistingDedupeFn: async () => null,
            waitFn: async () => { trace.push('P6_PACING'); }, sendTextFn: async () => { trace.push('P6'); return { ok: true, providerMessageId: 'sink-p6' }; },
            completeFn: complete('bonusNotifiedAt'), persistFn: async () => {}, appendEventFn: async () => {} }), true);
        const p7 = await notifyProductUsage(shipment, { decideFn, resolveAudioFn: async (_country, base) => `SINK/${base}.ogg`,
            waitFn: async () => { trace.push('P7_PACING'); }, findExistingTexUltraAudioFn: async () => null,
            sendAudioFileFn: async (_s, _c, _a, opts) => { trace.push(opts.baseName); return { ok: true, providerMessageId: 'sink-p7' }; },
            completeFn: complete('usageNotifiedAt'), appendEventFn: async () => {}, registerAudioAttemptFn: async () => {} });
        assert.equal(p7, Boolean(expected));
        assert.deepEqual(trace.slice(0, 5), ['P5', 'deliveredThankYouNotifiedAt:ACK', 'P6_PACING', 'P6', 'bonusNotifiedAt:ACK']);
        if (expected) assert.deepEqual(trace.slice(5), ['P7_PACING', expected, 'usageNotifiedAt:ACK']);
        else assert.equal(trace.length, 5);
    });
}
