import ContactState from '../models/ContactState.js';
import Message from '../models/Message.js';
import Order from '../models/Order.js';
import Shipment from '../models/Shipment.js';
import VslVisit from '../models/VslVisit.js';
import {
    loadServientregaEcuadorAgencies,
    normalizeAgencyText,
    resolveServientregaEcuadorAgency
} from './servientregaEcuadorAgencyService.js';

export const CUSTOMER_CONTEXT_SCHEMA_VERSION = 'v16.customer-current-context.readonly.1';

export const CUSTOMER_CONTEXT_CONFIDENCE = Object.freeze({
    CONFIRMED: 'CONFIRMADO',
    HIGH: 'ALTA_CONFIANCA',
    PROBABLE: 'PROVAVEL',
    AMBIGUOUS: 'AMBIGUO',
    CONFLICT: 'CONFLITO',
    UNKNOWN: 'DESCONHECIDO'
});

const PRIORITY = Object.freeze({
    MANUAL_FIELD: 1,
    CUSTOMER_CONFIRMATION: 2,
    CURRENT_CONFIRMED_ORDER: 3,
    STRUCTURED_PERSISTED: 4,
    DETERMINISTIC_EXTRACTION: 5,
    ASSISTIVE_INFERENCE: 6,
    OLD_HISTORY: 7
});

const PRODUCT_CATALOG = Object.freeze({
    tex_ultra_ec: 'Tex Ultra Ecuador',
    vit_power_ec: 'Vit Power Ecuador',
    nitrix_ec: 'Nitrix Oxide Ecuador'
});

const TERMINAL_ORDER_STATUSES = new Set(['delivered', 'cancelled', 'returned']);
const FIELD_PROVENANCE_CONTAINERS = [
    'customerFieldProvenance',
    'customerDraftProvenance',
    'fieldProvenance'
];

const CONTACT_PROJECTION = [
    'chatId',
    'phoneDigits',
    'countryCode',
    'human',
    'firstInboundAt',
    'lastInboundAt',
    'lastOutboundAt',
    'metadata.customerDraft',
    'metadata.customerFieldProvenance',
    'metadata.customerDraftProvenance',
    'metadata.fieldProvenance',
    'metadata.productKey',
    'metadata.productName',
    'metadata.vslProductKey',
    'metadata.vslProductName',
    'metadata.vslPath',
    'metadata.vslSourceUrl',
    'metadata.vslTestId',
    'metadata.vslVariant',
    'metadata.lastKnownFunnelStage',
    'metadata.activeOrderId',
    'metadata.currentOrderId',
    'metadata.customerPhoneDigits',
    'metadata.perAgentMemory'
].join(' ');

const MESSAGE_PROJECTION = [
    '_id',
    'chatId',
    'peerPhone',
    'from',
    'to',
    'body',
    'timestamp',
    'notifyName',
    'orderId',
    'isFromMe',
    'isBot',
    'createdAt',
    'updatedAt'
].join(' ');

const ORDER_PROJECTION = [
    '_id',
    'orderId',
    'country',
    'customer',
    'package',
    'total',
    'currency',
    'status',
    'entryAt',
    'entryReason',
    'previousOrderId',
    'previousDeliveredAt',
    'confirmedAt',
    'source',
    'trackingNumber',
    'shippingStatus',
    'tracking.productKey',
    'tracking.productName',
    'tracking.sourceUrl',
    'tracking.attributionSource',
    'tracking.attributionVisitorKey',
    'tracking.attributionMatchedAt',
    'tracking.attributionConfidence',
    'conversationMemory',
    'draftCreatedAt',
    'lastInteractionAt',
    'createdAt',
    'updatedAt'
].join(' ');

const SHIPMENT_PROJECTION = [
    '_id',
    'orderId',
    'country',
    'provider',
    'productName',
    'client.name',
    'client.phone',
    'client.address',
    'client.city',
    'client.province',
    'client.reference',
    'logistics.status',
    'logistics.trackingNumber',
    'logistics.distributionCompany',
    'logistics.shippingType',
    'logistics.preferredCarrier',
    'logistics.chosenCarrier',
    'logistics.agencyPickup',
    'logistics.agencyName',
    'logistics.lastStatusAt',
    'outcomes.delivered',
    'outcomes.pickedUp',
    'outcomes.returned',
    'outcomes.prepaidOnly',
    'createdAt',
    'updatedAt'
].join(' ');

const VSL_VISIT_PROJECTION = [
    '_id',
    'visitorKey',
    'visitorId',
    'country',
    'page',
    'path',
    'sourceUrl',
    'customerName',
    'customerPhone',
    'productKey',
    'productName',
    'productSource',
    'vslTestId',
    'vslVariant',
    'attributionClaimedAt',
    'attributionClaimSource',
    'attributionClaimInboundAt',
    'firstSeenAt',
    'lastSeenAt',
    'createdAt',
    'updatedAt'
].join(' ');

export class CustomerContextInputError extends Error {
    constructor(code, message) {
        super(message);
        this.name = 'CustomerContextInputError';
        this.code = code;
        this.statusCode = 400;
    }
}

const digitsOnly = (value) => String(value || '').replace(/\D/g, '');

export const normalizeEcuadorPhone = (value) => {
    const digits = digitsOnly(value);
    if (/^593\d{8,9}$/.test(digits)) return digits;
    if (/^0\d{8,9}$/.test(digits)) return `593${digits.slice(1)}`;
    if (/^9\d{8}$/.test(digits)) return `593${digits}`;
    return '';
};

const safeDate = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const numeric = typeof value === 'number' && value < 1e12 ? value * 1000 : value;
    const date = new Date(numeric);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const safeId = (value) => value === undefined || value === null ? '' : String(value);

const normalizeText = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const normalizedComparable = (value) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (typeof value === 'object') {
        if (value.key) return String(value.key);
        if (value.orderId) return String(value.orderId);
        return JSON.stringify(value);
    }
    return normalizeText(value);
};

const meaningful = (value) => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (typeof value === 'number') return Number.isFinite(value) && value > 0;
    return true;
};

const readOnlySource = ({ kind, collection = null, entityId = null, path = null, evidenceId = null }) => ({
    kind,
    collection,
    entityId: entityId ? safeId(entityId) : null,
    path,
    evidenceId: evidenceId ? safeId(evidenceId) : null
});

const publicCandidate = (candidate) => ({
    value: candidate.value,
    source: candidate.source,
    confidence: candidate.confidence,
    updatedAt: candidate.updatedAt,
    inferred: Boolean(candidate.inferred),
    applicationAllowed: false
});

const candidate = ({ value, priority, source, confidence, updatedAt, inferred = false }) => {
    if (!meaningful(value)) return null;
    return {
        value,
        priority,
        source,
        confidence,
        updatedAt: safeDate(updatedAt),
        inferred: Boolean(inferred)
    };
};

