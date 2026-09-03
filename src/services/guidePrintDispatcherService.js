import Shipment from '../models/Shipment.js';
import { ensureGuidePrintImage, notifyGuidePrintImage } from './shipmentMessageService.js';
import {
    decidePostSaleNotification,
    failPostSaleNotificationStage,
    shouldSendPostSaleNotification
} from './postSaleNotificationDecisionService.js';
import { POST_SALE_STAGES, POST_SALE_VARIANTS } from './postSaleSafetyV66Service.js';

export const GUIDE_PRINT_ACTIVE_STATUSES = [
    'READY_FOR_PICKUP'
];

const STATUS_PRIORITY = new Map([
    ['READY_FOR_PICKUP', 0]
]);

const phoneTail = (phone = '') => {
    const digits = String(phone || '').replace(/\D/g, '');
    return digits ? digits.slice(-9) : '';
};

const nonEmptyField = (field) => ({ [field]: { $exists: true, $nin: ['', null] } });

const activeGuidePrintQuery = ({ requireSource = false } = {}) => ({
    country: 'EC',
    'logistics.status': { $in: GUIDE_PRINT_ACTIVE_STATUSES },
    'logistics.pickupReadyVerified': true,
    'logistics.trackingNumber': { $exists: true, $nin: ['', null] },
    'client.phone': { $exists: true, $nin: ['', null] },
    'automation.guidePrintNotifiedAt': null,
    'outcomes.delivered': { $ne: true },
    'outcomes.pickedUp': { $ne: true },
    'outcomes.returned': { $ne: true },
    'outcomes.prepaidOnly': { $ne: true },
    'review.manualOnly': { $ne: true },
    ...(requireSource ? {
        $or: [
            nonEmptyField('logistics.invoiceUrl'),
            nonEmptyField('logistics.invoicePath'),
            nonEmptyField('logistics.guidePrintUrl'),
            nonEmptyField('logistics.guidePrintPath')
        ]
    } : {})
});

const sortCandidates = (shipments = []) => shipments.sort((a, b) => {
    const aPriority = STATUS_PRIORITY.get(a?.logistics?.status || '') ?? 99;
    const bPriority = STATUS_PRIORITY.get(b?.logistics?.status || '') ?? 99;
    if (aPriority !== bPriority) return aPriority - bPriority;
    const aDate = new Date(a?.logistics?.lastStatusAt || a?.updatedAt || 0).getTime();
    const bDate = new Date(b?.logistics?.lastStatusAt || b?.updatedAt || 0).getTime();
    return aDate - bDate;
});

const describeCandidate = (shipment, extra = {}) => {
    const hasGuidePrint = Boolean(shipment?.logistics?.guidePrintPath || shipment?.logistics?.guidePrintUrl);
    const hasInvoiceSource = Boolean(shipment?.logistics?.invoicePath || shipment?.logistics?.invoiceUrl);
    return {
        orderId: shipment?.orderId || '',
        client: shipment?.client?.name || '',
        phoneTail: phoneTail(shipment?.client?.phone || ''),
        trackingNumber: shipment?.logistics?.trackingNumber || '',
        status: shipment?.logistics?.status || '',
        invoiceUrl: shipment?.logistics?.invoiceUrl || '',
        invoicePath: shipment?.logistics?.invoicePath || '',
        guidePrintUrl: shipment?.logistics?.guidePrintUrl || '',
        guidePrintPath: shipment?.logistics?.guidePrintPath || '',
        conversionStatus: hasGuidePrint ? 'ready' : (hasInvoiceSource ? 'pending_generation' : 'missing_invoice_source'),
        action: 'guide_print',
        wouldSend: Boolean(hasInvoiceSource || hasGuidePrint),
        reason: hasInvoiceSource || hasGuidePrint ? '' : 'missing_invoice_source',
        ...extra
    };
};

const loadCandidates = async (limit = 50, { requireSource = false } = {}) => {
    const fetchLimit = Math.max(1, Math.min(Number.parseInt(String(limit || 50), 10) || 50, 200));
    const shipments = await Shipment.find(activeGuidePrintQuery({ requireSource }))
        .sort({ updatedAt: 1 })
        .limit(Math.max(fetchLimit * 4, 50));
    return sortCandidates(shipments).slice(0, fetchLimit);
};

export const buildGuidePrintReport = async ({ limit = 50, generate = false } = {}) => {
    const safeLimit = Math.max(1, Math.min(Number.parseInt(String(limit || 50), 10) || 50, 100));
    const candidates = await loadCandidates(safeLimit);
    const rows = [];
    for (const shipment of candidates) {
        if (generate && !shipment?.logistics?.guidePrintPath && (shipment?.logistics?.invoicePath || shipment?.logistics?.invoiceUrl)) {
            const conversion = await ensureGuidePrintImage(shipment, { force: false });
            rows.push(describeCandidate(shipment, {
                conversionStatus: conversion.ok ? 'ready' : 'failed',
                guidePrintUrl: conversion.url || shipment?.logistics?.guidePrintUrl || '',
                guidePrintPath: conversion.path || shipment?.logistics?.guidePrintPath || '',
                wouldSend: Boolean(conversion.ok),
                reason: conversion.ok ? '' : (conversion.reason || 'guide_print_generation_failed')
            }));
            continue;
        }
        rows.push(describeCandidate(shipment));
    }
    return {
        ok: true,
        dryRun: true,
        action: 'guide_print',
        activeStatuses: GUIDE_PRINT_ACTIVE_STATUSES,
        count: rows.length,
        candidates: rows
    };
};

