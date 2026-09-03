import mongoose from 'mongoose';

const postSaleDispatchQuotaSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    dayKey: { type: String, required: true, index: true },
    timeZone: { type: String, required: true },
    limit: { type: Number, required: true, min: 1 },
    reserved: { type: Number, required: true, default: 0, min: 0 },
    lastReservationAt: { type: Date, default: null },
    lastCorrelationId: { type: String, default: '' },
    expiresAt: { type: Date, required: true }
}, {
    collection: 'post_sale_dispatch_quotas',
    timestamps: true,
    versionKey: false
});

postSaleDispatchQuotaSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const PostSaleDispatchQuota = mongoose.models.PostSaleDispatchQuota
    || mongoose.model('PostSaleDispatchQuota', postSaleDispatchQuotaSchema);

export default PostSaleDispatchQuota;
