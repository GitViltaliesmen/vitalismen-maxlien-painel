import { activeProductRouteLock } from './productRouteLockService.js';
import {
    detectExplicitEcuadorProductKey,
    ecuadorProductForVslOrigin,
    getEcuadorProductInfoByKey,
    isEcuadorProductKey
} from './ecuadorProductService.js';

const normalizeProductKey = (value = '') => String(value || '').trim().toLowerCase();
const LOCKABLE_PRODUCT_KEYS = new Set(['vit_power_ec', 'nitrix_ec', 'tex_ultra_ec']);
const OPERATOR_PRODUCT_ROUTE_SOURCES = new Set([
    'panel_customer_product_selection',
    'reconciled_panel_customer_product_selection_v34'
]);
const AUTOMATION_ACTORS = new Set([
    'zapi',
    'vsl_ec',
    'nitrix_vsl_entry_auto',
    'nitrix_vsl_entry_ready',
    'tex_ultra_vsl_entry_ready',
    'nitrix_fast_state',
    'nitrix_route_guard',
    'zapi_watchdog'
]);

export const isOperatorProductRouteLock = (state = {}) => {
    const lock = activeProductRouteLock(state);
    if (!lock) return null;
    const source = String(lock.source || '').trim().toLowerCase();
    const reason = String(lock.reason || '').trim().toLowerCase();
    if (
        !OPERATOR_PRODUCT_ROUTE_SOURCES.has(source)
        && reason !== 'operator_selected_current_negotiation_product'
    ) {
        return null;
    }
    return lock;
};

const reconciledLegacyOperatorProductRouteLock = (state = {}) => {
    const metadata = state?.metadata || {};
    const draft = metadata.customerDraft || {};
    const productKey = [
        draft.negotiationProductKey,
        draft.productKey,
        metadata.productKey
    ].map(normalizeProductKey).find((key) => LOCKABLE_PRODUCT_KEYS.has(key));
    const selectedBy = String(state?.human?.lastManualBy || '').trim();
    if (!productKey || !selectedBy || AUTOMATION_ACTORS.has(selectedBy.toLowerCase())) return null;
    const selectedAtCandidate = new Date(draft.updatedAt || state?.human?.lastManualAt || state?.updatedAt || Date.now());
    const selectedAt = Number.isNaN(selectedAtCandidate.getTime()) ? new Date() : selectedAtCandidate;
    return {
        active: true,
        productKey,
        productName: String(draft.productName || metadata.productName || '').trim(),
        lockedAt: selectedAt.toISOString(),
        source: 'reconciled_panel_customer_product_selection_v34',
        reason: 'operator_selected_current_negotiation_product',
        selectedBy
    };
};

export const vslProductAssignmentPolicy = ({ state = {}, incomingProductKey = '' } = {}) => {
    const incoming = normalizeProductKey(incomingProductKey);
    const operatorLock = isOperatorProductRouteLock(state)
        || reconciledLegacyOperatorProductRouteLock(state);
    const preserveOperatorSelection = Boolean(
        incoming
        && operatorLock?.productKey
        && operatorLock.productKey !== incoming
    );
    return {
        incomingProductKey: incoming,
        currentProductKey: preserveOperatorSelection
            ? operatorLock.productKey
            : incoming,
        preserveOperatorSelection,
        operatorLock
    };
};

const firstKnownProductKey = (...values) => values
    .map(normalizeProductKey)
    .find(isEcuadorProductKey) || '';

export const currentProductRouteForState = (state = {}) => {
    const metadata = state?.metadata || {};
    const draft = metadata.customerDraft || {};
    const routeLock = activeProductRouteLock(state);
    if (routeLock) {
        return {
            productKey: routeLock.productKey,
            product: getEcuadorProductInfoByKey(routeLock.productKey),
            reason: 'active_product_route_lock',
            needsReview: false
        };
    }

    const currentProductKey = firstKnownProductKey(
        draft.negotiationProductKey,
        draft.currentProductKey,
        draft.productKey,
        metadata.productKey
    ) || detectExplicitEcuadorProductKey(
        { productKey: draft.productKey, productName: draft.productName },
        { productKey: metadata.productKey, productName: metadata.productName }
    );
    if (currentProductKey) {
        return {
            productKey: currentProductKey,
            product: getEcuadorProductInfoByKey(currentProductKey),
            reason: 'current_negotiation_product',
            needsReview: false
        };
    }

    const vslProductKey = firstKnownProductKey(metadata.vslProductKey);
    if (vslProductKey) {
        return {
            productKey: vslProductKey,
            product: getEcuadorProductInfoByKey(vslProductKey),
            reason: 'historical_vsl_product',
            needsReview: false
        };
    }

    const originProduct = ecuadorProductForVslOrigin(
        metadata.vslPath,
        metadata.vslPage,
        metadata.vslSourceUrl,
        metadata.productSource
    );
    if (originProduct) {
        return {
            productKey: originProduct.key,
            product: originProduct,
            reason: 'known_vsl_origin',
            needsReview: false
        };
    }

    return {
        productKey: '',
        product: null,
        reason: 'unknown_product_requires_review',
        needsReview: true
    };
};

export const applyCurrentProductToState = ({
    state,
    productKey = '',
    productName = '',
    productMedia = '',
    source = '',
    at = new Date()
} = {}) => {
    if (!state || !isEcuadorProductKey(productKey)) return false;
    const product = getEcuadorProductInfoByKey(productKey);
    const normalizedAt = new Date(at);
    const now = Number.isNaN(normalizedAt.getTime()) ? new Date() : normalizedAt;
    const finalName = String(productName || product?.displayName || product?.name || '').trim();
    const finalMedia = String(productMedia || product?.media || '').trim();
    const draft = state.metadata?.customerDraft || {};
    const previousProductKey = firstKnownProductKey(
        draft.negotiationProductKey,
        draft.productKey,
        state.metadata?.productKey
    );
    state.metadata = {
        ...(state.metadata || {}),
        productKey,
        productName: finalName,
        ...(finalMedia ? { productMedia: finalMedia } : {}),
        ...(source ? { productSource: source } : {}),
        customerDraft: {
            ...draft,
            product: finalName,
            productKey,
            productName: finalName,
            negotiationProductKey: productKey,
            negotiationProductName: finalName,
            ...(source ? { negotiationProductSource: source } : {}),
            ...(finalMedia ? { productMedia: finalMedia } : {}),
            updatedAt: now.toISOString()
        }
    };
    state.productHistory = Array.isArray(state.productHistory) ? state.productHistory : [];
    if (previousProductKey !== productKey) {
        state.productHistory.push({ productKey, reason: source || 'product_context_update', at: now });
        state.productHistory = state.productHistory.slice(-20);
    }
    state.markModified?.('metadata');
    return true;
};

export const operatorProductRouteLock = ({
    productKey = '',
    productName = '',
    selectedBy = '',
    selectedAt = new Date()
} = {}) => ({
    active: true,
    productKey: normalizeProductKey(productKey),
    productName: String(productName || '').trim(),
    lockedAt: new Date(selectedAt).toISOString(),
    source: 'panel_customer_product_selection',
    reason: 'operator_selected_current_negotiation_product',
    selectedBy: String(selectedBy || '').trim()
});