export const processGuidePrintDispatch = async ({ dryRun = true, limit = 1 } = {}) => {
    const effectiveLimit = Math.min(1, Math.max(1, Number.parseInt(String(limit || 1), 10) || 1));
    const candidates = (await loadCandidates(Math.max(effectiveLimit, 25), { requireSource: true }))
        .slice(0, effectiveLimit);
    const result = {
        ok: true,
        dryRun: Boolean(dryRun),
        action: 'guide_print',
        limit: effectiveLimit,
        processed: 0,
        sent: 0,
        skipped: 0,
        failed: 0,
        items: []
    };

    for (const candidate of candidates) {
        result.processed += 1;
        const row = describeCandidate(candidate);
        if (dryRun) {
            result.items.push({ ...row, dryRun: true });
            continue;
        }

        const now = new Date();
        const lockUntil = new Date(now.getTime() + (10 * 60 * 1000));
        const locked = await Shipment.findOneAndUpdate(
            {
                _id: candidate._id,
                'logistics.status': 'READY_FOR_PICKUP',
                'logistics.pickupReadyVerified': true,
                'automation.guidePrintNotifiedAt': null,
                'review.manualOnly': { $ne: true },
                $or: [
                    { 'automation.guidePrintDispatchLockedUntil': null },
                    { 'automation.guidePrintDispatchLockedUntil': { $exists: false } },
                    { 'automation.guidePrintDispatchLockedUntil': { $lte: now } }
                ]
            },
            {
                $set: {
                    'automation.guidePrintDispatchLockedUntil': lockUntil,
                    'automation.guidePrintLastAttemptAt': now
                }
            },
            { new: true }
        );

        if (!locked) {
            result.skipped += 1;
            result.items.push({ ...row, sent: false, reason: 'locked_or_already_notified' });
            continue;
        }

        try {
            const decision = await decidePostSaleNotification({
                shipment: locked,
                kind: 'guide',
                variant: POST_SALE_VARIANTS.GUIDE_PRINT_IMAGE
            });
            if (!shouldSendPostSaleNotification(decision) || !decision.lockToken) {
                result.skipped += 1;
                result.items.push({
                    ...describeCandidate(locked),
                    sent: false,
                    reason: decision.decision || decision.reason || 'central_decision_blocked',
                    notificationStage: decision.stage || 'GUIDE'
                });
                continue;
            }
            const conversion = await ensureGuidePrintImage(locked, { force: false });
            if (!conversion.ok) {
                await failPostSaleNotificationStage({
                    shipment: locked,
                    stage: POST_SALE_STAGES.GUIDE,
                    variant: POST_SALE_VARIANTS.GUIDE_PRINT_IMAGE,
                    lockToken: decision.lockToken,
                    reason: conversion.reason || 'guide_print_generation_failed'
                });
                result.failed += 1;
                result.items.push({
                    ...describeCandidate(locked),
                    conversionStatus: 'failed',
                    sent: false,
                    reason: conversion.reason || 'guide_print_generation_failed'
                });
                continue;
            }
            const sendResult = await notifyGuidePrintImage(locked, { force: false, decision });
            if (sendResult.success) {
                result.sent += 1;
                result.items.push({
                    ...describeCandidate(locked),
                    guidePrintUrl: sendResult.guidePrintUrl || conversion.url || '',
                    conversionStatus: 'ready',
                    sent: true,
                    provider: sendResult.provider || '',
                    providerMessageId: sendResult.providerMessageId || '',
                    providerZaapId: sendResult.providerZaapId || ''
                });
            } else if (/already_notified/i.test(String(sendResult.reason || ''))) {
                result.skipped += 1;
                result.items.push({
                    ...describeCandidate(locked),
                    guidePrintUrl: conversion.url || '',
                    conversionStatus: 'ready',
                    sent: false,
                    reason: sendResult.reason || 'already_notified'
                });
            } else {
                result.failed += 1;
                result.items.push({
                    ...describeCandidate(locked),
                    guidePrintUrl: conversion.url || '',
                    conversionStatus: 'ready',
                    sent: false,
                    reason: sendResult.reason || 'image_send_failed'
                });
            }
        } finally {
            await Shipment.updateOne(
                { _id: candidate._id },
                { $set: { 'automation.guidePrintDispatchLockedUntil': null } }
            ).catch(() => null);
        }
    }

    return result;
};