const unknownField = (field) => ({
    field,
    value: null,
    source: readOnlySource({ kind: 'none' }),
    confidence: CUSTOMER_CONTEXT_CONFIDENCE.UNKNOWN,
    updatedAt: null,
    inferred: false,
    conflicted: false,
    candidates: [],
    applicationAllowed: false
});

export const resolveAssistiveField = (field, sourceCandidates = [], { ambiguousAtSamePriority = true } = {}) => {
    const candidates = sourceCandidates
        .filter(Boolean)
        .slice()
        .sort((left, right) => left.priority - right.priority
            || String(right.updatedAt || '').localeCompare(String(left.updatedAt || '')));
    if (!candidates.length) return unknownField(field);

    const unique = [];
    const seen = new Set();
    for (const item of candidates) {
        const normalized = normalizedComparable(item.value);
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        unique.push(item);
    }
    if (!unique.length) return unknownField(field);

    const bestPriority = unique[0].priority;
    const best = unique.filter((item) => item.priority === bestPriority);
    if (ambiguousAtSamePriority && best.length > 1) {
        return {
            field,
            value: null,
            source: readOnlySource({ kind: 'multiple_candidates' }),
            confidence: CUSTOMER_CONTEXT_CONFIDENCE.AMBIGUOUS,
            updatedAt: null,
            inferred: false,
            conflicted: true,
            candidates: unique.map(publicCandidate),
            applicationAllowed: false
        };
    }

    const selected = best[0];
    const hasDivergence = unique.some((item) => normalizedComparable(item.value) !== normalizedComparable(selected.value));
    return {
        field,
        value: selected.value,
        source: selected.source,
        confidence: hasDivergence ? CUSTOMER_CONTEXT_CONFIDENCE.CONFLICT : selected.confidence,
        updatedAt: selected.updatedAt,
        inferred: selected.inferred,
        conflicted: hasDivergence,
        candidates: unique.map(publicCandidate),
        applicationAllowed: false
    };
};

const productFrom = (value, explicitName = '') => {
    const normalized = normalizeText(`${value || ''} ${explicitName || ''}`);
    const directKey = String(value || '').trim().toLowerCase();
    if (PRODUCT_CATALOG[directKey]) return { key: directKey, name: PRODUCT_CATALOG[directKey] };
    const matches = [];
    if (/\btex\s*ultra\b/.test(normalized)) matches.push('tex_ultra_ec');
    if (/\bvit\s*power\b|\bvit\s*powers\b/.test(normalized)) matches.push('vit_power_ec');
    if (/\bnitrix(?:\s*oxide)?\b/.test(normalized)) matches.push('nitrix_ec');
    const unique = [...new Set(matches)];
    return unique.length === 1 ? { key: unique[0], name: PRODUCT_CATALOG[unique[0]] } : null;
};

const orderProduct = (order = {}) => productFrom(
    order.tracking?.productKey,
    order.tracking?.productName || order.package?.label
);

const manualFieldProof = (contactState = {}, field) => {
    const metadata = contactState.metadata || {};
    const draft = metadata.customerDraft || {};
    const containers = FIELD_PROVENANCE_CONTAINERS
        .map((key) => metadata[key])
        .concat([draft.fieldProvenance, draft.provenance]);
    for (const container of containers) {
        const proof = container?.[field];
        if (!proof || typeof proof !== 'object') continue;
        const kind = normalizeText(proof.kind || proof.source || proof.origin);
        const evidenced = Boolean(proof.at || proof.updatedAt || proof.confirmedAt || proof.by || proof.evidenceId);
        if (kind.includes('manual') && evidenced) return proof;
    }
    return null;
};

const contactSource = (contactState, path, kind = 'contact_state_customer_draft') => readOnlySource({
    kind,
    collection: 'contactstates',
    entityId: contactState?._id || contactState?.chatId,
    path
});

const addDraftCandidate = (target, field, value, contactState, path) => {
    const proof = manualFieldProof(contactState, field);
    target.push(candidate({
        value,
        priority: proof ? PRIORITY.MANUAL_FIELD : PRIORITY.STRUCTURED_PERSISTED,
        source: contactSource(contactState, path, proof ? 'manual_field_evidence' : 'contact_state_customer_draft'),
        confidence: proof ? CUSTOMER_CONTEXT_CONFIDENCE.CONFIRMED : CUSTOMER_CONTEXT_CONFIDENCE.HIGH,
        updatedAt: proof?.confirmedAt || proof?.updatedAt || proof?.at
            || contactState?.metadata?.customerDraft?.updatedAt
            || contactState?.updatedAt
    }));
};

const labelsFromMessage = (body = '') => {
    const result = {};
    for (const line of String(body || '').split(/\r?\n/)) {
        const match = line.match(/^\s*([^:]{2,32})\s*:\s*(.+?)\s*$/);
        if (!match) continue;
        const key = normalizeText(match[1]);
        const value = match[2].trim();
        if (/^(nombre|cliente|name)$/.test(key)) result.name = value;
        if (/^(ciudad|cidade|city)$/.test(key)) result.city = value;
        if (/^(provincia|province|prov)$/.test(key)) result.province = value;
        if (/^(direccion|direcao|address)$/.test(key)) result.address = value;
        if (/^(referencia|punto de referencia)$/.test(key)) result.reference = value;
        if (/^(agencia|punto de retiro|servientrega)$/.test(key)) result.agency = value;
        if (/^(producto|product)$/.test(key)) result.product = value;
        if (/^(cantidad|quantidade|quantity)$/.test(key)) result.quantity = value;
        if (/^(total|valor|value)$/.test(key)) result.total = value;
    }
    return result;
};

const cleanCapturedName = (value) => String(value || '')
    .replace(/\s+(?:ciudad|provincia|direccion|tel[eé]fono|telefono|cantidad|total)\b[\s\S]*$/i, '')
    .trim();

const messageEvidence = (message) => readOnlySource({
    kind: 'customer_message',
    collection: 'messages',
    entityId: message?._id,
    path: 'body',
    evidenceId: message?._id
});

