const STATUS_DEFINITIONS = Object.freeze({
    atendendo: { key: 'atendendo', label: 'Atendendo', color: '#0b9b7e' },
    comprar_depois: { key: 'comprar_depois', label: 'Comprar depois', color: '#b77900' },
    confirmado: { key: 'confirmado', label: 'Confirmado', color: '#2467c9' },
    enviado: { key: 'enviado', label: 'Enviado', color: '#7b50b3' },
    em_rota: { key: 'em_rota', label: 'Em rota', color: '#bd6a00' },
    na_agencia: { key: 'na_agencia', label: 'Na agência', color: '#d25f00' },
    entregue: { key: 'entregue', label: 'Entregue', color: '#218739' },
    devolvido: { key: 'devolvido', label: 'Devolvido', color: '#a3457a' },
    cancelado: { key: 'cancelado', label: 'Cancelado', color: '#b33939' }
});

export const OPERATIONAL_CHAT_STATUS_KEYS = Object.freeze(Object.keys(STATUS_DEFINITIONS));

const normalized = (value = '') => String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

const upper = (value = '') => String(value || '').trim().toUpperCase();

export const isOperationalChatStatusKey = (value) => OPERATIONAL_CHAT_STATUS_KEYS.includes(normalized(value));

export const operationalChatStatusDefinition = (value) => STATUS_DEFINITIONS[normalized(value)] || null;

const datedStatus = (key, source, updatedAt = null, extra = {}) => ({
    ...STATUS_DEFINITIONS[key],
    source,
    manual: source === 'manual',
    updatedAt: updatedAt || null,
    ...extra
});

const shipmentStatusKey = (shipment = {}) => {
    const status = upper(shipment.logistics?.status);
    if (shipment.outcomes?.returned || /DEVUEL|RETURN|DEVOLU|NO_RETIR/.test(status)) return 'devolvido';
    if (/CANCEL/.test(status)) return 'cancelado';
    if (shipment.outcomes?.delivered || shipment.outcomes?.pickedUp || /ENTREGAD|DELIVERED|RETIRADO/.test(status)) return 'entregue';
    if (/READY_FOR_PICKUP|LISTO.*RETIR|AGENCIA.*RETIRO|DISPONIBLE.*AGENCIA/.test(status)) return 'na_agencia';
    if (/EN_RUTA|RUTA|TRANSIT|REPARTO|DISTRIBUCION|DESPACHO/.test(status)) return 'em_rota';
    if (
        shipment.automation?.submittedToDroppiAt
        || shipment.logistics?.trackingNumber
        || /GUIA_GENERADA|PREPARADO|MERCANCIA|BODEGA|PROCESAMIENTO/.test(status)
    ) return 'enviado';
    return '';
};

const orderStatusKey = (order = {}) => {
    const status = normalized(order.status || order.shippingStatus);
    if (['returned', 'devolvido'].includes(status)) return 'devolvido';
    if (['cancelled', 'canceled', 'cancelado'].includes(status)) return 'cancelado';
    if (['delivered', 'entregue'].includes(status)) return 'entregue';
    if (['shipped', 'processing', 'pedido_enviado', 'enviado'].includes(status)) return 'enviado';
    if (['confirmed', 'confirmado'].includes(status)) return 'confirmado';
    return '';
};

const draftStatusKey = (contactState = {}) => {
    const draft = contactState.metadata?.customerDraft || {};
    const status = normalized(draft.status);
    if (['comprar_depois', 'buy_later'].includes(status)) return 'comprar_depois';
    if (['devolvido', 'returned'].includes(status)) return 'devolvido';
    if (['cancelado', 'cancelled', 'canceled'].includes(status)) return 'cancelado';
    if (['entregue', 'delivered'].includes(status)) return 'entregue';
    if (['pedido_enviado', 'processing', 'shipped', 'enviado'].includes(status)) return 'enviado';
    if (['confirmado', 'confirmed'].includes(status)) return 'confirmado';
    return 'atendendo';
};

export const resolveOperationalChatStatus = ({ contactState = null, order = null, shipment = null } = {}) => {
    const manualOverride = contactState?.metadata?.whatsappLabelOverride || null;
    const overrideKey = normalized(manualOverride?.key);
    if (manualOverride && STATUS_DEFINITIONS[overrideKey]) {
        return datedStatus(overrideKey, 'manual', manualOverride.updatedAt || contactState?.updatedAt, {
            overriddenBy: String(manualOverride.updatedBy || '')
        });
    }

    const logisticsKey = shipmentStatusKey(shipment || {});
    if (logisticsKey) {
        return datedStatus(
            logisticsKey,
            'shipment',
            shipment?.logistics?.lastStatusAt || shipment?.updatedAt || shipment?.createdAt
        );
    }

    const commercialKey = orderStatusKey(order || {});
    if (commercialKey) {
        return datedStatus(commercialKey, 'order', order?.updatedAt || order?.confirmedAt || order?.createdAt);
    }

    return datedStatus(
        draftStatusKey(contactState || {}),
        'draft',
        contactState?.metadata?.customerDraft?.updatedAt || contactState?.updatedAt || contactState?.createdAt
    );
};

export default resolveOperationalChatStatus;
