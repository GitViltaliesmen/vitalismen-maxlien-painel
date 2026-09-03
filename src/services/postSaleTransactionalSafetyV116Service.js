import crypto from 'node:crypto';
import PostSaleDispatchQuota from '../models/PostSaleDispatchQuota.js';

export const POST_SALE_TRANSACTIONAL_SAFETY_V116_VERSION = 116;
export const POST_SALE_TRANSACTIONAL_SAFETY_V116_FLAG = 'POST_SALE_TRANSACTIONAL_AT_MOST_ONCE_V116_ENABLED';

const clean = (value = '') => String(value ?? '').trim();

export const postSaleTransactionalSafetyV116Enabled = (env = process.env) => (
    clean(env[POST_SALE_TRANSACTIONAL_SAFETY_V116_FLAG]).toLowerCase() === 'true'
);

export const postSaleTransactionalOutbound = (options = {}, env = process.env) => (
    postSaleTransactionalSafetyV116Enabled(env)
    && clean(options?.outboundContext).startsWith('shipment_')
);

export const classifyPostSaleProviderFailureV116 = (error = {}) => {
    const httpStatus = Number(error?.response?.status || error?.statusCode || 0);
    const code = clean(error?.code).toUpperCase();
    const message = clean(error?.message || error?.response?.data?.message || 'provider_send_failed');
    const timeout = code.includes('TIMEOUT') || /timeout|timed out|aborted/i.test(message);
    const providerResponded = Boolean(error?.response);
    const definiteRejection = providerResponded && httpStatus >= 400 && httpStatus < 500 && ![408, 409, 425, 429].includes(httpStatus);
    return Object.freeze({
        providerAttempted: true,
        ambiguous: !definiteRejection,
        terminalState: definiteRejection ? 'FAILED_FINAL' : 'AMBIGUOUS',
        providerStatus: definiteRejection ? 'rejected' : 'ambiguous',
        httpStatus,
        timeout,
        reason: message.slice(0, 500)
    });
};

export const postSaleFailureDispositionV116 = (sendResult = {}) => {
    if (sendResult?.ok === true || sendResult === true) {
        return Object.freeze({ terminal: false, terminalState: '', reason: '' });
    }
    if (sendResult?.providerAttempted === true) {
        return Object.freeze({
            terminal: true,
            terminalState: sendResult?.ambiguous === false ? 'FAILED_FINAL' : 'AMBIGUOUS',
            reason: clean(sendResult?.error || sendResult?.reason || 'provider_attempt_not_confirmed'),
            providerStatus: clean(sendResult?.providerStatus || (sendResult?.ambiguous === false ? 'rejected' : 'ambiguous')),
            correlationId: clean(sendResult?.correlationId),
            providerMessageId: clean(sendResult?.providerMessageId || sendResult?.providerZaapId)
        });
    }
    return Object.freeze({
        terminal: true,
        terminalState: 'FAILED_FINAL',
        reason: clean(sendResult?.error || sendResult?.reason || 'outbound_pre_provider_blocked'),
        providerStatus: clean(sendResult?.providerStatus || 'blocked'),
        correlationId: clean(sendResult?.correlationId),
        providerMessageId: ''
    });
};

export const buildPostSaleQuotaIdV116 = ({ dayKey = '', timeZone = '' } = {}) => {
    const identity = `${clean(dayKey)}|${clean(timeZone)}`;
    return `post-sale-v116:${crypto.createHash('sha256').update(identity).digest('hex')}`;
};

export const reservePostSaleDailyQuotaV116 = async ({
    dayKey,
    timeZone,
    dailyLimit,
    correlationId,
    now = new Date(),
    expiresAt,
    quotaModel = PostSaleDispatchQuota
} = {}) => {
    const limit = Number.parseInt(String(dailyLimit || ''), 10);
    if (!clean(dayKey) || !clean(timeZone) || !Number.isFinite(limit) || limit <= 0) {
        return Object.freeze({ reserved: false, reason: 'invalid_quota_identity_or_limit' });
    }
    const quotaId = buildPostSaleQuotaIdV116({ dayKey, timeZone });
    const expiry = expiresAt instanceof Date && !Number.isNaN(expiresAt.getTime())
        ? expiresAt
        : new Date(now.getTime() + (48 * 60 * 60 * 1000));
    try {
        const row = await quotaModel.findOneAndUpdate(
            { _id: quotaId, reserved: { $lt: limit } },
            {
                $setOnInsert: {
                    dayKey: clean(dayKey),
                    timeZone: clean(timeZone),
                    expiresAt: expiry
                },
                $set: {
                    limit,
                    lastReservationAt: now,
                    lastCorrelationId: clean(correlationId)
                },
                $inc: { reserved: 1 }
            },
            { new: true, upsert: true, setDefaultsOnInsert: false }
        );
        const used = Number(row?.reserved || 0);
        return Object.freeze({
            reserved: Boolean(row) && used > 0 && used <= limit,
            reason: row ? 'quota_reserved_atomically' : 'daily_quota_exhausted',
            quotaId,
            dayKey: clean(dayKey),
            dailyLimit: limit,
            used
        });
    } catch (error) {
        if (error?.code === 11000) {
            return Object.freeze({
                reserved: false,
                reason: 'daily_quota_exhausted',
                quotaId,
                dayKey: clean(dayKey),
                dailyLimit: limit
            });
        }
        throw error;
    }
};

export default reservePostSaleDailyQuotaV116;
