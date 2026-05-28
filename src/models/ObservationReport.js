import mongoose from 'mongoose';

const observationFindingSchema = new mongoose.Schema({
    priority: { type: String, default: 'important', index: true },
    category: { type: String, default: 'general', index: true },
    chatId: { type: String, default: '', index: true },
    phone: { type: String, default: '', index: true },
    occurredAt: Date,
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
        unansweredSignals: { type: Number, default: 0 },
        confirmedOrders: { type: Number, default: 0 },
        bonusEligible: { type: Number, default: 0 },
        bonusSent: { type: Number, default: 0 },
        bonusMissing: { type: Number, default: 0 },
        bonusPickupRateWithBonus: { type: Number, default: 0 },
        bonusPickupRateWithoutBonus: { type: Number, default: 0 },
        recoveryCandidates: { type: Number, default: 0 },
        flashPromoCandidates: { type: Number, default: 0 },
        bonusRecoveryCandidates: { type: Number, default: 0 },
        avgKitUnits: { type: Number, default: 0 },
        avgTicket: { type: Number, default: 0 },
        kitUpgradeCandidates: { type: Number, default: 0 },
        hotLeads: { type: Number, default: 0 },
        warmLeads: { type: Number, default: 0 },
        coldLeads: { type: Number, default: 0 },
        falseOrderRisk: { type: Number, default: 0 },
        pickupHighScore: { type: Number, default: 0 },
        coldBotReplies: { type: Number, default: 0 },
        winningPhrases: { type: Number, default: 0 }
    },
    insights: {
        salesByHour: { type: [mongoose.Schema.Types.Mixed], default: [] },
        messageByHour: { type: [mongoose.Schema.Types.Mixed], default: [] },
        hotHours: { type: [mongoose.Schema.Types.Mixed], default: [] },
        bonus: {
            eligible: { type: Number, default: 0 },
            sent: { type: Number, default: 0 },
            missing: { type: Number, default: 0 },
            deliveredOrPickedWithBonus: { type: Number, default: 0 },
            deliveredOrPickedWithoutBonus: { type: Number, default: 0 },
            pickupRateWithBonus: { type: Number, default: 0 },
            pickupRateWithoutBonus: { type: Number, default: 0 },
            missingShipments: { type: [mongoose.Schema.Types.Mixed], default: [] },
            note: { type: String, default: '' }
        },
        recovery: {
            candidates: { type: [mongoose.Schema.Types.Mixed], default: [] },
            strategyCounts: { type: mongoose.Schema.Types.Mixed, default: {} },
            note: { type: String, default: '' }
        },
        kit: {
            avgUnits: { type: Number, default: 0 },
            avgTicket: { type: Number, default: 0 },
            distribution: { type: [mongoose.Schema.Types.Mixed], default: [] },
            upgradeCandidates: { type: [mongoose.Schema.Types.Mixed], default: [] },
            note: { type: String, default: '' }
        },
        lossMap: {
            stages: { type: [mongoose.Schema.Types.Mixed], default: [] },
            note: { type: String, default: '' }
        },
        leadIntelligence: {
            temperatures: { type: [mongoose.Schema.Types.Mixed], default: [] },
            dominantObjections: { type: [mongoose.Schema.Types.Mixed], default: [] },
            nextBestActions: { type: [mongoose.Schema.Types.Mixed], default: [] },
            falseOrderRisk: { type: [mongoose.Schema.Types.Mixed], default: [] },
            pickupScores: { type: [mongoose.Schema.Types.Mixed], default: [] },
            coldBotReplies: { type: [mongoose.Schema.Types.Mixed], default: [] },
            winningPhrases: { type: [mongoose.Schema.Types.Mixed], default: [] },
            abSignals: { type: [mongoose.Schema.Types.Mixed], default: [] },
            dailyOperator: { type: mongoose.Schema.Types.Mixed, default: {} },
            note: { type: String, default: '' }
        }
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
