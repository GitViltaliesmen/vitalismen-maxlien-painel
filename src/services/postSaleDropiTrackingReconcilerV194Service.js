import crypto from 'node:crypto';

import Shipment from '../models/Shipment.js';
import { resolveEcuadorProductInfo } from './ecuadorProductService.js';
import { normalizeDroppiEcuadorStatus } from './droppiEcuadorService.js';
import { fetchDroppiEcuadorOrdersApiReadOnly } from './droppiEcuadorBrowserService.js';
import { validateDropiTrackingForReconciliation } from './dropiShipmentReconciliationService.js';

export const POST_SALE_DROPI_TRACKING_V194_STATES = Object.freeze({
    TRACKING_FOUND: 'TRACKING_FOUND',
    DROPI_STILL_WITHOUT_TRACKING: 'DROPI_STILL_WITHOUT_TRACKING',
    ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
    AMBIGUOUS_LINK: 'AMBIGUOUS_LINK',
    MANUAL_REVIEW: 'MANUAL_REVIEW'
});

const DAY_MS = 24 * 60 * 60 * 1000;
const LOCK_MS = 10 * 60 * 1000;
const MAX_DAILY_ATTEMPTS = 12;
const BACKOFF_MINUTES = Object.freeze([15, 30, 60]);
const ROOT = 'raw.postSaleV194DropiSync';

const clean = (value = '') => String(value ?? '').trim();
const digitsOnly = (value = '') => clean(value).replace(/\D/g, '');
const dateValue = (value) => {
    const parsed = value ? new Date(value) : null;
    return parsed && Number.isFinite(parsed.getTime()) ? parsed : null;
};

const guayaquilDay = (date = new Date()) => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Guayaquil',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
}).format(date);

const nextGuayaquilDayAtEight = (now = new Date()) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Guayaquil',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(new Date(now.getTime() + DAY_MS));
    const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    // America/Guayaquil is UTC-05 without daylight saving time.
    return new Date(`${value.year}-${value.month}-${value.day}T13:00:00.000Z`);
};

export const persistedDropiOrderIdV194 = (shipment = {}) => [
    shipment?.raw?.manualDropiOrderId,
    shipment?.raw?.latestDroppiPayload?.dropiOrderId,
    shipment?.raw?.droppiOrder?.id,
    shipment?.raw?.droppiOrder?.objects?.id
].map(digitsOnly).find(Boolean) || '';

const productKeyForShipment = (shipment = {}) => resolveEcuadorProductInfo(
    shipment?.productName,
    shipment?.raw?.productName,
    shipment?.raw?.latestDroppiPayload,
    shipment?.raw?.adminLead
)?.key || '';

const exactRowsForDropiId = (rows = [], dropiOrderId = '') => rows.filter((row) => (
    digitsOnly(row?.dropiOrderId || row?.id) === dropiOrderId
));

const phoneMatches = (row = {}, shipment = {}) => {
    const rowDigits = digitsOnly(row?.phone);
    const shipmentDigits = digitsOnly(shipment?.client?.phone);
    if (!rowDigits || !shipmentDigits) return false;
    return rowDigits.slice(-9) === shipmentDigits.slice(-9);
};

const canonicalGuideEvidence = ({ row, dropiOrderId, trackingNumber, now }) => ({
    provider: 'dropi',
    source: 'dropi_orders_api',
    observedAt: now,
    dropiOrderId,
    trackingNumber,
    rawStatus: clean(row?.status).slice(0, 120)
});

const classification = ({ state, reason, row = null, trackingNumber = '', changedFields = [] } = {}) => ({
    state,
    reason,
    row,
    trackingNumber,
    changedFields
});

