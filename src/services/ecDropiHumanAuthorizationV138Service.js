import { detectExplicitEcuadorProductKey, findEcuadorOfferByTotal } from './ecuadorProductService.js';
import { validateEcuadorDropiCustomerName, validateEcuadorDropiPhone } from './droppiEcuadorService.js';
import { currentEcBotCoreRuntimeContextV78 } from './ecBotCoreRuntimeIntegrationV78Service.js';
import { resolveEcAdminDropiDraftBridgeV128 } from './ecAdminDropiDraftBridgeV128Service.js';

const clean = value => String(value ?? '').trim();
const digits = value => clean(value).replace(/\D/g, '');
const key = value => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ');
const plain = value => value?.toObject?.() || value || {};

export const ecDropiOrderReadinessV138 = (order = {}) => {
    const customer = order.customer || {};
    const reasons = [];
    if (!clean(order.orderId)) reasons.push('pedido');
    if (order.country !== 'EC') reasons.push('pais Equador');
    if (order.status !== 'confirmed') reasons.push('confirmacao comercial');
    if (!validateEcuadorDropiCustomerName(customer.name).ok) reasons.push('nome completo');
    if (!validateEcuadorDropiPhone(customer.phone).ok) reasons.push('telefone EC');
    for (const field of ['address', 'city', 'province']) {
        if (!clean(customer[field])) reasons.push({ address: 'endereco', city: 'cidade', province: 'provincia' }[field]);
    }
    // An explicit zero must never fall back to the old package ID or to one bottle.
    const quantity = Number(order.package?.quantity ?? order.package?.id);
    const packageId = Number(order.package?.id ?? quantity);
    if (![1, 2, 3, 6].includes(quantity) || packageId !== quantity) reasons.push('quantidade');
    const total = Number(order.total);
    if (!Number.isFinite(total) || total <= 0) reasons.push('valor');
    const productKey = detectExplicitEcuadorProductKey(order);
    if (!productKey) reasons.push('produto');
    if (productKey && !findEcuadorOfferByTotal({ productKey, quantity, total })) reasons.push('oferta oficial');
    const delivery = order.delivery || {};
    if (!['home', 'agency'].includes(delivery.mode)) reasons.push('modalidade de entrega');
    if (delivery.mode === 'agency' && (!clean(delivery.agencyId) || !clean(delivery.agencyName))) reasons.push('agencia validada');
    const resolution = plain(order.customerDataResolution);
    if (resolution.orderDataReady !== true || resolution.blockedReasons?.length) reasons.push('validacao da ficha');
    return { ready: reasons.length === 0, reasons, authorizationRequired: true, automaticallyAuthorized: false };
};

export const assertEcDropiOrderReadyV138 = order => {
    const decision = ecDropiOrderReadinessV138(order);
    if (decision.ready) return decision;
    const error = new Error('Complete antes de enviar para Dropi: ' + decision.reasons.join(', ') + '.');
    error.status = 422;
    error.code = 'dropi_order_not_ready';
    error.reasons = decision.reasons;
    throw error;
};

// Reuse the current verified contact data; never infer a delivery mode from an address.
// The separately selected order product/offer remains authoritative.
export const ecDropiCurrentDraftDeliveryV138 = (order = {}, state = null) => {
    const draft = plain(state?.metadata?.customerDraft);
    const resolution = plain(state?.customerDataResolution);
    if (!state || !digits(order.customer?.phone)
        || digits(state.phoneDigits || clean(state.chatId).split('@')[0]) !== digits(order.customer.phone)
        || digits(draft.phone) !== digits(order.customer.phone)
        || ['name', 'address', 'city', 'province'].some(field => !key(draft[field]) || key(draft[field]) !== key(order.customer?.[field]))) {
        const error = new Error('Salve a ficha atual deste cliente antes de preparar o envio Dropi.');
        error.status = 409; error.code = 'dropi_current_customer_data_required'; throw error;
    }
    return {
        delivery: { mode: clean(draft.deliveryMode), agencyId: clean(draft.agencyId), agencyName: clean(draft.agencyName) },
        customerDataResolution: resolution
    };
};

export const ecHumanDropiSubmitBlockV138 = ({ order, shipment } = {}) => {
    const context = currentEcBotCoreRuntimeContextV78();
    const requestedId = clean(context?.humanDropiRequestedOrderId);
    const requestedMatches = requestedId && [clean(order?.orderId), clean(order?._mappedFromAdminLead?.requestedOrderId)].includes(requestedId);
    const authorized = shipment?.automation?.dropiSubmitAuthorizedAt && clean(shipment?.automation?.dropiSubmitAuthorizedBy);
    if (context?.humanDropiActionV138 !== true || !clean(context.humanDropiActorId)
        || context.manualDropiOperation !== 'submit' || !requestedMatches || !authorized) {
        return { ok: false, success: false, blocked: true, authorizationRequired: true,
            reason: 'dropi_explicit_human_authorization_required',
            message: 'Selecione o pedido e execute o envio manual depois da autorizacao do operador.' };
    }
    return null;
};

// Extend the existing flags response with computed readiness, not new stored state.
export const enrichEcDropiReadinessFlagsV138 = ({ rawFlags = {}, flags = {}, states = [] } = {}) => {
    const statesByPhone = new Map();
    for (const state of states) {
        const phone = digits(state.phoneDigits || clean(state.chatId).split('@')[0]);
        if (phone && !statesByPhone.has(phone)) statesByPhone.set(phone, state);
    }
    for (const [id, raw] of Object.entries(rawFlags)) {
        const lead = raw._draftBridgeLead;
        if (!lead || !flags[id]) continue;
        const state = statesByPhone.get(digits(lead.phone));
        const selection = flags[id].productSelection;
        const draft = plain(state?.metadata?.customerDraft);
        if (!selection && draft.productKey) {
            try { resolveEcAdminDropiDraftBridgeV128({ lead, state, orderId: 'EC-ADMIN-' + id }); }
            catch (error) {
                flags[id].dropiReadiness = { ready: false, reasons: [error.message], authorizationRequired: true };
                continue;
            }
        }
        const quantity = Number(lead.product_qty);
        const candidate = { orderId: 'EC-ADMIN-' + id, country: clean(lead.country || 'EC'), status: lead.status === 'confirmado' ? 'confirmed' : '',
            customer: { name: lead.name, phone: lead.phone, address: lead.address, city: lead.city, province: lead.province },
            package: { id: quantity, quantity }, total: Number(lead.product_value),
            tracking: { productKey: selection?.productKey || '' }, notes: lead.notes };
        try {
            Object.assign(candidate, ecDropiCurrentDraftDeliveryV138(candidate, state));
            flags[id].dropiReadiness = ecDropiOrderReadinessV138(candidate);
        } catch (error) {
            flags[id].dropiReadiness = { ready: false, reasons: [error.message], authorizationRequired: true };
        }
    }
    return flags;
};
