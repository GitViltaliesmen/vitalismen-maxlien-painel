import mongoose from 'mongoose';

const observationFindingSchema = new mongoose.Schema({
    priority: { type: String, default: 'important', index: true },
    category: { type: String, default: 'general', index: true },
    chatId: { type: String, default: '', index: true },
    phone: { type: String, default: '', index: true },
    customerText: { type: String, default: '' },
    botText: { type: String, default: '' },
    whyItMatters: { type: String, default: '' },
    suggestedReply: { type: String, default: '' },
    suggestedAudio: { type: String, default: '' },
    suggestedProof: { type: String, default: '' },
    recommendedStatus: { type: String, default: '' },
    recommendedAction: { type: String, default: 'review' }
}, { _id: false });

const observationReportSchema = new mongoose.Schema({
    title: { type: String, required: true },
    mode: { type: String, default: 'automatic', index: true },
    status: { type: String, default: 'completed', index: true },
    country: { type: String, default: 'EC', index: true },
    source: {
        from: Date,
        to: Date,
        limit: { type: Number, default: 0 },
        conversations: { type: Number, default: 0 },
        messages: { type: Number, default: 0 }
    },
    summary: {
        critical: { type: Number, default: 0 },
        important: { type: Number, default: 0 },
        improvements: { type: Number, default: 0 },
        buyLaterSignals: { type: Number, default: 0 },
        trustSignals: { type: Number, default: 0 },
        medicalSignals: { type: Number, default: 0 },
        unansweredSignals: { type: Number, default: 0 }
    },
    findings: { type: [observationFindingSchema], default: [] },
    recommendations: { type: [String], default: [] },
    generatedBy: { type: String, default: 'observation-bot' },
    error: { type: String, default: '' }
}, {
    timestamps: true
});

observationReportSchema.index({ createdAt: -1 });
observationReportSchema.index({ country: 1, createdAt: -1 });

const ObservationReport = mongoose.model('ObservationReport', observationReportSchema);

export default ObservationReport;
