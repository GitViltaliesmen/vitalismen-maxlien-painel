import Shipment from '../models/Shipment.js';
import Order from '../models/Order.js';
import { syncOrderToOnlineAdminPanel } from './adminPanelStatusService.js';
import { ecuadorProductMetadata, resolveEcuadorProductInfo } from './ecuadorProductService.js';
import { normalizeEcuadorOrderFieldsForDropi } from './dropiDataNormalizationService.js';

const normalizePhone = (value) => String(value || '').replace(/\D/g, '');
export const normalizeEcuadorLocalPhone = (value) => {
    const digits = normalizePhone(value);
    if (digits.startsWith('593') && digits.length > 9) return digits.slice(3);
    return digits;
};

export const validateEcuadorDropiPhone = (value) => {
    const digits = normalizePhone(value);
    const local = normalizeEcuadorLocalPhone(value);
    if (!digits) {
        return { ok: false, reason: 'empty_phone', digits, local };
    }
    if (digits.startsWith('55') || digits.startsWith('59355')) {
        return { ok: false, reason: 'brazil_phone_not_allowed_for_dropi', digits, local };
    }
    if (digits.startsWith('593') && digits.length !== 12) {
        return { ok: false, reason: 'invalid_ecuador_e164_length', digits, local };
    }
    if (!/^9\d{8}$/.test(local)) {
        return { ok: false, reason: 'invalid_ecuador_mobile_phone', digits, local };
    }
    return { ok: true, reason: 'valid_ecuador_mobile_phone', digits, local };
};

const ECUADOR_CITY_PROVINCE = new Map([
    ['esmeralda', 'Esmeraldas'],
    ['esmeraldas', 'Esmeraldas'],
    ['portovelo', 'El Oro'],
    ['santo domingo', 'Santo Domingo de los Tsachilas']
]);

const ECUADOR_CITY_ALIASES = new Map([
    ['esmeralda', 'Esmeraldas']
]);

const ECUADOR_PROVINCE_ALIASES = new Map([
    ['esmeralda', 'Esmeraldas'],
    ['esmeraldas', 'Esmeraldas'],
    ['zamora', 'Zamora Chinchipe'],
    ['santo domingo', 'Santo Domingo de los Tsachilas'],
    ['canar', 'Cañar']
]);

const normalizeLocationKey = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const resolveEcuadorProvince = ({ province, city }) => {
    const rawProvince = String(province || '').trim();
    const rawCity = String(city || '').trim();
    const provinceKey = normalizeLocationKey(rawProvince);
    const cityKey = normalizeLocationKey(rawCity);
    if (cityKey && (!rawProvince || provinceKey === cityKey)) {
        return ECUADOR_CITY_PROVINCE.get(cityKey) || rawProvince;
    }
    return ECUADOR_PROVINCE_ALIASES.get(provinceKey) || rawProvince;
};

const resolveEcuadorCity = (city) => {
    const rawCity = String(city || '').trim();
    return ECUADOR_CITY_ALIASES.get(normalizeLocationKey(rawCity)) || rawCity;
};
const normalizeStatusText = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();

const normalizeRouteText = (value) => String(value || '')
    .replace(/\[\s*SER\s*4\s*VIENTREGA\s*\]/gi, 'Servientrega')
    .replace(/\[\s*SER4VIENTREGA\s*\]/gi, 'Servientrega')
    .replace(/\bSER\s*4\s*VIENTREGA\b/gi, 'Servientrega')
    .replace(/\bSER4VIENTREGA\b/gi, 'Servientrega')
    .replace(/\bser\s*entrega\b/gi, 'Servientrega')
    .replace(/\bserentrega\b/gi, 'Servientrega')
    .replace(/\bservi\s+en\s+trega\b/gi, 'Servientrega')
    .replace(/\bcervi\s+en\s+trega\b/gi, 'Servientrega')
    .replace(/\bservi\s+entrega\b/gi, 'Servientrega')
    .replace(/\bcervi\s+entrega\b/gi, 'Servientrega')
    .replace(/\bsanta\s+presca\b/gi, 'Santa Prisca')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const cleanDropiAgencyAddressTypo = (value) => String(value || '')
    .replace(/\[\s*SER\s*4\s*VIENTREGA\s*\]/gi, 'Servientrega')
    .replace(/\[\s*SER4VIENTREGA\s*\]/gi, 'Servientrega')
    .replace(/\bSER\s*4\s*VIENTREGA\b/gi, 'Servientrega')
    .replace(/\bSER4VIENTREGA\b/gi, 'Servientrega')
    .replace(/\bser\s*entrega\b/gi, 'Servientrega')
    .replace(/\bserentrega\b/gi, 'Servientrega')
    .replace(/\bservi\s+en\s+trega\b/gi, 'Servientrega')
    .replace(/\bcervi\s+en\s+trega\b/gi, 'Servientrega')
    .replace(/\bservi\s+entrega\b/gi, 'Servientrega')
    .replace(/\bcervi\s+entrega\b/gi, 'Servientrega')
    .replace(/\bsanta\s+presca\b/gi, 'Santa Prisca')
    .trim();

