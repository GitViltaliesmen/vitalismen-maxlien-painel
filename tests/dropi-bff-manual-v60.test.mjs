import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
    DROPI_BFF_CREATE_ENDPOINT,
    DROPI_BFF_LIST_ENDPOINT,
    buildDropiBffHeaders,
    classifyDropiBffFailure,
    classifyDropiBffTransportError,
    isUnexpiredDropiToken,
    normalizeDropiBffCreateResponse,
    normalizeDropiBffListResponse,
    requestDropiBff,
    sanitizeDropiBffStatusReason,
    validateDropiBffCreatePayload
} from '../src/services/dropiBffAdapter.js';

const response = ({ status = 200, body = {}, requestId = '' } = {}) => ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => (name.toLowerCase() === 'x-request-id' ? requestId : '') },
    json: async () => body
});

const validCreatePayload = () => ({
    name: 'Cliente',
    surname: 'EC',
    dir: 'Direccion valida',
    country: 'ECUADOR',
    state: 'Santa Elena',
    city: 'Salinas',
    phone: '593999999999',
    user_id: 1,
    supplier_id: 2,
    type: 'FINAL_ORDER',
    rate_type: 'CON RECAUDO',
    products: [{ id: 3, variation_id: 4, user_id: 2, quantity: 1, price: 35.99 }],
    distributionCompany: { id: 5, name: 'SERVIENTREGA' },
    type_service: 'normal',
    warehouses_selected_id: 6,
    notes: 'EC-MANUAL-TEST'
});

test('BFF autenticada usa o contrato oficial de listagem', async () => {
    let captured;
    const result = await requestDropiBff({
        fetchImpl: async (url, options) => {
            captured = { url, options };
            return response({ body: { is_succesfull: true, data: { objects: [{ id: 1 }], count: 1 } } });
        },
        url: DROPI_BFF_LIST_ENDPOINT,
        token: 'token-de-teste',
        countryCode: 'ec',
        operation: 'list'
    });
    assert.equal(captured.url, 'https://api-v2.dropi.ec/bff/orders/myorders/v2');
    assert.equal(captured.options.headers.Authorization, 'Bearer token-de-teste');
    assert.equal(captured.options.headers['X-Authorization'], 'Bearer token-de-teste');
    assert.equal(captured.options.headers['X-Host'], 'ec');
    assert.deepEqual(normalizeDropiBffListResponse(result.body).objects, [{ id: 1 }]);
});

test('criacao BFF 2xx usa POST e normaliza orderId', async () => {
    let captured;
    const result = await requestDropiBff({
        fetchImpl: async (url, options) => {
            captured = { url, options };
            return response({
                status: 201,
                body: { is_succesfull: true, data: { orderId: { id: 987654 } } },
                requestId: 'req-test-1'
            });
        },
        url: DROPI_BFF_CREATE_ENDPOINT,
        method: 'POST',
        token: 'token-de-teste',
        operation: 'create',
        payload: validCreatePayload()
    });
    assert.equal(captured.url, 'https://api-v2.dropi.ec/bff/orders');
    assert.equal(captured.options.method, 'POST');
    assert.equal(captured.options.headers['X-Authorization'], 'Bearer token-de-teste');
    assert.equal(captured.options.headers['x-captcha-token'], '');
    assert.equal(captured.options.headers.Authorization, undefined);
    assert.equal(result.requestId, 'req-test-1');
    assert.equal(result.lifecycle.requestStarted, true);
    assert.equal(result.lifecycle.requestDispatched, true);
    assert.equal(result.lifecycle.responseReceived, true);
    assert.equal(result.lifecycle.bodyParsed, true);
    assert.equal(result.lifecycle.host, 'api-v2.dropi.ec');
    assert.equal(result.lifecycle.path, '/bff/orders');
    assert.equal(normalizeDropiBffCreateResponse(result.body).objects.id, 987654);
});

