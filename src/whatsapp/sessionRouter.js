import { getAllStatuses } from './connection.js';
import ContactState from '../models/ContactState.js';

const senderStats = new Map();
const recipientAffinity = new Map();

const digitsOnly = (value) => String(value || '').replace(/\D/g, '');

const parseList = (value) => String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const parseNumber = (name, fallback) => {
    const value = Number.parseInt(String(process.env[name] || ''), 10);
    return Number.isFinite(value) && value > 0 ? value : fallback;
};

const parseWeightValue = (value) => {
    const parsed = Number.parseFloat(String(value || '').replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) return 1;
    return Math.min(10, Math.max(0.05, parsed));
};

const parseLimitValue = (value) => {
    const parsed = Number.parseInt(String(value || ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const rotationEnabled = () => String(process.env.WHATSAPP_ROTATION_ENABLED || '').toLowerCase() === 'true';
const defaultSessionId = () => process.env.WHATSAPP_DEFAULT_SESSION_ID || 'default';

const configuredSessionIds = () => {
    const ids = parseList(process.env.WHATSAPP_SESSION_IDS);
    const defaultId = defaultSessionId();
    if (!ids.includes(defaultId)) ids.unshift(defaultId);
    return [...new Set(ids)];
};

const sessionDailyLimit = () => parseNumber('WHATSAPP_SENDER_DAILY_LIMIT', 120);
const sessionHourlyLimit = () => parseNumber('WHATSAPP_SENDER_HOURLY_LIMIT', 30);
const sessionMinGapMs = () => parseNumber('WHATSAPP_SENDER_MIN_GAP_MS', 45000);
const affinityTtlMs = () => parseNumber('WHATSAPP_SENDER_AFFINITY_DAYS', 7) * 24 * 60 * 60 * 1000;

const senderWeights = () => {
    const entries = parseList(process.env.WHATSAPP_SENDER_WEIGHTS);
    return entries
        .map((entry) => {
            const match = entry.match(/^([^:=]+)\s*[:=]\s*([0-9]+(?:[.,][0-9]+)?)$/);
            if (!match) return null;
            return {
                sessionId: match[1].trim(),
                digits: digitsOnly(match[1]),
                weight: parseWeightValue(match[2])
            };
        })
        .filter(Boolean);
};

const senderLimitOverrides = () => {
    const entries = parseList(process.env.WHATSAPP_SENDER_DAILY_LIMITS || process.env.WHATSAPP_SENDER_DAILY_LIMIT_OVERRIDES);
    return entries
        .map((entry) => {
            const match = entry.match(/^([^:=]+)\s*[:=]\s*([0-9]+)$/);
            if (!match) return null;
            const limit = parseLimitValue(match[2]);
            if (!limit) return null;
            return {
                sessionId: match[1].trim(),
                digits: digitsOnly(match[1]),
                limit
            };
        })
        .filter(Boolean);
};

const sessionDailyLimitOverride = (sessionId) => {
    const overrides = senderLimitOverrides();
    const match = overrides.find((item) => isSameSession(item.sessionId, sessionId) || isSameSession(item.digits, sessionId));
    return match?.limit || null;
};

const sessionWeight = (sessionId) => {
    const weights = senderWeights();
    const match = weights.find((item) => isSameSession(item.sessionId, sessionId) || isSameSession(item.digits, sessionId));
    return match?.weight || 1;
};

const effectiveDailyLimit = (sessionId) => sessionDailyLimitOverride(sessionId)
    || Math.max(1, Math.floor(sessionDailyLimit() * sessionWeight(sessionId)));
const effectiveHourlyLimit = (sessionId) => Math.max(1, Math.floor(sessionHourlyLimit() * sessionWeight(sessionId)));

const dayKey = (date = new Date()) => date.toISOString().slice(0, 10);
const hourKey = (date = new Date()) => date.toISOString().slice(0, 13);

const getStats = (sessionId) => {
    const id = String(sessionId || defaultSessionId());
    if (!senderStats.has(id)) {
        senderStats.set(id, {
            sessionId: id,
            day: dayKey(),
            hour: hourKey(),
            sentToday: 0,
            clientsToday: new Set(),
            sentThisHour: 0,
            lastSentAt: 0,
            lastRecipient: '',
            pausedUntil: 0,
            pauseReason: ''
        });
    }

    const stats = senderStats.get(id);
    const currentDay = dayKey();
    const currentHour = hourKey();
    if (stats.day !== currentDay) {
        stats.day = currentDay;
        stats.sentToday = 0;
        stats.clientsToday = new Set();
    }
    if (stats.hour !== currentHour) {
        stats.hour = currentHour;
        stats.sentThisHour = 0;
    }
    return stats;
};

const isPausedByEnv = (sessionId) => {
    const paused = parseList(process.env.WHATSAPP_PAUSED_SESSION_IDS).map(digitsOnly);
    const id = digitsOnly(sessionId);
    return Boolean(id && paused.some((item) => item === id || item.endsWith(id) || id.endsWith(item)));
};

const isHealthyStatus = (status) => status?.isReady && status?.status === 'connected';

const isSameSession = (left, right) => {
    const a = String(left || '').trim();
    const b = String(right || '').trim();
    if (!a || !b) return false;
    if (a === b) return true;
    const ad = digitsOnly(a);
    const bd = digitsOnly(b);
    return Boolean(ad && bd && (ad === bd || ad.endsWith(bd) || bd.endsWith(ad)));
};

const sessionCapacity = (sessionId) => {
    const stats = getStats(sessionId);
    const now = Date.now();
    const dailyOverride = sessionDailyLimitOverride(sessionId);
    if (isPausedByEnv(sessionId)) return { ok: false, reason: 'paused_by_env' };
    if (stats.pausedUntil && stats.pausedUntil > now) return { ok: false, reason: stats.pauseReason || 'paused' };
    if (dailyOverride && (stats.clientsToday?.size || 0) >= dailyOverride) return { ok: false, reason: 'daily_client_limit' };
    if (!dailyOverride && stats.sentToday >= effectiveDailyLimit(sessionId)) return { ok: false, reason: 'daily_limit' };
    if (stats.sentThisHour >= effectiveHourlyLimit(sessionId)) return { ok: false, reason: 'hourly_limit' };
    if (stats.lastSentAt && now - stats.lastSentAt < sessionMinGapMs()) return { ok: false, reason: 'min_gap' };
    return { ok: true, reason: 'ok' };
};

const sessionWalletCapacity = (sessionId) => {
    const stats = getStats(sessionId);
    const now = Date.now();
    const dailyOverride = sessionDailyLimitOverride(sessionId);
    if (isPausedByEnv(sessionId)) return { ok: false, reason: 'paused_by_env' };
    if (stats.pausedUntil && stats.pausedUntil > now) return { ok: false, reason: stats.pauseReason || 'paused' };
    if (dailyOverride && (stats.clientsToday?.size || 0) >= dailyOverride) return { ok: false, reason: 'daily_client_limit' };
    if (!dailyOverride && stats.sentToday >= effectiveDailyLimit(sessionId)) return { ok: false, reason: 'daily_limit' };
    if (stats.sentThisHour >= effectiveHourlyLimit(sessionId)) return { ok: false, reason: 'hourly_limit' };
    return { ok: true, reason: 'wallet_ok' };
};

const cleanupAffinity = () => {
    const now = Date.now();
    for (const [recipient, item] of recipientAffinity.entries()) {
        if (!item?.sessionId || now - (item.updatedAt || 0) > affinityTtlMs()) {
            recipientAffinity.delete(recipient);
        }
    }
};

const scoreSession = (status) => {
    const stats = getStats(status.sessionId);
    const weight = sessionWeight(status.sessionId);
    return ((stats.sentToday / weight) * 1000)
        + ((stats.sentThisHour / weight) * 100)
        + ((stats.lastSentAt || 0) / 1000000000000);
};

const getHealthyConfiguredStatuses = () => {
    const statuses = getAllStatuses();
    const configured = configuredSessionIds();
    return statuses
        .filter((status) => configured.some((sessionId) => isSameSession(sessionId, status.sessionId)))
        .filter(isHealthyStatus);
};

const findHealthyStatus = (sessionId, statuses = getHealthyConfiguredStatuses()) => {
    return statuses.find((status) => isSameSession(status.sessionId, sessionId)) || null;
};

const isSessionUsableForWallet = (sessionId, statuses = getHealthyConfiguredStatuses()) => {
    const status = findHealthyStatus(sessionId, statuses);
    if (!status) return { ok: false, reason: 'session_not_ready' };
    const capacity = sessionWalletCapacity(status.sessionId);
    return capacity.ok
        ? { ok: true, sessionId: status.sessionId, reason: capacity.reason }
        : { ok: false, sessionId: status.sessionId, reason: capacity.reason };
};

const chooseFailoverSession = ({ avoidSessionId = '', recipient = '' } = {}) => {
    const healthy = getHealthyConfiguredStatuses();
    const available = healthy
        .map((status) => ({ status, capacity: sessionCapacity(status.sessionId) }))
        .filter((item) => item.capacity.ok && !isSameSession(item.status.sessionId, avoidSessionId))
        .sort((a, b) => scoreSession(a.status) - scoreSession(b.status));

    const selected = available[0]?.status?.sessionId;
    if (selected) return { sessionId: selected, reason: avoidSessionId ? 'failover_available' : 'least_used_available' };

    const walletAvailable = healthy
        .map((status) => ({ status, capacity: sessionWalletCapacity(status.sessionId) }))
        .filter((item) => item.capacity.ok && !isSameSession(item.status.sessionId, avoidSessionId))
        .sort((a, b) => scoreSession(a.status) - scoreSession(b.status));

    const walletSelected = walletAvailable[0]?.status?.sessionId;
    if (walletSelected) return { sessionId: walletSelected, reason: avoidSessionId ? 'failover_wallet_available' : 'wallet_available' };

    return { sessionId: defaultSessionId(), reason: 'fallback_default' };
};

const contactQueryForJid = (jid = '') => {
    const digits = digitsOnly(jid);
    const tail = digits.length >= 8 ? digits.slice(-10) : digits;
    return {
        $or: [
            { chatId: jid },
            ...(tail ? [{ phoneDigits: { $regex: `${tail}$` } }] : [])
        ]
    };
};

const findContactStateForJid = async (jid = '') => {
    if (!jid) return null;
    try {
        return await ContactState.findOne(contactQueryForJid(jid)).sort({ updatedAt: -1 });
    } catch (error) {
        console.warn(`[SESSION-ROUTER] falha ao consultar carteira do contato ${jid}: ${error.message}`);
        return null;
    }
};

const persistWalletAssignment = async ({
    jid = '',
    requestedSessionId = '',
    resolvedSessionId = '',
    reason = '',
    failoverFromSessionId = ''
} = {}) => {
    const recipient = digitsOnly(jid);
    if (!recipient || !resolvedSessionId) return;

    recipientAffinity.set(recipient, { sessionId: resolvedSessionId, updatedAt: Date.now() });

    try {
        await ContactState.updateOne(
            contactQueryForJid(jid),
            {
                $set: {
                    phoneDigits: recipient,
                    'metadata.lastSessionId': resolvedSessionId,
                    'metadata.senderWallet.assignedSessionId': resolvedSessionId,
                    'metadata.senderWallet.lastResolvedAt': new Date(),
                    'metadata.senderWallet.lastResolutionReason': reason,
                    'metadata.senderWallet.stickyUntilDelivery': true,
                    ...(requestedSessionId ? { 'metadata.senderWallet.lastRequestedSessionId': requestedSessionId } : {}),
                    ...(failoverFromSessionId ? {
                        'metadata.senderWallet.failoverFromSessionId': failoverFromSessionId,
                        'metadata.senderWallet.lastFailoverAt': new Date()
                    } : {})
                },
                $setOnInsert: {
                    chatId: jid,
                    countryCode: 'EC',
                    assignedAgent: 'vit_power_ec',
                    'metadata.senderWallet.assignedAt': new Date()
                }
            },
            { upsert: true }
        );
    } catch (error) {
        console.warn(`[SESSION-ROUTER] falha ao gravar carteira do contato ${jid}: ${error.message}`);
    }
};

export const resolveOutboundSession = ({ requestedSessionId = null, jid = '' } = {}) => {
    const explicit = String(requestedSessionId || '').trim();
    if (explicit) {
        if (!rotationEnabled()) return { sessionId: explicit, reason: 'explicit' };
        const usability = isSessionUsableForWallet(explicit);
        if (usability.ok) return { sessionId: usability.sessionId, reason: 'explicit_wallet' };
        const failover = chooseFailoverSession({ avoidSessionId: explicit, recipient: digitsOnly(jid) });
        return { ...failover, reason: `${failover.reason}_from_explicit_${usability.reason}` };
    }

    if (!rotationEnabled()) {
        return { sessionId: defaultSessionId(), reason: 'rotation_disabled_default' };
    }

    cleanupAffinity();
    const recipient = digitsOnly(jid);
    const healthy = getHealthyConfiguredStatuses();

    const affinity = recipient ? recipientAffinity.get(recipient) : null;
    if (affinity?.sessionId) {
        const usability = isSessionUsableForWallet(affinity.sessionId, healthy);
        if (usability.ok) {
            return { sessionId: usability.sessionId, reason: 'recipient_affinity' };
        }
    }

    const available = healthy
        .map((status) => ({ status, capacity: sessionCapacity(status.sessionId) }))
        .filter((item) => item.capacity.ok)
        .sort((a, b) => scoreSession(a.status) - scoreSession(b.status));

    const chosen = available[0]?.status?.sessionId || defaultSessionId();
    if (recipient && chosen) {
        recipientAffinity.set(recipient, { sessionId: chosen, updatedAt: Date.now() });
    }

    return {
        sessionId: chosen,
        reason: available[0] ? 'least_used_available' : 'fallback_default'
    };
};

export const resolveOutboundSessionForJid = async ({ requestedSessionId = null, jid = '' } = {}) => {
    const explicit = String(requestedSessionId || '').trim();

    if (!rotationEnabled()) {
        const route = resolveOutboundSession({ requestedSessionId, jid });
        if (jid && route.sessionId) {
            await persistWalletAssignment({
                jid,
                requestedSessionId: explicit,
                resolvedSessionId: route.sessionId,
                reason: route.reason
            });
        }
        return route;
    }

    if (explicit) {
        const route = resolveOutboundSession({ requestedSessionId: explicit, jid });
        await persistWalletAssignment({
            jid,
            requestedSessionId: explicit,
            resolvedSessionId: route.sessionId,
            reason: route.reason,
            failoverFromSessionId: isSameSession(route.sessionId, explicit) ? '' : explicit
        });
        return route;
    }

    const state = await findContactStateForJid(jid);
    const walletClosedAfterDelivery = state?.metadata?.senderWallet?.stickyUntilDelivery === false
        && state?.metadata?.senderWallet?.deliveredAt;
    const walletSessionId = !walletClosedAfterDelivery && (state?.metadata?.senderWallet?.assignedSessionId
        || state?.metadata?.lastSessionId
        || '');

    if (walletSessionId) {
        const usability = isSessionUsableForWallet(walletSessionId);
        if (usability.ok) {
            const route = { sessionId: usability.sessionId, reason: 'persistent_wallet' };
            await persistWalletAssignment({
                jid,
                requestedSessionId: walletSessionId,
                resolvedSessionId: route.sessionId,
                reason: route.reason
            });
            return route;
        }

        const failover = chooseFailoverSession({ avoidSessionId: walletSessionId, recipient: digitsOnly(jid) });
        await persistWalletAssignment({
            jid,
            requestedSessionId: walletSessionId,
            resolvedSessionId: failover.sessionId,
            reason: `${failover.reason}_from_persistent_${usability.reason}`,
            failoverFromSessionId: walletSessionId
        });
        return { ...failover, reason: `${failover.reason}_from_persistent_${usability.reason}` };
    }

    const route = resolveOutboundSession({ requestedSessionId: null, jid });
    await persistWalletAssignment({
        jid,
        resolvedSessionId: route.sessionId,
        reason: route.reason
    });
    return route;
};

export const recordOutboundSend = ({ sessionId, jid = '' } = {}) => {
    const id = sessionId || defaultSessionId();
    const stats = getStats(id);
    stats.sentToday += 1;
    stats.sentThisHour += 1;
    stats.lastSentAt = Date.now();
    stats.lastRecipient = digitsOnly(jid);
    if (stats.lastRecipient) {
        if (!(stats.clientsToday instanceof Set)) stats.clientsToday = new Set();
        stats.clientsToday.add(stats.lastRecipient);
        recipientAffinity.set(stats.lastRecipient, { sessionId: id, updatedAt: Date.now() });
    }
};

export const markSenderWalletDelivered = async ({ jid = '', phone = '' } = {}) => {
    const target = jid || (phone ? `${digitsOnly(phone)}@s.whatsapp.net` : '');
    if (!target) return false;
    try {
        const result = await ContactState.updateOne(
            contactQueryForJid(target),
            {
                $set: {
                    'metadata.senderWallet.deliveredAt': new Date(),
                    'metadata.senderWallet.stickyUntilDelivery': false,
                    'metadata.senderWallet.deliveryResolution': 'delivered_or_picked_up'
                }
            }
        );
        return result.modifiedCount > 0;
    } catch (error) {
        console.warn(`[SESSION-ROUTER] falha ao marcar entrega da carteira ${target}: ${error.message}`);
        return false;
    }
};

export const getSenderPoolStatus = () => {
    cleanupAffinity();
    const statuses = getAllStatuses();
    const configured = configuredSessionIds();
    return {
        rotationEnabled: rotationEnabled(),
        defaultSessionId: defaultSessionId(),
        configuredSessionIds: configured,
        limits: {
            daily: sessionDailyLimit(),
            hourly: sessionHourlyLimit(),
            minGapMs: sessionMinGapMs(),
            affinityDays: parseNumber('WHATSAPP_SENDER_AFFINITY_DAYS', 7),
            weights: senderWeights().map((item) => ({
                sessionId: item.sessionId,
                weight: item.weight
            })),
            dailyOverrides: senderLimitOverrides().map((item) => ({
                sessionId: item.sessionId,
                limit: item.limit
            }))
        },
        sessions: configured.map((sessionId) => {
            const status = statuses.find((item) => item.sessionId === sessionId) || { sessionId, status: 'not_started', isReady: false };
            const stats = getStats(sessionId);
            const capacity = sessionCapacity(sessionId);
            return {
                sessionId,
                connected: isHealthyStatus(status),
                status: status.status,
                ownPhoneDigits: status.ownPhoneDigits || '',
                weight: sessionWeight(sessionId),
                effectiveDailyLimit: effectiveDailyLimit(sessionId),
                effectiveHourlyLimit: effectiveHourlyLimit(sessionId),
                capacity,
                sentToday: stats.sentToday,
                clientsToday: stats.clientsToday?.size || 0,
                sentThisHour: stats.sentThisHour,
                lastSentAt: stats.lastSentAt ? new Date(stats.lastSentAt).toISOString() : null,
                lastRecipient: stats.lastRecipient || ''
            };
        }),
        affinityCount: recipientAffinity.size
    };
};
