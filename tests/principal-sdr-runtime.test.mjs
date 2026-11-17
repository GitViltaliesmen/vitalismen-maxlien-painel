import test from 'node:test';
import assert from 'node:assert/strict';
import { createPrincipalSdrRuntime } from '../src/services/principalSdrFreeflowRuntimeService.js';
const NOW = new Date('2026-11-15T01:00:00Z');
const speak = content => ({ role: 'assistant', content });
const call = (name, args = {}) => ({ role: 'assistant', content: null, tool_calls: [{ id: 'fixture_call_1', type: 'function', function: { name, arguments: JSON.stringify(args) } }] });
const full = { name: 'Persona Sintetica', quantity: 3, city: 'Quito', province: 'Pichincha', deliveryMode: 'home', address: 'Direccion sintetica 123' };
const readPath = (value, key) => key.split('.').reduce((part, name) => part?.[name], value);
const setPath = (value, key, item) => { const keys = key.split('.'); const last = keys.pop(); let node = value; for (const name of keys) node = node[name] ||= {}; node[last] = structuredClone(item); };
function fixture({ phone = '593999000001', draft = {}, activeOrder = null, qaReady = false, registeredPhone = phone } = {}) {
    const state = { _id: 'fixture_contact', phoneDigits: phone, chatId: phone + '@s.whatsapp.net', human: { mode: 'auto' },
        metadata: { vslProductKey: 'vit_power_ec', vslSourceUrl: 'https://taviazen.shop/vitpower_2026g', perAgentMemory: { vit_power_ec: { principalSdrFreeflow: { draft } } } } };
    const queries = [], writes = [], sends = [], handoffs = [], orderCalls = [], ledger = new Map(), messages = [];
    const scripted = []; let actualOrder = null; let sequence = 0; let sendFailure = false;
    const query = value => ({ select() { return this; }, limit() { return this; }, async lean() { return structuredClone(value); } });
    const matches = (object, filter) => Object.entries(filter).every(([key, expected]) => {
        const value = readPath(object, key);
        return expected?.$in ? expected.$in.includes(value) : expected?.$gt ? new Date(value) > expected.$gt : expected && Object.hasOwn(expected, '$ne') ? value !== expected.$ne : value === expected;
    });
    const ContactState = {
        findOne(filter) { queries.push({ model: 'ContactState', filter: structuredClone(filter) }); return query(matches(state, filter) ? state : null); },
        async updateOne(filter, update) { queries.push({ model: 'ContactState.updateOne', filter: structuredClone(filter) }); if (!matches(state, filter)) return { matchedCount: 0 }; writes.push(structuredClone(update)); for (const [key, value] of Object.entries(update.$set || {})) setPath(state, key, value); return { matchedCount: 1, modifiedCount: 1 }; }
    };
    const Message = {
        find(filter) { queries.push({ model: 'Message.find', filter: structuredClone(filter) }); return query(messages.filter(row => !row.isFromMe && row.peerPhone === filter.peerPhone && row.sessionId === filter.sessionId && row.provider === filter.provider && filter.$or.some(part => part._id === row._id || part.providerMessageId === row.providerMessageId))); },
        findOne(filter) { queries.push({ model: 'Message.findOne', filter: structuredClone(filter) }); return query(messages.find(row => matches(row, filter)) || null); }
    };
    const Order = { findOne(filter) { queries.push({ model: 'Order', filter: structuredClone(filter) }); return query(filter.status?.$in ? activeOrder : actualOrder && matches(actualOrder, filter) ? actualOrder : null); } };
    const OutboundDedupe = {
        async create(value) { if (ledger.has(value.key)) throw Object.assign(new Error('duplicate'), { code: 11000 }); ledger.set(value.key, structuredClone(value)); },
        async updateOne(filter, update) { const row = ledger.get(filter.key); if (!row || filter.status && row.status !== filter.status) return { matchedCount: 0 }; Object.assign(row, update.$set); return { matchedCount: 1 }; }
    };
    const runtime = createPrincipalSdrRuntime({ ContactState, Message, Order, OutboundDedupe, products: [{ key: 'vit_power_ec', name: 'Vit Power Ecuador' }], now: () => NOW,
        qaReady: () => qaReady,
        getOffer: ({ quantity }) => ({ productKey: 'vit_power_ec', quantity, total: 95.99 }),
        resolveData: ({ draft }) => ({ draft, resolution: { orderDataReady: Object.keys(full).every(key => draft[key]), blockedReasons: ['address'] } }),
        complete: async request => { const next = scripted.shift(); if (typeof next === 'function') return next(request); return next; },
        sendReply: async args => {
            sends.push(args); if (sendFailure) return { ok: false, ambiguous: true };
            const id = 'FIXTURE_PROVIDER_' + (++sequence);
            messages.push({ _id: id, providerMessageId: id, peerPhone: phone, sessionId: 'fixture_session', provider: 'zapi', isFromMe: true, isBot: true, body: args.text, ack: 2, createdAt: new Date(NOW.getTime() - 1000) });
            return { ok: true, provider: 'zapi', providerMessageId: id };
        },
        transferHuman: async args => { handoffs.push(args); state.human = { mode: 'manual', note: 'fixture_handoff' }; return { ok: true, persisted: true }; },
        registerExistingOrder: async args => { orderCalls.push(args); actualOrder = { orderId: 'FIXTURE_REAL_PORT_RECEIPT', country: 'EC', customer: { phone: registeredPhone }, status: 'confirmed', total: args.offer.total, package: { quantity: args.offer.quantity } }; return { ok: true, persisted: true, orderId: actualOrder.orderId, alreadyNotified: true }; }
    });
    const send = async (body, id = 'fixture_inbound_' + (++sequence)) => {
        state.metadata.processingLock = { messageId: id, expiresAt: new Date(NOW.getTime() + 180000) };
        messages.push({ _id: id, providerMessageId: id, peerPhone: phone, sessionId: 'fixture_session', provider: 'zapi', isFromMe: false, body, createdAt: NOW });
        return runtime.handle({ message: { id, body, sessionId: 'fixture_session' }, contactStateId: state._id, phone, productKey: 'vit_power_ec' });
    };
    return { runtime, state, scripted, sends, handoffs, orderCalls, ledger, messages, queries, writes, send, failSend: () => { sendFailure = true; } };
}
test('runtime uses exact contact/session/inbound and preserves VSL origin', async () => {
    const f = fixture(); f.scripted.push(speak('Hola, que desea saber?')); const r = await f.send('Hola');
    assert.equal(r.deliveredToProvider, true); assert.equal(f.sends.length, 1); assert.equal(f.state.metadata.vslProductKey, 'vit_power_ec');
    assert.equal(f.state.metadata.perAgentMemory.vit_power_ec.principalSdrFreeflow.history.length, 2);
    assert.equal(f.queries.some(q => JSON.stringify(q.filter).includes('$regex')), false);
});
test('same real inbound is never sent twice across runtime calls', async () => {
    const f = fixture(); f.scripted.push(speak('Le ayudo.')); await f.send('Hola', 'fixture_duplicate_1');
    const r = await f.runtime.handle({ message: { id: 'fixture_duplicate_1', body: 'Hola', sessionId: 'fixture_session' }, contactStateId: f.state._id, phone: f.state.phoneDigits, productKey: 'vit_power_ec' });
    assert.equal(r.duplicate, true); assert.equal(f.sends.length, 1); assert.equal([...f.ledger.values()][0].retryAllowed, false);
});
test('a missing provider receipt cannot cause a second fallback send', async () => {
    const f = fixture(); f.failSend(); f.scripted.push(speak('Le ayudo.')); const r = await f.send('Hola');
    assert.equal(r.requiresHuman, true); assert.equal(f.sends.length, 1); assert.equal([...f.ledger.values()][0].status, 'ambiguous');
});
test('manual mode and active orders remain outside the new path', async () => {
    const f = fixture(); f.state.human.mode = 'manual'; assert.equal((await f.send('Hola')).send, false); assert.equal(f.sends.length, 0);
    const g = fixture({ activeOrder: { orderId: 'EXISTING', status: 'shipped' } }); assert.equal((await g.send('Hola')).reason, 'existing_active_order_preserved'); assert.equal(g.sends.length, 0);
});
test('foreign product and other Brazilian phones cannot enter', async () => {
    const f = fixture(); assert.equal((await f.runtime.handle({ productKey: 'tex_ultra_ec' })).handled, false);
    const g = fixture({ phone: '5511999999999' }); await assert.rejects(() => g.send('Hola'), /inbound_identity_required/);
});
test('QA needs a fresh authorized window and never registers an order', async () => {
    const f = fixture({ phone: '5515998038637' }); assert.equal((await f.send('Hola')).reason, 'qa_window_not_ready');
    const g = fixture({ phone: '5515998038637', qaReady: true, draft: full }); g.scripted.push(call('register_confirmed_order'), speak('Este es solo un ensayo.')); await g.send('Confirmo'); assert.equal(g.orderCalls.length, 0);
});
test('capture persists only in the current product memory and uses existing schema', async () => {
    const f = fixture(); f.scripted.push(call('capture_customer_detail', { field: 'city', value: 'Quito', evidence: 'Quito' }), speak('Tengo Quito. Cual es su nombre?'));
    await f.send('Estoy en Quito'); assert.equal(f.state.metadata.perAgentMemory.vit_power_ec.principalSdrFreeflow.draft.city, 'Quito'); assert.equal(f.orderCalls.length, 0);
});

