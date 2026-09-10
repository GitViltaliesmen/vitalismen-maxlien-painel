import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Shipment from '../models/Shipment.js';
import Message from '../models/Message.js';
import { formatWhatsAppNumber } from '../utils/phone.js';
import { POST_SALE_TEMPLATE_CATALOG_V147 as catalog } from './postSaleTemplateCatalogV147Service.js';
import { VIT_POWER_PICKUP_BONUS_TEXT } from './vitPowerEvolvedWorkflow.js';
import { loadPostSaleProductV147R5 } from './postSaleProductResolutionV147R5Service.js';
import { buildPostSaleDedupeKeyV147, servientregaPostSaleCompletionEligibleV147, canonicalLogisticsProjectionForShipmentV147 } from './canonicalLogisticsStatusV147Service.js';
import { legacyMarkerSetForStage, POST_SALE_TERMINAL_LEDGER_STATES } from './postSaleSafetyV66Service.js';

const clean = (value) => String(value ?? '').trim();
const sha = (value) => crypto.createHash('sha256').update(value).digest('hex');
const phone = (value) => formatWhatsAppNumber({ phone: value, country: 'EC' });
const textHash = (value) => sha(clean(value).replace(/\r\n/g, '\n'));
const pickupStageEvents = Object.freeze({ READY_FOR_PICKUP: 'A07', PICKUP_REMINDER_DAY3: 'A10', PICKUP_REMINDER_DAY5: 'A19' });
const stageEvents = Object.freeze({ ...pickupStageEvents, DELIVERED_THANK_YOU: 'P5', PICKUP_BONUS: 'P6', PRODUCT_USAGE: 'P7' });
export const pickupPostSaleStageV147R6R2 = (stage) => Boolean(pickupStageEvents[stage]);
const templates = [catalog.DELIVERED_THANKYOU_TEMPLATE, catalog.BONUS_ACCESS_TEMPLATE,
    catalog.USAGE_TEX_ULTRA, catalog.USAGE_VIT_POWER, catalog.USAGE_NITRIX, catalog.A07, catalog.A10, catalog.A19];
// Exact legacy panel template, audited against the accepted provider record. No fuzzy text match.
export const LEGACY_PANEL_P6_TEXT_V147R6 = '🎁 Tu bono exclusivo ya está disponible.\n\nAcceso gratuito para clientes mayores de 18 años\n\n👉 Ingresa al enlace oficial del bono que recibiste con tu compra: https://zapgersonecvo.cloud';
const p6Hashes = new Set([VIT_POWER_PICKUP_BONUS_TEXT, LEGACY_PANEL_P6_TEXT_V147R6].map(textHash));
export const unifiedPostSaleStageV147R6 = (stage) => Boolean(stageEvents[stage]);
const descriptor = (template) => template ? {
    canonicalEvent: template.id.split('_')[0], templateId: template.id,
    product: template.product === 'all' ? '' : template.product,
    stage: Object.keys(stageEvents).find((key) => stageEvents[key] === template.id.split('_')[0])
} : null;

export const classifyPostSaleContentV147R6 = (record = {}) => {
    const metadata = record.postSaleEvent;
    if (metadata?.dedupeKey) return descriptor(templates.find((t) => t.id === metadata.templateId));
    const media = clean(record.mediaUrl || record.mediaPath || (record.isMedia ? record.message : ''));
    let match = null;
    if (media) {
        // Only the official EC path or the bytes/hash of an official audio identify a template.
        const normalized = media.replace(/^https:\/\/ec\.maxlien\.shop(?=\/media\/)/, '')
            .replace(/^\/opt\/vitalismen-automacao\/releases\/[^/]+\/public(?=\/media\/)/, '');
        match = templates.find((t) => t.mediaPresent && t.labels.some((label) =>
            ['ogg', 'mp3', 'opus'].some((ext) => normalized === '/media/templates/EC/' + label + '.' + ext)));
        let digest = clean(record.mediaSha256);
        if (media.startsWith('data:audio/') && media.includes(';base64,')) digest = sha(Buffer.from(media.split(';base64,')[1], 'base64'));
        if (!match && /^[a-f0-9]{64}$/.test(digest)) {
            match = templates.find((t) => t.mediaPresent && t.labels.some((label) => ['ogg', 'mp3', 'opus'].some((ext) => {
                const file = path.join(process.cwd(), 'public/media/templates/EC', label + '.' + ext);
                return fs.existsSync(file) && sha(fs.readFileSync(file)) === digest;
            })));
        }
    } else if (p6Hashes.has(textHash(record.body ?? record.message ?? ''))) match = catalog.BONUS_ACCESS_TEMPLATE;
    // A labelled automation record is an existing canonical identifier, not a text similarity heuristic.
    if (!match && /^\[AUDIO\] /i.test(clean(record.body))) {
        const label = clean(record.body).slice(8);
        match = templates.find((t) => t.mediaPresent && t.labels.includes(label));
    }
    return descriptor(match);
};

