import mongoose from 'mongoose';

const leaseSchema = new mongoose.Schema({
    conversationId: { type: String, required: true, unique: true, index: true },
    holder: { type: String, required: true, index: true },
    channelId: { type: String, default: '', index: true },
    leaseToken: { type: String, required: true, unique: true },
    acquiredAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    releasedAt: Date,
    version: { type: Number, default: 1 }
}, { timestamps: true });

leaseSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.WhatsAppConversationLease || mongoose.model('WhatsAppConversationLease', leaseSchema);