const collectMessageEvidence = (messages = []) => {
    const fields = {
        name: [],
        detectedName: [],
        city: [],
        province: [],
        address: [],
        reference: [],
        agency: [],
        deliveryMode: [],
        product: [],
        quantity: [],
        total: []
    };
    const inbound = messages
        .filter((message) => !message?.isFromMe)
        .slice()
        .sort((left, right) => Number(right.timestamp || 0) - Number(left.timestamp || 0));

    for (const message of inbound) {
        const body = String(message.body || '').trim();
        const observedAt = message.timestamp || message.createdAt || message.updatedAt;
        const source = messageEvidence(message);
        const labels = labelsFromMessage(body);
        const correctedName = cleanCapturedName(body.match(/\b(?:mi nombre correcto es|corrijo mi nombre(?:\s+es)?|mi nombre es)\s+([^,.\n]+)/i)?.[1]);
        const labeledName = cleanCapturedName(labels.name);
        if (correctedName) {
            fields.name.push(candidate({ value: correctedName, priority: PRIORITY.CUSTOMER_CONFIRMATION, source, confidence: CUSTOMER_CONTEXT_CONFIDENCE.CONFIRMED, updatedAt: observedAt }));
            fields.detectedName.push(candidate({ value: correctedName, priority: PRIORITY.CUSTOMER_CONFIRMATION, source, confidence: CUSTOMER_CONTEXT_CONFIDENCE.CONFIRMED, updatedAt: observedAt }));
        } else if (labeledName) {
            fields.name.push(candidate({ value: labeledName, priority: PRIORITY.CUSTOMER_CONFIRMATION, source, confidence: CUSTOMER_CONTEXT_CONFIDENCE.HIGH, updatedAt: observedAt }));
            fields.detectedName.push(candidate({ value: labeledName, priority: PRIORITY.CUSTOMER_CONFIRMATION, source, confidence: CUSTOMER_CONTEXT_CONFIDENCE.HIGH, updatedAt: observedAt }));
        }

        for (const field of ['city', 'province', 'address', 'reference', 'agency']) {
            if (!labels[field]) continue;
            fields[field].push(candidate({
                value: labels[field],
                priority: PRIORITY.CUSTOMER_CONFIRMATION,
                source,
                confidence: CUSTOMER_CONTEXT_CONFIDENCE.HIGH,
                updatedAt: observedAt
            }));
        }

        const explicitProduct = productFrom(labels.product || (/\b(?:quiero|deseo|confirmo)\b[\s\S]*/i.test(body) ? body : ''));
        const mentionedProduct = explicitProduct || productFrom(body);
        if (mentionedProduct) {
            fields.product.push(candidate({
                value: mentionedProduct,
                priority: explicitProduct ? PRIORITY.CUSTOMER_CONFIRMATION : PRIORITY.DETERMINISTIC_EXTRACTION,
                source,
                confidence: explicitProduct ? CUSTOMER_CONTEXT_CONFIDENCE.HIGH : CUSTOMER_CONTEXT_CONFIDENCE.PROBABLE,
                updatedAt: observedAt
            }));
        }

        const quantityText = labels.quantity || body.match(/\b(1|2|3|6)\s*frascos?\b/i)?.[1];
        const quantity = Number.parseInt(String(quantityText || '').match(/\d+/)?.[0] || '', 10);
        if (Number.isFinite(quantity) && quantity > 0) {
            fields.quantity.push(candidate({
                value: quantity,
                priority: labels.quantity ? PRIORITY.CUSTOMER_CONFIRMATION : PRIORITY.DETERMINISTIC_EXTRACTION,
                source,
                confidence: labels.quantity ? CUSTOMER_CONTEXT_CONFIDENCE.HIGH : CUSTOMER_CONTEXT_CONFIDENCE.PROBABLE,
                updatedAt: observedAt
            }));
        }

        const totalText = labels.total || body.match(/(?:usd|\$)\s*(\d+(?:[.,]\d{1,2})?)/i)?.[1];
        const total = Number.parseFloat(String(totalText || '').replace(',', '.').replace(/[^\d.]/g, ''));
        if (Number.isFinite(total) && total > 0) {
            fields.total.push(candidate({
                value: total,
                priority: labels.total ? PRIORITY.CUSTOMER_CONFIRMATION : PRIORITY.DETERMINISTIC_EXTRACTION,
                source,
                confidence: labels.total ? CUSTOMER_CONTEXT_CONFIDENCE.HIGH : CUSTOMER_CONTEXT_CONFIDENCE.PROBABLE,
                updatedAt: observedAt
            }));
        }

        const normalizedBody = normalizeText(body);
        if (/\b(?:agencia|servientrega|punto de retiro)\b/.test(normalizedBody)) {
            fields.deliveryMode.push(candidate({ value: 'AGENCIA', priority: PRIORITY.DETERMINISTIC_EXTRACTION, source, confidence: CUSTOMER_CONTEXT_CONFIDENCE.PROBABLE, updatedAt: observedAt }));
        }
        if (/\b(?:domicilio|mi casa|direccion domiciliaria)\b/.test(normalizedBody)) {
            fields.deliveryMode.push(candidate({ value: 'DOMICILIO', priority: PRIORITY.DETERMINISTIC_EXTRACTION, source, confidence: CUSTOMER_CONTEXT_CONFIDENCE.PROBABLE, updatedAt: observedAt }));
        }

        if (message.notifyName) {
            const profileSource = readOnlySource({
                kind: 'whatsapp_profile_name',
                collection: 'messages',
                entityId: message._id,
                path: 'notifyName',
                evidenceId: message._id
            });
            fields.name.push(candidate({ value: message.notifyName, priority: PRIORITY.ASSISTIVE_INFERENCE, source: profileSource, confidence: CUSTOMER_CONTEXT_CONFIDENCE.PROBABLE, updatedAt: observedAt, inferred: true }));
            fields.detectedName.push(candidate({ value: message.notifyName, priority: PRIORITY.ASSISTIVE_INFERENCE, source: profileSource, confidence: CUSTOMER_CONTEXT_CONFIDENCE.PROBABLE, updatedAt: observedAt, inferred: true }));
        }
    }
    return fields;
};

const explicitOrderIds = (contactStates = []) => {
    const ids = new Set();
    for (const state of contactStates) {
        const metadata = state.metadata || {};
        const draft = metadata.customerDraft || {};
        [metadata.activeOrderId, metadata.currentOrderId, draft.orderId].filter(Boolean).forEach((id) => ids.add(String(id)));
        for (const memory of Object.values(metadata.perAgentMemory || {})) {
            const pending = memory?.pendingCheckoutOrder;
            [pending?.orderId, pending?.id].filter(Boolean).forEach((id) => ids.add(String(id)));
        }
    }
    return ids;
};

const orderTimestamp = (order) => safeDate(order?.confirmedAt || order?.lastInteractionAt || order?.updatedAt || order?.entryAt || order?.createdAt);

const safeShipment = (shipment) => shipment ? {
    status: shipment.logistics?.status || null,
    trackingNumber: shipment.logistics?.trackingNumber || null,
    carrier: shipment.logistics?.chosenCarrier || shipment.logistics?.preferredCarrier || shipment.logistics?.distributionCompany || null,
    agencyPickup: Boolean(shipment.logistics?.agencyPickup),
    agencyName: shipment.logistics?.agencyName || null,
    lastStatusAt: safeDate(shipment.logistics?.lastStatusAt || shipment.updatedAt),
    delivered: Boolean(shipment.outcomes?.delivered),
    pickedUp: Boolean(shipment.outcomes?.pickedUp),
    returned: Boolean(shipment.outcomes?.returned),
    prepaidOnly: Boolean(shipment.outcomes?.prepaidOnly),
    source: readOnlySource({ kind: 'shipment_local_snapshot', collection: 'shipments', entityId: shipment._id || shipment.orderId }),
    confidence: CUSTOMER_CONTEXT_CONFIDENCE.HIGH,
    applicationAllowed: false
} : null;

