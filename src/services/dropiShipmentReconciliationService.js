import Shipment from '../models/Shipment.js';
import { resolveEcuadorProductInfo } from './ecuadorProductService.js';

const clean = (value = '') => String(value || '').trim();
const digitsOnly = (value = '') => clean(value).replace(/\D/g, '');
const normalizedName = (value = '') => clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();

const rowDropiOrderId = (row = {}) => digitsOnly(row.dropiOrderId || row.id);
const rowTrackingNumber = (row = {}) => clean(row.trackingNumber || row.sticker || row.guide || row.tracking)
    .replace(/^GUIA[-_ ]?/i, '')
    .replace(/[^A-Z0-9-]/gi, '');
const rowInternalOrderId = (row = {}) => [
    row.internalOrderId,
    row.internal_order_id,
    row.externalOrderId,
    row.external_order_id,
    row.reference
].map(clean).find((value) => /^EC-[A-Z0-9-]+$/i.test(value)) || '';
const normalizedPhoneTail = (value = '') => {
    const digits = digitsOnly(value).replace(/^593/, '').replace(/^0/, '');
    return digits.length >= 9 ? digits.slice(-9) : '';
};

const shipmentDropiIds = (shipment = {}) => [
    shipment.raw?.manualDropiOrderId,
    shipment.raw?.latestDroppiPayload?.dropiOrderId,
    shipment.raw?.droppiOrder?.id,
    shipment.raw?.droppiOrder?.objects?.id
].map(digitsOnly).filter(Boolean);

const namesMatchAuxiliary = (left = '', right = '') => {
    const leftParts = normalizedName(left).split(' ').filter((part) => part.length >= 3);
    const rightParts = normalizedName(right).split(' ').filter((part) => part.length >= 3);
    if (!leftParts.length || !rightParts.length) return false;
    return leftParts.filter((part) => rightParts.includes(part)).length >= 2;
};

const productComparison = (row = {}, shipment = {}) => {
    const rowProduct = resolveEcuadorProductInfo(row.productName, row.product, row.rawText, row.rawRow);
    const shipmentProduct = resolveEcuadorProductInfo(
        shipment.productName,
        shipment.notes,
        shipment.raw?.adminLead,
        shipment.raw?.latestDroppiPayload
    );
    return {
        rowKey: rowProduct?.key || '',
        shipmentKey: shipmentProduct?.key || '',
        conflict: Boolean(rowProduct?.key && shipmentProduct?.key && rowProduct.key !== shipmentProduct.key)
    };
};

export const validateDropiTrackingForReconciliation = (tracking = '', phone = '') => {
    const value = rowTrackingNumber({ trackingNumber: tracking });
    if (!value) return { ok: true, value: '' };
    const phoneTail = normalizedPhoneTail(phone);
    const trackingDigits = digitsOnly(value);
    if (phoneTail && trackingDigits && (trackingDigits.endsWith(phoneTail) || phoneTail.endsWith(trackingDigits))) {
        return { ok: false, value, reason: 'tracking_equals_customer_phone' };
    }
    if (!/^[A-Z0-9-]{6,30}$/i.test(value)) return { ok: false, value, reason: 'invalid_tracking_format' };
    return { ok: true, value };
};

export const classifyDropiShipmentMatch = ({ row = {}, candidates = [] } = {}) => {
    const trackingValidation = validateDropiTrackingForReconciliation(rowTrackingNumber(row), row.phone);
    if (!trackingValidation.ok) return { state: 'INVALID_TRACKING', reason: trackingValidation.reason };
    const dropiId = rowDropiOrderId(row);
    const tracking = trackingValidation.value;
    const internalOrderId = rowInternalOrderId(row);
    const phoneTail = normalizedPhoneTail(row.phone);
    const uniqueCandidates = [...new Map((candidates || []).map((shipment) => [String(shipment?._id || shipment?.orderId), shipment])).values()];
    const tiers = [
        ['dropi_order_id', uniqueCandidates.filter((shipment) => dropiId && shipmentDropiIds(shipment).includes(dropiId))],
        ['tracking_number', uniqueCandidates.filter((shipment) => tracking && clean(shipment?.logistics?.trackingNumber).replace(/[^A-Z0-9-]/gi, '') === tracking)],
        ['internal_order_id', uniqueCandidates.filter((shipment) => internalOrderId && clean(shipment?.orderId) === internalOrderId)],
        ['phone_fallback', uniqueCandidates.filter((shipment) => phoneTail && normalizedPhoneTail(shipment?.client?.phone) === phoneTail)]
    ];

    for (const [matchType, initial] of tiers) {
        if (!initial.length) continue;
        const productCompatible = initial.filter((shipment) => !productComparison(row, shipment).conflict);
        if (!productCompatible.length) {
            return {
                state: 'PRODUCT_CONFLICT',
                reason: `identity_${matchType}_but_product_conflicts`,
                matchType,
                candidateCount: initial.length
            };
        }
        let matches = productCompatible;
        if (matchType === 'phone_fallback' && matches.length > 1 && row.clientName) {
            const nameFiltered = matches.filter((shipment) => namesMatchAuxiliary(row.clientName, shipment?.client?.name));
            if (nameFiltered.length) matches = nameFiltered;
        }
        if (matches.length > 1) {
            return { state: 'AMBIGUOUS_MATCH', reason: `multiple_${matchType}_candidates`, matchType, candidateCount: matches.length };
        }
        return { state: 'MATCHED', reason: 'strict_identity_match', matchType, shipment: matches[0], candidateCount: 1 };
    }
    return { state: 'NO_MATCH', reason: 'no_strict_local_identity_match', candidateCount: 0 };
};

const candidateQueryForRow = (row = {}) => {
    const dropiId = rowDropiOrderId(row);
    const tracking = rowTrackingNumber(row);
    const internalOrderId = rowInternalOrderId(row);
    const phoneTail = normalizedPhoneTail(row.phone);
    const clauses = [
        dropiId ? { 'raw.manualDropiOrderId': dropiId } : null,
        dropiId ? { 'raw.latestDroppiPayload.dropiOrderId': dropiId } : null,
        dropiId ? { 'raw.droppiOrder.id': dropiId } : null,
        tracking ? { 'logistics.trackingNumber': tracking } : null,
        internalOrderId ? { orderId: internalOrderId } : null,
        phoneTail ? { 'client.phone': { $regex: `${phoneTail}$` } } : null
    ].filter(Boolean);
    return clauses.length ? { country: 'EC', provider: 'droppi', $or: clauses } : null;
};

export const reconcileDropiRowToShipment = async ({ row, model = Shipment } = {}) => {
    const query = candidateQueryForRow(row);
    const candidates = query
        ? await model.find(query).sort({ updatedAt: -1, createdAt: -1 }).limit(50)
        : [];
    return classifyDropiShipmentMatch({ row, candidates });
};

export default reconcileDropiRowToShipment;
