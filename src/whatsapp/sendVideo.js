import { getOwnPhoneDigits, getSock, waitForWhatsAppReady } from './connection.js';
import { canSendOutbound } from './outboundGuard.js';
import { recordOutboundSend, resolveOutboundSessionForJid } from './sessionRouter.js';
import fs from 'fs';
import { applyAfterSendPacing, applyHumanPacing, withHumanizedOutboundQueue } from './humanPacing.js';
import { sendVideoViaZapi, shouldUseZapiForMedia } from './zapiOutbound.js';

export const sendVideo = async (jid, videoPath, caption = '', options = {}) => {
    const zapiRoute = await shouldUseZapiForMedia({ jid, sessionId: options.sessionId || null });
    if (zapiRoute.use) {
        const guard = canSendOutbound({ jid: zapiRoute.phone, text: caption || videoPath, sessionId: zapiRoute.sessionId, ownDigits: zapiRoute.sessionId, kind: 'video' });
        if (!guard.allowed) {
            console.log(`[ZAPI_SEND_BLOCKED] video bloqueado -> ${zapiRoute.phone} | reason=${guard.reason}`);
            return false;
        }

        if (!fs.existsSync(videoPath) && !/^https?:\/\//i.test(String(videoPath || '')) && !/^data:/i.test(String(videoPath || ''))) {
            console.error(`[ZAPI_SEND_ERROR] video nao encontrado: ${videoPath}`);
            return false;
        }

        try {
            const { pacing, afterSendMs, sent } = await withHumanizedOutboundQueue(zapiRoute.phone, async () => {
                const pacing = await applyHumanPacing({ sock: null, jid: zapiRoute.phone, kind: 'video', text: caption || videoPath });
                const sent = await sendVideoViaZapi({ jid, video: videoPath, caption });
                const afterSendMs = sent.ok ? await applyAfterSendPacing({ kind: 'video' }) : 0;
                return { pacing, afterSendMs, sent };
            });
            if (sent.ok) {
                console.log(`[ZAPI_SEND_OK] Video disparado -> ${sent.phone} | Arquivo: ${videoPath} | pacing=${pacing.waitedMs}ms/${pacing.presence} | after=${afterSendMs}ms | reason=${zapiRoute.reason}`);
                recordOutboundSend({ sessionId: zapiRoute.sessionId, jid: zapiRoute.phone });
                return true;
            }
            console.warn(`[ZAPI_SEND_SKIPPED] video ${sent.reason || 'unknown'} -> ${jid}`);
        } catch (error) {
            console.error(`[ZAPI_SEND_ERROR] Falha ao enviar video para ${jid}:`, error?.response?.data || error);
        }
        return false;
    }

    const route = await resolveOutboundSessionForJid({ requestedSessionId: options.sessionId || null, jid });
    const sessionId = route.sessionId;
    const ownDigits = getOwnPhoneDigits(sessionId);
    const guard = canSendOutbound({ jid, text: caption || videoPath, sessionId, ownDigits, kind: 'video' });
    if (!guard.allowed) {
        console.log(`[LOG_SEND_BLOCKED] video bloqueado -> ${jid} | reason=${guard.reason}`);
        return false;
    }

    if (!fs.existsSync(videoPath)) {
        console.error(`[OUTBOUND-VIDEO-ERROR] Arquivo de video nao encontrado: ${videoPath}`);
        return false;
    }

    for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
            const sock = getSock(sessionId) || await waitForWhatsAppReady(12000, sessionId);
            const payload = {
                video: { url: videoPath },
                mimetype: 'video/mp4',
                ...(caption ? { caption } : {}),
                ...(options.viewOnce ? { viewOnce: true } : {})
            };

            const { pacing, afterSendMs, result } = await withHumanizedOutboundQueue(jid, async () => {
                const pacing = await applyHumanPacing({ sock, jid, kind: 'video', text: caption || videoPath });
                const result = await sock.sendMessage(jid, payload);
                const afterSendMs = result ? await applyAfterSendPacing({ kind: 'video' }) : 0;
                return { pacing, afterSendMs, result };
            });

            console.log(`[OUTBOUND] Video transmitido -> ${jid} | Arquivo: ${videoPath} | viewOnce=${Boolean(options.viewOnce)} | pacing=${pacing.waitedMs}ms/${pacing.presence} | after=${afterSendMs}ms | tentativa=${attempt} | session=${sessionId || 'auto'}`);
            if (result) recordOutboundSend({ sessionId, jid });
            return !!result;
        } catch (error) {
            console.error(`[OUTBOUND-VIDEO-ERROR] Falha ao enviar video para ${jid} | tentativa=${attempt}:`, error);
            if (attempt === 2) return false;
            await waitForWhatsAppReady(15000, sessionId).catch(() => null);
        }
    }

    return false;
};