test('panel string quantities normalize and zero remains an unselected package', async () => {
    const f = fixture({ draft: { quantity: '0' } });
    f.scripted.push(call('consult_price_options'), speak('1 frasco USD 39.99; 3 frascos USD 95.99; 6 frascos USD 167.99.'));
    const result = await f.send('Quiero conocer la oferta disponible de Vit Power');
    assert.equal(result.priceOptionsPresented, true); assert.equal(result.draft.quantity, undefined);
    const g = fixture({ draft: { ...full, quantity: '3' } });
    g.scripted.push(call('prepare_order_summary'), speak('3 frascos por USD 95.99. Confirma?'));
    await g.send('Revise mis datos');
    assert.equal(g.state.metadata.perAgentMemory.vit_power_ec.principalSdrFreeflow.draft.quantity, 3);
    assert.ok(g.state.metadata.perAgentMemory.vit_power_ec.principalSdrFreeflow.pendingSummary?.summaryOutboundId);
});
test('summary requires a later confirmed inbound and a real mirrored receipt', async () => {
    const f = fixture({ draft: full }); f.scripted.push(call('prepare_order_summary'), speak('3 frascos por USD 95.99. Confirma estos datos?'));
    await f.send('Revise mis datos', 'fixture_summary_1'); assert.equal(f.orderCalls.length, 0);
    const summary = f.state.metadata.perAgentMemory.vit_power_ec.principalSdrFreeflow.pendingSummary;
    assert.match(summary.summaryOutboundId, /^FIXTURE_PROVIDER_/);
    f.scripted.push(call('register_confirmed_order'), speak('Su pedido fue registrado.'));
    await f.send('Si', 'fixture_confirm_2'); assert.equal(f.orderCalls.length, 1); assert.equal(f.sends.length, 1);
    assert.equal(f.state.metadata.perAgentMemory.vit_power_ec.principalSdrFreeflow.registrationAttempt.status, 'registered');
});
test('ambiguous registration state blocks repeat creation', async () => {
    const f = fixture({ draft: full }); f.state.metadata.perAgentMemory.vit_power_ec.principalSdrFreeflow.registrationAttempt = { status: 'attempted' };
    f.scripted.push(call('prepare_order_summary'), speak('3 frascos por USD 95.99. Confirma?')); await f.send('Revise', 'fixture_ambiguous_summary');
    f.scripted.push(call('register_confirmed_order')); await f.send('Si', 'fixture_ambiguous_confirm'); assert.equal(f.orderCalls.length, 0);
});
test('a human takeover during generation cancels the reply', async () => {
    const f = fixture(); f.scripted.push(() => { f.state.human = { mode: 'manual', note: 'real_operator' }; return speak('Le ayudo.'); });
    const r = await f.send('Hola'); assert.equal(f.sends.length, 0); assert.equal(r.requiresHuman, true); assert.equal(f.handoffs.length, 0); assert.equal(f.state.human.note, 'real_operator');
});
test('a provider-only inbound without durable mirror is rejected', async () => {
    const f = fixture(); f.state.metadata.processingLock = { messageId: 'fixture_unpersisted', expiresAt: new Date(NOW.getTime() + 60000) };
    await assert.rejects(() => f.runtime.handle({ message: { id: 'fixture_unpersisted', body: 'Hola', sessionId: 'fixture_session' }, contactStateId: f.state._id, phone: f.state.phoneDigits, productKey: 'vit_power_ec' }), /persisted_inbound_mismatch/);
});


