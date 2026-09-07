import ContactState from '../models/ContactState.js';
import Order from '../models/Order.js';
import Shipment from '../models/Shipment.js';
import {
    listOnlineAdminLeadsByWindow,
    syncOrderToOnlineAdminPanel
} from './adminPanelStatusService.js';
import { trackServientregaGuide } from './carrierTrackingService.js';
import { fetchDroppiEcuadorOrdersApiReadOnly } from './droppiEcuadorBrowserService.js';
import { resolveEcuadorProductInfo } from './ecuadorProductService.js';
import { dropiHumanAuthorizationEvidenceV139 } from './ecDropiStatusPostSaleV139Service.js';
import {
    applyShipmentLifecycleStatus,
    orderStatusForLogisticsStatus
} from './shipmentLifecycleStatusService.js';

export const V140_RECONCILIATION_CLASSES = Object.freeze({
    ALREADY_CORRECT: 'ALREADY_CORRECT',
    DIVERGENT: 'DIVERGENT',
    AMBIGUOUS: 'AMBIGUOUS',
    MISSING_GUIDE: 'MISSING_GUIDE',
    MISSING_PHONE: 'MISSING_PHONE',
    ERROR: 'ERROR'
});

const clean = (value = '') => String(value || '').trim();
const digitsOnly = (value = '') => clean(value).replace(/\D/g, '');
const statusKey = (value = '') => clean(value).toUpperCase().replace(/[\s-]+/g, '_');
const idString = (value = '') => clean(value?._id || value);
const dateMs = (value) => {
    const parsed = value ? new Date(value).getTime() : Number.NaN;
    return Number.isFinite(parsed) ? parsed : Number.NaN;
};

export const canonicalEcPhoneE164V140 = (value = '') => {
    const digits = digitsOnly(value);
    const normalized = digits.startsWith('593')
        ? digits
        : digits.startsWith('09') && digits.length === 10
            ? `593${digits.slice(1)}`
            : digits.startsWith('9') && digits.length === 9
                ? `593${digits}`
                : '';
    return /^5939\d{8}$/.test(normalized) ? `+${normalized}` : '';
};

export const validServientregaGuideV140 = (value = '', phone = '') => {
    const guide = digitsOnly(value);
    const phoneDigits = digitsOnly(canonicalEcPhoneE164V140(phone));
    if (!/^\d{8,15}$/.test(guide)) return '';
    if (phoneDigits && (guide.endsWith(phoneDigits.slice(-9)) || phoneDigits.endsWith(guide))) return '';
    return guide;
};

const productKeyOf = (...values) => resolveEcuadorProductInfo(...values)?.key || '';
const dropiIdsOf = (bundle = {}) => [...new Set([
    bundle?.order?.dropiOrderId,
    bundle?.shipment?.raw?.manualDropiOrderId,
    bundle?.shipment?.raw?.latestDroppiPayload?.dropiOrderId,
    bundle?.shipment?.raw?.droppiOrder?.id,
    bundle?.shipment?.raw?.droppiOrder?.objects?.id
].map(digitsOnly).filter(Boolean))];

const phoneOfBundle = (bundle = {}) => canonicalEcPhoneE164V140(
    bundle?.order?.customer?.phone
    || bundle?.shipment?.client?.phone
    || bundle?.state?.phoneDigits
    || bundle?.lead?.phone
);

const productOfBundle = (bundle = {}) => productKeyOf(
    bundle?.order?.tracking?.productKey,
    bundle?.order?.tracking?.productName,
    bundle?.shipment?.productName,
    bundle?.shipment?.raw?.adminLead,
    bundle?.state?.metadata?.customerDraft?.productKey
);

const createdAtOfBundle = (bundle = {}) => (
    bundle?.order?.entryAt
    || bundle?.order?.createdAt
    || bundle?.shipment?.createdAt
    || bundle?.lead?.createdAt
);

