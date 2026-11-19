import mongoose from 'mongoose';
const schema = new mongoose.Schema({
    _id: String, country: { type: String, enum: ['EC'], required: true }, orderId: { type: String, required: true },
    eventName: { type: String, enum: ['Purchase'], required: true }, eventId: String, datasetId: String, datasetRoute: String,
    occurredAt: Date, state: { type: String, enum: ['pending','sending','retry_wait','accepted','blocked','ambiguous','expired'], required: true },
    attempts: Number, nextAttemptAt: Date, leaseToken: String, leaseUntil: Date, attemptedAt: Date, dispatchedAt: Date,
    acceptedAt: Date, response: mongoose.Schema.Types.Mixed, lastError: String, lastHttpStatus: Number,
    requestSha256: String, payload: mongoose.Schema.Types.Mixed, attribution: mongoose.Schema.Types.Mixed,
    history: [mongoose.Schema.Types.Mixed]
}, { timestamps: true, versionKey: false, autoIndex: false, autoCreate: false, collection: 'metapurchasedeliveriesv254' });
schema.index({ country: 1, orderId: 1, eventName: 1 }, { unique: true });
schema.index({ state: 1, nextAttemptAt: 1 });
export default mongoose.models.MetaPurchaseDeliveryV254 || mongoose.model('MetaPurchaseDeliveryV254', schema);
