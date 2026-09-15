import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
    BUY_LATER_REMINDER_POLICY,
    buyLaterOperationalCandidateQuery,
    isBuyLaterOperationalCandidate,
    observeAdminBuyLaterFollowups,
    processAdminBuyLaterFollowups
} from '../src/services/adminBuyLaterFollowupService.js';
import { buyLaterReplyDecision } from '../src/services/buyLaterConfirmationService.js';
import {
    BUY_LATER_V162_BATCH_LIMIT,
    BUY_LATER_V162_ENV_ALLOWLIST,
    BUY_LATER_V162_INTERVAL_MINUTES
} from '../scripts/run-buy-later-followup-v162.mjs';

const read = (relative) => fs.readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const fixedNow = new Date('2026-10-01T14:00:00.000Z');

const fixture = (overrides = {}) => ({
    _id: 'fixture-0268',
    chatId: '593990000268@c.us',
    phoneDigits: '593990000268',
    countryCode: 'EC',
    metadata: {
        customerDraft: {
            status: 'comprar_depois',
            name: 'Cliente Fixture',
            phone: '593990000268',
            productKey: 'vit_power_ec'
        }
    },
    buyLaterReminder: {
        active: true,
        desiredOrderDate: '2026-10-05',
        productKey: 'vit_power_ec',
        productName: 'Vit Power Ecuador',
        customerName: 'Cliente Fixture',
        windowStartAt: new Date('2026-10-01T14:00:00.000Z'),
        windowEndAt: new Date('2026-10-02T23:59:59.000Z'),
        lockUntil: null,
        lockedAt: null,
        sentAt: null,
        failedAt: null,
        attemptCount: 0,
        awaitingReply: false
    },
    ...overrides
});

const setPath = (object, dotted, value) => {
    const parts = dotted.split('.');
    let cursor = object;
    for (const part of parts.slice(0, -1)) {
        cursor[part] ||= {};
        cursor = cursor[part];
    }
    cursor[parts.at(-1)] = value;
};

const queryChain = (value) => ({
    sort() { return this; },
    select() { return this; },
    limit() { return this; },
    lean() { return Promise.resolve(value); }
});

const harness = ({ states = [fixture()], history = null } = {}) => {
    const rows = states;
    const updates = [];
    const claims = [];
    return {
        rows,
        updates,
        claims,
        contactStateModel: {
            find() { return queryChain(rows); },
            async findOneAndUpdate(query, update) {
                claims.push({ query, update });
                const state = rows.find((item) => String(item._id) === String(query._id));
                if (!state || state.buyLaterReminder.sentAt || state.buyLaterReminder.failedAt
                    || Number(state.buyLaterReminder.attemptCount || 0) >= 1) return null;
                for (const [key, value] of Object.entries(update.$set || {})) setPath(state, key, value);
                return state;
            },
            async updateOne(filter, update) {
                const state = rows.find((item) => String(item._id) === String(filter._id));
                if (!state) return { modifiedCount: 0 };
                updates.push({ filter, update });
                for (const [key, value] of Object.entries(update.$set || {})) setPath(state, key, value);
                for (const [key, value] of Object.entries(update.$inc || {})) {
                    const current = key.split('.').reduce((obj, part) => obj?.[part], state) || 0;
                    setPath(state, key, current + value);
                }
                return { modifiedCount: 1 };
            }
        },
        messageModel: {
            findOne() { return queryChain(history); }
        }
    };
};

test('fixture 0268 entra somente na janela D-4/D-3 e sai após sentAt', () => {
    const state = fixture();
    assert.equal(isBuyLaterOperationalCandidate(state, new Date('2026-10-01T13:59:59.999Z')), false);
    assert.equal(isBuyLaterOperationalCandidate(state, fixedNow), true);
    state.buyLaterReminder.sentAt = fixedNow;
    assert.equal(isBuyLaterOperationalCandidate(state, fixedNow), false);
});

