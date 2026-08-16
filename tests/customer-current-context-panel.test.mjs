import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(projectRoot, 'public', 'panel-intelligence', 'customer-current-context-v16.js'), 'utf8');
const sandbox = { AbortController, Date, Intl, URL, console, encodeURIComponent, globalThis: null };
sandbox.globalThis = sandbox;
vm.runInNewContext(source, sandbox, { filename: 'customer-current-context-v16.js' });
const panelApi = sandbox.VitalismenCustomerCurrentContextV16;

const field = (value = null, confidence = 'DESCONHECIDO', options = {}) => ({
    field: options.field || 'field',
    value,
    source: options.source || { kind: value === null ? 'none' : 'customer_message' },
    confidence,
    updatedAt: options.updatedAt || null,
    inferred: Boolean(options.inferred),
    conflicted: Boolean(options.conflicted),
    candidates: options.candidates || [],
    applicationAllowed: false
});

const baseContext = (overrides = {}) => ({
    schemaVersion: panelApi.SCHEMA_VERSION,
    generatedAt: '2026-08-16T18:00:00.000Z',
    readOnly: true,
    applicationAllowed: false,
    match: { method: 'canonical_ec_phone', candidates: ['593991234567'], ambiguous: false },
    customer: {
        phone: field('593991234567', 'ALTA_CONFIANCA'),
        identity: { name: field(), detectedName: field(), applicationAllowed: false },
        location: {
            city: field(), province: field(), address: field(), reference: field(),
            sector: field(), agency: field(), deliveryMode: field(), applicationAllowed: false
        },
        currentProduct: { product: field(), quantity: field(), total: field(), applicationAllowed: false },
        vslOrigin: {
            path: field(), sourceUrl: field(), product: field(), testId: field(), variant: field(), applicationAllowed: false
        },
        currentOrder: field(),
        history: [],
        funnel: { stage: field(), humanMode: field(), lastInboundAt: field(), lastOutboundAt: field(), applicationAllowed: false },
        conflicts: [],
        applicationAllowed: false,
        ...(overrides.customer || {})
    },
    ...overrides,
    customer: {
        phone: field('593991234567', 'ALTA_CONFIANCA'),
        identity: { name: field(), detectedName: field(), applicationAllowed: false },
        location: {
            city: field(), province: field(), address: field(), reference: field(),
            sector: field(), agency: field(), deliveryMode: field(), applicationAllowed: false
        },
        currentProduct: { product: field(), quantity: field(), total: field(), applicationAllowed: false },
        vslOrigin: {
            path: field(), sourceUrl: field(), product: field(), testId: field(), variant: field(), applicationAllowed: false
        },
        currentOrder: field(),
        history: [],
        funnel: { stage: field(), humanMode: field(), lastInboundAt: field(), lastOutboundAt: field(), applicationAllowed: false },
        conflicts: [],
        applicationAllowed: false,
        ...(overrides.customer || {})
    }
});

const fakeRoot = () => ({ innerHTML: '', dataset: {} });
const createPanel = (contextOrRequest) => {
    const rootElement = fakeRoot();
    const request = typeof contextOrRequest === 'function'
        ? contextOrRequest
        : async () => contextOrRequest;
    return { rootElement, panel: panelApi.createPanel({ rootElement, request }) };
};