export const disambiguatePhoneOrderV140 = ({ row = {}, bundles = [] } = {}) => {
    const phone = canonicalEcPhoneE164V140(row.phone);
    if (!phone) return { matched: false, classification: V140_RECONCILIATION_CLASSES.MISSING_PHONE, reason: 'invalid_ec_e164_phone' };
    const phoneMatches = (bundles || []).filter((bundle) => phoneOfBundle(bundle) === phone);
    if (!phoneMatches.length) return { matched: false, classification: V140_RECONCILIATION_CLASSES.ERROR, reason: 'canonical_phone_without_local_order_shipment' };

    const rowGuide = validServientregaGuideV140(row.trackingNumber, phone);
    const rowDropiId = digitsOnly(row.dropiOrderId);
    const rowShipmentId = idString(row.shipmentId);
    const rowOrderId = clean(row.internalOrderId || row.orderId);
    const rowProduct = productKeyOf(row.productKey, row.productName, row.rawText, row.rawRow);
    const rowDate = dateMs(row.createdAt || row.date);
    const compatible = phoneMatches.filter((bundle) => {
        const candidateGuide = digitsOnly(bundle?.shipment?.logistics?.trackingNumber || bundle?.order?.trackingNumber);
        const candidateDropiIds = dropiIdsOf(bundle);
        const candidateOrderId = clean(bundle?.order?.orderId || bundle?.shipment?.orderId);
        const candidateProduct = productOfBundle(bundle);
        if (rowGuide && candidateGuide && rowGuide !== candidateGuide) return false;
        if (rowDropiId && candidateDropiIds.length && !candidateDropiIds.includes(rowDropiId)) return false;
        if (rowOrderId && candidateOrderId && rowOrderId !== candidateOrderId) return false;
        if (rowProduct && candidateProduct && rowProduct !== candidateProduct) return false;
        return true;
    });
    if (!compatible.length) {
        return {
            matched: false,
            classification: V140_RECONCILIATION_CLASSES.ERROR,
            reason: 'phone_match_has_conflicting_order_identity',
            phone
        };
    }
    if (compatible.length === 1) {
        const bundle = compatible[0];
        if (phoneMatches.length === 1) return { matched: true, matchType: 'phone_unique_compatible', bundle, phone };
        const exact = [
            rowGuide && digitsOnly(bundle?.shipment?.logistics?.trackingNumber || bundle?.order?.trackingNumber) === rowGuide ? 'guide' : '',
            rowDropiId && dropiIdsOf(bundle).includes(rowDropiId) ? 'dropiOrderId' : '',
            rowShipmentId && idString(bundle?.shipment?._id) === rowShipmentId ? 'shipmentId' : '',
            rowOrderId && clean(bundle?.order?.orderId || bundle?.shipment?.orderId) === rowOrderId ? 'orderId' : '',
            rowProduct && productOfBundle(bundle) === rowProduct ? 'product' : ''
        ].filter(Boolean);
        return { matched: true, matchType: `phone_disambiguated:${exact.join('+') || 'compatible_identity'}`, bundle, phone };
    }

    const scored = compatible.map((bundle) => {
        const exact = [];
        if (rowGuide && digitsOnly(bundle?.shipment?.logistics?.trackingNumber || bundle?.order?.trackingNumber) === rowGuide) exact.push('guide');
        if (rowDropiId && dropiIdsOf(bundle).includes(rowDropiId)) exact.push('dropiOrderId');
        if (rowShipmentId && idString(bundle?.shipment?._id) === rowShipmentId) exact.push('shipmentId');
        if (rowOrderId && clean(bundle?.order?.orderId || bundle?.shipment?.orderId) === rowOrderId) exact.push('orderId');
        if (rowProduct && productOfBundle(bundle) === rowProduct) exact.push('product');
        const candidateDate = dateMs(createdAtOfBundle(bundle));
        const dateDistance = Number.isFinite(rowDate) && Number.isFinite(candidateDate)
            ? Math.abs(rowDate - candidateDate)
            : Number.POSITIVE_INFINITY;
        if (dateDistance <= 3 * 24 * 60 * 60 * 1000) exact.push('date');
        return { bundle, exact, score: exact.length, dateDistance };
    }).sort((left, right) => right.score - left.score || left.dateDistance - right.dateDistance);

    const best = scored[0];
    const second = scored[1];
    const hasHardIdentity = best.exact.some((item) => ['guide', 'dropiOrderId', 'shipmentId', 'orderId'].includes(item));
    const uniqueByScore = best.score > second.score;
    const uniqueByDate = best.score === second.score
        && Number.isFinite(best.dateDistance)
        && best.dateDistance < second.dateDistance
        && best.dateDistance <= 3 * 24 * 60 * 60 * 1000;
    if ((hasHardIdentity && uniqueByScore) || uniqueByScore || uniqueByDate) {
        return {
            matched: true,
            matchType: `phone_disambiguated:${best.exact.join('+') || 'date'}`,
            bundle: best.bundle,
            phone
        };
    }
    return {
        matched: false,
        classification: V140_RECONCILIATION_CLASSES.AMBIGUOUS,
        reason: 'multiple_phone_orders_remain_ambiguous',
        candidateCount: compatible.length,
        phone
    };
};

