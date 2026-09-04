import Shipment from '../models/Shipment.js';
import Order from '../models/Order.js';
import { syncOrderToOnlineAdminPanel } from './adminPanelStatusService.js';
import { ecuadorProductMetadata, resolveEcuadorProductInfo } from './ecuadorProductService.js';
import { normalizeEcuadorOrderFieldsForDropi } from './dropiDataNormalizationService.js';
import { isExplicitDropiPickupReleaseStatus } from './postSalePickupReconciliationPolicy.js';
import { resolveStaleDropiRejectedReviewAtomic } from './dropiRejectedReviewResolutionService.js';

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
    if (/CANCELAD[OA]|CANCELLED|CANCELED/.test(raw)) return 'CANCELADO';
    if (/RECHAZAD[OA]|REJECTED|FAILED|FAILURE|FALLID[OA]/.test(raw)) return 'RECHAZADO';
    if (/^PARA RETIRO EN AGENCIA\b/.test(raw)) return 'READY_FOR_PICKUP';
    if (/^LIST[OA] PARA RETIRO\b/.test(raw)) return 'READY_FOR_PICKUP';
    if (/^DISPONIBLE.*RETIRO\b/.test(raw)) return 'READY_FOR_PICKUP';
    if (/^INGRESANDO DE RECOLECCION A\b/.test(raw)) return 'MERCANCIA_RECOGIDA';
    if (/^INGRESANDO EN AGENCIA\b/.test(raw)) return 'EN_RUTA';
    if (/^PUNTO DE RETIRO\b/.test(raw)) return 'EN_RUTA';
    if (/^EN RUTA A CONCESION\b/.test(raw)) return 'EN_RUTA';
    if (/^EN RUTA A CENTRO LOGISTICO\b/.test(raw)) return 'EN_RUTA';
    if (/^EN DISTRIBUCION\b/.test(raw)) return 'EN_RUTA';
    if (/^INGRESANDO OPERATIVO A\b/.test(raw)) return 'EN_RUTA';
    if (raw === 'GUIA_GENERADA') return 'GUIA_GENERADA';
    if (raw === 'PREPARADO PARA TRANSPORTADORA') return 'GUIA_GENERADA';
    if (raw === 'PENDIENTE' || raw === 'PENDING') return 'PENDIENTE';
    if (raw === 'MERCANCIA RECOGIDA') return 'MERCANCIA_RECOGIDA';
    if (raw === 'EN BODEGA TRANSPORTADORA') return 'EN_BODEGA_TRANSPORTADORA';
    if (raw === 'EN DESPACHO') return 'EN_DESPACHO';
    if (raw === 'EN RUTA') return 'EN_RUTA';
    if (raw === 'EN REPARTO') return 'EN_REPARTO';
    if (raw === 'EN PROCESAMIENTO' || raw === 'PROCESSING') return 'EN_PROCESAMIENTO';
    if (raw === 'SHIPPED' || raw === 'ENVIADO' || raw === 'DESPACHADO') return 'EN_RUTA';
    if (raw === 'EN AGENCIA') return 'EN_RUTA';
    if (raw === 'LISTO PARA RETIRO' || raw === 'READY_FOR_PICKUP') {
        return 'READY_FOR_PICKUP';
    }
    return raw.replace(/\s+/g, '_');
};

export const droppiEcuadorOrderStatusForLogisticsStatus = (value) => {
    const status = normalizeDroppiEcuadorStatus(value);
    if (status === 'ENTREGADO') return 'delivered';
    if (status === 'DEVUELTO') return 'returned';
    if (status === 'CANCELADO' || status === 'RECHAZADO') return 'cancelled';
    if (status === 'PENDIENTE' || status === 'EN_PROCESAMIENTO') return 'processing';
    if ([
        'GUIA_GENERADA',
        'READY_FOR_PICKUP',
        'MERCANCIA_RECOGIDA',
        'EN_BODEGA_TRANSPORTADORA',
        'EN_DESPACHO',
        'EN_RUTA',
        'EN_REPARTO',
        'EN_DISTRIBUCION_A_CLIENTE',
        'NOVEDAD'
    ].includes(status)) return 'shipped';
    return '';
};