test('consulta canônica exclui legados e exige produto, telefone, tentativa e lock', () => {
    const query = buyLaterOperationalCandidateQuery(fixedNow);
    assert.equal(query['metadata.customerDraft.status'], 'comprar_depois');
    assert.deepEqual(query['buyLaterReminder.productKey'].$in.sort(), ['nitrix_ec', 'tex_ultra_ec', 'vit_power_ec']);
    assert.equal(query['buyLaterReminder.sentAt'], null);
    assert.equal(query['buyLaterReminder.failedAt'], null);
    assert.equal(query.$and.length, 3);
    const legacy = fixture({
        metadata: { customerDraft: { status: 'buy_later', phone: '593990000268' } }
    });
    assert.equal(isBuyLaterOperationalCandidate(legacy, fixedNow), false);
});

test('Processo V162 planeja e envia um único lembrete via Z-API sem provider real', async () => {
    const h = harness();
    const sends = [];
    const first = await processAdminBuyLaterFollowups({
        limit: 1,
        now: fixedNow,
        contactStateModel: h.contactStateModel,
        messageModel: h.messageModel,
        recipientGuard: () => ({ allowed: true, reason: 'fixture' }),
        async sendTextFn(jid, body, quoted, options) {
            sends.push({ jid, body, quoted, options });
            return { ok: true, provider: 'fixture', providerMessageId: 'fixture-provider-id' };
        }
    });
    assert.equal(first.candidates, 1);
    assert.equal(first.processed, 1);
    assert.equal(first.sent, 1);
    assert.equal(sends.length, 1);
    assert.equal(sends[0].options.provider, 'zapi');
    assert.equal(sends[0].options.sessionId, 'zapi');
    assert.equal(sends[0].options.force, false);
    assert.equal(sends[0].options.country, 'EC');
    assert.match(sends[0].body, /pedido de Vit Power para el 05\/10\/2026/);
    assert.equal(h.rows[0].buyLaterReminder.attemptCount, 1);
    assert.equal(h.rows[0].buyLaterReminder.awaitingReply, true);
    assert.equal(h.rows[0].buyLaterReminder.sentAt.toISOString(), fixedNow.toISOString());

    const second = await processAdminBuyLaterFollowups({
        limit: 1,
        now: fixedNow,
        contactStateModel: h.contactStateModel,
        messageModel: h.messageModel,
        recipientGuard: () => ({ allowed: true }),
        async sendTextFn() { throw new Error('duplicate_send'); }
    });
    assert.equal(second.candidates, 0);
    assert.equal(second.sent, 0);
    assert.equal(sends.length, 1);
});

test('falha de transporte fica terminal e não produz retry automático', async () => {
    const h = harness();
    let attempts = 0;
    const run = () => processAdminBuyLaterFollowups({
        limit: 1,
        now: fixedNow,
        contactStateModel: h.contactStateModel,
        messageModel: h.messageModel,
        recipientGuard: () => ({ allowed: true }),
        async sendTextFn() {
            attempts += 1;
            return { ok: false, providerAttempted: true, ambiguous: true, providerStatus: 'ambiguous' };
        }
    });
    const first = await run();
    assert.equal(first.sent, 0);
    assert.equal(h.rows[0].buyLaterReminder.sentAt, null);
    assert.equal(h.rows[0].buyLaterReminder.failedAt.toISOString(), fixedNow.toISOString());
    assert.equal(h.rows[0].buyLaterReminder.attemptCount, 1);
    const second = await run();
    assert.equal(second.candidates, 0);
    assert.equal(attempts, 1);
});

test('histórico idêntico satisfaz agenda sem repetir provider', async () => {
    const h = harness({
        history: {
            _id: 'message-existing',
            createdAt: new Date('2026-10-01T14:00:01.000Z'),
            providerMessageId: 'zapi-existing'
        }
    });
    const result = await processAdminBuyLaterFollowups({
        limit: 1,
        now: fixedNow,
        contactStateModel: h.contactStateModel,
        messageModel: h.messageModel,
        recipientGuard: () => ({ allowed: true }),
        async sendTextFn() { throw new Error('provider_must_not_run'); }
    });
    assert.equal(result.sent, 0);
    assert.equal(result.items[0].reason, 'recovered_from_history');
    assert.equal(h.rows[0].buyLaterReminder.providerMessageId, 'zapi-existing');
    assert.equal(h.rows[0].buyLaterReminder.awaitingReply, true);
});