const safeOrder = (order, shipment = null, { historical = false } = {}) => ({
    orderId: order?.orderId || safeId(order?._id) || null,
    status: order?.status || null,
    product: orderProduct(order),
    quantity: Number(order?.package?.quantity || 0) || null,
    total: Number(order?.total || 0) || null,
    currency: order?.currency || null,
    customer: {
        name: order?.customer?.name || null,
        phone: normalizeEcuadorPhone(order?.customer?.phone) || null,
        city: order?.customer?.city || null,
        province: order?.customer?.province || null,
        address: order?.customer?.address || null,
        reference: order?.customer?.reference || null
    },
    entryReason: order?.entryReason || null,
    previousOrderId: order?.previousOrderId || null,
    confirmedAt: safeDate(order?.confirmedAt),
    updatedAt: safeDate(order?.updatedAt || order?.lastInteractionAt || order?.entryAt || order?.createdAt),
    shipment: safeShipment(shipment),
    historical,
    source: readOnlySource({
        kind: historical ? 'historical_order' : 'current_order_snapshot',
        collection: 'orders',
        entityId: order?._id || order?.orderId
    }),
    confidence: historical ? CUSTOMER_CONTEXT_CONFIDENCE.HIGH : (
        order?.status === 'confirmed' || order?.confirmedAt
            ? CUSTOMER_CONTEXT_CONFIDENCE.CONFIRMED
            : CUSTOMER_CONTEXT_CONFIDENCE.HIGH
    ),
    readOnly: true,
    applicationAllowed: false
});

export const selectCurrentOrderReadOnly = ({ orders = [], contactStates = [], shipmentsByOrderId = new Map() } = {}) => {
    const explicitIds = explicitOrderIds(contactStates);
    const active = orders.filter((order) => !TERMINAL_ORDER_STATUSES.has(String(order?.status || '').toLowerCase()));
    const explicit = active.filter((order) => explicitIds.has(String(order.orderId || order._id)));
    const selected = explicit.length === 1 ? explicit[0] : (explicit.length === 0 && active.length === 1 ? active[0] : null);
    const ambiguous = explicit.length > 1 || (!explicit.length && active.length > 1);
    const sourceKind = explicit.length === 1 ? 'explicit_current_order_link' : 'unique_active_order';
    const current = selected ? safeOrder(selected, shipmentsByOrderId.get(String(selected.orderId || selected._id))) : null;
    const currentField = selected ? {
        field: 'currentOrder',
        value: current,
        source: readOnlySource({ kind: sourceKind, collection: 'orders', entityId: selected._id || selected.orderId, path: 'orderId' }),
        confidence: selected.status === 'confirmed' || selected.confirmedAt
            ? CUSTOMER_CONTEXT_CONFIDENCE.CONFIRMED
            : CUSTOMER_CONTEXT_CONFIDENCE.HIGH,
        updatedAt: orderTimestamp(selected),
        inferred: false,
        conflicted: false,
        candidates: [current].map((value) => ({ value, source: readOnlySource({ kind: sourceKind, collection: 'orders', entityId: selected._id || selected.orderId, path: 'orderId' }), confidence: CUSTOMER_CONTEXT_CONFIDENCE.HIGH, updatedAt: orderTimestamp(selected), inferred: false, applicationAllowed: false })),
        applicationAllowed: false
    } : unknownField('currentOrder');

    if (ambiguous) {
        currentField.confidence = CUSTOMER_CONTEXT_CONFIDENCE.AMBIGUOUS;
        currentField.conflicted = true;
        currentField.candidates = (explicit.length ? explicit : active).map((order) => ({
            value: safeOrder(order, shipmentsByOrderId.get(String(order.orderId || order._id))),
            source: readOnlySource({ kind: 'active_order_candidate', collection: 'orders', entityId: order._id || order.orderId, path: 'status' }),
            confidence: CUSTOMER_CONTEXT_CONFIDENCE.AMBIGUOUS,
            updatedAt: orderTimestamp(order),
            inferred: false,
            applicationAllowed: false
        }));
    }

    const history = orders
        .filter((order) => TERMINAL_ORDER_STATUSES.has(String(order?.status || '').toLowerCase()))
        .slice()
        .sort((left, right) => String(orderTimestamp(right) || '').localeCompare(String(orderTimestamp(left) || '')))
        .map((order) => safeOrder(order, shipmentsByOrderId.get(String(order.orderId || order._id)), { historical: true }));

    return { selected, currentField, history, ambiguous };
};

const defaultCatalogResolver = ({ city = '', province = '', agencyName = '', address = '', text = '' } = {}) => {
    const agencies = loadServientregaEcuadorAgencies();
    const normalizedCity = normalizeAgencyText(city);
    const normalizedProvince = normalizeAgencyText(province);
    const exactCityAgencies = normalizedCity
        ? agencies.filter((item) => item.normalizedCity === normalizedCity)
        : [];
    const exactProvinceAgencies = normalizedProvince
        ? agencies.filter((item) => item.normalizedProvince === normalizedProvince)
        : [];
    const cityCandidates = [...new Set(exactCityAgencies.map((item) => item.city).filter(Boolean))];
    const provinceCandidates = normalizedProvince
        ? [...new Set(exactProvinceAgencies.map((item) => item.province).filter(Boolean))]
        : [...new Set(exactCityAgencies.map((item) => item.province).filter(Boolean))];
    const agency = resolveServientregaEcuadorAgency({ city, province, agencyName, address, text, limit: 5 });
    return {
        cityCandidates,
        provinceCandidates,
        agencyCandidates: agency.suggestions || [],
        agencyConfident: Boolean(agency.confident),
        agency: agency.best || null
    };
};

const block = (value) => ({ ...value, applicationAllowed: false });

const conflictFromField = (field, code) => field.conflicted ? {
    code,
    field: field.field,
    confidence: field.confidence,
    candidates: field.candidates,
    reviewRequired: true,
    applicationAllowed: false
} : null;

