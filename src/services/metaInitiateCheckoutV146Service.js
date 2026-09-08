import ContactState from '../models/ContactState.js';
import VslVisit from '../models/VslVisit.js';
import { sendBrowserMetaEvent } from './metaConversionsService.js';

const clean = (value = '') => String(value ?? '').trim();
const digitsOnly = (value = '') => clean(value).replace(/\D/g, '');

const INITIATE_CHECKOUT_INTENTS = new Set([
    'initiate_checkout',
    'checkout_started',
    'order_draft_started',
    'public_order_form_started'
]);

export const initiateCheckoutBusinessActionV146 = (body = {}) => {
    const intent = clean(body.intent || body.action).toLowerCase();
    const explicit = body.initiateCheckout === true
        || body.initiate_checkout === true
        || body.checkoutStarted === true
        || body.checkout_started === true
        || INITIATE_CHECKOUT_INTENTS.has(intent);
    const whatsappOnly = ['whatsapp_click', 'whatsapp_open', 'lead_click'].includes(intent);
    return Object.freeze({
        occurred: Boolean(explicit && !whatsappOnly),
        intent,
        reason: explicit && !whatsappOnly
            ? 'real_checkout_process_started'
            : (whatsappOnly ? 'generic_whatsapp_contact' : 'no_checkout_business_action')
    });
};

export const initiateCheckoutEventIdV146 = ({ visitorKey = '', orderId = '', cycleId = '' } = {}) => {
    const identity = clean(orderId || cycleId || visitorKey);
    return identity ? `InitiateCheckout:${identity}` : '';
};

export const initiateCheckoutFactsV146 = ({ occurred = false, sent = false, accepted = false, eventId = '', at = null } = {}) => ({
    version: 146,
    occurred: Boolean(occurred),
    occurredAt: occurred ? (at || new Date()) : null,
    sent: Boolean(sent),
    sentAt: sent ? (at || new Date()) : null,
    accepted: Boolean(accepted),
    acceptedAt: accepted ? (at || new Date()) : null,
    eventId: clean(eventId)
});

const receivedEvents = (result = {}) => Number(
    result?.response?.events_received
    ?? result?.response?.data?.events_received
    ?? 0
);

const safeMetaResponse = (result = {}) => ({
    ok: Boolean(result.ok),
    status: Number(result.status || 0) || null,
    events_received: receivedEvents(result),
    eventId: clean(result.eventId),
    datasetRoute: clean(result.datasetRoute),
    error: clean(result.error)
});

