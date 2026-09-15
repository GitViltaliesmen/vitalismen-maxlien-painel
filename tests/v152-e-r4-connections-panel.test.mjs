import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

const panel = await fs.readFile(new URL('../public/qr.html', import.meta.url), 'utf8');
const route = await fs.readFile(new URL('../src/routes/whatsapp.js', import.meta.url), 'utf8');
const worker = await fs.readFile(new URL('../scripts/v152-e-r4-persistent-shadow-worker.mjs', import.meta.url), 'utf8');

test('Conexões mostra canal real e preserva Z-API, template e telefone antigo', () => {
    for (const marker of [
        'LEGACY_ZAPI_PRIMARY',
        'V152_TEST_WEB_01',
        'WHATSAPP_WEB_TEMPLATE',
        'OLD_BLOCKED_PHONE',
        'provider=WHATSAPP_WEB',
        'shadow=YES',
        'draining=YES',
        'weight=0',
        'capacity=0',
        'data-v152-e-r4-channel="V152_TEST_WEB_01"'
    ]) assert.match(panel, new RegExp(marker));
    assert.match(panel, /\$\{zapiCard\}\$\{realTestCard\}\$\{draftCard\}\$\{preservedCard\}/);
    assert.match(panel, /realTestSession\?\.health\?\.healthy === true/);
    assert.match(panel, /realTestSession\?\.connectionState/);
});

test('endpoint administrativo mescla somente o estado sanitizado do worker', () => {
    assert.match(route, /readV152ER4PanelSession\(\)/);
    assert.match(route, /mergeV152ER4PanelSessions\(getAllStatuses\(\), shadowSession\)/);
    assert.match(route, /projectV152ER4PanelSession\(null\)/);
    assert.doesNotMatch(route, /V152_E_R4_STATE_ROOT[\s\S]{0,500}(creds|authState|pairingCode)/i);
});

test('worker real não possui caminho de outbound, bot, fila ou QR', () => {
    assert.match(worker, /printQRInTerminal:\s*false/);
    assert.match(worker, /inspectBaileysAuthStateForRestart\(persisted\)\.structurallyComplete/);
    assert.match(worker, /inspectBaileysAuthStateForRestart\(state\?\.creds\)\.structurallyComplete/);
    assert.doesNotMatch(worker, /registered\s*!==\s*true/);
    assert.doesNotMatch(worker, /sendMessage|requestPairingCode|QRCode|qrcode-terminal|setupDispatcher|postSale|Dropi|models\/Order/i);
    assert.doesNotMatch(worker, /console\.(log|error|warn|info|debug)/);
    assert.match(worker, /pairingRequests:\s*0/);
    assert.match(worker, /outboundQueueConsumption:\s*0/);
    assert.match(worker, /customerInboundRouting:\s*0/);
});

test('módulos congelados do painel permanecem presentes', () => {
    for (const marker of [
        'data-module="care"',
        'data-module="review"',
        'data-module="connections"',
        'id="chatList"',
        'id="conversation"',
        'Leads Clientes',
        'Dropi',
        'Pos-venda'
    ]) assert.match(panel, new RegExp(marker, 'i'));
    assert.doesNotMatch(panel, /class="chat-preview meta"/);
});