export const resolvePostSaleEventV147R6 = async ({ shipment, stage, resolveProductFn = loadPostSaleProductV147R5 } = {}) => {
    if (!unifiedPostSaleStageV147R6(stage)) return null;
    const product = stage === 'PRODUCT_USAGE' ? await resolveProductFn({ shipment }) : null;
    const template = pickupStageEvents[stage] ? catalog[pickupStageEvents[stage]]
        : stage === 'DELIVERED_THANK_YOU' ? catalog.DELIVERED_THANKYOU_TEMPLATE
        : stage === 'PICKUP_BONUS' ? catalog.BONUS_ACCESS_TEMPLATE
            : templates.find((t) => t.id.startsWith('P7_') && t.product === product?.productKey);
    if (!template) return null;
    const customerId = clean(shipment?.raw?.historicalExternalReconciliation?.customerId
        || shipment?.raw?.customerId || shipment?.client?.customerId || ('phone:' + phone(shipment?.client?.phone)));
    const event = { ...descriptor(template), customerId, orderId: clean(shipment?.orderId), shipmentId: clean(shipment?._id) };
    // P7's catalog template is product-specific; product is also explicit in the hashed component.
    event.dedupeKey = buildPostSaleDedupeKeyV147({ ...event,
        templateId: event.templateId + (event.product ? '|' + event.product : '') });
    return event.dedupeKey ? Object.freeze(event) : null;
};

export const acceptedPostSaleEvidenceV147R6 = (record = {}) => Boolean(
    clean(record.providerMessageId) && record.isFromMe === true
    && (Number(record.ack) >= 1 || record.deliveredAt || record.readAt
        || ['sent', 'delivered', 'read', 'provider_accepted'].includes(clean(record.deliveryStatus)))
    && !['failed', 'request_failed'].includes(clean(record.deliveryStatus))
);
const acceptedAt = (record) => record.createdAt || (record.timestamp ? new Date(record.timestamp * 1000) : null);
const deliveredAt = (shipment) => shipment?.automation?.deliveredConfirmedAt || shipment?.logistics?.canonicalEvidence?.observedAt;

