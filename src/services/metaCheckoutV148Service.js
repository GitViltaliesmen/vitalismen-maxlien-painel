import { PROTOCOLO_G_EVENT_SOURCE_URL } from './metaProtocoloGAttributionService.js';
import crypto from 'node:crypto';
import ContactState from '../models/ContactState.js';
import Message from '../models/Message.js';
import VslVisit from '../models/VslVisit.js';
import MetaBusinessEvent from '../models/MetaBusinessEvent.js';
import { sendBrowserMetaEvent } from './metaConversionsService.js';
import { metaV148ActivationAt, metaV148AttributionHash, salesAttributionV148, withMetaCheckoutV148, withMetaLedgerV148 } from './metaFunnelV148ContractService.js';

const digits = value => String(value || '').replace(/\D/g, '');
const hash = value => crypto.createHash('sha256').update(String(value)).digest('hex');
const clean = value => String(value || '').trim();

export const checkoutCycleV148 = (state = {}) => {
    const draft = state.metadata?.customerDraft || {};
    const current = clean(draft.currentNegotiationOrderId || draft.orderId);
    if (current && current !== clean(draft.previousOrderId)) return current;
    if (draft.previousOrderId || /repurchase|repeat_purchase/.test(draft.entryReason || '')) return '';
    return state._id ? `first:${state._id}` : '';
};

export const checkoutEventIdV148 = (contactStateId, cycleIdentity) => (
    contactStateId && cycleIdentity ? `InitiateCheckout:${hash(`EC|${contactStateId}|${cycleIdentity}`)}` : ''
);

