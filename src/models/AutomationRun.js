import mongoose from 'mongoose';

const automationRunSchema = new mongoose.Schema({
    kind: { type: String, required: true, index: true },
    status: { type: String, default: 'completed', index: true },
    requestedBy: { type: String, default: '' },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    error: { type: String, default: '' }
}, {
    timestamps: true
});

automationRunSchema.index({ kind: 1, createdAt: -1 });

const AutomationRun = mongoose.model('AutomationRun', automationRunSchema);

export default AutomationRun;