const ECUADOR_DROPI_NAME_PARTICLES = new Set([
    'DA', 'DAS', 'DE', 'DEL', 'DELLA', 'DI', 'DO', 'DOS', 'E', 'EL', 'LA', 'LAS', 'LOS', 'Y'
]);
const ECUADOR_DROPI_HUMAN_NAME_TOKEN = /^\p{L}+(?:['’\-]\p{L}+)*$/u;

const normalizeEcuadorDropiCustomerName = (value) => String(value || '')
    .normalize('NFC')
    .replace(/[_\t\n\r]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const validateEcuadorDropiCustomerName = (value) => {
    const rawName = String(value || '');
    const name = normalizeEcuadorDropiCustomerName(rawName);
    const tokens = name.split(/\s+/).filter(Boolean);
    const normalizedTokens = tokens.map((token) => token
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase());
    const substantiveTokens = normalizedTokens.filter((token) => (
        token.length >= 2 && !ECUADOR_DROPI_NAME_PARTICLES.has(token)
    ));

    if (!name) {
        return { ok: false, reason: 'empty_customer_name', name, tokens };
    }
    if (name.length < 5 || name.length > 100) {
        return { ok: false, reason: 'invalid_customer_name_length', name, tokens };
    }
    if (/_|@|https?:\/\/|\bwww\.|\.[a-z]{2,}(?:\/|$)/iu.test(rawName)) {
        return { ok: false, reason: 'technical_customer_name_not_allowed', name, tokens };
    }
    if (/\p{N}/u.test(name)) {
        return { ok: false, reason: 'customer_name_contains_digits', name, tokens };
    }
    if (tokens.length < 2) {
        return { ok: false, reason: 'customer_surname_required', name, tokens };
    }
    if (!tokens.every((token) => ECUADOR_DROPI_HUMAN_NAME_TOKEN.test(token))) {
        return { ok: false, reason: 'invalid_customer_name_characters', name, tokens };
    }
    if (substantiveTokens.length < 2) {
        return { ok: false, reason: 'customer_name_and_surname_required', name, tokens };
    }
    return {
        ok: true,
        reason: 'valid_customer_full_name',
        name,
        tokens
    };
};

const splitClientName = (name) => {
    const validation = validateEcuadorDropiCustomerName(name);
    if (!validation.ok) {
        const error = new Error('Dropi bloqueada: informe o nome e o sobrenome reais do cliente. Nomes tecnicos, usuarios e nomes com numeros nao sao aceitos.');
        error.code = 'DROPI_CUSTOMER_FULL_NAME_REQUIRED';
        error.statusCode = 409;
        error.reason = validation.reason;
        error.nameValidation = validation;
        throw error;
    }
    const parts = validation.tokens;
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

    let shipment = await Shipment.findOne({ orderId }) || new Shipment({
        orderId,
        country: 'EC'
    });

    const normalizedStatus = normalizeDroppiEcuadorStatus(payload.status || shipment.logistics.status);
    const explicitPickupRelease = normalizedStatus === 'READY_FOR_PICKUP'
        && isExplicitDropiPickupReleaseStatus(payload.status || normalizedStatus);
    const pickupReleaseVerifiedAt = explicitPickupRelease
        ? (shipment.logistics?.pickupReadyVerifiedAt || new Date())
        : shipment.logistics?.pickupReadyVerifiedAt;
    const isDelivered = normalizedStatus === 'ENTREGADO';
    const isReturned = normalizedStatus === 'DEVUELTO';
    const isProviderFailure = normalizedStatus === 'RECHAZADO';
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
        pickupReadyVerified: explicitPickupRelease ? true : shipment.logistics.pickupReadyVerified,
        pickupReadyVerifiedAt: pickupReleaseVerifiedAt,
        pickupReadyVerifiedSource: explicitPickupRelease
            ? 'dropi_explicit_pickup_release'
            : shipment.logistics.pickupReadyVerifiedSource,
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
            ?? (['NOVEDAD', 'RECHAZADO'].includes(normalizedStatus) ? true : undefined)
            ?? shipment.review?.manualOnly
            ?? false
        ),
        reviewReason: payload.reviewReason
            || (normalizedStatus === 'NOVEDAD' ? 'novedad_logistica' : '')
            || (isProviderFailure ? 'dropi_provider_rejected' : '')
            || shipment.review?.reviewReason
            || '',
        reviewStatus: payload.reviewStatus
            || (isProviderFailure ? 'dropi_provider_rejected' : '')
            || shipment.review?.reviewStatus
            || ''
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
        payload: {
            ...payload,
            pickupReadyVerified: explicitPickupRelease,
            pickupReadyVerifiedSource: explicitPickupRelease ? 'dropi_explicit_pickup_release' : ''
        }
    });
    shipment.events = shipment.events.slice(-60);

    await shipment.save();
    const resolutionSource = payload.reconciliationSource || payload.syncSource || '';
    const authoritativeIdentityPresent = Boolean(submittedDropiOrderId || shipment.logistics?.trackingNumber);
    if (authoritativeIdentityPresent && resolutionSource) {
        const resolution = await resolveStaleDropiRejectedReviewAtomic({
            shipment,
            evidence: {
                source: resolutionSource,
                orderId,
                dropiOrderId: submittedDropiOrderId,
                trackingNumber: shipment.logistics?.trackingNumber || '',
                status: normalizedStatus,
                observedAt: payload.lastStatusAt || payload.observedAt || new Date()
            }
        });
        if (resolution.resolved && resolution.shipment) shipment = resolution.shipment;
    }
    const orderStatus = droppiEcuadorOrderStatusForLogisticsStatus(normalizedStatus);
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
