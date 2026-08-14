import Order from '../models/Order.js';
import Shipment from '../models/Shipment.js';

const ACTIVE_ORDER_STATUSES = ['draft', 'pending', 'confirmed', 'processing', 'shipped'];
const DROPPI_DUPLICATE_RECENT_HOURS = Number.parseInt(process.env.DROPPI_DUPLICATE_RECENT_HOURS || '72', 10);
const STALE_ACTIVE_ORDER_FOR_REPURCHASE_DAYS = Number.parseInt(process.env.STALE_ACTIVE_ORDER_FOR_REPURCHASE_DAYS || '14', 10);

const digitsOnly = (value) => String(value || '').replace(/\D/g, '');
const cleanToken = (value) => String(value || '').replace(/\s+/g, '').trim();

export const normalizePhoneTail = (value) => {
    const digits = digitsOnly(value);
    if (!digits) return '';
    return digits.length > 10 ? digits.slice(-10) : digits;
};

const recentCutoffDate = () => {
    const hours = Number.isFinite(DROPPI_DUPLICATE_RECENT_HOURS) && DROPPI_DUPLICATE_RECENT_HOURS > 0
        ? DROPPI_DUPLICATE_RECENT_HOURS
        : 72;
    return new Date(Date.now() - (hours * 60 * 60 * 1000));
};

const getDropiOrderId = (order = {}, shipment = null) => cleanToken(
    order?.dropiOrderId
    || shipment?.raw?.droppiOrder?.id
    || shipment?.raw?.droppiOrder?.objects?.id
    || shipment?.raw?.latestDroppiPayload?.dropiOrderId
    || shipment?.raw?.manualDropiOrderId
    || ''
);

const getTrackingNumber = (order = {}, shipment = null) => cleanToken(
    order?.trackingNumber
    || shipment?.logistics?.trackingNumber
    || shipment?.raw?.droppiOrder?.sticker
    || shipment?.raw?.droppiOrder?.objects?.sticker
    || ''
);

const getSubmittedAt = (order = {}, shipment = null) => (
    shipment?.automation?.submittedToDroppiAt
    || order?.updatedAt
    || shipment?.updatedAt
    || order?.createdAt
    || shipment?.createdAt
    || null
);

const withinRecentWindow = (value) => {
    const date = value ? new Date(value) : null;
    return Boolean(date && !Number.isNaN(date.getTime()) && date >= recentCutoffDate());
};

const hasHistoricalCloseNote = (order = {}, shipment = null) => {
    const text = [
        order?.notes,
        order?.reviewQueue?.status,
        order?.reviewQueue?.reason,
        shipment?.notes,
        shipment?.review?.reviewStatus,
        shipment?.review?.reviewReason
    ].filter(Boolean).join('\n');
    return /pedido finalizado operacionalmente|retirada confirmada|retirado pelo cliente|cliente retirou|entrega confirmada|delivered_confirmed|pickup_confirmed|picked_up/i.test(text);
};

export const orderLooksClosedForRepurchase = (order = {}, shipment = null) => {
    const status = String(order.status || '').toLowerCase();
    if (['delivered', 'cancelled', 'returned'].includes(status)) return true;
    if (shipment?.review?.reviewStatus === 'fake_order_deleted') return true;
    if (hasHistoricalCloseNote(order, shipment)) return true;
    if (orderLooksStaleForRepurchase(order, shipment)) return true;
    return Boolean(
        shipment?.outcomes?.pickedUp
        || shipment?.outcomes?.delivered
        || shipment?.outcomes?.returned
        || shipment?.automation?.deliveredConfirmedAt
        || shipment?.automation?.returnedNotifiedAt
    );
};

const hasDropiSubmissionEvidence = (order = {}, shipment = null) => Boolean(
    getDropiOrderId(order, shipment)
    || getTrackingNumber(order, shipment)
    || shipment?.automation?.submittedToDroppiAt
    || shipment?.review?.reviewStatus === 'submitted'
    || shipment?.automation?.browserCheckpoint === 'submitted_verified'
    || ['processing', 'shipped'].includes(String(order?.status || '').toLowerCase())
);

const staleRepurchaseCutoffDate = () => {
    const days = Number.isFinite(STALE_ACTIVE_ORDER_FOR_REPURCHASE_DAYS) && STALE_ACTIVE_ORDER_FOR_REPURCHASE_DAYS > 0
        ? STALE_ACTIVE_ORDER_FOR_REPURCHASE_DAYS
        : 14;
    return new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
};

const orderAgeAnchor = (order = {}, shipment = null) => {
    const value = order?.entryAt
        || order?.confirmedAt
        || order?.draftCreatedAt
        || order?.createdAt
        || shipment?.createdAt
        || order?.updatedAt
        || shipment?.updatedAt
        || null;
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date : null;
};

