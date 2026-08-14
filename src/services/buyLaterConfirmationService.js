import ContactState from '../models/ContactState.js';
import { syncContactDraftToOnlineAdminPanel } from './adminPanelStatusService.js';
import { sendText } from '../whatsapp/sendText.js';
import { toWhatsAppChatId } from '../utils/phone.js';

const digitsOnly = (value) => String(value || '').replace(/\D/g, '');
const normalize = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export const buyLaterReplyDecision = (text = '') => {
    const value = normalize(text);
    if (!value) return 'other';
    if (/^(no|nop|no gracias|ya no|no deseo|no quiero|cancelar|cancele|dejelo|dejela)\b/.test(value)) return 'no';
    if (/^(si|sii|claro|correcto|de acuerdo|ok|okay|listo|confirmo|confirmado|puede preparar|puede enviar|envielo|mande|proceda|hagale)\b/.test(value)) return 'yes';
    return 'other';
};

const findStateForPhone = (phone) => {
    const tail = digitsOnly(phone).slice(-9);
    if (!tail) return null;
    return ContactState.findOne({
        $or: [
            { phoneDigits: { $regex: `${tail}$` } },
            { chatId: { $regex: tail } },
            { 'metadata.customerDraft.phone': { $regex: `${tail}\\D*$` } }
        ]
    }).sort({ updatedAt: -1 });
};

const affirmativeReply = (draft = {}) => {
    const firstName = String(draft.name || '').trim().split(/\s+/)[0] || 'señor';
    return `Perfecto, ${firstName}. Retomamos su pedido. Antes de preparar el envío, vamos a revisar sus datos para evitar cualquier error. ¿Su nombre completo sigue siendo ${draft.name || 'el mismo que nos indicó'}?`;
};

export const handleBuyLaterConfirmationReply = async ({ phone, chatId, body, messageId, sessionId = 'zapi' } = {}) => {
    const state = await findStateForPhone(phone || chatId);
    const followup = state?.metadata?.buyLaterFollowup || {};
    if (!state || followup.awaitingReply !== true) return { handled: false, reason: 'not_awaiting_buy_later_reply' };
    if (messageId && followup.lastResponseMessageId === messageId) return { handled: true, reason: 'duplicate_reply' };

    const decision = buyLaterReplyDecision(body);
    const draft = state.metadata?.customerDraft || {};
    const nextStatus = decision === 'no' ? 'cancelado' : 'atendendo';
    const now = new Date();
    state.metadata = {
        ...(state.metadata || {}),
        customerDraft: {
            ...draft,
            status: nextStatus,
            updatedAt: now.toISOString()
        },
        buyLaterFollowup: {
            ...followup,
            awaitingReply: false,
            response: decision,
            responseText: String(body || '').slice(0, 500),
            responseAt: now,
            lastResponseMessageId: messageId || ''
        }
    };
    await state.save();
    syncContactDraftToOnlineAdminPanel(state.metadata.customerDraft, {
        country: state.countryCode || 'EC',
        adminStatus: nextStatus,
        action: `comprar_depois_resposta_${decision}`,
        note: `Resposta ao lembrete Comprar depois: ${decision}`
    });

    if (decision === 'other') return { handled: false, reason: 'reply_released_to_normal_funnel', decision };
    const phoneDigits = digitsOnly(phone || state.phoneDigits);
    const jid = toWhatsAppChatId(phoneDigits, state.countryCode || 'EC');
    const reply = decision === 'yes'
        ? affirmativeReply(draft)
        : 'Entendido. No prepararemos ningún envío y no volveremos a recordarle este pedido. Si cambia de opinión, puede escribirnos cuando desee.';
    const sent = jid ? await sendText(jid, reply, null, {
        recipientDigits: phoneDigits,
        sessionId,
        force: false,
        humanize: true,
        outboundContext: `buy_later_reply_${decision}`
    }) : false;
    return { handled: Boolean(sent), reason: sent ? `buy_later_${decision}_handled` : 'reply_send_failed', decision };
};
