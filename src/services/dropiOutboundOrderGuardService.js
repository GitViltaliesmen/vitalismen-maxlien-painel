import Shipment from '../models/Shipment.js';
import Order from '../models/Order.js';
import ContactState from '../models/ContactState.js';

const digitsOnly = (value) => String(value || '').replace(/\D/g, '');

const enabled = () => String(process.env.DROPPI_OUTBOUND_ORDER_GUARD_ENABLED || 'true').toLowerCase() !== 'false';

const priorityBotTestPhones = () => [
    '5515998038637',
    process.env.WHATSAPP_PRIORITY_TEST_PHONES
]
    .join(',')
    .split(',')
    .map((item) => digitsOnly(item))
    .filter(Boolean);

const isPriorityBotTestPhone = (...values) => {
    const allowed = priorityBotTestPhones();
    return values
        .map((item) => digitsOnly(item))
        .filter(Boolean)
        .some((candidate) => allowed.some((allowedPhone) => (
            candidate === allowedPhone
            || candidate.endsWith(allowedPhone)
            || allowedPhone.endsWith(candidate)
        )));
};

const normalizeTail = (value) => {
    const digits = digitsOnly(value);
    if (!digits) return '';
    return digits.length > 10 ? digits.slice(-10) : digits;
};

const isNonEcRealPhone = (value = '') => {
    const digits = digitsOnly(value);
    return Boolean(digits && !digits.startsWith('593') && /^(55|57)\d{8,13}$/.test(digits));
};

const hasProtectedNoDropiState = async (...values) => {
    const tails = values
        .map((value) => digitsOnly(value))
        .filter(Boolean)
        .flatMap((digits) => [
            digits,
            digits.length >= 10 ? digits.slice(-10) : '',
            digits.length >= 11 ? digits.slice(-11) : ''
        ])
        .filter((digits) => digits.length >= 8);
    if (!tails.length) return false;

    const state = await ContactState.findOne({
        $and: [
            {
                $or: [
                    ...tails.map((tail) => ({ phoneDigits: { $regex: `${tail}$` } })),
                    ...tails.map((tail) => ({ 'metadata.customerPhoneDigits': { $regex: `${tail}$` } })),
                    ...tails.map((tail) => ({ 'metadata.lastSenderPn': { $regex: tail } }))
                ]
            },
            {
                $or: [
                    { 'metadata.noDropiEver': true },
                    { 'metadata.botTestEnabled': true },
                    { 'metadata.outboundTestOnly': true }
                ]
            }
        ]
    }).lean().catch(() => null);
    return Boolean(state);
};

const isClosedShipment = (shipment = {}) => {
    const status = String(shipment?.logistics?.status || '').toUpperCase();
    return status === 'ENTREGADO'
        || status === 'DEVUELTO'
        || shipment?.outcomes?.delivered === true
        || shipment?.outcomes?.returned === true;
};

const isClosedOrder = (order = {}) => ['delivered', 'cancelled', 'returned']
    .includes(String(order?.status || '').toLowerCase());

const orderHasDropiEvidence = (order = {}) => Boolean(
    order?.dropiOrderId
    || order?.trackingNumber
    || order?.shippingStatus
    || ['processing', 'shipped'].includes(String(order?.status || '').toLowerCase())
);

const isLogisticsOrOrderCareText = (text = '') => {
    const normalized = String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    return /\b(pedido|orden|guia|rastreo|tracking|retir|retiro|servientrega|agencia|entrega|entregado|jueves|miercoles|documento|novedad|confirm|gracias|listo)\b/i.test(normalized);
};

export const checkDropiOrderBeforeOutbound = async ({
    jid = '',
    recipientDigits = '',
    text = '',
    allowExistingDropiOrder = false,
    outboundContext = ''
} = {}) => {
    if (!enabled()) return { allowed: true, reason: 'guard_disabled' };
    if (allowExistingDropiOrder) return { allowed: true, reason: 'allowed_context', outboundContext };
    if (isPriorityBotTestPhone(jid, recipientDigits)) {
        return { allowed: true, reason: 'priority_test_phone_no_dropi_guard_bypass', outboundContext };
    }
    if (isNonEcRealPhone(recipientDigits || jid)) {
        return { allowed: true, reason: 'non_ec_real_phone_no_dropi_guard', outboundContext };
    }
    if (await hasProtectedNoDropiState(jid, recipientDigits)) {
        return { allowed: true, reason: 'protected_no_dropi_state_bypass', outboundContext };
    }

    const phoneTail = normalizeTail(recipientDigits || jid);
    if (!phoneTail || phoneTail.length < 8) return { allowed: true, reason: 'missing_phone_tail' };

    const shipment = await Shipment.findOne({
        country: 'EC',
        'client.phone': { $regex: `${phoneTail}$` }
    }).sort({ updatedAt: -1, createdAt: -1 }).lean();

    if (shipment && !isClosedShipment(shipment)) {
        if (isLogisticsOrOrderCareText(text)) {
            return {
                allowed: true,
                reason: 'active_dropi_order_logistics_text_allowed',
                source: 'shipment',
                phoneTail,
                orderId: shipment.orderId || '',
                trackingNumber: shipment.logistics?.trackingNumber || '',
                status: shipment.logistics?.status || ''
            };
        }
        return {
            allowed: false,
            reason: 'dropi_order_exists',
            source: 'shipment',
            phoneTail,
            orderId: shipment.orderId || '',
            trackingNumber: shipment.logistics?.trackingNumber || '',
            status: shipment.logistics?.status || ''
        };
    }

    const order = await Order.findOne({
        country: 'EC',
        'customer.phone': { $regex: `${phoneTail}$` }
    }).sort({ updatedAt: -1, createdAt: -1 }).lean();

    if (order && !isClosedOrder(order) && orderHasDropiEvidence(order)) {
        if (isLogisticsOrOrderCareText(text)) {
            return {
                allowed: true,
                reason: 'active_dropi_order_logistics_text_allowed',
                source: 'order',
                phoneTail,
                orderId: order.orderId || '',
                trackingNumber: order.trackingNumber || '',
                status: order.status || ''
            };
        }
        return {
            allowed: false,
            reason: 'dropi_order_exists',
            source: 'order',
            phoneTail,
            orderId: order.orderId || '',
            trackingNumber: order.trackingNumber || '',
            status: order.status || ''
        };
    }

    return { allowed: true, reason: 'no_active_dropi_order', phoneTail };
};
