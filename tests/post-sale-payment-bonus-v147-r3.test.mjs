import assert from 'node:assert/strict';
import test from 'node:test';

import {
    POST_SALE_NOTIFICATION_DECISIONS
} from '../src/services/postSaleNotificationDecisionService.js';
import {
    POST_SALE_STAGES
} from '../src/services/postSaleSafetyV66Service.js';
import {
    notifyDeliveredThankYou,
    notifyPickupBonus,
    notifyProductUsage,
    pickupBonusEligibility,
    pickupBonusLinkValid,
    shipmentCanonicalPaymentEvidence,
    shipmentPaymentConfirmed
} from '../src/services/shipmentMessageService.js';
import { texUltraHowToUseAudioDedupeValue } from '../src/services/texUltraHowToUseAudioService.js';
import { postSaleActionForShipmentV112 } from '../src/services/postSaleNextEligibleMonitorV112Service.js';

const paidAt = '2026-09-10T03:00:00.000Z';

const canonicalDropiPaymentEvent = () => ({
    kind: 'dropi_payment_claim_skipped_paid',
    at: new Date(paidAt),
    payload: {
        reason: 'dropi_already_delivered_green',
        dropiStatus: 'ENTREGADO',
        dropiVerification: {
            ok: true,
            skipped: false,
            status: 'ENTREGADO'
        }
    }
});
const canonicalPaymentEvidenceForTest = (shipment) => shipment.__testPaymentState === 'confirmed'
    ? Object.freeze({
        confirmed: true,
        source: 'test_sink.canonical_provider_receipt',
        provider: 'TEST_SINK',
        field: 'test_sink.receipt',
        value: 'confirmed',
        timestamp: paidAt,
        classification: 'OTHER_CANONICAL_CONFIRMED',
        confidence: 'CANONICAL_PROVIDER_VERIFIED'
    })
    : Object.freeze({
        confirmed: false,
        source: '',
        provider: '',
        field: '',
        value: '',
        timestamp: null,
        classification: 'UNKNOWN',
        confidence: 'CANONICAL_PROVIDER_SOURCE_UNAVAILABLE'
    });

const shipmentFixture = ({ delivered = true, payment = 'confirmed', productName = 'Tex Ultra Ecuador' } = {}) => {
    const raw = payment === 'ambiguous'
        ? { payment: { provider: 'Dropi', status: 'paid', confirmedAt: paidAt } }
        : {};
    const shipment = {
        _id: 'shipment-r3',
        orderId: 'EC-R3-ORDER',
        country: 'EC',
        productName,
        client: { phone: '593999000111' },
        logistics: {
            trackingNumber: '189629714',
            canonicalStatus: delivered ? 'DELIVERED' : 'ENTERING_AGENCY'
        },
        outcomes: {
            delivered,
            pickedUp: delivered,
            returned: false,
            prepaidOnly: false
        },
        automation: {
            deliveredConfirmedAt: delivered ? new Date('2026-09-10T02:50:00.000Z') : null,
            deliveredThankYouNotifiedAt: delivered ? new Date('2026-09-10T02:55:00.000Z') : null,
            bonusNotifiedAt: null,
            usageNotifiedAt: null,
            sentMessageHashes: [],
            postSaleSafetyLedger: {}
        },
        review: { manualOnly: false },
        raw,
        events: payment === 'confirmed'
            ? [canonicalDropiPaymentEvent()]
            : payment === 'ambiguous'
                ? [{
                    ...canonicalDropiPaymentEvent(),
                    payload: {
                        ...canonicalDropiPaymentEvent().payload,
                        dropiVerification: { ok: false, skipped: true, status: 'ENTREGADO' }
                    }
                }]
                : []
    };
    Object.defineProperty(shipment, '__testPaymentState', {
        value: payment,
        writable: true,
        enumerable: false
    });
    return shipment;
};

