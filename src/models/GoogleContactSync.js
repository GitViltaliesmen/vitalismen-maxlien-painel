import mongoose from 'mongoose';

const googleContactSyncSchema = new mongoose.Schema({
    phoneDigits: { type: String, required: true, unique: true, index: true },
    country: { type: String, enum: ['EC'], default: 'EC', index: true },
    name: { type: String, required: true },
    orderId: { type: String, default: '', index: true },
    productKey: { type: String, default: '' },
    orderConfirmedAt: Date,
    status: {
        type: String,
        enum: ['pending', 'syncing', 'synced', 'conflict', 'error', 'skipped'],
        default: 'pending',
        index: true
    },
    resourceName: { type: String, default: '' },
    etag: { type: String, default: '' },
    existingName: { type: String, default: '' },
    allowNameUpdateOnce: { type: Boolean, default: false },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now, index: true },
    lockUntil: { type: Date, default: null, index: true },
    lastAttemptAt: Date,
    syncedAt: Date,
    lastError: { type: String, default: '' }
}, { timestamps: true });

googleContactSyncSchema.index({ status: 1, nextAttemptAt: 1, lockUntil: 1 });

export default mongoose.model('GoogleContactSync', googleContactSyncSchema);
