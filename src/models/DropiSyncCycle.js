import mongoose from 'mongoose';

const dropiSyncEntrySchema = new mongoose.Schema({
    state: {
        type: String,
        enum: [
            'SEEN', 'PARSED', 'MATCHED', 'UPDATED', 'UNCHANGED', 'NOT_PARSED',
            'NO_MATCH', 'AMBIGUOUS_MATCH', 'PRODUCT_CONFLICT', 'INVALID_TRACKING', 'ERROR'
        ],
        required: true
    },
    reason: { type: String, default: '' },
    source: { type: String, default: '' },
    orderId: { type: String, default: '' },
    dropiOrderId: { type: String, default: '' },
    trackingNumber: { type: String, default: '' },
    phoneTail: { type: String, default: '' },
    productKey: { type: String, default: '' },
    matchType: { type: String, default: '' },
    changedFields: { type: [String], default: [] },
    at: { type: Date, default: Date.now }
}, { _id: false });

const dropiSyncCycleSchema = new mongoose.Schema({
    cycleId: { type: String, required: true, unique: true, index: true },
    source: { type: String, default: 'dropi_orders_api', index: true },
    mode: { type: String, enum: ['dry_run', 'apply'], default: 'dry_run' },
    status: { type: String, enum: ['RUNNING', 'COMPLETED', 'FAILED'], default: 'RUNNING', index: true },
    startedAt: { type: Date, default: Date.now, index: true },
    finishedAt: { type: Date, default: null },
    counters: { type: mongoose.Schema.Types.Mixed, default: {} },
    entries: { type: [dropiSyncEntrySchema], default: [] },
    errorCode: { type: String, default: '' }
}, { timestamps: true });

dropiSyncCycleSchema.index({ startedAt: -1 });

const DropiSyncCycle = mongoose.model('DropiSyncCycle', dropiSyncCycleSchema);

export default DropiSyncCycle;
