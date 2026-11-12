import fs from 'node:fs';
import path from 'node:path';
import {
    isUnexpiredDropiToken, normalizeDropiBffListResponse, requestDropiBff
} from './dropiBffAdapter.js';
import { mapOrdersApiRowToSyncResult } from './droppiEcuadorBrowserService.js';
import { resolveEcuadorProductInfo } from './ecuadorProductService.js';

const ENDPOINT = 'https://api-v2.dropi.ec/bff/orders/myorders/v2';
const fail = code => { const error = new Error(code); error.code = code; throw error; };
const json = value => { try { return JSON.parse(value || 'null'); } catch { return null; } };

// Only the sealed, registered post-sale executor can use this capability.
// No browser launch, login, session persistence, order mutation or customer send.
export const fetchDroppiEcuadorOrdersApiReadOnly = async ({ search = '', maxRows = 50 } = {}) => {
    const capability = globalThis.__VITALISMEN_EC_POSTSALE_TRACKING_V210;
    if (!capability || !Object.isFrozen(capability) || capability.isCurrent?.() !== true) {
        fail('EC_POSTSALE_READ_CONTEXT_REQUIRED');
    }
    const id = String(search).trim();
    if (!/^[1-9]\d{0,17}$/.test(id)) fail('EC_POSTSALE_EXACT_DROPI_ID_REQUIRED');
    const configured = String(process.env.DROPPI_EC_STORAGE_STATE_PATH || '').trim();
    const file = configured && path.isAbsolute(configured) ? configured
        : path.join(process.env.HOME || process.cwd(), '.vitalismen-secrets', 'droppi-ec-storage.json');
    if (!path.isAbsolute(file)) fail('EC_POSTSALE_SESSION_PATH_INVALID');
    let state;
    try { state = JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch { fail('EC_POSTSALE_SESSION_UNAVAILABLE'); }
    const origins = (state.origins || []).filter(origin => origin.origin === 'https://app.dropi.ec');
    if (origins.length !== 1) fail('EC_POSTSALE_SESSION_ORIGIN_INVALID');
    const entries = new Map((origins[0].localStorage || []).map(entry => [entry.name, entry.value]));
    const token = json(entries.get('DROPI_token'));
    const login = json(entries.get('DROPI_LoginResult'));
    const userId = String(login?.objects?.id || login?.user?.id || '');
    const countryValue = String(login?.countries?.[0]?.code || login?.configurations?.[0]?.code
        || login?.configurations?.[0]?.country_code || login?.configurations?.[0]?.country || '').toLowerCase();
    const country = countryValue === 'ecuador' ? 'ec' : countryValue;
    if (!token || token !== login?.token || !/^[1-9]\d*$/.test(userId) || country !== 'ec'
        || !isUnexpiredDropiToken(token)) fail('EC_POSTSALE_SESSION_INVALID');

    const url = new URL(ENDPOINT);
    const until = new Date(), from = new Date(until.getTime() - 89 * 86400000);
    const limit = Math.max(1, Math.min(Math.trunc(Number(maxRows)) || 50, 50));
    for (const [key, value] of Object.entries({ exportAs: 'orderByRow', orderBy: 'id', orderDirection: 'desc',
        result_number: limit, start: 0, textToSearch: id, status: 'null', supplier_id: 'false', user_id: userId,
        from: from.toISOString().slice(0, 10), until: until.toISOString().slice(0, 10), filter_product: 'undefined',
        haveIncidenceProcesamiento: 'false', tag_id: '', warranty: 'false', seller: 'null',
        filter_date_by: 'FECHA DE CREADO', invoiced: 'null' })) url.searchParams.set(key, String(value));

    const result = await requestDropiBff({ url: url.href, token, countryCode: 'ec', operation: 'list',
        method: 'GET', timeoutMs: 30000,
        fetchImpl: (target, options) => {
            if (target !== url.href || options.method !== 'GET' || options.body !== undefined
                || capability.isCurrent() !== true) fail('EC_POSTSALE_READ_ONLY_VIOLATION');
            return globalThis.fetch(target, { ...options, redirect: 'error' });
        }
    });
    if (!result.ok) fail('EC_POSTSALE_DROPI_READ_' + (result.errorCode || 'FAILED'));
    const normalized = normalizeDropiBffListResponse(result.body, result.listResponseContext);
    if (!normalized.isSuccess) fail('EC_POSTSALE_DROPI_RESPONSE_INVALID');
    if (normalized.objects.length >= limit && normalized.count > normalized.objects.length) {
        fail('EC_POSTSALE_DROPI_RESPONSE_TRUNCATED');
    }
    const rows = normalized.objects.filter(row => String(row?.id || '') === id).map(raw => {
        const mapped = mapOrdersApiRowToSyncResult(raw, { client: { phone: raw.phone || '' }, logistics: {} });
        const products = [...(Array.isArray(raw.products) ? raw.products : []),
            ...(Array.isArray(raw.orderdetails) ? raw.orderdetails : [])];
        const product = resolveEcuadorProductInfo(raw.product, raw.product_name, raw.productName,
            ...products.flatMap(item => [item?.name, item?.product?.name, item?.product_name]));
        return { ...mapped, rawRow: undefined, status: String(raw.status || '').trim(),
            productKey: product?.key || '', productName: product?.dropiName || product?.name || '',
            internalOrderId: raw.external_order_id || raw.reference || '', source: 'dropi_orders_api' };
    });
    return { ok: true, source: 'dropi_orders_api', readOnly: true, rows };
};
