import mongoose from 'mongoose';

const outboundDedupeSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    phoneDigits: {
        type: String,
        index: true,
        default: ''
    },
    jid: {
        type: String,
        index: true,
        default: ''
    },
    kind: {
        type: String,
        enum: ['text', 'audio', 'image', 'video', 'document'],
        required: true,
        index: true
    },
    fingerprint: {
        type: String,
        required: true,
        index: true
    },
    label: {
        type: String,
        default: ''
    },
    sessionId: {
        type: String,
        default: ''
    },
    status: {
        type: String,
        enum: ['reserved', 'sent', 'failed', 'ambiguous'],
        default: 'reserved',
        index: true
    },
    logicalMessageId: { type: String, default: '', index: true },
    channelId: { type: String, default: '', index: true },
    provider: { type: String, default: '', index: true },
    providerMessageId: { type: String, default: '', index: true },
    retryAllowed: { type: Boolean, default: true },
    firstReservedAt: Date,
    sentAt: Date,
    failedAt: Date,
    ambiguousAt: Date,
    error: String
}, {
    timestamps: true
});

outboundDedupeSchema.index({ phoneDigits: 1, kind: 1, fingerprint: 1 }, { unique: true });

export default mongoose.model('OutboundDedupe', outboundDedupeSchema);