export const sendInitiateCheckoutForPendingOrderV146 = async ({
    contactStateId,
    agentKey = '',
    parsedOrder = {},
    orderId = '',
    now = new Date(),
    models = { ContactState, VslVisit },
    sendEvent = sendBrowserMetaEvent
} = {}) => {
    const quantity = Number(parsedOrder.quantity || 0);
    if (!contactStateId || ![1, 2, 3, 6].includes(quantity)) {
        return { ok: false, skipped: true, reason: 'no_valid_pending_order_business_action' };
    }

    const state = await models.ContactState.findById(contactStateId).lean().catch(() => null);
    if (!state) return { ok: false, skipped: true, reason: 'contact_state_not_found' };
    const previousFacts = state.metadata?.metaInitiateCheckoutV146 || {};
    if (previousFacts.sentAt) {
        return { ok: true, skipped: true, alreadySent: true, reason: 'already_sent', eventId: previousFacts.eventId || '' };
    }

    const visitorId = clean(state.metadata?.vslVisitId);
    const visit = visitorId
        ? await models.VslVisit.findById(visitorId).lean().catch(() => null)
        : null;
    const cycleIdentity = clean(
        orderId
        || state.metadata?.customerDraft?.currentNegotiationOrderId
        || state.metadata?.customerDraft?.orderId
        || state.metadata?.customerDraft?.previousOrderId
        || `${contactStateId}:${agentKey || 'ec'}`
    );
    const eventId = clean(previousFacts.eventId) || initiateCheckoutEventIdV146({ cycleId: cycleIdentity });
    const occurredAt = previousFacts.occurredAt || now;

    if (!visit) {
        await models.ContactState.updateOne(
            { _id: contactStateId, 'metadata.metaInitiateCheckoutV146.sentAt': { $exists: false } },
            { $set: {
                'metadata.metaInitiateCheckoutV146': {
                    version: 146,
                    occurred: true,
                    occurredAt,
                    sent: false,
                    accepted: false,
                    eventId,
                    skippedReason: 'vsl_attribution_not_found'
                }
            } }
        );
        return { ok: false, skipped: true, reason: 'vsl_attribution_not_found', eventId };
    }

    const lockUntil = new Date(now.getTime() + 60_000);
    const claimed = await models.ContactState.findOneAndUpdate(
        {
            _id: contactStateId,
            $and: [
                { $or: [
                    { 'metadata.metaInitiateCheckoutV146.sentAt': { $exists: false } },
                    { 'metadata.metaInitiateCheckoutV146.sentAt': null }
                ] },
                { $or: [
                    { 'metadata.metaInitiateCheckoutV146.lockUntil': { $exists: false } },
                    { 'metadata.metaInitiateCheckoutV146.lockUntil': { $lte: now } }
                ] }
            ]
        },
        { $set: {
            'metadata.metaInitiateCheckoutV146.version': 146,
            'metadata.metaInitiateCheckoutV146.occurred': true,
            'metadata.metaInitiateCheckoutV146.occurredAt': occurredAt,
            'metadata.metaInitiateCheckoutV146.sent': false,
            'metadata.metaInitiateCheckoutV146.accepted': false,
            'metadata.metaInitiateCheckoutV146.eventId': eventId,
            'metadata.metaInitiateCheckoutV146.lockUntil': lockUntil
        } },
        { new: true }
    ).lean().catch(() => null);
    if (!claimed) return { ok: false, skipped: true, reason: 'dedupe_lock_active', eventId };

    const tracking = visit.tracking || state.metadata?.tracking || {};
    const draft = state.metadata?.customerDraft || {};
    const value = Number(parsedOrder.total || draft.total || 0);
    const result = await sendEvent({
        country: 'EC',
        eventName: 'InitiateCheckout',
        event_id: eventId,
        event_source_url: visit.sourceUrl || tracking.sourceUrl || state.metadata?.vslSourceUrl,
        client_user_agent: visit.userAgent || tracking.userAgent,
        fbc: tracking.fbc,
        fbp: tracking.fbp,
        external_id: tracking.external_id || visit.externalId || visit.visitorId,
        name: parsedOrder.name || draft.name || visit.customerName,
        phone: digitsOnly(parsedOrder.phone || draft.phone || state.phoneDigits || visit.customerPhone),
        city: parsedOrder.city || draft.city,
        province: parsedOrder.province || draft.province,
        content_name: parsedOrder.product || draft.productName || visit.productName || 'Vit Power Ecuador',
        content_ids: [draft.productKey || visit.productKey || 'vit_power_ec'],
        content_type: 'product',
        value: Number.isFinite(value) && value > 0 ? value : undefined,
        currency: 'USD'
    });
    const accepted = Boolean(result.ok && receivedEvents(result) > 0);
    const response = safeMetaResponse(result);
    const set = {
        'metadata.metaInitiateCheckoutV146.sent': Boolean(result.ok),
        'metadata.metaInitiateCheckoutV146.accepted': accepted,
        'metadata.metaInitiateCheckoutV146.response': response,
        'metadata.metaInitiateCheckoutV146.lastAttemptAt': now
    };
    if (result.ok) set['metadata.metaInitiateCheckoutV146.sentAt'] = now;
    if (accepted) set['metadata.metaInitiateCheckoutV146.acceptedAt'] = now;
    await models.ContactState.updateOne(
        { _id: contactStateId, 'metadata.metaInitiateCheckoutV146.eventId': eventId },
        {
            $set: set,
            $unset: { 'metadata.metaInitiateCheckoutV146.lockUntil': '' }
        }
    );
    await models.VslVisit.updateOne(
        { _id: visit._id },
        {
            $set: {
                metaInitiateCheckoutEventId: eventId,
                metaInitiateCheckoutOccurredAt: occurredAt,
                metaInitiateCheckoutResponse: response,
                ...(result.ok ? { metaInitiateCheckoutSentAt: now } : {}),
                ...(accepted ? { metaInitiateCheckoutAcceptedAt: now } : {})
            }
        }
    );
    return { ...result, accepted, eventId, eventsReceived: receivedEvents(result) };
};

export default initiateCheckoutBusinessActionV146;
