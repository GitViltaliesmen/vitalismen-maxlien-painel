import { getSock, getSocketId, getOwnPhoneDigits, waitForWhatsAppReady } from './connection.js';
import { canSendOutbound } from './outboundGuard.js';
import { recordOutboundSend, resolveOutboundSessionForJid } from './sessionRouter.js';
import { applyAfterSendPacing, applyHumanPacing, withHumanizedOutboundQueue } from './humanPacing.js';
import { sendTextViaZapi, shouldUseZapiForText } from './zapiOutbound.js';
import { varyOutboundText } from './textVariation.js';

/**
 * Enterprise Text Wrapper for Baileys
 * Provides standardized error handling and formatting for plain text responses
 */
export const sendText = async (jid, text, quotedMsg = null, options = {}) => {
    const outboundText = varyOutboundText(text);
    const zapiRoute = await shouldUseZapiForText({ jid, sessionId: options.sessionId || null });
    if (zapiRoute.use) {
        const guard = canSendOutbound({
            jid: zapiRoute.phone,
            text,
            sessionId: zapiRoute.sessionId,
            ownDigits: zapiRoute.sessionId,
            kind: 'text'
        });
        if (!guard.allowed) {
            console.log(`[ZAPI_SEND_BLOCKED] texto bloqueado -> ${zapiRoute.phone} | reason=${guard.reason}`);
            return false;
        }

        try {
            const { pacing, afterSendMs, sent } = await withHumanizedOutboundQueue(zapiRoute.phone, async () => {
                const pacing = await applyHumanPacing({ sock: null, jid: zapiRoute.phone, kind: 'text', text: outboundText });
                const sent = await sendTextViaZapi({
                    jid,
                    text: outboundText,
                    messageId: options.messageId || ''
                });
                const afterSendMs = sent.ok ? await applyAfterSendPacing({ kind: 'text', text: outboundText }) : 0;
                return { pacing, afterSendMs, sent };
            });
            if (sent.ok) {
                console.log(`[ZAPI_SEND_OK] Texto disparado -> ${sent.phone} | Tamanho: ${String(outboundText || '').length} chars | pacing=${pacing.waitedMs}ms/${pacing.presence} | after=${afterSendMs}ms | reason=${zapiRoute.reason}`);
                recordOutboundSend({ sessionId: zapiRoute.sessionId, jid: zapiRoute.phone });
                return true;
            }
            console.warn(`[ZAPI_SEND_SKIPPED] ${sent.reason || 'unknown'} -> ${jid}`);
        } catch (error) {
            console.error(`[ZAPI_SEND_ERROR] Falha ao enviar texto para ${jid}:`, error?.response?.data || error);
        }

        return false;
    }

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
            const payload = { text: outboundText };
            const options = quotedMsg ? { quoted: quotedMsg } : undefined;

            const { pacing, afterSendMs } = await withHumanizedOutboundQueue(jid, async () => {
                const pacing = await applyHumanPacing({ sock: readySock, jid, kind: 'text', text: outboundText });
                await readySock.sendMessage(jid, payload, options);
                const afterSendMs = await applyAfterSendPacing({ kind: 'text', text: outboundText });
                return { pacing, afterSendMs };
            });
            console.log(`[LOG_SEND_USING_SOCKET] [socketId=${sId}] 📤 Texto disparado -> ${jid} | Tamanho: ${outboundText.length} chars | pacing=${pacing.waitedMs}ms/${pacing.presence} | after=${afterSendMs}ms | tentativa=${attempt} | session=${sessionId || 'auto'}`);
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
