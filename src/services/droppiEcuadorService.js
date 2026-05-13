import Shipment from '../models/Shipment.js';

const normalizePhone = (value) => String(value || '').replace(/\D/g, '');
const normalizeEcuadorLocalPhone = (value) => {
    const digits = normalizePhone(value);
    if (digits.startsWith('593') && digits.length > 9) return digits.slice(3);
    return digits;
};
const normalizeStatusText = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();

const normalizeRouteText = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export const normalizeDroppiEcuadorStatus = (value) => {
    const raw = normalizeStatusText(value);
    if (!raw) return '';
    if (/^INGRESANDO EN AGENCIA\b/.test(raw)) return 'READY_FOR_PICKUP';
    if (/^EN RUTA A CONCESION\b/.test(raw)) return 'EN_RUTA';
    if (raw === 'NOVEDAD') return 'NOVEDAD';
    if (raw === 'GUIA_GENERADA') return 'GUIA_GENERADA';
    if (raw === 'PREPARADO PARA TRANSPORTADORA') return 'GUIA_GENERADA';
    if (raw === 'PENDIENTE') return 'PENDIENTE';
    if (raw === 'MERCANCIA RECOGIDA') return 'MERCANCIA_RECOGIDA';
    if (raw === 'EN BODEGA TRANSPORTADORA') return 'EN_BODEGA_TRANSPORTADORA';
    if (raw === 'EN DESPACHO') return 'EN_DESPACHO';
    if (raw === 'EN RUTA') return 'EN_RUTA';
    if (raw === 'EN REPARTO') return 'EN_REPARTO';
    if (raw === 'EN PROCESAMIENTO') return 'EN_PROCESAMIENTO';
    if (raw === 'EN AGENCIA' || raw === 'LISTO PARA RETIRO' || raw === 'READY_FOR_PICKUP') {
        return 'READY_FOR_PICKUP';
    }
    if (raw === 'DEVOLUCION' || raw === 'DEVUELTO' || raw === 'RETURNED' || raw === 'NO_RETIRADO') {
        return 'DEVUELTO';
    }
    if (raw === 'ENTREGADO' || raw === 'DELIVERED') return 'ENTREGADO';
    return raw.replace(/\s+/g, '_');
};

const splitClientName = (name) => {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length <= 1) return { firstName: parts[0] || '', lastName: '' };
    return {
        firstName: parts.slice(0, -1).join(' '),
        lastName: parts.slice(-1).join(' ')
    };
};

const normalizeShippingType = (value) => {
    const raw = String(value || '').trim().toUpperCase();
    if (!raw) return '';
    if (raw === 'CONTRA ENTREGA') return 'CON RECAUDO';
    return raw;
};

