import mongoose from 'mongoose';

const transferSchema = new mongoose.Schema({
    transferId: { type: String, required: true, unique: true, index: true },
    conversationId: { type: String, required: true, index: true },
    fromChannelId: { type: String, default: '' },
    toChannelId: { type: String, required: true },
    leaseToken: { type: String, required: true },
    status: { type: String, enum: ['SIMULATED', 'COMPLETED', 'BLOCKED', 'FAILED'], required: true },
    reason: { type: String, default: '' },
    actor: { type: String, default: '' },
    timestamp: { type: Date, required: true }
}, { timestamps: true });

export default mongoose.models.WhatsAppChannelTransfer || mongoose.model('WhatsAppChannelTransfer', transferSchema);