export const recordTexUltraCheckoutV148 = async ({
    contactStateId, sourceMessageId, quantity, previousQuantity = 0,
    activationAt = metaV148ActivationAt(), now = new Date(),
    models = { ContactState, Message, VslVisit, MetaBusinessEvent }, sendEvent = sendBrowserMetaEvent
} = {}) => {
    const skip = reason => ({ ok: false, skipped: true, reason });
    if (!activationAt || !sourceMessageId || ![1, 2, 3, 6].includes(Number(quantity))) return skip('no_forward_checkout_business_action');
    if (Number(previousQuantity) > 0) return skip('checkout_quantity_already_selected');
    const state = await models.ContactState.findById(contactStateId).lean();
    const phone = digits(state?.phoneDigits || state?.chatId);
    if (!state || state.countryCode !== 'EC' || !/^593\d{9}$/.test(phone)) return skip('invalid_ec_customer');
    const draft = state.metadata?.customerDraft || {};
    if (draft.productKey !== 'tex_ultra_ec' || Number(draft.quantity) !== Number(quantity)) return skip('business_state_not_persisted');
    const message = await models.Message.findOne({ isFromMe: false, $or: [{ _id: sourceMessageId }, { providerMessageId: sourceMessageId }] }).lean();
    const messagePhone = digits(message?.peerPhone || message?.from || message?.chatId);
    const providerTime = Number(message?.timestamp);
    const occurredAt = new Date(providerTime > 1e11 ? providerTime : providerTime * 1000);
    const persistedAt = new Date(message?.createdAt || 0);
    if (!message || !providerTime || messagePhone !== phone || persistedAt < new Date(activationAt) || occurredAt < new Date(activationAt) || occurredAt > now
        || !Number.isFinite(occurredAt.getTime())) return skip('inbound_business_evidence_not_forward_or_not_owned');
    const cycleIdentity = checkoutCycleV148(state);
    if (!cycleIdentity) return skip('repurchase_requires_current_canonical_cycle');
    const eventId = checkoutEventIdV148(String(contactStateId), cycleIdentity);
    let visit = null;
    if (state.metadata?.vslVisitId) visit = await models.VslVisit.findById(state.metadata.vslVisitId).lean();
    if (draft.previousOrderId && visit && (new Date(visit.lastClickAt || 0) < new Date(activationAt)
        || (visit.metaInitiateCheckoutEventId && visit.metaInitiateCheckoutEventId !== eventId))) visit = null;
    let tracking = {};
    const protocolOrigin = String(state.metadata?.vslSourceUrl || state.metadata?.tracking?.sourceUrl || '').startsWith(PROTOCOLO_G_EVENT_SOURCE_URL)
        || state.metadata?.tracking?.funnel === 'PROTOCOLO_G';
    if (visit) {
        const clickedAt = new Date(visit.lastClickAt || 0);
        if (!salesAttributionV148(visit) || digits(visit.customerPhone) !== phone || !visit.attributionClaimedAt
            || clickedAt < new Date(activationAt) || clickedAt > occurredAt) return skip('sales_visit_not_bound_to_forward_customer_cycle');
        tracking = state.metadata?.tracking || {};
        if (!salesAttributionV148(tracking) || String(tracking.external_id) !== String(visit.externalId || visit.visitorId)) return skip('canonical_claim_context_mismatch');
    } else if (protocolOrigin && !draft.previousOrderId) return skip('sales_branch_attribution_not_bound');
    tracking = { ...tracking, measurementVersion: 148 };

    const event = {
        country: 'EC', eventName: 'InitiateCheckout', event_id: eventId, event_time: occurredAt,
        measurementVersion: 148, action_source: 'chat',
        client_user_agent: visit?.userAgent || tracking.userAgent,
        campaign_id: tracking.campaign_id, adset_id: tracking.adset_id, ad_id: tracking.ad_id,
        fbclid: tracking.fbclid, placement: tracking.placement,
        fbc: tracking.fbc, fbp: tracking.fbp, external_id: tracking.external_id,
        phone, name: draft.name, city: draft.city, province: draft.province,
        content_name: draft.productName || draft.product, content_ids: [draft.productKey], content_type: 'product',
        currency: 'USD', value: Number(draft.total) > 0 ? Number(draft.total) : undefined
    };
    try {
        await withMetaLedgerV148({ phase: 'checkout', eventId }, () => models.MetaBusinessEvent.create({ _id: eventId, eventName: 'InitiateCheckout', contactStateId: String(contactStateId),
            cycleIdentity, sourceMessageId, visitId: visit?._id || null, occurredAt, activationAt,
            state: 'INTENDED', attemptedAt: now, attributionSha256: metaV148AttributionHash(tracking),
            customerPhoneSha256: hash(phone), requestSha256: hash(JSON.stringify(event)) }));
    } catch (error) {
        if (Number(error?.code) === 11000) return { ok: true, skipped: true, reason: 'canonical_business_event_already_reserved', eventId };
        throw error;
    }
    await models.ContactState.updateOne({ _id: contactStateId }, { $set: {
        'metadata.tracking': { ...tracking, checkoutEventId: eventId }
    } });
    let result;
    try {
        result = await withMetaCheckoutV148({ reserved: true, businessTrigger: 'tex_ultra_explicit_quantity', eventId }, () => sendEvent(event));
    } catch { result = { ok: false, error: 'provider_outcome_ambiguous' }; }
    const received = Number(result?.response?.events_received || 0);
    const httpStatus = Number(result?.status || 0);
    const accepted = result?.ok === true && httpStatus >= 200 && httpStatus < 300 && received > 0;
    const phase = accepted ? 'ACCEPTED' : (httpStatus >= 400 && httpStatus < 500 ? 'REJECTED' : 'AMBIGUOUS');
    const response = { httpStatus, events_received: received, accepted, error: clean(result?.error) };
    await withMetaLedgerV148({ phase: 'checkout', eventId }, () => models.MetaBusinessEvent.updateOne({ _id: eventId, state: 'INTENDED' }, { $set: {
        state: phase, datasetId: clean(result?.datasetId), response, ...(accepted ? { acceptedAt: now } : {})
    } }));
    const facts = { version: 148, occurred: true, occurredAt, eventId, cycleIdentity, sent: accepted, accepted,
        response, ...(accepted ? { sentAt: now, acceptedAt: now } : {}), state: phase };
    await models.ContactState.updateOne({ _id: contactStateId }, { $set: { 'metadata.metaInitiateCheckoutV146': facts } });
    if (visit) await models.VslVisit.updateOne({ _id: visit._id }, { $set: {
        metaInitiateCheckoutEventId: eventId, metaInitiateCheckoutOccurredAt: occurredAt, metaInitiateCheckoutResponse: response,
        ...(accepted ? { metaInitiateCheckoutSentAt: now, metaInitiateCheckoutAcceptedAt: now } : {})
    } });
    return { ok: accepted, accepted, eventId, state: phase, eventsReceived: received, status: httpStatus };
};
