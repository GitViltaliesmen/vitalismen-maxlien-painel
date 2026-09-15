import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
    classifyEcuadorCommercialDecisionV161,
    EC_NEGATIVE_INTENT_V161_DECISIONS,
    EC_NEGATIVE_INTENT_V161_POLICY,
    handleEcuadorNegativeOrBuyLaterV161,
    inferBuyLaterDesiredDateV161
} from '../src/services/ecNegativeIntentBuyLaterV161Service.js';
import {
    __principalSdrContextAudit,
    __process8NegativeIntentAudit
} from '../src/services/conversationEngine.js';

const fixedNow = new Date('2026-09-15T01:00:00.000Z');
const read = relative => fs.readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');

const queryModel = value => ({
    findOne() {
        return Promise.resolve(value);
    }
});

const fixtureState = () => ({
    _id: 'contact-v161',
    phoneDigits: '593999000161',
    countryCode: 'EC',
    human: { mode: 'auto' },
    metadata: {
        customerDraft: {
            name: 'Cliente Fixture',
            phone: '593999000161',
            productKey: 'vit_power_ec',
            status: 'atendendo'
        },
        perAgentMemory: {
            vit_power_ec: {
                selectedQuantity: 3,
                pendingCheckoutOrder: {
                    quantity: 3,
                    total: 95.99,
                    stage: 'awaiting_delivery_mode'
                }
            }
        }
    }
});

const harness = ({ order = null, shipment = null } = {}) => {
    const updates = [];
    const messages = [];
    const texts = [];
    const admin = [];
    return {
        updates,
        messages,
        texts,
        admin,
        deps: {
            contactStateModel: {
                async updateOne(filter, update) {
                    updates.push({ filter, update });
                    return { acknowledged: true, modifiedCount: 1 };
                }
            },
            messageModel: {
                async create(payload) {
                    messages.push(payload);
                    return payload;
                }
            },
            orderModel: queryModel(order),
            shipmentModel: queryModel(shipment),
            async sendTextFn(_chatId, body) {
                texts.push(body);
                return { ok: true, providerMessageId: 'fixture-only' };
            },
            syncAdminFn(draft, options) {
                admin.push({ draft, options });
                return { ok: true, mode: 'fixture' };
            }
        }
    };
};

test('Processo 8 classifica desistencias antes de palavras positivas embutidas', () => {
    const hardCancellation = [
        'No deseo el pedido',
        'No quiero el pedido',
        'Ya no quiero',
        'Cancelar por favor',
        'Gasté el dinero en medicamentos, no deseo el pedido'
    ];
    for (const text of hardCancellation) {
        assert.equal(classifyEcuadorCommercialDecisionV161(text, { now: fixedNow }).decision, EC_NEGATIVE_INTENT_V161_DECISIONS.CANCEL, text);
    }
});

test('Processo 8 classifica deferimento e faz futuro prevalecer em mensagem mista', () => {
    const buyLater = [
        'No por ahora',
        'Tal vez para el próximo mes',
        'No puedo ahora, quizá el próximo mes',
        'Cuando cobre le escribo',
        'Más tarde compro'
    ];
    for (const text of buyLater) {
        assert.equal(classifyEcuadorCommercialDecisionV161(text, { now: fixedNow }).decision, EC_NEGATIVE_INTENT_V161_DECISIONS.BUY_LATER, text);
    }
    const mixed = classifyEcuadorCommercialDecisionV161('No deseo el pedido porque gasté en medicamentos. Tal vez para el próximo mes.', { now: fixedNow });
    assert.equal(mixed.decision, EC_NEGATIVE_INTENT_V161_DECISIONS.BUY_LATER);
    assert.equal(mixed.mixedCancellation, true);
    assert.equal(mixed.desiredOrderDate, '2026-10-05');
});

test('Processo 8 preserva controles positivos do funil', () => {
    for (const text of ['Deseo 3 frascos', 'Quiero comprar 3', 'Sí, envíelo', 'Prefiero agencia Servientrega']) {
        assert.equal(classifyEcuadorCommercialDecisionV161(text, { now: fixedNow }).decision, EC_NEGATIVE_INTENT_V161_DECISIONS.POSITIVE, text);
    }
    assert.equal(__principalSdrContextAudit.inferIntent('No deseo el pedido'), 'purchase_cancelled');
    assert.equal(__principalSdrContextAudit.inferIntent('Más tarde compro'), 'buy_later');
    assert.equal(__principalSdrContextAudit.detectPurchaseReadiness('No quiero el pedido'), 'unknown');
    assert.equal(__principalSdrContextAudit.detectPurchaseReadiness('No por ahora'), 'buy_later');
});

