import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
    canonicalPostSaleIdentityV147,
    servientregaCanonicalDeliveredV147,
    servientregaPostSaleCompletionEligibleV147
} from '../src/services/canonicalLogisticsStatusV147Service.js';
import { POST_SALE_NOTIFICATION_DECISIONS } from '../src/services/postSaleNotificationDecisionService.js';
import { POST_SALE_STAGES } from '../src/services/postSaleSafetyV66Service.js';
import {
    confirmPickupFromProof,
    notifyDeliveredThankYou,
    notifyPickupBonus,
    notifyProductUsage,
    pickupBonusEligibility,
    pickupBonusLinkValid,
    shipmentPaymentConfirmed
} from '../src/services/shipmentMessageService.js';
import { texUltraHowToUseAudioDedupeValue } from '../src/services/texUltraHowToUseAudioService.js';
import { postSaleActionForShipmentV112 } from '../src/services/postSaleNextEligibleMonitorV112Service.js';
import { shipmentStatusDispatchActionForShipment } from '../src/services/shipmentStatusDispatcherService.js';
import { applyShipmentLifecycleStatus } from '../src/services/shipmentLifecycleStatusService.js';
import { POST_SALE_TEMPLATE_CATALOG_V147 } from '../src/services/postSaleTemplateCatalogV147Service.js';
import {
    buildDeliveredCatchupCandidateV147,
    buildReadyCatchupCandidateV147,
    classifyStatusDivergenceV147,
    listHashV147
} from '../src/services/postSaleCatchupV147Service.js';

const deliveredAt = '2026-09-10T03:00:00.000Z';

const shipmentFixture = ({
    canonicalStatus = 'DELIVERED',
    rawStatus = canonicalStatus === 'DELIVERED' ? 'Entregado' : 'Pendiente',
    rawSubstatus = '',
    source = 'carrier_tracking',
    provider = 'servientrega',
    productName = 'Tex Ultra Ecuador',
    p5Accepted = true,
    p6Accepted = false,
    paymentPaid = false
} = {}) => ({
    _id: 'shipment-r3',
    orderId: 'EC-R3-ORDER',
    country: 'EC',
    productName,
    client: { phone: '593999000111', customerId: 'customer-r3' },
    logistics: {
        status: canonicalStatus === 'DELIVERED' ? 'ENTREGADO' : 'EN_RUTA',
        trackingNumber: '189629714',
        canonicalStatus,
        canonicalEvidence: {
            provider,
            source,
            rawStatus,
            rawSubstatus,
            observedAt: new Date(deliveredAt)
        }
    },
    outcomes: { delivered: canonicalStatus === 'DELIVERED', pickedUp: canonicalStatus === 'DELIVERED', returned: false, prepaidOnly: false },
    automation: {
        deliveredConfirmedAt: canonicalStatus === 'DELIVERED' ? new Date(deliveredAt) : null,
        deliveredThankYouNotifiedAt: p5Accepted ? new Date(deliveredAt) : null,
        bonusNotifiedAt: p6Accepted ? new Date(deliveredAt) : null,
        usageNotifiedAt: null,
        sentMessageHashes: [],
        notificationLocks: {},
        postSaleSafetyLedger: {
            ...(p5Accepted ? { DELIVERED_THANK_YOU: { state: 'SENT' } } : {}),
            ...(p6Accepted ? { PICKUP_BONUS: { state: 'SENT' } } : {})
        }
    },
    review: { manualOnly: false },
    raw: paymentPaid ? { payment: { status: 'paid', confirmedAt: deliveredAt } } : {},
    proof: {},
    events: [],
    notificationLedger: []
});