export const classifyDropiTrackingResultV194 = ({ shipment = {}, rows = [] } = {}) => {
    const dropiOrderId = persistedDropiOrderIdV194(shipment);
    if (!dropiOrderId) {
        return classification({ state: POST_SALE_DROPI_TRACKING_V194_STATES.MANUAL_REVIEW, reason: 'persisted_dropi_order_id_missing' });
    }
    if (!productKeyForShipment(shipment)) {
        return classification({ state: POST_SALE_DROPI_TRACKING_V194_STATES.MANUAL_REVIEW, reason: 'ec_product_unconfigured' });
    }
    const matches = exactRowsForDropiId(rows, dropiOrderId);
    if (!matches.length) {
        return classification({ state: POST_SALE_DROPI_TRACKING_V194_STATES.ORDER_NOT_FOUND, reason: 'exact_dropi_order_id_not_returned' });
    }
    if (matches.length !== 1) {
        return classification({ state: POST_SALE_DROPI_TRACKING_V194_STATES.AMBIGUOUS_LINK, reason: 'duplicate_exact_dropi_order_id_rows' });
    }
    const row = matches[0];
    if (!phoneMatches(row, shipment)) {
        return classification({ state: POST_SALE_DROPI_TRACKING_V194_STATES.AMBIGUOUS_LINK, reason: 'dropi_phone_conflicts_with_shipment', row });
    }
    const rowProduct = resolveEcuadorProductInfo(row?.productKey, row?.productName)?.key || '';
    const shipmentProduct = productKeyForShipment(shipment);
    if (rowProduct && shipmentProduct && rowProduct !== shipmentProduct) {
        return classification({ state: POST_SALE_DROPI_TRACKING_V194_STATES.MANUAL_REVIEW, reason: 'dropi_product_conflicts_with_shipment', row });
    }
    const validated = validateDropiTrackingForReconciliation(row?.trackingNumber, row?.phone);
    if (!validated.ok) {
        return classification({ state: POST_SALE_DROPI_TRACKING_V194_STATES.MANUAL_REVIEW, reason: validated.reason, row });
    }
    if (!validated.value) {
        return classification({
            state: POST_SALE_DROPI_TRACKING_V194_STATES.DROPI_STILL_WITHOUT_TRACKING,
            reason: 'dropi_order_has_no_tracking_yet',
            row
        });
    }
    const normalizedStatus = normalizeDroppiEcuadorStatus(row?.status || 'GUIA_GENERADA') || 'GUIA_GENERADA';
    const changedFields = [
        clean(shipment?.logistics?.trackingNumber) !== validated.value ? 'logistics.trackingNumber' : '',
        clean(shipment?.logistics?.distributionCompany) !== clean(row?.distributionCompany) && clean(row?.distributionCompany)
            ? 'logistics.distributionCompany' : '',
        clean(shipment?.logistics?.status) !== normalizedStatus ? 'logistics.status' : ''
    ].filter(Boolean);
    return classification({
        state: POST_SALE_DROPI_TRACKING_V194_STATES.TRACKING_FOUND,
        reason: 'exact_dropi_order_id_tracking_found',
        row,
        trackingNumber: validated.value,
        changedFields
    });
};

const nextBackoff = ({ shipment, classificationState, rowStatus, now }) => {
    const previous = shipment?.raw?.postSaleV194DropiSync || {};
    const day = guayaquilDay(now);
    const sameDay = clean(previous.attemptDay) === day;
    const statusChanged = clean(previous.lastDropiStatus) !== clean(rowStatus);
    const previousAttempts = sameDay && !statusChanged ? Number(previous.attemptsToday || 0) : 0;
    const attemptsToday = previousAttempts + 1;
    if (classificationState === POST_SALE_DROPI_TRACKING_V194_STATES.TRACKING_FOUND) {
        return { attemptDay: day, attemptsToday, nextSyncAt: null, statusChanged };
    }
    const nextSyncAt = attemptsToday >= MAX_DAILY_ATTEMPTS
        ? nextGuayaquilDayAtEight(now)
        : new Date(now.getTime() + (BACKOFF_MINUTES[Math.min(attemptsToday - 1, BACKOFF_MINUTES.length - 1)] * 60_000));
    return { attemptDay: day, attemptsToday, nextSyncAt, statusChanged };
};

const candidateQuery = (now = new Date()) => ({
    country: 'EC',
    provider: 'droppi',
    'review.manualOnly': { $ne: true },
    'automation.submittedToDroppiAt': { $exists: true, $ne: null },
    $and: [
        { $or: [
            { 'logistics.trackingNumber': { $exists: false } },
            { 'logistics.trackingNumber': null },
            { 'logistics.trackingNumber': '' }
        ] },
        { $or: [
            { 'raw.manualDropiOrderId': { $exists: true, $ne: '' } },
            { 'raw.latestDroppiPayload.dropiOrderId': { $exists: true, $ne: '' } },
            { 'raw.droppiOrder.id': { $exists: true, $ne: '' } },
            { 'raw.droppiOrder.objects.id': { $exists: true, $ne: '' } }
        ] },
        { $or: [
            { [`${ROOT}.nextSyncAt`]: { $exists: false } },
            { [`${ROOT}.nextSyncAt`]: null },
            { [`${ROOT}.nextSyncAt`]: { $lte: now } }
        ] },
        { $or: [
            { [`${ROOT}.lockedUntil`]: { $exists: false } },
            { [`${ROOT}.lockedUntil`]: null },
            { [`${ROOT}.lockedUntil`]: { $lte: now } }
        ] }
    ]
});

const acquireLock = async ({ shipment, now, shipmentModel }) => {
    const token = crypto.randomUUID();
    const locked = await shipmentModel.findOneAndUpdate({
        _id: shipment._id,
        $or: [
            { [`${ROOT}.lockedUntil`]: { $exists: false } },
            { [`${ROOT}.lockedUntil`]: null },
            { [`${ROOT}.lockedUntil`]: { $lte: now } }
        ]
    }, { $set: {
        [`${ROOT}.lockToken`]: token,
        [`${ROOT}.lockedUntil`]: new Date(now.getTime() + LOCK_MS)
    } }, { new: true });
    return locked ? { shipment: locked, token } : null;
};