export const findPostSaleEvidenceV147R6 = async ({ shipment, event, messageModel = Message, shipmentModel = Shipment } = {}) => {
    if (!event || (!pickupPostSaleStageV147R6R2(event.stage) && !servientregaPostSaleCompletionEligibleV147(shipment))) return [];
    const recipient = phone(shipment.client?.phone);
    if (!recipient) return [];
    const tail = recipient.slice(-9);
    const rows = await messageModel.find({ isFromMe: true, $or: [
        { 'postSaleEvent.dedupeKey': event.dedupeKey },
        { peerPhone: { $regex: tail + '$' } }, { to: { $regex: tail + '(?:@|$)' } }
    ] }).sort({ createdAt: -1, timestamp: -1 }).lean();
    let nextOrderAt = null;
    if (shipment.createdAt && (shipmentModel !== Shipment || Shipment.db.readyState === 1)) {
        const next = await shipmentModel.findOne({ country: 'EC', _id: { $ne: shipment._id },
            'client.phone': { $regex: tail + '$' }, createdAt: { $gt: shipment.createdAt } }).sort({ createdAt: 1 }).lean();
        nextOrderAt = next?.createdAt || null;
    }
    const lower = new Date(pickupPostSaleStageV147R6R2(event.stage)
        ? shipment.logistics?.pickupReadyVerifiedAt || shipment.createdAt : deliveredAt(shipment)).getTime();
    const aliases = new Set([event.orderId, clean(shipment.raw?.historicalExternalReconciliation?.dropiOrderId),
        clean(shipment.raw?.latestDroppiPayload?.orderId), clean(shipment.raw?.manualDropiOrderId)].filter(Boolean));
    const found = new Map();
    for (const row of rows) {
        if (!acceptedPostSaleEvidenceV147R6(row)) continue;
        if (row.postSaleEvent?.dedupeKey) {
            if (row.postSaleEvent.dedupeKey !== event.dedupeKey) continue;
        } else {
            if (phone(row.peerPhone || row.to) !== recipient) continue;
            const at = new Date(acceptedAt(row)).getTime();
            if (!Number.isFinite(lower) || !Number.isFinite(at) || at < lower
                || (nextOrderAt && at >= new Date(nextOrderAt).getTime())) continue;
            if (row.orderId && !aliases.has(clean(row.orderId))) continue;
            const content = classifyPostSaleContentV147R6(row);
            if (!content || content.templateId !== event.templateId || content.product !== event.product) continue;
        }
        const previous = found.get(row.providerMessageId);
        if (!previous || Number(row.ack || 0) > Number(previous.ack || 0)) found.set(row.providerMessageId, row);
    }
    return [...found.values()].sort((a, b) => new Date(acceptedAt(a)) - new Date(acceptedAt(b)));
};

export const reconcilePostSaleEventV147R6 = async ({ shipment, event, messageModel = Message, shipmentModel = Shipment, persist = true, now = new Date() } = {}) => {
    const evidence = await findPostSaleEvidenceV147R6({ shipment, event, messageModel, shipmentModel });
    if (!evidence.length) return null;
    const chosen = evidence[0];
    const manual = chosen.isBot !== true && chosen.senderRole !== 'bot';
    const ledgerPath = 'automation.postSaleSafetyLedger.' + event.stage;
    const prior = shipment.automation?.postSaleSafetyLedger?.[event.stage];
    const primary = prior?.state === 'SENT' && prior.providerMessageId
        ? evidence.find((row) => row.providerMessageId === prior.providerMessageId) || chosen : chosen;
    const state = prior?.state === 'SENT' ? 'SENT' : manual
        ? (event.stage === 'PICKUP_BONUS' || pickupPostSaleStageV147R6R2(event.stage) && !chosen.postSaleEvent?.dedupeKey
            ? 'SATISFIED_BY_EXISTING_MANUAL_SEND' : 'SATISFIED_BY_MANUAL_SEND')
        : 'RECOVERED_STRUCTURED';
    if (persist) {
        const priorEntries = [...(prior?.priorEntries || [])];
        if (prior && !prior.canonicalEvent) { const copy = { ...prior }; delete copy.priorEntries; priorEntries.push(copy); }
        const entry = { ...prior, ...event, state, idempotencyKey: event.dedupeKey,
            resolution: manual ? 'SATISFIED_BY_MANUAL_SEND' : 'SATISFIED_BY_EXISTING_AUTOMATION_SEND',
            source: primary.isBot === true || primary.senderRole === 'bot' ? 'v116' : 'manual_panel',
            providerMessageId: prior?.state === 'SENT' ? prior.providerMessageId : chosen.providerMessageId,
            acceptedAt: prior?.acceptedAt || acceptedAt(primary), reconciledAt: now,
            evidence: evidence.map((row) => ({ messageId: row._id, providerMessageId: row.providerMessageId,
                acceptedAt: acceptedAt(row), source: row.isBot === true ? 'v116' : 'manual_panel' })),
            duplicateIncidentCount: Math.max(Number(prior?.duplicateIncidentCount || 0), evidence.length - 1), priorEntries };
        // Compare-and-swap: never overwrite a reservation/finalization from a concurrent sender.
        const expected = prior ? { [ledgerPath]: prior } : { [ledgerPath]: { $exists: false } };
        const markers = legacyMarkerSetForStage(event.stage, acceptedAt(chosen));
        for (const key of Object.keys(markers)) if (shipment.automation?.[key.split('.').at(-1)]) delete markers[key];
        const result = await shipmentModel.updateOne({ _id: shipment._id, ...expected }, { $set: { ...markers, [ledgerPath]: entry } });
        if (result.matchedCount !== 1) return { decision: 'NOT_ELIGIBLE', reason: 'canonical_event_changed_recheck', stage: event.stage };
    }
    return { decision: manual ? 'ALREADY_NOTIFIED_MANUALLY' : 'ALREADY_NOTIFIED_STRUCTURED',
        reason: state, stage: event.stage, idempotencyKey: event.dedupeKey, providerMessageId: chosen.providerMessageId, satisfied: true };
};