test('observe é somente leitura e expõe apenas cauda sanitizada', async () => {
    const h = harness();
    const result = await observeAdminBuyLaterFollowups({ now: fixedNow, contactStateModel: h.contactStateModel });
    assert.equal(result.mode, 'observe');
    assert.equal(result.candidates, 1);
    assert.equal(result.items[0].phoneTail, '0268');
    assert.equal(JSON.stringify(result).includes('593990000268'), false);
    assert.equal(h.claims.length, 0);
    assert.equal(h.updates.length, 0);
});

test('respostas yes/no/other preservam V161 sem criar operação', () => {
    assert.equal(buyLaterReplyDecision('Sí, claro'), 'yes');
    assert.equal(buyLaterReplyDecision('No gracias'), 'no');
    assert.equal(buyLaterReplyDecision('Tengo una pregunta'), 'other');
    const confirmation = read('src/services/buyLaterConfirmationService.js');
    assert.doesNotMatch(confirmation, /from ['"][^'"]*(?:Order|Shipment|droppi|dropi|metaConversions)[^'"]*['"]/i);
    assert.match(confirmation, /decision === 'other'/);
    assert.match(confirmation, /status: nextStatus/);
});

test('executor e systemd permanecem isolados do scheduler global', () => {
    const runner = read('scripts/run-buy-later-followup-v162.mjs');
    const wrapper = read('ops/buy-later-followup-v162');
    const service = read('ops/systemd/vitalismen-buy-later-followup-v162.service');
    const timer = read('ops/systemd/vitalismen-buy-later-followup-v162.timer');
    assert.equal(BUY_LATER_V162_BATCH_LIMIT, 1);
    assert.equal(BUY_LATER_V162_INTERVAL_MINUTES, 15);
    assert.ok(BUY_LATER_V162_ENV_ALLOWLIST.includes('MONGODB_URI'));
    assert.ok(BUY_LATER_V162_ENV_ALLOWLIST.includes('ZAPI_INSTANCE_TOKEN'));
    assert.ok(!BUY_LATER_V162_ENV_ALLOWLIST.some((key) => /DROPI|META|SCHEDULER/.test(key)));
    assert.match(runner, /processAdminBuyLaterFollowups/);
    assert.doesNotMatch(runner, /schedulerService|startScheduler|sendAudio|sendImage|sendVideo|sendPurchaseEvent|droppiEcuador/);
    assert.match(runner, /ADMIN_BUY_LATER_FOLLOWUP_ENABLED: 'false'/);
    assert.match(runner, /WHATSAPP_AUTOMATION_PILOT_ONLY: 'false'/);
    assert.match(wrapper, /BUY_LATER_V162_OPERATIONAL_ENABLED="\$gate"/);
    assert.match(service, /Type=oneshot/);
    assert.match(service, /NoNewPrivileges=true/);
    assert.match(service, /ProtectSystem=full/);
    assert.doesNotMatch(service, /ReadWritePaths=.*\/opt/);
    assert.match(timer, /OnBootSec=5min/);
    assert.match(timer, /OnUnitActiveSec=15min/);
    assert.match(timer, /RandomizedDelaySec=30s/);
    assert.match(timer, /Persistent=true/);
    assert.match(read('src/services/schedulerService.js'), /flagEnabled\('ADMIN_BUY_LATER_FOLLOWUP_ENABLED', false\)/);
});

test('política V24 permanece integral e sem efeitos comerciais adicionais', () => {
    assert.equal(BUY_LATER_REMINDER_POLICY.timezone, 'America/Guayaquil');
    assert.equal(BUY_LATER_REMINDER_POLICY.windowStartDaysBefore, 4);
    assert.equal(BUY_LATER_REMINDER_POLICY.windowEndDaysBefore, 3);
    assert.equal(BUY_LATER_REMINDER_POLICY.lockMinutes, 10);
    assert.equal(BUY_LATER_REMINDER_POLICY.maxAutomaticAttempts, 1);
    assert.equal(BUY_LATER_REMINDER_POLICY.sendsMedia, false);
    assert.equal(BUY_LATER_REMINDER_POLICY.createsOrder, false);
    assert.equal(BUY_LATER_REMINDER_POLICY.sendsDropi, false);
    assert.equal(BUY_LATER_REMINDER_POLICY.sendsMeta, false);
});
