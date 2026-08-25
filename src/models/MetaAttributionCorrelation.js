import mongoose from 'mongoose';

const metaAttributionCorrelationSchema = new mongoose.Schema({
    country: {
        type: String,
        enum: ['EC'],
        required: true,
        index: true
    },
    status: {
        type: String,
        enum: ['CLAIMED', 'AMBIGUOUS', 'UNMATCHED'],
        required: true,
        index: true
    },
    reason: {
        type: String,
        default: ''
    },
    candidateCount: {
        type: Number,
        min: 0,
        default: 0
    },
    phoneHash: {
        type: String,
        default: '',
        index: true
    },
    messageHash: {
        type: String,
        default: '',
        index: true
    },
    visitorKey: {
        type: String,
        default: '',
        index: true
    },
    visitId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
        index: true
    },
    productKey: {
        type: String,
        default: ''
    },
    funnel: {
        type: String,
        default: ''
    },
    source: {
        type: String,
        default: 'zapi_exact_message_unique_120s'
    },
    windowMs: {
        type: Number,
        default: 120000
    },
    inboundAt: {
        type: Date,
        required: true,
        index: true
    },
    evaluatedAt: {
        type: Date,
        default: Date.now,
        index: true
    }
}, {
    timestamps: true
});

metaAttributionCorrelationSchema.index({ country: 1, status: 1, evaluatedAt: -1 });

const MetaAttributionCorrelation = mongoose.model(
    'MetaAttributionCorrelation',
    metaAttributionCorrelationSchema
);

export default MetaAttributionCorrelation;
