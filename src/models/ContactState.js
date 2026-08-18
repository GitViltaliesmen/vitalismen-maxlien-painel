import mongoose from 'mongoose';

const EC_AGENT_KEYS = ['vit_power_ec', 'nitrix_ec', 'tex_ultra_ec'];

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
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true
});

contactStateSchema.index({ assignedAgent: 1, countryCode: 1 });
contactStateSchema.index({ 'human.mode': 1, 'human.assignedTo': 1 });
contactStateSchema.index({
    'buyLaterReminder.active': 1,
    'buyLaterReminder.sentAt': 1,
    'buyLaterReminder.windowStartAt': 1,
    'buyLaterReminder.windowEndAt': 1
});

const ContactState = mongoose.model('ContactState', contactStateSchema);

export default ContactState;
