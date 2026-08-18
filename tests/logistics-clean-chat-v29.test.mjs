import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import {
    LOGISTICS_STATE_V29,
    buildEarlyPickupCorrectionV29,
    buildNotificationLedgerEntryV29,
    buildPickupReminderV29,
    buildReadyForPickupCommunicationV29,
    buildShippedCommunicationV29,
    canonicalLogisticsState,
    containsPickupAuthorizationLanguage,
    evaluateLogisticsOutbound,
    logisticsCommunicationPolicy
} from '../src/services/logisticsCommunicationV29.js';

const sandbox = {};
sandbox.globalThis = sandbox;
vm.runInNewContext(fs.readFileSync('public/panel-intelligence/clean-chat-v29.js', 'utf8'), sandbox);
const cleanChat = sandbox.VitalismenCleanChatV29;

const outbound = (overrides = {}) => ({
    _id: 'manual-1',
    isFromMe: true,
    senderRole: 'human',
    body: 'Hola Xavier',
    timestamp: 1_776_000_000,
    ...overrides
});

const shipment = (status, verified = false) => ({
    orderId: 'EC-SYNTHETIC-V29',
    client: { name: 'Xavier Chamba', phone: '593999000111' },
    logistics: {
        status,
        trackingNumber: '1851574972',
        agencyPickup: true,
        pickupReadyVerified: verified
    },
    outcomes: { delivered: false, pickedUp: false, returned: false }
});

test('V29 optimistic + provider echo resulta em uma bolha', () => {
    const clientGeneratedId = 'client-123';
    const result = cleanChat.presentMessages([
        outbound({ _id: 'local-1', clientGeneratedId, deliveryStatus: 'sending' }),
        outbound({ _id: 'zapi_out_provider-1', clientGeneratedId, providerMessageId: 'provider-1', deliveryStatus: 'sent' })
    ]);
    assert.equal(result.visible.length, 1);
    assert.equal(result.visible[0].providerMessageId, 'provider-1');
});

test('V29 mesmo provider_message_id resulta em uma bolha e preserva aliases', () => {
    const result = cleanChat.presentMessages([
        outbound({ _id: 'mirror-1', providerMessageId: 'same-provider', isBot: true, senderRole: 'bot' }),
        outbound({ _id: 'manual-2', providerMessageId: 'same-provider', attendantId: 'ana_lopez' })
    ]);
    assert.equal(result.visible.length, 1);
    assert.equal(result.duplicatesCollapsed, 1);
    assert.equal(result.visible[0].presentationAliases.length, 2);
});

test('V29 server/delivery/read atualiza a mesma bolha', () => {
    const result = cleanChat.presentMessages([
        outbound({ _id: 'one', providerMessageId: 'p-read', deliveryStatus: 'sent', ack: 1 }),
        outbound({ _id: 'two', providerMessageId: 'p-read', deliveryStatus: 'delivered', ack: 2 }),
        outbound({ _id: 'three', providerMessageId: 'p-read', deliveryStatus: 'read', ack: 3, readAt: '2026-08-18T12:00:00Z' })
    ]);
    assert.equal(result.visible.length, 1);
    assert.equal(result.visible[0].deliveryStatus, 'read');
    assert.equal(result.visible[0].ack, 3);
    assert.ok(result.visible[0].readAt);
});

test('V29 system event sai do chat principal sem apagar auditoria', () => {
    const result = cleanChat.presentMessages([
        { _id: 'sys', senderRole: 'system', type: 'system', body: 'SYNC: persisted', timestamp: 1 },
        { _id: 'client', isFromMe: false, body: 'Hola', timestamp: 2 }
    ]);
    assert.equal(result.visible.length, 1);
    assert.equal(result.technical.length, 1);
});

test('V29 não deduplica textos legítimos iguais com IDs/horários diferentes', () => {
    const result = cleanChat.presentMessages([
        outbound({ _id: 'real-1', timestamp: 100, body: 'Gracias' }),
        outbound({ _id: 'real-2', timestamp: 200, body: 'Gracias' })
    ]);
    assert.equal(result.visible.length, 2);
});

test('V29 unifica áudio, imagem e PDF por provider id', () => {
    for (const type of ['audio', 'image', 'document']) {
        const result = cleanChat.presentMessages([
            outbound({ _id: `${type}-a`, type, providerMessageId: `${type}-provider`, mediaUrl: `/media/${type}` }),
            outbound({ _id: `${type}-b`, type, providerMessageId: `${type}-provider`, deliveryStatus: 'delivered' })
        ]);
        assert.equal(result.visible.length, 1, type);
    }
});

test('V29 avatar do cliente usa foto válida ou fallback imediato', () => {
    assert.equal(cleanChat.avatarDescriptor({ role: 'client', name: 'Xavier Chamba', avatar: 'https://example.test/x.jpg' }).avatar, 'https://example.test/x.jpg');
    assert.equal(cleanChat.avatarDescriptor({ role: 'client', name: 'Xavier Chamba' }).initials, 'XC');
    assert.equal(cleanChat.avatarDescriptor({ role: 'client', name: 'Miguel Arellano Peralta' }).initials, 'MA');
    assert.equal(cleanChat.avatarDescriptor({ role: 'client', name: '551234', avatar: 'javascript:bad' }).avatar, '');
    for (const reason of ['expired', '404', '403', 'invalid']) {
        const avatar = cleanChat.avatarDescriptor({ role: 'client', name: '', avatar: `https://example.test/${reason}.jpg`, imageFailed: true });
        assert.equal(avatar.avatar, '', reason);
        assert.equal(avatar.initials, 'C', reason);
    }
});

