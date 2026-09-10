import {
    normalizeDroppiEcuadorStatus,
    upsertDroppiEcuadorShipment
} from './droppiEcuadorService.js';
import Shipment from '../models/Shipment.js';
import Order from '../models/Order.js';
import {
    notifyReadyForPickup,
    notifyShipmentGuideGenerated
} from './shipmentMessageService.js';

const ORDER_ID_RE = /^\d{6,}$/;
const STATUS_RE = /^(GUIA_GENERADA|PREPARADO PARA TRANSPORTADORA|MERCANCIA RECOGIDA|EN BODEGA TRANSPORTADORA|EN DESPACHO|EN RUTA|EN REPARTO|EN PROCESAMIENTO|DEVOLUCION|DEVOLUCIÓN|ENTREGADO|EN AGENCIA|LISTO PARA RETIRO|READY_FOR_PICKUP|DELIVERED|DEVUELTO|RETURNED|NO_RETIRADO|PENDIENTE|NOVEDAD|INGRESANDO EN AGENCIA .*|EN RUTA A CONCESI[ÓO]N .*)$/i;

const normalizeLine = (line) => String(line || '')
    .replace(/\t+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizePhone = (value) => String(value || '').replace(/\D/g, '');
const clean = (value) => String(value || '').trim();
const idString = (value) => clean(value?._id || value);

export const HISTORICAL_EXTERNAL_RECONCILIATION_SOURCE = 'HISTORICAL_EXTERNAL_RECONCILIATION';

const canonicalEcuadorPhone = (value) => {
    const digits = normalizePhone(value);
    const normalized = digits.startsWith('593')
        ? digits
        : digits.startsWith('09') && digits.length === 10
            ? `593${digits.slice(1)}`
            : digits.startsWith('9') && digits.length === 9
                ? `593${digits}`
                : '';
    return /^5939\d{8}$/.test(normalized) ? `+${normalized}` : '';
};

const validExternalId = (value) => /^\d{6,}$/.test(normalizePhone(value))
    ? normalizePhone(value)
    : '';

const validGuide = (value, phone) => {
    const guide = normalizePhone(value);
    const phoneDigits = normalizePhone(phone);
    if (!/^\d{8,15}$/.test(guide)) return '';
    if (phoneDigits && (guide.endsWith(phoneDigits.slice(-9)) || phoneDigits.endsWith(guide))) return '';
    return guide;
};

const historicalSuppressedNotifications = (status = '') => {
    const normalized = normalizeDroppiEcuadorStatus(status);
    if (normalized === 'GUIA_GENERADA') return ['guide'];
    if ([
        'EN_PROCESAMIENTO',
        'MERCANCIA_RECOGIDA',
        'EN_BODEGA_TRANSPORTADORA',
        'EN_DESPACHO',
        'EN_RUTA',
        'EN_REPARTO',
        'EN_DISTRIBUCION_A_CLIENTE',
        'READY_FOR_PICKUP'
    ].includes(normalized)) return ['guide', 'in_transit'];
    if (normalized === 'ENTREGADO') return ['guide', 'in_transit', 'ready_for_pickup'];
    return [];
};

export const validateHistoricalExternalDroppiBinding = ({ row = {}, state = null, lead = null, carrier = {} } = {}) => {
    const phone = canonicalEcuadorPhone(row.phone);
    const statePhone = canonicalEcuadorPhone(state?.phoneDigits || state?.metadata?.customerDraft?.phone);
    const leadPhone = canonicalEcuadorPhone(lead?.phone || lead?.phone_e164);
    const customerId = idString(state?._id);
    const leadId = clean(lead?.id);
    const dropiOrderId = validExternalId(row.dropiOrderId);
    const guide = validGuide(row.trackingNumber, phone);
    const carrierGuide = validGuide(carrier?.trackingNumber, phone);
    const status = normalizeDroppiEcuadorStatus(carrier?.normalizedStatus || carrier?.statusAtual);

    if (!phone || !statePhone || !leadPhone) return { ok: false, reason: 'missing_canonical_phone' };
    if (phone !== statePhone || phone !== leadPhone) return { ok: false, reason: 'phone_identity_conflict' };
    if (!customerId || !leadId) return { ok: false, reason: 'missing_customer_or_lead_identity' };
    if (!dropiOrderId) return { ok: false, reason: 'missing_real_dropi_order_id' };
    if (!guide || !carrierGuide || guide !== carrierGuide) return { ok: false, reason: 'guide_identity_conflict' };
    if (!carrier?.ok || !status) return { ok: false, reason: carrier?.reason || 'servientrega_query_failed' };

    return {
        ok: true,
        phone,
        customerId,
        leadId,
        dropiOrderId,
        guide,
        status,
        orderId: dropiOrderId,
        source: HISTORICAL_EXTERNAL_RECONCILIATION_SOURCE
    };
};

const executeIdentityFindOne = async (query) => {
    if (!query) return null;
    const sorted = typeof query.sort === 'function' ? query.sort({ updatedAt: -1, createdAt: -1 }) : query;
    return await sorted;
};

const phoneMatchesCanonical = (value, expected) => canonicalEcuadorPhone(value) === expected;

export const restoreHistoricalExternalDroppiBinding = async ({
    row = {},
    state = null,
    lead = null,
    carrier = {},
    dryRun = true,
    shipmentModel = Shipment,
    orderModel = Order,
    upsertShipment = upsertDroppiEcuadorShipment,
    now = () => new Date()
} = {}) => {
    const identity = validateHistoricalExternalDroppiBinding({ row, state, lead, carrier });
    if (!identity.ok) return { ok: false, reason: identity.reason, writes: 0, messagesSent: 0 };

    const idValues = [identity.dropiOrderId, Number(identity.dropiOrderId)];
    const existingShipment = await executeIdentityFindOne(shipmentModel.findOne({
        $or: [
            { orderId: identity.orderId },
            { 'logistics.trackingNumber': identity.guide },
            { 'raw.manualDropiOrderId': { $in: idValues } },
            { 'raw.latestDroppiPayload.dropiOrderId': { $in: idValues } },
            { 'raw.droppiOrder.id': { $in: idValues } }
        ]
    }));
    if (existingShipment) {
        const existingPhone = existingShipment?.client?.phone;
        const existingGuide = validGuide(existingShipment?.logistics?.trackingNumber, identity.phone);
        const existingDropi = validExternalId(
            existingShipment?.raw?.manualDropiOrderId
            || existingShipment?.raw?.latestDroppiPayload?.dropiOrderId
            || existingShipment?.raw?.droppiOrder?.id
        );
        if (!phoneMatchesCanonical(existingPhone, identity.phone)
            || (existingGuide && existingGuide !== identity.guide)
            || (existingDropi && existingDropi !== identity.dropiOrderId)) {
            return { ok: false, reason: 'existing_shipment_identity_conflict', writes: 0, messagesSent: 0 };
        }
        const evidence = existingShipment?.raw?.historicalExternalReconciliation || {};
        const evidenceAlreadyExact = evidence.source === HISTORICAL_EXTERNAL_RECONCILIATION_SOURCE
            && phoneMatchesCanonical(evidence.phone, identity.phone)
            && idString(evidence.customerId) === identity.customerId
            && clean(evidence.leadId) === identity.leadId
            && validExternalId(evidence.dropiOrderId) === identity.dropiOrderId
            && validGuide(evidence.trackingNumber, identity.phone) === identity.guide
            && evidence.sourceDropi === true
            && evidence.sourceServientrega === true;
        if (evidenceAlreadyExact) {
            return {
                ok: true,
                alreadyBound: true,
                restored: false,
                writes: 0,
                messagesSent: 0,
                identity,
                shipment: existingShipment
            };
        }
    }

    const existingOrder = await executeIdentityFindOne(orderModel.findOne({
        country: 'EC',
        $or: [
            { orderId: identity.orderId },
            { dropiOrderId: { $in: idValues } },
            { trackingNumber: identity.guide }
        ]
    }));
    if (existingOrder && !phoneMatchesCanonical(existingOrder?.customer?.phone, identity.phone)) {
        return { ok: false, reason: 'existing_order_identity_conflict', writes: 0, messagesSent: 0 };
    }

    const canonicalOrderId = clean(existingOrder?.orderId) || identity.orderId;
    const canonicalProductName = clean(
        existingOrder?.tracking?.productName
        || existingOrder?.tracking?.product
        || existingOrder?.package?.label
    );
    const canonicalProductKey = clean(existingOrder?.tracking?.productKey);
    const restoredAt = now();
    const suppressions = historicalSuppressedNotifications(identity.status);
    const expected = {
        orderId: canonicalOrderId,
        phone: identity.phone,
        customerId: identity.customerId,
        leadId: identity.leadId,
        dropiOrderId: identity.dropiOrderId,
        guide: identity.guide,
        carrier: 'SERVIENTREGA',
        status: identity.status,
        source: HISTORICAL_EXTERNAL_RECONCILIATION_SOURCE,
        productName: canonicalProductName,
        productKey: canonicalProductKey,
        quantity: existingOrder?.package?.quantity ?? null,
        total: existingOrder?.total ?? null,
        messagesSent: 0
    };
    if (dryRun) return { ok: true, dryRun: true, restored: false, writes: 0, messagesSent: 0, identity, expected };

    const shipment = await upsertShipment({
        orderId: canonicalOrderId,
        phone: identity.phone,
        status: identity.status,
        trackingNumber: identity.guide,
        dropiOrderId: identity.dropiOrderId,
        manualDropiOrderId: identity.dropiOrderId,
        distributionCompany: 'SERVIENTREGA',
        preferredCarrier: 'SERVIENTREGA',
        historicalIdentityOnly: true,
        ...(canonicalProductName ? { productName: canonicalProductName } : {}),
        ...(canonicalProductKey ? { productKey: canonicalProductKey } : {}),
        reconciliationSource: HISTORICAL_EXTERNAL_RECONCILIATION_SOURCE,
        customerId: identity.customerId,
        leadId: identity.leadId,
        sourceDropi: true,
        sourceServientrega: true,
        restoredAt,
        observedAt: restoredAt,
        reviewStatus: identity.status === 'GUIA_GENERADA'
            ? 'historical_sent_notice_review_required'
            : '',
        suppressedNotificationKinds: suppressions
    });

    return {
        ok: true,
        dryRun: false,
        restored: true,
        writes: 1,
        messagesSent: 0,
        identity,
        expected,
        shipment
    };
};

const phoneTailCandidates = (value) => {
    const digits = normalizePhone(value);
    return [...new Set([
        digits,
        digits.length >= 9 ? digits.slice(-9) : '',
        digits.length >= 10 ? digits.slice(-10) : ''
    ].filter((item) => item && item.length >= 8))];
};

const resolveExistingOrderIdForRetroactiveImport = async (record) => {
    const rawOrderId = String(record?.orderId || '').trim();
    if (/^EC-/i.test(rawOrderId)) return rawOrderId;

    if (rawOrderId) {
        const byDropiId = await Shipment.findOne({
            $or: [
                { 'raw.droppiOrder.id': rawOrderId },
                { 'raw.latestDroppiPayload.dropiOrderId': rawOrderId },
                { 'raw.manualDropiOrderId': rawOrderId }
            ]
        }).sort({ updatedAt: -1 }).lean().catch(() => null);
        if (byDropiId?.orderId) return byDropiId.orderId;

        const orderByDropiId = await Order.findOne({ dropiOrderId: rawOrderId })
            .sort({ updatedAt: -1 })
            .lean()
            .catch(() => null);
        if (orderByDropiId?.orderId) return orderByDropiId.orderId;
    }

    const phoneTails = phoneTailCandidates(record?.phone);
    if (!phoneTails.length) return rawOrderId;
    const phoneRegexes = phoneTails.map((tail) => new RegExp(`${tail}$`));

    const shipmentByPhone = await Shipment.findOne({
        provider: 'droppi',
        country: 'EC',
        'client.phone': { $in: phoneRegexes }
    }).sort({
        'automation.submittedToDroppiAt': -1,
        updatedAt: -1,
        createdAt: -1
    }).lean().catch(() => null);
    if (shipmentByPhone?.orderId) return shipmentByPhone.orderId;

    const orderByPhone = await Order.findOne({
        country: 'EC',
        'customer.phone': { $in: phoneRegexes }
    }).sort({ updatedAt: -1, createdAt: -1 }).lean().catch(() => null);
    return orderByPhone?.orderId || rawOrderId;
};

const buildReferenceFromAddress = (addressLine) => {
    const match = String(addressLine || '').match(/referencia:\s*(.+)$/i);
    return match?.[1]?.trim() || '';
};

const parseAddressParts = (addressLine) => {
    const cleaned = String(addressLine || '').trim();
    const telCut = cleaned.split(/tel:/i)[0].trim();
    const parts = telCut.split(/\s*,\s*/);
    const address = parts[0] || '';
    const cityProvince = parts[1] || '';
    const cityProvinceParts = cityProvince.split('-');

    return {
        address,
        city: (cityProvinceParts[0] || '').trim(),
        province: cityProvinceParts.slice(1).join('-').trim(),
        reference: buildReferenceFromAddress(address)
    };
};

const parseRecord = (lines) => {
    if (!lines.length || !ORDER_ID_RE.test(lines[0])) return null;

    const orderId = lines[0];
    const productName = lines[1] || 'Vit Power';
    let cursor = 2;

    if (cursor < lines.length && /\d{1,2}\/\d{1,2}\/\d{4}/.test(lines[cursor])) {
        cursor += 1;
    }

    const clientName = lines[cursor] || '';
    const addressLine = lines[cursor + 1] || '';
    const phoneLine = lines[cursor + 2] || '';
    const status = lines[cursor + 3] || '';
    const trackingNumber = lines[cursor + 4] || '';
    const distributionCompany = lines[cursor + 5] || '';
    const warehouse = lines[cursor + 6] || '';
    const shippingType = lines[cursor + 7] || '';
    const detail = lines[cursor + 8] || '';

    if (!clientName || !STATUS_RE.test(status)) return null;

    const addressParts = parseAddressParts(addressLine);
    const phone = normalizePhone(phoneLine);
    const agencyPickup = /retirar en|oficina|agencia|servientrega/i.test(addressLine);

    return {
        orderId,
        productName,
        clientName,
        phone,
        address: addressParts.address,
        city: addressParts.city,
        province: addressParts.province,
        reference: addressParts.reference,
        status: normalizeDroppiEcuadorStatus(status),
        trackingNumber,
        distributionCompany,
        warehouse,
        shippingType,
        detail,
        agencyPickup,
        agencyName: agencyPickup ? addressParts.address : '',
        invoiceUrl: ''
    };
};

const parseStructuredBlocks = (text) => {
    const chunks = String(text || '')
        .split(/📦\s*Pedido(?:\s*\d+|\s*[—-][^\n]*)?/i)
        .map((item) => item.trim())
        .filter(Boolean);

    const records = [];

    for (const chunk of chunks) {
        const lines = chunk
            .split('\n')
            .map(normalizeLine)
            .filter(Boolean);

        const data = {};
        for (const line of lines) {
            const match = line.match(/^([^:]+):\s*(.+)$/);
            if (!match) continue;
            const key = match[1].trim().toLowerCase();
            const value = match[2].trim();
            data[key] = value;
        }

        const orderId = String(data.id || '').replace(/\D/g, '');
        const clientName = data.cliente || '';
        const phone = normalizePhone(data.telefone || data.telefono || '');
        const cityProvince = String(data.cidade || data.ciudad || '').split(/\s*-\s*/);
        const status = normalizeDroppiEcuadorStatus(data.status || data['estado de la orden'] || '');
        const distributionCompany = data.transportadora || 'Servientrega';

        if (!orderId || !clientName || !phone || !status) continue;

        records.push({
            orderId,
            productName: data.produto || data.producto || 'VIT POWER',
            clientName,
            phone,
            address: data.endereço || data.endereco || data.dirección || data.direccion || '',
            city: (cityProvince[0] || '').trim(),
            province: cityProvince.slice(1).join(' - ').trim(),
            reference: '',
            status,
            trackingNumber: String(data.guia || data['número de guia'] || data['numero de guia'] || '').replace(/\D/g, ''),
            distributionCompany,
            warehouse: data.bodega || '',
            shippingType: data['tipo de envío'] || data['tipo de envio'] || 'CONTRA ENTREGA',
            detail: data.detalhe || data.detalle || '',
            agencyPickup: /retirar en|oficina|agencia|servientrega/i.test(data.endereço || data.endereco || ''),
            agencyName: /retirar en|oficina|agencia|servientrega/i.test(data.endereço || data.endereco || '')
                ? (data.endereço || data.endereco || '')
                : '',
            invoiceUrl: data.factura || data['url factura'] || ''
        });
    }

    return records;
};

export const parseDroppiEcuadorImportText = (text) => {
    const structuredRecords = parseStructuredBlocks(text);
    if (structuredRecords.length) return structuredRecords;

    const normalizedLines = String(text || '')
        .split('\n')
        .map(normalizeLine)
        .filter(Boolean);

    const records = [];
    let buffer = [];

    for (const line of normalizedLines) {
        const previousLine = buffer[buffer.length - 1] || '';
        const shouldStartNewRecord = ORDER_ID_RE.test(line) && (!buffer.length || !STATUS_RE.test(previousLine));

        if (shouldStartNewRecord) {
            if (buffer.length) {
                const parsed = parseRecord(buffer);
                if (parsed) records.push(parsed);
            }
            buffer = [line];
            continue;
        }

        if (!buffer.length) continue;

        buffer.push(line);

        if (
            buffer.length >= 7
            && STATUS_RE.test(buffer[buffer.length - 4] || '')
        ) {
            const parsed = parseRecord(buffer);
            if (parsed) {
                records.push(parsed);
                buffer = [];
            }
        }
    }

    if (buffer.length) {
        const parsed = parseRecord(buffer);
        if (parsed) records.push(parsed);
    }

    return records;
};

export const importDroppiEcuadorText = async ({ text, sessionId = '', autoNotify = true }) => {
    const records = parseDroppiEcuadorImportText(text);
    const shipments = [];
    let notified = 0;

    for (const record of records) {
        const resolvedOrderId = await resolveExistingOrderIdForRetroactiveImport(record);
        const shipment = await upsertDroppiEcuadorShipment({
            ...record,
            orderId: resolvedOrderId,
            dropiOrderId: record.orderId,
            manualDropiOrderId: record.orderId,
            sessionId
        });

        shipments.push(shipment);

        if (autoNotify && shipment.logistics.status === 'GUIA_GENERADA') {
            const notifyResult = await notifyShipmentGuideGenerated(shipment);
            if (notifyResult?.success) notified += 1;
        } else if (autoNotify && shipment.logistics.status === 'READY_FOR_PICKUP') {
            const notifiedPickup = await notifyReadyForPickup(shipment);
            if (notifiedPickup) notified += 1;
        }
    }

    return {
        imported: shipments.length,
        notified,
        shipments
    };
};