const emptyContext = ({ generatedAt, phoneField, match, conflicts = [] }) => ({
    schemaVersion: CUSTOMER_CONTEXT_SCHEMA_VERSION,
    generatedAt: safeDate(generatedAt),
    readOnly: true,
    applicationAllowed: false,
    match,
    customer: {
        phone: phoneField,
        identity: block({ name: unknownField('name'), detectedName: unknownField('detectedName') }),
        location: block({
            city: unknownField('city'),
            province: unknownField('province'),
            address: unknownField('address'),
            reference: unknownField('reference'),
            sector: unknownField('sector'),
            agency: unknownField('agency'),
            deliveryMode: unknownField('deliveryMode')
        }),
        currentProduct: block({ product: unknownField('currentProduct'), quantity: unknownField('quantity'), total: unknownField('total') }),
        vslOrigin: block({ path: unknownField('vslPath'), sourceUrl: unknownField('vslSourceUrl'), product: unknownField('vslProduct'), testId: unknownField('vslTestId'), variant: unknownField('vslVariant') }),
        currentOrder: unknownField('currentOrder'),
        history: [],
        funnel: block({ stage: unknownField('funnelStage'), humanMode: unknownField('humanMode'), lastInboundAt: unknownField('lastInboundAt'), lastOutboundAt: unknownField('lastOutboundAt') }),
        conflicts,
        applicationAllowed: false
    }
});

const phoneValuesFrom = ({ contactStates = [], messages = [], orders = [], shipments = [], vslVisits = [] }) => {
    const values = [];
    for (const state of contactStates) values.push(state.phoneDigits, state.chatId, state.metadata?.customerPhoneDigits);
    for (const message of messages) values.push(message.peerPhone, message.chatId, message.isFromMe ? message.to : message.from);
    for (const order of orders) values.push(order.customer?.phone);
    for (const shipment of shipments) values.push(shipment.client?.phone);
    for (const visit of vslVisits) values.push(visit.customerPhone);
    return [...new Set(values.map(normalizeEcuadorPhone).filter(Boolean))];
};

const recordMatchesPhone = (record, values, phone) => values(record).some((value) => normalizeEcuadorPhone(value) === phone);

