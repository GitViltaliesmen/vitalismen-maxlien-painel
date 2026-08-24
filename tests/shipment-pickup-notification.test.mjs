import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildRefillReminderText,
    buildReminderText,
    getDuePickupReminderStep,
    isPickupProofText,
    messageMatchesPickupNoticeKind,
    pickupBonusAntiSpamKey,
    pickupHowToUseAudioForShipment,
    pickupLogisticsAudioForShipment,
    pickupProofMediaAllowedForShipment,
    repurchaseProductPolicyForShipment,
    shouldBlockPickupReminderByHash,
    shipmentProductFamily
} from '../src/services/shipmentMessageService.js';
import { shipmentHistoryRepeatKey } from '../src/services/postSalePickupReconciliationPolicy.js';

const agencyShipment = (overrides = {}) => ({
    productName: 'Nitrix Oxide Ecuador',
    logistics: {
        agencyPickup: true,
        status: 'READY_FOR_PICKUP',
        pickupReadyVerified: true,
        trackingNumber: '188000001',
        ...overrides.logistics
    },
    automation: {
        readyForPickupNotifiedAt: new Date('2026-07-01T12:00:00.000Z'),
        ...overrides.automation
    },
    ...overrides
});

test('mensagem de guia ou transito nao comprova chegada nem lembretes', () => {
    const messages = [
        { body: 'Su pedido ya fue enviado por SERVIENTREGA. Guia: 188000001.' },
        { body: 'Su pedido ya aparece en ruta por SERVIENTREGA. Apenas este disponible en agencia, le aviso.' }
    ];
    for (const kind of ['ready_for_pickup', 'day1', 'soft_day2', 'day3', 'soft_day4', 'day5', 'soft_day6']) {
        assert.equal(messages.some((message) => messageMatchesPickupNoticeKind(message, kind)), false, kind);
    }
});

test('cada aviso reconhece somente sua propria evidencia', () => {
    const examples = {
        ready_for_pickup: '*PEDIDO LISTO PARA RETIRO*\nGuia: 188000001.',
        day1: 'Hola. Su pedido esta para retiro en agencia. Guia: 188000001.',
        soft_day2: 'Hola. Su pedido sigue para retiro en agencia. Guia: 188000001.\n\nSi ya retiro, envieme una foto del retiro.',
        day3: '[AUDIO] Chegou_02',
        soft_day4: 'Hola. Su pedido sigue para retiro en agencia. Puede acercarse a Servientrega.',
        day5: '[AUDIO] Chegou_03',
        soft_day6: 'Ultimo aviso. Su pedido sigue para retiro en agencia. Guia: 188000001.'
    };
    for (const [kind, body] of Object.entries(examples)) {
        assert.equal(messageMatchesPickupNoticeKind({ body }, kind), true, kind);
        for (const otherKind of Object.keys(examples).filter((value) => value !== kind)) {
            assert.equal(messageMatchesPickupNoticeKind({ body }, otherKind), false, `${kind} != ${otherKind}`);
        }
    }
});

test('cadencia retorna uma unica proxima etapa vencida por execucao', () => {
    const shipment = agencyShipment();
    assert.equal(
        getDuePickupReminderStep(shipment, new Date('2026-07-02T12:01:00.000Z')).kind,
        'day1'
    );
    shipment.automation.reminderDay1At = new Date('2026-07-02T12:01:00.000Z');
    assert.equal(
        getDuePickupReminderStep(shipment, new Date('2026-07-03T12:01:00.000Z')).kind,
        'soft_day2'
    );
    shipment.automation.reminderSoftDay2At = new Date('2026-07-03T12:01:00.000Z');
    assert.equal(
        getDuePickupReminderStep(shipment, new Date('2026-07-04T12:01:00.000Z')).kind,
        'day3'
    );
});

test('cadencia nunca seleciona shipment reservado ao operador manual', () => {
    const shipment = agencyShipment({ review: { manualOnly: true } });
    assert.equal(
        getDuePickupReminderStep(shipment, new Date('2026-07-03T12:01:00.000Z')),
        null
    );
});

test('historico anti-spam separa as etapas aprovadas de retirada', () => {
    const shipment = agencyShipment();
    const keys = ['day1', 'soft_day2', 'soft_day4', 'soft_day6']
        .map((kind) => shipmentHistoryRepeatKey(buildReminderText(shipment, kind)));
    assert.equal(new Set(keys).size, 4);
    assert.match(keys[0], /logistics_pickup_reminder:day1/);
    assert.match(keys[1], /logistics_pickup_reminder:soft_day2/);
    assert.match(keys[2], /logistics_pickup_reminder:soft_day4/);
    assert.match(keys[3], /logistics_pickup_reminder:soft_day6/);
});

test('textos da agencia mantem os seis passos previstos', () => {
    const shipment = agencyShipment();
    assert.match(buildReminderText(shipment, 'day1'), /continúa disponible en Servientrega/i);
    assert.match(buildReminderText(shipment, 'soft_day2'), /foto del retiro/i);
    assert.equal(buildReminderText(shipment, 'day3'), '');
    assert.match(buildReminderText(shipment, 'soft_day4'), /Servientrega/i);
    assert.equal(buildReminderText(shipment, 'day5'), '');
    assert.match(buildReminderText(shipment, 'soft_day6'), /plazo de devolución/i);
});

