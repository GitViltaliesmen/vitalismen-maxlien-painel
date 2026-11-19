import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { detectExplicitEcuadorProductKey, findEcuadorOfferByTotal } from './ecuadorProductService.js';

const storage = new AsyncLocalStorage();
const digits = value => String(value || '').replace(/\D/g, '');
const text = value => String(value || '').trim();
const objectId = value => /^[a-f0-9]{24}$/i.test(String(value || ''));
const policy = () => globalThis.__VITALISMEN_EC_CONFIRMED_DROPI_V252;
export const automaticDropiPolicyV252 = () => {
    const value = policy();
    return value && Object.isFrozen(value) && value.kind === 'EC_CONFIRMED_DROPI_V252'
        && value.isCurrent?.() === true && Number.isFinite(Date.parse(value.activatedAt?.()))
        ? value : null;
};

export const confirmedOrderProblemsV252 = (order = {}) => {
    const customer = order.customer || {}, delivery = order.delivery || {};
    const quantity = Number(order.package?.quantity), productKey = detectExplicitEcuadorProductKey(order);
    return [
        order.country !== 'EC' && 'country',
        !/^5939\d{8}$/.test(digits(customer.phone)) && 'phone',
        !/^[\p{L}][\p{L} .'’\-]+\s+[\p{L}][\p{L} .'’\-]*$/u.test(text(customer.name)) && 'name',
        !text(customer.city) && 'city', !text(customer.province) && 'province',
        !text(customer.address) && 'address',
        !['home', 'agency'].includes(delivery.mode) && 'delivery',
        delivery.mode === 'agency' && (!text(delivery.agencyId) || !text(delivery.agencyName)) && 'agency',
        ![1, 2, 3, 6].includes(quantity) && 'quantity',
        Number(order.package?.id) !== quantity && 'package',
        (!productKey || !findEcuadorOfferByTotal({ productKey, quantity, total: Number(order.total) })) && 'official_offer',
        (order.customerDataResolution?.orderDataReady !== true
            || order.customerDataResolution?.blockedReasons?.length > 0) && 'customer_resolution'
    ].filter(Boolean);
};

// Persisted with the confirmation itself. Historical confirmations are never scanned/replayed.
export const prepareConfirmedDropiDispatchV252 = (order, { transition = false, now = new Date() } = {}) => {
    const capability = automaticDropiPolicyV252();
    if (!capability || !transition || order.status !== 'confirmed' || order.integration) return false;
    const reasons = confirmedOrderProblemsV252(order);
    if (reasons.length) {
        const error = new Error('confirmed_order_incomplete:' + reasons.join(','));
        error.code = 'confirmed_order_incomplete'; error.status = 422; error.reasons = reasons; throw error;
    }
    if (order.dropiDispatchV252?.requestedAt || order.dropiOrderId || order.trackingNumber) return false;
    if (now.getTime() < Date.parse(capability.activatedAt())) return false;
    order.dropiDispatchV252 = { version: 252, status: 'pending', requestedAt: now, attempts: 0 };
    return true;
};

const same = (left, right) => String(left || '') === String(right || '');
const scope = () => {
    const current = storage.getStore();
    return current && automaticDropiPolicyV252() && current.expiresAt > Date.now() ? current : null;
};
export const isAutomaticDropiContextV252 = () => Boolean(scope());
export const automaticDropiExternalAllowedV252 = effect => Boolean(scope() && effect === 'dropi');
export const automaticDropiOrderAllowedV252 = (order, shipment) => {
    const current = scope();
    return Boolean(current && same(order?._id, current.orderObjectId) && order?.orderId === current.orderId
        && digits(order?.customer?.phone) === current.phone && order?.status === 'confirmed'
        && order?.dropiDispatchV252?.status === 'claimed'
        && order?.dropiDispatchV252?.leaseToken === current.token
        && shipment?.orderId === current.orderId && digits(shipment?.client?.phone) === current.phone);
};