export const reservePostSaleEventV147R6 = async ({ shipment, event, source = 'v116', operator = '', shipmentModel = Shipment, now = new Date(), lockMs = 600000 } = {}) => {
    const ledgerPath = 'automation.postSaleSafetyLedger.' + event.stage;
    const lockPath = 'automation.notificationLocks.' + event.stage;
    const token = crypto.randomUUID();
    const markerAbsent = Object.keys(legacyMarkerSetForStage(event.stage)).map((key) => ({ [key]: null }));
    const locked = await shipmentModel.findOneAndUpdate({ _id: shipment._id, $and: [
        ...markerAbsent, { [ledgerPath + '.state']: { $nin: [...POST_SALE_TERMINAL_LEDGER_STATES, 'INTENDED'] } },
        { $or: [{ [lockPath]: null }, { [lockPath + '.until']: { $lte: now } }] }
    ] }, { $set: {
        [lockPath]: { token, until: new Date(now.getTime() + lockMs), acquiredAt: now, idempotencyKey: event.dedupeKey },
        [ledgerPath]: { ...event, state: 'INTENDED', source, operator, idempotencyKey: event.dedupeKey,
            attemptedAt: now, decidedAt: now, providerMessageId: '', dataCompatibilityVersion: 116 }
    } }, { new: true });
    return locked ? { decision: 'SHOULD_SEND', reason: 'canonical_event_intended', stage: event.stage,
        idempotencyKey: event.dedupeKey, lockToken: token, canonicalEvent: event }
        : { decision: 'NOT_ELIGIBLE', reason: 'canonical_event_reserved_or_terminal', stage: event.stage };
};

export const finalizePostSaleEventV147R6 = async ({ shipment, stage, lockToken, providerMessageId = '',
    shipmentModel = Shipment, now = new Date(), failure = null } = {}) => {
    const ledgerPath = 'automation.postSaleSafetyLedger.' + stage;
    const lockPath = 'automation.notificationLocks.' + stage;
    const accepted = !failure && clean(providerMessageId);
    const set = { [lockPath]: null, [ledgerPath + '.state']: accepted ? 'SENT'
        : failure?.terminalState === 'FAILED_FINAL' ? 'FAILED_FINAL' : 'AMBIGUOUS',
    [ledgerPath + '.finalizedAt']: now, [ledgerPath + '.providerMessageId']: clean(providerMessageId),
    [ledgerPath + '.reason']: accepted ? 'provider_accepted_after_canonical_reservation' : clean(failure?.reason || 'ambiguous_no_blind_retry') };
    if (accepted) Object.assign(set, legacyMarkerSetForStage(stage, now), { [ledgerPath + '.acceptedAt']: now });
    const result = await shipmentModel.updateOne({ _id: shipment._id, [lockPath + '.token']: lockToken,
        [ledgerPath + '.state']: 'INTENDED' }, { $set: set });
    return { completed: Boolean(accepted && result.modifiedCount === 1), released: result.modifiedCount === 1,
        terminal: !accepted, reason: accepted ? 'stage_finalized' : 'terminal_failure_recorded_no_retry', stage };
};