const panelStatusFor = (logisticsStatus = '') => {
    const orderStatus = orderStatusForLogisticsStatus(logisticsStatus);
    return ({ shipped: 'pedido_enviado', delivered: 'entregue', returned: 'devolvido', cancelled: 'cancelado' })[orderStatus] || '';
};

const dropiIdPresent = (bundle, value) => dropiIdsOf(bundle).includes(digitsOnly(value));
const projectionSnapshot = (bundle = {}) => ({
    shipmentStatus: statusKey(bundle?.shipment?.logistics?.status),
    orderStatus: clean(bundle?.order?.status).toLowerCase(),
    orderShippingStatus: statusKey(bundle?.order?.shippingStatus),
    contactStatus: clean(bundle?.state?.metadata?.customerDraft?.status).toLowerCase(),
    contactLogisticsStatus: statusKey(bundle?.state?.metadata?.logistics?.status),
    panelStatus: clean(bundle?.lead?.status).toLowerCase(),
    trackingNumber: digitsOnly(bundle?.shipment?.logistics?.trackingNumber || bundle?.order?.trackingNumber),
    dropiOrderId: digitsOnly(bundle?.order?.dropiOrderId || dropiIdsOf(bundle)[0]),
    pickupReadyVerified: bundle?.shipment?.logistics?.pickupReadyVerified === true
});

export const classifyCanonicalProjectionV140 = ({ bundle = {}, row = {}, servientrega = {} } = {}) => {
    const observed = statusKey(servientrega.normalizedStatus);
    const guide = validServientregaGuideV140(servientrega.trackingNumber || row.trackingNumber, row.phone);
    if (!guide) return { classification: V140_RECONCILIATION_CLASSES.MISSING_GUIDE, reason: 'missing_or_invalid_servientrega_guide' };
    if (!servientrega.ok || !observed) return { classification: V140_RECONCILIATION_CLASSES.ERROR, reason: servientrega.reason || 'servientrega_query_failed' };
    const before = projectionSnapshot(bundle);
    const expectedOrder = orderStatusForLogisticsStatus(observed);
    const expectedPanel = panelStatusFor(observed);
    const pickupExpected = observed === 'READY_FOR_PICKUP';
    const correct = before.shipmentStatus === observed
        && before.orderShippingStatus === observed
        && (!expectedOrder || before.orderStatus === expectedOrder)
        && (!expectedPanel || before.contactStatus === expectedPanel)
        && (!expectedPanel || before.panelStatus === expectedPanel)
        && before.contactLogisticsStatus === observed
        && before.trackingNumber === guide
        && dropiIdPresent(bundle, row.dropiOrderId)
        && before.pickupReadyVerified === pickupExpected;
    return {
        classification: correct ? V140_RECONCILIATION_CLASSES.ALREADY_CORRECT : V140_RECONCILIATION_CLASSES.DIVERGENT,
        before,
        expected: {
            shipmentStatus: observed,
            orderStatus: expectedOrder,
            panelStatus: expectedPanel,
            trackingNumber: guide,
            dropiOrderId: digitsOnly(row.dropiOrderId),
            pickupReadyVerified: pickupExpected
        }
    };
};

