import crypto from 'node:crypto';
import fs from 'node:fs';
import Shipment from '../models/Shipment.js';
import Message from '../models/Message.js';
import { buildReadyForPickupCommunicationV29 } from './logisticsCommunicationV29.js';
import { buildPostSaleDedupeKeyV147 } from './canonicalLogisticsStatusV147Service.js';
import { resolvePostSaleEventV147R6, findPostSaleEvidenceV147R6, classifyPostSaleContentV147R6,
    pickupEventEligibleV147R6R2 } from './postSaleUnifiedEventV147R6Service.js';

const root = 'automation.postSaleSafetyLedger.READY_FOR_PICKUP';
const lockPath = 'automation.notificationLocks.READY_FOR_PICKUP';
const clean = (s) => String(s ?? '').trim().replace(/\r\n/g, '\n');
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const accepted = (entry) => Boolean(entry?.providerMessageId && entry.acceptedAt
    && ['SENT', 'SATISFIED_BY_MANUAL_SEND', 'SATISFIED_BY_EXISTING_MANUAL_SEND', 'RECOVERED_STRUCTURED'].includes(entry.state));
const blocked = (entry) => ['INTENDED', 'AMBIGUOUS', 'FAILED_FINAL', 'CANCELLED'].includes(entry?.state);
const date = (row) => row.createdAt || (row.timestamp ? new Date(row.timestamp * 1000) : null);
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const a07PlanV147R6R2 = async (shipment) => {
    const parent = await resolvePostSaleEventV147R6({ shipment, stage: 'READY_FOR_PICKUP' });
    if (!parent) return null;
    const guide = shipment.logistics?.invoicePath && fs.existsSync(shipment.logistics.invoicePath)
        ? shipment.logistics.invoicePath : shipment.logistics?.invoiceUrl || '';
    const text = buildReadyForPickupCommunicationV29(shipment);
    const components = ['TEXT', ...(guide ? ['GUIDE_PDF'] : []), 'AUDIO'].map((component) => {
        const guideIdentity = component === 'GUIDE_PDF' ? clean(shipment.logistics?.trackingNumber) : '';
        const event = { ...parent, parentDedupeKey: parent.dedupeKey, component, guideIdentity,
            ...(component === 'GUIDE_PDF' ? { mediaSource: guide } : {}) };
        event.dedupeKey = buildPostSaleDedupeKeyV147({ ...parent,
            templateId: component === 'AUDIO' ? 'AUDIO|A07' : component === 'GUIDE_PDF' ? 'GUIDE_PDF|' + guideIdentity : 'TEXT' });
        return event;
    });
    return { parent, text, guide, components };
};

export const classifyA07ComponentV147R6R2 = (record, shipment, plan) => {
    const media = clean(record.mediaUrl || record.mediaPath || (record.isMedia ? record.message : ''));
    if (media) {
        if (classifyPostSaleContentV147R6(record)?.canonicalEvent === 'A07') return 'AUDIO';
        const sources = [shipment.logistics?.invoicePath, shipment.logistics?.invoiceUrl].filter(Boolean).map(clean);
        if (plan.guide && sources.includes(media)) return 'GUIDE_PDF';
        if (plan.guide && fs.existsSync(plan.guide)) {
            let digest = clean(record.mediaSha256);
            if (media.startsWith('data:application/pdf;') && media.includes(';base64,')) digest = sha(Buffer.from(media.split(';base64,')[1], 'base64'));
            if (digest && digest === sha(fs.readFileSync(plan.guide))) return 'GUIDE_PDF';
        }
        return '';
    }
    return clean(record.body ?? record.message) === clean(plan.text) ? 'TEXT' : '';
};