test('captured address and summary in the same turn survive normalized next-turn confirmation', async () => {
    const f = fixture({ draft: { ...full, address: '' }, registeredPhone: '+593999000001' });
    f.scripted.push(call('capture_customer_detail', { field: 'address', value: full.address, evidence: full.address }),
        call('prepare_order_summary'), speak('3 frascos por USD 95.99. Confirma estos datos?'));
    await f.send('Direccion: ' + full.address, 'fixture_capture_summary_v230');
    assert.equal(f.state.metadata.perAgentMemory.vit_power_ec.stage, 'sdr_awaiting_order_confirmation');
    assert.equal(f.orderCalls.length, 0);
    f.scripted.push(call('register_confirmed_order'), speak('Su pedido fue registrado.'));
    await f.send('Sí, confirmo', 'fixture_confirm_captured_v230');
    assert.equal(f.orderCalls.length, 1);
    assert.equal(f.state.metadata.perAgentMemory.vit_power_ec.principalSdrFreeflow.registrationAttempt.status, 'registered');
    assert.equal(f.state.metadata.perAgentMemory.vit_power_ec.stage, 'sdr_completed_order');
});
test('current conversational data stage uses the existing classifier awaiting contract', async () => {
    const f = fixture();
    f.scripted.push(call('capture_customer_detail', { field: 'city', value: 'Quito', evidence: 'Quito' }), speak('Tengo Quito.'));
    await f.send('Estoy en Quito', 'fixture_city_stage_v230');
    assert.equal(f.state.metadata.perAgentMemory.vit_power_ec.stage, 'sdr_awaiting_customer_data');
});
test('buy later intent never advertises an active awaiting sales stage', async () => {
    const f = fixture();
    f.scripted.push(call('capture_customer_detail', { field: 'intent', value: 'buy_later', evidence: 'mas tarde' }), speak('Lo retomamos mas tarde.'));
    await f.send('Quiero comprar mas tarde', 'fixture_later_stage_v230');
    assert.equal(f.state.metadata.perAgentMemory.vit_power_ec.stage, 'sdr_paused_buy_later');
    assert.equal(f.orderCalls.length, 0);
});
for (const confirmation of ['Sí', 'Sí, confirmo', 'Correcto', 'Confirmo el pedido']) test('verified current summary accepts ' + confirmation, async () => {
    const f = fixture({ draft: full, registeredPhone: '+593999000001' });
    f.scripted.push(call('prepare_order_summary'), speak('3 frascos por USD 95.99. Confirma?'));
    await f.send('Revise mis datos', 'fixture_summary_phrase_v230');
    f.scripted.push(call('register_confirmed_order'), speak('Su pedido fue registrado.'));
    await f.send(confirmation, 'fixture_phrase_confirm_v230');
    assert.equal(f.orderCalls.length, 1);
    assert.equal(f.state.metadata.perAgentMemory.vit_power_ec.principalSdrFreeflow.registrationAttempt.status, 'registered');
});
test('a receipt for a different phone is still rejected', async () => {
    const f = fixture({ draft: full, registeredPhone: '+593999000002' });
    f.scripted.push(call('prepare_order_summary'), speak('3 frascos por USD 95.99. Confirma?'));
    await f.send('Revise', 'fixture_wrong_phone_summary_v230');
    f.scripted.push(call('register_confirmed_order'));
    const r = await f.send('Si', 'fixture_wrong_phone_confirmation_v230');
    assert.equal(r.handoffRequested, true);
    assert.equal(f.handoffs.length, 1);
    assert.equal(f.state.metadata.perAgentMemory.vit_power_ec.principalSdrFreeflow.registrationAttempt.status, 'attempted');
});

test('accepted SDR replies retain exact provider and session proof for question history', async () => {
    const f = fixture(); f.scripted.push(speak('Le ayudo.'));
    const result = await f.send('Hola');
    const saved = f.state.metadata.perAgentMemory.vit_power_ec.principalSdrFreeflow;
    const row = saved.history.at(-1);
    assert.equal(row.providerMessageId, result.providerMessageId);
    assert.equal(row.providerMessageId, saved.lastOutboundProviderId);
    assert.equal(row.sessionId, 'fixture_session');
    assert.equal(row.role, 'assistant');
    assert.equal(row.content, 'Le ayudo.');
});

test('provider receipt metadata remains outside the model message objects', async () => {
    const f = fixture(); f.scripted.push(speak('Le ayudo.'));
    await f.send('Hola');
    f.scripted.push(request => {
        const previous = request.messages.filter(row => row.role === 'assistant');
        assert(previous.length > 0);
        for (const row of previous) assert.deepEqual(Object.keys(row).sort(), ['content', 'role']);
        return speak('Continuamos.');
    });
    const result = await f.send('Continuemos');
    assert.equal(result.deliveredToProvider, true);
});
