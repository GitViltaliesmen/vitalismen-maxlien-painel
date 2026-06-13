import { getOwnPhoneDigits, getSock, waitForWhatsAppReady } from './connection.js';
import { canSendOutbound } from './outboundGuard.js';
import { recordOutboundSend, resolveOutboundSessionForJid } from './sessionRouter.js';
import fs from 'fs';
import { applyAfterSendPacing, applyHumanPacing, withHumanizedOutboundQueue } from './humanPacing.js';
import { checkDropiOrderBeforeOutbound } from '../services/dropiOutboundOrderGuardService.js';
import { sendZapiVideo } from '../services/zapiClient.js';
import { shouldUseZapiForOutbound, zapiPhoneForOutbound } from './zapiOutboundRouting.js';

export const sendVideo = async (jid, videoPath, caption = '', options = {}) => {
    const route = await resolveOutboundSessionForJid({ requestedSessionId: options.sessionId || null, jid, country: options.country || '' });
    const sessionId = route.sessionId;
    const ownDigits = getOwnPhoneDigits(sessionId);
    const sendMode = options.sendMode || '';
    const guard = canSendOutbound({ jid, text: caption || videoPath, sessionId, ownDigits, kind: 'video', recipientDigits: options.recipientDigits || '' });
    if (!guard.allowed) {
        console.log(`[LOG_SEND_BLOCKED] video bloqueado -> ${jid} | reason=${guard.reason}`);
        return false;
    }
    const dropiGuard = await checkDropiOrderBeforeOutbound({
        jid,
        recipientDigits: options.recipientDigits || '',
        text: options.guardText || caption || videoPath,
        allowExistingDropiOrder: options.allowExistingDropiOrder === true,
        outboundContext: options.outboundContext || ''
    });
    if (!dropiGuard.allowed) {
        console.log(`[LOG_SEND_BLOCKED] video bloqueado por pedido Dropi existente -> ${jid} | reason=${dropiGuard.reason} | order=${dropiGuard.orderId || ''} | tracking=${dropiGuard.trackingNumber || ''}`);
        return false;
    }

    if (!fs.existsSync(videoPath)) {
        console.error(`[OUTBOUND-VIDEO-ERROR] Arquivo de video nao encontrado: ${videoPath}`);
        return false;
    }

    if (shouldUseZapiForOutbound({ targetJid: jid, recipientDigits: options.recipientDigits || '', options })) {
        try {
            const phone = zapiPhoneForOutbound({ targetJid: jid, recipientDigits: options.recipientDigits || '' });
            const publicMediaUrl = String(options.publicMediaUrl || '').trim();
            const response = await sendZapiVideo({
                phone,
                media: publicMediaUrl,
                filePath: videoPath,
                caption,
                viewOnce: Boolean(options.viewOnce),
                async: true,
                delayMessage: sendMode === 'manual_panel' ? process.env.ZAPI_MANUAL_DELAY_MESSAGE_SECONDS || 1 : null
            });
            console.log(`[LOG_SEND_USING_ZAPI] Video enfileirado na Z-API -> ${phone} | Arquivo: ${publicMediaUrl || videoPath} | messageId=${response?.messageId || response?.id || ''}`);
            recordOutboundSend({ sessionId: 'zapi', jid });
            const details = {
                ok: true,
                provider: 'zapi',
                providerMessageId: response?.messageId || response?.id || '',
                providerZaapId: response?.zaapId || '',
                providerStatus: 'queued',
                providerPayload: response
            };
            return options.returnDetails === true ? details : true;
        } catch (error) {
            const detail = error?.response?.data || error.message || 'zapi_video_send_failed';
            console.error(`[OUTBOUND-ZAPI-ERROR] Falha ao enviar video pela Z-API para ${jid}:`, detail);
            return options.returnDetails === true
                ? {
                    ok: false,
                    provider: 'zapi',
                    providerStatus: 'failed',
                    error: typeof detail === 'string' ? detail : JSON.stringify(detail),
                    providerPayload: detail
                }
                : false;
        }
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
                const pacing = await applyHumanPacing({ sock, jid, kind: 'video', text: caption || videoPath, sendMode });
                const result = await sock.sendMessage(jid, payload);
                const afterSendMs = result ? await applyAfterSendPacing({ kind: 'video', sendMode }) : 0;
                return { pacing, afterSendMs, result };
            }, { sendMode });

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
