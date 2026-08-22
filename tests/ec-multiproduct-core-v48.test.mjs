import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
    ECUADOR_PRODUCTS,
    ecuadorProductForVslOrigin,
    getEcuadorProductInfoByKey
} from '../src/services/ecuadorProductService.js';
import {
    applyCurrentProductToState,
    currentProductRouteForState,
    operatorProductRouteLock,
    vslProductAssignmentPolicy
} from '../src/services/vslProductAssignmentService.js';
import {
    applyInboundCustomerNameEvidence,
    applyVerifiedCustomerName,
    resolveCustomerDisplayName,
    resolveIdentityConflict
} from '../src/services/customerNameResolutionService.js';
import { panelAuditTransition } from '../src/services/panelAuditIdempotencyService.js';
import {
    activeEcVslProductContextFromText,
    explicitEcVslProductContextFromText,
    protocoloGTexUltraContextFromText
} from '../src/routes/zapi.js';
import { publicEcVslProductFromBody } from '../src/routes/whatsapp.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const state = (metadata = {}) => ({
    metadata,
    productHistory: [],
    markModified() {}
});

test('registry oficial resolve Protocolo G, /n, /m e Nitrix sem fallback global', () => {
    assert.equal(ecuadorProductForVslOrigin('https://vilaliemen.shop/protocolo-g')?.key, 'tex_ultra_ec');
    assert.equal(ecuadorProductForVslOrigin('https://ec.maxlien.shop/n/')?.key, 'tex_ultra_ec');
    assert.equal(ecuadorProductForVslOrigin('/m/')?.key, 'vit_power_ec');
    assert.equal(explicitEcVslProductContextFromText('Quiero conocer Nitrix')?.productKey, 'nitrix_ec');
    assert.equal(activeEcVslProductContextFromText('Hola, quiero el tratamiento.', {
        VITALISMEN_ACTIVE_VSL_PRODUCT: 'vit_power_ec'
    }), null);
    assert.equal(publicEcVslProductFromBody({ path: '/ruta-desconocida' }).productKey, '');
});

test('Protocolo G extrai nome submetido e fixa Tex Ultra', () => {
    const context = protocoloGTexUltraContextFromText([
        'Hola, quiero el tratamiento Tex Ultra.',
        'Nombre: Eddy vaca',
        'Ciudad: Quito',
        'Provincia: Pichincha'
    ].join('\n'));
    assert.equal(context.productKey, 'tex_ultra_ec');
    assert.equal(context.submittedName, 'Eddy vaca');
    assert.equal(context.submittedCity, 'Quito');
    assert.equal(context.submittedProvince, 'Pichincha');
});

test('produto atual, origem historica e trava manual possuem semanticas separadas', () => {
    const contact = state({
        vslProductKey: 'tex_ultra_ec',
        vslProductName: 'Tex Ultra Ecuador',
        productKey: 'tex_ultra_ec',
        customerDraft: { productKey: 'tex_ultra_ec' }
    });
    contact.metadata.productRouteLock = operatorProductRouteLock({
        productKey: 'vit_power_ec',
        productName: 'Vit Power Ecuador',
        selectedBy: 'Operador'
    });
    applyCurrentProductToState({
        state: contact,
        productKey: 'vit_power_ec',
        productName: 'Vit Power Ecuador',
        source: 'panel_customer_product_selection'
    });
    const policy = vslProductAssignmentPolicy({ state: contact, incomingProductKey: 'tex_ultra_ec' });
    assert.equal(policy.preserveOperatorSelection, true);
    assert.equal(currentProductRouteForState(contact).productKey, 'vit_power_ec');
    assert.equal(contact.metadata.vslProductKey, 'tex_ultra_ec');
    assert.equal(contact.metadata.productKey, 'vit_power_ec');
});

test('produto desconhecido vai para review em vez de Vit Power', () => {
    const route = currentProductRouteForState(state({ customerDraft: {} }));
    assert.equal(route.productKey, '');
    assert.equal(route.needsReview, true);
    assert.equal(route.reason, 'unknown_product_requires_review');
});

test('tres clientes simultaneos mantem contexto independente', () => {
    const a = state({ productKey: 'tex_ultra_ec', customerDraft: { productKey: 'tex_ultra_ec' } });
    const b = state({ productKey: 'nitrix_ec', customerDraft: { productKey: 'nitrix_ec' } });
    const c = state({ productKey: 'vit_power_ec', customerDraft: { productKey: 'vit_power_ec' } });
    applyCurrentProductToState({ state: b, productKey: 'tex_ultra_ec', source: 'panel_customer_product_selection' });
    assert.deepEqual(
        [a, b, c].map((item) => currentProductRouteForState(item).productKey),
        ['tex_ultra_ec', 'tex_ultra_ec', 'vit_power_ec']
    );
});

