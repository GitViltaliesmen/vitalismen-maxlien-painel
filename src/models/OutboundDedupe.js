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
        enum: ['text', 'audio'],
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
        enum: ['reserved', 'sent', 'failed'],
        default: 'reserved',
        index: true
    },
    firstReservedAt: Date,
    sentAt: Date,
    failedAt: Date,
    error: String
}, {
    timestamps: true
});

outboundDedupeSchema.index({ phoneDigits: 1, kind: 1, fingerprint: 1 }, { unique: true });

export default mongoose.model('OutboundDedupe', outboundDedupeSchema);
