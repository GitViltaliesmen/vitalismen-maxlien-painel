import mongoose from 'mongoose';

const integrationOauthStateSchema = new mongoose.Schema({
    provider: { type: String, enum: ['google_contacts'], required: true, index: true },
    stateHash: { type: String, required: true, unique: true, index: true },
    requestedBy: { type: String, default: '' },
    expiresAt: { type: Date, required: true },
    usedAt: Date
}, { timestamps: true });

integrationOauthStateSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('IntegrationOauthState', integrationOauthStateSchema);
