import OutboundDedupe from '../models/OutboundDedupe.js';
import { sendAudio } from '../whatsapp/sendAudio.js';
import { fingerprintOutbound, resolveOutboundPhoneDigits } from './outboundDedupeService.js';
import { resolveCountryAudio } from './audioTemplateService.js';
import { TEX_ULTRA_EC_PRODUCT_PROFILE } from './texUltraProductProfile.js';

export const TEX_ULTRA_HOW_TO_USE_AUDIO_CONTEXT = 'tex_ultra_how_to_use_audio_v31';

export const texUltraHowToUseAudioDedupeValue = (
    baseName = TEX_ULTRA_EC_PRODUCT_PROFILE.postSale.howToUseAudioName
) => `${TEX_ULTRA_HOW_TO_USE_AUDIO_CONTEXT}:${String(baseName || '').trim()}`;

export const findTexUltraHowToUseAudioSentRecord = async ({ jid, dedupeValue, recipientDigits = '' }) => {
    const phoneDigits = await resolveOutboundPhoneDigits({ jid, recipientDigits });
    if (!phoneDigits) return null;
    const fingerprint = fingerprintOutbound({ kind: 'audio', value: dedupeValue });
    return OutboundDedupe.findOne({ phoneDigits, kind: 'audio', fingerprint, status: 'sent' })
        .lean()
        .catch(() => null);
};

export const sendTexUltraHowToUseAudio = async ({
    state,
    resolveAudio = resolveCountryAudio,
    sendAudioFile = sendAudio,
    findSentAudio = findTexUltraHowToUseAudioSentRecord
} = {}) => {
    const baseName = TEX_ULTRA_EC_PRODUCT_PROFILE.postSale.howToUseAudioName;
    const jid = state?.chatId || (state?.phoneDigits ? `${String(state.phoneDigits).replace(/\D/g, '')}@c.us` : '');
    if (!baseName || !jid) return { sent: false, reason: 'missing_audio_or_contact', baseName };

    const dedupeValue = texUltraHowToUseAudioDedupeValue(baseName);
    const recipientDigits = String(state?.phoneDigits || '').replace(/\D/g, '');
    const existing = await findSentAudio({ jid, dedupeValue, recipientDigits });
    if (existing) {
        return {
            sent: false,
            reason: 'already_sent',
            baseName,
            dedupeValue,
            sentAt: existing.sentAt || ''
        };
    }

    const audioPath = await resolveAudio({ country: 'EC', baseName });
    if (!audioPath) return { sent: false, reason: 'audio_not_found', baseName, dedupeValue };

    const result = await sendAudioFile(jid, audioPath, true, {
        sessionId: state?.metadata?.lastSessionId || null,
        country: 'EC',
        recipientDigits,
        allowExistingDropiOrder: true,
        outboundContext: TEX_ULTRA_HOW_TO_USE_AUDIO_CONTEXT,
        dedupeValue,
        returnDetails: true
    });
    if (result === true || result?.ok === true) {
        return {
            sent: true,
            reason: 'sent',
            baseName,
            dedupeValue,
            providerMessageId: result?.providerMessageId || ''
        };
    }

    const sentAfterAttempt = await findSentAudio({ jid, dedupeValue, recipientDigits });
    if (sentAfterAttempt) {
        return {
            sent: false,
            reason: 'already_sent',
            baseName,
            dedupeValue,
            sentAt: sentAfterAttempt.sentAt || ''
        };
    }
    return { sent: false, reason: result?.error || 'send_failed', baseName, dedupeValue };
};
