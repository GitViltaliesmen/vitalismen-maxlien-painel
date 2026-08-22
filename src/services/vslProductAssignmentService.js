import { activeProductRouteLock } from './productRouteLockService.js';

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
