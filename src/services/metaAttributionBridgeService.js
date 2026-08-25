import crypto from 'crypto';
import VslVisit from '../models/VslVisit.js';
import MetaAttributionCorrelation from '../models/MetaAttributionCorrelation.js';
import {
    hasMetaAdAttribution,
    metaAttributionTrackingFromVisit
} from './metaAttributionService.js';

const digitsOnly = (value = '') => String(value || '').replace(/\D/g, '');

export const normalizeVslAttributionMessage = (value = '') => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const visitMessageValues = (visit = {}) => [
    visit.lastWhatsappMessage,
    visit.lastEntryMessage,
    visit.vslEntryMessage
].map(normalizeVslAttributionMessage).filter(Boolean);

const visitClickTime = (visit = {}) => new Date(visit.lastClickAt || 0).getTime();

export const selectUniqueVslAttributionCandidate = ({
    visits = [],
    country = 'EC',
    message = '',
    inboundAt = new Date(),
    windowMs = 2 * 60 * 1000,
    futureToleranceMs = 30 * 1000
} = {}) => {
    const normalizedMessage = normalizeVslAttributionMessage(message);
    const normalizedCountry = String(country || '').trim().toUpperCase();
    const inboundTime = new Date(inboundAt).getTime();
    if (!normalizedMessage) return { ok: false, reason: 'missing_message', candidates: [] };
    if (!Number.isFinite(inboundTime)) return { ok: false, reason: 'invalid_inbound_time', candidates: [] };

    const candidates = visits.filter((visit) => {
        const visitCountry = String(visit.country || '').trim().toUpperCase();
        if (visitCountry && visitCountry !== normalizedCountry) return false;
        const clickTime = visitClickTime(visit);
        if (!Number.isFinite(clickTime)) return false;
        if (clickTime < inboundTime - windowMs || clickTime > inboundTime + futureToleranceMs) return false;
        if (!hasMetaAdAttribution(visit.tracking || {})) return false;
        return visitMessageValues(visit).includes(normalizedMessage);
    });

    if (!candidates.length) return { ok: false, reason: 'no_unique_exact_visit', candidates: [] };
    if (candidates.length > 1) return { ok: false, reason: 'ambiguous_exact_visit', candidates };
    return { ok: true, candidate: candidates[0], candidates };
};

const attributionClaimSnapshot = (visit = {}) => ({
    visitId: visit?._id?.toString?.() || '',
    visitorKey: String(visit.visitorKey || ''),
    visitorId: String(visit.visitorId || ''),
    sourceUrl: String(visit.sourceUrl || ''),
    productKey: String(visit.productKey || ''),
    vslTestId: String(visit.vslTestId || ''),
    vslVariant: String(visit.vslVariant || ''),
    tracking: metaAttributionTrackingFromVisit(visit)
});

export const metaAttributionCorrelationStatus = (result = {}) => {
    if (result.ok && result.claimed) return 'CLAIMED';
    if (result.reason === 'ambiguous_exact_visit') return 'AMBIGUOUS';
    return 'UNMATCHED';
};

const correlationHash = (value = '') => crypto.createHash('sha256')
    .update(String(value || ''))
    .digest('hex');

export const recordMetaAttributionCorrelation = async ({
    result = {},
    country = 'EC',
    phone = '',
    message = '',
    inboundAt = new Date(),
    windowMs = 2 * 60 * 1000,
    candidate = null,
    CorrelationModel = MetaAttributionCorrelation
} = {}) => {
    const normalizedCountry = String(country || '').trim().toUpperCase();
    if (normalizedCountry !== 'EC') return { ok: false, skipped: true, reason: 'unsupported_country' };
    const phoneDigits = digitsOnly(phone);
    const normalizedMessage = normalizeVslAttributionMessage(message);
    const status = metaAttributionCorrelationStatus(result);
    const record = {
        country: 'EC',
        status,
        reason: String(result.reason || (status === 'CLAIMED' ? 'exact_message_unique_120s' : 'unmatched')),
        candidateCount: Math.max(0, Number(result.candidateCount ?? result.candidates?.length ?? (candidate ? 1 : 0)) || 0),
        phoneHash: phoneDigits ? correlationHash(phoneDigits) : '',
        messageHash: normalizedMessage ? correlationHash(normalizedMessage) : '',
        visitorKey: String(candidate?.visitorKey || result.visitorKey || ''),
        visitId: candidate?._id || result.visitId || null,
        productKey: String(candidate?.productKey || result.productKey || ''),
        funnel: String(candidate?.funnel || candidate?.tracking?.funnel || result.funnel || ''),
        source: 'zapi_exact_message_unique_120s',
        windowMs,
        inboundAt: new Date(inboundAt),
        evaluatedAt: new Date()
    };
    try {
        await CorrelationModel.create(record);
        console.info(`[META-ATTRIBUTION] ${status} candidates=${record.candidateCount} reason=${record.reason}`);
        return { ok: true, status, record };
    } catch (error) {
        console.warn(`[META-ATTRIBUTION] audit_write_failed status=${status} reason=${error.message || 'unknown'}`);
        return { ok: false, status, error: 'correlation_audit_write_failed' };
    }
};

