import { getSock, getSocketId, getOwnPhoneDigits, waitForWhatsAppReady } from './connection.js';
import { canSendOutbound } from './outboundGuard.js';
import { recordOutboundSend, resolveOutboundSessionForJid } from './sessionRouter.js';
import { applyAfterSendPacing, applyHumanPacing, withHumanizedOutboundQueue } from './humanPacing.js';

export const sendImage = async (jid, imagePath, caption = '', options = {}) => {
    const route = await resolveOutboundSessionForJid({ requestedSessionId: options.sessionId || null, jid });
    const sessionId = route.sessionId;
    const ownDigits = getOwnPhoneDigits(sessionId);
    const guard = canSendOutbound({ jid, text: caption, sessionId, ownDigits, kind: 'image' });
    if (!guard.allowed) {
        console.log(`[LOG_SEND_BLOCKED] imagem bloqueada -> ${jid} | reason=${guard.reason}`);
        return false;
    }

    for (let attempt = 1; attempt <= 2; attempt += 1) {
        const sock = getSock(sessionId);
        const sId = getSocketId(sessionId);

        try {
            const readySock = sock || await waitForWhatsAppReady(12000, sessionId);
            const { pacing, afterSendMs } = await withHumanizedOutboundQueue(jid, async () => {
                const pacing = await applyHumanPacing({ sock: readySock, jid, kind: 'image', text: caption || imagePath });
                await readySock.sendMessage(jid, {
                    image: { url: imagePath },
                    ...(caption ? { caption } : {})
                });
                const afterSendMs = await applyAfterSendPacing({ kind: 'image' });
                return { pacing, afterSendMs };
            });
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
