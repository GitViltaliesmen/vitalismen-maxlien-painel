import Shipment from '../models/Shipment.js';
import Order from '../models/Order.js';
import { syncOrderToOnlineAdminPanel } from './adminPanelStatusService.js';
import { getSenderPoolStatus, resolveOutboundSessionForJid } from '../whatsapp/sessionRouter.js';
import { toWhatsAppChatId } from '../utils/phone.js';
import {
    notifyPickupBonus,
    notifyShipmentInTransit,
    notifyReadyForPickup,
    notifyShipmentGuideGenerated,
    notifyShipmentReturned
} from './shipmentMessageService.js';
import { syncDroppiEcuadorFromPanel } from './droppiEcuadorBrowserService.js';

const DEFAULT_BATCH_LIMIT = Number.parseInt(process.env.SHIPMENT_STATUS_DISPATCH_BATCH_LIMIT || '5', 10);
const DISPATCH_LOCK_MS = Number.parseInt(process.env.SHIPMENT_STATUS_DISPATCH_LOCK_MS || '600000', 10);
const MIN_MESSAGE_GAP_MS = Number.parseInt(process.env.SHIPMENT_MIN_MESSAGE_GAP_MS || '1800000', 10);
const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTES_PER_DAY = 24 * 60;

let paused = process.env.SHIPMENT_STATUS_DISPATCH_ENABLED !== 'true';
let lastRun = null;

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

const resolveDispatchSessionForShipment = async ({
    shipment,
    hourlySessionCounts,
    dailySessionCounts,
    now = new Date()
} = {}) => {
    const perSessionLimit = dispatchHourlyLimitPerSession();
    const perSessionDailyLimit = dispatchDailyLimitPerSession();
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

    if (!dailyLimit) {
        return {
            allowed: true,
            limit: requestedLimit,
            reason: 'unlimited',
            dailyLimit: 0,
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

const candidateQuery = (actions = []) => {
    const actionSet = new Set(actions.length ? actions : ['guide', 'ready_for_pickup', 'delivered_bonus', 'returned']);
    const branches = [];
    if (actionSet.has('guide')) {
        branches.push({
            'logistics.status': { $nin: ['READY_FOR_PICKUP', 'ENTREGADO', 'DEVUELTO', 'CANCELADO', 'CANCELADO_SERVIENTREGA', 'CANCELADO SERVIENTREGA'] },
            'logistics.trackingNumber': { $exists: true, $ne: '' },
            'automation.guiaNotifiedAt': null
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
            'logistics.status': 'ENTREGADO',
            'automation.bonusNotifiedAt': null,
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

const refreshShipmentBeforeDispatch = async (shipment) => {
    if (!shouldRefreshShipmentBeforeDispatch(shipment)) {
        return { ok: false, skipped: true, reason: 'no_dropi_reference_or_final_status' };
    }
    const result = await syncDroppiEcuadorFromPanel({ shipment });
    const refreshed = await Shipment.findById(shipment._id);
    return {
        ok: Boolean(result?.ok),
        reason: result?.reason || '',
        status: refreshed?.logistics?.status || shipment.logistics?.status || '',
        trackingNumber: refreshed?.logistics?.trackingNumber || shipment.logistics?.trackingNumber || '',
        shipment: refreshed || shipment
    };
};

const actionForShipment = (shipment) => {
    const status = shipment?.logistics?.status || '';
    if (status === 'DEVUELTO') return 'returned';
    if (status === 'ENTREGADO') return 'delivered_bonus';
    if (status === 'READY_FOR_PICKUP') return 'ready_for_pickup';
    if (shipment?.logistics?.trackingNumber && !shipment?.automation?.guiaNotifiedAt) return 'guide';
    if (status === 'GUIA_GENERADA') return 'guide';
    if (['EN_RUTA', 'EN_REPARTO', 'EN_DESPACHO', 'EN_BODEGA_TRANSPORTADORA', 'MERCANCIA_RECOGIDA', 'EN_DISTRIBUCION_A_CLIENTE'].includes(status)) {
        return 'in_transit';
    }
    return 'none';
};

const orderStatusForShipmentAction = (action) => {
    if (action === 'delivered_bonus') return 'delivered';
    if (action === 'returned') return 'returned';
    if (action === 'guide' || action === 'in_transit' || action === 'ready_for_pickup') return 'shipped';
    return '';
};

const syncShipmentOrderToAdminPanel = async ({ shipment, action }) => {
    const nextStatus = orderStatusForShipmentAction(action);
    if (!nextStatus || !shipment?.orderId) return null;
    const order = await Order.findOne({ orderId: shipment.orderId });
    if (!order) return null;
    order.status = nextStatus;
    order.shippingStatus = shipment.logistics?.status || order.shippingStatus || '';
    if (shipment.logistics?.trackingNumber) order.trackingNumber = shipment.logistics.trackingNumber;
    await order.save();
    return syncOrderToOnlineAdminPanel(order, {
        status: nextStatus,
        action: `shipment_${action}`
    });
};

const markDeliveredAndNotifyBonus = async (shipment) => {
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
                'review.manualOnly': false,
                'review.reviewReason': '',
                'review.reviewStatus': 'delivered_confirmed_by_dropi_status'
            }
        }
    );
    await appendDispatchEvent(shipment._id, 'delivered_confirmed_by_dropi_status', {
        status: shipment.logistics?.status || '',
        trackingNumber: shipment.logistics?.trackingNumber || '',
        customerEligibility: 'released_for_new_order'
    });
    const refreshed = await Shipment.findById(shipment._id);
    const bonusSent = refreshed ? await notifyPickupBonus(refreshed) : false;
    return Boolean(bonusSent);
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
        .sort((a, b) => dispatchActionPriority(actionForShipment(a)) - dispatchActionPriority(actionForShipment(b)))
        .slice(0, quota.limit || effectiveLimit);

    const results = [];
    let sent = 0;
    let skipped = 0;
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
        let action = actionForShipment(shipment);
        const item = {
            orderId: shipment.orderId,
            phoneTail: String(shipment.client?.phone || '').replace(/\D/g, '').slice(-4),
            status: shipment.logistics?.status || '',
            action,
            success: false
        };

        if (dryRun) {
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
                    trackingNumber: refresh?.trackingNumber || ''
                };
                if (refresh?.shipment) shipmentForSend = refresh.shipment;
                const refreshedAction = actionForShipment(shipmentForSend);
                if (refreshedAction !== action) {
                    action = refreshedAction;
                    item.action = action;
                    item.status = shipmentForSend.logistics?.status || '';
                }
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
                const syncResult = await syncShipmentOrderToAdminPanel({ shipment: shipmentForSend, action });
                if (syncResult?.ok) item.adminLeadId = syncResult.lead_id;
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
        processed: shipments.length,
        sent,
        skipped,
        paused: false,
        quota,
        results
    };
    return lastRun;
};