test('assignedAgent e humano ou nulo e nenhum escritor grava chave de produto', () => {
    const model = read('src/models/ContactState.js');
    assert.match(model, /assignedAgent:\s*\{[\s\S]*?default:\s*null/);
    assert.doesNotMatch(model, /assignedAgent:\s*\{[\s\S]*?enum:\s*EC_PRODUCT_KEYS/);
    const source = [
        'src/routes/zapi.js',
        'src/routes/whatsapp.js',
        'src/services/agentRouter.js',
        'src/services/adminPanelLeadReconciliationService.js',
        'src/services/conversationEngine.js',
        'src/services/ecDirectProductInquiryService.js',
        'src/services/nitrixFastStateService.js',
        'src/services/texUltraFunnelService.js',
        'src/services/texUltraInitialLayerService.js'
    ].map(read).join('\n');
    assert.doesNotMatch(source, /assignedAgent\s*=\s*(?:AGENT_KEY|[^;\n]*productKey)/);
    assert.doesNotMatch(source, /assignedAgent\s*:\s*['"](?:tex_ultra_ec|nitrix_ec|vit_power_ec)['"]/);
});

test('nome submetido vence provider e nomes Eddy/Ulises nao viram telefone', () => {
    const eddy = state({ customerDraft: {} });
    applyInboundCustomerNameEvidence({ state: eddy, submittedName: 'Eddy vaca', profileName: 'Perfil Eddy' });
    assert.equal(resolveCustomerDisplayName({ state: eddy, fallback: '593983724930' }), 'Eddy vaca');
    const ulises = state({ customerDraft: {} });
    applyInboundCustomerNameEvidence({ state: ulises, submittedName: 'Ulises Enriquez', profileName: 'Walvin' });
    assert.equal(resolveCustomerDisplayName({ state: ulises, fallback: '593962559648' }), 'Ulises Enriquez');
});

test('nome manual nao e sobrescrito e conflito Manuel/Alfredo exige decisao', () => {
    const contact = state({ customerDraft: { name: 'Alfredo Martinez' } });
    applyVerifiedCustomerName({ state: contact, name: 'Alfredo Martinez', by: 'Administrador' });
    applyInboundCustomerNameEvidence({ state: contact, submittedName: 'Manuel Zambrano', sourceMessageId: 'wamid-1' });
    assert.equal(contact.metadata.customerDraft.name, 'Alfredo Martinez');
    assert.equal(contact.metadata.identityConflict.status, 'IDENTITY_CONFLICT');
    assert.equal(resolveIdentityConflict({ state: contact, resolution: 'USE_RECEIVED', by: 'Administrador' }), true);
    assert.equal(contact.metadata.customerDraft.name, 'Manuel Zambrano');
    assert.equal(contact.metadata.identityConflict.status, 'RESOLVED');
});

test('auditoria nao grava refresh e deduplica a mesma transicao real', () => {
    const unchanged = panelAuditTransition({
        entityId: 'contact-1',
        action: 'product_change',
        before: { productKey: 'tex_ultra_ec' },
        after: { productKey: 'tex_ultra_ec' }
    });
    assert.equal(unchanged.changed, false);
    const first = panelAuditTransition({
        entityId: 'contact-1',
        action: 'product_change',
        before: { productKey: 'tex_ultra_ec' },
        after: { productKey: 'nitrix_ec' }
    });
    const repeated = panelAuditTransition({
        entityId: 'contact-1',
        action: 'product_change',
        before: { productKey: 'tex_ultra_ec' },
        after: { productKey: 'nitrix_ec' }
    });
    assert.equal(first.changed, true);
    assert.equal(first.messageId, repeated.messageId);
});

test('dashboard usa productKey, preserva seletor e exibe resolucao de conflito', () => {
    const panel = read('public/qr.html');
    assert.match(panel, /<select id="customerProductInput">[\s\S]*value="tex_ultra_ec"[\s\S]*value="nitrix_ec"[\s\S]*value="vit_power_ec"/);
    assert.match(panel, /el\('detailAgent'\)\.textContent = agentLabel\(chat\.productKey\)/);
    assert.doesNotMatch(panel, /productKeyFromChat[\s\S]{0,500}chat\.assignedAgent/);
    assert.match(panel, /identityKeepCurrentBtn/);
    assert.match(panel, /identityUseReceivedBtn/);
});

test('perfis oficiais tem identidade e recursos separados', () => {
    const products = Object.values(ECUADOR_PRODUCTS);
    assert.equal(products.length, 3);
    assert.equal(new Set(products.map((item) => item.key)).size, 3);
    assert.equal(new Set(products.map((item) => item.media)).size, 3);
    assert.equal(new Set(products.map((item) => item.tag)).size, 3);
    for (const product of products) {
        assert.equal(product.country, 'EC');
        assert.equal(product.enabled, true);
        assert.equal(getEcuadorProductInfoByKey(product.key), product);
    }
    assert.doesNotMatch(read('src/services/texUltraProductProfile.js'), /NITRIX_EC_PRODUCT_PROFILE/);
    assert.doesNotMatch(read('src/services/nitrixProductProfile.js'), /TEX_ULTRA_EC_PRODUCT_PROFILE/);
});

test('inbound duplicado exige insert novo antes de rotear resposta comercial', () => {
    const zapi = read('src/routes/zapi.js');
    assert.match(zapi, /\{ _id: messageId \}[\s\S]*\$setOnInsert/);
    assert.match(zapi, /routeToBot:\s*newMessage\s*&&\s*Boolean\(normalizedBody\)/);
});

test('leituras do dashboard permanecem sem persistencia e status usa transicao material', () => {
    const route = read('src/routes/whatsapp.js');
    const chats = route.slice(route.indexOf("router.get('/chats'"), route.indexOf("router.get('/messages/"));
    assert.match(chats, /persistChanges:\s*false/g);
    assert.doesNotMatch(chats, /registerPanelAction\(/);
    assert.match(route, /statusTransition\.changed/);
    assert.match(route, /before:\s*beforeStatus,\s*after:\s*afterStatus/);
});
