import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
    adminRepurchaseCycleFlag,
    isConfirmedPersistenceVerifiedV158
} from '../src/services/adminPanelStatusService.js';

const read = (relative) => fs.readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');

test('V158 aceita apenas prova completa de persistencia confirmada', () => {
    assert.equal(isConfirmedPersistenceVerifiedV158({
        ok: true,
        matchedCount: 1,
        finalStatus: 'confirmado',
        statusVerified: true,
        visibleInConfirmedQuery: true
    }), true);
});

test('V158 rejeita falso sucesso quando a linha canonica nao foi encontrada', () => {
    assert.equal(isConfirmedPersistenceVerifiedV158({
        ok: true,
        matchedCount: 0,
        finalStatus: 'confirmado',
        statusVerified: true,
        visibleInConfirmedQuery: true
    }), false);
});

test('V158 rejeita leitura final divergente ou invisivel em Confirmados', () => {
    assert.equal(isConfirmedPersistenceVerifiedV158({
        ok: true,
        matchedCount: 1,
        finalStatus: 'finalizado',
        statusVerified: false,
        visibleInConfirmedQuery: false
    }), false);
});

test('V158 reconhece o espelho humano como ciclo atual sem alterar os demais produtos', () => {
    assert.equal(adminRepurchaseCycleFlag({
        previousOrderId: 'EC-ADMIN-1329',
        entryReason: 'admin_panel_confirmed_whatsapp_mirror'
    }), 1);
    assert.equal(adminRepurchaseCycleFlag({ previousOrderId: '', entryReason: 'admin_panel_confirmed_whatsapp_mirror' }), 0);
});

test('persistencia SQLite exige lead existente e executa leitura apos gravacao', () => {
    const source = read('src/services/adminPanelStatusService.js');
    assert.match(source, /require_existing_lead/);
    assert.match(source, /required_lead_id/);
    assert.match(source, /SELECT id, status, notes FROM leads WHERE id=/);
    assert.match(source, /force_human_confirmed_cycle/);
    assert.match(source, /SELECT status, event_id FROM leads WHERE id=/);
    assert.match(source, /visibleInConfirmedQuery/);
});

test('rota WhatsApp interrompe o HTTP 200 quando Mongo ou painel divergem', () => {
    const source = read('src/routes/whatsapp.js');
    assert.match(source, /panel_confirm_order_read_after_write_failed/);
    assert.match(source, /panel_confirm_final_read_after_write_failed/);
    assert.match(source, /return res\.status\(status\)\.json\(\{[\s\S]*success: false/);
    assert.match(source, /\[PANEL_CONFIRM_V158\]/);
});

test('rota de Confirmados prova persistencia e nao rebaixa pedido avancado', () => {
    const source = read('src/routes/shipments.js');
    assert.match(source, /confirmed_order_already_advanced/);
    assert.match(source, /confirmed_contact_state_read_after_write_failed/);
    assert.match(source, /persistConfirmedOrderToOnlineAdminPanelV158/);
    assert.match(source, /persistenceVerified: staged\.confirmedPersistence/);
    assert.match(source, /falseSuccessPrevented: true/);
});

test('painel Leads Clientes so mostra sucesso depois da prova e da nova consulta', () => {
    const source = read('public/leads-window.html');
    assert.match(source, /assertConfirmedPersistenceV158\(result\)/);
    assert.match(source, /assertConfirmedLeadVisibleV158\(id\)/);
    assert.match(source, /readAfterWriteVerified === true/);
    assert.match(source, /visibleInConfirmedQuery === true/);
});

test('painel WhatsApp exige a mesma prova antes do toast de confirmacao', () => {
    const source = read('public/qr.html');
    assert.match(source, /assertConfirmedPersistenceV158\(contactSave, customerDraft\)/);
    assert.match(source, /proof\.persistenceVerified === true/);
    assert.match(source, /proof\.readAfterWriteVerified === true/);
    assert.match(source, /proof\.visibleInConfirmedQuery === true/);
});

test('reparo V158 e unitario, auditavel, idempotente e sem efeitos externos', () => {
    const source = read('scripts/repair-ec-confirmed-order-v158.mjs');
    assert.match(source, /V158_CONFIRM_REPAIR_AUTHORIZE/);
    assert.match(source, /V158_CONFIRM_REPAIR_LEAD_ID/);
    assert.match(source, /flag: 'wx'/);
    assert.match(source, /relatedOrders\.find\(\(candidate\) => candidate\.orderId === adminOrderId\)/);
    assert.match(source, /whatsappCalls: 0/);
    assert.match(source, /dropiCalls: 0/);
    assert.match(source, /metaCalls: 0/);
    assert.doesNotMatch(source, /sendMessage|submitDroppi|sendPurchaseEvent|zapi/i);
});