test('rejeicao logica HTTP 200 preserva somente detalhe sanitizado', async () => {
    const result = await requestDropiBff({
        fetchImpl: async () => response({
            status: 200,
            body: {
                is_succesfull: false,
                status_code: 422,
                status_reason: 'El campo ciudad es obligatorio para 593999999999 y operador@ejemplo.com'
            }
        }),
        url: DROPI_BFF_CREATE_ENDPOINT,
        method: 'POST',
        token: 'token-de-teste',
        operation: 'create',
        payload: validCreatePayload()
    });
    const normalized = normalizeDropiBffCreateResponse(result.body);
    assert.equal(normalized.isSuccess, false);
    assert.equal(normalized.statusCode, 422);
    assert.equal(result.statusReason.includes('593999999999'), false);
    assert.equal(result.statusReason.includes('operador@ejemplo.com'), false);
    assert.match(result.statusReason, /\[REDACTED_PHONE\]/);
    assert.match(result.statusReason, /\[REDACTED_EMAIL\]/);
    assert.equal(classifyDropiBffFailure({ ...result, statusReason: result.statusReason }), 'LOCATION_INVALID');
});

test('sanitizacao remove bearer e JWT do detalhe Dropi', () => {
    const jwt = `${'a'.repeat(20)}.${'b'.repeat(20)}.${'c'.repeat(20)}`;
    const sanitized = sanitizeDropiBffStatusReason(`Authorization Bearer segredo-super-longo ${jwt}`);
    assert.equal(sanitized.includes('segredo-super-longo'), false);
    assert.equal(sanitized.includes(jwt), false);
});

test('pedido duplicado e classificado sem segundo POST', () => {
    assert.equal(classifyDropiBffFailure({ status: 409 }), 'DUPLICATE');
});

test('sessao JWT expirada e recusada', () => {
    const payload = Buffer.from(JSON.stringify({ exp: 1 })).toString('base64url');
    assert.equal(isUnexpiredDropiToken(`x.${payload}.y`), false);
});

test('status HTTP 400/401/403/409/422/429/500/502/503 mantem categorias deterministicas', () => {
    const cases = new Map([
        [400, 'VALIDATION_ERROR'],
        [401, 'AUTH_FAILED'],
        [403, 'AUTH_FAILED'],
        [409, 'DUPLICATE'],
        [422, 'VALIDATION_ERROR'],
        [429, 'RATE_LIMIT'],
        [500, 'DROPI_5XX'],
        [502, 'DROPI_5XX'],
        [503, 'DROPI_5XX']
    ]);
    for (const [status, expected] of cases) {
        assert.equal(classifyDropiBffFailure({ status }), expected, `HTTP ${status}`);
    }
});

test('timeout, DNS, TLS, reset, abort, browser fechado, fetch failed e sem resposta sao distintos', () => {
    const error = (message, code = '', name = 'Error') => ({ name, message, cause: code ? { code } : undefined });
    assert.equal(classifyDropiBffTransportError(error('aborted', '', 'AbortError'), { timedOut: true }), 'TIMEOUT');
    assert.equal(classifyDropiBffTransportError(error('getaddrinfo ENOTFOUND', 'ENOTFOUND')), 'DNS_FAILURE');
    assert.equal(classifyDropiBffTransportError(error('certificate expired', 'CERT_HAS_EXPIRED')), 'TLS_FAILURE');
    assert.equal(classifyDropiBffTransportError(error('socket hang up', 'ECONNRESET')), 'CONNECTION_RESET');
    assert.equal(classifyDropiBffTransportError(error('aborted', '', 'AbortError')), 'ABORTED');
    assert.equal(classifyDropiBffTransportError(error('Target page, context or browser has been closed')), 'BROWSER_CONTEXT_LOST');
    assert.equal(classifyDropiBffTransportError(error('fetch failed', '', 'TypeError')), 'FETCH_FAILED');
    assert.equal(classifyDropiBffTransportError(error('upstream vanished')), 'NO_RESPONSE');
});