test('audio de uso respeita o produto e bloqueia fallback Vit Power', () => {
    assert.equal(shipmentProductFamily({ productName: 'Vit Power Ecuador' }), 'vit_power');
    assert.equal(shipmentProductFamily({ productName: 'NITRIX' }), 'nitrix');
    assert.equal(shipmentProductFamily({ productName: 'TEXULTRA 120 CAP ENERGIA' }), 'tex_ultra');
    assert.equal(pickupHowToUseAudioForShipment({ productName: 'Vit Power Ecuador' }), 'COMO_SE_TOMA_VIT_POWER');
    assert.equal(pickupHowToUseAudioForShipment({ productName: 'NITRIX' }), 'NITRIX_USO_OXIDE_EC');
    assert.equal(pickupHowToUseAudioForShipment({ productName: 'TEXULTRA 120 CAP ENERGIA' }), 'MODO_DE_USO_TEX_ULTRA');
});

test('recompra usa somente texto, memoria e audio do produto do shipment', () => {
    const vit = agencyShipment({ productName: 'Vit Power Ecuador' });
    const nitrix = agencyShipment({ productName: 'Nitrix Oxide Ecuador' });
    const tex = agencyShipment({ productName: 'TEXULTRA 120 CAP ENERGIA' });

    assert.equal(repurchaseProductPolicyForShipment(vit).audioName, 'TEMPO_RESULTADO_VIT_POWER');
    assert.equal(repurchaseProductPolicyForShipment(vit).allowSharedProof, true);
    assert.equal(repurchaseProductPolicyForShipment(nitrix).audioName, 'NITRIX_USO_OXIDE_EC');
    assert.equal(repurchaseProductPolicyForShipment(nitrix).allowSharedProof, false);
    assert.equal(repurchaseProductPolicyForShipment(tex).audioName, 'MODO_DE_USO_TEX_ULTRA');
    assert.equal(repurchaseProductPolicyForShipment(tex).allowSharedProof, false);

    assert.match(buildRefillReminderText(vit), /Vit Power/);
    assert.doesNotMatch(buildRefillReminderText(vit), /Nitrix|Tex Ultra/);
    assert.match(buildRefillReminderText(nitrix), /Nitrix Oxide/);
    assert.doesNotMatch(buildRefillReminderText(nitrix), /Vit Power|Tex Ultra/);
    assert.match(buildRefillReminderText(tex), /Tex Ultra/);
    assert.doesNotMatch(buildRefillReminderText(tex), /Vit Power|Nitrix/);
});

test('audios logisticos de retirada sao universais para os tres produtos', () => {
    const products = [
        { productName: 'Nitrix Oxide Ecuador' },
        { productName: 'TEXULTRA 120 CAP ENERGIA' },
        { productName: 'Vit Power Ecuador' }
    ];
    for (const shipment of products) {
        assert.deepEqual(pickupLogisticsAudioForShipment(shipment, 'ready_for_pickup'), ['Chegou_01']);
        assert.deepEqual(pickupLogisticsAudioForShipment(shipment, 'day3'), ['Chegou_02']);
        assert.deepEqual(pickupLogisticsAudioForShipment(shipment, 'day5'), ['Chegou_03']);
    }
});

test('midia so comprova retirada depois de pedido explicito de comprovante', () => {
    const requestedAt = new Date('2026-07-03T12:00:00.000Z');
    const shipment = { automation: { pickupProofRequestedAt: requestedAt } };
    assert.equal(
        pickupProofMediaAllowedForShipment(shipment, { createdAt: new Date('2026-07-03T12:01:00.000Z') }),
        true
    );
    assert.equal(
        pickupProofMediaAllowedForShipment(shipment, { createdAt: new Date('2026-07-03T11:59:00.000Z') }),
        false
    );
    assert.equal(
        pickupProofMediaAllowedForShipment({ automation: {} }, { createdAt: new Date('2026-07-03T12:01:00.000Z') }),
        false
    );
});

test('confirmacao textual acabo de retirar libera comprovante', () => {
    assert.equal(
        isPickupProofText('Acabo de retirar también éste producto en Servientrega servicio contra entrega'),
        true
    );
    assert.equal(isPickupProofText('Pues enviame el nombre de producto'), false);
});

test('bonus de retirada possui chave semantica propria e estavel por pedido', () => {
    const shipment = agencyShipment({ orderId: 'EC-TESTE-BONUS-01' });
    const retry = agencyShipment({ orderId: 'EC-TESTE-BONUS-01' });
    const anotherOrder = agencyShipment({ orderId: 'EC-TESTE-BONUS-02' });

    assert.equal(
        pickupBonusAntiSpamKey(shipment),
        'shipment_status:pickup_bonus:EC-TESTE-BONUS-01'
    );
    assert.equal(pickupBonusAntiSpamKey(retry), pickupBonusAntiSpamKey(shipment));
    assert.notEqual(pickupBonusAntiSpamKey(anotherOrder), pickupBonusAntiSpamKey(shipment));
    assert.notEqual(pickupBonusAntiSpamKey(shipment), 'shipment_status');
});

test('hash antigo sem campo confirmado nao bloqueia lembrete diario', () => {
    const hash = 'hash-dia-1';
    const shipment = {
        automation: {
            sentMessageHashes: [hash],
            reminderDay1At: null
        }
    };

    assert.equal(shouldBlockPickupReminderByHash(shipment, 'day1', hash), false);

    shipment.automation.reminderDay1At = new Date('2026-07-02T12:00:00.000Z');
    assert.equal(shouldBlockPickupReminderByHash(shipment, 'day1', hash), true);
});
