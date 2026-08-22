import mongoose from 'mongoose';

const EC_AGENT_KEYS = ['vit_power_ec', 'nitrix_ec', 'tex_ultra_ec'];

const customerDataResolutionSchema = new mongoose.Schema({
    version: { type: Number, default: 28 },
    country: { type: String, enum: ['', 'EC'], default: '' },
    fields: { type: mongoose.Schema.Types.Mixed, default: {} },
    conflicts: { type: [mongoose.Schema.Types.Mixed], default: [] },
    qualityScore: { type: Number, min: 0, max: 100, default: 0 },
    orderDataReady: { type: Boolean, default: false, index: true },
    blockedReasons: { type: [String], default: [] },
    nextRequiredField: { type: String, default: '' },
    evaluatedAt: Date,
    externalGeoAdapter: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { _id: false, strict: false });

const conversationBucketHistorySchema = new mongoose.Schema({
    from: { type: String, enum: ['', 'attendance', 'engagement', 'orders', 'review'], default: '' },
    to: { type: String, enum: ['attendance', 'engagement', 'orders', 'review'], required: true },
    source: { type: String, default: '' },
    reason: { type: String, default: '' },
    score: { type: Number, min: 0, max: 100, default: 0 },
    by: { type: String, default: '' },
    at: { type: Date, default: Date.now }
}, { _id: false });

const engagementReplyHistorySchema = new mongoose.Schema({
    inboundMessageId: { type: String, default: '' },
    templateKey: { type: String, default: '' },
    providerMessageId: { type: String, default: '' },
    status: { type: String, enum: ['sent', 'failed', 'skipped'], default: 'skipped' },
    reason: { type: String, default: '' },
    at: { type: Date, default: Date.now }
}, { _id: false });

const contactStateSchema = new mongoose.Schema({
    chatId: {
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
    countryCode: {
        type: String,
        default: 'EC'
    },
    assignedAgent: {
        type: String,
        enum: EC_AGENT_KEYS,
        default: 'vit_power_ec'
    },
    agentHistory: {
        type: [{
            agent: {
                type: String,
                enum: EC_AGENT_KEYS
            },
            reason: String,
            at: Date
        }],
        default: []
    },
    tags: {
        type: [String],
        default: []
    },
    human: {
        mode: {
            type: String,
            enum: ['auto', 'manual'],
            default: 'auto',
            index: true
        },
        assignedTo: {
            type: String,
            default: '',
            index: true
        },
        assignedName: {
            type: String,
            default: ''
        },
        assignedAt: Date,
        pausedUntil: Date,
        lastManualAt: Date,
        lastManualBy: {
            type: String,
            default: ''
        },
        note: {
            type: String,
            default: ''
        }
    },
    conversationBucket: {
        value: {
            type: String,
            enum: ['attendance', 'engagement', 'orders', 'review'],
            default: 'attendance',
            index: true
        },
        previousValue: {
            type: String,
            enum: ['', 'attendance', 'engagement', 'orders', 'review'],
            default: ''
        },
        source: { type: String, default: 'default' },
        confidence: {
            type: String,
            enum: ['low', 'medium', 'high'],
            default: 'low'
        },
        score: { type: Number, min: 0, max: 100, default: 0 },
        reasons: { type: [String], default: [] },
        classifiedAt: Date,
        manualSelectedAt: Date,
        manualSelectedBy: { type: String, default: '' },
        commercialInterruptedAt: Date,
        riskDetectedAt: Date,
        history: { type: [conversationBucketHistorySchema], default: [] }
    },
    engagementAutomation: {
        approvedAt: Date,
        approvedBy: { type: String, default: '' },
        approvalSource: { type: String, default: '' },
        blockedAt: Date,
        blockedReason: { type: String, default: '' },
        lastEvaluatedAt: Date,
        lastDecision: { type: String, default: '' },
        lastInboundMessageId: { type: String, default: '' },
        replyLockUntil: Date,
        replyLockedAt: Date,
        replyLockedForMessageId: { type: String, default: '' },
        lastReplyAt: Date,
        lastReplyTemplateKey: { type: String, default: '' },
        lastReplyProviderMessageId: { type: String, default: '' },
        lastFailureAt: Date,
        lastFailure: { type: String, default: '' },
        dailyKey: { type: String, default: '' },
        dailyReplyCount: { type: Number, default: 0 },
        localDecisionCount: { type: Number, default: 0 },
        modelCallCount: { type: Number, default: 0 },
        estimatedCostUsd: { type: Number, default: 0 },
        replyHistory: { type: [engagementReplyHistorySchema], default: [] }
    },
    firstInboundText: {
        type: String,
        default: ''
    },
    firstInboundAt: Date,
    lastInboundText: {
        type: String,
        default: ''
    },
    lastInboundAt: Date,
    lastOutboundAt: Date,
    buyLaterReminder: {
        active: {
            type: Boolean,
            default: false,
            index: true
        },
        desiredOrderDate: {
            type: String,
            default: ''
        },
        productKey: {
            type: String,
            enum: ['', ...EC_AGENT_KEYS],
            default: ''
        },
        productName: {
            type: String,
            default: ''
        },
        customerName: {
            type: String,
            default: ''
        },
        scheduledAt: Date,
        windowStartAt: {
            type: Date,
            index: true
        },
        windowEndAt: Date,
        lockUntil: Date,
        lockedAt: Date,
        sentAt: Date,
        failedAt: Date,
        providerMessageId: {
            type: String,
            default: ''
        },
        attemptCount: {
            type: Number,
            default: 0
        },
        lastAttemptAt: Date,
        lastError: {
            type: String,
            default: ''
        },
        awaitingReply: {
            type: Boolean,
            default: false
        },
        cancelledAt: Date
    },
    customerDataResolution: {
        type: customerDataResolutionSchema,
        default: () => ({})
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true
});

contactStateSchema.index({ assignedAgent: 1, countryCode: 1 });
contactStateSchema.index({ 'human.mode': 1, 'human.assignedTo': 1 });
contactStateSchema.index({ 'conversationBucket.value': 1, 'conversationBucket.classifiedAt': -1 });
contactStateSchema.index({ 'customerDataResolution.orderDataReady': 1, updatedAt: -1 });
contactStateSchema.index({
    'buyLaterReminder.active': 1,
    'buyLaterReminder.sentAt': 1,
    'buyLaterReminder.windowStartAt': 1,
    'buyLaterReminder.windowEndAt': 1
});

const ContactState = mongoose.model('ContactState', contactStateSchema);

export default ContactState;
