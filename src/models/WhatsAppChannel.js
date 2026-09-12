import mongoose from 'mongoose';

export const WHATSAPP_CHANNEL_STATUSES = Object.freeze([
    'DRAFT', 'PAIRING', 'ACTIVE', 'DEGRADED', 'DRAINING', 'INACTIVE', 'BLOCKED'
]);

const whatsAppChannelSchema = new mongoose.Schema({
    channelId: { type: String, required: true, unique: true, index: true },
    provider: { type: String, required: true, enum: ['ZAPI', 'WHATSAPP_WEB', 'META_CLOUD'], index: true },
    phoneNumber: { type: String, default: '', index: true },
    providerAddress: { type: String, default: '' },
    displayName: { type: String, default: '' },
    status: { type: String, enum: WHATSAPP_CHANNEL_STATUSES, required: true, default: 'DRAFT', index: true },
    health: {
        healthy: { type: Boolean, default: false, index: true },
        checkedAt: Date,
        detail: { type: String, default: '' }
    },
    priority: { type: Number, min: 0, default: 100, index: true },
    weight: { type: Number, min: 0, default: 1 },
    capacity: { type: Number, min: 0, default: 1 },
    currentLoad: { type: Number, min: 0, default: 0 },
    draining: { type: Boolean, default: false, index: true },
    sessionNamespace: { type: String, default: '' },
    version: { type: Number, min: 1, default: 1 },
    compatibilityMirror: { type: Boolean, default: false },
    preserved: { type: Boolean, default: false },
    shadow: { type: Boolean, default: false, index: true }
}, { timestamps: true });

whatsAppChannelSchema.index({ status: 1, 'health.healthy': 1, draining: 1, priority: 1 });

export default mongoose.models.WhatsAppChannel || mongoose.model('WhatsAppChannel', whatsAppChannelSchema);
