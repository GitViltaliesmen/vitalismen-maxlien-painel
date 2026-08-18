import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
    BUY_LATER_REMINDER_POLICY,
    buildBuyLaterReminderText,
    buyLaterReminderWindow,
    formatBuyLaterDesiredDate,
    nextBuyLaterReminderState,
    normalizeBuyLaterDesiredDate
} from '../src/services/adminBuyLaterFollowupService.js';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('normaliza somente datas reais no formato ISO civil', () => {
    assert.equal(normalizeBuyLaterDesiredDate('2026-08-22'), '2026-08-22');
    assert.equal(normalizeBuyLaterDesiredDate('2026-08-22T09:00:00-05:00'), '2026-08-22');
    assert.equal(formatBuyLaterDesiredDate('2026-08-22'), '22/08/2026');
    assert.equal(normalizeBuyLaterDesiredDate('22/08/2026'), '');
    assert.equal(normalizeBuyLaterDesiredDate('2026-02-30'), '');
});

test('aceite do operador libera publicacao sem ligar scheduler ou ativar producao', () => {
    const manifest = JSON.parse(read('docs/freeze/buy-later-date-reminder-v24-20260818.json'));
    assert.equal(manifest.publicationStatus, 'approved_for_publication');
    assert.equal(manifest.operatorApproval.status, 'approved_in_thread');
    assert.equal(manifest.operatorApproval.approvedAt, '2026-08-18T05:21:30Z');
    assert.equal(manifest.operatorApproval.scope, 'publish_v24_after_successful_audit');
    assert.equal(manifest.policy.productionChanged, false);
    assert.equal(manifest.policy.maxAutomaticAttempts, 1);
});

test('janela D-4 a D-3 usa America/Guayaquil sem deslocamento brasileiro', () => {
    const window = buyLaterReminderWindow('2026-08-22');
    assert.equal(window.windowStartAt.toISOString(), '2026-08-18T14:00:00.000Z');
    assert.equal(window.windowEndAt.toISOString(), '2026-08-19T23:59:59.000Z');
    assert.equal(BUY_LATER_REMINDER_POLICY.timezone, 'America/Guayaquil');
    assert.equal(BUY_LATER_REMINDER_POLICY.windowStartDaysBefore, 4);
    assert.equal(BUY_LATER_REMINDER_POLICY.windowEndDaysBefore, 3);
});

test('texto e nominal, temporal e isolado por produto', () => {
    const now = new Date('2026-08-18T15:00:00.000Z');
    const tex = buildBuyLaterReminderText({
        name: 'Miguel Angel',
        productKey: 'tex_ultra_ec',
        productName: 'Tex Ultra Ecuador',
        desiredOrderDate: '2026-08-22',
        now
    });
    assert.equal(
        tex,
        'Hola, Miguel, buenos días. Soy Ana López. Usted nos indicó que desea realizar su pedido de Tex Ultra para el 22/08/2026. ¿Podemos preparar el pedido para enviarlo en la fecha acordada?'
    );
    assert.doesNotMatch(tex, /Vit Power|Nitrix/i);

    const nitrix = buildBuyLaterReminderText({
        name: 'María',
        productKey: 'nitrix_ec',
        desiredOrderDate: '2026-08-22',
        now: new Date('2026-08-18T19:00:00.000Z')
    });
    assert.match(nitrix, /^Hola, María, buenas tardes\./);
    assert.match(nitrix, /pedido de Nitrix Oxide/);
    assert.doesNotMatch(nitrix, /Tex Ultra|Vit Power/i);
});

test('mesma data e produto preservam envio; nova agenda reinicia trava', () => {
    const previous = {
        active: true,
        desiredOrderDate: '2026-08-22',
        productKey: 'tex_ultra_ec',
        productName: 'Tex Ultra Ecuador',
        sentAt: new Date('2026-08-18T15:00:00.000Z'),
        attemptCount: 1,
        awaitingReply: true
    };
    const unchanged = nextBuyLaterReminderState({
        previous,
        status: 'comprar_depois',
        desiredOrderDate: '2026-08-22',
        productKey: 'tex_ultra_ec',
        customerName: 'Miguel Angel'
    });
    assert.equal(unchanged.sentAt.toISOString(), '2026-08-18T15:00:00.000Z');
    assert.equal(unchanged.awaitingReply, true);

    const rescheduled = nextBuyLaterReminderState({
        previous,
        status: 'comprar_depois',
        desiredOrderDate: '2026-08-29',
        productKey: 'tex_ultra_ec',
        customerName: 'Miguel Angel'
    });
    assert.equal(rescheduled.sentAt, null);
    assert.equal(rescheduled.failedAt, null);
    assert.equal(rescheduled.attemptCount, 0);
    assert.equal(rescheduled.awaitingReply, false);
});

