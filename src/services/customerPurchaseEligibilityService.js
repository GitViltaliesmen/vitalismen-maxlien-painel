import Shipment from '../models/Shipment.js';

const normalizePhoneTail = (value) => String(value || '').replace(/\D/g, '').slice(-10);

export const PREPAID_REQUIRED_MESSAGE = 'Gracias por su interes. Como el pedido anterior no fue retirado y la transportadora lo devolvio, el sistema solo libera un nuevo envio con pago anticipado. Si desea continuar, con gusto le ayudo con el valor y el proceso de pago.';
export const ACTIVE_SHIPMENT_MESSAGE = 'Este cliente ya tiene un pedido en andamento para retirar o recibir. Solo liberar un nuevo pedido cuando Dropi confirme que el pedido anterior fue retirado o entregado.';

export const getCustomerPurchaseEligibility = async ({ phone = '', country = 'EC' } = {}) => {
    const phoneTail = normalizePhoneTail(phone);
    if (!phoneTail) {
        return {
            eligible: true,
            reason: 'missing_phone',
            paymentMode: 'cash_on_delivery'
        };
    }

    const latestShipment = await Shipment.findOne({
        country,
        'client.phone': { $regex: `${phoneTail}$` }
    }).sort({ updatedAt: -1, createdAt: -1 });

    if (!latestShipment) {
        return {
            eligible: true,
            reason: 'no_previous_shipment',
            paymentMode: 'cash_on_delivery'
        };
    }

    const released = Boolean(
        latestShipment.outcomes?.pickedUp
        || latestShipment.outcomes?.delivered
        || latestShipment.automation?.deliveredConfirmedAt
    );

    if (released) {
        return {
            eligible: true,
            reason: 'previous_delivery_confirmed',
            paymentMode: 'cash_on_delivery',
            latestShipment
        };
    }

    const prepaidOnly = Boolean(
        latestShipment.outcomes?.prepaidOnly
        || latestShipment.outcomes?.returned
        || latestShipment.automation?.returnedNotifiedAt
    );

    if (prepaidOnly) {
        return {
            eligible: false,
            reason: 'previous_order_not_picked_up',
            paymentMode: 'prepaid_only',
            message: PREPAID_REQUIRED_MESSAGE,
            latestShipment
        };
    }

    return {
        eligible: false,
        reason: 'active_shipment_until_dropi_delivery',
        paymentMode: 'blocked_until_pickup',
        message: ACTIVE_SHIPMENT_MESSAGE,
        latestShipment
    };
};