const hasGuideMessageProof = (shipment = {}) => Boolean(
    shipment?.automation?.guiaNotifiedAt
    || shipment?.automation?.postSaleSafetyLedger?.GUIDE?.state === 'SENT'
    || (shipment?.notificationLedger || []).some((entry) => entry?.notification_type === 'guide' && entry?.sent_at)
    || (shipment?.events || []).some((event) => event?.kind === 'guia_notified')
);

export const historicalSuppressionKindsV140 = ({ status = '', shipment = {} } = {}) => {
    const normalized = statusKey(status);
    if (normalized === 'GUIA_GENERADA') return hasGuideMessageProof(shipment) ? [] : ['guide'];
    if (['EN_PROCESAMIENTO', 'MERCANCIA_RECOGIDA', 'EN_BODEGA_TRANSPORTADORA', 'EN_DESPACHO', 'EN_RUTA', 'EN_REPARTO', 'EN_DISTRIBUCION_A_CLIENTE'].includes(normalized)) {
        return ['guide', 'in_transit'];
    }
    if (normalized === 'READY_FOR_PICKUP') return ['guide', 'in_transit'];
    if (normalized === 'ENTREGADO') return ['guide', 'in_transit', 'ready_for_pickup'];
    return [];
};

const markHistoricalEvidence = (shipment, { phone, row, servientrega }) => {
    shipment.raw = shipment.raw || {};
    shipment.raw.latestDroppiPayload = {
        ...(shipment.raw.latestDroppiPayload || {}),
        dropiOrderId: digitsOnly(row.dropiOrderId),
        phone,
        trackingNumber: validServientregaGuideV140(servientrega.trackingNumber || row.trackingNumber, phone),
        reconciliationSource: 'v140_phone_servientrega'
    };
    shipment.review = shipment.review || {};
    const suppressions = historicalSuppressionKindsV140({ status: servientrega.normalizedStatus, shipment });
    shipment.review.suppressedNotificationKinds = [...new Set([
        ...(shipment.review.suppressedNotificationKinds || []),
        ...suppressions
    ])];
    if (statusKey(servientrega.normalizedStatus) === 'GUIA_GENERADA' && suppressions.includes('guide')) {
        shipment.review.reviewStatus = 'historical_sent_notice_review_required';
    }
    shipment.events = Array.isArray(shipment.events) ? shipment.events : [];
    shipment.events.push({
        kind: 'v140_phone_reconciliation_identity_applied',
        at: new Date(),
        payload: {
            phone,
            orderId: shipment.orderId,
            shipmentId: idString(shipment._id),
            dropiOrderId: digitsOnly(row.dropiOrderId),
            trackingNumber: validServientregaGuideV140(servientrega.trackingNumber || row.trackingNumber, phone),
            servientregaStatus: statusKey(servientrega.normalizedStatus),
            suppressedNotificationKinds: suppressions,
            messagesSent: 0
        }
    });
    shipment.events = shipment.events.slice(-80);
};

const executeFind = async (query, { sort = {}, limit = 0 } = {}) => {
    let current = query;
    if (current && typeof current.sort === 'function') current = current.sort(sort);
    if (limit && current && typeof current.limit === 'function') current = current.limit(limit);
    return await current;
};

export const loadV140CanonicalBundles = async ({
    orderModel = Order,
    shipmentModel = Shipment,
    contactStateModel = ContactState,
    listAdminLeads = listOnlineAdminLeadsByWindow
} = {}) => {
    const shipments = await executeFind(shipmentModel.find({ country: 'EC', provider: 'droppi' }), { sort: { updatedAt: -1 } });
    const orderIds = [...new Set(shipments.map((shipment) => clean(shipment.orderId)).filter(Boolean))];
    const orders = await executeFind(orderModel.find({ country: 'EC', orderId: { $in: orderIds } }), { sort: { updatedAt: -1 } });
    const states = await executeFind(contactStateModel.find({ countryCode: 'EC' }), { sort: { updatedAt: -1 } });
    const admin = listAdminLeads({ country: 'EC', limit: 5000 });
    const leads = admin?.ok ? admin.leads : [];
    const orderById = new Map(orders.map((order) => [clean(order.orderId), order]));
    return shipments.map((shipment) => {
        const order = orderById.get(clean(shipment.orderId));
        const phone = canonicalEcPhoneE164V140(order?.customer?.phone || shipment?.client?.phone);
        const state = states.find((item) => (
            canonicalEcPhoneE164V140(item?.phoneDigits || item?.metadata?.customerDraft?.phone) === phone
            && (!item?.metadata?.customerDraft?.orderId || item.metadata.customerDraft.orderId === shipment.orderId)
        )) || states.find((item) => canonicalEcPhoneE164V140(item?.phoneDigits || item?.metadata?.customerDraft?.phone) === phone);
        const lead = leads.find((item) => (
            canonicalEcPhoneE164V140(item.phone) === phone
            && (!item.notes || item.notes.includes(shipment.orderId))
        )) || leads.find((item) => canonicalEcPhoneE164V140(item.phone) === phone);
        return { shipment, order, state, lead };
    }).filter((bundle) => bundle.order && bundle.shipment && bundle.state && bundle.lead && phoneOfBundle(bundle));
};