const dependencies = (shipment, trace) => ({
    p5: {
        decideFn: async () => ({
            decision: POST_SALE_NOTIFICATION_DECISIONS.SHOULD_SEND,
            stage: POST_SALE_STAGES.DELIVERED_THANK_YOU,
            lockToken: 'p5-lock'
        }),
        resolveAudioFn: async () => 'C:/sink/OBRIGADO_PAGOU.ogg',
        sendAudioFileFn: async () => {
            trace.push('P5_PROVIDER');
            return { ok: true, providerMessageId: 'p5-provider-id', providerStatus: 'queued' };
        },
        completeFn: async ({ now }) => {
            shipment.automation.deliveredThankYouNotifiedAt = now;
            shipment.automation.postSaleSafetyLedger.DELIVERED_THANK_YOU = { state: 'SENT' };
            return { completed: true };
        },
        failFn: async () => ({ released: true }),
        appendEventFn: async () => true
    },
    p6: {
        decideFn: async () => ({
            decision: POST_SALE_NOTIFICATION_DECISIONS.SHOULD_SEND,
            stage: POST_SALE_STAGES.PICKUP_BONUS,
            lockToken: 'p6-lock'
        }),
        sendTextFn: async () => {
            trace.push('P6_PROVIDER');
            return { ok: true, providerMessageId: 'p6-provider-id', providerStatus: 'queued' };
        },
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
        paymentEvidenceFn: canonicalPaymentEvidenceForTest,
        waitFn: async () => trace.push('P6_PACING')
    },
    p7: {
        decideFn: async () => ({
            decision: POST_SALE_NOTIFICATION_DECISIONS.SHOULD_SEND,
            stage: POST_SALE_STAGES.PRODUCT_USAGE,
            lockToken: 'p7-lock'
        }),
        resolveAudioFn: async ({ baseName }) => `C:/sink/${baseName}.ogg`,
        sendAudioFileFn: async (_shipment, _chatId, _path, options) => {
            trace.push(`P7_PROVIDER:${options.baseName}`);
            trace.push(`P7_DEDUPE:${options.dedupeValue}`);
            return { ok: true, providerMessageId: 'p7-provider-id', providerStatus: 'queued' };
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
        paymentEvidenceFn: canonicalPaymentEvidenceForTest,
        waitFn: async () => trace.push('P7_PACING')
    }
});

test('V147-R3 rejeita campos sem produtor e evento derivado de ENTREGADO', () => {
    for (const unverified of [
        { raw: { latestDroppiPayload: { paymentStatus: 'paid', paymentUpdatedAt: paidAt } } },
        { raw: { payment: { provider: 'Servientrega', status: 'paid', confirmedAt: paidAt } } },
        { raw: { paymentConfirmedAt: paidAt } },
        { events: [{ ...canonicalDropiPaymentEvent(), at: null }] },
        { events: [{ ...canonicalDropiPaymentEvent(), payload: { ...canonicalDropiPaymentEvent().payload, reason: 'carrier_delivered' } }] },
        { events: [{ ...canonicalDropiPaymentEvent(), payload: { ...canonicalDropiPaymentEvent().payload, dropiStatus: 'PENDIENTE' } }] },
        { events: [{ ...canonicalDropiPaymentEvent(), payload: { ...canonicalDropiPaymentEvent().payload, dropiVerification: { ok: false, skipped: true, status: 'ENTREGADO' } } }] }
    ]) {
        const evidence = shipmentCanonicalPaymentEvidence(unverified);
        assert.equal(evidence.confirmed, false);
        assert.equal(evidence.classification, 'UNKNOWN');
        assert.equal(evidence.confidence, 'CANONICAL_PROVIDER_SOURCE_UNAVAILABLE');
    }
    assert.equal(shipmentPaymentConfirmed({ outcomes: { delivered: true } }), false);
});

test('V147-R3 valida link, entrega, P5, pagamento e marcador antes do P6', () => {
    const eligible = shipmentFixture();
    const result = pickupBonusEligibility(eligible, { paymentEvidenceFn: canonicalPaymentEvidenceForTest });
    assert.equal(result.allowed, true);
    assert.equal(result.deliveryConfirmed, true);
    assert.equal(result.p5AcceptedOrConfirmed, true);
    assert.equal(result.paymentConfirmedCanonical, true);
    assert.equal(result.bonusEligible, true);
    assert.equal(result.linkValid, true);
    assert.equal(pickupBonusLinkValid('https://zapgersonecvo.cloud'), true);
    assert.equal(pickupBonusLinkValid('javascript:alert(1)'), false);

    eligible.automation.deliveredThankYouNotifiedAt = null;
    assert.equal(pickupBonusEligibility(eligible, { paymentEvidenceFn: canonicalPaymentEvidenceForTest }).allowed, false);
});

test('V147-R3 produção falha fechada enquanto a fonte financeira canônica está indisponível', async () => {
    const shipment = shipmentFixture();
    const eligibility = pickupBonusEligibility(shipment);
    assert.equal(eligibility.allowed, false);
    assert.equal(eligibility.paymentConfirmedCanonical, false);
    assert.equal(eligibility.payment.classification, 'UNKNOWN');
    assert.equal(eligibility.payment.confidence, 'CANONICAL_PROVIDER_SOURCE_UNAVAILABLE');

    const trace = [];
    const deps = dependencies(shipment, trace);
    delete deps.p6.paymentEvidenceFn;
    delete deps.p7.paymentEvidenceFn;
    assert.equal(await notifyPickupBonus(shipment, deps.p6), false);
    assert.equal(await notifyProductUsage(shipment, deps.p7), false);
    assert.deepEqual(trace, []);
});

test('V147-R3 monitor reavalia pagamento tardio após entrega canônica', () => {
    assert.equal(postSaleActionForShipmentV112({
        logistics: { status: 'EN_RUTA', canonicalStatus: 'DELIVERED' },
        outcomes: { delivered: true }
    }), 'delivered_bonus');
});

test('V147-R3 matriz A: entrega e pagamento liberam P6 e P7 em ordem e com pacing', async () => {
    const shipment = shipmentFixture();
    shipment.automation.deliveredThankYouNotifiedAt = null;
    const trace = [];
    const deps = dependencies(shipment, trace);
    assert.equal(await notifyDeliveredThankYou(shipment, deps.p5), true);
    assert.equal(await notifyPickupBonus(shipment, deps.p6), true);
    assert.equal(await notifyProductUsage(shipment, deps.p7), true);
    assert.deepEqual(trace, [
        'P5_PROVIDER',
        'P6_PACING',
        'P6_PROVIDER',
        'P7_PACING',
        'P7_PROVIDER:MODO_DE_USO_TEX_ULTRA',
        `P7_DEDUPE:${texUltraHowToUseAudioDedupeValue('MODO_DE_USO_TEX_ULTRA')}`
    ]);
});

test('V147-R3 matrizes B e C: entregue sem pagamento ou com pagamento ambíguo envia zero P6/P7', async () => {
    for (const payment of ['missing', 'ambiguous']) {
        const shipment = shipmentFixture({ payment });
        shipment.automation.deliveredThankYouNotifiedAt = null;
        const trace = [];
        const deps = dependencies(shipment, trace);
        assert.equal(await notifyDeliveredThankYou(shipment, deps.p5), true);
        assert.equal(await notifyPickupBonus(shipment, deps.p6), false);
        assert.equal(await notifyProductUsage(shipment, deps.p7), false);
        assert.deepEqual(trace, ['P5_PROVIDER']);
    }
});

test('V147-R3 matriz D: pagamento antes da entrega envia zero P5/P6/P7', async () => {
    const shipment = shipmentFixture({ delivered: false });
    const trace = [];
    const deps = dependencies(shipment, trace);
    assert.equal(await notifyDeliveredThankYou(shipment, {
        decideFn: async () => ({ decision: POST_SALE_NOTIFICATION_DECISIONS.NOT_ELIGIBLE })
    }), false);
    assert.equal(await notifyPickupBonus(shipment, deps.p6), false);
    assert.equal(await notifyProductUsage(shipment, deps.p7), false);
    assert.deepEqual(trace, []);
});

test('V147-R3 matriz E: pagamento tardio não repete P5 e libera P6/P7 uma vez', async () => {
    const shipment = shipmentFixture({ payment: 'missing' });
    shipment.automation.deliveredThankYouNotifiedAt = null;
    const trace = [];
    const deps = dependencies(shipment, trace);
    assert.equal(await notifyDeliveredThankYou(shipment, deps.p5), true);
    assert.equal(await notifyPickupBonus(shipment, deps.p6), false);
    shipment.__testPaymentState = 'confirmed';
    assert.equal(await notifyPickupBonus(shipment, deps.p6), true);
    assert.equal(await notifyProductUsage(shipment, deps.p7), true);
    assert.equal(await notifyDeliveredThankYou(shipment), false);
    assert.equal(trace.filter((item) => item === 'P5_PROVIDER').length, 1);
    assert.equal(trace.filter((item) => item === 'P6_PROVIDER').length, 1);
    assert.equal(trace.filter((item) => item.startsWith('P7_PROVIDER')).length, 1);
});

test('V147-R3 matriz F: restart após P5/P6/P7 envia zero duplicatas', async () => {
    const shipment = shipmentFixture();
    shipment.automation.bonusNotifiedAt = new Date(paidAt);
    shipment.automation.usageNotifiedAt = new Date(paidAt);
    shipment.automation.postSaleSafetyLedger = {
        DELIVERED_THANK_YOU: { state: 'SENT' },
        PICKUP_BONUS: { state: 'SENT' },
        PRODUCT_USAGE: { state: 'SENT' }
    };
    const trace = [];
    const deps = dependencies(shipment, trace);
    assert.equal(await notifyDeliveredThankYou(shipment), false);
    assert.equal(await notifyPickupBonus(shipment, deps.p6), false);
    assert.equal(await notifyProductUsage(shipment, deps.p7), false);
    assert.deepEqual(trace, []);
});

test('V147-R3 P7 mantém o áudio canônico de cada produto', async () => {
    for (const [productName, expected] of [
        ['Tex Ultra Ecuador', 'MODO_DE_USO_TEX_ULTRA'],
        ['Vit Power Ecuador', 'COMO_SE_TOMA_VIT_POWER'],
        ['Nitrix Oxide Ecuador', 'NITRIX_USO_OXIDE_EC']
    ]) {
        const shipment = shipmentFixture({ productName });
        shipment.automation.bonusNotifiedAt = new Date(paidAt);
        const trace = [];
        const deps = dependencies(shipment, trace);
        assert.equal(await notifyProductUsage(shipment, deps.p7), true);
        assert.ok(trace.includes(`P7_PROVIDER:${expected}`));
    }
});

test('V147-R3 P7 recupera o envio manual prévio de Tex Ultra sem novo provider', async () => {
    const shipment = shipmentFixture();
    shipment.automation.bonusNotifiedAt = new Date(paidAt);
    const trace = [];
    const deps = dependencies(shipment, trace);
    let completedProviderMessageId = '';
    deps.p7.findExistingTexUltraAudioFn = async ({ jid, recipientDigits, dedupeValue }) => {
        assert.equal(jid, '593999000111@c.us');
        assert.equal(recipientDigits, '593999000111');
        assert.equal(dedupeValue, texUltraHowToUseAudioDedupeValue('MODO_DE_USO_TEX_ULTRA'));
        return {
            _id: 'existing-tex-ultra-dedupe',
            providerMessageId: 'existing-provider-id',
            sentAt: new Date(paidAt)
        };
    };
    deps.p7.completeFn = async ({ providerMessageId, now }) => {
        completedProviderMessageId = providerMessageId;
        shipment.automation.usageNotifiedAt = now;
        shipment.automation.postSaleSafetyLedger.PRODUCT_USAGE = { state: 'SENT' };
        return { completed: true };
    };

    assert.equal(await notifyProductUsage(shipment, deps.p7), true);
    assert.equal(completedProviderMessageId, 'existing-provider-id');
    assert.equal(shipment.automation.usageNotifiedAt.toISOString(), paidAt);
    assert.deepEqual(trace, []);
});