test('falha assincrona depois de iniciar fetch marca POST despachado sem vazar detalhe', async () => {
    const transportError = new Error('fetch failed com dado interno que nao deve vazar');
    transportError.cause = { code: 'ECONNRESET' };
    const lifecycleStages = [];
    const result = await requestDropiBff({
        fetchImpl: async () => { throw transportError; },
        url: DROPI_BFF_CREATE_ENDPOINT,
        method: 'POST',
        token: 'token-de-teste',
        operation: 'create',
        payload: validCreatePayload(),
        onLifecycle: (lifecycle) => lifecycleStages.push(lifecycle.stage)
    });
    assert.equal(result.errorCode, 'CONNECTION_RESET');
    assert.equal(result.lifecycle.requestStarted, true);
    assert.equal(result.lifecycle.requestDispatched, true);
    assert.equal(result.lifecycle.responseReceived, false);
    assert.deepEqual(lifecycleStages, ['request_started', 'request_dispatched', 'transport_failed']);
    assert.equal(JSON.stringify(result).includes('dado interno'), false);
});

test('falha sincrona antes de fetch retornar nao afirma despacho', async () => {
    const result = await requestDropiBff({
        fetchImpl: () => { throw Object.assign(new Error('getaddrinfo'), { code: 'ENOTFOUND' }); },
        url: DROPI_BFF_CREATE_ENDPOINT,
        method: 'POST',
        token: 'token-de-teste',
        operation: 'create',
        payload: validCreatePayload()
    });
    assert.equal(result.errorCode, 'DNS_FAILURE');
    assert.equal(result.lifecycle.requestStarted, true);
    assert.equal(result.lifecycle.requestDispatched, false);
    assert.equal(result.lifecycle.responseReceived, false);
});

test('resposta sem JSON e INVALID_RESPONSE com prova de resposta recebida', async () => {
    const result = await requestDropiBff({
        fetchImpl: async () => ({
            ok: true,
            status: 200,
            headers: { get: () => '' },
            json: async () => { throw new SyntaxError('invalid json'); }
        }),
        url: DROPI_BFF_CREATE_ENDPOINT,
        method: 'POST',
        token: 'token-de-teste',
        operation: 'create',
        payload: validCreatePayload()
    });
    assert.equal(result.ok, false);
    assert.equal(result.errorCode, 'INVALID_RESPONSE');
    assert.equal(result.lifecycle.responseReceived, true);
    assert.equal(result.lifecycle.bodyParsed, false);
});

test('payload invalido falha antes da rede com categoria especifica', () => {
    const invalidProduct = validCreatePayload();
    invalidProduct.products = [];
    assert.deepEqual(validateDropiBffCreatePayload(invalidProduct), { ok: false, code: 'PRODUCT_INVALID' });
    const invalidLocation = validCreatePayload();
    invalidLocation.city = '';
    assert.deepEqual(validateDropiBffCreatePayload(invalidLocation), { ok: false, code: 'LOCATION_INVALID' });
    assert.deepEqual(validateDropiBffCreatePayload(validCreatePayload()), { ok: true, code: 'VALID' });
});

