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
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true
});

contactStateSchema.index({ assignedAgent: 1, countryCode: 1 });
contactStateSchema.index({ 'human.mode': 1, 'human.assignedTo': 1 });

const ContactState = mongoose.model('ContactState', contactStateSchema);

export default ContactState;