test('agenda sem produto estruturado falha fechada', () => {
    assert.throws(() => nextBuyLaterReminderState({
        status: 'comprar_depois',
        desiredOrderDate: '2026-08-22',
        productKey: '',
        customerName: 'Cliente'
    }), /buy_later_product_required/);
});

test('sair de Comprar depois cancela sem apagar a auditoria anterior', () => {
    const cancelled = nextBuyLaterReminderState({
        previous: {
            active: true,
            desiredOrderDate: '2026-08-22',
            productKey: 'tex_ultra_ec',
            sentAt: new Date('2026-08-18T15:00:00.000Z'),
            awaitingReply: true
        },
        status: 'atendendo',
        now: new Date('2026-08-18T16:00:00.000Z')
    });
    assert.equal(cancelled.active, false);
    assert.equal(cancelled.awaitingReply, false);
    assert.equal(cancelled.sentAt.toISOString(), '2026-08-18T15:00:00.000Z');
    assert.equal(cancelled.cancelledAt.toISOString(), '2026-08-18T16:00:00.000Z');
});

test('contrato operacional tem lock, historico e nenhuma acao externa adicional', () => {
    const service = read('src/services/adminBuyLaterFollowupService.js');
    const model = read('src/models/ContactState.js');
    const scheduler = read('src/services/schedulerService.js');
    assert.match(service, /ContactState\.findOneAndUpdate/);
    assert.match(service, /Message\.findOne/);
    assert.match(service, /buyLaterReminder\.lockUntil/);
    assert.match(service, /buyLaterReminder\.sentAt/);
    assert.match(service, /buyLaterReminder\.failedAt/);
    assert.match(service, /outboundContext: 'buy_later_date_reminder'/);
    assert.doesNotMatch(service, /sendAudio|sendImage|sendVideo|sendPurchaseEvent|droppiEcuador|dropiOrder/);
    assert.match(model, /buyLaterReminder:/);
    assert.match(model, /windowStartAt:/);
    assert.match(model, /sentAt:/);
    assert.match(scheduler, /flagEnabled\('ADMIN_BUY_LATER_FOLLOWUP_ENABLED', false\)/);
    assert.equal(BUY_LATER_REMINDER_POLICY.sendsMedia, false);
    assert.equal(BUY_LATER_REMINDER_POLICY.maxAutomaticAttempts, 1);
    assert.equal(BUY_LATER_REMINDER_POLICY.createsOrder, false);
    assert.equal(BUY_LATER_REMINDER_POLICY.sendsDropi, false);
    assert.equal(BUY_LATER_REMINDER_POLICY.sendsMeta, false);
});

test('painel exige data somente em Comprar depois e envia a data aos dois paineis', () => {
    const panel = read('public/qr.html');
    const leadsPanel = read('public/leads-window.html');
    const route = read('src/routes/whatsapp.js');
    assert.match(panel, /id="customerBuyLaterDateInput" type="date"/);
    assert.match(panel, /customerDraft\.status === 'comprar_depois'/);
    assert.match(panel, /customerDraft\?\.buyLaterFollowupAt/);
    assert.match(panel, /Nenhum pedido será criado automaticamente/);
    assert.match(leadsPanel, /aviso unico sera enviado entre 4 e 3 dias antes/);
    assert.match(leadsPanel, /T\$\{match\[4\]\}:\$\{match\[5\]\}:00-05:00/);
    assert.match(route, /buy_later_date_required/);
    assert.match(route, /applyBuyLaterReminderFromDraft/);
    assert.doesNotMatch(route, /resolveEcuadorProductInfo\(\s*draft,\s*\{ productKey: state\?\.assignedAgent/);
});