test('idempotencia pesquisa BFF imediatamente antes do unico POST', () => {
    const source = fs.readFileSync('src/services/droppiEcuadorBrowserService.js', 'utf8');
    const flow = source.slice(source.indexOf('const submitOrderInPanel'), source.indexOf('const findMatchingPanelText'));
    const lookup = flow.indexOf('findExistingDropiOrderForManualSubmission(page, payload)');
    const post = flow.indexOf('submitOrderViaDropiApi(page');
    assert.ok(lookup >= 0 && post > lookup);
    assert.match(flow, /apiResult\.lifecycle\?\.requestDispatched/);
    assert.match(flow, /findExistingDropiOrderForManualSubmission\(page, payload\)/g);
    assert.doesNotMatch(source, /retrying_transient_browser_error|droppi_browser_transient_retry/);
    assert.doesNotMatch(source, /for \(let attempt = 1; attempt <= 2/);
    assert.doesNotMatch(source, /submitOrderViaPanelButton/);
    assert.doesNotMatch(source, /api\.dropi\.ec\/api\/orders\/myorders/);
});

test('Tex Ultra usa catalogo, localizacao e cotacao BFF autoritativos antes do create', () => {
    const source = fs.readFileSync('src/services/droppiEcuadorBrowserService.js', 'utf8');
    const start = source.indexOf('const buildTexUltraBffQuote');
    const end = source.indexOf('const submitOrderViaDropiApi', start);
    const flow = source.slice(start, end);
    assert.match(flow, /DROPI_BFF_CATALOG_ENDPOINT/);
    assert.match(flow, /DROPI_BFF_QUOTE_ENDPOINT/);
    assert.match(flow, /sessionData\?\.cities/);
    assert.match(flow, /sessionData\?\.departments/);
    assert.match(flow, /privated_product: false/);
    assert.match(flow, /TEX_ULTRA_BFF_WAREHOUSE_ID/);
    assert.match(flow, /AUTHORITATIVE_CITY_NOT_FOUND/);
    assert.match(flow, /dropi_bff_authoritative_contract/);
});

test('payload create acompanha campos do frontend BunnyHop sem campo legado inventado', () => {
    const source = fs.readFileSync('src/services/droppiEcuadorBrowserService.js', 'utf8');
    const start = source.indexOf('const submitOrderViaDropiApi');
    const end = source.indexOf('const waitForOrderCreationResult', start);
    const flow = source.slice(start, end);
    assert.match(flow, /overload_was_applied: false/);
    assert.match(flow, /dropshipper_amount_to_win:/);
    assert.match(flow, /shipping_amount: shippingAmount/);
    assert.doesNotMatch(flow, /shalom_data/);
    assert.match(flow, /onLifecycle: onCreateLifecycle/);
});

test('sessao oficial e persistida atomicamente fora do Git', () => {
    const source = fs.readFileSync('src/services/droppiEcuadorBrowserService.js', 'utf8');
    assert.match(source, /\.vitalismen-secrets[\s\S]*droppi-ec-storage\.json/);
    assert.match(source, /fs\.openSync\(temporaryPath, 'wx', 0o600\)/);
    assert.match(source, /fs\.fsyncSync\(fd\)/);
    assert.match(source, /fs\.renameSync\(temporaryPath, STORAGE_STATE_PATH\)/);
    assert.match(source, /sameDropiAccountIdentity\(expectedLoginResult, loginResult\)/);
});

test('botao manual individual preserva autorizacao em dois cliques', () => {
    const panel = fs.readFileSync('public/leads-window.html', 'utf8');
    assert.match(panel, /authorize-submit/);
    assert.match(panel, /autorizado; clique novamente para enviar/);
    assert.match(panel, /droppi\/ec\/orders\/\$\{encodeURIComponent\(orderId\)\}\/submit/);
});

test('multiplos selecionados sao processados em serie e falha intermediaria nao cria paralelismo', () => {
    const panel = fs.readFileSync('public/leads-window.html', 'utf8');
    const bulk = panel.slice(panel.indexOf('const sendSelectedDropi'), panel.indexOf('const setCountry'));
    assert.match(bulk, /for \(const lead of leadsToSend\)/);
    assert.match(bulk, /await sendLeadToDropiFromSelection\(lead\)/);
    assert.doesNotMatch(bulk, /Promise\.all/);
});

test('nenhum scheduler ou confirmacao dispara criacao automatica Dropi', () => {
    const scheduler = fs.readFileSync('src/services/schedulerService.js', 'utf8');
    const routes = fs.readFileSync('src/routes/shipments.js', 'utf8');
    assert.doesNotMatch(scheduler, /submitDroppiEcuadorOrder|enqueueDropiSubmitJob/);
    assert.match(routes, /router\.post\('\/droppi\/ec\/orders\/:orderId\/submit', adminOnly/);
    assert.match(routes, /if \(dryRun !== false\)/);
});

test('headers nunca incluem cookies ou CSRF inventado', () => {
    const list = buildDropiBffHeaders({ token: 'x', countryCode: 'ec', operation: 'list' });
    const create = buildDropiBffHeaders({ token: 'x', operation: 'create' });
    assert.equal(list.Cookie, undefined);
    assert.equal(create.Cookie, undefined);
    assert.equal(create['X-CSRF-Token'], undefined);
});
