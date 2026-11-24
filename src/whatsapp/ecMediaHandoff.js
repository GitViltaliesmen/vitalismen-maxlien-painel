import ContactState from '../models/ContactState.js';
import { applyEcMediaHandoff } from './ecMediaHandoffPolicy.js';

const digits = value => String(value || '').replace(/\D/g, '');

// A media-dependent funnel cannot continue on the first text-only transport.
// The existing no-auto-resend marker also blocks subsequent automatic texts;
// authenticated manual_panel sends retain their established exception.
export const recordEcMediaHandoff = async ({ jid = '', recipientDigits = '', kind = 'media' } = {}) => {
    const phone = digits(recipientDigits || jid);
    const identity = [{ chatId: String(jid || '') }];
    if (/^593[2-79]\d{8}$/.test(phone) || phone === '5515998038637') identity.push({ phoneDigits: phone });
    const state = await ContactState.findOne({ $or: identity }).sort({ updatedAt: -1 });
    const outcome = applyEcMediaHandoff(state, kind);
    if (outcome.duplicate) return outcome;
    state.markModified('metadata');
    await state.save();
    return outcome;
};