test('DELIVERED da Servientrega propaga Shipment para Order, ContactState e painel', async () => {
    const shipment = shipmentFixture({ canonicalStatus: 'IN_TRANSIT', rawStatus: 'En tránsito', p5Accepted: false });
    shipment.logistics.status = 'EN_RUTA';
    shipment.logistics.canonicalStatus = 'IN_TRANSIT';
    shipment.automation.notificationLocks = {
        PICKUP_REMINDER_DAY3: { token: 'a10' },
        PICKUP_REMINDER_DAY5: { token: 'a19' }
    };
    shipment.save = async function save() { this.saved = (this.saved || 0) + 1; return this; };
    shipment.toObject = function toObject() { return this; };

    const order = {
        orderId: shipment.orderId,
        country: 'EC',
        status: 'shipped',
        customer: { phone: shipment.client.phone },
        notes: '',
        async save() { this.saved = (this.saved || 0) + 1; return this; }
    };
    const state = {
        _id: shipment.client.customerId,
        metadata: { customerDraft: { orderId: shipment.orderId, status: 'pedido_enviado' }, logistics: {} },
        markModified() {},
        async save() { this.saved = (this.saved || 0) + 1; return this; }
    };
    const panelCalls = [];
    const result = await applyShipmentLifecycleStatus({
        shipmentId: shipment._id,
        shipmentDocument: shipment,
        status: 'ENTREGADO',
        source: 'carrier_tracking',
        carrierResult: {
            carrier: 'servientrega',
            trackingNumber: shipment.logistics.trackingNumber,
            statusAtual: 'Entregado',
            canonicalStatus: 'DELIVERED'
        },
        orderModel: { async findOne() { return order; } },
        contactStateModel: { findOne() { return { async sort() { return state; } }; } },
        syncPanel: (_order, options) => {
            panelCalls.push({ customer: _order.customer, options });
            return { ok: true, lead_id: 3484 };
        }
    });

    assert.equal(result.ok, true);
    assert.equal(shipment.logistics.canonicalStatus, 'DELIVERED');
    assert.equal(shipment.outcomes.delivered, true);
    assert.equal(shipment.automation.notificationLocks.PICKUP_REMINDER_DAY3, null);
    assert.equal(shipment.automation.notificationLocks.PICKUP_REMINDER_DAY5, null);
    assert.equal(order.status, 'delivered');
    assert.equal(order.shippingCanonicalStatus, 'DELIVERED');
    assert.equal(state.metadata.customerDraft.status, 'entregue');
    assert.equal(state.metadata.logistics.canonicalStatus, 'DELIVERED');
    assert.equal(panelCalls.length, 1);
    assert.equal(panelCalls[0].customer.phone, shipment.client.phone);
    assert.equal(panelCalls[0].options.status, 'delivered');
});

const dependencies = (shipment, trace) => ({
    p5: {
        decideFn: async () => ({ decision: POST_SALE_NOTIFICATION_DECISIONS.SHOULD_SEND, stage: POST_SALE_STAGES.DELIVERED_THANK_YOU, lockToken: 'p5-lock' }),
        resolveAudioFn: async () => 'C:/sink/OBRIGADO_PAGOU.ogg',
        sendAudioFileFn: async () => { trace.push('P5_PROVIDER'); return { ok: true, providerMessageId: 'p5-provider-id' }; },
        completeFn: async ({ now }) => {
            shipment.automation.deliveredThankYouNotifiedAt = now;
            shipment.automation.postSaleSafetyLedger.DELIVERED_THANK_YOU = { state: 'SENT' };
            return { completed: true };
        },
        failFn: async () => ({ released: true }),
        appendEventFn: async () => true
    },
    p6: {
        decideFn: async () => ({ decision: POST_SALE_NOTIFICATION_DECISIONS.SHOULD_SEND, stage: POST_SALE_STAGES.PICKUP_BONUS, lockToken: 'p6-lock' }),
        sendTextFn: async () => { trace.push('P6_PROVIDER'); return { ok: true, providerMessageId: 'p6-provider-id' }; },
        completeFn: async ({ now }) => {
            shipment.automation.bonusNotifiedAt = now;
            shipment.automation.postSaleSafetyLedger.PICKUP_BONUS = { state: 'SENT' };
            return { completed: true };
        },
        failFn: async () => ({ released: true }),
        findExistingMessageFn: async () => null,
        findExistingDedupeFn: async () => null,
        persistFn: async () => true,
        appendEventFn: async () => true,
        waitFn: async () => trace.push('P6_PACING')
    },
    p7: {
        decideFn: async () => ({ decision: POST_SALE_NOTIFICATION_DECISIONS.SHOULD_SEND, stage: POST_SALE_STAGES.PRODUCT_USAGE, lockToken: 'p7-lock' }),
        resolveAudioFn: async ({ baseName }) => `C:/sink/${baseName}.ogg`,
        sendAudioFileFn: async (_shipment, _chatId, _path, options) => {
            trace.push(`P7_PROVIDER:${options.baseName}`);
            trace.push(`P7_DEDUPE:${options.dedupeValue}`);
            return { ok: true, providerMessageId: 'p7-provider-id' };
        },
        completeFn: async ({ now }) => {
            shipment.automation.usageNotifiedAt = now;
            shipment.automation.postSaleSafetyLedger.PRODUCT_USAGE = { state: 'SENT' };
            return { completed: true };
        },
        releaseFn: async () => ({ released: true }),
        failFn: async () => ({ released: true }),
        appendEventFn: async () => true,
        registerAudioAttemptFn: async () => true,
        findExistingTexUltraAudioFn: async () => null,
        waitFn: async () => trace.push('P7_PACING')
    }
});

