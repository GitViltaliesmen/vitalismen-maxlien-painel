import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('produto estruturado da ficha atual vence historico antigo de conversa', () => {
    const route = read('src/routes/whatsapp.js');
    const functionStart = route.indexOf('const inferProductInfoForDraft = async');
    const historyLookup = route.indexOf('const recentNitrixMessage = await Message.findOne', functionStart);
    const explicitLookup = route.indexOf('const explicitDraftProductKey = detectExplicitEcuadorProductKey(draft);', functionStart);
    const explicitReturn = route.indexOf('return resolveEcuadorProductInfo({ productKey: explicitDraftProductKey });', explicitLookup);

    assert.ok(functionStart >= 0);
    assert.ok(explicitLookup > functionStart);
    assert.ok(explicitReturn > explicitLookup);
    assert.ok(historyLookup > explicitReturn, 'historico so pode ser consultado depois da escolha atual');
});

test('sincronizacao do pedido grava o produto autoritativo nos metadados tecnicos', () => {
    const route = read('src/routes/whatsapp.js');
    const syncStart = route.indexOf('const ensureOperationalOrderForConfirmedDraft = async');
    const syncEnd = route.indexOf('\n};', syncStart);
    const syncBody = route.slice(syncStart, syncEnd);

    assert.match(syncBody, /productSelectionSource: 'manual_customer_draft'/);
    assert.match(syncBody, /\.\.\.ecuadorProductMetadata\(productInfo\)/);
});

test('seguranca Dropi reconhece escolha estruturada da ficha sem impor mensagem historica', () => {
    const service = read('src/services/droppiEcuadorBrowserService.js');
    assert.match(service, /order\?\.tracking\?\.productSelectionSource === 'manual_customer_draft'/);
});

test('envio confirmado atualiza tambem o espelho legado de submissao Dropi', () => {
    const service = read('src/services/droppiEcuadorBrowserService.js');
    const syncService = read('src/services/droppiEcuadorService.js');
    assert.match(service, /status: 'submitted',[\s\S]*?dropiOrderId,[\s\S]*?trackingNumber,[\s\S]*?submittedAt: submittedAt\.toISOString\(\)/);
    assert.match(service, /'raw\.latestDroppiPayload': latestDroppiPayload/);
    assert.match(syncService, /const preserveSubmittedReceipt = Boolean\(/);
    assert.match(syncService, /status: 'submitted',[\s\S]*?dropiStatus: payload\.status/);
    assert.match(syncService, /latestDroppiPayload,/);
});

test('sessao Dropi usa caminho persistente fora do release e ignora configuracao relativa', () => {
    const service = read('src/services/droppiEcuadorBrowserService.js');
    const sessionScript = read('scripts/save-dropi-session.mjs');

    assert.match(service, /'\.vitalismen-secrets',[\s\S]*?'droppi-ec-storage\.json'/);
    assert.match(service, /path\.isAbsolute\(CONFIGURED_STORAGE_STATE_PATH\)/);
    assert.match(sessionScript, /path\.isAbsolute\(process\.env\.DROPPI_EC_STORAGE_STATE_PATH\)/);
    assert.match(service, /fs\.chmodSync\(STORAGE_STATE_PATH, 0o600\)/);
    assert.match(sessionScript, /fs\.chmodSync\(config\.storageStatePath, 0o600\)/);
    assert.doesNotMatch(service, /path\.join\(process\.cwd\(\), '\.local', 'droppi-ec-storage\.json'\)/);
});

test('todos os produtos EC exibem a mesma tabela completa de oito precos aprovados', () => {
    const panel = read('public/qr.html');
    const tableStart = panel.indexOf('<div class="price-preset-grid price-preset-grid--grouped"');
    const tableEnd = panel.indexOf('</div>\n                        <label>Observacao interna', tableStart);
    const table = panel.slice(tableStart, tableEnd);
    const buttons = [...table.matchAll(/data-price-preset="([^"]+)"/g)].map((match) => match[1]);

    assert.deepEqual(buttons, [
        '1:39.99', '2:70.00', '3:95.99', '6:167.99',
        '1:35.99', '2:70.00', '3:80.99', '6:147.99'
    ]);
    assert.doesNotMatch(table, /data-price-preset="[^"]+"[^>]*\shidden(?:\s|>)/);

    const catalogMatch = panel.match(/const customerPricePresetsEc = (\[[\s\S]*?\n        \]);/);
    assert.ok(catalogMatch, 'catalogo EC da ficha deve existir');
    const catalog = Function(`"use strict"; return (${catalogMatch[1]});`)();
    assert.deepEqual(catalog.map(([quantity, total]) => `${quantity}:${total}`), buttons);
    assert.match(panel, /EC: customerPricePresetsEc/);
    assert.match(panel, /EC_TEX_ULTRA: customerPricePresetsEc/);
});

test('ficha de leads reidrata produto somente pelo marcador estruturado persistido', () => {
    const route = read('src/routes/shipments.js');
    const panel = read('public/leads-window.html');

    assert.match(route, /router\.get\('\/droppi\/ec\/admin-leads\/flags', adminOnly/);
    assert.match(route, /marker_pattern = re\.compile\(/);
    assert.match(route, /allowed_products = \{"tex_ultra_ec", "nitrix_ec", "vit_power_ec"\}/);
    assert.match(route, /flag\["productSelection"\] = product_selection/);
    assert.doesNotMatch(route, /flag\["notes"\]/);
    assert.doesNotMatch(route, /"suggestedStatus": suggested_status/);
    assert.match(panel, /lead\?\._ops\?\.productSelection\?\.productKey/);
    assert.match(panel, /lead\?\._ops\?\.productSelection\?\.priceCatalog/);
    assert.match(panel, /hydrateLeadOperationalFlags\(\)/);
    assert.doesNotMatch(route, /product_key\s*=.*product_value/);
});

test('scripts inline do painel continuam sintaticamente validos', () => {
    const panel = read('public/qr.html');
    const scripts = [...panel.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
        .map((match) => match[1])
        .filter((body) => body.trim());
    assert.ok(scripts.length > 0);
    for (const body of scripts) {
        Function(body);
    }
});