// All component evidence uses the same R6 recipient/order window and provider-acceptance proof.
export const inspectA07V147R6R2 = async ({ shipment, component = '', shipmentModel = Shipment, messageModel = Message, persist = false } = {}) => {
    const plan = await a07PlanV147R6R2(shipment);
    if (!plan) return { decision: 'NOT_ELIGIBLE', reason: 'canonical_identity_missing' };
    const prior = shipment.automation?.postSaleSafetyLedger?.READY_FOR_PICKUP;
    const components = { ...(prior?.components || {}) };
    for (const event of plan.components) {
        const evidence = await findPostSaleEvidenceV147R6({ shipment, event, shipmentModel, messageModel,
            matchesRecord: (row) => classifyA07ComponentV147R6R2(row, shipment, plan) === event.component });
        if (!evidence.length) continue;
        const old = components[event.component];
        if (old?.dedupeKey && old.dedupeKey !== event.dedupeKey) continue;
        // The sender holding the live shared lock owns finalization. After a crash,
        // only accepted history (never lock expiry alone) can recover INTENDED.
        const activeLock = shipment.automation?.notificationLocks?.READY_FOR_PICKUP;
        if (old?.state === 'INTENDED' && activeLock?.component === event.component
            && new Date(activeLock.until).getTime() > Date.now()) continue;
        const chosen = evidence.find((row) => row.providerMessageId === old?.providerMessageId) || evidence[0];
        const manual = chosen.isBot !== true && chosen.senderRole !== 'bot';
        components[event.component] = { ...old, ...event,
            state: accepted(old) ? old.state : manual ? 'SATISFIED_BY_EXISTING_MANUAL_SEND' : 'RECOVERED_STRUCTURED',
            providerMessageId: chosen.providerMessageId, acceptedAt: old?.acceptedAt || date(chosen),
            source: manual ? 'manual_panel' : 'v116',
            evidence: evidence.map((row) => ({ messageId: row._id, providerMessageId: row.providerMessageId, acceptedAt: date(row) })),
            duplicateIncidentCount: Math.max(old?.duplicateIncidentCount || 0, evidence.length - 1) };
    }
    const all = plan.components.every((event) => accepted(components[event.component]));
    const hasEvidence = Object.values(components).some(accepted);
    const legacyBlocked = !prior?.components && !hasEvidence && Boolean(shipment.automation?.readyForPickupNotifiedAt
        || prior && ['SENT', 'INTENDED', 'AMBIGUOUS', 'FAILED_FINAL', 'SUPPRESSED_HISTORICAL', 'RECOVERED_MANUAL', 'RECOVERED_STRUCTURED'].includes(prior.state));
    const parent = { ...prior, ...plan.parent, reservationId: prior?.reservationId || crypto.randomUUID(), reservationCount: 1,
        components, state: all ? 'SENT' : 'PARTIAL',
        acceptedAt: prior?.acceptedAt || components.TEXT?.acceptedAt || null,
        priorEntries: prior?.components ? prior.priorEntries || [] : prior ? [prior] : [] };
    if (persist && !legacyBlocked && (hasEvidence || prior?.components)) {
        const result = await shipmentModel.updateOne({ _id: shipment._id, [root]: prior ?? { $exists: false } },
            { $set: { [root]: parent, ...(all ? { 'automation.readyForPickupNotifiedAt': parent.acceptedAt } : {}) } });
        if (result.matchedCount !== 1) return { decision: 'NOT_ELIGIBLE', reason: 'a07_changed_recheck', plan };
    }
    const selected = component ? plan.components.find((e) => e.component === component)
        : plan.components.find((e) => !accepted(components[e.component]));
    const entry = selected && components[selected.component];
    if (component && !selected) return { plan, parent, decision: 'NOT_ELIGIBLE', reason: 'a07_optional_component_unavailable', stage: 'READY_FOR_PICKUP' };
    const satisfied = component ? accepted(entry) : all;
    return { plan, parent, selected, satisfied, legacyBlocked,
        decision: satisfied ? 'ALREADY_NOTIFIED_MANUALLY' : legacyBlocked ? 'ALREADY_NOTIFIED_STRUCTURED' : blocked(entry) ? 'NOT_ELIGIBLE' : 'SHOULD_SEND',
        reason: satisfied ? 'a07_components_satisfied' : legacyBlocked ? 'a07_legacy_terminal_preserved'
            : blocked(entry) ? 'a07_component_requires_reconciliation' : 'a07_missing_component',
        providerMessageId: satisfied && component ? entry.providerMessageId : '', stage: 'READY_FOR_PICKUP' };
};