test('V147-R3 aceita somente DELIVERED comprovado pelo tracking Servientrega e com identidade canônica', () => {
    const delivered = shipmentFixture();
    assert.equal(servientregaCanonicalDeliveredV147(delivered), true);
    assert.equal(servientregaPostSaleCompletionEligibleV147(delivered), true);
    assert.deepEqual(canonicalPostSaleIdentityV147(delivered), { customerId: 'customer-r3', orderId: 'EC-R3-ORDER', shipmentId: 'shipment-r3', valid: true });
    for (const invalid of [
        shipmentFixture({ canonicalStatus: 'READY_FOR_PICKUP', rawStatus: 'Para retiro en agencia' }),
        shipmentFixture({ canonicalStatus: 'ENTERING_AGENCY', rawSubstatus: 'Ingresando en Agencia' }),
        shipmentFixture({ canonicalStatus: 'RETURNED', rawStatus: 'Devuelto al remitente' }),
        shipmentFixture({ canonicalStatus: 'UNKNOWN', rawStatus: 'Estado sem contrato' }),
        shipmentFixture({ source: 'pickup_proof' }),
        shipmentFixture({ provider: 'dropi' }),
        { ...delivered, client: { phone: delivered.client.phone } }
    ]) {
        assert.equal(servientregaPostSaleCompletionEligibleV147(invalid), false);
        assert.notEqual(shipmentStatusDispatchActionForShipment(invalid), 'delivered_bonus');
    }
});

test('V147-R3 preserva shipmentPaymentConfirmed, mas pagamento não é gate de P5/P6/P7', () => {
    assert.equal(shipmentPaymentConfirmed({ raw: { payment: { status: 'paid' } } }), true);
    assert.equal(shipmentPaymentConfirmed({ raw: {} }), false);
    const source = fs.readFileSync('src/services/shipmentMessageService.js', 'utf8');
    for (const [start, end] of [
        ['export const notifyDeliveredThankYou', 'export const notifyPickupBonus'],
        ['export const notifyPickupBonus', 'export const notifyProductUsage'],
        ['export const notifyProductUsage', 'const phoneQueryForChatId']
    ]) assert.doesNotMatch(source.slice(source.indexOf(start), source.indexOf(end)), /shipmentPaymentConfirmed|paymentEvidence|paymentConfirmedCanonical/);
    assert.equal(POST_SALE_TEMPLATE_CATALOG_V147.BONUS_ACCESS_TEMPLATE.trigger, 'servientrega_delivered_after_p5');
    for (const template of [
        POST_SALE_TEMPLATE_CATALOG_V147.USAGE_TEX_ULTRA,
        POST_SALE_TEMPLATE_CATALOG_V147.USAGE_VIT_POWER,
        POST_SALE_TEMPLATE_CATALOG_V147.USAGE_NITRIX
    ]) assert.equal(template.trigger, 'servientrega_delivered_after_p6');
});

test('V147-R3 P6 exige DELIVERED, P5 aceito, bônus elegível e link válido', () => {
    const eligible = shipmentFixture();
    const result = pickupBonusEligibility(eligible);
    assert.equal(result.allowed, true);
    assert.equal(result.deliveryConfirmed, true);
    assert.equal(result.p5AcceptedOrConfirmed, true);
    assert.equal(result.bonusEligible, true);
    assert.equal(result.linkValid, true);
    assert.equal(pickupBonusLinkValid('https://zapgersonecvo.cloud'), true);
    assert.equal(pickupBonusLinkValid('javascript:alert(1)'), false);
    eligible.automation.deliveredThankYouNotifiedAt = null;
    eligible.automation.postSaleSafetyLedger = {};
    assert.equal(pickupBonusEligibility(eligible).allowed, false);
});

test('V147-R3 pagamento paid sem DELIVERED envia zero P5/P6/P7', async () => {
    const shipment = shipmentFixture({ canonicalStatus: 'READY_FOR_PICKUP', rawStatus: 'Para retiro en agencia', paymentPaid: true });
    shipment.outcomes = { delivered: true, pickedUp: true, returned: false, prepaidOnly: false };
    const trace = [];
    const deps = dependencies(shipment, trace);
    assert.equal(await notifyDeliveredThankYou(shipment, deps.p5), false);
    assert.equal(await notifyPickupBonus(shipment, deps.p6), false);
    assert.equal(await notifyProductUsage(shipment, deps.p7), false);
    assert.deepEqual(trace, []);
});

