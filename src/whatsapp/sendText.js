import { getSock, getSocketId, getOwnPhoneDigits, waitForWhatsAppReady } from './connection.js';
import { canSendOutbound } from './outboundGuard.js';
import { recordOutboundSend, resolveOutboundSessionForJid } from './sessionRouter.js';
import { applyAfterSendPacing, applyHumanPacing, withHumanizedOutboundQueue } from './humanPacing.js';

/**
 * Enterprise Text Wrapper for Baileys
 * Provides standardized error handling and formatting for plain text responses
 */
export const sendText = async (jid, text, quotedMsg = null, options = {}) => {
    const route = await resolveOutboundSessionForJid({ requestedSessionId: options.sessionId || null, jid });
    const sessionId = route.sessionId;
    const ownDigits = getOwnPhoneDigits(sessionId);
    const guard = canSendOutbound({ jid, text, sessionId, ownDigits, kind: 'text' });
    if (!guard.allowed) {
        console.log(`[LOG_SEND_BLOCKED] texto bloqueado -> ${jid} | reason=${guard.reason}`);
        return false;
    }

    for (let attempt = 1; attempt <= 2; attempt += 1) {
        const sock = getSock(sessionId);
        const sId = getSocketId(sessionId);

        try {
            const readySock = sock || await waitForWhatsAppReady(12000, sessionId);
            const payload = { text };
            const options = quotedMsg ? { quoted: quotedMsg } : undefined;

            const { pacing, afterSendMs } = await withHumanizedOutboundQueue(jid, async () => {
                const pacing = await applyHumanPacing({ sock: readySock, jid, kind: 'text', text });
                await readySock.sendMessage(jid, payload, options);
                const afterSendMs = await applyAfterSendPacing({ kind: 'text', text });
                return { pacing, afterSendMs };
            });
            console.log(`[LOG_SEND_USING_SOCKET] [socketId=${sId}] 📤 Texto disparado -> ${jid} | Tamanho: ${text.length} chars | pacing=${pacing.waitedMs}ms/${pacing.presence} | after=${afterSendMs}ms | tentativa=${attempt} | session=${sessionId || 'auto'}`);
            recordOutboundSend({ sessionId, jid });
            return true;
        } catch (error) {
            console.error(`[OUTBOUND-ERROR] ❌ Falha ao enviar texto para ${jid} | tentativa=${attempt}:`, error);
            if (attempt === 2) return false;
            await waitForWhatsAppReady(15000, sessionId).catch(() => null);
        }
    }
    return false;
};
