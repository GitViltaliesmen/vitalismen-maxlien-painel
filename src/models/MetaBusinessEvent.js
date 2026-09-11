import mongoose from 'mongoose';

// Ledger de um evento de negócio. A atribuição continua no contexto canônico VslVisit/Order.
const schema = new mongoose.Schema({
    _id: { type: String, required: true },
    eventName: { type: String, enum: ['InitiateCheckout'], required: true },
    contactStateId: { type: String, required: true },
    cycleIdentity: { type: String, required: true },
    sourceMessageId: { type: String, required: true },
    visitId: { type: mongoose.Schema.Types.ObjectId, default: null },
    occurredAt: { type: Date, required: true },
    activationAt: { type: Date, required: true },
    state: { type: String, enum: ['INTENDED', 'ACCEPTED', 'REJECTED', 'AMBIGUOUS'], required: true },
    attributionSha256: String,
    customerPhoneSha256: String,
    boundOrderId: String,
    requestSha256: String,
    datasetId: String,
    response: mongoose.Schema.Types.Mixed,
    acceptedAt: Date,
    attemptedAt: Date
}, { timestamps: true, versionKey: false });

export default mongoose.models.MetaBusinessEvent || mongoose.model('MetaBusinessEvent', schema);
