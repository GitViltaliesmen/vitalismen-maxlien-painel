import crypto from 'crypto';
import Message from '../models/Message.js';
import Shipment from '../models/Shipment.js';

export const POST_SALE_NOTIFICATION_DECISIONS = Object.freeze({
    SHOULD_SEND: 'SHOULD_SEND',
    ALREADY_NOTIFIED_STRUCTURED: 'ALREADY_NOTIFIED_STRUCTURED',
    ALREADY_NOTIFIED_MANUALLY: 'ALREADY_NOTIFIED_MANUALLY',
    HISTORICAL_EVENT_SUPPRESSED: 'HISTORICAL_EVENT_SUPPRESSED',
    MANUAL_REVIEW_REQUIRED: 'MANUAL_REVIEW_REQUIRED',
    NOT_ELIGIBLE: 'NOT_ELIGIBLE'
});

const MARKER_BY_KIND = Object.freeze({
    guide: 'guiaNotifiedAt',
    in_transit: 'inTransitNotifiedAt',
    ready_for_pickup: 'readyForPickupNotifiedAt',
    returned: 'returnedNotifiedAt'
});

const EVENT_BY_KIND = Object.freeze({
    guide: ['guia_notified'],
    in_transit: ['in_transit_notified'],
    ready_for_pickup: ['ready_for_pickup_notified', 'ready_for_pickup_recovered_existing_message'],
    returned: ['returned_notified']
});

const clean = (value = '') => String(value || '').trim();
const digitsOnly = (value = '') => clean(value).replace(/\D/g, '');
const statusKey = (value = '') => clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, '_');

const eligibilityForKind = (shipment = {}, kind = '') => {
    const status = statusKey(shipment?.logistics?.status);
    const tracking = digitsOnly(shipment?.logistics?.trackingNumber);
    if (kind === 'guide') {
        return tracking.length >= 6 && !['ENTREGADO', 'DEVUELTO', 'CANCELADO'].includes(status);
    }
    if (kind === 'in_transit') {
        return tracking.length >= 6 && [
            'MERCANCIA_RECOGIDA', 'EN_BODEGA_TRANSPORTADORA', 'EN_DESPACHO',
            'EN_PROCESAMIENTO', 'EN_RUTA', 'EN_REPARTO', 'EN_DISTRIBUCION_A_CLIENTE'
        ].includes(status);
    }
    if (kind === 'ready_for_pickup') {
        return status === 'READY_FOR_PICKUP'
            && shipment?.logistics?.pickupReadyVerified === true
            && shipment?.logistics?.agencyPickup === true
            && tracking.length >= 6;
    }
    if (kind === 'returned') {
        return status === 'DEVUELTO' || shipment?.outcomes?.returned === true;
    }
    return false;
};

const historyMatchesKind = (message = {}, shipment = {}, kind = '') => {
    const body = clean(message?.body).toLowerCase();
    if (!body) return false;
    const tracking = digitsOnly(shipment?.logistics?.trackingNumber);
    const bodyDigits = digitsOnly(body);
    const trackingMentioned = Boolean(tracking && bodyDigits.includes(tracking));
    if (kind === 'guide') return trackingMentioned && /gu[ií]a|servientrega|pedido/.test(body);
    if (kind === 'in_transit') return trackingMentioned && /en ruta|tr[aá]nsito|avanzando|despach/.test(body);
    if (kind === 'ready_for_pickup') {
        return /retir|recoger|agencia|ya puede ir|listo para/.test(body)
            && (trackingMentioned || /servientrega/.test(body));
    }
    if (kind === 'returned') return /devuelt|devoluci[oó]n|no fue retir|pago anticipado/.test(body);
    return false;
};

const messageIdentityClauses = (shipment = {}) => {
    const digits = digitsOnly(shipment?.client?.phone);
    const tails = [...new Set([
        digits,
        digits.length >= 10 ? digits.slice(-10) : '',
        digits.length >= 9 ? digits.slice(-9) : ''
    ].filter((value) => value.length >= 8))];
    return [
        ...(shipment?.orderId ? [{ orderId: shipment.orderId }] : []),
        ...tails.flatMap((tail) => ([
            { peerPhone: { $regex: `${tail}$` } },
            { chatId: { $regex: tail } },
            { to: { $regex: tail } }
        ]))
    ];
};

const structuredShipmentEvidence = (shipment = {}, kind = '') => {
    const marker = MARKER_BY_KIND[kind];
    if (marker && shipment?.automation?.[marker]) return { found: true, source: `automation.${marker}` };
    const eventKinds = new Set(EVENT_BY_KIND[kind] || []);
    const event = (shipment?.events || []).find((item) => eventKinds.has(clean(item?.kind)));
    if (event) return { found: true, source: `event.${event.kind}` };
    const ledger = (shipment?.notificationLedger || []).find((entry) => (
        entry?.sent_at
        && [kind, `shipment_${kind}_text`].includes(clean(entry?.notification_type))
    ));
    if (ledger) return { found: true, source: 'notificationLedger' };
    return { found: false, source: '' };
};

