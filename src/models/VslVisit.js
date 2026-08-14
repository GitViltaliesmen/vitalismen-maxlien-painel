import mongoose from 'mongoose';

const vslVisitSchema = new mongoose.Schema({
    visitorKey: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    visitorId: {
        type: String,
        default: '',
        index: true
    },
    sessionId: {
        type: String,
        default: ''
    },
    attributionRef: {
        type: String,
        default: '',
        index: true
    },
    attributionLinkedAt: Date,
    country: {
        type: String,
        default: 'EC',
        index: true
    },
    page: {
        type: String,
        default: ''
    },
    path: {
        type: String,
        default: ''
    },
    sourceUrl: {
        type: String,
        default: ''
    },
    referrer: {
        type: String,
        default: ''
    },
    userAgent: {
        type: String,
        default: ''
    },
    ipHash: {
        type: String,
        default: ''
    },
    device: {
        type: String,
        default: ''
    },
    customerName: {
        type: String,
        default: ''
    },
    customerPhone: {
        type: String,
        default: '',
        index: true
    },
    productKey: {
        type: String,
        default: '',
        index: true
    },
    productName: {
        type: String,
        default: ''
    },
    productSource: {
        type: String,
        default: ''
    },
    vslTestId: {
        type: String,
        default: '',
        index: true
    },
    vslVariant: {
        type: String,
        default: '',
        index: true
    },
    vslEntryMessage: {
        type: String,
        default: ''
    },
    lastWhatsappMessage: {
        type: String,
        default: ''
    },
    tracking: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    assignedSeller: {
        type: String,
        default: '',
        index: true
    },
    assignedSellerAt: Date,
    assignmentReason: {
        type: String,
        default: ''
    },
    clickCount: {
        type: Number,
        default: 0
    },
    lastClickAt: Date,
    formVisibleCount: {
        type: Number,
        default: 0
    },
    lastFormVisibleAt: Date,
    lastFormVisibleReason: {
        type: String,
        default: ''
    },
    lastEntryMessage: {
        type: String,
        default: ''
    },
    attributionClaimedAt: Date,
    attributionClaimSource: {
        type: String,
        default: ''
    },
    attributionClaimPhoneHash: {
        type: String,
        default: ''
    },
    attributionClaimMessageHash: {
        type: String,
        default: ''
    },
    attributionClaimInboundAt: Date,
    firstSeenAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    lastSeenAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    visits: {
        type: Number,
        default: 1
    },
    metaPageViewEventId: {
        type: String,
        default: ''
    },
    metaPageViewSentAt: Date,
    metaPageViewResponse: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    metaViewContentEventId: {
        type: String,
        default: ''
    },
    metaViewContentSentAt: Date,
    metaViewContentResponse: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    metaInitiateCheckoutEventId: {
        type: String,
        default: ''
    },
    metaInitiateCheckoutSentAt: Date,
    metaInitiateCheckoutResponse: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    metaLeadEventId: {
        type: String,
        default: ''
    },
    metaLeadSentAt: Date,
    metaLeadResponse: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    }
}, {
    timestamps: true
});

vslVisitSchema.index({ country: 1, firstSeenAt: -1 });
vslVisitSchema.index({ country: 1, lastSeenAt: -1 });
vslVisitSchema.index({ country: 1, assignedSeller: 1, lastClickAt: -1 });
vslVisitSchema.index({ country: 1, lastClickAt: -1, attributionClaimedAt: -1 });
vslVisitSchema.index({ country: 1, attributionRef: 1, lastSeenAt: -1 });

const VslVisit = mongoose.model('VslVisit', vslVisitSchema);

export default VslVisit;
