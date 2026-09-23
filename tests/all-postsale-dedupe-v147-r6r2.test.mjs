import assert from 'node:assert/strict';
import test from 'node:test';
import { a07PlanV147R6R2, inspectA07V147R6R2, classifyA07ComponentV147R6R2 } from '../src/services/postSaleA07ComponentsV147R6R2Service.js';
import { classifyPostSaleContentV147R6, resolvePostSaleEventV147R6, findPostSaleEvidenceV147R6,
    pickupEventEligibleV147R6R2, guardReservedPickupEventV147R6R2 } from '../src/services/postSaleUnifiedEventV147R6Service.js';

const at = new Date('2026-09-01T00:00:00Z');
const shipment = () => ({ _id: 'ship', orderId: 'order', country: 'EC', createdAt: at,
    raw: { customerId: 'customer' }, client: { phone: '593999000147' },
    logistics: { status: 'READY_FOR_PICKUP', canonicalStatus: 'READY_FOR_PICKUP', agencyPickup: true,
        pickupReadyVerified: true, pickupReadyVerifiedSource: 'carrier_tracking', pickupReadyVerifiedAt: at },
    automation: { readyForPickupNotifiedAt: at, postSaleSafetyLedger: { READY_FOR_PICKUP: { acceptedAt: at } } } });
