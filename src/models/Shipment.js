import mongoose from 'mongoose';

const shipmentEventSchema = new mongoose.Schema({
    kind: { type: String, default: '' },
    at: { type: Date, default: Date.now },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { _id: false });

const shipmentNotificationLedgerSchema = new mongoose.Schema({
    notification_id: { type: String, required: true },
    order_id: { type: String, default: '' },
    notification_type: { type: String, default: '' },
    logistics_status: { type: String, default: 'UNKNOWN' },
    pickup_ready_verified: { type: Boolean, default: false },
    template_version: { type: String, default: 'v29' },
    created_at: { type: Date, default: Date.now },
    sent_at: { type: Date, default: null },
    delivered_at: { type: Date, default: null },
    read_at: { type: Date, default: null },
    source: { type: String, default: '' },
    mode: { type: String, enum: ['automatic', 'manual'], default: 'automatic' },
    blocked_reason: { type: String, default: '' },
    provider_message_id: { type: String, default: '' }
}, { _id: false });

const shipmentSchema = new mongoose.Schema({
    orderId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    country: {
        type: String,
        enum: ['EC'],
        required: true,
        index: true
    },
    provider: {
        type: String,
        default: 'droppi'
    },
    productName: {
        type: String,
        default: ''
    },
    client: {
        name: { type: String, default: '' },
        phone: { type: String, default: '', index: true },
        email: { type: String, default: '' },
        address: { type: String, default: '' },
        city: { type: String, default: '' },
        province: { type: String, default: '' },
        reference: { type: String, default: '' }
    },
    logistics: {
        status: {
            type: String,
            default: 'created',
            index: true
        },
        trackingNumber: { type: String, default: '', index: true },
        distributionCompany: { type: String, default: '' },
        warehouse: { type: String, default: '' },
        shippingType: { type: String, default: '' },
        preferredCarrier: { type: String, default: 'SERVIENTREGA' },
        chosenCarrier: { type: String, default: '' },
        agencyPickup: { type: Boolean, default: false },
        agencyName: { type: String, default: '' },
        invoiceUrl: { type: String, default: '' },
        invoicePath: { type: String, default: '' },
        guidePrintUrl: { type: String, default: '' },
        guidePrintPath: { type: String, default: '' },
        pickupReadyVerified: { type: Boolean, default: false, index: true },
        pickupReadyVerifiedAt: { type: Date, default: null },
        pickupReadyVerifiedSource: { type: String, default: '' },
        lastStatusAt: { type: Date, default: null }
    },
    automation: {
        sessionId: { type: String, default: '' },
        submittedToDroppiAt: { type: Date, default: null },
        submitAttemptedAt: { type: Date, default: null },
        submitLockedUntil: { type: Date, default: null },
        dispatchLockedUntil: { type: Date, default: null },
        notificationLocks: { type: mongoose.Schema.Types.Mixed, default: {} },
        dropiSubmitAuthorizedAt: { type: Date, default: null },
        dropiSubmitAuthorizedBy: { type: String, default: '' },
        dropiSubmitAuthorizationNote: { type: String, default: '' },
        browserCheckpoint: { type: String, default: '' },
        browserLastError: { type: String, default: '' },
        opsAlertAcknowledgedAt: { type: Date, default: null },
        opsAlertAcknowledgedBy: { type: String, default: '' },
        opsAlertAcknowledgedKind: { type: String, default: '' },
        guiaNotifiedAt: { type: Date, default: null },
        guidePrintNotifiedAt: { type: Date, default: null },
        guidePrintDispatchLockedUntil: { type: Date, default: null },
        guidePrintLastAttemptAt: { type: Date, default: null },
        guidePrintLastError: { type: String, default: '' },
        inTransitNotifiedAt: { type: Date, default: null },
        readyForPickupNotifiedAt: { type: Date, default: null },
        reminderDay1At: { type: Date, default: null },
        reminderSoftDay2At: { type: Date, default: null },
        reminderDay3At: { type: Date, default: null },
        reminderSoftDay4At: { type: Date, default: null },
        reminderDay5At: { type: Date, default: null },
        reminderSoftDay6At: { type: Date, default: null },
        pickupReminderDispatchLockedUntil: { type: Date, default: null },
        pickupReminderLastAttemptAt: { type: Date, default: null },
        pickupReminderLastError: { type: String, default: '' },
        returnedNotifiedAt: { type: Date, default: null },
        deliveredConfirmedAt: { type: Date, default: null },
        prepaidOnlyNotifiedAt: { type: Date, default: null },
        pickupProofRequestedAt: { type: Date, default: null },
        pickupProofDispatchLockedUntil: { type: Date, default: null },
        pickupProofLastAttemptAt: { type: Date, default: null },
        pickupProofLastError: { type: String, default: '' },
        bonusNotifiedAt: { type: Date, default: null },
        refillReminderAt: { type: Date, default: null },
        refillReminderDispatchLockedUntil: { type: Date, default: null },
        refillReminderLastAttemptAt: { type: Date, default: null },
        refillReminderLastError: { type: String, default: '' },
        lastReminderAt: { type: Date, default: null },
        lastAudioAt: { type: Date, default: null },
        lastReminderKind: { type: String, default: '' },
        sentMessageHashes: {
            type: [String],
            default: []
        },
        sentAudioLog: {
            type: [mongoose.Schema.Types.Mixed],
            default: []
        }
    },
    treatment: {
        unitsPurchased: { type: Number, default: 1 },
        daysPerUnit: { type: Number, default: 30 },
        targetUnits: { type: Number, default: 6 },
        treatmentEndsAt: { type: Date, default: null },
        refillReminderDueAt: { type: Date, default: null }
    },
    proof: {
        productPhotoUrl: { type: String, default: '' },
        agencyReceiptPhotoUrl: { type: String, default: '' },
        pickupProofReceivedAt: { type: Date, default: null }
    },
    outcomes: {
        delivered: { type: Boolean, default: false },
        pickedUp: { type: Boolean, default: false },
        returned: { type: Boolean, default: false },
        prepaidOnly: { type: Boolean, default: false },
        refusalReason: { type: String, default: '' }
    },
    review: {
        manualOnly: { type: Boolean, default: false },
        reviewReason: { type: String, default: '' },
        reviewStatus: { type: String, default: '' },
        resolutionLockUntil: { type: Date, default: null },
        resolutionLockToken: { type: String, default: '' },
        resolvedAt: { type: Date, default: null },
        resolvedSource: { type: String, default: '' },
        resolvedEvidence: { type: mongoose.Schema.Types.Mixed, default: {} },
        resolutionHistory: { type: [mongoose.Schema.Types.Mixed], default: [] },
        suppressedNotificationKinds: { type: [String], default: [] }
    },
    notes: {
        type: String,
        default: ''
    },
    raw: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    events: {
        type: [shipmentEventSchema],
        default: []
    },
    notificationLedger: {
        type: [shipmentNotificationLedgerSchema],
        default: []
    }
}, {
    timestamps: true
});

shipmentSchema.index({ country: 1, 'logistics.status': 1 });
shipmentSchema.index({ 'client.phone': 1, updatedAt: -1 });
shipmentSchema.index({ country: 1, 'client.name': 1 });
shipmentSchema.index({ country: 1, 'logistics.trackingNumber': 1 });
shipmentSchema.index({ country: 1, 'raw.manualDropiOrderId': 1 });
shipmentSchema.index({ country: 1, 'raw.latestDroppiPayload.dropiOrderId': 1 });
shipmentSchema.index({ country: 1, 'raw.droppiOrder.id': 1 });

const Shipment = mongoose.model('Shipment', shipmentSchema);

export default Shipment;
