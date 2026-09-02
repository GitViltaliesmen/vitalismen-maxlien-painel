const DEFAULT_BFF_BASE_URL = 'https://api-v2.dropi.ec';

export const DROPI_BFF_BASE_URL = String(
    process.env.DROPPI_EC_BFF_BASE_URL || DEFAULT_BFF_BASE_URL
).replace(/\/+$/, '');

export const DROPI_BFF_LIST_ENDPOINT = process.env.DROPPI_EC_BFF_LIST_ENDPOINT
    || `${DROPI_BFF_BASE_URL}/bff/orders/myorders/v2`;

export const DROPI_BFF_CREATE_ENDPOINT = process.env.DROPPI_EC_BFF_CREATE_ENDPOINT
    || `${DROPI_BFF_BASE_URL}/bff/orders`;

const safeRequestId = (value = '') => String(value || '')
    .replace(/[^A-Za-z0-9._:-]/g, '')
    .slice(0, 96);

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
        data: body?.data?.orderId ?? body?.data ?? null,
        objects
    };
};

export const classifyDropiBffFailure = ({ status = 0, timedOut = false } = {}) => {
    if (timedOut) return 'TIMEOUT';
    if (status === 401 || status === 403) return 'AUTH_FAILED';
    if (status === 409) return 'DUPLICATE';
    if (status === 422 || (status >= 400 && status < 500 && status !== 429)) return 'VALIDATION_ERROR';
    if (status === 429) return 'RATE_LIMIT';
    if (status >= 500) return 'DROPI_5XX';
    return 'DROPI_ERROR';
};

export const describeDropiBffFailure = (code) => ({
    AUTH_FAILED: 'A sessao oficial Dropi expirou ou foi recusada.',
    PRODUCT_INVALID: 'O produto/SKU nao foi aceito para este pedido.',
    LOCATION_INVALID: 'Provincia, cidade ou endereco nao foi aceito pela Dropi.',
    CARRIER_INVALID: 'A transportadora ou modalidade de entrega nao foi aceita.',
    VALIDATION_ERROR: 'A Dropi recusou um ou mais campos obrigatorios do pedido.',
    DUPLICATE: 'A Dropi sinalizou possivel pedido duplicado; o envio nao foi repetido.',
    RATE_LIMIT: 'A Dropi limitou temporariamente as requisicoes; tente novamente manualmente mais tarde.',
    DROPI_5XX: 'A Dropi apresentou erro interno; o pedido foi pesquisado antes de permitir nova tentativa manual.',
    TIMEOUT: 'A Dropi nao confirmou a criacao no tempo limite; o pedido foi pesquisado antes de permitir nova tentativa manual.',
    DROPI_ERROR: 'A Dropi nao confirmou a criacao do pedido.'
}[code] || 'A Dropi nao confirmou a criacao do pedido.');

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
    timeoutMs = 30000
} = {}) => {
    if (typeof fetchImpl !== 'function') throw new Error('DROPI_FETCH_UNAVAILABLE');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(1000, Number(timeoutMs) || 30000));
    try {
        const response = await fetchImpl(url, {
            method,
            headers: buildDropiBffHeaders({ token, countryCode, operation }),
            ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
            signal: controller.signal
        });
        const body = await response.json().catch(() => ({}));
        return {
            ok: response.ok,
            status: response.status,
            body,
            requestId: safeRequestId(
                response.headers?.get?.('x-request-id')
                || response.headers?.get?.('request-id')
                || response.headers?.get?.('x-correlation-id')
                || ''
            ),
            timedOut: false,
            errorCode: response.ok ? '' : classifyDropiBffFailure({ status: response.status })
        };
    } catch (error) {
        const timedOut = error?.name === 'AbortError';
        return {
            ok: false,
            status: 0,
            body: {},
            requestId: '',
            timedOut,
            errorCode: classifyDropiBffFailure({ timedOut })
        };
    } finally {
        clearTimeout(timer);
    }
};
