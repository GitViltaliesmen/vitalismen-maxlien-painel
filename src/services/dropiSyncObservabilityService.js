import crypto from 'crypto';
import DropiSyncCycle from '../models/DropiSyncCycle.js';

export const DROPI_SYNC_ENTRY_STATES = Object.freeze([
    'SEEN', 'PARSED', 'MATCHED', 'UPDATED', 'UNCHANGED', 'NOT_PARSED',
    'NO_MATCH', 'AMBIGUOUS_MATCH', 'PRODUCT_CONFLICT', 'INVALID_TRACKING', 'ERROR'
]);

const clean = (value = '') => String(value || '').trim();
const digitsOnly = (value = '') => clean(value).replace(/\D/g, '');

export const sanitizeDropiSyncEntry = (entry = {}) => {
    const state = DROPI_SYNC_ENTRY_STATES.includes(entry.state) ? entry.state : 'ERROR';
    return {
        state,
        reason: clean(entry.reason).slice(0, 160),
        source: clean(entry.source).slice(0, 40),
        orderId: clean(entry.orderId).slice(0, 80),
        dropiOrderId: digitsOnly(entry.dropiOrderId).slice(0, 30),
        trackingNumber: clean(entry.trackingNumber).replace(/[^A-Z0-9-]/gi, '').slice(0, 40),
        phoneTail: digitsOnly(entry.phone || entry.phoneTail).slice(-4),
        productKey: clean(entry.productKey).slice(0, 40),
        matchType: clean(entry.matchType).slice(0, 40),
        changedFields: [...new Set((entry.changedFields || []).map(clean).filter(Boolean))].slice(0, 30),
        at: entry.at || new Date()
    };
};

export const startDropiSyncCycle = async ({ source = 'dropi_orders_api', dryRun = true, model = DropiSyncCycle } = {}) => {
    const cycleId = `dropi-sync-${new Date().toISOString().replace(/\D/g, '').slice(0, 17)}-${crypto.randomBytes(4).toString('hex')}`;
    const cycle = await model.create({
        cycleId,
        source,
        mode: dryRun ? 'dry_run' : 'apply',
        status: 'RUNNING',
        startedAt: new Date(),
        counters: {},
        entries: []
    });
    return cycle;
};

const countEntries = (entries = []) => entries.reduce((acc, entry) => {
    acc[entry.state] = (acc[entry.state] || 0) + 1;
    return acc;
}, {});

export const finalizeDropiSyncCycle = async ({
    cycleId,
    entries = [],
    failed = false,
    errorCode = '',
    model = DropiSyncCycle
} = {}) => {
    const sanitized = entries.map(sanitizeDropiSyncEntry).slice(0, 5000);
    return model.findOneAndUpdate(
        { cycleId, status: 'RUNNING' },
        {
            $set: {
                status: failed ? 'FAILED' : 'COMPLETED',
                finishedAt: new Date(),
                counters: countEntries(sanitized),
                entries: sanitized,
                errorCode: clean(errorCode).slice(0, 120)
            }
        },
        { new: true }
    );
};

export const listDropiSyncCycles = async ({ limit = 10, model = DropiSyncCycle } = {}) => model.find({})
    .sort({ startedAt: -1 })
    .limit(Math.max(1, Math.min(Number(limit) || 10, 50)))
    .lean();

export default startDropiSyncCycle;