export const buildCustomerCurrentContextSnapshot = ({
    phone,
    requestedDigits = digitsOnly(phone),
    contactStates = [],
    messages = [],
    orders = [],
    shipments = [],
    vslVisits = [],
    generatedAt = new Date(),
    catalogResolver = defaultCatalogResolver
} = {}) => {
    const canonicalFromRequest = normalizeEcuadorPhone(phone);
    const discoveredPhones = phoneValuesFrom({ contactStates, messages, orders, shipments, vslVisits })
        .filter((candidatePhone) => !requestedDigits || candidatePhone.endsWith(requestedDigits.slice(-8)));
    const candidatePhones = [...new Set(canonicalFromRequest ? [canonicalFromRequest] : discoveredPhones)];
    const ambiguousPhone = !canonicalFromRequest && discoveredPhones.length > 1;
    const canonicalPhone = ambiguousPhone ? '' : (canonicalFromRequest || discoveredPhones[0] || '');

    if (ambiguousPhone) {
        const phoneCandidates = discoveredPhones.map((value) => publicCandidate(candidate({
            value,
            priority: PRIORITY.ASSISTIVE_INFERENCE,
            source: readOnlySource({ kind: 'phone_tail_candidate' }),
            confidence: CUSTOMER_CONTEXT_CONFIDENCE.AMBIGUOUS,
            updatedAt: null,
            inferred: true
        })));
        const phoneField = {
            ...unknownField('phone'),
            confidence: CUSTOMER_CONTEXT_CONFIDENCE.AMBIGUOUS,
            conflicted: true,
            candidates: phoneCandidates
        };
        const phoneConflict = {
            code: 'PHONE_MATCH_AMBIGUOUS',
            field: 'phone',
            confidence: CUSTOMER_CONTEXT_CONFIDENCE.AMBIGUOUS,
            candidates: phoneCandidates,
            reviewRequired: true,
            applicationAllowed: false
        };
        return emptyContext({
            generatedAt,
            phoneField,
            match: { method: 'ambiguous_tail', candidates: candidatePhones, ambiguous: true },
            conflicts: [phoneConflict]
        });
    }

    const phoneField = canonicalPhone ? {
        field: 'phone',
        value: canonicalPhone,
        source: readOnlySource({ kind: canonicalFromRequest ? 'canonical_request' : 'unique_phone_tail_match' }),
        confidence: canonicalFromRequest ? CUSTOMER_CONTEXT_CONFIDENCE.HIGH : CUSTOMER_CONTEXT_CONFIDENCE.PROBABLE,
        updatedAt: null,
        inferred: !canonicalFromRequest,
        conflicted: false,
        candidates: [],
        applicationAllowed: false
    } : unknownField('phone');

    if (!canonicalPhone) {
        return emptyContext({
            generatedAt,
            phoneField,
            match: { method: 'not_found', candidates: [], ambiguous: false }
        });
    }

    const states = contactStates.filter((record) => recordMatchesPhone(record, (item) => [item.phoneDigits, item.chatId, item.metadata?.customerPhoneDigits], canonicalPhone));
    const matchingMessages = messages.filter((record) => recordMatchesPhone(record, (item) => [item.peerPhone, item.chatId, item.isFromMe ? item.to : item.from], canonicalPhone));
    const matchingOrders = orders.filter((record) => recordMatchesPhone(record, (item) => [item.customer?.phone], canonicalPhone));
    const matchingShipments = shipments.filter((record) => recordMatchesPhone(record, (item) => [item.client?.phone], canonicalPhone)
        || matchingOrders.some((order) => String(order.orderId || order._id) === String(record.orderId)));
    const matchingVisits = vslVisits.filter((record) => recordMatchesPhone(record, (item) => [item.customerPhone], canonicalPhone));
    const shipmentsByOrderId = new Map(matchingShipments.map((shipment) => [String(shipment.orderId), shipment]));
    const orderSelection = selectCurrentOrderReadOnly({ orders: matchingOrders, contactStates: states, shipmentsByOrderId });
    const currentOrder = orderSelection.selected;
    const currentShipment = currentOrder ? shipmentsByOrderId.get(String(currentOrder.orderId || currentOrder._id)) : null;
    const messageFields = collectMessageEvidence(matchingMessages);

    const fieldCandidates = {
        name: [...messageFields.name],
        detectedName: [...messageFields.detectedName],
        city: [...messageFields.city],
        province: [...messageFields.province],
        address: [...messageFields.address],
        reference: [...messageFields.reference],
        agency: [...messageFields.agency],
        deliveryMode: [...messageFields.deliveryMode],
        product: [...messageFields.product],
        quantity: [...messageFields.quantity],
        total: [...messageFields.total],
        funnelStage: [],
        humanMode: [],
        lastInboundAt: [],
        lastOutboundAt: []
    };

    for (const state of states) {
        const draft = state.metadata?.customerDraft || {};
        addDraftCandidate(fieldCandidates.name, 'name', draft.name || draft.customerName, state, 'metadata.customerDraft.name');
        addDraftCandidate(fieldCandidates.city, 'city', draft.city, state, 'metadata.customerDraft.city');
        addDraftCandidate(fieldCandidates.province, 'province', draft.province, state, 'metadata.customerDraft.province');
        addDraftCandidate(fieldCandidates.address, 'address', draft.address || draft.direccion, state, 'metadata.customerDraft.address');
        addDraftCandidate(fieldCandidates.reference, 'reference', draft.reference, state, 'metadata.customerDraft.reference');
        addDraftCandidate(fieldCandidates.agency, 'agency', draft.agencyName || draft.agency, state, 'metadata.customerDraft.agencyName');
        addDraftCandidate(fieldCandidates.deliveryMode, 'deliveryMode', draft.deliveryMode, state, 'metadata.customerDraft.deliveryMode');
        addDraftCandidate(fieldCandidates.quantity, 'quantity', Number(draft.quantity || 0), state, 'metadata.customerDraft.quantity');
        addDraftCandidate(fieldCandidates.total, 'total', Number(draft.total || 0), state, 'metadata.customerDraft.total');
        addDraftCandidate(fieldCandidates.product, 'product', productFrom(draft.productKey || state.metadata?.productKey, draft.productName || state.metadata?.productName), state, 'metadata.customerDraft.productKey');
        fieldCandidates.funnelStage.push(candidate({ value: state.metadata?.lastKnownFunnelStage, priority: PRIORITY.STRUCTURED_PERSISTED, source: contactSource(state, 'metadata.lastKnownFunnelStage', 'contact_state_funnel_stage'), confidence: CUSTOMER_CONTEXT_CONFIDENCE.HIGH, updatedAt: state.updatedAt }));
        fieldCandidates.humanMode.push(candidate({ value: state.human?.mode, priority: PRIORITY.STRUCTURED_PERSISTED, source: contactSource(state, 'human.mode', 'contact_state_human_mode'), confidence: CUSTOMER_CONTEXT_CONFIDENCE.HIGH, updatedAt: state.human?.lastManualAt || state.updatedAt }));
        fieldCandidates.lastInboundAt.push(candidate({ value: safeDate(state.lastInboundAt), priority: PRIORITY.STRUCTURED_PERSISTED, source: contactSource(state, 'lastInboundAt', 'contact_state_activity'), confidence: CUSTOMER_CONTEXT_CONFIDENCE.HIGH, updatedAt: state.lastInboundAt }));
        fieldCandidates.lastOutboundAt.push(candidate({ value: safeDate(state.lastOutboundAt), priority: PRIORITY.STRUCTURED_PERSISTED, source: contactSource(state, 'lastOutboundAt', 'contact_state_activity'), confidence: CUSTOMER_CONTEXT_CONFIDENCE.HIGH, updatedAt: state.lastOutboundAt }));
    }

    if (currentOrder) {
        const orderPriority = currentOrder.status === 'confirmed' || currentOrder.confirmedAt
            ? PRIORITY.CURRENT_CONFIRMED_ORDER
            : PRIORITY.STRUCTURED_PERSISTED;
        const orderConfidence = orderPriority === PRIORITY.CURRENT_CONFIRMED_ORDER
            ? CUSTOMER_CONTEXT_CONFIDENCE.CONFIRMED
            : CUSTOMER_CONTEXT_CONFIDENCE.HIGH;
        const orderSource = (path) => readOnlySource({ kind: 'current_order', collection: 'orders', entityId: currentOrder._id || currentOrder.orderId, path });
        const at = orderTimestamp(currentOrder);
        fieldCandidates.name.push(candidate({ value: currentOrder.customer?.name, priority: orderPriority, source: orderSource('customer.name'), confidence: orderConfidence, updatedAt: at }));
        fieldCandidates.city.push(candidate({ value: currentOrder.customer?.city, priority: orderPriority, source: orderSource('customer.city'), confidence: orderConfidence, updatedAt: at }));
        fieldCandidates.province.push(candidate({ value: currentOrder.customer?.province, priority: orderPriority, source: orderSource('customer.province'), confidence: orderConfidence, updatedAt: at }));
        fieldCandidates.address.push(candidate({ value: currentOrder.customer?.address, priority: orderPriority, source: orderSource('customer.address'), confidence: orderConfidence, updatedAt: at }));
        fieldCandidates.reference.push(candidate({ value: currentOrder.customer?.reference, priority: orderPriority, source: orderSource('customer.reference'), confidence: orderConfidence, updatedAt: at }));
        fieldCandidates.product.push(candidate({ value: orderProduct(currentOrder), priority: orderPriority, source: orderSource('tracking.productKey'), confidence: orderConfidence, updatedAt: at }));
        fieldCandidates.quantity.push(candidate({ value: Number(currentOrder.package?.quantity || 0), priority: orderPriority, source: orderSource('package.quantity'), confidence: orderConfidence, updatedAt: at }));
        fieldCandidates.total.push(candidate({ value: Number(currentOrder.total || 0), priority: orderPriority, source: orderSource('total'), confidence: orderConfidence, updatedAt: at }));
        fieldCandidates.funnelStage.push(candidate({ value: currentOrder.conversationMemory?.funnelStage, priority: orderPriority, source: orderSource('conversationMemory.funnelStage'), confidence: orderConfidence, updatedAt: currentOrder.conversationMemory?.lastCustomerMessageAt || at }));
    }

    if (currentShipment) {
        const shipmentSource = (path) => readOnlySource({ kind: 'current_shipment_snapshot', collection: 'shipments', entityId: currentShipment._id || currentShipment.orderId, path });
        const at = currentShipment.logistics?.lastStatusAt || currentShipment.updatedAt;
        fieldCandidates.agency.push(candidate({ value: currentShipment.logistics?.agencyName, priority: PRIORITY.STRUCTURED_PERSISTED, source: shipmentSource('logistics.agencyName'), confidence: CUSTOMER_CONTEXT_CONFIDENCE.HIGH, updatedAt: at }));
        fieldCandidates.deliveryMode.push(candidate({ value: currentShipment.logistics?.agencyPickup ? 'AGENCIA' : 'DOMICILIO', priority: PRIORITY.STRUCTURED_PERSISTED, source: shipmentSource('logistics.agencyPickup'), confidence: CUSTOMER_CONTEXT_CONFIDENCE.HIGH, updatedAt: at }));
    }

    let identityName = resolveAssistiveField('name', fieldCandidates.name);
    const detectedName = resolveAssistiveField('detectedName', fieldCandidates.detectedName);
    let city = resolveAssistiveField('city', fieldCandidates.city);
    let province = resolveAssistiveField('province', fieldCandidates.province);
    let address = resolveAssistiveField('address', fieldCandidates.address);
    const reference = resolveAssistiveField('reference', fieldCandidates.reference);
    let agency = resolveAssistiveField('agency', fieldCandidates.agency);
    const deliveryMode = resolveAssistiveField('deliveryMode', fieldCandidates.deliveryMode);

    const latestInboundText = matchingMessages
        .filter((message) => !message.isFromMe && message.body)
        .slice()
        .sort((left, right) => Number(right.timestamp || 0) - Number(left.timestamp || 0))[0]?.body || '';
    const catalog = catalogResolver({
        city: city.value || '',
        province: province.value || '',
        agencyName: agency.value || '',
        address: address.value || '',
        text: latestInboundText
    }) || {};
    const catalogSource = readOnlySource({ kind: 'servientrega_local_catalog', collection: 'src/data/agencia_LISTA.json' });
    const catalogCityCandidates = (catalog.cityCandidates || []).map((value) => candidate({ value, priority: PRIORITY.ASSISTIVE_INFERENCE, source: catalogSource, confidence: CUSTOMER_CONTEXT_CONFIDENCE.HIGH, inferred: true }));
    const catalogProvinceCandidates = (catalog.provinceCandidates || []).map((value) => candidate({ value, priority: PRIORITY.ASSISTIVE_INFERENCE, source: catalogSource, confidence: CUSTOMER_CONTEXT_CONFIDENCE.PROBABLE, inferred: true }));
    if (catalogCityCandidates.length) city = resolveAssistiveField('city', [...fieldCandidates.city, ...catalogCityCandidates]);
    if (catalogProvinceCandidates.length) province = resolveAssistiveField('province', [...fieldCandidates.province, ...catalogProvinceCandidates]);
    if (!catalog.agencyConfident && (catalog.agencyCandidates || []).length > 1 && !agency.value) {
        agency = {
            ...unknownField('agency'),
            confidence: CUSTOMER_CONTEXT_CONFIDENCE.AMBIGUOUS,
            conflicted: true,
            candidates: catalog.agencyCandidates.map((value) => publicCandidate(candidate({ value, priority: PRIORITY.ASSISTIVE_INFERENCE, source: catalogSource, confidence: CUSTOMER_CONTEXT_CONFIDENCE.AMBIGUOUS, inferred: true })))
        };
    } else if (catalog.agencyConfident && catalog.agency) {
        agency = resolveAssistiveField('agency', [...fieldCandidates.agency, candidate({ value: catalog.agency.name, priority: PRIORITY.ASSISTIVE_INFERENCE, source: catalogSource, confidence: CUSTOMER_CONTEXT_CONFIDENCE.HIGH, inferred: true })]);
        if (!address.value && catalog.agency.address) address = resolveAssistiveField('address', [candidate({ value: catalog.agency.address, priority: PRIORITY.ASSISTIVE_INFERENCE, source: catalogSource, confidence: CUSTOMER_CONTEXT_CONFIDENCE.HIGH, inferred: true })]);
    }
    const sector = catalog.agencyConfident && catalog.agency?.sector
        ? resolveAssistiveField('sector', [candidate({ value: catalog.agency.sector, priority: PRIORITY.ASSISTIVE_INFERENCE, source: catalogSource, confidence: CUSTOMER_CONTEXT_CONFIDENCE.HIGH, inferred: true })])
        : unknownField('sector');

    const product = resolveAssistiveField('currentProduct', fieldCandidates.product);
    const quantity = resolveAssistiveField('quantity', fieldCandidates.quantity);
    const total = resolveAssistiveField('total', fieldCandidates.total);
    const funnelStage = resolveAssistiveField('funnelStage', fieldCandidates.funnelStage);
    const humanMode = resolveAssistiveField('humanMode', fieldCandidates.humanMode);
    const lastInboundAt = resolveAssistiveField('lastInboundAt', fieldCandidates.lastInboundAt);
    const lastOutboundAt = resolveAssistiveField('lastOutboundAt', fieldCandidates.lastOutboundAt);

    const vslFields = { path: [], sourceUrl: [], product: [], testId: [], variant: [] };
    for (const state of states) {
        const meta = state.metadata || {};
        const source = (path) => contactSource(state, path, 'persisted_vsl_attribution');
        vslFields.path.push(candidate({ value: meta.vslPath, priority: PRIORITY.STRUCTURED_PERSISTED, source: source('metadata.vslPath'), confidence: CUSTOMER_CONTEXT_CONFIDENCE.HIGH, updatedAt: state.updatedAt }));
        vslFields.sourceUrl.push(candidate({ value: meta.vslSourceUrl, priority: PRIORITY.STRUCTURED_PERSISTED, source: source('metadata.vslSourceUrl'), confidence: CUSTOMER_CONTEXT_CONFIDENCE.HIGH, updatedAt: state.updatedAt }));
        vslFields.product.push(candidate({ value: productFrom(meta.vslProductKey, meta.vslProductName), priority: PRIORITY.STRUCTURED_PERSISTED, source: source('metadata.vslProductKey'), confidence: CUSTOMER_CONTEXT_CONFIDENCE.HIGH, updatedAt: state.updatedAt }));
        vslFields.testId.push(candidate({ value: meta.vslTestId, priority: PRIORITY.STRUCTURED_PERSISTED, source: source('metadata.vslTestId'), confidence: CUSTOMER_CONTEXT_CONFIDENCE.HIGH, updatedAt: state.updatedAt }));
        vslFields.variant.push(candidate({ value: meta.vslVariant, priority: PRIORITY.STRUCTURED_PERSISTED, source: source('metadata.vslVariant'), confidence: CUSTOMER_CONTEXT_CONFIDENCE.HIGH, updatedAt: state.updatedAt }));
    }
    for (const visit of matchingVisits) {
        const visitPriority = visit.attributionClaimedAt ? PRIORITY.STRUCTURED_PERSISTED : PRIORITY.ASSISTIVE_INFERENCE;
        const visitConfidence = visit.attributionClaimedAt ? CUSTOMER_CONTEXT_CONFIDENCE.HIGH : CUSTOMER_CONTEXT_CONFIDENCE.PROBABLE;
        const source = (path) => readOnlySource({ kind: visit.attributionClaimedAt ? 'claimed_vsl_visit' : 'matched_vsl_visit', collection: 'vslvisits', entityId: visit._id || visit.visitorKey, path, evidenceId: visit.visitorKey });
        const at = visit.attributionClaimedAt || visit.lastSeenAt || visit.updatedAt || visit.firstSeenAt;
        vslFields.path.push(candidate({ value: visit.path || visit.page, priority: visitPriority, source: source('path'), confidence: visitConfidence, updatedAt: at }));
        vslFields.sourceUrl.push(candidate({ value: visit.sourceUrl, priority: visitPriority, source: source('sourceUrl'), confidence: visitConfidence, updatedAt: at }));
        vslFields.product.push(candidate({ value: productFrom(visit.productKey, visit.productName), priority: visitPriority, source: source('productKey'), confidence: visitConfidence, updatedAt: at }));
        vslFields.testId.push(candidate({ value: visit.vslTestId, priority: visitPriority, source: source('vslTestId'), confidence: visitConfidence, updatedAt: at }));
        vslFields.variant.push(candidate({ value: visit.vslVariant, priority: visitPriority, source: source('vslVariant'), confidence: visitConfidence, updatedAt: at }));
    }

    const vslPath = resolveAssistiveField('vslPath', vslFields.path);
    const vslSourceUrl = resolveAssistiveField('vslSourceUrl', vslFields.sourceUrl);
    const vslProduct = resolveAssistiveField('vslProduct', vslFields.product);
    const vslTestId = resolveAssistiveField('vslTestId', vslFields.testId);
    const vslVariant = resolveAssistiveField('vslVariant', vslFields.variant);

    const conflicts = [
        conflictFromField(identityName, 'NAME_MISMATCH'),
        conflictFromField(city, 'LOCATION_MISMATCH'),
        conflictFromField(province, 'LOCATION_MISMATCH'),
        conflictFromField(address, 'LOCATION_MISMATCH'),
        conflictFromField(agency, 'AGENCY_MISMATCH'),
        conflictFromField(deliveryMode, 'DELIVERY_MODE_MISMATCH'),
        conflictFromField(product, 'CURRENT_PRODUCT_MISMATCH'),
        conflictFromField(funnelStage, 'FUNNEL_STAGE_MISMATCH')
    ].filter(Boolean);
    if (orderSelection.ambiguous) {
        conflicts.push({
            code: 'MULTIPLE_ACTIVE_ORDERS',
            field: 'currentOrder',
            confidence: CUSTOMER_CONTEXT_CONFIDENCE.AMBIGUOUS,
            candidates: orderSelection.currentField.candidates,
            reviewRequired: true,
            applicationAllowed: false
        });
    }
    if (product.value?.key && vslProduct.value?.key && product.value.key !== vslProduct.value.key) {
        conflicts.push({
            code: 'VSL_NEGOTIATION_DIVERGENCE',
            field: 'currentProduct',
            confidence: CUSTOMER_CONTEXT_CONFIDENCE.CONFLICT,
            candidates: [product, vslProduct].map((field) => ({ value: field.value, source: field.source, confidence: field.confidence, updatedAt: field.updatedAt, inferred: field.inferred, applicationAllowed: false })),
            reviewRequired: true,
            applicationAllowed: false
        });
    }

    return {
        schemaVersion: CUSTOMER_CONTEXT_SCHEMA_VERSION,
        generatedAt: safeDate(generatedAt),
        readOnly: true,
        applicationAllowed: false,
        match: {
            method: canonicalFromRequest ? 'canonical_ec_phone' : 'unique_phone_tail_match',
            candidates: [canonicalPhone],
            ambiguous: false
        },
        customer: {
            phone: phoneField,
            identity: block({ name: identityName, detectedName }),
            location: block({ city, province, address, reference, sector, agency, deliveryMode }),
            currentProduct: block({ product, quantity, total }),
            vslOrigin: block({ path: vslPath, sourceUrl: vslSourceUrl, product: vslProduct, testId: vslTestId, variant: vslVariant }),
            currentOrder: orderSelection.currentField,
            history: orderSelection.history,
            funnel: block({ stage: funnelStage, humanMode, lastInboundAt, lastOutboundAt }),
            conflicts,
            applicationAllowed: false
        }
    };
};

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const phoneMatcher = (requestedDigits, canonicalPhone) => {
    if (canonicalPhone) {
        const national = canonicalPhone.slice(3);
        const local = `0${national}`;
        return new RegExp(`^(?:\\+?${escapeRegex(canonicalPhone)}|${escapeRegex(local)}|${escapeRegex(national)})(?:@(?:s\\.whatsapp\\.net|c\\.us|lid))?$`, 'i');
    }
    return new RegExp(`${escapeRegex(requestedDigits)}(?:@(?:s\\.whatsapp\\.net|c\\.us|lid))?$`, 'i');
};

