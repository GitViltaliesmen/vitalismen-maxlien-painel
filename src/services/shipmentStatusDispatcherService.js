import Shipment from '../models/Shipment.js';
import { getSenderPoolStatus, resolveOutboundSessionForJid } from '../whatsapp/sessionRouter.js';
import { toWhatsAppChatId } from '../utils/phone.js';
import {
    notifyDeliveredThankYou,
    notifyPickupBonus,
    notifyProductUsage,
    notifyShipmentInTransit,
    notifyReadyForPickup,
    notifyShipmentGuideGenerated,
    notifyShipmentReturned
} from './shipmentMessageService.js';
import { syncDroppiEcuadorFromPanel } from './droppiEcuadorBrowserService.js';
import { saveCarrierTrackingResult, trackCarrierGuide } from './carrierTrackingService.js';
import { sendText } from '../whatsapp/sendText.js';
import {
    buildCanaryV75RecipientQuery,
    canaryV75SchedulerShipmentAllowed
} from './canaryIsolationV75Service.js';
import {
    POST_SALE_NOTIFICATION_DECISIONS,
    decidePostSaleNotification
} from './postSaleNotificationDecisionService.js';
import {
    postSaleTransactionalSafetyV116Enabled,
    reservePostSaleDailyQuotaV116
} from './postSaleTransactionalSafetyV116Service.js';
import {
    dropiPostSaleEvidenceV139,
    persistDropiStatusProjectionV139
} from './ecDropiStatusPostSaleV139Service.js';
import {
    canonicalLogisticsProjectionV147,
    legacyLogisticsStatusForV147,
    canonicalLogisticsProjectionForShipmentV147,
    servientregaPostSaleCompletionEligibleV147
} from './canonicalLogisticsStatusV147Service.js';
import { assertPostSaleTransactionalV105Configuration } from './postSaleTransactionalControlPlaneV105Service.js';

const DEFAULT_BATCH_LIMIT = Number.parseInt(process.env.SHIPMENT_STATUS_DISPATCH_BATCH_LIMIT || '5', 10);
const DEFAULT_CARRIER_SWEEP_LIMIT = Number.parseInt(process.env.SHIPMENT_CARRIER_STATUS_SWEEP_BATCH_LIMIT || '6', 10);
const DISPATCH_LOCK_MS = Number.parseInt(process.env.SHIPMENT_STATUS_DISPATCH_LOCK_MS || '600000', 10);
const MIN_MESSAGE_GAP_MS = Number.parseInt(process.env.SHIPMENT_MIN_MESSAGE_GAP_MS || '1800000', 10);
const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTES_PER_DAY = 24 * 60;

let paused = process.env.SHIPMENT_STATUS_DISPATCH_ENABLED !== 'true';
let lastRun = null;
let lastCarrierSweep = null;

const parsePositiveNumber = (name, fallback = 0) => {
    const parsed = Number.parseInt(String(process.env[name] || ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const dispatchDailyLimit = () => parsePositiveNumber('SHIPMENT_STATUS_DISPATCH_DAILY_LIMIT', 0);
const dispatchDailyLimitPerSession = () => parsePositiveNumber('SHIPMENT_STATUS_DISPATCH_DAILY_LIMIT_PER_SESSION', 0);
const dispatchHourlyLimitPerSession = () => parsePositiveNumber('SHIPMENT_STATUS_DISPATCH_HOURLY_LIMIT_PER_SESSION', 0);
const dispatchTimeZone = () => process.env.SHIPMENT_STATUS_DISPATCH_TIME_ZONE || process.env.TZ || 'America/Sao_Paulo';
const spreadDispatchEnabled = () => String(process.env.SHIPMENT_STATUS_DISPATCH_SPREAD_ENABLED || 'true').toLowerCase() !== 'false';
const flagEnabled = (name, fallback = false) => {
    const raw = process.env[name];
    if (raw === undefined || raw === null || raw === '') return Boolean(fallback);
    return ['1', 'true', 'yes', 'sim', 'si', 'on'].includes(String(raw).trim().toLowerCase());
};
const dispatchRefreshBeforeSendEnabled = () => flagEnabled('SHIPMENT_STATUS_DISPATCH_REFRESH_BEFORE_SEND', true);
const dispatchRefreshBeforeSendLimit = () => parsePositiveNumber('SHIPMENT_STATUS_DISPATCH_REFRESH_LIMIT', 3);
const carrierRefreshBeforeSendEnabled = () => flagEnabled('SHIPMENT_STATUS_DISPATCH_CARRIER_REFRESH_ENABLED', true);
const carrierStatusSweepEnabled = () => flagEnabled('SHIPMENT_CARRIER_STATUS_SWEEP_ENABLED', true);
const carrierStatusSweepLimit = () => parsePositiveNumber('SHIPMENT_CARRIER_STATUS_SWEEP_BATCH_LIMIT', DEFAULT_CARRIER_SWEEP_LIMIT);
const carrierStatusSweepMinGapMinutes = () => parsePositiveNumber('SHIPMENT_CARRIER_STATUS_SWEEP_MIN_GAP_MINUTES', 50);
export const carrierStatusSweepIntervalMinutes = () => parsePositiveNumber('SHIPMENT_CARRIER_STATUS_SWEEP_INTERVAL_MINUTES', 60);
const carrierStatusSweepMaxAgeDays = () => parsePositiveNumber('SHIPMENT_CARRIER_STATUS_SWEEP_MAX_AGE_DAYS', 45);
const dropiClaimNotifyEnabled = () => flagEnabled('DROPPI_PAYMENT_CLAIM_NOTIFY_ENABLED', true);
const dropiClaimLiveCheckEnabled = () => flagEnabled('DROPPI_PAYMENT_CLAIM_LIVE_CHECK_ENABLED', true);
const parsePhoneList = (...values) => [
    ...new Set(values
        .flatMap((value) => String(value || '').split(','))
        .map((item) => item.replace(/\D/g, ''))
        .filter(Boolean))
];
const dropiClaimNotifyPhones = () => parsePhoneList(
    process.env.DROPPI_PAYMENT_CLAIM_NOTIFY_PHONES,
    process.env.DROPPI_CLAIM_NOTIFY_PHONES,
    process.env.WHATSAPP_PRIORITY_TEST_PHONES,
    '5515998038637'
);
const DISPATCH_SYNCABLE_STATUSES = new Set([
    'created',
    'CREATED',
    'PENDIENTE',
    'GUIA_GENERADA',
    'EN_PROCESAMIENTO',
    'EN_RUTA',
    'EN_REPARTO',
    'EN_DESPACHO',
    'EN_BODEGA_TRANSPORTADORA',
    'MERCANCIA_RECOGIDA',
    'EN_DISTRIBUCION_A_CLIENTE',
    'READY_FOR_PICKUP',
    'NOVEDAD'
]);

const CARRIER_SWEEP_FINAL_STATUSES = [
    'ENTREGADO',
    'DEVUELTO',
    'CANCELADO',
    'CANCELADO_SERVIENTREGA',
    'CANCELADO SERVIENTREGA'
];

const parseClockMinutes = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return null;
    const match = raw.match(/^(\d{1,2})(?::?(\d{2}))?$/);
    if (!match) return null;
    const hours = Number.parseInt(match[1], 10);
    const minutes = Number.parseInt(match[2] || '0', 10);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    if (hours < 0 || hours > 24 || minutes < 0 || minutes > 59) return null;
    if (hours === 24 && minutes !== 0) return null;
    return (hours === 24 ? 0 : hours) * 60 + minutes;
};

const dispatchWindow = () => {
    const start = parseClockMinutes(process.env.SHIPMENT_STATUS_DISPATCH_WINDOW_START || '');
    const end = parseClockMinutes(process.env.SHIPMENT_STATUS_DISPATCH_WINDOW_END || '');
    if (start === null || end === null || start === end) {
        return {
            configured: false,
            start: 0,
            end: 0,
            totalMinutes: MINUTES_PER_DAY
        };
    }
    return {
        configured: true,
        start,
        end,
        totalMinutes: end > start ? end - start : (MINUTES_PER_DAY - start) + end
    };
};

const zonedParts = (date = new Date(), timeZone = dispatchTimeZone()) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    }).formatToParts(date).reduce((acc, part) => {
        if (part.type !== 'literal') acc[part.type] = part.value;
        return acc;
    }, {});
    return {
        year: Number.parseInt(parts.year, 10),
        month: Number.parseInt(parts.month, 10),
        day: Number.parseInt(parts.day, 10),
        hour: Number.parseInt(parts.hour, 10),
        minute: Number.parseInt(parts.minute, 10),
        second: Number.parseInt(parts.second, 10)
    };
};

