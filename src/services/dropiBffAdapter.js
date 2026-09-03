const DEFAULT_BFF_BASE_URL = 'https://api-v2.dropi.ec';

export const DROPI_BFF_BASE_URL = String(
    process.env.DROPPI_EC_BFF_BASE_URL || DEFAULT_BFF_BASE_URL
).replace(/\/+$/, '');

export const DROPI_BFF_LIST_ENDPOINT = process.env.DROPPI_EC_BFF_LIST_ENDPOINT
    || `${DROPI_BFF_BASE_URL}/bff/orders/myorders/v2`;

export const DROPI_BFF_CREATE_ENDPOINT = process.env.DROPPI_EC_BFF_CREATE_ENDPOINT
    || `${DROPI_BFF_BASE_URL}/bff/orders`;

export const DROPI_BFF_QUOTE_ENDPOINT = process.env.DROPPI_EC_BFF_QUOTE_ENDPOINT
    || `${DROPI_BFF_BASE_URL}/bff/orders/quote`;

export const DROPI_BFF_CATALOG_ENDPOINT = process.env.DROPPI_EC_BFF_CATALOG_ENDPOINT
    || `${DROPI_BFF_BASE_URL}/bff/catalog/products/v4/index`;

const safeRequestId = (value = '') => String(value || '')
    .replace(/[^A-Za-z0-9._:-]/g, '')
    .slice(0, 96);

