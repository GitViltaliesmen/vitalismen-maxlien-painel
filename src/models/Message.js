import mongoose from 'mongoose';

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
    isFromMe: { type: Boolean, default: false },
    ack: Number, // Delivery status
    notifyName: String, // Sender display name
    orderId: { type: String, ref: 'Order' }, // Optional link to an order if we can correlate
    isBot: { type: Boolean, default: false } // True if sent by the automation system
}, {
    timestamps: true,
    _id: false // Disable auto _id since we use String id
});

export default mongoose.model('Message', messageSchema);
