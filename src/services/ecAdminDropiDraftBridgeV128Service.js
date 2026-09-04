import {
    ecuadorProductMetadata,
    findEcuadorOfferByTotal,
    getEcuadorProductInfoByKey
} from './ecuadorProductService.js';

const clean = (value) => String(value ?? '').trim();
const digits = (value) => clean(value).replace(/\D/g, '');
const textKey = (value) => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ');
const money = (value) => Number(clean(value).replace(',', '.'));
const reject = (code, message) => {
    const error = new Error(message);
    error.status = 409;
    error.code = code;
    throw error;
};

// Only enrich a new admin order. Existing orders and the Dropi transport keep
// their own authorization, duplicate, catalog, stock and quote checks.
export const resolveEcAdminDropiDraftBridgeV128 = ({ lead = {}, state = null, orderId = '' } = {}) => {
    if (/\[DROPI_PRODUCT\]\s*key=/i.test(clean(lead.notes))) return null;
    const draft = state?.metadata?.customerDraft?.toObject?.() || state?.metadata?.customerDraft;
    if (!draft?.productKey) return null;
    const phone = digits(lead.phone);
    const statePhone = digits(state.phoneDigits || clean(state.chatId).split('@')[0]);
    if (!/^5939\d{8}$/.test(phone) || statePhone !== phone || digits(draft.phone) !== phone) {
        reject('admin_dropi_draft_phone_mismatch', 'A ficha do produto deve pertencer ao mesmo telefone EC do pedido.');
    }
    if (clean(lead.country || 'EC').toUpperCase() !== 'EC' || clean(draft.country).toUpperCase() !== 'EC'
        || clean(lead.status).toLowerCase() !== 'confirmado' || clean(draft.status).toLowerCase() !== 'confirmado') {
        reject('admin_dropi_draft_confirmation_required', 'Confirme a ficha EC atual antes de autorizar o pedido Dropi.');
    }
    const linkedIds = [draft.orderId, draft.currentNegotiationOrderId].map(clean).filter(Boolean);
    if (linkedIds.some((id) => id !== orderId) || draft.previousOrderId) {
        reject('admin_dropi_draft_existing_cycle', 'Use o pedido atual ou a autorizacao de recompra; a ficha ja possui outro ciclo.');
    }
    const product = getEcuadorProductInfoByKey(draft.productKey);
    const lock = state.metadata.productRouteLock;
    if (!product || (lock?.active && lock.productKey !== product.key)) {
        reject('admin_dropi_draft_product_conflict', 'Confira e salve o produto da ficha atual antes de autorizar Dropi.');
    }
    // A separately configured Dropi offer remains authoritative. Do not replace
    // it using a stale customer draft or a historical VSL product.
    const quantity = Number(lead.product_qty);
    const total = money(lead.product_value);
    const offer = findEcuadorOfferByTotal({ productKey: product.key, quantity, total });
    if (!offer || Number(draft.quantity) !== quantity || Math.round(money(draft.total) * 100) !== Math.round(total * 100)) {
        reject('admin_dropi_draft_offer_mismatch', 'Produto, quantidade e valor da ficha devem coincidir com o pedido confirmado.');
    }
    const resolution = state.customerDataResolution?.toObject?.() || state.customerDataResolution;
    if (resolution?.orderDataReady !== true || resolution.blockedReasons?.length) {
        reject('admin_dropi_draft_data_required', 'Complete e valide os dados da ficha antes de autorizar o pedido Dropi.');
    }
    for (const field of ['name', 'city', 'province', 'address']) {
        if (!clean(lead[field]) || textKey(lead[field]) !== textKey(draft[field])) {
            reject('admin_dropi_draft_destination_mismatch', 'Salve os dados atuais da ficha no lead antes de autorizar Dropi.');
        }
    }
    if (!['agency', 'home'].includes(clean(draft.deliveryMode))
        || (draft.deliveryMode === 'agency' && (!draft.agencyId || !draft.agencyName))) {
        reject('admin_dropi_draft_delivery_required', 'Confira a agencia ou o domicilio selecionado na ficha.');
    }
    return {
        product,
        productSelection: { productKey: product.key, productName: product.name, priceCatalog: offer.priceCatalog, quantity: offer.quantity, total: offer.total },
        marker: `[DROPI_PRODUCT] key=${product.key}; name=${product.name}; priceCatalog=${offer.priceCatalog}; quantity=${offer.quantity}; total=${offer.total.toFixed(2)}`,
        orderFields: {
            delivery: { mode: draft.deliveryMode, agencyId: clean(draft.agencyId), agencyName: clean(draft.agencyName) },
            customerDataResolution: resolution,
            tracking: {
                ...ecuadorProductMetadata(product),
                productSelectionSource: 'manual_customer_draft',
                priceCatalog: offer.priceCatalog,
                adminDropiDraftBridgeVersion: 128,
                // Source attribution is distinct from the current order product.
                ...(state.metadata.vslProductKey ? { vslProductKey: state.metadata.vslProductKey } : {})
            }
        }
    };
};

// Read-only projection for the existing Leads Clientes product badge/button.
// The internal SQLite snapshot must never be returned in the public flags.
export const enrichEcAdminDropiDraftFlagsV128 = (flags = {}, states = []) => {
    const byPhone = new Map();
    for (const state of states) {
        const phone = digits(state.phoneDigits || clean(state.chatId).split('@')[0]);
        if (phone && !byPhone.has(phone)) byPhone.set(phone, state);
    }
    return Object.fromEntries(Object.entries(flags).map(([id, original]) => {
        const { _draftBridgeLead: lead, ...flag } = original;
        if (!lead || flag.productSelection) return [id, flag];
        try {
            const bridge = resolveEcAdminDropiDraftBridgeV128({ lead, state: byPhone.get(digits(lead.phone)), orderId: `EC-ADMIN-${id}` });
            if (bridge) Object.assign(flag, bridge.productSelection, { productSelection: bridge.productSelection });
        } catch (error) {
            if (!error.code?.startsWith('admin_dropi_draft_')) throw error;
        }
        return [id, flag];
    }));
};
