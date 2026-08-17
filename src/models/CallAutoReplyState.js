import mongoose from 'mongoose';

const handledCallSchema = new mongoose.Schema({
    key: { type: String, required: true },
    at: { type: Date, required: true }
}, { _id: false });

const callAutoReplyStateSchema = new mongoose.Schema({
    phoneKey: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    windowStartedAt: Date,
    audioAttemptedAt: Date,
    audioSentAt: Date,
    textAttemptedAt: Date,
    textSentAt: Date,
    lastCallAt: Date,
    lastProvider: { type: String, default: '' },
    lastProviderCallId: { type: String, default: '' },
    handledCalls: {
        type: [handledCallSchema],
        default: []
    },
    lockOwner: { type: String, default: '' },
    lockUntil: Date,
    lastResult: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, { timestamps: true });

const CallAutoReplyState = mongoose.model('CallAutoReplyState', callAutoReplyStateSchema);

export default CallAutoReplyState;