const outboundHistoryDecision = async ({ shipment, kind, messageModel = Message } = {}) => {
    const clauses = messageIdentityClauses(shipment);
    if (!clauses.length) return null;
    const messages = await messageModel.find({
        isFromMe: true,
        $or: clauses
    }).sort({ timestamp: -1, createdAt: -1 }).limit(120).lean().catch(() => []);
    const match = messages.find((message) => historyMatchesKind(message, shipment, kind));
    if (!match) return null;
    const structured = match.isBot === true || clean(match.senderRole) === 'bot';
    return {
        decision: structured
            ? POST_SALE_NOTIFICATION_DECISIONS.ALREADY_NOTIFIED_STRUCTURED
            : POST_SALE_NOTIFICATION_DECISIONS.ALREADY_NOTIFIED_MANUALLY,
        reason: structured ? 'matching_automation_message_history' : 'matching_human_message_history',
        evidence: {
            messageId: clean(match._id),
            at: match.createdAt || (match.timestamp ? new Date(match.timestamp * 1000) : null),
            trackingMatched: digitsOnly(match.body).includes(digitsOnly(shipment?.logistics?.trackingNumber))
        }
    };
};

export const decidePostSaleNotification = async ({
    shipment,
    kind,
    acquireLock = true,
    messageModel = Message,
    shipmentModel = Shipment,
    now = new Date(),
    lockMs = 10 * 60 * 1000
} = {}) => {
    const validKind = Object.prototype.hasOwnProperty.call(MARKER_BY_KIND, kind);
    if (!shipment || !validKind) {
        return { decision: POST_SALE_NOTIFICATION_DECISIONS.NOT_ELIGIBLE, reason: 'missing_shipment_or_invalid_kind' };
    }
    const structured = structuredShipmentEvidence(shipment, kind);
    if (structured.found) {
        return { decision: POST_SALE_NOTIFICATION_DECISIONS.ALREADY_NOTIFIED_STRUCTURED, reason: structured.source };
    }
    const history = await outboundHistoryDecision({ shipment, kind, messageModel });
    if (history) return history;
    if ((shipment?.review?.suppressedNotificationKinds || []).includes(kind)) {
        return { decision: POST_SALE_NOTIFICATION_DECISIONS.HISTORICAL_EVENT_SUPPRESSED, reason: 'historical_stage_suppressed_after_reconciliation' };
    }
    if (shipment?.review?.manualOnly === true) {
        return { decision: POST_SALE_NOTIFICATION_DECISIONS.MANUAL_REVIEW_REQUIRED, reason: shipment?.review?.reviewReason || 'shipment_manual_only' };
    }
    if (!eligibilityForKind(shipment, kind)) {
        return { decision: POST_SALE_NOTIFICATION_DECISIONS.NOT_ELIGIBLE, reason: 'current_logistics_state_not_eligible' };
    }
    if (!acquireLock || !shipment?._id) {
        return { decision: POST_SALE_NOTIFICATION_DECISIONS.SHOULD_SEND, reason: 'eligible_dry_run' };
    }
    const lockPath = `automation.notificationLocks.${kind}`;
    const lockToken = crypto.randomUUID();
    const locked = await shipmentModel.findOneAndUpdate(
        {
            _id: shipment._id,
            $and: [
                {
                    $or: [
                        { [`automation.${MARKER_BY_KIND[kind]}`]: { $exists: false } },
                        { [`automation.${MARKER_BY_KIND[kind]}`]: null }
                    ]
                },
                {
                    $or: [
                        { [lockPath]: { $exists: false } },
                        { [lockPath]: null },
                        { [`${lockPath}.until`]: { $lte: now } }
                    ]
                }
            ]
        },
        {
            $set: {
                [lockPath]: {
                    token: lockToken,
                    until: new Date(now.getTime() + lockMs),
                    acquiredAt: now
                }
            }
        },
        { new: true }
    );
    if (!locked) {
        return { decision: POST_SALE_NOTIFICATION_DECISIONS.NOT_ELIGIBLE, reason: 'persistent_notification_lock_or_marker' };
    }
    return {
        decision: POST_SALE_NOTIFICATION_DECISIONS.SHOULD_SEND,
        reason: 'eligible_and_persistently_locked',
        lockToken
    };
};

export const shouldSendPostSaleNotification = (result = {}) => (
    result?.decision === POST_SALE_NOTIFICATION_DECISIONS.SHOULD_SEND
);

export default decidePostSaleNotification;