const orderLooksStaleForRepurchase = (order = {}, shipment = null) => {
    const status = String(order?.status || '').toLowerCase();
    if (!['pending', 'confirmed'].includes(status)) return false;
    if (hasDropiSubmissionEvidence(order, shipment)) return false;
    if (shipment?.logistics?.trackingNumber) return false;
    const logisticsStatus = String(shipment?.logistics?.status || '').toUpperCase();
    if (/GUIA|READY|RUTA|REPARTO|BODEGA|PENDIENTE|MERCANCIA|DESPACHO/.test(logisticsStatus)) return false;
    const anchor = orderAgeAnchor(order, shipment);
    if (!anchor) return false;
    return anchor <= staleRepurchaseCutoffDate();
};

const isWhatsappMirrorWithoutDropiEvidence = ({ currentOrderId = '', duplicateOrder = {}, duplicateShipment = null } = {}) => (
    /^EC-ADMIN-\d+$/i.test(String(currentOrderId || ''))
    && /^EC-MP/i.test(String(duplicateOrder?.orderId || ''))
    && !duplicateShipment
    && !hasDropiSubmissionEvidence(duplicateOrder, duplicateShipment)
    && ['whatsapp', 'bot', ''].includes(String(duplicateOrder?.source || '').toLowerCase())
);

const formatAlreadySentMessage = ({ orderId = '', dropiOrderId = '', trackingNumber = '' } = {}) => {
    const parts = ['PEDIDO JA FOI ENVIADO'];
    if (orderId) parts.push(`pedido ${orderId}`);
    if (dropiOrderId) parts.push(`Dropi ${dropiOrderId}`);
    if (trackingNumber) parts.push(`guia ${trackingNumber}`);
    return `${parts.join(' - ')}. Bloqueado para evitar duplicidade sem autorizacao.`;
};

const buildDuplicatePayload = ({
    reason,
    order,
    shipment,
    phoneTail,
    message
}) => {
    const dropiOrderId = getDropiOrderId(order, shipment);
    const trackingNumber = getTrackingNumber(order, shipment);
    return {
        allowed: false,
        reason,
        phoneTail,
        duplicateOrderId: order?.orderId || shipment?.orderId || '',
        duplicateStatus: order?.status || shipment?.logistics?.status || '',
        duplicateDropiOrderId: dropiOrderId,
        duplicateTrackingNumber: trackingNumber,
        duplicateSubmittedAt: getSubmittedAt(order, shipment),
        message: message || formatAlreadySentMessage({
            orderId: order?.orderId || shipment?.orderId || '',
            dropiOrderId,
            trackingNumber
        })
    };
};

