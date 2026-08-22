import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

await import('../src/services/ecDirectProductNameFreezeRuntimeGuardV39.js');

import {
    buildDirectProductReply,
    directEcuadorProductKeys,
    isDirectPriceObjection,
    shouldRouteDirectProductInbound
} from '../src/services/ecDirectProductInquiryService.js';
import {
    explicitEcVslProductContextFromText,
    normalizedInboundProfileName
} from '../src/routes/zapi.js';

const read = (relativePath) => fs.readFileSync(relativePath, 'utf8');

test('pedido direto reconhece Vit Power, Nitrix e mantém pergunta ambígua isolada', () => {
    assert.deepEqual(directEcuadorProductKeys('Quiero Vit Power'), ['vit_power_ec']);
    assert.deepEqual(directEcuadorProductKeys('Necesito Nitrix oxide'), ['nitrix_ec']);
    assert.deepEqual(directEcuadorProductKeys('Quiero Tex Ultra'), ['tex_ultra_ec']);
    assert.deepEqual(
        directEcuadorProductKeys('Quiero Vit Power o Nitrix oxide'),
        ['nitrix_ec', 'vit_power_ec']
    );

    const reply = buildDirectProductReply({
        text: 'Quiero Vit Power o Nitrix oxide',
        ambiguousProductKeys: ['nitrix_ec', 'vit_power_ec']
    });
    assert.equal(reply.responseKind, 'product_choice');
    assert.match(reply.text, /Nitrix Oxide Ecuador/);
    assert.match(reply.text, /Vit Power/);
    assert.doesNotMatch(reply.text, /USD/);
});

test('consulta direta começa com valor normal e não antecipa promoção', () => {
    const reply = buildDirectProductReply({
        text: 'Cuánto cuesta Vit Power?',
        productKey: 'vit_power_ec'
    });
    assert.equal(reply.responseKind, 'normal_price');
    assert.equal(reply.priceCatalog, 'normal');
    assert.match(reply.text, /valores normales/);
    assert.match(reply.text, /1 frasco: USD 39\.99/);
    assert.match(reply.text, /3 frascos: USD 95\.99/);
    assert.match(reply.text, /6 frascos: USD 167\.99/);
    assert.doesNotMatch(reply.text, /valores promocionales/);
    assert.doesNotMatch(reply.text, /1 frasco: USD 35\.99/);
});

test('promoção só é liberada por objeção explícita de preço', () => {
    assert.equal(isDirectPriceObjection('Está muy caro, tiene más barato?'), true);
    assert.equal(isDirectPriceObjection('Vi otro precio diferente'), true);
    assert.equal(isDirectPriceObjection('Quiero información de Nitrix'), false);
    assert.equal(isDirectPriceObjection('Tiene promoción de Nitrix?'), false);

    const reply = buildDirectProductReply({
        text: 'Está muy caro, tiene más barato?',
        productKey: 'nitrix_ec'
    });
    assert.equal(reply.responseKind, 'promotional_price');
    assert.equal(reply.priceCatalog, 'promotional');
    assert.match(reply.text, /indicó que busca un precio más bajo/);
    assert.match(reply.text, /1 frasco: USD 35\.99/);
    assert.match(reply.text, /3 frascos: USD 80\.99/);
    assert.match(reply.text, /6 frascos: USD 147\.99/);
});

test('cliente antigo mantém contexto do produto para pergunta de preço posterior', () => {
    const state = {
        metadata: {
            ecDirectProductInquiry: {
                activeProductKey: 'nitrix_ec',
                requestedAt: new Date().toISOString()
            }
        }
    };
    assert.equal(shouldRouteDirectProductInbound({ text: 'Cuánto cuesta?', state }), true);
    assert.equal(shouldRouteDirectProductInbound({ text: 'Está caro', state }), true);
    assert.equal(shouldRouteDirectProductInbound({ text: 'Gracias', state }), false);
});

test('nome do perfil Z-API é normalizado e números não viram nome de cliente', () => {
    assert.equal(normalizedInboundProfileName('  Juan   Carlos Pérez  '), 'Juan Carlos Pérez');
    assert.equal(normalizedInboundProfileName('+593 980 353 272'), '');
    assert.equal(normalizedInboundProfileName('WhatsApp'), '');
});

test('frases oficiais Tex Ultra continuam atribuídas à VSL e citação livre continua direta', () => {
    const officialEntry = explicitEcVslProductContextFromText('Hola, vengo de la presentacion de Tex Ultra');
    const directMention = explicitEcVslProductContextFromText('Quiero comprar Tex Ultra');
    assert.equal(officialEntry?.productSource, 'zapi_public_tex_ultra_entry');
    assert.equal(directMention?.productSource, 'zapi_explicit_product_text');
});

test('integração preserva origem VSL, lock do operador e anti-repetição persistente', () => {
    const directLayer = read('src/services/ecDirectProductInquiryService.js');
    const zapi = read('src/routes/zapi.js');
    const router = read('src/services/agentRouter.js');
    const engine = read('src/services/conversationEngine.js');

    assert.match(directLayer, /isOperatorProductRouteLock/);
    assert.match(directLayer, /operatorProductPreserved/);
    assert.match(directLayer, /metadata\.ecDirectProductInquiry/);
    assert.match(directLayer, /persistent_lock/);
    assert.match(directLayer, /explicitKeys\.length > 1\s*\? ''/);
    assert.match(directLayer, /\[sentPath\]: \{ \$exists: false \}/);
    assert.match(directLayer, /recentOutboundHistoryHasText/);
    assert.match(directLayer, /\.sentAt/);
    assert.match(directLayer, /promotionUnlockReason.*explicit_price_objection/s);
    assert.doesNotMatch(directLayer, /['"]metadata\.vslProductKey['"]\s*:/);
    assert.match(zapi, /targetState\.human\?\.mode !== 'manual' \|\| directProductInbound/);
    assert.match(router, /directProductInquiryHumanModePreserved: true/);
    assert.match(engine, /maybeHandleEcuadorDirectProductInquiry/);
    assert.match(directLayer, /handled: true, skipped: 'send_failed'/);
});

test('painel usa nome salvo no cabeçalho e preenche a ficha automaticamente', () => {
    const panel = read('public/qr.html');
    const whatsapp = read('src/routes/whatsapp.js');
    const zapi = read('src/routes/zapi.js');

    assert.match(panel, /const displayIdentity = displayName && displayName !== displayPhone/);
    assert.match(panel, /activeMeta.*displayIdentity/);
    assert.match(panel, /chat\.name \|\| chat\.customerDraft\?\.name \|\| chat\.profileName/);
    assert.match(whatsapp, /panelDraft\.name \|\| contactState\?\.metadata\?\.profileName/);
    assert.match(zapi, /targetState\.metadata\.profileName/);
    assert.match(zapi, /!String\(currentDraft\.name \|\| ''\)\.trim\(\)/);
});

test('pós-venda congelado mantém agradecimento e bônus sem reenvio', () => {
    const postSale = read('src/services/texUltraConfirmedPostSaleLayerService.js');
    assert.match(postSale, /AGRADECIMENTO_AGENCIA_DE_ENTREGA/);
    assert.match(postSale, /BONUS_RETIRADA/);
    assert.match(postSale, /sentAt/);
    assert.match(postSale, /lockAt/);
    assert.match(postSale, /dedupeValue/);
    assert.match(postSale, /confirmedAudioHistory/);
    assert.match(postSale, /history_already_sent/);
});
