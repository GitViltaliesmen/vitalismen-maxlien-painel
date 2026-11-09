import Shipment from '../models/Shipment.js';
import Order from '../models/Order.js';
import { ecPhoneV203, historicalEligibilityV203 } from './ecHistoricalOrderStatusV203Service.js';
import { readEcLegacyHistoryV203 } from './ecHistoricalLegacyV203Service.js';

export const PREPAID_REQUIRED_MESSAGE = 'Gracias por su interes. Como el pedido anterior no fue retirado y la transportadora lo devolvio, el sistema solo libera un nuevo envio con pago anticipado. Si desea continuar, con gusto le ayudo con el valor y el proceso de pago.';
export const ACTIVE_SHIPMENT_MESSAGE = 'Este cliente ya tiene un pedido en andamento para retirar o recibir. Solo liberar un nuevo pedido cuando Dropi confirme que el pedido anterior fue retirado o entregado.';
const REVIEW_MESSAGE = 'El historial de entrega necesita una revision manual antes de autorizar otro envio.';

export const getCustomerPurchaseEligibility = async ({ phone = '', country = 'EC', currentOrderId = '' } = {}) => {
    const peer = ecPhoneV203(phone);
    if (!peer || country !== 'EC') return historicalEligibilityV203({ phone, country });
    let shipments = [], orders = [], unavailable = false;
    try {
        [shipments, orders] = await Promise.all([
            Shipment.find({ country: 'EC', 'client.phone': { $regex: `${peer.slice(-9)}$` } }).sort({ updatedAt: -1, createdAt: -1 }).lean(),
            Order.find({ country: 'EC', 'customer.phone': { $regex: `${peer.slice(-9)}$` } }).sort({ updatedAt: -1, createdAt: -1 }).lean()
        ]);
    } catch { unavailable = true; }
    const legacy = readEcLegacyHistoryV203(peer);
    const decision = historicalEligibilityV203({ phone: peer, country, currentOrderId, shipments, orders, legacyLeads: legacy.leads, unavailable: unavailable || !legacy.available });
    return {
        ...decision,
        latestShipment: shipments[0] || null,
        ...(!decision.eligible ? { message: decision.paymentMode === 'prepaid_only' ? PREPAID_REQUIRED_MESSAGE : decision.paymentMode === 'blocked_until_pickup' ? ACTIVE_SHIPMENT_MESSAGE : REVIEW_MESSAGE } : {})
    };
};

export const assertCustomerHistoryForDropiV203 = async order => {
    const decision = await getCustomerPurchaseEligibility({ phone: order?.customer?.phone, country: order?.country, currentOrderId: order?.orderId });
    if (decision.eligible) return decision;
    const error = new Error(decision.message || 'Revise o historico de retirada/devolucao antes de autorizar outro envio.');
    error.status = 409;
    error.code = 'historical_customer_send_blocked';
    error.eligibility = decision;
    throw error;
};