export const getOrderDuplicateGuard = async ({
    phone = '',
    country = 'EC',
    currentOrderId = '',
    trackingNumber = '',
    dropiOrderId = ''
} = {}) => {
    const phoneTail = normalizePhoneTail(phone);
    const cleanTracking = cleanToken(trackingNumber);
    const cleanDropiOrderId = cleanToken(dropiOrderId);

    if (cleanTracking) {
        const existingShipment = await Shipment.findOne({
            country,
            orderId: { $ne: currentOrderId || '__none__' },
            'logistics.trackingNumber': cleanTracking
        }).sort({ updatedAt: -1, createdAt: -1 }).lean();
        if (existingShipment) {
            const existingOrder = await Order.findOne({ orderId: existingShipment.orderId }).lean().catch(() => null);
            return buildDuplicatePayload({
                reason: 'same_tracking_duplicate',
                order: existingOrder,
                shipment: existingShipment,
                phoneTail,
                message: formatAlreadySentMessage({
                    orderId: existingShipment.orderId,
                    dropiOrderId: getDropiOrderId(existingOrder, existingShipment),
                    trackingNumber: cleanTracking
                })
            });
        }

        const existingOrder = await Order.findOne({
            country,
            orderId: { $ne: currentOrderId || '__none__' },
            trackingNumber: cleanTracking
        }).sort({ updatedAt: -1, createdAt: -1 }).lean();
        if (existingOrder) {
            const existingShipment = await Shipment.findOne({ orderId: existingOrder.orderId }).lean().catch(() => null);
            return buildDuplicatePayload({
                reason: 'same_tracking_duplicate',
                order: existingOrder,
                shipment: existingShipment,
                phoneTail,
                message: formatAlreadySentMessage({
                    orderId: existingOrder.orderId,
                    dropiOrderId: getDropiOrderId(existingOrder, existingShipment),
                    trackingNumber: cleanTracking
                })
            });
        }
    }

    if (cleanDropiOrderId) {
        const existingShipment = await Shipment.findOne({
            country,
            orderId: { $ne: currentOrderId || '__none__' },
            $or: [
                { 'raw.droppiOrder.id': cleanDropiOrderId },
                { 'raw.droppiOrder.objects.id': cleanDropiOrderId },
                { 'raw.latestDroppiPayload.dropiOrderId': cleanDropiOrderId },
                { 'raw.manualDropiOrderId': cleanDropiOrderId }
            ]
        }).sort({ updatedAt: -1, createdAt: -1 }).lean();
        if (existingShipment) {
            const existingOrder = await Order.findOne({ orderId: existingShipment.orderId }).lean().catch(() => null);
            return buildDuplicatePayload({
                reason: 'same_dropi_order_duplicate',
                order: existingOrder,
                shipment: existingShipment,
                phoneTail
            });
        }

        const existingOrder = await Order.findOne({
            country,
            orderId: { $ne: currentOrderId || '__none__' },
            dropiOrderId: cleanDropiOrderId
        }).sort({ updatedAt: -1, createdAt: -1 }).lean();
        if (existingOrder) {
            const existingShipment = await Shipment.findOne({ orderId: existingOrder.orderId }).lean().catch(() => null);
            return buildDuplicatePayload({
                reason: 'same_dropi_order_duplicate',
                order: existingOrder,
                shipment: existingShipment,
                phoneTail
            });
        }
    }

    if (!phoneTail || phoneTail.length < 8) {
        return { allowed: true, reason: 'missing_phone', phoneTail };
    }

    const orders = await Order.find({
        country,
        orderId: { $ne: currentOrderId || '__none__' },
        'customer.phone': { $regex: `${phoneTail}$` }
    }).sort({ updatedAt: -1, createdAt: -1 }).limit(12);

    const orderIds = orders.map((order) => order.orderId).filter(Boolean);
    const shipments = orderIds.length
        ? await Shipment.find({ orderId: { $in: orderIds } }).lean()
        : [];
    const shipmentByOrderId = new Map(shipments.map((shipment) => [shipment.orderId, shipment]));
    const phoneShipments = await Shipment.find({
        country,
        orderId: { $ne: currentOrderId || '__none__' },
        'client.phone': { $regex: `${phoneTail}$` }
    }).sort({ updatedAt: -1, createdAt: -1 }).limit(12).lean();

    const activeDuplicate = orders.find((order) => {
        const shipment = shipmentByOrderId.get(order.orderId);
        if (isWhatsappMirrorWithoutDropiEvidence({ currentOrderId, duplicateOrder: order, duplicateShipment: shipment })) return false;
        return (
            ACTIVE_ORDER_STATUSES.includes(String(order.status || '').toLowerCase())
            || hasDropiSubmissionEvidence(order, shipment)
        ) && !orderLooksClosedForRepurchase(order, shipment);
    });

    if (activeDuplicate) {
        return buildDuplicatePayload({
            reason: 'active_duplicate_order',
            order: activeDuplicate,
            shipment: shipmentByOrderId.get(activeDuplicate.orderId),
            phoneTail,
            message: `Cliente ja possui pedido ativo (${activeDuplicate.orderId}). Nao liberar novo pedido automatico.`
        });
    }

    const activeShipmentDuplicate = phoneShipments.find((shipment) => {
        const reviewStatus = String(shipment.review?.reviewStatus || '');
        const recentlyAuthorized = withinRecentWindow(shipment.automation?.dropiSubmitAuthorizedAt);
        return (
            hasDropiSubmissionEvidence({}, shipment)
            || (recentlyAuthorized && ['dropi_submit_authorized', 'dropi_submit_running', 'submitted'].includes(reviewStatus))
        ) && !orderLooksClosedForRepurchase({}, shipment);
    });
    if (activeShipmentDuplicate) {
        const existingOrder = await Order.findOne({ orderId: activeShipmentDuplicate.orderId }).lean().catch(() => null);
        return buildDuplicatePayload({
            reason: hasDropiSubmissionEvidence(existingOrder, activeShipmentDuplicate)
                ? 'recent_dropi_submission_exists'
                : 'recent_active_shipment_exists',
            order: existingOrder,
            shipment: activeShipmentDuplicate,
            phoneTail
        });
    }

    const latestClosed = orders.find((order) => orderLooksClosedForRepurchase(order, shipmentByOrderId.get(order.orderId)));
    if (latestClosed) {
        return {
            allowed: true,
            reason: 'repurchase_manual_authorization_required',
            requiresManualAuthorization: true,
            phoneTail,
            latestOrderId: latestClosed.orderId,
            latestStatus: latestClosed.status,
            message: `Recompra detectada. Liberar somente com autorizacao manual (${latestClosed.orderId}).`
        };
    }

    return { allowed: true, reason: 'no_duplicate_history', phoneTail };
};

export const assertNoActiveDuplicateOrder = async (input = {}) => {
    const guard = await getOrderDuplicateGuard(input);
    if (guard.allowed) return guard;
    const error = new Error(guard.message || 'Pedido duplicado bloqueado');
    error.statusCode = 409;
    error.code = guard.reason;
    error.guard = guard;
    throw error;
};
