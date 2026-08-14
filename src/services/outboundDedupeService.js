import crypto from 'crypto';
import path from 'path';
import ContactState from '../models/ContactState.js';
import OutboundDedupe from '../models/OutboundDedupe.js';

const digitsOnly = (value) => String(value || '').replace(/\D/g, '');

const strictDedupeEnabled = () => (
    String(process.env.WHATSAPP_STRICT_OUTBOUND_DEDUPE_ENABLED || 'true').toLowerCase() !== 'false'
);

const normalizeText = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const sha1 = (value) => crypto.createHash('sha1').update(String(value || '')).digest('hex');
const staleReservedRetryMs = () => {
    const parsed = Number.parseInt(process.env.WHATSAPP_OUTBOUND_STALE_RESERVED_RETRY_MS || '600000', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 600000;
};
const semanticDedupeWindowMs = () => {
    const minutes = Number.parseInt(process.env.WHATSAPP_SEMANTIC_DEDUPE_WINDOW_MINUTES || '1440', 10);
    return Math.max(5, Number.isFinite(minutes) ? minutes : 1440) * 60 * 1000;
};

const looksLikeRealPhoneDigits = (value = '') => {
    const digits = digitsOnly(value);
    return /^(593|57|55)\d{8,13}$/.test(digits);
};

const phoneTailCandidates = (...values) => {
    const out = new Set();
    for (const value of values) {
        const digits = digitsOnly(value);
        if (!digits) continue;
        out.add(digits);
        if (digits.length >= 9) out.add(digits.slice(-9));
        if (digits.length >= 10) out.add(digits.slice(-10));
        if (digits.length >= 11) out.add(digits.slice(-11));
    }
    return [...out].filter((item) => item.length >= 7);
};

export const resolveOutboundPhoneDigits = async ({ jid = '', recipientDigits = '' } = {}) => {
    const direct = digitsOnly(recipientDigits);
    if (looksLikeRealPhoneDigits(direct)) return direct;

    const tails = phoneTailCandidates(recipientDigits, jid);
    const or = [];
    if (jid) {
        or.push({ chatId: jid });
        or.push({ 'metadata.linkedChatIds': jid });
    }
    for (const tail of tails) {
        or.push({ phoneDigits: { $regex: `${tail}$` } });
        or.push({ 'metadata.customerPhoneDigits': { $regex: `${tail}$` } });
        or.push({ 'metadata.lastSenderPn': { $regex: tail } });
    }

    const state = or.length
        ? await ContactState.findOne({ $or: or }).sort({ updatedAt: -1 }).lean().catch(() => null)
        : null;
    const stateDigits = digitsOnly(state?.phoneDigits)
        || digitsOnly(state?.metadata?.customerPhoneDigits)
        || digitsOnly(state?.metadata?.lastSenderPn);
    if (looksLikeRealPhoneDigits(stateDigits)) return stateDigits;

    const jidDigits = digitsOnly(jid);
    if (looksLikeRealPhoneDigits(jidDigits)) return jidDigits;
    return direct || jidDigits;
};

export const fingerprintOutbound = ({ kind, value }) => {
    if (kind === 'audio') {
        const normalizedPath = String(value || '').trim();
        const base = path.basename(normalizedPath).replace(/\.[^.]+$/i, '').toLowerCase();
        return sha1(`audio:${base || normalizedPath.toLowerCase()}`);
    }
    return sha1(`text:${normalizeText(value)}`);
};

const normalizeAntiSpamKey = (value = '') => normalizeText(value)
    .replace(/[^a-z0-9:_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 160);

const semanticFingerprintOutbound = ({ kind, antiSpamKey = '', windowMs = semanticDedupeWindowMs() }) => {
    const normalizedKey = normalizeAntiSpamKey(antiSpamKey);
    if (!normalizedKey) return '';
    const bucket = Math.floor(Date.now() / Math.max(1, windowMs));
    return sha1(`semantic:${kind}:${normalizedKey}:${bucket}`);
};

const reserveDedupeKey = async ({
    key,
    phoneDigits,
    jid,
    kind,
    fingerprint,
    label,
    sessionId
}) => {
    const row = await OutboundDedupe.create({
        key,
        phoneDigits,
        jid,
        kind,
        fingerprint,
        label: String(label || '').slice(0, 220),
        sessionId: sessionId || '',
        status: 'reserved',
        firstReservedAt: new Date()
    });
    return { allowed: true, rowId: row._id, key, phoneDigits, fingerprint };
};

const handleDuplicateReservation = async ({
    error,
    key,
    jid,
    sessionId,
    label,
    kind,
    phoneDigits,
    fingerprint,
    duplicateReason
}) => {
    if (error?.code !== 11000) {
        console.warn('[OUTBOUND-DEDUPE] falha ao reservar envio; bloqueando por seguranca:', error.message);
        return { allowed: false, reason: 'dedupe_reservation_failed', error: error.message };
    }
    const existing = await OutboundDedupe.findOne({ key }).lean().catch(() => null);
    const status = existing?.status || '';
    const reservedAt = existing?.firstReservedAt ? new Date(existing.firstReservedAt).getTime() : 0;
    const staleReserved = status === 'reserved' && reservedAt && (Date.now() - reservedAt >= staleReservedRetryMs());
    const retryableFailed = status === 'failed';
    if (staleReserved || retryableFailed) {
        await OutboundDedupe.updateOne(
            { key },
            {
                $set: {
                    jid,
                    sessionId: sessionId || '',
                    status: 'reserved',
                    firstReservedAt: new Date(),
                    label: String(label || '').slice(0, 220),
                    retryReason: staleReserved ? 'stale_reserved_retry' : 'failed_retry'
                },
                $inc: { retryCount: 1 }
            }
        ).catch(() => null);
        return {
            allowed: true,
            rowId: existing?._id,
            key,
            phoneDigits,
            fingerprint,
            retry: true,
            reason: staleReserved ? 'stale_reserved_retry' : 'failed_retry'
        };
    }
    return {
        allowed: false,
        reason: duplicateReason || `strict_duplicate_${kind}`,
        key,
        phoneDigits,
        fingerprint,
        status
    };
};

export const reserveOutboundOnce = async ({
    jid,
    recipientDigits = '',
    sessionId = '',
    kind,
    value,
    label = '',
    bypass = false,
    antiSpamKey = '',
    antiSpamWindowMs = semanticDedupeWindowMs()
}) => {
    if (!strictDedupeEnabled()) return { allowed: true, skipped: true, reason: 'disabled' };
    if (bypass) return { allowed: true, skipped: true, reason: 'bypassed' };
    const phoneDigits = await resolveOutboundPhoneDigits({ jid, recipientDigits });
    const fingerprint = fingerprintOutbound({ kind, value });
    if (!phoneDigits || !fingerprint) return { allowed: true, skipped: true, reason: 'missing_identity' };

    let semanticKey = '';
    let semanticReserved = null;
    const semanticFingerprint = semanticFingerprintOutbound({ kind, antiSpamKey, windowMs: antiSpamWindowMs });
    if (semanticFingerprint) {
        semanticKey = `${phoneDigits}:semantic:${kind}:${semanticFingerprint}`;
        try {
            semanticReserved = await reserveDedupeKey({
                key: semanticKey,
                phoneDigits,
                jid,
                kind,
                fingerprint: semanticFingerprint,
                label: `anti-spam:${normalizeAntiSpamKey(antiSpamKey)}`,
                sessionId
            });
        } catch (error) {
            return handleDuplicateReservation({
                error,
                key: semanticKey,
                jid,
                sessionId,
                label: `anti-spam:${normalizeAntiSpamKey(antiSpamKey)}`,
                kind,
                phoneDigits,
                fingerprint: semanticFingerprint,
                duplicateReason: `semantic_duplicate_${kind}`
            });
        }
    }

    const key = `${phoneDigits}:${kind}:${fingerprint}`;
    try {
        const row = await reserveDedupeKey({
            key,
            phoneDigits,
            jid,
            kind,
            fingerprint,
            label: label || value || '',
            sessionId
        });
        return { ...row, semanticKey: semanticReserved?.key || '' };
    } catch (error) {
        if (semanticReserved?.key) {
            await OutboundDedupe.deleteOne({ key: semanticReserved.key, status: 'reserved' }).catch(() => null);
        }
        return handleDuplicateReservation({
            error,
            key,
            jid,
            sessionId,
            label: label || value || '',
            kind,
            phoneDigits,
            fingerprint,
            duplicateReason: `strict_duplicate_${kind}`
        });
    }
};

export const markOutboundDedupeSent = async ({ key, semanticKey = '' }) => {
    const keys = [key, semanticKey].filter(Boolean);
    if (!keys.length) return;
    await OutboundDedupe.updateMany(
        { key: { $in: keys } },
        { $set: { status: 'sent', sentAt: new Date() } }
    ).catch(() => null);
};

export const markOutboundDedupeFailed = async ({ key, semanticKey = '', error = '' }) => {
    const keys = [key, semanticKey].filter(Boolean);
    if (!keys.length) return;
    await OutboundDedupe.updateMany(
        { key: { $in: keys } },
        { $set: { status: 'failed', failedAt: new Date(), error: String(error || '').slice(0, 500) } }
    ).catch(() => null);
};