export const automaticDropiMongoAllowedV252 = (collection, method, args) => {
    const current = scope();
    if (!current || !['insertOne', 'updateOne', 'findOneAndUpdate', 'updateMany'].includes(method)) return false;
    const query = args[0] || {}, update = args[1] || {};
    if (method !== 'insertOne' && args[2]?.upsert === true) return false;
    const timestampsOnly = fields => Object.keys(fields).every(field => field === 'createdAt');
    const updateAllowed = (roots, operators) => Object.entries(update).every(([operator, fields]) =>
        operator === '$setOnInsert' ? timestampsOnly(fields) : operators.includes(operator)
            && Object.keys(fields).every(field => (operator !== '$inc' || field === '__v') && roots.some(root => field === root || field.startsWith(root + '.'))));
    if (method === 'updateMany' && collection !== 'contactstates') return false;
    if (collection === 'shipments') {
        if (method === 'insertOne') {
            if (query.orderId !== current.orderId || query.country !== 'EC'
                || digits(query.client?.phone) !== current.phone || !objectId(query._id)) return false;
            current.shipmentIds.add(String(query._id)); return true;
        }
        const sameShipment = same(query.orderId, current.orderId) || current.shipmentIds.has(String(query._id || ''));
        return sameShipment && updateAllowed(['automation', 'logistics', 'review', 'raw', 'events', 'updatedAt', '__v'], ['$set', '$unset', '$push', '$inc', '$addToSet']);
    }
    if (collection === 'orders') {
        if (method === 'insertOne' || (!same(query._id, current.orderObjectId) && query.orderId !== current.orderId)) return false;
        const allowed = ['dropiDispatchV252', 'status', 'shippingStatus', 'trackingNumber', 'dropiOrderId', 'updatedAt', '__v'];
        return updateAllowed(allowed, ['$set', '$inc'])
            && (!update.$set?.status || update.$set.status === 'processing');
    }
    if (collection === 'contactstates') {
        // Existing Dropi success mirror only; no human/opt-out/identity/funnel writes.
        const samePhone = query.countryCode === 'EC' && digits(query.phoneDigits || '') === current.phone;
        if (!samePhone || args[2]?.upsert) return false;
        const allowed = ['metadata.dropi', 'metadata.customerDraft.status', 'metadata.customerDraft.flowDataOk.venda_finalizada', 'metadata.customerDraft.updatedAt', 'updatedAt', 'tags'];
        return Object.entries(update).every(([operator, fields]) => operator === '$setOnInsert' ? timestampsOnly(fields)
            : operator === '$addToSet' ? Object.entries(fields).every(([field, value]) => field === 'tags' && ['FEITO_DROPI', 'ERRO_DROPI'].includes(value))
            : operator === '$set' && Object.keys(fields).every(field => field !== 'tags' && allowed.some(root => field === root || field.startsWith(root + '.'))));
    }
    return false;
};

export const runAutomaticDropiV252 = async ({ order, shipment = null, token }, action) => {
    const capability = automaticDropiPolicyV252();
    if (!capability || !objectId(order?._id) || !text(order?.orderId) || !text(token)
        || !['pending', 'claimed'].includes(order?.dropiDispatchV252?.status)
        || Date.parse(order.dropiDispatchV252.requestedAt) < Date.parse(capability.activatedAt())
        || confirmedOrderProblemsV252(order).length) throw new Error('automatic_dropi_scope_invalid');
    const current = { orderObjectId: String(order._id), orderId: order.orderId,
        phone: digits(order.customer.phone), token, expiresAt: Date.now() + 15 * 60_000,
        shipmentIds: new Set(shipment?._id ? [String(shipment._id)] : []) };
    return storage.run(current, action);
};