test('V147-R3 DELIVERED sem campo de pagamento segue P5, pacing, P6, pacing e P7', async () => {
    const shipment = shipmentFixture({ p5Accepted: false });
    const trace = [];
    const deps = dependencies(shipment, trace);
    assert.equal(await notifyDeliveredThankYou(shipment, deps.p5), true);
    assert.equal(await notifyPickupBonus(shipment, deps.p6), true);
    assert.equal(await notifyProductUsage(shipment, deps.p7), true);
    assert.deepEqual(trace, ['P5_PROVIDER', 'P6_PACING', 'P6_PROVIDER', 'P7_PACING', 'P7_PROVIDER:MODO_DE_USO_TEX_ULTRA', `P7_DEDUPE:${texUltraHowToUseAudioDedupeValue('MODO_DE_USO_TEX_ULTRA')}`]);
});

test('V147-R3 dois workers produzem no máximo uma chamada P5', async () => {
    const shipment = shipmentFixture({ p5Accepted: false });
    let claimed = false;
    let providerCalls = 0;
    const deps = dependencies(shipment, []);
    deps.p5.decideFn = async () => {
        await new Promise((resolve) => setImmediate(resolve));
        if (claimed) return { decision: POST_SALE_NOTIFICATION_DECISIONS.NOT_ELIGIBLE };
        claimed = true;
        return { decision: POST_SALE_NOTIFICATION_DECISIONS.SHOULD_SEND, stage: POST_SALE_STAGES.DELIVERED_THANK_YOU, lockToken: 'only-lock' };
    };
    deps.p5.sendAudioFileFn = async () => { providerCalls += 1; return { ok: true, providerMessageId: 'only-provider-id' }; };
    const results = await Promise.all([notifyDeliveredThankYou(shipment, deps.p5), notifyDeliveredThankYou(shipment, deps.p5)]);
    assert.equal(results.filter(Boolean).length, 1);
    assert.equal(providerCalls, 1);
});

test('V147-R3 restart preserva P5/P6/P7 at-most-once', async () => {
    const shipment = shipmentFixture({ p6Accepted: true });
    shipment.automation.usageNotifiedAt = new Date(deliveredAt);
    shipment.automation.postSaleSafetyLedger.PRODUCT_USAGE = { state: 'SENT' };
    const trace = [];
    const deps = dependencies(shipment, trace);
    assert.equal(await notifyDeliveredThankYou(shipment, deps.p5), false);
    assert.equal(await notifyPickupBonus(shipment, deps.p6), false);
    assert.equal(await notifyProductUsage(shipment, deps.p7), false);
    assert.deepEqual(trace, []);
});

test('V147-R3 comprovante de retirada é somente evidência e aguarda DELIVERED', async () => {
    const shipment = shipmentFixture({ canonicalStatus: 'READY_FOR_PICKUP', rawStatus: 'Para retiro en agencia', p5Accepted: false });
    shipment.save = async () => shipment;
    const before = JSON.parse(JSON.stringify({ logistics: shipment.logistics, outcomes: shipment.outcomes }));
    const writes = [];
    const shipmentModel = {
        findOneAndUpdate: async () => shipment,
        updateOne: async (_query, update) => { writes.push(update); return { modifiedCount: 1 }; }
    };
    const result = await confirmPickupFromProof({ shipment, chatId: '593999000111@c.us', messageId: 'proof-message', shipmentModel });
    assert.equal(result.handled, true);
    assert.equal(result.completionDeferred, true);
    assert.equal(result.thankYouSent, false);
    assert.equal(result.bonusSent, false);
    assert.equal(result.usageSent, false);
    assert.equal(JSON.stringify({ logistics: shipment.logistics, outcomes: shipment.outcomes }), JSON.stringify(before));
    assert.ok(shipment.proof.pickupProofReceivedAt);
    assert.equal(writes.length, 1);
});

test('V147-R3 monitor e dispatcher recusam outcomes/pickup proof sem DELIVERED Servientrega', () => {
    const proofOnly = shipmentFixture({ canonicalStatus: 'READY_FOR_PICKUP', rawStatus: 'Para retiro en agencia' });
    proofOnly.logistics.status = 'READY_FOR_PICKUP';
    proofOnly.logistics.pickupReadyVerified = true;
    proofOnly.logistics.pickupReadyVerifiedSource = 'carrier_tracking';
    proofOnly.outcomes = { delivered: true, pickedUp: true, returned: false };
    proofOnly.proof.pickupProofReceivedAt = new Date(deliveredAt);
    assert.equal(postSaleActionForShipmentV112(proofOnly), 'ready_for_pickup');
    assert.equal(shipmentStatusDispatchActionForShipment(proofOnly), 'ready_for_pickup');
    assert.equal(postSaleActionForShipmentV112(shipmentFixture()), 'delivered_bonus');
});

