import { texMeasurementReferenceV243 } from './texUltraMeasurementV243Service.js';

// The verified Plusmen CTA appends a TX243 reference to the published Tex entry.
// Keep that exact entry on the existing Tex funnel when WhatsApp is linked.
export const preferTexLinkedEntryV267 = ({ text = '', state = null, productKey = '', sourceMessageId = '', sessionId = '', env = process.env } = {}) => {
    if (env.TEX_ULTRA_FUNNEL_ENABLED !== 'true' || productKey !== 'tex_ultra_ec'
        || !sourceMessageId || !sessionId || !state || state.countryCode !== 'EC'
        || state.human?.mode === 'manual' || state.metadata?.productKey !== 'tex_ultra_ec'
        || state.metadata?.lastSessionId !== sessionId) return false;
    const lock = state.metadata?.productRouteLock;
    if (lock?.active === true && lock.productKey && lock.productKey !== 'tex_ultra_ec') return false;
    return Boolean(texMeasurementReferenceV243(text));
};