test('Processo 8 não automatiza os agentes manuais Tex Ultra e Nitrix', async () => {
    for (const key of ['tex_ultra_ec', 'nitrix_ec']) {
        const state = fixtureState();
        const h = harness();
        const result = await handleEcuadorNegativeOrBuyLaterV161({
            text: 'No deseo el pedido',
            chatId: '593999000161@c.us',
            peerPhone: '593999000161',
            contactStateId: state._id,
            contactState: state,
            agentProfile: { key },
            now: fixedNow,
            ...h.deps
        });
        assert.equal(result.handled, false, key);
        assert.equal(result.decision, 'out_of_scope', key);
        assert.equal(h.updates.length, 0, key);
        assert.equal(h.texts.length, 0, key);
    }
});

test('Processo 8 usa somente datas inferiveis no contrato Comprar depois', () => {
    assert.equal(inferBuyLaterDesiredDateV161({ timing: 'proximo mes', now: fixedNow }), '2026-10-05');
    assert.equal(inferBuyLaterDesiredDateV161({ timing: 'fin de mes', now: fixedNow }), '2026-09-30');
    assert.equal(inferBuyLaterDesiredDateV161({ timing: 'quincena', now: fixedNow }), '2026-09-15');
    assert.equal(inferBuyLaterDesiredDateV161({ timing: 'cuando cobre', now: fixedNow }), '');
    assert.equal(inferBuyLaterDesiredDateV161({ timing: 'mas tarde', now: fixedNow }), '');
});

test('sem Order/Shipment, desistência encerra checkout e usa cancelado canônico', async () => {
    const state = fixtureState();
    const h = harness();
    const result = await handleEcuadorNegativeOrBuyLaterV161({
        text: 'No deseo el pedido',
        chatId: '593999000161@c.us',
        peerPhone: '593999000161',
        contactStateId: state._id,
        contactState: state,
        agentProfile: { key: 'vit_power_ec' },
        now: fixedNow,
        ...h.deps
    });
    assert.equal(result.handled, true);
    assert.equal(result.status, 'cancelado');
    assert.equal(result.automaticExternalCancellation, false);
    assert.equal(h.updates.length, 1);
    assert.equal(h.updates[0].update.$set['metadata.customerDraft'].status, 'cancelado');
    assert.equal(h.updates[0].update.$set['human.mode'], 'manual');
    assert.equal(h.updates[0].update.$unset['metadata.perAgentMemory.vit_power_ec.pendingCheckoutOrder'], '');
    assert.equal(h.updates[0].update.$unset['metadata.perAgentMemory.vit_power_ec.selectedQuantity'], '');
    assert.equal(h.admin.length, 1);
    assert.equal(h.admin[0].options.adminStatus, 'cancelado');
    assert.deepEqual(h.texts, ['Entiendo, señor. No continuaré con este pedido.']);
    assert.equal(h.messages.length, 1);
});

test('sem Order/Shipment, Comprar depois persiste V24 e não continua checkout', async () => {
    const state = fixtureState();
    const h = harness();
    const result = await handleEcuadorNegativeOrBuyLaterV161({
        text: 'No deseo el pedido. Tal vez para el próximo mes.',
        chatId: '593999000161@c.us',
        peerPhone: '593999000161',
        contactStateId: state._id,
        contactState: state,
        agentProfile: { key: 'vit_power_ec' },
        now: fixedNow,
        ...h.deps
    });
    assert.equal(result.status, 'comprar_depois');
    assert.equal(result.mixedCancellation, true);
    assert.equal(result.desiredOrderDate, '2026-10-05');
    const update = h.updates[0].update;
    assert.equal(update.$set['metadata.customerDraft'].status, 'comprar_depois');
    assert.equal(update.$set.buyLaterReminder.active, true);
    assert.equal(update.$set.buyLaterReminder.desiredOrderDate, '2026-10-05');
    assert.equal(update.$unset['metadata.perAgentMemory.vit_power_ec.pendingCheckoutOrder'], '');
    assert.equal(update.$unset['metadata.perAgentMemory.vit_power_ec.selectedQuantity'], '');
    assert.equal(h.admin[0].options.adminStatus, 'comprar_depois');
    assert.doesNotMatch(h.texts[0], /domicilio|agencia|nombre|cuantos|frascos/i);
});

test('timing vago pergunta somente quando contatar e não arma scheduler', async () => {
    const state = fixtureState();
    const h = harness();
    const result = await handleEcuadorNegativeOrBuyLaterV161({
        text: 'Cuando cobre le escribo',
        chatId: '593999000161@c.us',
        peerPhone: '593999000161',
        contactStateId: state._id,
        contactState: state,
        agentProfile: { key: 'vit_power_ec' },
        now: fixedNow,
        ...h.deps
    });
    assert.equal(result.desiredOrderDate, '');
    assert.equal(h.updates[0].update.$set.buyLaterReminder.active, false);
    assert.deepEqual(h.texts, ['Claro, señor 😊\n¿Qué día desea que le escribamos nuevamente?']);
    assert.doesNotMatch(h.texts[0], /domicilio|agencia|nombre|cuantos|frascos/i);
});

