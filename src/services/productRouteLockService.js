const normalizeProductKey = (value = '') => String(value || '').trim().toLowerCase();
const LOCKABLE_PRODUCT_KEYS = new Set(['vit_power_ec', 'nitrix_ec', 'tex_ultra_ec']);

const validDate = (value) => {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date : null;
};

export const activeProductRouteLock = (state = {}) => {
    const lock = state?.metadata?.productRouteLock || {};
    const productKey = normalizeProductKey(lock.productKey);
    if (lock.active !== true || !LOCKABLE_PRODUCT_KEYS.has(productKey)) return null;
    return {
        ...lock,
        productKey,
        lockedAt: validDate(lock.lockedAt || lock.createdAt || state?.metadata?.operatorConfirmedNewLeadAt)
    };
};

export const sourceRecordPredatesProductRouteLock = (state = {}, ...sourceDates) => {
    const lock = activeProductRouteLock(state);
    if (!lock?.lockedAt) return false;
    const sourceDate = sourceDates.map(validDate).find(Boolean);
    return Boolean(sourceDate && sourceDate.getTime() < lock.lockedAt.getTime());
};