test('V29 avatar distingue atendente configurada, desconhecida, bot e system', () => {
    assert.equal(cleanChat.avatarDescriptor({ role: 'human', attendantId: 'ana_lopez' }).initials, 'AL');
    assert.equal(cleanChat.avatarDescriptor({ role: 'human', attendantId: 'maria-2', name: 'María Torres' }).initials, 'MT');
    assert.equal(cleanChat.avatarDescriptor({ role: 'human', attendantId: 'ana_lopez', imageFailed: true }).avatar, '');
    assert.equal(cleanChat.avatarDescriptor({ role: 'bot' }).initials, 'BT');
    assert.equal(cleanChat.avatarDescriptor({ role: 'system' }).initials, 'SYS');
});

test('V29 mapeia estados logísticos sem inferir READY por agência/tempo', () => {
    assert.equal(canonicalLogisticsState(shipment('GUIA_GENERADA')), LOGISTICS_STATE_V29.SHIPPED);
    assert.equal(canonicalLogisticsState(shipment('INGRESANDO EN AGENCIA')), LOGISTICS_STATE_V29.IN_TRANSIT);
    assert.equal(canonicalLogisticsState(shipment('READY_FOR_PICKUP')), LOGISTICS_STATE_V29.READY_FOR_PICKUP);
    assert.equal(canonicalLogisticsState(shipment('algo desconhecido')), LOGISTICS_STATE_V29.UNKNOWN);
});

test('V29 SHIPPED permite número e bloqueia imagem, linguagem e áudio de retirada', () => {
    const current = shipment('GUIA_GENERADA');
    const policy = logisticsCommunicationPolicy(current);
    assert.equal(policy.allowGuideNumber, true);
    assert.equal(policy.allowGuideImage, false);
    assert.equal(policy.allowPickupLanguage, false);
    assert.equal(policy.allowPickupAudio, false);
    assert.equal(evaluateLogisticsOutbound(current, { mediaKind: 'image', fileName: 'guia.png' }).allowed, false);
    assert.equal(evaluateLogisticsOutbound(current, { text: 'Ya puede retirar su pedido.' }).allowed, false);
    assert.equal(evaluateLogisticsOutbound(current, { pickupAudio: true }).allowed, false);
});

test('V29 READY não verificado bloqueia e READY verificado permite retirada/guia', () => {
    assert.equal(logisticsCommunicationPolicy(shipment('READY_FOR_PICKUP', false)).allowPickupLanguage, false);
    const ready = logisticsCommunicationPolicy(shipment('READY_FOR_PICKUP', true));
    assert.equal(ready.allowPickupLanguage, true);
    assert.equal(ready.allowGuideImage, true);
    assert.equal(ready.allowGuidePdf, true);
});

test('V29 estados finais bloqueiam reminders', () => {
    assert.equal(logisticsCommunicationPolicy(shipment('PICKED_UP', true)).allowReminders, false);
    assert.equal(logisticsCommunicationPolicy(shipment('ENTREGADO', true)).allowReminders, false);
    assert.equal(logisticsCommunicationPolicy(shipment('DEVUELTO', true)).allowReminders, false);
});

test('V29 caso Xavier: NO VAYA antes; YA PUEDE IR somente após READY verificado', () => {
    const sent = shipment('GUIA_GENERADA');
    const sentText = buildShippedCommunicationV29(sent);
    assert.match(sentText, /no vaya todavía/i);
    assert.equal(evaluateLogisticsOutbound(sent, { mediaKind: 'image', fileName: 'guia-1851574972.png' }).allowed, false);
    assert.equal(evaluateLogisticsOutbound(sent, { pickupAudio: true }).allowed, false);

    const ready = shipment('READY_FOR_PICKUP', true);
    const readyText = buildReadyForPickupCommunicationV29(ready);
    assert.match(readyText, /Puede acercarse a la agencia desde ahora/i);
    assert.equal(evaluateLogisticsOutbound(ready, { mediaKind: 'image', fileName: 'guia-1851574972.png' }).allowed, true);
});

test('V29 inclui correção rápida, reminders e ledger auditável', () => {
    const ready = shipment('READY_FOR_PICKUP', true);
    assert.match(buildEarlyPickupCorrectionV29(ready), /No necesita volver todavía/i);
    assert.match(buildPickupReminderV29(ready, 1), /retirarlo hoy/i);
    assert.match(buildPickupReminderV29(ready, 2), /plazo de devolución/i);
    const ledger = buildNotificationLedgerEntryV29({ shipment: ready, notificationType: 'ready_for_pickup', mode: 'manual' });
    assert.equal(ledger.pickup_ready_verified, true);
    assert.equal(ledger.logistics_status, 'READY_FOR_PICKUP');
    assert.equal(ledger.mode, 'manual');
    assert.ok(ledger.notification_id);
});

test('V29 reconhece semanticamente linguagem antecipada proibida', () => {
    for (const phrase of ['Ya puede retirar', 'Puede acercarse', 'Vaya a la agencia', 'Está listo para retiro', 'Puede recoger', 'Su pedido está disponible']) {
        assert.equal(containsPickupAuthorizationLanguage(phrase), true, phrase);
        assert.equal(cleanChat.containsPickupAuthorizationLanguage(phrase), true, `painel: ${phrase}`);
    }
});