const phoneQuery = (fields, matcher, extra = {}) => ({
    ...extra,
    $or: fields.map((field) => ({ [field]: matcher }))
});

const leanFind = (Model, query, projection, sort, limit) => {
    let operation = Model.find(query).select(projection).sort(sort).limit(limit);
    return operation.lean();
};

export const createCustomerCurrentContextReader = ({
    ContactStateModel = ContactState,
    MessageModel = Message,
    OrderModel = Order,
    ShipmentModel = Shipment,
    VslVisitModel = VslVisit,
    catalogResolver = defaultCatalogResolver,
    clock = () => new Date()
} = {}) => async (phone) => {
    const requestedDigits = digitsOnly(phone);
    const canonicalPhone = normalizeEcuadorPhone(phone);
    if (!canonicalPhone && !/^\d{8}$/.test(requestedDigits)) {
        throw new CustomerContextInputError('INVALID_EC_PHONE', 'Informe um telefone Ecuador completo ou uma cauda de 8 digitos para consulta assistiva.');
    }
    const matcher = phoneMatcher(requestedDigits, canonicalPhone);
    const [contactStates, messages, orders, directShipments, vslVisits] = await Promise.all([
        leanFind(ContactStateModel, phoneQuery(['phoneDigits', 'chatId', 'metadata.customerPhoneDigits'], matcher, { countryCode: 'EC' }), CONTACT_PROJECTION, { updatedAt: -1 }, 20),
        leanFind(MessageModel, phoneQuery(['peerPhone', 'chatId', 'from', 'to'], matcher), MESSAGE_PROJECTION, { timestamp: -1 }, 200),
        leanFind(OrderModel, phoneQuery(['customer.phone'], matcher, { country: 'EC' }), ORDER_PROJECTION, { updatedAt: -1 }, 20),
        leanFind(ShipmentModel, phoneQuery(['client.phone'], matcher, { country: 'EC' }), SHIPMENT_PROJECTION, { updatedAt: -1 }, 20),
        leanFind(VslVisitModel, phoneQuery(['customerPhone'], matcher, { country: 'EC' }), VSL_VISIT_PROJECTION, { lastSeenAt: -1 }, 20)
    ]);

    const orderIds = orders.map((order) => String(order.orderId || order._id || '')).filter(Boolean);
    const linkedShipments = orderIds.length
        ? await leanFind(ShipmentModel, { country: 'EC', orderId: { $in: orderIds } }, SHIPMENT_PROJECTION, { updatedAt: -1 }, 20)
        : [];
    const shipmentMap = new Map([...directShipments, ...linkedShipments].map((shipment) => [safeId(shipment._id || shipment.orderId), shipment]));

    return buildCustomerCurrentContextSnapshot({
        phone,
        requestedDigits,
        contactStates,
        messages,
        orders,
        shipments: [...shipmentMap.values()],
        vslVisits,
        generatedAt: clock(),
        catalogResolver
    });
};

export const readCustomerCurrentContext = createCustomerCurrentContextReader();
