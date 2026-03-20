import mongoose from 'mongoose';

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
        default: 'INTL'
    },
    assignedAgent: {
        type: String,
        enum: ['warmup', 'vitalismen', 'vit_power_ec', 'superfull_co', 'fallback'],
        default: 'fallback'
    },
    agentHistory: {
        type: [{
            agent: {
                type: String,
                enum: ['warmup', 'vitalismen', 'vit_power_ec', 'superfull_co', 'fallback']
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

const ContactState = mongoose.model('ContactState', contactStateSchema);

export default ContactState;