export const upsertDroppiEcuadorShipment = async (payload) => {
    const orderId = String(payload.orderId || '').trim();
    if (!orderId) throw new Error('orderId is required');

    const shipment = await Shipment.findOne({ orderId }) || new Shipment({
        orderId,
        country: 'EC'
    });

    const normalizedStatus = normalizeDroppiEcuadorStatus(payload.status || shipment.logistics.status);
    const normalizedShippingType = normalizeShippingType(payload.shippingType || shipment.logistics.shippingType);
    const normalizedAddress = normalizeRouteText(payload.address || '');
    const inferredAgencyPickup = /servientrega/i.test(normalizedAddress)
        || /agencia|concesion|retiro/i.test(normalizedAddress);
    const currentPreferredCarrier = shipment.logistics?.preferredCarrier || '';
    const preferredCarrier = payload.preferredCarrier
        || currentPreferredCarrier
        || 'SERVIENTREGA';

    shipment.provider = 'droppi';
    shipment.productName = payload.productName || shipment.productName || 'Vit Power';
    shipment.client = {
        ...shipment.client,
        name: payload.clientName || shipment.client.name,
        phone: normalizePhone(payload.phone || shipment.client.phone),
        email: payload.email || shipment.client.email,
        address: payload.address || shipment.client.address,
        city: payload.city || shipment.client.city,
        province: payload.province || shipment.client.province,
        reference: payload.reference || shipment.client.reference
    };
    shipment.logistics = {
        ...shipment.logistics,
        status: normalizedStatus || shipment.logistics.status,
        trackingNumber: payload.trackingNumber || shipment.logistics.trackingNumber,
        distributionCompany: payload.distributionCompany || shipment.logistics.distributionCompany,
        warehouse: payload.warehouse || shipment.logistics.warehouse,
        shippingType: normalizedShippingType || shipment.logistics.shippingType,
        preferredCarrier,
        chosenCarrier: payload.chosenCarrier || shipment.logistics.chosenCarrier,
        agencyPickup: Boolean(payload.agencyPickup ?? inferredAgencyPickup ?? shipment.logistics.agencyPickup),
        agencyName: payload.agencyName || shipment.logistics.agencyName,
        invoiceUrl: payload.invoiceUrl || shipment.logistics.invoiceUrl,
        invoicePath: payload.invoicePath || shipment.logistics.invoicePath,
        lastStatusAt: payload.lastStatusAt || new Date()
    };
    shipment.automation = {
        ...shipment.automation,
        sessionId: payload.sessionId || shipment.automation.sessionId
    };
    shipment.treatment = {
        ...shipment.treatment,
        unitsPurchased: Number(payload.quantity || payload.unitsPurchased || shipment.treatment?.unitsPurchased || 1) || 1,
        daysPerUnit: Number(payload.daysPerUnit || shipment.treatment?.daysPerUnit || 30) || 30,
        targetUnits: Number(payload.targetUnits || shipment.treatment?.targetUnits || 6) || 6
    };
    shipment.review = {
        ...shipment.review,
        manualOnly: Boolean(
            payload.manualOnly
            ?? (normalizedStatus === 'NOVEDAD')
            ?? shipment.review?.manualOnly
            ?? false
        ),
        reviewReason: payload.reviewReason || (normalizedStatus === 'NOVEDAD' ? 'novedad_logistica' : shipment.review?.reviewReason || ''),
        reviewStatus: payload.reviewStatus || shipment.review?.reviewStatus || ''
    };
    shipment.outcomes = {
        ...shipment.outcomes,
        delivered: normalizedStatus === 'ENTREGADO' ? true : shipment.outcomes?.delivered,
        returned: normalizedStatus === 'DEVUELTO' ? true : shipment.outcomes?.returned,
        prepaidOnly: normalizedStatus === 'DEVUELTO' ? true : shipment.outcomes?.prepaidOnly
    };
    shipment.raw = {
        ...(shipment.raw || {}),
        latestDroppiPayload: payload
    };
    shipment.notes = payload.detail || payload.notes || shipment.notes;
    shipment.events.push({
        kind: 'droppi_sync',
        at: new Date(),
        payload
    });
    shipment.events = shipment.events.slice(-60);

    await shipment.save();
    return shipment;
};

export const buildDroppiEcuadorOrderPayload = ({ order }) => {
    const splitName = splitClientName(order?.customer?.name || '');
    const rawAddress = String(order?.customer?.address || '');
    const normalizedAddress = normalizeRouteText(rawAddress);
    const isAgencyPickup = /servientrega|agencia|concesion|retiro/i.test(normalizedAddress);
    return {
        orderId: String(order?.orderId || order?._id || '').trim(),
        firstName: splitName.firstName.trim(),
        lastName: splitName.lastName.trim(),
        phone: normalizeEcuadorLocalPhone(order?.customer?.phone),
        department: String(order?.customer?.province || '').trim(),
        city: String(order?.customer?.city || '').trim(),
        address: String(order?.customer?.address || '').trim(),
        reference: String(order?.customer?.reference || '').trim(),
        email: String(order?.customer?.email || '').trim(),
        productName: 'Vit Power',
        quantity: order?.package?.id || order?.package?.quantity || 1,
        price: order?.total || 0,
        unitPrice: (Number(order?.total || 0) && Number(order?.package?.id || order?.package?.quantity || 1))
            ? Number(order.total) / Number(order.package?.id || order.package?.quantity || 1)
            : Number(order?.total || 0),
        paymentMode: 'CON_RECAUDO',
        preferredCarrier: 'SERVIENTREGA',
        fallbackCarrier: isAgencyPickup ? '' : 'LAARCOURIER',
        agencyPickup: isAgencyPickup
    };
};