const timeZoneOffsetMs = (date, timeZone) => {
    const parts = zonedParts(date, timeZone);
    const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    return asUtc - date.getTime();
};

const zonedDateTimeToUtc = ({ year, month, day, hour = 0, minute = 0, second = 0, timeZone }) => {
    const guess = Date.UTC(year, month - 1, day, hour, minute, second);
    const first = new Date(guess - timeZoneOffsetMs(new Date(guess), timeZone));
    return new Date(guess - timeZoneOffsetMs(first, timeZone));
};

const dispatchDayRange = (now = new Date(), timeZone = dispatchTimeZone()) => {
    const parts = zonedParts(now, timeZone);
    const start = zonedDateTimeToUtc({ ...parts, hour: 0, minute: 0, second: 0, timeZone });
    return {
        key: `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`,
        start,
        end: new Date(start.getTime() + DAY_MS)
    };
};

const windowProgress = (now = new Date()) => {
    const window = dispatchWindow();
    if (!window.configured) {
        return {
            configured: false,
            withinWindow: true,
            elapsedMinutes: MINUTES_PER_DAY,
            totalMinutes: MINUTES_PER_DAY
        };
    }
    const parts = zonedParts(now, dispatchTimeZone());
    const current = (parts.hour * 60) + parts.minute;
    const withinWindow = window.end > window.start
        ? current >= window.start && current < window.end
        : current >= window.start || current < window.end;
    const elapsedMinutes = !withinWindow
        ? 0
        : (current >= window.start ? current - window.start : (MINUTES_PER_DAY - window.start) + current);
    return {
        configured: true,
        withinWindow,
        currentMinutes: current,
        startMinutes: window.start,
        endMinutes: window.end,
        elapsedMinutes,
        totalMinutes: window.totalMinutes
    };
};

const countSuccessfulDispatchesInRange = async ({ start, end }) => {
    const result = await Shipment.aggregate([
        { $unwind: '$events' },
        {
            $match: {
                'events.kind': 'shipment_dispatch_attempt',
                'events.at': { $gte: start, $lt: end },
                'events.payload.success': true
            }
        },
        { $count: 'count' }
    ]);
    return result[0]?.count || 0;
};

const countSuccessfulDispatchesBySession = async ({ since }) => {
    const result = await Shipment.aggregate([
        { $unwind: '$events' },
        {
            $match: {
                'events.kind': 'shipment_dispatch_attempt',
                'events.at': { $gte: since },
                'events.payload.success': true,
                'events.payload.sessionId': { $exists: true, $ne: '' }
            }
        },
        {
            $group: {
                _id: '$events.payload.sessionId',
                count: { $sum: 1 }
            }
        }
    ]);
    return new Map(result.map((item) => [String(item._id || ''), item.count || 0]));
};

const dispatchActionPriority = (action) => {
    if (action === 'ready_for_pickup') return 0;
    if (action === 'returned') return 1;
    if (action === 'guide') return 2;
    if (action === 'in_transit') return 3;
    if (action === 'delivered_bonus') return 4;
    return 9;
};

const notificationKindForDispatchAction = (action) => (
    action === 'delivered_bonus' ? 'pickup_bonus' : action
);

const resolveDispatchSessionForShipment = async ({
    shipment,
    hourlySessionCounts,
    dailySessionCounts,
    now = new Date()
} = {}) => {
    const scopedQuotaActive = postSaleTransactionalSafetyV116Enabled();
    const perSessionLimit = scopedQuotaActive ? 0 : dispatchHourlyLimitPerSession();
    const perSessionDailyLimit = scopedQuotaActive ? 0 : dispatchDailyLimitPerSession();
    const jid = toWhatsAppChatId(shipment?.client?.phone || '', shipment?.country || 'EC');
    if (!jid) return { ok: false, reason: 'invalid_chat' };

    if (!perSessionLimit && !perSessionDailyLimit) {
        const requestedSessionId = shipment?.automation?.sessionId || null;
        const route = await resolveOutboundSessionForJid({
            requestedSessionId,
            jid,
            country: shipment?.country || 'EC'
        });
        return {
            ok: Boolean(route.sessionId),
            sessionId: route.sessionId || '',
            reason: route.reason || (requestedSessionId ? 'shipment_sticky_session' : 'wallet_or_least_used_session'),
            perSessionLimit,
            perSessionDailyLimit,
            hourlyCount: route.sessionId ? (hourlySessionCounts.get(route.sessionId) || 0) : 0,
            dailyCount: route.sessionId ? (dailySessionCounts.get(route.sessionId) || 0) : 0
        };
    }

    const senderPool = getSenderPoolStatus();
    const connected = (senderPool.sessions || [])
        .filter((session) => session.connected)
        .map((session) => ({
            sessionId: session.sessionId,
            hourlyCount: hourlySessionCounts.get(session.sessionId) || 0,
            dailyCount: dailySessionCounts.get(session.sessionId) || 0
        }))
        .filter((session) => !perSessionLimit || session.hourlyCount < perSessionLimit)
        .filter((session) => !perSessionDailyLimit || session.dailyCount < perSessionDailyLimit)
        .sort((a, b) => (a.dailyCount - b.dailyCount) || (a.hourlyCount - b.hourlyCount));

    if (!connected.length) {
        return {
            ok: false,
            reason: perSessionDailyLimit ? 'daily_session_limit_reached' : (perSessionLimit ? 'hourly_session_limit_reached' : 'no_connected_session'),
            perSessionLimit,
            perSessionDailyLimit,
            windowStartedAt: new Date(now.getTime() - (60 * 60 * 1000))
        };
    }

    const preferred = connected[0].sessionId;
    const route = await resolveOutboundSessionForJid({
        requestedSessionId: preferred,
        jid,
        country: shipment?.country || 'EC'
    });
    const selected = route.sessionId || preferred;
    const selectedCount = hourlySessionCounts.get(selected) || 0;
    const selectedDailyCount = dailySessionCounts.get(selected) || 0;
    if (perSessionLimit && selectedCount >= perSessionLimit) {
        return {
            ok: false,
            reason: 'resolved_session_hourly_limit_reached',
            sessionId: selected,
            perSessionLimit
        };
    }
    if (perSessionDailyLimit && selectedDailyCount >= perSessionDailyLimit) {
        return {
            ok: false,
            reason: 'resolved_session_daily_limit_reached',
            sessionId: selected,
            perSessionDailyLimit
        };
    }
    return {
        ok: true,
        sessionId: selected,
        reason: route.reason || 'least_used_dispatch_session',
        perSessionLimit,
        perSessionDailyLimit,
        hourlyCount: selectedCount,
        dailyCount: selectedDailyCount
    };
};

