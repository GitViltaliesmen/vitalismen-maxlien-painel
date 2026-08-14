import ContactState from '../models/ContactState.js';

const digitsOnly = (value) => String(value || '').replace(/\D/g, '');

export const operatorNoAutoResendState = (state = {}) => (
    state?.metadata?.operatorNoAutoResend === true
    || (Array.isArray(state?.tags) && state.tags.includes('manual:no_auto_resend'))
);

export const operatorNoAutoResendForTarget = async ({ jid = '', recipientDigits = '', sendMode = '' } = {}) => {
    if (sendMode === 'manual_panel') return false;
    const phone = digitsOnly(recipientDigits || jid);
    if (!phone) return false;
    const tail = phone.slice(-9);
    const state = await ContactState.findOne({
        $and: [
            {
                $or: [
                    { phoneDigits: phone },
                    { phoneDigits: { $regex: `${tail}$` } },
                    { chatId: { $regex: tail } }
                ]
            },
            {
                $or: [
                    { 'metadata.operatorNoAutoResend': true },
                    { tags: 'manual:no_auto_resend' }
                ]
            }
        ]
    }).select('_id').lean();
    return Boolean(state);
};
