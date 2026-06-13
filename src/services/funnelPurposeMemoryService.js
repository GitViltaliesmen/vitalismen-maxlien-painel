import ContactState from '../models/ContactState.js';

const normalizePurpose = (value) => String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9_:-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);

const normalizeCandidates = (items = []) => [...new Set((Array.isArray(items) ? items : [items])
    .map((item) => String(item || '').trim())
    .filter(Boolean))];

const purposeMemoryFromState = (state, agentKey, purpose) => {
    const key = normalizePurpose(purpose);
    return (((state?.metadata || {}).perAgentMemory || {})[agentKey] || {})?.audioPurposeMemory?.[key] || {};
};

const stableStartIndex = (customerId, total) => {
    if (!total) return 0;
    const seed = String(customerId || '')
        .split('')
        .reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return seed % total;
};

export const getNextItemByPurpose = async (customerId, purpose, options = {}) => {
    const candidates = normalizeCandidates(options.candidates || []);
    if (!candidates.length) return null;

    const agentKey = options.agentKey || 'vit_power_ec';
    const purposeKey = normalizePurpose(purpose);
    const state = options.state
        || (options.contactStateId ? await ContactState.findById(options.contactStateId).lean().catch(() => null) : null);
    const memory = purposeMemoryFromState(state, agentKey, purposeKey);
    const sent = new Set(Array.isArray(memory.sent) ? memory.sent : []);
    const lastSentIndex = memory.lastSent ? candidates.indexOf(memory.lastSent) : -1;
    const start = lastSentIndex >= 0
        ? (lastSentIndex + 1) % candidates.length
        : stableStartIndex(customerId, candidates.length);

    let next = null;
    for (let offset = 0; offset < candidates.length; offset += 1) {
        const candidate = candidates[(start + offset) % candidates.length];
        if (!sent.has(candidate)) {
            next = candidate;
            break;
        }
    }

    if (!next) {
        console.log(`[FUNIL-PURPOSE] todos os itens ja usados -> customer=${customerId || ''} | purpose=${purposeKey} | total=${candidates.length}`);
        if (!options.resetWhenExhausted) return null;
        return candidates[start] || candidates[0] || null;
    }

    return next;
};

export const getNextAudioByPurpose = async (customerId, purpose, options = {}) => (
    getNextItemByPurpose(customerId, purpose, options)
);

export const markPurposeItemSent = async ({ contactStateId, agentKey = 'vit_power_ec', purpose, item }) => {
    if (!contactStateId || !purpose || !item) return;
    const purposeKey = normalizePurpose(purpose);
    const prefix = `metadata.perAgentMemory.${agentKey}.audioPurposeMemory.${purposeKey}`;
    await ContactState.updateOne(
        { _id: contactStateId },
        {
            $addToSet: { [`${prefix}.sent`]: item },
            $set: {
                [`${prefix}.lastSent`]: item,
                [`${prefix}.lastSentAt`]: new Date()
            },
            $inc: { [`${prefix}.sentCount`]: 1 }
        }
    ).catch((error) => console.warn('[FUNIL-PURPOSE] falha ao gravar memoria:', error.message));
};

export const markAudioPurposeSent = async ({ contactStateId, agentKey = 'vit_power_ec', purpose, baseName }) => (
    markPurposeItemSent({ contactStateId, agentKey, purpose, item: baseName })
);

export const filterUnsentAudiosByPurpose = async (customerId, purpose, options = {}) => {
    const next = await getNextAudioByPurpose(customerId, purpose, options);
    return next ? [next] : [];
};
