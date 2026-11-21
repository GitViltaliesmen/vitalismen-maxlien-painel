import mongoose from 'mongoose';
import { integrationPolicyV254 } from '../services/orderIntegrationScopeV254Service.js';
import { preparePurchaseIntentV254, purchaseProblemsV254 } from '../services/metaPurchaseDeliveryV254Service.js';
import { prepareConfirmedDropiDispatchV252 } from '../services/confirmedDropiDispatchV252Service.js';
import { installVitPowerOrderHooksV213 } from '../services/vitPowerMeasurementV213Application.js';
import { syncOrderToOnlineAdminPanel } from '../services/adminPanelStatusService.js';

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
        reference: { type: String, default: '' },
        city: { type: String, default: '' },
        province: { type: String, default: '' }
    },
    delivery: {
        mode: { type: String, enum: ['', 'home', 'agency'], default: '' },
        agencyId: { type: String, default: '' },
        agencyName: { type: String, default: '' }
    },
    customerDataResolution: {
        version: { type: Number, default: 28 },
        country: { type: String, enum: ['', 'EC'], default: '' },
        fields: { type: mongoose.Schema.Types.Mixed, default: {} },
        conflicts: { type: [mongoose.Schema.Types.Mixed], default: [] },
        qualityScore: { type: Number, min: 0, max: 100, default: 0 },
        orderDataReady: { type: Boolean, default: false, index: true },
        blockedReasons: { type: [String], default: [] },
        nextRequiredField: { type: String, default: '' },
        evaluatedAt: Date,
        externalGeoAdapter: { type: mongoose.Schema.Types.Mixed, default: {} }
    },
    package: {
        id: { type: Number, default: 0 },
        label: { type: String, default: '' },
        quantity: { type: Number, default: 0 }
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
    entryAt: Date,
    entryReason: {
        type: String,
        default: 'new_purchase'
    },
    previousOrderId: {
        type: String,
        default: ''
    },
    previousDeliveredAt: Date,
    confirmedAt: Date,
    purchaseDeliveryV254: { type: mongoose.Schema.Types.Mixed, default: null },
    integrationIntakeKeyV254: { type: String, default: undefined },
    dropiDispatchV252: {
        version: { type: Number, enum: [252, 254] },
        status: { type: String, enum: ['pending', 'claimed', 'submitted', 'review'] },
        requestedAt: Date, startedAt: Date, completedAt: Date,
        attempts: Number, leaseToken: String, reason: String
    },
    integration: { type: mongoose.Schema.Types.Mixed, default: null },
    source: {
        type: String,
        enum: ['checkout', 'whatsapp', 'manual'],
        default: 'checkout'
    },
    notes: String,
    manualHistoricalStatusV203: {
        type: new mongoose.Schema({
            version: { type: Number, enum: [203], required: true },
            source: { type: String, enum: ['authenticated_operator'], required: true },
            recordedAt: { type: Date, required: true },
            actorId: { type: String, required: true, match: /^[a-f0-9]{24}$/i },
            actor: String,
            orderId: { type: String, required: true },
            phone: { type: String, required: true, match: /^5939\d{8}$/ },
            previousStatus: String,
            status: { type: String, enum: ['delivered', 'returned'], required: true },
            reason: String
        }, { _id: false, strict: true }),
        default: null
    },
    trackingNumber: String,
    dropiOrderId: String,
    shippingStatus: String,
    shippingCanonicalStatus: { type: String, default: 'UNKNOWN', index: true },
    shippingCanonicalEvidence: { type: mongoose.Schema.Types.Mixed, default: {} },
    reviewQueue: {
        status: {
            type: String,
            enum: ['', 'conferir_pedidos', 'finalizado'],
            default: '',
            index: true
        },
        reason: { type: String, default: '' },
        evidence: { type: String, default: '' },
        movedAt: Date,
        movedBy: { type: String, default: '' },
        finalizedAt: Date,
        finalizedBy: { type: String, default: '' }
    },
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
        measurementVersion: Number,
        renderedBranch: String,
        branchIdentity: String,
        browserPixelId: String,
        checkoutEventId: String,
        country: String,
        productKey: String,
        productName: String,
        product: String,
        funnel: String,
        contentName: String,
        contentIds: [String],
        fbclid: String,
        fbc: String,
        fbp: String,
        ext_id: String, // External ID (for affiliates/tracking)
        external_id: String,
        utm_source: String,
        utm_medium: String,
        utm_campaign: String,
        utm_content: String,
        utm_term: String,
        campaign_id: String,
        adset_id: String,
        ad_id: String,
        placement: String,
        attributionCapturedAt: Date,
        sourceUrl: String,
        ip: String,
        userAgent: String,
        clientContextSource: String,
        waSelectedNumber: String,
        metaPurchaseEventId: String,
        metaPurchaseDatasetId: String,
        metaPurchaseDatasetRoute: String,
        metaPurchaseSentAt: Date,
        metaPurchaseResponse: mongoose.Schema.Types.Mixed,
        attributionSource: String,
        attributionVisitorKey: String,
        attributionMatchedAt: Date,
        attributionConfidence: String,
        attributionCorrelationStatus: String,
        attributionCorrelationReason: String
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
    if (!this.isNew && this.isModified('entryAt')) {
        const existing = await this.constructor.findById(this._id).select('entryAt').lean().catch(() => null);
        if (existing?.entryAt) this.entryAt = existing.entryAt;
    }
    if (!this.entryAt) {
        this.entryAt = this.draftCreatedAt || this.createdAt || new Date();
    }
    if (!this.orderId) {
        const stamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).slice(2, 6).toUpperCase();
        this.orderId = `EC-${stamp}-${random}`;
    }
    if ((this.isNew || this.isModified('status')) && this.status === 'confirmed' && !this.confirmedAt) {
        this.confirmedAt = new Date();
    }
    const currentPlaceholder=integrationPolicyV254()&&this.dropiDispatchV252?.version===254&&this.dropiDispatchV252?.reason==='awaiting_customer_data_v254'&&!this.dropiDispatchV252.attempts&&!this.dropiOrderId&&!this.trackingNumber;
    let fulfillmentTransition=this.isNew||this.isModified('status');
    if(currentPlaceholder){this.dropiDispatchV252=null;fulfillmentTransition=true;}
    try{prepareConfirmedDropiDispatchV252(this,{transition:fulfillmentTransition});}
    catch(error){
        if(!integrationPolicyV254()||error.code!=='confirmed_order_incomplete'||purchaseProblemsV254(this).length)throw error;
        if(this.dropiOrderId||this.trackingNumber)throw error;
        this.dropiDispatchV252={version:254,status:'review',reason:'awaiting_customer_data_v254',blockedReasons:error.reasons||[],attempts:0};
    }
    preparePurchaseIntentV254(this, { transition: this.isNew || this.isModified('status') });
    // Track last interaction
    this.lastInteractionAt = new Date();
    next();
});

