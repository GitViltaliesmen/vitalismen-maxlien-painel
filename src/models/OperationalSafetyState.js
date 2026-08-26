import mongoose from 'mongoose';

const operationalSafetyStateSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    dataCompatibilityVersion: { type: Number, required: true, default: 0 },
    minRuntimeVersion: { type: Number, required: true, default: 0 },
    writerRuntimeVersion: { type: Number, required: true, default: 0 },
    bridgeComplete: { type: Boolean, required: true, default: false },
    bridgeCompletedAt: { type: Date, default: null },
    bridgeSource: { type: String, default: '' },
    notes: { type: String, default: '' }
}, {
    collection: 'operational_safety_states',
    timestamps: true,
    versionKey: false
});

const OperationalSafetyState = mongoose.models.OperationalSafetyState
    || mongoose.model('OperationalSafetyState', operationalSafetyStateSchema);

export default OperationalSafetyState;