const resolveDispatchQuota = async ({ requestedLimit, now = new Date() } = {}) => {
    const dailyLimit = dispatchDailyLimit();
    const progress = windowProgress(now);
    const timeZone = dispatchTimeZone();
    const day = dispatchDayRange(now, timeZone);

    if (!dailyLimit || postSaleTransactionalSafetyV116Enabled()) {
        return {
            allowed: true,
            limit: Math.max(1, Math.min(requestedLimit, dailyLimit || requestedLimit)),
            reason: dailyLimit ? 'scoped_event_quota_v147' : 'unlimited',
            dailyLimit,
            sentToday: 0,
            timeZone,
            dayKey: day.key,
            window: progress
        };
    }

    const sentToday = await countSuccessfulDispatchesInRange(day);
    if (sentToday >= dailyLimit) {
        return {
            allowed: false,
            limit: 0,
            reason: 'daily_limit_reached',
            dailyLimit,
            sentToday,
            timeZone,
            dayKey: day.key,
            window: progress
        };
    }

    if (!progress.withinWindow) {
        return {
            allowed: false,
            limit: 0,
            reason: 'outside_dispatch_window',
            dailyLimit,
            sentToday,
            timeZone,
            dayKey: day.key,
            window: progress
        };
    }

    const allowedByNow = progress.configured && spreadDispatchEnabled()
        ? Math.min(dailyLimit, Math.floor((progress.elapsedMinutes / progress.totalMinutes) * dailyLimit) + 1)
        : dailyLimit;
    const remainingNow = Math.max(0, allowedByNow - sentToday);

    if (remainingNow <= 0) {
        return {
            allowed: false,
            limit: 0,
            reason: 'slot_limit_reached',
            dailyLimit,
            sentToday,
            allowedByNow,
            timeZone,
            dayKey: day.key,
            window: progress
        };
    }

    return {
        allowed: true,
        limit: Math.max(1, Math.min(requestedLimit, remainingNow, dailyLimit - sentToday)),
        reason: 'quota_available',
        dailyLimit,
        sentToday,
        allowedByNow,
        timeZone,
        dayKey: day.key,
        window: progress
    };
};

