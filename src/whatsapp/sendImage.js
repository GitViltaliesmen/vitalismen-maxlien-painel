import { getSock, getSocketId, getOwnPhoneDigits, waitForWhatsAppReady } from './connection.js';
import { canSendOutbound } from './outboundGuard.js';
import { recordOutboundSend, resolveOutboundSessionForJid } from './sessionRouter.js';
import { applyAfterSendPacing, applyHumanPacing, withHumanizedOutboundQueue } from './humanPacing.js';
import { checkDropiOrderBeforeOutbound } from '../services/dropiOutboundOrderGuardService.js';

export const sendImage = async (jid, imagePath, caption = '', options = {}) => {
    const route = await resolveOutboundSessionForJid({ requestedSessionId: options.sessionId || null, jid, country: options.country || '' });
    const sessionId = route.sessionId;
    const ownDigits = getOwnPhoneDigits(sessionId);
    const sendMode = options.sendMode || '';
    const guard = canSendOutbound({ jid, text: caption, sessionId, ownDigits, kind: 'image', recipientDigits: options.recipientDigits || '' });
    if (!guard.allowed) {
        console.log(`[LOG_SEND_BLOCKED] imagem bloqueada -> ${jid} | reason=${guard.reason}`);
        return false;
    }
    const dropiGuard = await checkDropiOrderBeforeOutbound({
        jid,
        recipientDigits: options.recipientDigits || '',
        text: options.guardText || caption || imagePath,
        allowExistingDropiOrder: options.allowExistingDropiOrder === true,
        outboundContext: options.outboundContext || ''
    });
    if (!dropiGuard.allowed) {
        console.log(`[LOG_SEND_BLOCKED] imagem bloqueada por pedido Dropi existente -> ${jid} | reason=${dropiGuard.reason} | order=${dropiGuard.orderId || ''} | tracking=${dropiGuard.trackingNumber || ''}`);
        return false;
    }

    for (let attempt = 1; attempt <= 2; attempt += 1) {
        const sock = getSock(sessionId);
        const sId = getSocketId(sessionId);

        try {
            const readySock = sock || await waitForWhatsAppReady(12000, sessionId);
            const { pacing, afterSendMs } = await withHumanizedOutboundQueue(jid, async () => {
                const pacing = await applyHumanPacing({ sock: readySock, jid, kind: 'image', text: caption || imagePath, sendMode });
                await readySock.sendMessage(jid, {
                    image: { url: imagePath },
                    ...(caption ? { caption } : {})
                });
                const afterSendMs = await applyAfterSendPacing({ kind: 'image', sendMode });
                return { pacing, afterSendMs };
            }, { sendMode });
            console.log(`[LOG_SEND_USING_SOCKET] [socketId=${sId}] 🖼️ Imagem disparada -> ${jid} | pacing=${pacing.waitedMs}ms/${pacing.presence} | after=${afterSendMs}ms | tentativa=${attempt} | session=${sessionId || 'auto'}`);
            recordOutboundSend({ sessionId, jid });
            return true;
        } catch (error) {
            console.error(`[OUTBOUND-ERROR] ❌ Falha ao enviar imagem para ${jid} | tentativa=${attempt}:`, error);
            if (attempt === 2) return false;
            await waitForWhatsAppReady(15000, sessionId).catch(() => null);
        }
    }

    return false;
};
