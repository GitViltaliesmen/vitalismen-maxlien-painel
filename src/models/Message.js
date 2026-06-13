import mongoose from 'mongoose';

const digitsOnly = (value) => String(value || '').replace(/\D/g, '');

const phoneTailsFromMessage = (message) => {
    const source = [
        message.peerPhone,
        message.chatId,
        message.to,
        message.from
    ].map(digitsOnly).filter(Boolean);
    return [...new Set(source.flatMap((digits) => [
        digits,
        digits.length >= 8 ? digits.slice(-8) : '',
        digits.length >= 9 ? digits.slice(-9) : '',
        digits.length >= 10 ? digits.slice(-10) : ''
    ]).filter((digits) => digits.length >= 8))];
};

const inferOwnerSessionFromContactState = async (message) => {
    const ContactState = mongoose.models.ContactState;
    if (!ContactState) return '';
    const tails = phoneTailsFromMessage(message);
    if (!tails.length) return '';
    const state = await ContactState.findOne({
        $or: tails.flatMap((tail) => [
            { phoneDigits: { $regex: `${tail}$` } },
            { 'metadata.customerPhoneDigits': { $regex: `${tail}$` } },
            { 'metadata.lastSenderPn': { $regex: tail } }
        ])
    })
        .sort({ updatedAt: -1 })
        .select('metadata.senderWallet.assignedSessionId metadata.lastSessionId')
        .lean()
        .catch(() => null);
    return String(state?.metadata?.senderWallet?.assignedSessionId || state?.metadata?.lastSessionId || '').trim();
};

const messageSchema = new mongoose.Schema({
    _id: { type: String, required: true }, // Using WhatsApp Message ID as _id
    chatId: { type: String, index: true }, // Conversation partner id (to fetch chat history reliably)
    peerPhone: { type: String, index: true }, // Digits-only phone when available (e.g., 553184539234)
    from: { type: String, required: true },
    to: { type: String, required: true },
    body: String,
    type: { type: String, default: 'chat' }, // chat, image, audio, ptt, video, document, sticker
    hasMedia: { type: Boolean, default: false },
    mediaUrl: String, // Path to local file relative to server
    mediaPreviewUrl: String, // Optional preview URL (e.g., MP3 for Safari compatibility)
    timestamp: Number,
    sessionId: { type: String, index: true },
    ownerPhoneDigits: { type: String, index: true },
    isFromMe: { type: Boolean, default: false },
    ack: Number, // Delivery status
    notifyName: String, // Sender display name
    quotedMessageId: String,
    quotedBody: String,
    quotedFromMe: Boolean,
    deliveryStatus: { type: String, default: 'sent' }, // sent, failed, pending
    sendError: String,
    orderId: { type: String, ref: 'Order' }, // Optional link to an order if we can correlate
    isBot: { type: Boolean, default: false } // True if sent by the automation system
}, {
    timestamps: true,
    _id: false // Disable auto _id since we use String id
});

messageSchema.pre('validate', async function fillOwnerSessionFromContact(next) {
    try {
        if (this.sessionId && this.ownerPhoneDigits) return next();
        const inferredSessionId = await inferOwnerSessionFromContactState(this);
        if (inferredSessionId) {
            if (!this.sessionId) this.sessionId = inferredSessionId;
            if (!this.ownerPhoneDigits) this.ownerPhoneDigits = digitsOnly(inferredSessionId);
        }
        return next();
    } catch (error) {
        return next();
    }
});

export default mongoose.model('Message', messageSchema);