export const normalizeDroppiEcuadorStatus = (value) => {
    const raw = normalizeStatusText(value);
    if (!raw) return '';
    if (/NOVEDAD|INCIDENCIA|REPROGRAMAD[OA]/.test(raw)) return 'NOVEDAD';
    if (/DEVUELT[OA]|DEVOLUCION|NO[\s_]?RETIRAD[OA]|RETORNAD[OA]|RETURNED/.test(raw)) return 'DEVUELTO';
    if (/ENTREGAD[OA]|DELIVERED|REPORTADO ENTREGADO|MERCANCIA ENTREGADA|PEDIDO ENTREGADO/.test(raw)) return 'ENTREGADO';
    if (/^INGRESANDO EN AGENCIA\b/.test(raw)) return 'READY_FOR_PICKUP';
    if (/^PARA RETIRO EN AGENCIA\b/.test(raw)) return 'READY_FOR_PICKUP';
    if (/^EN RUTA A CONCESION\b/.test(raw)) return 'EN_RUTA';
    if (/^EN RUTA A CENTRO LOGISTICO\b/.test(raw)) return 'EN_RUTA';
    if (/^EN DISTRIBUCION\b/.test(raw)) return 'EN_RUTA';
    if (/^INGRESANDO OPERATIVO A\b/.test(raw)) return 'EN_RUTA';
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

const ecuadorUnitPriceForQuantity = (quantity, total = 0) => {
    const qty = Number(quantity || 1) || 1;
    const numericTotal = Number(total || 0);
    return numericTotal > 0 ? numericTotal / qty : 0;
};

export const upsertDroppiEcuadorShipment = async (payload) => {
    const orderId = String(payload.orderId || '').trim();
    if (!orderId) throw new Error('orderId is required');

    const shipment = await Shipment.findOne({ orderId }) || new Shipment({
        orderId,
        country: 'EC'
    });

    const normalizedStatus = normalizeDroppiEcuadorStatus(payload.status || shipment.logistics.status);
    const isDelivered = normalizedStatus === 'ENTREGADO';
    const isReturned = normalizedStatus === 'DEVUELTO';
    const normalizedShippingType = normalizeShippingType(payload.shippingType || shipment.logistics.shippingType);
    const normalizedAddress = normalizeRouteText(payload.address || '');
    const inferredAgencyPickup = /servientrega/i.test(normalizedAddress)
        || /agencia|concesion|retiro/i.test(normalizedAddress);
    const currentPreferredCarrier = shipment.logistics?.preferredCarrier || '';
    const preferredCarrier = payload.preferredCarrier
        || currentPreferredCarrier
        || 'SERVIENTREGA';
    const previousReviewStatus = shipment.review?.reviewStatus || '';
    const preserveManualReview = Boolean(
        previousReviewStatus === 'wrong_product_nitrix_manual_review'
        || previousReviewStatus === 'nitrix_dropi_product_pending'
    );

    shipment.provider = 'droppi';
    shipment.productName = preserveManualReview
        ? (shipment.productName || payload.productName || 'Vit Power')
        : (payload.productName || shipment.productName || 'Vit Power');
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
        sessionId: payload.sessionId || shipment.automation.sessionId,
        deliveredConfirmedAt: isDelivered
            ? (shipment.automation.deliveredConfirmedAt || new Date())
            : shipment.automation.deliveredConfirmedAt,
        prepaidOnlyNotifiedAt: isDelivered ? null : shipment.automation.prepaidOnlyNotifiedAt
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
            ?? (normalizedStatus === 'NOVEDAD' ? true : undefined)
            ?? shipment.review?.manualOnly
            ?? false
        ),
        reviewReason: payload.reviewReason || (normalizedStatus === 'NOVEDAD' ? 'novedad_logistica' : shipment.review?.reviewReason || ''),
        reviewStatus: payload.reviewStatus || shipment.review?.reviewStatus || ''
    };
    shipment.outcomes = {
        ...shipment.outcomes,
        delivered: isDelivered ? true : shipment.outcomes?.delivered,
        pickedUp: isDelivered ? true : shipment.outcomes?.pickedUp,
        returned: isReturned ? true : (isDelivered ? false : shipment.outcomes?.returned),
        prepaidOnly: isReturned ? true : (isDelivered ? false : shipment.outcomes?.prepaidOnly)
    };
    const submittedDropiOrderId = String(
        payload.dropiOrderId
        || payload.manualDropiOrderId
        || shipment.raw?.droppiOrder?.id
        || shipment.raw?.latestDroppiPayload?.dropiOrderId
        || ''
    ).trim();
    const preserveSubmittedReceipt = Boolean(
        shipment.automation?.submittedToDroppiAt
        && submittedDropiOrderId
    );
    const latestDroppiPayload = preserveSubmittedReceipt
        ? {
            ...payload,
            status: 'submitted',
            dropiStatus: payload.status || normalizedStatus || '',
            dropiOrderId: submittedDropiOrderId,
            submittedAt: shipment.automation.submittedToDroppiAt
        }
        : payload;
    shipment.raw = {
        ...(shipment.raw || {}),
        latestDroppiPayload,
        ...(payload.manualDropiOrderId || payload.dropiOrderId
            ? { manualDropiOrderId: payload.manualDropiOrderId || payload.dropiOrderId }
            : {})
    };
    shipment.notes = payload.detail || payload.notes || shipment.notes;
    shipment.events.push({
        kind: 'droppi_sync',
        at: new Date(),
        payload
    });
    shipment.events = shipment.events.slice(-60);

    await shipment.save();
    const orderStatus = normalizedStatus === 'ENTREGADO'
        ? 'delivered'
        : normalizedStatus === 'DEVUELTO'
            ? 'returned'
            : ['GUIA_GENERADA', 'READY_FOR_PICKUP', 'EN_RUTA', 'EN_REPARTO', 'EN_DESPACHO', 'EN_BODEGA_TRANSPORTADORA', 'MERCANCIA_RECOGIDA', 'EN_DISTRIBUCION_A_CLIENTE', 'NOVEDAD'].includes(normalizedStatus)
                ? 'shipped'
                : '';
    if (orderStatus) {
        const order = await Order.findOne({ orderId }).catch(() => null);
        if (order) {
            order.status = orderStatus;
            order.shippingStatus = normalizedStatus || order.shippingStatus || '';
            if (shipment.logistics?.trackingNumber) order.trackingNumber = shipment.logistics.trackingNumber;
            await order.save();
            syncOrderToOnlineAdminPanel(order, { status: orderStatus, action: 'dropi_status_sync' });
        }
    }
    return shipment;
};