test('Order existente bloqueia cancelamento externo e entrega somente ao humano', async () => {
    for (const status of ['confirmed', 'processing', 'shipped', 'delivered', 'returned']) {
        const state = fixtureState();
        const h = harness({ order: { orderId: `EC-FIXTURE-161-${status}`, status } });
        const result = await handleEcuadorNegativeOrBuyLaterV161({
            text: 'Cancelar por favor',
            chatId: '593999000161@c.us',
            peerPhone: '593999000161',
            contactStateId: state._id,
            contactState: state,
            agentProfile: { key: 'vit_power_ec' },
            now: fixedNow,
            ...h.deps
        });
        assert.equal(result.handoffToHuman, true, status);
        assert.equal(result.existingOrderProtected, true, status);
        assert.equal(result.automaticExternalCancellation, false, status);
        assert.equal(h.updates[0].update.$set['human.mode'], 'manual', status);
        assert.equal(h.admin.length, 0, status);
        assert.equal(h.texts.length, 0, status);
        assert.equal(h.messages.length, 0, status);
    }
});

test('Shipment existente também impede mutação automática', async () => {
    const state = fixtureState();
    const h = harness({ shipment: { orderId: 'EC-FIXTURE-SHIPMENT-161', logistics: { canonicalStatus: 'IN_TRANSIT' } } });
    const result = await handleEcuadorNegativeOrBuyLaterV161({
        text: 'No quiero el pedido',
        chatId: '593999000161@c.us',
        peerPhone: '593999000161',
        contactStateId: state._id,
        contactState: state,
        agentProfile: { key: 'vit_power_ec' },
        now: fixedNow,
        ...h.deps
    });
    assert.equal(result.handoffToHuman, true);
    assert.equal(result.existingShipmentProtected, true);
    assert.equal(h.admin.length, 0);
    assert.equal(h.texts.length, 0);
});

test('fallback rígido e pending checkout falham fechados para decisão negativa', async () => {
    const strict = __process8NegativeIntentAudit.strictVitalismenFallbackText({
        text: 'No deseo el pedido',
        pendingCheckoutStage: 'awaiting_delivery_mode',
        pendingCheckoutOrder: { quantity: 3 },
        agentMemorySnapshot: { selectedQuantity: 3 }
    });
    assert.equal(strict, '');
    const handled = await __process8NegativeIntentAudit.maybeHandlePendingCheckoutFallback({
        text: 'Tal vez para el próximo mes',
        chatId: 'fixture@c.us',
        agentProfile: { key: 'vit_power_ec' },
        contactStateId: 'fixture',
        peerPhone: '593999000161',
        pendingCheckoutOrder: { quantity: 3 },
        pendingCheckoutStage: 'awaiting_delivery_mode',
        checkoutOrderData: null
    });
    assert.equal(handled, true);
});

test('integração roda antes de compra, quantidade, pending checkout e strict fallback', () => {
    const source = read('src/services/conversationEngine.js');
    const handlerStart = source.indexOf('export const handleAgentConversation');
    const integration = source.indexOf('handleEcuadorNegativeOrBuyLaterV161({', handlerStart);
    for (const marker of [
        'maybeHandleEcuadorDirectProductInquiry({',
        'updateOrderConversationMemory({',
        'const selectedQuantityFromPrice =',
        'const pendingFallbackHandled =',
        'replyText = strictVitalismenFallbackText({'
    ]) {
        assert.ok(integration > handlerStart && integration < source.indexOf(marker, handlerStart), marker);
    }
});

test('política Processo 8 mantém todos os efeitos externos proibidos em zero', () => {
    assert.deepEqual(EC_NEGATIVE_INTENT_V161_POLICY.protectedOrderStatuses, ['confirmed', 'processing', 'shipped', 'delivered', 'returned']);
    assert.equal(EC_NEGATIVE_INTENT_V161_POLICY.automaticExternalCancellation, false);
    assert.equal(EC_NEGATIVE_INTENT_V161_POLICY.anyPersistedOrderFailsClosed, true);
    assert.equal(EC_NEGATIVE_INTENT_V161_POLICY.createsOrder, false);
    assert.equal(EC_NEGATIVE_INTENT_V161_POLICY.createsShipment, false);
    assert.equal(EC_NEGATIVE_INTENT_V161_POLICY.callsDropi, false);
    assert.equal(EC_NEGATIVE_INTENT_V161_POLICY.callsMeta, false);
    assert.equal(EC_NEGATIVE_INTENT_V161_POLICY.enablesBuyLaterScheduler, false);
    const service = read('src/services/ecNegativeIntentBuyLaterV161Service.js');
    assert.doesNotMatch(service, /\.save\(|new Order|new Shipment|sendPurchaseEvent|droppiEcuador|dropi.*apply/i);
    assert.match(read('src/services/schedulerService.js'), /flagEnabled\('ADMIN_BUY_LATER_FOLLOWUP_ENABLED', false\)/);
});