export const reconcileDeliveredPostSaleSequenceV147R6 = async (shipment, { persist = true, shipmentModel = Shipment, messageModel = Message } = {}) => {
    if (!shipment?._id || !servientregaPostSaleCompletionEligibleV147(shipment)
        || (shipmentModel === Shipment && Shipment.db.readyState !== 1)) return shipment;
    let current = await shipmentModel.findById(shipment._id).lean();
    for (const stage of ['DELIVERED_THANK_YOU', 'PICKUP_BONUS', 'PRODUCT_USAGE']) {
        const event = await resolvePostSaleEventV147R6({ shipment: current, stage });
        if (event) await reconcilePostSaleEventV147R6({ shipment: current, event, shipmentModel, messageModel, persist });
        if (persist) current = await shipmentModel.findById(shipment._id).lean();
    }
    return current;
};

// Reuses the R6 ledger/history; no scheduler, polling or provider access.
export const reconcilePickupPostSaleSequenceV147R6R2 = async (shipment, { persist = true, shipmentModel = Shipment, messageModel = Message } = {}) => {
    if (!shipment?._id || (shipmentModel === Shipment && Shipment.db.readyState !== 1)) return shipment;
    let current = await shipmentModel.findById(shipment._id).lean();
    for (const stage of Object.keys(pickupStageEvents)) {
        const event = await resolvePostSaleEventV147R6({ shipment: current, stage });
        if (event) await reconcilePostSaleEventV147R6({ shipment: current, event, shipmentModel, messageModel, persist });
        if (persist) current = await shipmentModel.findById(shipment._id).lean();
    }
    return current;
};

export const pickupEventEligibleV147R6R2 = (shipment, stage, now = new Date()) => {
    if (!pickupPostSaleStageV147R6R2(stage)) return true;
    const projection = canonicalLogisticsProjectionForShipmentV147(shipment);
    if (projection.canonicalStatus !== 'READY_FOR_PICKUP' || !projection.canPickup
        || !shipment?.logistics?.pickupReadyVerified || shipment.logistics.pickupReadyVerifiedSource !== 'carrier_tracking'
        || !shipment.logistics.agencyPickup || shipment.outcomes?.delivered || shipment.outcomes?.pickedUp
        || shipment.outcomes?.returned || shipment.outcomes?.prepaidOnly) return false;
    if (stage === 'READY_FOR_PICKUP') return true;
    const accepted = shipment.automation?.postSaleSafetyLedger?.READY_FOR_PICKUP?.acceptedAt
        || shipment.automation?.readyForPickupNotifiedAt;
    if (!accepted || !Number.isFinite(new Date(accepted).getTime())) return false;
    const hours = stage === 'PICKUP_REMINDER_DAY3' ? 72 : 120;
    return now.getTime() >= new Date(accepted).getTime() + hours * 3600000;
};

// Recheck the stored carrier state at the last application boundary before transport.
// A stale reservation can never authorize a queued pickup audio after DELIVERED.
export const guardReservedPickupEventV147R6R2 = async ({ shipment, event, lockToken, shipmentModel = Shipment, now = new Date() } = {}) => {
    if (!pickupPostSaleStageV147R6R2(event?.stage)) return true;
    const current = await shipmentModel.findById(shipment._id).lean();
    const ledgerPath = 'automation.postSaleSafetyLedger.' + event.stage;
    const lockPath = 'automation.notificationLocks.' + event.stage;
    const lock = current?.automation?.notificationLocks?.[event.stage];
    const entry = current?.automation?.postSaleSafetyLedger?.[event.stage];
    if (entry?.state !== 'INTENDED' || entry.dedupeKey !== event.dedupeKey) return false;
    if (pickupEventEligibleV147R6R2(current, event.stage, now)) return lock?.token === lockToken;
    await shipmentModel.updateOne({ _id: shipment._id, [ledgerPath]: entry },
        { $set: { [lockPath]: null, [ledgerPath + '.state']: 'FAILED_FINAL',
            [ledgerPath + '.resolution']: 'CANCELLED_PICKUP_NO_LONGER_ELIGIBLE',
            [ledgerPath + '.reason']: 'stale_pickup_event_cancelled_before_provider', [ledgerPath + '.finalizedAt']: now } });
    return false;
};
