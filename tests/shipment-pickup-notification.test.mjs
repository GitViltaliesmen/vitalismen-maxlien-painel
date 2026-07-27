import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildReminderText,
    getDuePickupReminderStep,
    messageMatchesPickupNoticeKind,
    pickupHowToUseAudioForShipment,
    shipmentProductFamily
} from '../src/services/shipmentMessageService.js';

const agencyShipment = (overrides = {}) => ({
    productName: 'Nitrix Oxide Ecuador',
    logistics: {
        agencyPickup: true,
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

test('textos da agencia mantem os seis passos previstos', () => {
    const shipment = agencyShipment();
    assert.match(buildReminderText(shipment, 'day1'), /para retiro en agencia/i);
    assert.match(buildReminderText(shipment, 'soft_day2'), /foto del retiro/i);
    assert.equal(buildReminderText(shipment, 'day3'), '');
    assert.match(buildReminderText(shipment, 'soft_day4'), /Servientrega/i);
    assert.equal(buildReminderText(shipment, 'day5'), '');
    assert.match(buildReminderText(shipment, 'soft_day6'), /Ultimo aviso/i);
});

test('audio de uso respeita o produto e bloqueia fallback Vit Power', () => {
    assert.equal(shipmentProductFamily({ productName: 'Vit Power Ecuador' }), 'vit_power');
    assert.equal(shipmentProductFamily({ productName: 'NITRIX' }), 'nitrix');
    assert.equal(shipmentProductFamily({ productName: 'TEXULTRA 120 CAP ENERGIA' }), 'tex_ultra');
    assert.equal(pickupHowToUseAudioForShipment({ productName: 'Vit Power Ecuador' }), 'COMO_SE_TOMA_VIT_POWER');
    assert.equal(pickupHowToUseAudioForShipment({ productName: 'NITRIX' }), 'NITRIX_USO_OXIDE_EC');
    assert.equal(pickupHowToUseAudioForShipment({ productName: 'TEXULTRA 120 CAP ENERGIA' }), '');
});