// Injected adapters keep the existing serial queue, shipment validation and provider transport.
export const processConfirmedDropiDispatchV252 = async ({ orderModel, shipmentModel, dispatch, readiness, history, now = new Date() }) => {
    const capability = automaticDropiPolicyV252();
    if (!capability) return { skipped: true, reason: 'automatic_dropi_inactive' };
    const order = await orderModel.findOne({ country: 'EC', status: 'confirmed',
        'dropiDispatchV252.status': 'pending', 'dropiDispatchV252.attempts': 0,
        'dropiDispatchV252.requestedAt': { $gte: new Date(capability.activatedAt()) } }).sort({ 'dropiDispatchV252.requestedAt': 1 }).lean();
    if (!order) return { skipped: true, reason: 'no_new_confirmation' };
    const shipment = await shipmentModel.findOne({ orderId: order.orderId }).lean();
    const token = randomUUID();
    return runAutomaticDropiV252({ order, shipment, token }, async () => {
        const claimed = await orderModel.findOneAndUpdate({ _id: order._id, status: 'confirmed',
            'dropiDispatchV252.status': 'pending', 'dropiDispatchV252.attempts': 0 }, { $set: {
            'dropiDispatchV252.status': 'claimed', 'dropiDispatchV252.leaseToken': token,
            'dropiDispatchV252.startedAt': now, 'dropiDispatchV252.attempts': 1
        } }, { new: true });
        if (!claimed) return { skipped: true, reason: 'already_claimed' };
        let outcome;
        try {
            const ready = readiness(claimed);
            if (!ready.ready) throw new Error('dropi_order_not_ready');
            await history(claimed);
            if (shipment?.automation?.submittedToDroppiAt || shipment?.raw?.latestDroppiPayload?.dropiOrderId
                || shipment?.logistics?.trackingNumber || claimed.dropiOrderId || claimed.trackingNumber) {
                outcome = { ok: true, alreadySubmitted: true };
            } else outcome = await dispatch(claimed);
        } catch (error) { outcome = { ok: false, reason: String(error.code || error.message || 'dropi_dispatch_failed').slice(0, 160) }; }
        // A claimed attempt is never automatically rearmed, even after crash/uncertain result.
        await orderModel.updateOne({ _id: order._id, 'dropiDispatchV252.leaseToken': token }, { $set: {
            'dropiDispatchV252.status': outcome?.ok === true && !outcome?.processing ? 'submitted' : 'review',
            'dropiDispatchV252.completedAt': new Date(), 'dropiDispatchV252.reason': outcome?.reason || ''
        } });
        return { orderId: order.orderId, ...outcome };
    });
};

// Explicit existing-sale repair: native admin authentication plus an immutable
// root-issued, short-lived grant containing verified Dropi/carrier identity.
// No new remote order, Mongo Order, commercial confirmation or Meta replay.
export const historicalDropiRecoveryGrantV252 = (orderId, now = new Date()) => {
    const capability = automaticDropiPolicyV252();
    const grant = capability?.historicalRecoveryFor?.(String(orderId)), payload = grant?.payload;
    const native = grant?.kind === 'VERIFIED_NATIVE_ORDER_DROPI_LINK_V252';
    const external = grant?.kind === 'VERIFIED_EXISTING_DROPI_SALE_V252';
    const guide = /^[1-9]\d{7,14}$/.test(payload?.trackingNumber || '');
    if (!grant || (!native && !external)
        || !Number.isFinite(Date.parse(grant.expiresAt)) || Date.parse(grant.expiresAt) <= Number(now)
        || !Number.isFinite(Date.parse(grant.remoteCreatedAt)) || !Number.isFinite(Date.parse(grant.observedAt))
        || Number(now) - Date.parse(grant.observedAt) > 1800000 || Date.parse(grant.observedAt) > Number(now) + 60000
        || payload?.orderId !== String(orderId) || !/^[1-9]\d{5,11}$/.test(payload.dropiOrderId || '')
        || payload.manualDropiOrderId !== payload.dropiOrderId
        || !/^5939\d{8}$/.test(digits(payload.phone)) || !objectId(payload.customerId)
        || !/^[1-9]\d*$/.test(payload.leadId || '') || payload.sourceDropi !== true
        || !text(payload.dropiRawStatus) || !text(payload.status)
        || !Number.isFinite(Date.parse(grant.expectedContactUpdatedAt))) return null;
    if (external && (String(orderId) !== payload.dropiOrderId || !guide || payload.sourceServientrega !== true
        || payload.historicalIdentityOnly !== true || payload.reconciliationSource !== 'HISTORICAL_EXTERNAL_RECONCILIATION')) return null;
    if (native && (!/^EC-[A-Z0-9-]{6,80}$/.test(String(orderId)) || !objectId(grant.nativeOrderObjectId)
        || !Number.isFinite(Date.parse(grant.expectedOrderUpdatedAt)) || payload.historicalIdentityOnly !== false
        || payload.reconciliationSource !== 'VERIFIED_NATIVE_DROPI_LINK_V252'
        || (!guide && (payload.trackingNumber || !['PENDIENTE','PENDING','CREATED','EN_PROCESAMIENTO'].includes(payload.dropiRawStatus)))
        || !findEcuadorOfferByTotal({ productKey: grant.nativeProductKey, quantity: Number(grant.nativeQuantity), total: Number(grant.nativeTotal) }))) return null;
    return structuredClone(grant);
};