for (const method of ['updateOne','findOneAndUpdate']) orderSchema.pre(method, async function () {
    if(!integrationPolicyV254())return;
    const update=this.getUpdate()||{},status=update.$set?.status||update.status;
    if(status!=='confirmed')return;
    const before=await this.model.findOne(this.getQuery()).lean();if(!before||before.status==='confirmed')return;
    const confirmedAt=update.$set?.confirmedAt||update.confirmedAt||before.confirmedAt||new Date();
    const prospective={...before,...(update.$set||{}),status:'confirmed',confirmedAt};
    if(!before.confirmedAt&&!update.$set?.confirmedAt&&!update.confirmedAt)update.$set={...(update.$set||{}),confirmedAt};
    if(preparePurchaseIntentV254(prospective,{transition:true}))this.setUpdate({...update,$set:{...(update.$set||{}),purchaseDeliveryV254:prospective.purchaseDeliveryV254}});
});

orderSchema.post('save', function (doc) {
    if (process.env.ONLINE_ADMIN_PANEL_SYNC_ENABLED === 'false') return;
    const result = syncOrderToOnlineAdminPanel(doc, { action: 'order_saved' });
    if (result?.ok || result?.skipped) return;
    console.warn('Painel Unificado sync failed:', result);
});

// Index for efficient queries
orderSchema.index({ country: 1, status: 1 });
orderSchema.index({ 'customer.phone': 1 });
orderSchema.index({ country: 1, 'customer.phone': 1, updatedAt: -1 });
orderSchema.index({ country: 1, 'customer.name': 1 });
orderSchema.index({ country: 1, dropiOrderId: 1 });
orderSchema.index({ country: 1, trackingNumber: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ entryAt: -1 });
orderSchema.index({ status: 1, draftCreatedAt: 1 }); // For draft queries
orderSchema.index({ country: 1, 'tracking.campaign_id': 1 });
orderSchema.index({ country: 1, 'tracking.adset_id': 1 });
orderSchema.index({ country: 1, 'tracking.ad_id': 1 });

installVitPowerOrderHooksV213(orderSchema);

const Order = mongoose.model('Order', orderSchema);

export default Order;