const needsHistoricalBootstrap = (row, match) => {
    if (!match?.matched) return true;
    const shipment = match.bundle?.shipment;
    const guide = validServientregaGuideV140(row.trackingNumber, row.phone);
    const localStatus = statusKey(shipment?.logistics?.status);
    const expectedOrder = orderStatusForLogisticsStatus(localStatus);
    const expectedPanel = panelStatusFor(localStatus);
    const localProjectionDivergent = Boolean(
        (localStatus && statusKey(match.bundle?.order?.shippingStatus) !== localStatus)
        || (expectedOrder && clean(match.bundle?.order?.status).toLowerCase() !== expectedOrder)
        || (expectedPanel && clean(match.bundle?.state?.metadata?.customerDraft?.status).toLowerCase() !== expectedPanel)
        || (expectedPanel && clean(match.bundle?.lead?.status).toLowerCase() !== expectedPanel)
        || (localStatus && statusKey(match.bundle?.state?.metadata?.logistics?.status) !== localStatus)
    );
    return !guide
        || !digitsOnly(shipment?.logistics?.trackingNumber)
        || !dropiIdPresent(match.bundle, row.dropiOrderId)
        || ['CREATED', 'PENDIENTE', ''].includes(localStatus)
        || localProjectionDivergent;
};