const normalizeLimit = (value) => {
    const parsed = Number.parseInt(value || DEFAULT_BATCH_LIMIT, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_BATCH_LIMIT;
    return Math.min(parsed, 30);
};

const normalizeActions = (actions = []) => {
    const list = Array.isArray(actions) ? actions : String(actions || '').split(',');
    const allowed = new Set(['guide', 'in_transit', 'ready_for_pickup', 'delivered_bonus', 'returned']);
    const normalized = list.map((item) => String(item || '').trim()).filter((item) => allowed.has(item));
    return [...new Set(normalized)];
};

const appendDispatchEvent = async (shipmentId, kind, payload = {}) => {
    await Shipment.updateOne(
        { _id: shipmentId },
        {
            $push: {
                events: {
                    $each: [{
                        kind,
                        at: new Date(),
                        payload
                    }],
                    $slice: -60
                }
            }
        }
    );
};

const hasShipmentEvent = (shipment, kind) => (
    Array.isArray(shipment?.events)
    && shipment.events.some((event) => String(event?.kind || '') === kind)
);

const normalizeStatusKey = (value = '') => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');

const isDropiDeliveredGreenStatus = (status = '') => {
    const value = normalizeStatusKey(status);
    return value === 'ENTREGADO'
        || value === 'DELIVERED'
        || value === 'REPORTADO_ENTREGADO'
        || value === 'MERCANCIA_ENTREGADA'
        || value === 'PEDIDO_ENTREGADO';
};

const summarizeDropiVerification = (verification = null) => (
    verification
        ? {
            ok: Boolean(verification.ok),
            skipped: Boolean(verification.skipped),
            reason: verification.reason || '',
            error: verification.error || '',
            status: verification.status || ''
        }
        : null
);

const buildDropiPaymentClaimText = ({
    shipment,
    carrierResult,
    previousDropiStatus,
    currentDropiStatus = '',
    dropiVerification = null,
    resolved = false
} = {}) => {
    const client = shipment?.client || {};
    const guide = carrierResult?.trackingNumber || shipment?.logistics?.trackingNumber || '';
    const value = shipment?.raw?.latestDroppiPayload?.total
        || shipment?.raw?.latestDroppiPayload?.order?.total
        || shipment?.total
        || '';
    const dropiOrderId = shipment?.raw?.manualDropiOrderId
        || shipment?.raw?.latestDroppiPayload?.dropiOrderId
        || shipment?.raw?.latestDroppiPayload?.id
        || '';
    const verificationSummary = summarizeDropiVerification(dropiVerification);
    const manualCheck = verificationSummary && !verificationSummary.ok;
    const title = resolved
        ? 'Pagamento Dropi ja esta verde'
        : (manualCheck ? 'Conferir pagamento Dropi manualmente' : 'Cobrar atualizacao de pagamento Dropi');
    const dropiStatus = currentDropiStatus || previousDropiStatus || shipment?.logistics?.status || '';
    return [
        title,
        `Cliente: ${client.name || shipment?.orderId || 'sem nome'}`,
        `Telefone: ${client.phone || ''}`,
        `Guia: ${guide || 'sem guia'}`,
        `Valor: ${value ? `$${value}` : 'conferir no Dropi'}`,
        `Pedido Dropi: ${dropiOrderId || 'conferir'}`,
        `Servientrega: ${carrierResult?.normalizedStatus || carrierResult?.statusAtual || ''}`,
        `Dropi atual: ${dropiStatus || 'nao verificado'}`,
        verificationSummary ? `Verificacao Dropi: ${verificationSummary.ok ? 'ok' : (verificationSummary.reason || 'falhou')}` : '',
        `Pedido interno: ${shipment?.orderId || ''}`
    ].filter(Boolean).join('\n');
};

const notifyDropiPaymentClaim = async ({
    shipment,
    carrierResult,
    previousDropiStatus,
    currentDropiStatus = '',
    dropiVerification = null,
    resolved = false
} = {}) => {
    if (!dropiClaimNotifyEnabled()) return { notified: false, reason: 'disabled' };
    const eventKind = resolved ? 'dropi_payment_claim_resolved_notified' : 'dropi_payment_claim_required_notified';
    if (hasShipmentEvent(shipment, eventKind)) return { notified: false, reason: 'already_notified' };
    const phones = dropiClaimNotifyPhones();
    if (!phones.length) return { notified: false, reason: 'missing_recipients' };
    const verificationSummary = summarizeDropiVerification(dropiVerification);

    const text = buildDropiPaymentClaimText({
        shipment,
        carrierResult,
        previousDropiStatus,
        currentDropiStatus,
        dropiVerification: verificationSummary,
        resolved
    });
    let sent = 0;
    for (const phone of phones) {
        const ok = await sendText(`${phone}@c.us`, text, null, {
            country: 'EC',
            allowExistingDropiOrder: true,
            outboundContext: resolved ? 'dropi_payment_claim_resolved' : 'dropi_payment_claim_required',
            dedupeValue: `${eventKind}|${shipment?.orderId || ''}|${shipment?.logistics?.trackingNumber || ''}|${phone}`,
            humanize: false
        }).catch(() => false);
        if (ok) sent += 1;
    }
    await appendDispatchEvent(shipment._id, eventKind, {
        sent,
        recipients: phones.map((phone) => phone.slice(-4)),
        previousDropiStatus,
        currentDropiStatus,
        dropiVerification: verificationSummary,
        carrierStatus: carrierResult?.normalizedStatus || '',
        trackingNumber: carrierResult?.trackingNumber || shipment?.logistics?.trackingNumber || ''
    });
    return { notified: sent > 0, sent, reason: sent ? 'ok' : 'send_failed' };
};

const verifyDropiBeforePaymentClaim = async ({ shipment } = {}) => {
    if (!dropiClaimLiveCheckEnabled()) {
        return {
            ok: false,
            skipped: true,
            reason: 'live_check_disabled',
            status: shipment?.logistics?.status || '',
            shipment
        };
    }
    if (!shipment?._id) return { ok: false, reason: 'missing_shipment', status: '' };
    const sync = await syncDroppiEcuadorFromPanel({ shipment }).catch((error) => ({
        ok: false,
        reason: 'dropi_live_check_failed',
        error: error.message || String(error)
    }));
    const syncedShipment = sync?.shipment || await Shipment.findById(shipment._id).catch(() => shipment);
    return {
        ok: Boolean(sync?.ok),
        reason: sync?.reason || '',
        error: sync?.error || '',
        status: syncedShipment?.logistics?.status || shipment?.logistics?.status || '',
        shipment: syncedShipment || shipment
    };
};

const lockShipmentForDispatch = async (shipmentId) => {
    const now = new Date();
    const lockUntil = new Date(now.getTime() + DISPATCH_LOCK_MS);
    return Shipment.findOneAndUpdate(
        {
            _id: shipmentId,
            $or: [
                { 'automation.dispatchLockedUntil': { $exists: false } },
                { 'automation.dispatchLockedUntil': null },
                { 'automation.dispatchLockedUntil': { $lte: now } }
            ]
        },
        { $set: { 'automation.dispatchLockedUntil': lockUntil } },
        { new: true }
    );
};

const releaseShipmentDispatchLock = async (shipmentId) => {
    await Shipment.updateOne(
        { _id: shipmentId },
        { $set: { 'automation.dispatchLockedUntil': null } }
    ).catch(() => null);
};

export const getShipmentDispatchState = () => ({
    paused,
    enabled: !paused,
    batchLimit: DEFAULT_BATCH_LIMIT,
    dailyLimit: dispatchDailyLimit(),
    dailyLimitPerSession: dispatchDailyLimitPerSession(),
    hourlyLimitPerSession: dispatchHourlyLimitPerSession(),
    timeZone: dispatchTimeZone(),
    window: dispatchWindow(),
    spreadEnabled: spreadDispatchEnabled(),
    carrierSweep: {
        enabled: carrierStatusSweepEnabled(),
        batchLimit: carrierStatusSweepLimit(),
        minGapMinutes: carrierStatusSweepMinGapMinutes(),
        maxAgeDays: carrierStatusSweepMaxAgeDays(),
        lastRun: lastCarrierSweep
    },
    lastRun
});

export const setShipmentDispatchPaused = (value, reason = '') => {
    paused = Boolean(value);
    lastRun = {
        ...(lastRun || {}),
        pausedChangedAt: new Date(),
        paused,
        reason
    };
    return getShipmentDispatchState();
};

export const shipmentStatusDispatchCandidateQuery = (actions = [], now = new Date()) => {
    const actionSet = new Set(actions.length ? actions : ['guide', 'ready_for_pickup', 'delivered_bonus', 'returned']);
    const branches = [];
    if (actionSet.has('guide')) {
        branches.push({
            'logistics.status': { $nin: ['READY_FOR_PICKUP', 'ENTREGADO', 'DEVUELTO', 'CANCELADO', 'CANCELADO_SERVIENTREGA', 'CANCELADO SERVIENTREGA'] },
            'logistics.trackingNumber': { $exists: true, $ne: '' },
            'automation.guiaNotifiedAt': null
        });
        branches.push({
            createdAt: { $gte: new Date(now.getTime() - (7 * DAY_MS)) },
            'logistics.status': { $in: ['CREATED', 'created', 'PENDIENTE', 'EN_PROCESAMIENTO'] },
            'automation.submittedToDroppiAt': { $exists: true, $ne: null },
            'automation.guiaNotifiedAt': null,
            $or: [
                { 'raw.manualDropiOrderId': { $exists: true, $ne: '' } },
                { 'raw.latestDroppiPayload.dropiOrderId': { $exists: true, $ne: '' } },
                { 'raw.droppiOrder.id': { $exists: true, $ne: '' } }
            ]
        });
    }
    if (actionSet.has('in_transit')) {
        branches.push({
            'logistics.status': { $in: ['EN_RUTA', 'EN_REPARTO', 'EN_DESPACHO', 'EN_BODEGA_TRANSPORTADORA', 'MERCANCIA_RECOGIDA'] },
            'automation.inTransitNotifiedAt': null,
            'outcomes.delivered': { $ne: true },
            'outcomes.pickedUp': { $ne: true },
            'outcomes.returned': { $ne: true },
            'outcomes.prepaidOnly': { $ne: true }
        });
    }
    if (actionSet.has('ready_for_pickup')) {
        branches.push({
            'logistics.status': 'READY_FOR_PICKUP',
            'logistics.canonicalStatus': 'READY_FOR_PICKUP',
            'logistics.pickupReadyVerified': true,
            'logistics.pickupReadyVerifiedSource': 'carrier_tracking',
            'logistics.trackingNumber': { $exists: true, $ne: '' },
            'logistics.agencyPickup': true,
            'automation.readyForPickupNotifiedAt': null,
            'outcomes.delivered': { $ne: true },
            'outcomes.pickedUp': { $ne: true },
            'outcomes.returned': { $ne: true },
            'outcomes.prepaidOnly': { $ne: true }
        });
    }
    if (actionSet.has('delivered_bonus')) {
        branches.push({
            $and: [
                {
                    $or: [
                        { 'logistics.canonicalEvidence.rawCode': { $exists: true, $ne: '' } },
                        { 'logistics.canonicalEvidence.rawStatus': { $exists: true, $ne: '' } },
                        { 'logistics.canonicalEvidence.rawSubstatus': { $exists: true, $ne: '' } }
                    ]
                },
                {
                    $or: [
                        { 'automation.deliveredThankYouNotifiedAt': null },
                        { 'automation.bonusNotifiedAt': null },
                        { 'automation.usageNotifiedAt': null }
                    ]
                },
                {
                    $or: [
                        { 'raw.historicalExternalReconciliation.customerId': { $exists: true, $ne: '' } },
                        { 'raw.customerId': { $exists: true, $ne: '' } },
                        { 'client.customerId': { $exists: true, $ne: '' } }
                    ]
                }
            ],
            'logistics.canonicalStatus': 'DELIVERED',
            'logistics.canonicalEvidence.provider': { $in: ['servientrega', 'SERVIENTREGA'] },
            'logistics.canonicalEvidence.source': 'carrier_tracking',
            'outcomes.returned': { $ne: true }
        });
    }
    if (actionSet.has('returned')) {
        branches.push({
            'logistics.status': 'DEVUELTO',
            'automation.returnedNotifiedAt': null
        });
    }
    const minGapCutoff = new Date(Date.now() - MIN_MESSAGE_GAP_MS);
    return {
        country: 'EC',
        'client.phone': { $exists: true, $ne: '' },
        ...buildCanaryV75RecipientQuery('client.phone'),
        'review.manualOnly': { $ne: true },
        $and: [
            { $or: branches.length ? branches : [{ _id: null }] },
            {
                $or: [
                    { 'automation.lastReminderAt': { $exists: false } },
                    { 'automation.lastReminderAt': null },
                    { 'automation.lastReminderAt': { $lte: minGapCutoff } }
                ]
            }
        ]
    };
};

const candidateQuery = (actions = []) => shipmentStatusDispatchCandidateQuery(actions);

const shouldRefreshShipmentBeforeDispatch = (shipment) => {
    if (!shipment) return false;
    const hasDropiReference = Boolean(
        shipment.logistics?.trackingNumber
        || shipment.raw?.manualDropiOrderId
        || shipment.raw?.latestDroppiPayload?.dropiOrderId
    );
    if (!hasDropiReference) return false;
    const status = shipment.logistics?.status || '';
    return !status || DISPATCH_SYNCABLE_STATUSES.has(status);
};

const shouldTrackCarrierBeforeDispatch = (shipment) => {
    if (!carrierRefreshBeforeSendEnabled()) return false;
    const trackingNumber = shipment?.logistics?.trackingNumber || '';
    if (!trackingNumber) return false;
    const carrier = String(shipment?.logistics?.distributionCompany || shipment?.logistics?.chosenCarrier || '').toLowerCase();
    return !carrier || /servientrega|servi\s*entrega|laar/.test(carrier);
};

export const refreshCarrierBeforeDispatch = async (shipment, { previousDropiStatus = '', canonicalPoll = null } = {}) => {
    if (!shouldTrackCarrierBeforeDispatch(shipment)) {
        return { ok: false, skipped: true, reason: 'carrier_tracking_not_applicable', shipment };
    }
    let result;
    try {
        result = await (canonicalPoll?.trackGuide || trackCarrierGuide)({
        trackingNumber: shipment.logistics?.trackingNumber,
        carrier: shipment.logistics?.distributionCompany || shipment.logistics?.chosenCarrier || 'servientrega'
        });
    } catch (error) {
        if (!canonicalPoll) throw error;
        result = { ok: false, reason: 'carrier_provider_failed', error: String(error.message || '').slice(0, 160) };
    }
    if (canonicalPoll) {
        const projection = canonicalLogisticsProjectionV147({
            provider: result?.carrier,
            providerCode: result?.providerStatusCode,
            providerStatus: result?.statusAtual,
            providerSubstatus: result?.providerSubstatus
        });
        const valid = result?.ok === true
            && /^servientrega$/i.test(String(result.carrier || ''))
            && String(result.trackingNumber || '') === String(shipment.logistics.trackingNumber)
            && projection.canonicalStatus !== 'UNKNOWN';
        if (!valid) result = { ...result, ok: false, reason: result?.reason || 'invalid_canonical_carrier_result' };
        else result = { ...result, canonicalStatus: projection.canonicalStatus, normalizedStatus: legacyLogisticsStatusForV147(projection.canonicalStatus) };
        if (valid && projection.canonicalStatus === 'DELIVERED') {
            const previous = shipment.raw?.carrierTracking;
            const observedAt = new Date(previous?.lastCheckedAt || 0).getTime();
            const watermark = new Date(canonicalPoll.activationWatermark).getTime();
            const prior = canonicalLogisticsProjectionV147({
                providerCode: previous?.lastResult?.providerStatusCode,
                providerStatus: previous?.lastResult?.statusAtual,
                providerSubstatus: previous?.lastResult?.providerSubstatus
            });
            const providerDate = String(result.dataMovimento || '');
            // Sem timezone explícito, a data do provider não prova cronologia.
            const providerAt = /(?:Z|[+-]\d{2}:\d{2})$/.test(providerDate) ? Date.parse(providerDate) : NaN;
            const forward = (previous?.lastResult?.ok === true && observedAt >= watermark
                && observedAt < canonicalPoll.now.getTime() && !prior.terminal && prior.canonicalStatus !== 'UNKNOWN')
                || (Number.isFinite(providerAt) && providerAt >= watermark && providerAt <= canonicalPoll.now.getTime());
            if (!forward) {
                // Persistir o bloqueio antes do lifecycle impede descoberta histórica virar dispatch.
                await Shipment.updateOne({ _id: shipment._id }, { $addToSet: {
                    'review.suppressedNotificationKinds': { $each: ['delivered_thank_you', 'pickup_bonus', 'product_usage'] }
                } });
            }
        }
        const refreshed = await saveCarrierTrackingResult({ shipmentId: shipment._id, result, updateStatus: valid });
        return {
            ok: valid, skipped: false, reason: result.reason || '', carrierResult: result,
            shipment: refreshed || shipment, status: refreshed?.logistics?.status || shipment.logistics?.status || '',
            trackingNumber: shipment.logistics.trackingNumber
        };
    }
    const shouldUpdateStatus = Boolean(result?.ok && result.normalizedStatus);
    const carrierStatus = String(result?.normalizedStatus || '').toUpperCase();
    const dropiVerification = result?.ok && carrierStatus === 'ENTREGADO'
        ? await verifyDropiBeforePaymentClaim({ shipment })
        : null;
    const verifiedDropiStatus = dropiVerification?.status || '';
    await saveCarrierTrackingResult({
        shipmentId: shipment._id,
        result,
        updateStatus: shouldUpdateStatus
    });
    const refreshed = await Shipment.findById(shipment._id);
    const previousStatus = String(verifiedDropiStatus || previousDropiStatus || shipment.logistics?.status || '').toUpperCase();
    const hadDropiPaymentClaim = refreshed && (
        hasShipmentEvent(refreshed, 'dropi_payment_claim_required')
        || hasShipmentEvent(refreshed, 'dropi_payment_claim_required_notified')
    );
    const dropiDeliveredGreen = isDropiDeliveredGreenStatus(previousStatus);
    const dropiVerificationSummary = summarizeDropiVerification(dropiVerification);
    if (result?.ok && carrierStatus === 'ENTREGADO' && dropiDeliveredGreen && refreshed) {
        await appendDispatchEvent(refreshed._id, 'dropi_payment_claim_skipped_paid', {
            reason: 'dropi_already_delivered_green',
            dropiStatus: previousStatus,
            dropiVerification: dropiVerificationSummary,
            trackingNumber: result.trackingNumber || refreshed.logistics?.trackingNumber || ''
        });
        if (hadDropiPaymentClaim) {
            await notifyDropiPaymentClaim({
                shipment: refreshed,
                carrierResult: result,
                previousDropiStatus: previousStatus,
                currentDropiStatus: previousStatus,
                dropiVerification,
                resolved: true
            });
        }
    } else if (result?.ok && carrierStatus === 'ENTREGADO' && refreshed) {
        if (!hasShipmentEvent(refreshed, 'dropi_payment_claim_required')) {
            await appendDispatchEvent(refreshed._id, 'dropi_payment_claim_required', {
                reason: 'carrier_delivered_dropi_not_green',
                previousDropiStatus: previousStatus,
                currentDropiStatus: previousStatus,
                dropiVerification: dropiVerificationSummary,
                carrierStatus,
                trackingNumber: result.trackingNumber || refreshed.logistics?.trackingNumber || ''
            });
        }
        await notifyDropiPaymentClaim({
            shipment: refreshed,
            carrierResult: result,
            previousDropiStatus: previousStatus,
            currentDropiStatus: previousStatus,
            dropiVerification,
            resolved: false
        });
    }
    return {
        ok: Boolean(result?.ok),
        skipped: false,
        reason: result?.reason || '',
        status: refreshed?.logistics?.status || shipment.logistics?.status || '',
        trackingNumber: refreshed?.logistics?.trackingNumber || shipment.logistics?.trackingNumber || '',
        carrierResult: result,
        shipment: refreshed || shipment
    };
};

export const carrierStatusSweepQuery = ({ force = false, now = new Date(), transactionalV116 = false } = {}) => {
    const oldest = new Date(now.getTime() - carrierStatusSweepMaxAgeDays() * DAY_MS);
    const gap = transactionalV116 ? Math.max(carrierStatusSweepIntervalMinutes(), carrierStatusSweepMinGapMinutes()) : carrierStatusSweepMinGapMinutes();
    const checkedBefore = new Date(now.getTime() - gap * 60 * 1000);
    const query = {
        country: 'EC',
        ...buildCanaryV75RecipientQuery('client.phone'),
        'logistics.trackingNumber': { $exists: true, $ne: '' },
        $and: [
            {
                $or: [
                    { 'logistics.status': { $nin: CARRIER_SWEEP_FINAL_STATUSES } },
                    { 'logistics.status': 'ENTREGADO', 'outcomes.delivered': { $ne: true } },
                    { 'logistics.status': 'DEVUELTO', 'outcomes.returned': { $ne: true } }
                ]
            },
            {
                $or: [
                    { updatedAt: { $gte: oldest } },
                    { createdAt: { $gte: oldest } },
                    { 'logistics.status': 'NOVEDAD' }
                ]
            },
            {
                $or: [
                    { 'logistics.distributionCompany': { $exists: false } },
                    { 'logistics.distributionCompany': '' },
                    { 'logistics.distributionCompany': /servientrega|servi\s*entrega|laar/i },
                    { 'logistics.chosenCarrier': /servientrega|servi\s*entrega|laar/i },
                    { 'logistics.preferredCarrier': /servientrega|servi\s*entrega|laar/i }
                ]
            }
        ]
    };
    if (transactionalV116) {
        query.$and[0] = {
            'logistics.status': { $nin: CARRIER_SWEEP_FINAL_STATUSES },
            'logistics.canonicalStatus': { $nin: ['DELIVERED', 'RETURNED'] },
            'outcomes.delivered': { $ne: true },
            'outcomes.returned': { $ne: true }
        };
        query.$and.push({ $or: [
            { 'logistics.distributionCompany': /^servi\s*entrega$/i },
            { 'logistics.chosenCarrier': /^servi\s*entrega$/i },
            { 'logistics.canonicalEvidence.provider': /^servientrega$/i }
        ] });
    }
    if (!force) {
        query.$and.push({
            $or: [
                { 'raw.carrierTracking.lastCheckedAt': { $exists: false } },
                { 'raw.carrierTracking.lastCheckedAt': null },
                { 'raw.carrierTracking.lastCheckedAt': { $lte: checkedBefore } }
            ]
        });
    }
    return query;
};

export const countCarrierStatusSweepCandidates = async ({ force = false } = {}) => (
    Shipment.countDocuments(carrierStatusSweepQuery({ force }))
);

export const processCarrierStatusSweep = async ({
    limit = carrierStatusSweepLimit(),
    dryRun = false,
    force = false,
    transactionalV116 = false,
    activationWatermark = null,
    trackGuide = trackCarrierGuide
} = {}) => {
    const startedAt = new Date();
    if (transactionalV116) {
        assertPostSaleTransactionalV105Configuration(process.env);
        if (!postSaleTransactionalSafetyV116Enabled() || force) throw new Error('v116_canonical_poll_contract_invalid');
        if (!dryRun && (!activationWatermark || !Number.isFinite(Date.parse(activationWatermark))
            || Date.parse(activationWatermark) > startedAt.getTime())) throw new Error('v116_activation_watermark_missing');
    }
    const effectiveLimit = normalizeLimit(limit || carrierStatusSweepLimit());
    if (!carrierStatusSweepEnabled() && !force && !transactionalV116) {
        lastCarrierSweep = {
            startedAt,
            finishedAt: new Date(),
            dryRun: Boolean(dryRun),
            force: Boolean(force),
            processed: 0,
            refreshed: 0,
            statusChanged: 0,
            skipped: 0,
            failed: 0,
            disabled: true,
            results: []
        };
        return lastCarrierSweep;
    }

    const candidates = await Shipment.find(carrierStatusSweepQuery({ force, now: startedAt, transactionalV116 }))
        .sort({ 'raw.carrierTracking.lastCheckedAt': 1, updatedAt: 1, createdAt: 1 })
        .limit(effectiveLimit);

    const results = [];
    let refreshed = 0;
    let statusChanged = 0;
    let skipped = 0;
    let failed = 0;

    for (const shipment of candidates) {
        const canaryDecision = canaryV75SchedulerShipmentAllowed(shipment);
        if (!canaryDecision.allowed) {
            skipped += 1;
            results.push({
                orderId: shipment.orderId,
                success: false,
                reason: canaryDecision.reason
            });
            continue;
        }
        const beforeStatus = shipment.logistics?.status || '';
        const item = {
            orderId: shipment.orderId,
            phoneTail: String(shipment.client?.phone || '').replace(/\D/g, '').slice(-4),
            trackingNumber: shipment.logistics?.trackingNumber || '',
            beforeStatus,
            success: false
        };

        if (dryRun) {
            item.success = true;
            item.dryRun = true;
            results.push(item);
            continue;
        }

        let locked = null;
        if (transactionalV116) {
            // O flock do V116 serializa ciclos; o lock persistido protege contra outros escritores.
            locked = await Shipment.findOneAndUpdate({
                _id: shipment._id,
                $and: [carrierStatusSweepQuery({ now: startedAt, transactionalV116: true }), { $or: [
                    { 'automation.dispatchLockedUntil': { $exists: false } },
                    { 'automation.dispatchLockedUntil': null },
                    { 'automation.dispatchLockedUntil': { $lte: startedAt } }
                ] }]
            }, { $set: { 'automation.dispatchLockedUntil': new Date(startedAt.getTime() + DISPATCH_LOCK_MS) } }, { new: true });
            if (!locked) {
                skipped += 1;
                results.push({ ...item, reason: 'locked_or_poll_not_due' });
                continue;
            }
        }
        try {
            const result = await refreshCarrierBeforeDispatch(locked || shipment, {
                previousDropiStatus: beforeStatus,
                canonicalPoll: transactionalV116 ? { activationWatermark, now: startedAt, trackGuide } : null
            });
            const afterStatus = result?.shipment?.logistics?.status || result?.status || beforeStatus;
            item.success = Boolean(result?.ok);
            item.reason = result?.reason || '';
            item.afterStatus = afterStatus;
            item.carrierStatus = result?.carrierResult?.normalizedStatus || result?.carrierResult?.statusAtual || '';
            item.trackingNumber = result?.trackingNumber || item.trackingNumber;
            if (result?.skipped) {
                skipped += 1;
            } else if (item.success) {
                refreshed += 1;
                if (afterStatus && afterStatus !== beforeStatus) statusChanged += 1;
            } else {
                failed += 1;
            }
        } catch (error) {
            if (transactionalV116) throw error; // provider falha por item; persistência/infraestrutura falha o ciclo.
            item.error = error.message || 'carrier_sweep_failed';
            failed += 1;
        } finally {
            if (locked) await Shipment.updateOne({
                _id: shipment._id,
                'automation.dispatchLockedUntil': locked.automation.dispatchLockedUntil
            }, { $set: { 'automation.dispatchLockedUntil': null } });
        }

        await appendDispatchEvent(shipment._id, 'carrier_status_sweep_attempt', {
            success: Boolean(item.success),
            reason: item.reason || '',
            error: item.error || '',
            beforeStatus,
            afterStatus: item.afterStatus || '',
            trackingNumber: item.trackingNumber || '',
            carrierStatus: item.carrierStatus || ''
        }).catch(() => null);
        results.push(item);
    }

    lastCarrierSweep = {
        startedAt,
        finishedAt: new Date(),
        dryRun: Boolean(dryRun),
        force: Boolean(force),
        processed: candidates.length,
        refreshed,
        statusChanged,
        skipped,
        failed,
        transactionalV116,
        intervalMinutes: transactionalV116 ? carrierStatusSweepIntervalMinutes() : undefined,
        reason: candidates.length ? 'poll_due' : 'poll_not_due_or_no_active_shipments',
        results
    };
    return lastCarrierSweep;
};

const refreshShipmentBeforeDispatch = async (shipment) => {
    if (!shouldRefreshShipmentBeforeDispatch(shipment)) {
        return { ok: false, skipped: true, reason: 'no_dropi_reference_or_final_status' };
    }
    let result = null;
    try {
        result = await syncDroppiEcuadorFromPanel({ shipment });
    } catch (error) {
        result = {
            ok: false,
            reason: 'dropi_sync_failed_before_dispatch',
            error: error.message || 'dropi_sync_failed_before_dispatch'
        };
    }
    let refreshed = await Shipment.findById(shipment._id);
    const previousDropiStatus = refreshed?.logistics?.status || shipment.logistics?.status || '';
    const carrierRefresh = refreshed
        ? await refreshCarrierBeforeDispatch(refreshed, { previousDropiStatus }).catch((error) => ({
            ok: false,
            reason: 'carrier_tracking_failed_before_dispatch',
            error: error.message || 'carrier_tracking_failed_before_dispatch',
            shipment: refreshed
        }))
        : null;
    if (carrierRefresh?.shipment) refreshed = carrierRefresh.shipment;
    return {
        ok: Boolean(result?.ok || carrierRefresh?.ok),
        reason: result?.reason || '',
        error: result?.error || '',
        status: refreshed?.logistics?.status || shipment.logistics?.status || '',
        trackingNumber: refreshed?.logistics?.trackingNumber || shipment.logistics?.trackingNumber || '',
        carrierRefresh: carrierRefresh
            ? {
                ok: Boolean(carrierRefresh.ok),
                skipped: Boolean(carrierRefresh.skipped),
                reason: carrierRefresh.reason || '',
                error: carrierRefresh.error || '',
                status: carrierRefresh.status || '',
                trackingNumber: carrierRefresh.trackingNumber || ''
            }
            : null,
        shipment: refreshed || shipment
    };
};

export const shipmentStatusDispatchActionForShipment = (shipment) => {
    const status = shipment?.logistics?.status || '';
    if (!shipment?.logistics?.canonicalStatus) {
        if (status === 'DEVUELTO') return 'returned';
        if (status === 'READY_FOR_PICKUP' && shipment?.logistics?.pickupReadyVerifiedSource === 'carrier_tracking') return 'ready_for_pickup';
    }
    const canonical = canonicalLogisticsProjectionForShipmentV147(shipment);
    if (canonical.canonicalStatus === 'RETURNED') return 'returned';
    if (servientregaPostSaleCompletionEligibleV147(shipment)) return 'delivered_bonus';
    if (canonical.canonicalStatus === 'READY_FOR_PICKUP' && canonical.canPickup) return 'ready_for_pickup';
    if (['PICKED_UP_BY_CARRIER', 'IN_TRANSIT', 'LOGISTICS_CENTER', 'ENTERING_AGENCY'].includes(canonical.canonicalStatus)) {
        return 'in_transit';
    }
    if (canonical.canonicalStatus === 'GUIDE_CREATED' && shipment?.logistics?.trackingNumber && !shipment?.automation?.guiaNotifiedAt) return 'guide';
    return 'none';
};

const actionForShipment = shipmentStatusDispatchActionForShipment;

const markDeliveredAndNotifyBonus = async (shipment) => {
    if (!servientregaPostSaleCompletionEligibleV147(shipment)) return false;
    const now = new Date();
    await Shipment.updateOne(
        { _id: shipment._id },
        {
            $set: {
                'outcomes.pickedUp': true,
                'outcomes.delivered': true,
                'outcomes.returned': false,
                'outcomes.prepaidOnly': false,
                'automation.deliveredConfirmedAt': shipment.automation?.deliveredConfirmedAt || now,
                'automation.prepaidOnlyNotifiedAt': null,
                'automation.pickupReminderDispatchLockedUntil': null,
                'automation.notificationLocks.PICKUP_REMINDER_DAY3': null,
                'automation.notificationLocks.PICKUP_REMINDER_DAY5': null,
                'review.manualOnly': false,
                'review.reviewReason': '',
                'review.reviewStatus': 'delivered_confirmed_by_servientrega_canonical_status'
            }
        }
    );
    await appendDispatchEvent(shipment._id, 'delivered_confirmed_by_servientrega_canonical_status', {
        status: shipment.logistics?.status || '',
        canonicalStatus: shipment.logistics?.canonicalStatus || '',
        trackingNumber: shipment.logistics?.trackingNumber || '',
        customerEligibility: 'released_for_new_order',
        pendingA10A19Cancelled: true
    });
    const refreshed = await Shipment.findById(shipment._id);
    if (!refreshed) return false;
    const thankYouSent = await notifyDeliveredThankYou(refreshed);
    const afterThankYou = await Shipment.findById(shipment._id);
    const bonusSent = afterThankYou ? await notifyPickupBonus(afterThankYou) : false;
    const afterBonus = await Shipment.findById(shipment._id);
    const usageSent = afterBonus ? await notifyProductUsage(afterBonus) : false;
    return Boolean(thankYouSent || bonusSent || usageSent);
};

export const countShipmentDispatchCandidates = async ({ actions = [] } = {}) => {
    const selectedActions = normalizeActions(actions);
    return Shipment.countDocuments(candidateQuery(selectedActions));
};

export const processShipmentStatusDispatch = async ({ limit = DEFAULT_BATCH_LIMIT, dryRun = false, force = false, actions = [] } = {}) => {
    const startedAt = new Date();
    const effectiveLimit = normalizeLimit(limit);
    const selectedActions = normalizeActions(actions);
    if (paused && !force) {
        lastRun = {
            startedAt,
            finishedAt: new Date(),
            dryRun: Boolean(dryRun),
            actions: selectedActions,
            processed: 0,
            sent: 0,
            skipped: 0,
            paused: true,
            results: []
        };
        return lastRun;
    }

    const quota = force
        ? { allowed: true, limit: effectiveLimit, reason: 'force', forced: true }
        : await resolveDispatchQuota({ requestedLimit: effectiveLimit, now: startedAt });
    if (!quota.allowed) {
        lastRun = {
            startedAt,
            finishedAt: new Date(),
            dryRun: Boolean(dryRun),
            actions: selectedActions,
            processed: 0,
            sent: 0,
            skipped: 0,
            paused: false,
            quota,
            results: []
        };
        return lastRun;
    }

    const fetchLimit = Math.max((quota.limit || effectiveLimit) * 8, 50);
    const candidates = await Shipment.find(candidateQuery(selectedActions))
        .sort({ updatedAt: 1, createdAt: 1 })
        .limit(fetchLimit);
    const shipments = candidates
        .sort((a, b) => dispatchActionPriority(actionForShipment(a)) - dispatchActionPriority(actionForShipment(b)));

    const results = [];
    let sent = 0;
    let skipped = 0;
    let attemptedEligible = 0;
    const selectedActionSet = new Set(selectedActions);
    let refreshedBeforeSend = 0;
    const refreshLimit = dispatchRefreshBeforeSendLimit();

    const hourlySessionCounts = await countSuccessfulDispatchesBySession({
        since: new Date(startedAt.getTime() - (60 * 60 * 1000))
    });
    const dailySessionCounts = quota.forced ? new Map() : await countSuccessfulDispatchesBySession({
        since: dispatchDayRange(startedAt, dispatchTimeZone()).start
    });

    for (const shipment of shipments) {
        if (attemptedEligible >= (quota.limit || effectiveLimit)) break;
        const canaryDecision = canaryV75SchedulerShipmentAllowed(shipment);
        if (!canaryDecision.allowed) {
            skipped += 1;
            results.push({
                orderId: shipment.orderId,
                action: 'none',
                success: false,
                reason: canaryDecision.reason
            });
            continue;
        }
        let action = actionForShipment(shipment);
        const item = {
            orderId: shipment.orderId,
            phoneTail: String(shipment.client?.phone || '').replace(/\D/g, '').slice(-4),
            status: shipment.logistics?.status || '',
            action,
            success: false
        };

        if (dryRun) {
            const evidence = dropiPostSaleEvidenceV139(shipment);
            item.dropiEvidence = evidence.reason;
            if (!evidence.eligible) {
                item.reason = evidence.reason;
                skipped += 1;
                results.push(item);
                continue;
            }
            const preflight = await decidePostSaleNotification({
                shipment,
                kind: notificationKindForDispatchAction(action),
                acquireLock: false
            });
            item.preflightDecision = preflight.decision || '';
            if (preflight.decision !== POST_SALE_NOTIFICATION_DECISIONS.SHOULD_SEND) {
                item.reason = preflight.reason || 'preflight_not_eligible';
                skipped += 1;
                results.push(item);
                continue;
            }
            if (!postSaleTransactionalSafetyV116Enabled()) {
                attemptedEligible += 1;
                item.eligibleAttempt = true;
            }
            item.success = true;
            item.dryRun = true;
            results.push(item);
            continue;
        }

        let lockedShipment = null;
        try {
            lockedShipment = await lockShipmentForDispatch(shipment._id);
            if (!lockedShipment) {
                item.reason = 'dispatch_locked';
                skipped += 1;
                results.push(item);
                continue;
            }

            let shipmentForSend = lockedShipment;
            if (dispatchRefreshBeforeSendEnabled() && refreshedBeforeSend < refreshLimit) {
                refreshedBeforeSend += 1;
                const refresh = await refreshShipmentBeforeDispatch(shipmentForSend).catch((error) => ({
                    ok: false,
                    reason: 'sync_failed_before_dispatch',
                    error: error.message || 'sync_failed_before_dispatch'
                }));
                item.preDispatchSync = {
                    ok: Boolean(refresh?.ok),
                    skipped: Boolean(refresh?.skipped),
                    reason: refresh?.reason || '',
                    error: refresh?.error || '',
                    status: refresh?.status || '',
                    trackingNumber: refresh?.trackingNumber || '',
                    carrierRefresh: refresh?.carrierRefresh || null
                };
                if (refresh?.shipment) shipmentForSend = refresh.shipment;
                const refreshedAction = actionForShipment(shipmentForSend);
                if (refreshedAction !== action) {
                    action = refreshedAction;
                    item.action = action;
                    item.status = shipmentForSend.logistics?.status || '';
                }
            }
            const statusProjection = await persistDropiStatusProjectionV139({ shipment: shipmentForSend })
                .catch((error) => ({ ok: false, reason: error.message || 'dropi_status_projection_failed' }));
            item.statusProjection = statusProjection?.reason || '';
            if (statusProjection?.panel?.lead_id) item.adminLeadId = statusProjection.panel.lead_id;
            const evidence = dropiPostSaleEvidenceV139(shipmentForSend);
            item.dropiEvidence = evidence.reason;
            if (!evidence.eligible) {
                item.reason = evidence.reason;
                skipped += 1;
                results.push(item);
                await appendDispatchEvent(shipmentForSend._id, 'shipment_dispatch_attempt', {
                    action,
                    success: false,
                    reason: item.reason,
                    status: shipmentForSend.logistics?.status || '',
                    trackingNumber: shipmentForSend.logistics?.trackingNumber || ''
                });
                continue;
            }
            if (!action || action === 'none') {
                item.reason = 'no_action_after_status_sync';
                skipped += 1;
                results.push(item);
                await appendDispatchEvent(shipmentForSend._id, 'shipment_dispatch_attempt', {
                    action,
                    success: false,
                    reason: item.reason,
                    status: shipmentForSend.logistics?.status || '',
                    trackingNumber: shipmentForSend.logistics?.trackingNumber || '',
                    preDispatchSync: item.preDispatchSync || null
                });
                continue;
            }
            if (selectedActions.length && !selectedActionSet.has(action)) {
                item.reason = 'action_not_selected_after_status_sync';
                skipped += 1;
                results.push(item);
                await appendDispatchEvent(shipmentForSend._id, 'shipment_dispatch_attempt', {
                    action,
                    success: false,
                    reason: item.reason,
                    status: shipmentForSend.logistics?.status || '',
                    trackingNumber: shipmentForSend.logistics?.trackingNumber || '',
                    preDispatchSync: item.preDispatchSync || null
                });
                continue;
            }
            const preflight = await decidePostSaleNotification({
                shipment: shipmentForSend,
                kind: notificationKindForDispatchAction(action),
                acquireLock: false
            });
            item.preflightDecision = preflight.decision || '';
            if (preflight.decision !== POST_SALE_NOTIFICATION_DECISIONS.SHOULD_SEND) {
                item.reason = preflight.reason || 'preflight_not_eligible';
                skipped += 1;
                results.push(item);
                continue;
            }
            attemptedEligible += 1;
            item.eligibleAttempt = true;
            const sessionSelection = await resolveDispatchSessionForShipment({
                shipment: shipmentForSend,
                hourlySessionCounts,
                dailySessionCounts,
                now: startedAt
            });
            item.sessionId = sessionSelection.sessionId || '';
            item.sessionReason = sessionSelection.reason || '';
            if (!sessionSelection.ok) {
                item.reason = sessionSelection.reason || 'dispatch_session_unavailable';
                skipped += 1;
                results.push(item);
                await appendDispatchEvent(shipmentForSend._id, 'shipment_dispatch_attempt', {
                    action,
                    success: false,
                    reason: item.reason,
                    sessionId: item.sessionId,
                    status: shipmentForSend.logistics?.status || '',
                    trackingNumber: shipmentForSend.logistics?.trackingNumber || ''
                });
                continue;
            }
            if (postSaleTransactionalSafetyV116Enabled() && !force) {
                const customerId = String(
                    shipmentForSend?.raw?.historicalExternalReconciliation?.customerId
                    || shipmentForSend?.raw?.customerId
                    || `phone:${String(shipmentForSend?.client?.phone || '').replace(/\D/g, '')}`
                );
                const atomicQuota = await reservePostSaleDailyQuotaV116({
                    dayKey: quota.dayKey || dispatchDayRange(startedAt, dispatchTimeZone()).key,
                    timeZone: quota.timeZone || dispatchTimeZone(),
                    dailyLimit: quota.dailyLimit || dispatchDailyLimit(),
                    correlationId: preflight.idempotencyKey || `${shipmentForSend.orderId}:${action}`,
                    customerId,
                    orderId: shipmentForSend.orderId || '',
                    shipmentId: String(shipmentForSend._id || ''),
                    canonicalEvent: preflight.stage || notificationKindForDispatchAction(action),
                    templateId: preflight.variant || notificationKindForDispatchAction(action),
                    now: startedAt,
                    expiresAt: new Date(dispatchDayRange(startedAt, quota.timeZone || dispatchTimeZone()).end.getTime() + DAY_MS)
                });
                item.atomicQuota = {
                    reserved: atomicQuota.reserved,
                    reason: atomicQuota.reason,
                    dayKey: atomicQuota.dayKey || quota.dayKey || '',
                    used: atomicQuota.used || 0,
                    dailyLimit: atomicQuota.dailyLimit || quota.dailyLimit || 0
                };
                if (!atomicQuota.reserved) {
                    item.reason = atomicQuota.reason || 'daily_quota_not_reserved';
                    skipped += 1;
                    results.push(item);
                    continue;
                }
                attemptedEligible += 1;
                item.eligibleAttempt = true;
            }
            shipmentForSend.automation.sessionId = sessionSelection.sessionId;

            if (action === 'guide') {
                const result = await notifyShipmentGuideGenerated(shipmentForSend);
                item.success = Boolean(result?.success);
                item.reason = result?.reason || '';
            } else if (action === 'in_transit') {
                item.success = await notifyShipmentInTransit(shipmentForSend);
            } else if (action === 'ready_for_pickup') {
                item.success = await notifyReadyForPickup(shipmentForSend);
            } else if (action === 'returned') {
                item.success = await notifyShipmentReturned(shipmentForSend);
            } else if (action === 'delivered_bonus') {
                item.success = await markDeliveredAndNotifyBonus(shipmentForSend);
            } else {
                item.reason = 'no_action';
            }
            if (item.success) {
                hourlySessionCounts.set(sessionSelection.sessionId, (hourlySessionCounts.get(sessionSelection.sessionId) || 0) + 1);
                dailySessionCounts.set(sessionSelection.sessionId, (dailySessionCounts.get(sessionSelection.sessionId) || 0) + 1);
            }
            await appendDispatchEvent(shipmentForSend._id, 'shipment_dispatch_attempt', {
                action,
                success: Boolean(item.success),
                reason: item.reason || '',
                error: item.error || '',
                sessionId: sessionSelection.sessionId || '',
                sessionReason: sessionSelection.reason || '',
                status: shipmentForSend.logistics?.status || '',
                trackingNumber: shipmentForSend.logistics?.trackingNumber || '',
                preDispatchSync: item.preDispatchSync || null
            });
        } catch (error) {
            item.success = false;
            item.error = error.message || 'dispatch_failed';
            await appendDispatchEvent(shipment._id, 'shipment_dispatch_attempt', {
                action,
                success: false,
                error: item.error,
                status: shipment.logistics?.status || '',
                trackingNumber: shipment.logistics?.trackingNumber || ''
            }).catch(() => null);
        } finally {
            if (lockedShipment?._id) await releaseShipmentDispatchLock(lockedShipment._id);
        }

        if (item.success) sent += 1;
        else skipped += 1;
        results.push(item);
    }

    lastRun = {
        startedAt,
        finishedAt: new Date(),
        dryRun: Boolean(dryRun),
        actions: selectedActions,
        processed: results.length,
        sent,
        skipped,
        paused: false,
        quota,
        results
    };
    return lastRun;
};