const applyClassification = async ({ shipment, result, token, now, forwardOnlySince, shipmentModel }) => {
    const dropiOrderId = persistedDropiOrderIdV194(shipment);
    const rowStatus = clean(result?.row?.status);
    const backoff = nextBackoff({ shipment, classificationState: result.state, rowStatus, now });
    const set = {
        [`${ROOT}.lastSyncAt`]: now,
        [`${ROOT}.nextSyncAt`]: backoff.nextSyncAt,
        [`${ROOT}.attemptDay`]: backoff.attemptDay,
        [`${ROOT}.attemptsToday`]: backoff.attemptsToday,
        [`${ROOT}.lastState`]: result.state,
        [`${ROOT}.lastReason`]: result.reason,
        [`${ROOT}.lastDropiStatus`]: rowStatus,
        [`${ROOT}.statusChangedAt`]: backoff.statusChanged ? now : dateValue(shipment?.raw?.postSaleV194DropiSync?.statusChangedAt),
        [`${ROOT}.lockedUntil`]: null,
        [`${ROOT}.lockToken`]: '',
        [`${ROOT}.dropiOrderId`]: dropiOrderId
    };
    if (result.state === POST_SALE_DROPI_TRACKING_V194_STATES.TRACKING_FOUND) {
        const normalizedStatus = normalizeDroppiEcuadorStatus(rowStatus || 'GUIA_GENERADA') || 'GUIA_GENERADA';
        set['logistics.trackingNumber'] = result.trackingNumber;
        set['logistics.status'] = normalizedStatus;
        if (clean(result?.row?.distributionCompany)) set['logistics.distributionCompany'] = clean(result.row.distributionCompany).toUpperCase();
        if (!clean(shipment?.logistics?.canonicalStatus) || clean(shipment?.logistics?.canonicalStatus) === 'UNKNOWN') {
            set['logistics.canonicalStatus'] = 'GUIDE_CREATED';
            set['logistics.canonicalEvidence'] = canonicalGuideEvidence({
                row: result.row,
                dropiOrderId,
                trackingNumber: result.trackingNumber,
                now
            });
        }
        set[`${ROOT}.trackingRecoveredAt`] = now;
        set[`${ROOT}.historicalNoReplay`] = Boolean(
            dateValue(shipment?.createdAt)?.getTime() < dateValue(forwardOnlySince)?.getTime()
        );
    }
    const update = await shipmentModel.updateOne({
        _id: shipment._id,
        [`${ROOT}.lockToken`]: token
    }, { $set: set });
    return Number(update?.modifiedCount || update?.nModified || 0) === 1;
};

export const processDropiTrackingReconciliationV194 = async ({
    now = new Date(),
    forwardOnlySince,
    limit = 8,
    dryRun = true,
    shipmentModel = Shipment,
    fetchRowsFn = fetchDroppiEcuadorOrdersApiReadOnly
} = {}) => {
    const cutoff = dateValue(forwardOnlySince);
    if (!cutoff) throw new Error('post_sale_v194_forward_only_since_invalid');
    const safeLimit = Math.max(1, Math.min(Number(limit) || 8, 8));
    const shipments = await shipmentModel.find(candidateQuery(now))
        .sort({ createdAt: 1, updatedAt: 1 })
        .limit(safeLimit);
    const report = {
        dryRun: Boolean(dryRun),
        candidates: shipments.length,
        processed: 0,
        applied: 0,
        classifications: Object.fromEntries(Object.values(POST_SALE_DROPI_TRACKING_V194_STATES).map((state) => [state, 0])),
        items: []
    };
    for (const initial of shipments) {
        let shipment = initial;
        let lock = null;
        if (!dryRun) {
            lock = await acquireLock({ shipment, now: new Date(), shipmentModel });
            if (!lock) continue;
            shipment = lock.shipment;
        }
        const dropiOrderId = persistedDropiOrderIdV194(shipment);
        let result;
        try {
            const response = dropiOrderId
                ? await fetchRowsFn({ search: dropiOrderId, maxRows: 50 })
                : { rows: [] };
            result = classifyDropiTrackingResultV194({ shipment, rows: response?.rows || [] });
        } catch (error) {
            result = classification({
                state: POST_SALE_DROPI_TRACKING_V194_STATES.MANUAL_REVIEW,
                reason: `dropi_read_failed:${clean(error?.code || error?.message || 'unknown').slice(0, 120)}`
            });
        }
        report.processed += 1;
        report.classifications[result.state] += 1;
        const item = {
            shipmentId: String(shipment?._id || ''),
            orderId: clean(shipment?.orderId),
            dropiOrderId,
            phoneTail: digitsOnly(shipment?.client?.phone).slice(-4),
            state: result.state,
            reason: result.reason,
            trackingNumber: result.trackingNumber,
            changedFields: result.changedFields,
            historicalNoReplay: Boolean(dateValue(shipment?.createdAt)?.getTime() < cutoff.getTime())
        };
        if (!dryRun && await applyClassification({
            shipment,
            result,
            token: lock.token,
            now: new Date(),
            forwardOnlySince: cutoff,
            shipmentModel
        })) report.applied += 1;
        report.items.push(item);
    }
    return report;
};

export default processDropiTrackingReconciliationV194;
