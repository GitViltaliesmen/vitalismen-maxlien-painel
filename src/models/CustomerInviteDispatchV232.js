import mongoose from 'mongoose';
// Permanent reservations deliberately have no TTL: expiry must never enable a resend.
const schema = new mongoose.Schema({
  _id: { type: String, required: true },
  phone: String, stage: String, orderId: String,
  state: { type: String, enum: ['global', 'reserved', 'attempted', 'sent', 'ambiguous', 'suppressed'], required: true },
  lockToken: String, lockedUntil: Date, attemptedAt: Date, dispatchClaimedAt: Date, sentAt: Date,
  providerMessageId: String, lastAttemptAt: Date, reason: String
}, { timestamps: true, strict: true });
export default mongoose.model('CustomerInviteDispatchV232', schema);