export const reconcileV140Rows = async ({
    rows = [],
    bundles = [],
    dryRun = true,
    limit = 6,
    onlyPhone = '',
    trackGuide = trackServientregaGuide,
    applyLifecycle = applyShipmentLifecycleStatus,
    syncPanel = syncOrderToOnlineAdminPanel
} = {}) => {
    const phoneFilter = canonicalEcPhoneE164V140(onlyPhone);
    const selectedRows = rows
        .filter((row) => !phoneFilter || canonicalEcPhoneE164V140(row.phone) === phoneFilter)
        .map((row) => ({ row, match: disambiguatePhoneOrderV140({ row, bundles }) }))
        .filter(({ row, match }) => phoneFilter || needsHistoricalBootstrap(row, match))
        .slice(0, Math.max(1, Number(limit) || 6));
    const report = {
        ok: true,
        dryRun: Boolean(dryRun),
        readOnly: Boolean(dryRun),
        writes: 0,
        messagesSent: 0,
        candidatesFound: selectedRows.length,
        phoneMatched: 0,
        reconciled: 0,
        alreadyCorrect: 0,
        ambiguousSkipped: 0,
        missingGuide: 0,
        missingPhone: 0,
        errors: 0,
        results: []
    };
    for (const { row, match } of selectedRows) {
        const item = {
            phone: canonicalEcPhoneE164V140(row.phone),
            dropiOrderId: digitsOnly(row.dropiOrderId),
            guide: validServientregaGuideV140(row.trackingNumber, row.phone),
            matchType: match.matchType || '',
            classification: match.classification || '',
            reason: match.reason || ''
        };
        if (!match.matched) {
            if (match.classification === V140_RECONCILIATION_CLASSES.AMBIGUOUS) report.ambiguousSkipped += 1;
            else if (match.classification === V140_RECONCILIATION_CLASSES.MISSING_PHONE) report.missingPhone += 1;
            else report.errors += 1;
            report.results.push(item);
            continue;
        }
        report.phoneMatched += 1;
        const bundle = match.bundle;
        item.customerId = idString(bundle.state?._id);
        item.leadId = clean(bundle.lead?.id);
        item.orderId = clean(bundle.order?.orderId);
        item.shipmentId = idString(bundle.shipment?._id);
        if (!dropiHumanAuthorizationEvidenceV139(bundle.shipment)) {
            item.classification = V140_RECONCILIATION_CLASSES.ERROR;
            item.reason = 'missing_human_dropi_authorization';
            report.errors += 1;
            report.results.push(item);
            continue;
        }
        if (!item.guide) {
            item.classification = V140_RECONCILIATION_CLASSES.MISSING_GUIDE;
            item.reason = 'missing_or_invalid_servientrega_guide';
            report.missingGuide += 1;
            report.results.push(item);
            continue;
        }
        const carrier = await trackGuide(item.guide).catch((error) => ({ ok: false, reason: error.message || 'servientrega_query_failed' }));
        item.servientregaStatus = statusKey(carrier.normalizedStatus);
        const projection = classifyCanonicalProjectionV140({ bundle, row, servientrega: carrier });
        item.classification = projection.classification;
        item.reason = projection.reason || '';
        item.before = projection.before || null;
        item.expected = projection.expected || null;
        if (projection.classification === V140_RECONCILIATION_CLASSES.ERROR) report.errors += 1;
        else if (projection.classification === V140_RECONCILIATION_CLASSES.MISSING_GUIDE) report.missingGuide += 1;
        else if (projection.classification === V140_RECONCILIATION_CLASSES.ALREADY_CORRECT) report.alreadyCorrect += 1;
        else if (!dryRun) {
            markHistoricalEvidence(bundle.shipment, { phone: item.phone, row, servientrega: carrier });
            await bundle.shipment.save();
            const lifecycle = await applyLifecycle({
                shipmentId: bundle.shipment._id,
                shipmentDocument: bundle.shipment,
                status: carrier.normalizedStatus,
                source: 'carrier_tracking',
                carrierResult: carrier
            });
            if (!lifecycle?.ok) {
                item.classification = V140_RECONCILIATION_CLASSES.ERROR;
                item.reason = lifecycle?.reason || 'canonical_lifecycle_failed';
                report.errors += 1;
            } else {
                const refreshedOrder = lifecycle.order || bundle.order;
                if (!lifecycle.adminSync?.ok && refreshedOrder) {
                    item.panel = syncPanel(refreshedOrder, {
                        status: panelStatusFor(carrier.normalizedStatus),
                        action: 'carrier_status_v140_phone_reconciliation'
                    });
                }
                report.reconciled += 1;
                report.writes += 1;
                item.after = lifecycle.effectiveStatus;
                item.postSaleAction = statusKey(carrier.normalizedStatus) === 'READY_FOR_PICKUP'
                    ? 'READY_FOR_PICKUP_ELIGIBLE_ONCE'
                    : (statusKey(carrier.normalizedStatus) === 'ENTREGADO'
                        ? 'CURRENT_POST_DELIVERY_ONLY'
                        : 'ACTIVE_FROM_NEXT_REAL_CHANGE');
            }
        }
        report.results.push(item);
    }
    return report;
};

export const processEcPhoneServientregaReconciliationV140 = async ({
    dryRun = true,
    limit = 6,
    onlyPhone = '',
    fetchRows = fetchDroppiEcuadorOrdersApiReadOnly,
    loadBundles = loadV140CanonicalBundles,
    ...dependencies
} = {}) => {
    const source = await fetchRows({ search: onlyPhone ? digitsOnly(onlyPhone).slice(-9) : '', maxRows: 1000 });
    if (!source?.ok) return { ok: false, dryRun: Boolean(dryRun), writes: 0, messagesSent: 0, errors: 1, reason: source?.reason || 'dropi_read_failed' };
    const bundles = await loadBundles(dependencies);
    return reconcileV140Rows({
        rows: source.rows || [],
        bundles,
        dryRun,
        limit,
        onlyPhone,
        ...dependencies
    });
};

export default processEcPhoneServientregaReconciliationV140;