export const claimMetaAttributionForInboundWhatsapp = async ({
    country = 'EC',
    phone = '',
    message = '',
    inboundAt = new Date(),
    windowMs = 2 * 60 * 1000,
    VisitModel = VslVisit,
    CorrelationModel = MetaAttributionCorrelation
} = {}) => {
    const normalizedCountry = String(country || '').trim().toUpperCase();
    if (normalizedCountry !== 'EC') return { ok: false, skipped: true, reason: 'unsupported_country' };

    const phoneDigits = digitsOnly(phone);
    const phoneTail = phoneDigits.slice(-9);
    const normalizedMessage = normalizeVslAttributionMessage(message);
    const inboundDate = new Date(inboundAt);
    const inboundTime = inboundDate.getTime();
    const audit = async (result, candidate = null) => {
        await recordMetaAttributionCorrelation({
            result,
            country: normalizedCountry,
            phone: phoneDigits,
            message: normalizedMessage,
            inboundAt: inboundDate,
            windowMs,
            candidate,
            CorrelationModel
        });
        return result;
    };
    if (phoneTail.length !== 9) return audit({ ok: false, skipped: true, reason: 'invalid_phone', candidateCount: 0 });
    if (!normalizedMessage) return audit({ ok: false, skipped: true, reason: 'missing_message', candidateCount: 0 });
    if (!Number.isFinite(inboundTime)) return audit({ ok: false, skipped: true, reason: 'invalid_inbound_time', candidateCount: 0 });

    const visits = await VisitModel.find({
        country: 'EC',
        lastClickAt: {
            $gte: new Date(inboundTime - windowMs),
            $lte: new Date(inboundTime + 30 * 1000)
        },
        clickCount: { $gt: 0 }
    }).sort({ lastClickAt: -1 }).lean();

    const selection = selectUniqueVslAttributionCandidate({
        visits,
        country: normalizedCountry,
        message,
        inboundAt: inboundDate,
        windowMs
    });
    if (!selection.ok) {
        return audit({
            ok: false,
            skipped: true,
            reason: selection.reason,
            candidateCount: selection.candidates.length
        });
    }

    const candidate = selection.candidate;
    const existingPhoneTail = digitsOnly(candidate.customerPhone).slice(-9);
    if (existingPhoneTail && existingPhoneTail !== phoneTail) {
        return audit({ ok: false, skipped: true, reason: 'visit_claimed_by_other_phone', candidateCount: 1 }, candidate);
    }

    const messageHash = crypto.createHash('sha256').update(normalizedMessage).digest('hex');
    const phoneHash = crypto.createHash('sha256').update(phoneDigits).digest('hex');
    const claimedAt = new Date();
    const updated = await VisitModel.findOneAndUpdate(
        {
            _id: candidate._id,
            $or: [
                { customerPhone: '' },
                { customerPhone: { $exists: false } },
                { customerPhone: { $regex: `${phoneTail}$` } }
            ]
        },
        {
            $set: {
                customerPhone: phoneDigits,
                attributionClaimedAt: claimedAt,
                attributionClaimSource: 'zapi_exact_message_unique_120s',
                attributionClaimPhoneHash: phoneHash,
                attributionClaimMessageHash: messageHash,
                attributionClaimInboundAt: inboundDate
            }
        },
        { new: true }
    ).lean();

    if (!updated) return audit({ ok: false, skipped: true, reason: 'claim_conflict', candidateCount: 1 }, candidate);
    const result = {
        ok: true,
        claimed: true,
        confidence: 'exact_message_unique_120s',
        claimedAt,
        ...attributionClaimSnapshot(updated)
    };
    await audit({ ...result, candidateCount: 1 }, updated);
    return result;
};