export const sanitizeDropiBffStatusReason = (value = '') => String(value || '')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
    .replace(/\b[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g, '[REDACTED_JWT]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED_EMAIL]')
    .replace(/\b(?:\+?593|0)?9\d{8}\b/g, '[REDACTED_PHONE]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 280);

const dropiBffStatusReason = (body = {}) => sanitizeDropiBffStatusReason(
    body?.status_reason
    || body?.message
    || body?.error?.status_reason
    || body?.error?.message
    || ''
);

export const parseDropiJwtClaims = (token = '') => {
    try {
        const encoded = String(token || '').split('.')[1];
        if (!encoded) return {};
        const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(Buffer.from(normalized, 'base64').toString('utf8'));
    } catch {
        return {};
    }
};

export const isUnexpiredDropiToken = (token = '', { minimumTtlSeconds = 60 } = {}) => {
    const claims = parseDropiJwtClaims(token);
    const expiresAt = Number(claims.exp || 0);
    return Boolean(expiresAt && expiresAt > (Math.floor(Date.now() / 1000) + minimumTtlSeconds));
};

export const dropiCountryCode = (loginResult = {}) => String(
    loginResult?.countries?.[0]?.code
    || loginResult?.configurations?.[0]?.code
    || loginResult?.configurations?.[0]?.country_code
    || 'ec'
).trim().toLowerCase();

export const dropiAccountIdentity = (loginResult = {}) => ({
    id: String(loginResult?.objects?.id || loginResult?.user?.id || '').trim(),
    email: String(loginResult?.objects?.email || loginResult?.objects?.username || '').trim().toLowerCase()
});

export const sameDropiAccountIdentity = (expected = {}, actual = {}) => {
    const left = dropiAccountIdentity(expected);
    const right = dropiAccountIdentity(actual);
    if (left.id && right.id) return left.id === right.id;
    if (left.email && right.email) return left.email === right.email;
    return false;
};

export const normalizeDropiBffListResponse = (body = {}) => ({
    isSuccess: body?.is_succesfull ?? body?.isSuccess ?? false,
    objects: Array.isArray(body?.data?.objects)
        ? body.data.objects
        : (Array.isArray(body?.objects) ? body.objects : []),
    count: Number(body?.data?.count ?? body?.count ?? 0) || 0
});

export const normalizeDropiBffCreateResponse = (body = {}) => {
    const rawOrder = body?.data?.orderId ?? body?.objects ?? body?.data ?? null;
    const firstOrder = Array.isArray(rawOrder) ? rawOrder[0] : rawOrder;
    const objects = firstOrder && typeof firstOrder === 'object'
        ? { ...firstOrder }
        : (firstOrder !== null && firstOrder !== undefined && String(firstOrder).trim()
            ? { id: String(firstOrder).trim() }
            : {});
    if (!objects.id && body?.data?.id) objects.id = body.data.id;
    return {
        isSuccess: body?.is_succesfull ?? body?.isSuccess ?? false,
        statusCode: body?.status_code ?? body?.statusCode ?? null,
        message: dropiBffStatusReason(body),
        data: body?.data?.orderId ?? body?.data ?? null,
        objects
    };
};

export const classifyDropiBffFailure = ({ status = 0, timedOut = false, body = {}, statusReason = '' } = {}) => {
    if (timedOut) return 'TIMEOUT';
    if (status === 401 || status === 403) return 'AUTH_FAILED';
    if (status === 409) return 'DUPLICATE';
    if (status === 422 || (status >= 400 && status < 500 && status !== 429)) return 'VALIDATION_ERROR';
    if (status === 429) return 'RATE_LIMIT';
    if (status >= 500) return 'DROPI_5XX';
    const reason = sanitizeDropiBffStatusReason(statusReason || dropiBffStatusReason(body));
    if (/saldo|wallet|cr[eé]dito|credito|balance|credit/i.test(reason)) return 'PAYMENT_REQUIRED';
    if (/autentic|sesi[oó]n|session|token|credencial|unauthor|forbidden/i.test(reason)) return 'AUTH_FAILED';
    if (/duplicad|duplicate|ya existe|already exists/i.test(reason)) return 'DUPLICATE';
    if (/producto|product|sku|stock|inventario|inventory|variaci[oó]n|variation/i.test(reason)) return 'PRODUCT_INVALID';
    if (/ciudad|city|provincia|province|departamento|state|direcci[oó]n|address|ubicaci[oó]n|location/i.test(reason)) return 'LOCATION_INVALID';
    if (/transportadora|carrier|servientrega|laar|tarifa|shipping|recaudo/i.test(reason)) return 'CARRIER_INVALID';
    if (/validaci[oó]n|validation|campo|field|obligatori|required|inv[aá]lid|invalid/i.test(reason)) return 'VALIDATION_ERROR';
    return 'DROPI_ERROR';
};

export const classifyDropiBffTransportError = (error = {}, { timedOut = false } = {}) => {
    if (timedOut) return 'TIMEOUT';
    const name = String(error?.name || '').trim();
    const code = String(error?.cause?.code || error?.code || '').trim().toUpperCase();
    const message = String(error?.message || error?.cause?.message || '').trim();
    const combined = `${name} ${code} ${message}`;
    if (/Target page|browser.*closed|context.*closed|Execution context was destroyed/i.test(combined)) return 'BROWSER_CONTEXT_LOST';
    if (/ENOTFOUND|EAI_AGAIN|DNS|ERR_NAME_NOT_RESOLVED/i.test(combined)) return 'DNS_FAILURE';
    if (/CERT|TLS|SSL|ERR_SSL|ERR_CERT|UNABLE_TO_VERIFY|SELF_SIGNED/i.test(combined)) return 'TLS_FAILURE';
    if (/ECONNRESET|UND_ERR_SOCKET|ERR_CONNECTION_RESET|socket hang up/i.test(combined)) return 'CONNECTION_RESET';
    if (name === 'AbortError' || /ABORT_ERR|aborted/i.test(combined)) return 'ABORTED';
    if (/fetch failed|Failed to fetch|NetworkError/i.test(combined)) return 'FETCH_FAILED';
    return message || name || code ? 'NO_RESPONSE' : 'NO_RESPONSE';
};

export const describeDropiBffFailure = (code, statusReason = '') => {
    const base = ({
    AUTH_FAILED: 'A sessao oficial Dropi expirou ou foi recusada.',
    PRODUCT_INVALID: 'O produto/SKU nao foi aceito para este pedido.',
    LOCATION_INVALID: 'Provincia, cidade ou endereco nao foi aceito pela Dropi.',
    CARRIER_INVALID: 'A transportadora ou modalidade de entrega nao foi aceita.',
    VALIDATION_ERROR: 'A Dropi recusou um ou mais campos obrigatorios do pedido.',
    DUPLICATE: 'A Dropi sinalizou possivel pedido duplicado; o envio nao foi repetido.',
    RATE_LIMIT: 'A Dropi limitou temporariamente as requisicoes; tente novamente manualmente mais tarde.',
    DROPI_5XX: 'A Dropi apresentou erro interno; o pedido foi pesquisado antes de permitir nova tentativa manual.',
    TIMEOUT: 'A Dropi nao confirmou a criacao no tempo limite; o pedido foi pesquisado antes de permitir nova tentativa manual.',
    DNS_FAILURE: 'O DNS da Dropi nao respondeu; nenhum reenvio automatico foi feito.',
    TLS_FAILURE: 'A conexao segura TLS com a Dropi falhou; nenhum reenvio automatico foi feito.',
    CONNECTION_RESET: 'A conexao com a Dropi foi interrompida; o pedido foi pesquisado antes de permitir nova tentativa manual.',
    ABORTED: 'A requisicao para a Dropi foi interrompida; o pedido foi pesquisado antes de permitir nova tentativa manual.',
    BROWSER_CONTEXT_LOST: 'A sessao de navegador da Dropi foi encerrada; nenhum reenvio automatico foi feito.',
    FETCH_FAILED: 'O transporte HTTP para a Dropi falhou; o pedido foi pesquisado antes de permitir nova tentativa manual.',
    NO_RESPONSE: 'A Dropi nao devolveu resposta HTTP; o pedido foi pesquisado antes de permitir nova tentativa manual.',
    INVALID_RESPONSE: 'A Dropi devolveu uma resposta que nao pode ser validada; o pedido foi pesquisado antes de permitir nova tentativa manual.',
    PAYMENT_REQUIRED: 'A Dropi recusou o envio por saldo ou credito insuficiente.',
    DROPI_ERROR: 'A Dropi nao confirmou a criacao do pedido.'
    }[code] || 'A Dropi nao confirmou a criacao do pedido.');
    const safeReason = sanitizeDropiBffStatusReason(statusReason);
    return safeReason ? `${base} Detalhe Dropi: ${safeReason}` : base;
};

export const validateDropiBffCreatePayload = (payload = {}) => {
    const product = Array.isArray(payload.products) ? payload.products[0] : null;
    const phone = String(payload.phone || '').replace(/\D/g, '');
    const checks = [
        ['PRODUCT_INVALID', Boolean(product?.id && product?.user_id && (product?.variation_id || product?.id))],
        ['PRODUCT_INVALID', Number(product?.quantity || 0) > 0 && Number(product?.price || 0) > 0],
        ['LOCATION_INVALID', Boolean(String(payload.state || '').trim() && String(payload.city || '').trim() && String(payload.dir || '').trim())],
        ['VALIDATION_ERROR', /^5939\d{8}$/.test(phone)],
        ['VALIDATION_ERROR', Boolean(payload.user_id && payload.supplier_id)],
        ['VALIDATION_ERROR', payload.rate_type === 'CON RECAUDO' && payload.type === 'FINAL_ORDER'],
        ['CARRIER_INVALID', Boolean(payload.distributionCompany?.id && payload.distributionCompany?.name && payload.type_service)],
        ['VALIDATION_ERROR', Boolean(payload.warehouses_selected_id)],
        ['VALIDATION_ERROR', Boolean(String(payload.notes || '').trim())]
    ];
    const failed = checks.find(([, ok]) => !ok);
    return failed
        ? { ok: false, code: failed[0] }
        : { ok: true, code: 'VALID' };
};

export const buildDropiBffHeaders = ({ token, countryCode = 'ec', operation = 'list' } = {}) => {
    const headers = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Authorization': `Bearer ${String(token || '')}`
    };
    if (operation === 'list') {
        headers.Authorization = `Bearer ${String(token || '')}`;
        headers['X-Host'] = String(countryCode || 'ec').toLowerCase();
    } else {
        headers['x-captcha-token'] = '';
    }
    return headers;
};

export const requestDropiBff = async ({
    fetchImpl = globalThis.fetch,
    url,
    method = 'GET',
    token,
    countryCode = 'ec',
    operation = 'list',
    payload,
    timeoutMs = 30000,
    onLifecycle = null
} = {}) => {
    if (typeof fetchImpl !== 'function') throw new Error('DROPI_FETCH_UNAVAILABLE');
    const controller = new AbortController();
    const startedAt = Date.now();
    let timeoutTriggered = false;
    const timer = setTimeout(() => {
        timeoutTriggered = true;
        controller.abort();
    }, Math.max(1000, Number(timeoutMs) || 30000));
    const parsedUrl = (() => {
        try { return new URL(url); } catch { return null; }
    })();
    const lifecycle = {
        operation: String(operation || ''),
        method: String(method || 'GET').toUpperCase(),
        host: parsedUrl?.host || '',
        path: parsedUrl?.pathname || '',
        stage: 'prepared',
        requestStarted: false,
        requestDispatched: false,
        responseReceived: false,
        bodyParsed: false,
        elapsedMs: 0,
        transportCategory: ''
    };
    const notifyLifecycle = async (stage) => {
        lifecycle.stage = stage;
        lifecycle.elapsedMs = Date.now() - startedAt;
        if (typeof onLifecycle === 'function') await onLifecycle({ ...lifecycle });
    };
    try {
        lifecycle.requestStarted = true;
        await notifyLifecycle('request_started');
        const responsePromise = fetchImpl(url, {
            method,
            headers: buildDropiBffHeaders({ token, countryCode, operation }),
            ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
            signal: controller.signal
        });
        lifecycle.requestDispatched = true;
        await notifyLifecycle('request_dispatched');
        const response = await responsePromise;
        lifecycle.responseReceived = true;
        await notifyLifecycle('response_received');
        let body = {};
        try {
            body = await response.json();
            lifecycle.bodyParsed = true;
        } catch {
            lifecycle.bodyParsed = false;
        }
        lifecycle.transportCategory = lifecycle.bodyParsed ? 'http_response' : 'body_parse_failed';
        await notifyLifecycle(lifecycle.bodyParsed ? 'body_parsed' : 'body_parse_failed');
        const responseOk = response.ok && lifecycle.bodyParsed;
        return {
            ok: responseOk,
            status: response.status,
            body,
            statusReason: dropiBffStatusReason(body),
            requestId: safeRequestId(
                response.headers?.get?.('x-request-id')
                || response.headers?.get?.('request-id')
                || response.headers?.get?.('x-correlation-id')
                || ''
            ),
            timedOut: false,
            errorCode: responseOk
                ? ''
                : (lifecycle.bodyParsed ? classifyDropiBffFailure({ status: response.status }) : 'INVALID_RESPONSE'),
            lifecycle: { ...lifecycle }
        };
    } catch (error) {
        const timedOut = timeoutTriggered;
        const errorCode = classifyDropiBffTransportError(error, { timedOut });
        lifecycle.transportCategory = errorCode.toLowerCase();
        await notifyLifecycle('transport_failed').catch(() => null);
        return {
            ok: false,
            status: 0,
            body: {},
            statusReason: '',
            requestId: '',
            timedOut,
            errorCode,
            lifecycle: { ...lifecycle }
        };
    } finally {
        clearTimeout(timer);
    }
};