export const buildDroppiEcuadorOrderPayload = ({ order }) => {
    const quantity = Number(order?.package?.id || order?.package?.quantity || 1) || 1;
    const exactTotal = Number(order?.total || 0);
    const sourceCity = resolveEcuadorCity(order?.customer?.city);
    const normalized = normalizeEcuadorOrderFieldsForDropi({
        name: order?.customer?.name || '',
        phone: order?.customer?.phone || '',
        address: cleanDropiAgencyAddressTypo(order?.customer?.address || ''),
        city: sourceCity,
        province: resolveEcuadorProvince({
            province: order?.customer?.province,
            city: sourceCity
        }),
        quantity,
        total: exactTotal
    });
    const splitName = splitClientName(normalized.name);
    const unitPrice = ecuadorUnitPriceForQuantity(quantity, exactTotal);
    const productInfo = resolveEcuadorProductInfo(order);
    const productMetadata = ecuadorProductMetadata(productInfo);
    return {
        orderId: String(order?.orderId || order?._id || '').trim(),
        firstName: splitName.firstName.trim(),
        lastName: splitName.lastName.trim(),
        phone: normalizeEcuadorLocalPhone(normalized.phone),
        department: normalized.province,
        city: normalized.city,
        address: normalized.address,
        reference: String(order?.customer?.reference || '').trim(),
        email: String(order?.customer?.email || '').trim(),
        ...productMetadata,
        quantity,
        price: exactTotal,
        unitPrice,
        paymentMode: 'CON_RECAUDO',
        preferredCarrier: 'SERVIENTREGA',
        fallbackCarrier: normalized.agencyPickup ? '' : 'LAARCOURIER',
        agencyPickup: normalized.agencyPickup,
        agencyName: normalized.agencyName || '',
        agencyValidated: normalized.agencyValidated === true,
        normalizedBy: normalized.normalizedBy || ''
    };
};