test('V147-R3 revalida fila READY sob lock e cancela A10/A19 no DELIVERED', () => {
    const messages = fs.readFileSync('src/services/shipmentMessageService.js', 'utf8');
    const lifecycle = fs.readFileSync('src/services/shipmentLifecycleStatusService.js', 'utf8');
    const dispatcher = fs.readFileSync('src/services/shipmentStatusDispatcherService.js', 'utf8');
    const reminderBlock = messages.slice(messages.indexOf('export const notifyShipmentReminder'), messages.indexOf('export const notifyDeliveredThankYou'));
    for (const pattern of [/'logistics\.status': 'READY_FOR_PICKUP'/, /'logistics\.canonicalStatus': 'READY_FOR_PICKUP'/, /'logistics\.pickupReadyVerifiedSource': 'carrier_tracking'/, /'outcomes\.delivered': \{ \$ne: true \}/]) assert.match(reminderBlock, pattern);
    assert.match(lifecycle, /notificationLocks\.PICKUP_REMINDER_DAY3 = null/);
    assert.match(lifecycle, /notificationLocks\.PICKUP_REMINDER_DAY5 = null/);
    assert.match(dispatcher, /'automation\.notificationLocks\.PICKUP_REMINDER_DAY3': null/);
    assert.match(dispatcher, /'automation\.notificationLocks\.PICKUP_REMINDER_DAY5': null/);
});

test('V147-R3 P7 mantém produto canônico e recupera dedupe manual de Tex Ultra', async () => {
    for (const [productName, expected] of [['Tex Ultra Ecuador', 'MODO_DE_USO_TEX_ULTRA'], ['Vit Power Ecuador', 'COMO_SE_TOMA_VIT_POWER'], ['Nitrix Oxide Ecuador', 'NITRIX_USO_OXIDE_EC']]) {
        const shipment = shipmentFixture({ productName, p6Accepted: true });
        const trace = [];
        const deps = dependencies(shipment, trace);
        assert.equal(await notifyProductUsage(shipment, deps.p7), true);
        assert.ok(trace.includes(`P7_PROVIDER:${expected}`));
    }
    const tex = shipmentFixture({ p6Accepted: true });
    const trace = [];
    const deps = dependencies(tex, trace);
    deps.p7.findExistingTexUltraAudioFn = async () => ({ _id: 'existing-tex', providerMessageId: 'existing-provider', sentAt: new Date(deliveredAt) });
    assert.equal(await notifyProductUsage(tex, deps.p7), true);
    assert.deepEqual(trace, []);
});

test('V147-R3 seletores READY e DELIVERED geram listas finitas e hash estável', () => {
    const readyShipment = shipmentFixture({ canonicalStatus: 'READY_FOR_PICKUP', rawStatus: 'Para retiro en agencia', p5Accepted: false });
    const ready = buildReadyCatchupCandidateV147({
        shipment: readyShipment,
        live: { ok: true, canonicalStatus: 'READY_FOR_PICKUP', canPickup: true, terminal: false }
    });
    assert.equal(ready.catchupEligible, true);
    const delivered = buildDeliveredCatchupCandidateV147({ shipment: shipmentFixture({ p5Accepted: false }) });
    assert.equal(delivered.catchupEligible, true);
    assert.equal(delivered.p5Sent, false);
    assert.equal(delivered.p6Sent, false);
    assert.equal(delivered.p7Sent, false);
    assert.equal(delivered.productCanonical, true);
    const unknownProduct = buildDeliveredCatchupCandidateV147({ shipment: shipmentFixture({ productName: 'Produto Desconhecido', p5Accepted: false }) });
    assert.equal(unknownProduct.catchupEligible, false);
    assert.equal(unknownProduct.productCanonical, false);
    assert.equal(listHashV147([ready]), listHashV147([ready]));
    assert.equal(classifyStatusDivergenceV147({ shipmentExists: false }), 'MISSING_SHIPMENT');
    assert.equal(classifyStatusDivergenceV147({ liveStatus: 'DELIVERED', storedStatus: 'IN_TRANSIT' }), 'PROVIDER_NEWER_THAN_LOCAL');
    assert.equal(classifyStatusDivergenceV147({ liveStatus: 'READY_FOR_PICKUP', storedStatus: 'ENTERING_AGENCY' }), 'STALE_PROJECTION');
});