const stages = [['A07', 'READY_FOR_PICKUP', 'Chegou_01'], ['A10', 'PICKUP_REMINDER_DAY3', 'Chegou_02'], ['A19', 'PICKUP_REMINDER_DAY5', 'Chegou_03']];
test('A07 guide evidence matches official public and release paths but never another guide or host', async () => {
    const s = shipment(); s.logistics.invoiceUrl = 'https://ec.maxlien.shop/media/invoices/189147.pdf';
    const plan = await a07PlanV147R6R2(s);
    for (const mediaUrl of ['/media/invoices/189147.pdf', s.logistics.invoiceUrl,
        '/opt/vitalismen-automacao/releases/old/public/media/invoices/189147.pdf']) {
        assert.equal(classifyA07ComponentV147R6R2({ mediaUrl }, s, plan), 'GUIDE_PDF');
    }
    for (const mediaUrl of ['/media/invoices/other.pdf', 'https://other.invalid/media/invoices/189147.pdf']) {
        assert.equal(classifyA07ComponentV147R6R2({ mediaUrl }, s, plan), '');
    }
    assert.ok(plan.components.find((e) => e.component === 'GUIDE_PDF').guideIdentity);
});
test('A07 audio evidence satisfies only AUDIO; exact text completes the available event', async () => {
    const s = shipment(); s.logistics.trackingNumber = '189147000'; s.automation = {};
    const plan = await a07PlanV147R6R2(s);
    assert.deepEqual(plan.components.map((e) => e.component), ['TEXT', 'AUDIO']);
    assert.equal(new Set(plan.components.map((e) => e.dedupeKey)).size, 2);
    let rows = [{ isFromMe: true, isBot: false, peerPhone: s.client.phone, ack: 2,
        providerMessageId: 'audio-proof', createdAt: new Date(at.getTime() + 1000), mediaUrl: '/media/templates/EC/Chegou_01.ogg' }];
    const model = { find() { return { sort() { return this; }, async lean() { return rows; } }; } };
    let view = await inspectA07V147R6R2({ shipment: s, messageModel: model });
    assert.equal(view.satisfied, false); assert.equal(view.selected.component, 'TEXT');
    assert.equal((await inspectA07V147R6R2({ shipment: s, messageModel: model, component: 'AUDIO' })).satisfied, true);
    assert.equal((await inspectA07V147R6R2({ shipment: s, messageModel: model, component: 'GUIDE_PDF' })).decision, 'NOT_ELIGIBLE');
    rows.push({ ...rows[0], mediaUrl: '', body: plan.text, providerMessageId: 'text-proof' });
    view = await inspectA07V147R6R2({ shipment: s, messageModel: model });
    assert.equal(view.satisfied, true); assert.equal(view.parent.reservationCount, 1);
    assert.equal(new Date(view.parent.acceptedAt).getTime(), at.getTime() + 1000);
    rows[1].body = 'Pedido disponível, texto aproximado'; assert.equal((await inspectA07V147R6R2({ shipment: s, messageModel: model })).satisfied, false);
});
for (const [name, stage, label] of stages) {
    test(name + ' exact manual media resolves the same order-scoped event', async () => {
        const s = shipment(); const event = await resolvePostSaleEventV147R6({ shipment: s, stage });
        assert.equal(event.canonicalEvent, name); assert.equal(event.templateId, name);
        assert.equal(classifyPostSaleContentV147R6({ body: '[Audio]', mediaUrl: '/media/templates/EC/' + label + '.ogg' }).canonicalEvent, name);
        assert.equal(classifyPostSaleContentV147R6({ body: 'Ya puede retirar en la agencia, ' + label }), null);
        assert.equal(classifyPostSaleContentV147R6({ mediaUrl: '/media/uploads/' + label + '.ogg' }), null);
        assert.notEqual(event.dedupeKey, (await resolvePostSaleEventV147R6({ shipment: { ...s, orderId: 'other-order' }, stage })).dedupeKey);
        let rows = [{ isFromMe: true, isBot: false, body: '[Audio]', peerPhone: s.client.phone,
            mediaUrl: '/media/templates/EC/' + label + '.ogg', createdAt: new Date(at.getTime() + 1000), providerMessageId: 'accepted', ack: 2 }];
        const model = { find() { return { sort() { return this; }, async lean() { return rows; } }; } };
        assert.equal((await findPostSaleEvidenceV147R6({ shipment: s, event, messageModel: model })).length, 1);
        rows[0].ack = 0; assert.equal((await findPostSaleEvidenceV147R6({ shipment: s, event, messageModel: model })).length, 0);
        rows[0].ack = 2; rows[0].orderId = 'another-purchase';
        assert.equal((await findPostSaleEvidenceV147R6({ shipment: s, event, messageModel: model })).length, 0);
    });
}
test('72h and 120h use A07 provider acceptedAt; ENTERING and DELIVERED remain ineligible', () => {
    const s = shipment();
    for (const [stage, hours] of [['PICKUP_REMINDER_DAY3', 72], ['PICKUP_REMINDER_DAY5', 120]]) {
        assert.equal(pickupEventEligibleV147R6R2(s, stage, new Date(at.getTime() + hours * 3600000 - 1)), false);
        assert.equal(pickupEventEligibleV147R6R2(s, stage, new Date(at.getTime() + hours * 3600000)), true);
    }
    for (const status of ['ENTERING_AGENCY', 'DELIVERED']) {
        s.logistics.canonicalStatus = status;
        for (const [, stage] of stages) assert.equal(pickupEventEligibleV147R6R2(s, stage, new Date()), false);
    }
});
test('DELIVERED cancels stale reservations even after dispatcher clears the old lock', async () => {
    for (const [, stage] of stages.slice(1)) {
        const s = shipment(); const event = await resolvePostSaleEventV147R6({ shipment: s, stage });
        s.logistics.canonicalStatus = 'DELIVERED';
        s.automation.postSaleSafetyLedger[stage] = { ...event, state: 'INTENDED' };
        s.automation.notificationLocks = { [stage]: null };
        let patch = null;
        const model = { findById() { return { async lean() { return s; } }; }, async updateOne(query, update) { patch = update; return { modifiedCount: 1 }; } };
        assert.equal(await guardReservedPickupEventV147R6R2({ shipment: s, event, lockToken: 'old-token', shipmentModel: model }), false);
        assert.equal(patch.$set['automation.postSaleSafetyLedger.' + stage + '.resolution'], 'CANCELLED_PICKUP_NO_LONGER_ELIGIBLE');
        assert.equal(patch.$set['automation.postSaleSafetyLedger.' + stage + '.acceptedAt'], undefined);
    }
});