const deferred = () => {
    let resolve;
    let reject;
    const promise = new Promise((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, resolve, reject };
};

test('cliente sem dados mostra estado seguro e oito blocos read-only', async () => {
    const { rootElement, panel } = createPanel(baseContext({
        customer: { phone: field(), applicationAllowed: false }
    }));
    await panel.selectPhone('593991234567');
    assert.equal(panel.snapshot().state, 'insufficient');
    assert.match(rootElement.innerHTML, /SEM DADOS SUFICIENTES/);
    for (const block of ['IDENTIDADE', 'LOCALIZAÇÃO', 'PRODUTO ATUAL', 'ORIGEM \/ VSL', 'PEDIDO ATUAL', 'HISTÓRICO', 'FUNIL', 'CONFLITOS']) {
        assert.match(rootElement.innerHTML, new RegExp(block));
    }
});

test('cliente completo apresenta identidade, localizacao, produto e funil', async () => {
    const context = baseContext({ customer: {
        identity: { name: field('Juan Teste', 'CONFIRMADO'), detectedName: field('Juan', 'PROVAVEL'), applicationAllowed: false },
        location: { city: field('Quito', 'ALTA_CONFIANCA'), province: field('Pichincha', 'ALTA_CONFIANCA'), applicationAllowed: false },
        currentProduct: { product: field({ key: 'tex_ultra_ec', name: 'Tex Ultra Ecuador' }, 'CONFIRMADO'), applicationAllowed: false },
        funnel: { stage: field('confirmacao', 'ALTA_CONFIANCA'), applicationAllowed: false },
        applicationAllowed: false
    }});
    const { rootElement, panel } = createPanel(context);
    await panel.selectPhone('593991234567');
    assert.equal(panel.snapshot().state, 'available');
    assert.match(rootElement.innerHTML, /Juan Teste/);
    assert.match(rootElement.innerHTML, /Quito/);
    assert.match(rootElement.innerHTML, /Tex Ultra Ecuador/);
    assert.match(rootElement.innerHTML, /confirmacao/);
});

test('nome confirmado exibe valor, origem, confianca e atualizacao', async () => {
    const context = baseContext({ customer: {
        identity: { name: field('Ana Confirmada', 'CONFIRMADO', { updatedAt: '2026-08-16T17:00:00.000Z' }), applicationAllowed: false },
        applicationAllowed: false
    }});
    const { rootElement, panel } = createPanel(context);
    await panel.selectPhone('593991234567');
    assert.match(rootElement.innerHTML, /Ana Confirmada/);
    assert.match(rootElement.innerHTML, /Mensagem do cliente/);
    assert.match(rootElement.innerHTML, /CONFIRMADO/);
    assert.match(rootElement.innerHTML, /Atualização/);
});

test('produto desconhecido permanece sem prova e DESCONHECIDO', async () => {
    const { rootElement, panel } = createPanel(baseContext());
    await panel.selectPhone('593991234567');
    assert.match(rootElement.innerHTML, /Produto atual/);
    assert.match(rootElement.innerHTML, /Sem prova/);
    assert.match(rootElement.innerHTML, /DESCONHECIDO/);
});

test('VSL diferente da negociacao apresenta os dois produtos sem substituir', async () => {
    const context = baseContext({ customer: {
        currentProduct: { product: field({ key: 'tex_ultra_ec', name: 'Tex Ultra Ecuador' }, 'CONFIRMADO'), applicationAllowed: false },
        vslOrigin: { product: field({ key: 'vit_power_ec', name: 'Vit Power Ecuador' }, 'ALTA_CONFIANCA'), applicationAllowed: false },
        applicationAllowed: false
    }});
    const { rootElement, panel } = createPanel(context);
    await panel.selectPhone('593991234567');
    assert.match(rootElement.innerHTML, /Tex Ultra Ecuador/);
    assert.match(rootElement.innerHTML, /Vit Power Ecuador/);
});

test('conflito mostra atencao, candidatos e nenhuma alteracao', async () => {
    const context = baseContext({ customer: {
        conflicts: [{
            code: 'VSL_NEGOTIATION_DIVERGENCE',
            confidence: 'CONFLITO',
            candidates: [
                { value: { name: 'Vit Power Ecuador' }, source: { kind: 'claimed_vsl_visit' }, confidence: 'ALTA_CONFIANCA' },
                { value: { name: 'Tex Ultra Ecuador' }, source: { kind: 'customer_message' }, confidence: 'CONFIRMADO' }
            ],
            reviewRequired: true,
            applicationAllowed: false
        }],
        applicationAllowed: false
    }});
    const { rootElement, panel } = createPanel(context);
    await panel.selectPhone('593991234567');
    assert.match(rootElement.innerHTML, /ATENÇÃO/);
    assert.match(rootElement.innerHTML, /Origem\/VSL e negociação atual são diferentes/);
    assert.match(rootElement.innerHTML, /Nenhuma alteração foi realizada/);
});

test('ambiguidade usa estado visual de revisao humana', async () => {
    const context = baseContext({
        match: { method: 'ambiguous_tail', candidates: ['593991234567', '593891234567'], ambiguous: true },
        customer: { phone: field(null, 'AMBIGUO'), applicationAllowed: false }
    });
    const { rootElement, panel } = createPanel(context);
    await panel.selectPhone('91234567');
    assert.equal(panel.snapshot().state, 'ambiguous');
    assert.match(rootElement.innerHTML, /CONTEXTO AMBÍGUO/);
});

test('historico apresenta pedido terminal sem controles', async () => {
    const context = baseContext({ customer: {
        history: [{
            orderId: 'EC-HIST-1', status: 'delivered', product: { name: 'Vit Power Ecuador' },
            quantity: 1, total: 39.99, currency: 'USD', customer: { city: 'Quito' },
            shipment: { status: 'delivered', trackingNumber: 'TRACK-HIST-1', delivered: true, applicationAllowed: false },
            updatedAt: '2026-08-15T12:00:00.000Z', source: { kind: 'historical_order' },
            confidence: 'ALTA_CONFIANCA', readOnly: true, applicationAllowed: false
        }],
        applicationAllowed: false
    }});
    const { rootElement, panel } = createPanel(context);
    await panel.selectPhone('593991234567');
    assert.match(rootElement.innerHTML, /EC-HIST-1/);
    assert.match(rootElement.innerHTML, /TRACK-HIST-1/);
    assert.match(rootElement.innerHTML, /delivered/);
});

test('pedido atual apresenta resumo e proveniencia', async () => {
    const context = baseContext({ customer: {
        currentOrder: field({
            orderId: 'EC-ATUAL-1', status: 'confirmed', product: { name: 'Tex Ultra Ecuador' },
            quantity: 2, total: 70, customer: { city: 'Guayaquil', province: 'Guayas' }, readOnly: true, applicationAllowed: false
        }, 'CONFIRMADO', { source: { kind: 'explicit_current_order_link' } }),
        applicationAllowed: false
    }});
    const { rootElement, panel } = createPanel(context);
    await panel.selectPhone('593991234567');
    assert.match(rootElement.innerHTML, /EC-ATUAL-1/);
    assert.match(rootElement.innerHTML, /Vínculo explícito do pedido/);
    assert.match(rootElement.innerHTML, /USD 70\.00/);
});

test('mudanca rapida cliente A para B aborta a requisicao anterior', async () => {
    const calls = [];
    const pendingA = deferred();
    const pendingB = deferred();
    const { panel } = createPanel((url, options) => {
        calls.push({ url, options });
        return url.endsWith('0001') ? pendingA.promise : pendingB.promise;
    });
    const first = panel.selectPhone('593990000001');
    const second = panel.selectPhone('593990000002');
    assert.equal(calls.length, 2);
    assert.equal(calls[0].options.signal.aborted, true);
    pendingB.resolve(baseContext({ customer: { identity: { name: field('Cliente B', 'CONFIRMADO'), applicationAllowed: false }, applicationAllowed: false } }));
    await second;
    pendingA.resolve(baseContext({ customer: { identity: { name: field('Cliente A', 'CONFIRMADO'), applicationAllowed: false }, applicationAllowed: false } }));
    await first;
});

test('resposta atrasada do cliente A nunca sobrescreve cliente B', async () => {
    const pendingA = deferred();
    const pendingB = deferred();
    const { rootElement, panel } = createPanel((url) => url.endsWith('0001') ? pendingA.promise : pendingB.promise);
    const first = panel.selectPhone('593990000001');
    const second = panel.selectPhone('593990000002');
    pendingB.resolve(baseContext({ customer: { identity: { name: field('Cliente B Atual', 'CONFIRMADO'), applicationAllowed: false }, applicationAllowed: false } }));
    await second;
    pendingA.resolve(baseContext({ customer: { identity: { name: field('Cliente A Antigo', 'CONFIRMADO'), applicationAllowed: false }, applicationAllowed: false } }));
    await first;
    assert.match(rootElement.innerHTML, /Cliente B Atual/);
    assert.doesNotMatch(rootElement.innerHTML, /Cliente A Antigo/);
    assert.equal(panel.snapshot().phone, '593990000002');
});

for (const [status, expected] of [[401, 'Sessão não autorizada'], [400, 'telefone selecionado'], [500, 'Não foi possível carregar']]) {
    test(`erro HTTP ${status} mostra estado seguro`, async () => {
        const error = Object.assign(new Error(`erro ${status}`), { status });
        const { rootElement, panel } = createPanel(async () => { throw error; });
        await panel.selectPhone('593991234567');
        assert.equal(panel.snapshot().state, 'error');
        assert.match(rootElement.innerHTML, /ERRO AO CARREGAR/);
        assert.match(rootElement.innerHTML, new RegExp(expected));
        assert.doesNotMatch(rootElement.innerHTML, new RegExp(`erro ${status}`));
    });
}

test('schema incompatível interrompe a apresentação sem adivinhar', async () => {
    const { rootElement, panel } = createPanel({ ...baseContext(), schemaVersion: 'v17.incompativel' });
    await panel.selectPhone('593991234567');
    assert.equal(panel.snapshot().state, 'incompatible');
    assert.match(rootElement.innerHTML, /CONTEXTO INDISPONÍVEL — VERSÃO INCOMPATÍVEL/);
    assert.doesNotMatch(rootElement.innerHTML, /IDENTIDADE/);
});

test('camada visual nao gera elementos editaveis ou botoes', async () => {
    const { rootElement, panel } = createPanel(baseContext({ customer: { identity: { name: field('Somente Leitura', 'CONFIRMADO'), applicationAllowed: false }, applicationAllowed: false } }));
    await panel.selectPhone('593991234567');
    assert.doesNotMatch(rootElement.innerHTML, /<(?:input|select|textarea|button|form)\b/i);
    assert.match(rootElement.innerHTML, /SOMENTE LEITURA/);
});

test('camada usa exclusivamente GET no endpoint da Fatia 1', async () => {
    const calls = [];
    const { panel } = createPanel(async (url, options) => {
        calls.push({ url, options });
        return baseContext();
    });
    await panel.selectPhone('+593 99 123 4567');
    assert.deepEqual(calls.map((call) => ({ url: call.url, method: call.options.method })), [{
        url: '/api/customer-context/593991234567',
        method: 'GET'
    }]);
});

test('consulta visual nao chama persistencia ou envio', async () => {
    const calls = { request: 0, persistence: 0, external: 0 };
    const { panel } = createPanel(async () => {
        calls.request += 1;
        return baseContext({ customer: { identity: { name: field('Imutavel', 'CONFIRMADO'), applicationAllowed: false }, applicationAllowed: false } });
    });
    await panel.selectPhone('593991234567');
    assert.deepEqual(calls, { request: 1, persistence: 0, external: 0 });
    assert.doesNotMatch(source, /\b(?:autosave|persistSelectedCustomerData|panelProductContextForChat|WhatsApp|Dropi|Meta|OpenAI)\b|Z-API|Order\.save|ContactState\.save/i);
});