export const reserveA07ComponentV147R6R2 = async ({ shipment, component, source = 'v116', operator = '', shipmentModel = Shipment, messageModel = Message } = {}) => {
    for (let attempt = 0; attempt < 200; attempt += 1) {
        const current = await shipmentModel.findById(shipment._id).lean();
        const view = await inspectA07V147R6R2({ shipment: current, component, shipmentModel, messageModel, persist: true });
        if (view.reason === 'a07_changed_recheck') continue;
        if (view.decision !== 'SHOULD_SEND' || !view.selected) return view;
        if (!pickupEventEligibleV147R6R2(current, 'READY_FOR_PICKUP')) return { decision: 'NOT_ELIGIBLE', reason: 'a07_no_longer_ready' };
        const prior = current.automation?.postSaleSafetyLedger?.READY_FOR_PICKUP;
        if (!prior?.components) {
            await shipmentModel.updateOne({ _id: current._id, [root]: prior ?? { $exists: false } }, { $set: { [root]: view.parent } });
            continue;
        }
        const event = view.selected; const token = crypto.randomUUID(); const now = new Date();
        const componentPath = root + '.components.' + event.component;
        const result = await shipmentModel.findOneAndUpdate({ _id: current._id,
            'logistics.canonicalStatus': 'READY_FOR_PICKUP', 'outcomes.delivered': { $ne: true }, 'outcomes.pickedUp': { $ne: true },
            [componentPath + '.state']: { $nin: ['SENT', 'SATISFIED_BY_MANUAL_SEND', 'SATISFIED_BY_EXISTING_MANUAL_SEND', 'RECOVERED_STRUCTURED', 'INTENDED', 'AMBIGUOUS', 'FAILED_FINAL', 'CANCELLED'] },
            $or: [{ [lockPath]: null }, { [lockPath + '.until']: { $lte: now } }]
        }, { $set: { [lockPath]: { token, component: event.component, idempotencyKey: view.plan.parent.dedupeKey, until: new Date(now.getTime() + 600000) },
            [componentPath]: { ...event, state: 'INTENDED', attemptedAt: now, source, operator }, [root + '.state']: 'PARTIAL' } }, { new: true });
        if (result) return { decision: 'SHOULD_SEND', reason: 'a07_component_reserved', stage: 'READY_FOR_PICKUP',
            canonicalEvent: event, idempotencyKey: event.dedupeKey, lockToken: token };
        await pause(50);
    }
    return { decision: 'NOT_ELIGIBLE', reason: 'a07_shared_lock_busy' };
};

export const guardA07ComponentV147R6R2 = async ({ shipment, event, lockToken, shipmentModel = Shipment } = {}) => {
    const current = await shipmentModel.findById(shipment._id).lean();
    const entry = current?.automation?.postSaleSafetyLedger?.READY_FOR_PICKUP?.components?.[event.component];
    const lock = current?.automation?.notificationLocks?.READY_FOR_PICKUP;
    if (entry?.state !== 'INTENDED' || entry.dedupeKey !== event.dedupeKey || lock?.token !== lockToken) return false;
    if (pickupEventEligibleV147R6R2(current, 'READY_FOR_PICKUP')) return true;
    await finalizeA07ComponentV147R6R2({ shipment, event, lockToken, shipmentModel, failure: 'CANCELLED' });
    return false;
};

export const finalizeA07ComponentV147R6R2 = async ({ shipment, event, lockToken, result = null, failure = '', shipmentModel = Shipment } = {}) => {
    const at = new Date(); const componentPath = root + '.components.' + event.component;
    const ok = !failure && result?.ok === true && Boolean(result.providerMessageId);
    const set = { [lockPath]: null, [componentPath + '.state']: ok ? 'SENT' : failure || 'AMBIGUOUS',
        [componentPath + '.finalizedAt']: at };
    if (ok) Object.assign(set, { [componentPath + '.providerMessageId']: result.providerMessageId, [componentPath + '.acceptedAt']: at });
    const done = await shipmentModel.updateOne({ _id: shipment._id, [lockPath + '.token']: lockToken,
        [componentPath + '.state']: 'INTENDED' }, { $set: set });
    return { completed: ok && done.modifiedCount === 1 };
};

export const reconcileA07ShipmentV147R6R2 = async (shipment, { shipmentModel = Shipment, messageModel = Message } = {}) => {
    if (!shipment?._id || shipmentModel === Shipment && Shipment.db.readyState !== 1) return shipment;
    for (let i = 0; i < 3; i += 1) {
        const current = await shipmentModel.findById(shipment._id).lean();
        const view = await inspectA07V147R6R2({ shipment: current, shipmentModel, messageModel, persist: true });
        if (view.reason !== 'a07_changed_recheck') break;
    }
    return shipmentModel.findById(shipment._id);
};
