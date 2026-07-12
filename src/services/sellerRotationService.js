import SellerRotationCounter from '../models/SellerRotationCounter.js';
import ContactState from '../models/ContactState.js';
import { getAllStatuses } from '../whatsapp/connection.js';

const digitsOnly = (value) => String(value || '').replace(/\D/g, '');

const parseList = (value) => String(value || '')
    .split(/[,\s;]+/)
    .map((item) => digitsOnly(item))
    .filter(Boolean);

const isSamePhone = (left, right) => {
    const a = digitsOnly(left);
    const b = digitsOnly(right);
    if (!a || !b) return false;
    return a === b || a.endsWith(b) || b.endsWith(a);
};

const normalizeCountry = (country = 'EC') => {
    const value = String(country || 'EC').trim().toUpperCase();
    return ['EC', 'CO'].includes(value) ? value : 'EC';
};

const defaultSequence = (country = 'EC') => parseList(
    process.env[`WHATSAPP_SELLER_E164_${normalizeCountry(country)}`]
    || process.env.WHATSAPP_SELLER_E164
    || process.env[`WHATSAPP_DEFAULT_SESSION_ID_${normalizeCountry(country)}`]
    || process.env.WHATSAPP_DEFAULT_SESSION_ID
);

const configuredSequence = (country = 'EC') => {
    const normalized = normalizeCountry(country);
    const fromEnv = parseList(
        process.env[`WHATSAPP_SELLER_ROTATION_SEQUENCE_${normalized}`]
        || process.env.WHATSAPP_SELLER_ROTATION_SEQUENCE
    );
    if (fromEnv.length) return fromEnv;
    if (normalized === 'EC') return defaultSequence(normalized);
    return parseList(
        process.env.WHATSAPP_SELLER_POOL_CO
        || process.env.WHATSAPP_SELLER_POOL
        || process.env.WHATSAPP_SESSION_IDS_CO
        || process.env.WHATSAPP_SESSION_IDS
    );
};

const healthySellerSet = () => {
    try {
        return new Set(getAllStatuses()
            .filter((item) => item?.isReady || ['connected', 'open', 'ready', 'online'].includes(String(item?.status || '').toLowerCase()))
            .flatMap((item) => [item?.sessionId, item?.ownPhoneDigits])
            .map(digitsOnly)
            .filter(Boolean));
    } catch (error) {
        console.warn('[SELLER_ROTATION] status fallback:', error.message);
        return new Set();
    }
};

const activeSequence = (sequence) => {
    const requireReady = String(process.env.WHATSAPP_SELLER_REQUIRE_PANEL_READY || 'true').toLowerCase() !== 'false';
    if (!requireReady) return sequence;
    const healthy = healthySellerSet();
    if (!healthy.size) return sequence;
    const active = sequence.filter((phone) => [...healthy].some((item) => isSamePhone(item, phone)));
    return active.length ? active : sequence;
};

const sellerMaxWorkloadSkew = () => {
    const parsed = Number.parseInt(String(process.env.WHATSAPP_SELLER_MAX_WORKLOAD_SKEW || '4'), 10);
    return Number.isFinite(parsed) && parsed >= 1 ? parsed : 4;
};

const todayWorkloadBySeller = async ({ country = 'EC', sequence = [] } = {}) => {
    const normalizedCountry = String(country || 'EC').trim().toUpperCase();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const counts = new Map(sequence.map((seller) => [seller, 0]));
    if (!sequence.length) return counts;

    const contacts = await ContactState.find({
        countryCode: normalizedCountry,
        chatId: { $exists: true, $nin: ['', 'status@broadcast'], $not: /@g\.us$/ },
        $or: [
            { createdAt: { $gte: startOfDay } },
            { firstInboundAt: { $gte: startOfDay } },
            { lastInboundAt: { $gte: startOfDay } },
            { lastOutboundAt: { $gte: startOfDay } },
            { updatedAt: { $gte: startOfDay } }
        ]
    }, {
        'metadata.senderWallet.assignedSessionId': 1,
        'metadata.lastSessionId': 1
    }).lean().catch(() => []);

    for (const contact of contacts) {
        const assigned = contact.metadata?.senderWallet?.assignedSessionId || contact.metadata?.lastSessionId || '';
        const seller = sequence.find((item) => isSamePhone(item, assigned));
        if (seller) counts.set(seller, (counts.get(seller) || 0) + 1);
    }
    return counts;
};

const workloadProtectedSequence = async ({ country = 'EC', sequence = [] } = {}) => {
    if (sequence.length <= 1) return { sequence, workload: Object.fromEntries(sequence.map((seller) => [seller, 0])), reason: 'single_or_empty_sequence' };
    const counts = await todayWorkloadBySeller({ country, sequence });
    const values = sequence.map((seller) => counts.get(seller) || 0);
    const min = Math.min(...values);
    const maxSkew = sellerMaxWorkloadSkew();
    const protectedSequence = sequence.filter((seller) => (counts.get(seller) || 0) <= min + maxSkew);
    return {
        sequence: protectedSequence.length ? protectedSequence : sequence,
        workload: Object.fromEntries(sequence.map((seller) => [seller, counts.get(seller) || 0])),
        reason: protectedSequence.length === sequence.length ? 'balanced_round_robin' : 'overload_protected_round_robin'
    };
};

export const sellerIsActive = ({ seller = '', country = 'EC' } = {}) => {
    const phone = digitsOnly(seller);
    if (!phone) return false;
    return activeSequence(configuredSequence(country)).some((item) => isSamePhone(item, phone));
};

export const nextSellerForNewLead = async ({ country = 'EC', source = 'vsl_whatsapp' } = {}) => {
    const normalizedCountry = normalizeCountry(country);
    const baseSequence = activeSequence(configuredSequence(normalizedCountry));
    const balanced = await workloadProtectedSequence({ country, sequence: baseSequence });
    const sequence = balanced.sequence;
    const fallback = digitsOnly(
        process.env[`WHATSAPP_DEFAULT_SESSION_ID_${normalizedCountry}`]
        || process.env.WHATSAPP_DEFAULT_SESSION_ID
        || process.env[`WHATSAPP_SELLER_E164_${normalizedCountry}`]
        || process.env.WHATSAPP_SELLER_E164
        || sequence[0]
    );
    if (!sequence.length) {
        return { seller: fallback, index: 0, sequence: [fallback], reason: 'fallback_no_sequence' };
    }

    const signature = sequence.join('_');
    const key = `${normalizedCountry}:${source}:${signature}:v1`;
    const counter = await SellerRotationCounter.findOneAndUpdate(
        { key },
        {
            $inc: { value: 1 },
            $setOnInsert: { key }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    const value = Math.max(1, Number(counter?.value || 1));
    const index = (value - 1) % sequence.length;
    return {
        seller: sequence[index] || fallback,
        index,
        counter: value,
        sequence,
        workload: balanced.workload,
        reason: `${balanced.reason}_${sequence.length}_slots_${source}`
    };
};

export const sellerRotationPreview = ({ country = 'EC' } = {}) => {
    const normalizedCountry = normalizeCountry(country);
    const sequence = activeSequence(configuredSequence(normalizedCountry));
    return {
        country: normalizedCountry,
        sequence,
        slots: sequence.map((seller, index) => ({ index, seller }))
    };
};
