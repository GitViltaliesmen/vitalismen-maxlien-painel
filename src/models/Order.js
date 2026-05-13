import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
    orderId: {
        type: String,
        unique: true
    },
    country: {
        type: String,
        enum: ['EC'],
        required: true
    },
    customer: {
        name: { type: String, default: '' },
        phone: { type: String, default: '' },
        address: { type: String, default: '' },
        city: { type: String, default: '' },
        province: { type: String, default: '' }
    },
    package: {
        id: { type: Number, default: 0 },
        label: { type: String, default: '' },
        quantity: { type: Number, default: 1 }
    },
    total: {
        type: Number,
        default: 0
    },
    currency: {
        type: String,
        enum: ['USD'],
        required: true
    },
    status: {
        type: String,
        enum: ['draft', 'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'],
        default: 'draft'
    },
    source: {
        type: String,
        enum: ['checkout', 'whatsapp', 'manual'],
        default: 'checkout'
    },
    notes: String,
    trackingNumber: String,
    dropiOrderId: String,
    shippingStatus: String,
    purchaseIntent: {
        readiness: {
            type: String,
            enum: ['unknown', 'ready_now', 'buy_later'],
            default: 'unknown'
        },
        requestedQuantity: Number,
        requestedPackageLabel: String,
        desiredPurchaseTiming: String,
        followUpAt: Date,
        readyConfirmedAt: Date,
        buyLaterDetectedAt: Date,
        lastReadinessQuestionAt: Date
    },
    whatsappNotified: {
        type: Boolean,
        default: false
    },
    whatsappFunnel: {
        audio1SentAt: Date,
        audio1File: String,
        audio2SentAt: Date,
        addressConfirmSentAt: Date,
        offerSentAt: Date,
        lockUntil: Date
    },
    tracking: {
        fbclid: String,
        fbc: String,
        fbp: String,
        ext_id: String, // External ID (for affiliates/tracking)
        utm_source: String,
        utm_medium: String,
        utm_campaign: String,
        utm_content: String,
        utm_term: String,
        sourceUrl: String,
        ip: String,
        userAgent: String,
        metaPurchaseEventId: String,
        metaPurchaseSentAt: Date,
        metaPurchaseResponse: mongoose.Schema.Types.Mixed
    },
    conversationMemory: {
        currentIntent: String,
        funnelStage: String,
        lastObjection: String,
        lastCustomerMessageAt: Date,
        lastBotMessageAt: Date,
        lastSummary: String
    },
    // Track when draft was created and last updated
    draftCreatedAt: Date,
    lastInteractionAt: Date
}, {
    timestamps: true
});

// Generate unique order ID before saving
orderSchema.pre('save', async function (next) {
    if (!this.orderId) {
        const prefix = 'EC';
        const stamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).slice(2, 6).toUpperCase();
        this.orderId = `${prefix}-${stamp}-${random}`;
    }
    // Track last interaction
    this.lastInteractionAt = new Date();
    next();
});

// Index for efficient queries
orderSchema.index({ country: 1, status: 1 });
orderSchema.index({ 'customer.phone': 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ status: 1, draftCreatedAt: 1 }); // For draft queries

const Order = mongoose.model('Order', orderSchema);

export default Order;
