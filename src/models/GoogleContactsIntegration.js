import mongoose from 'mongoose';

const googleContactsIntegrationSchema = new mongoose.Schema({
    key: { type: String, default: 'primary', unique: true, index: true },
    status: {
        type: String,
        enum: ['disconnected', 'connected', 'error'],
        default: 'disconnected',
        index: true
    },
    accountEmail: { type: String, default: '' },
    encryptedRefreshToken: { type: String, default: '' },
    tokenIv: { type: String, default: '' },
    tokenAuthTag: { type: String, default: '' },
    scopes: { type: [String], default: [] },
    enabledAt: Date,
    connectedAt: Date,
    disconnectedAt: Date,
    lastTokenRefreshAt: Date,
    lastError: { type: String, default: '' },
    connectedBy: { type: String, default: '' }
}, { timestamps: true });

export default mongoose.model('GoogleContactsIntegration', googleContactsIntegrationSchema);
