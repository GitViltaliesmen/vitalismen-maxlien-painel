import { getSock, getSocketId, getOwnPhoneDigits, waitForWhatsAppReady } from './connection.js';
import { canSendOutbound } from './outboundGuard.js';
import { recordOutboundSend, resolveOutboundSessionForJid } from './sessionRouter.js';
import { applyAfterSendPacing, applyHumanPacing, withHumanizedOutboundQueue } from './humanPacing.js';
import { checkDropiOrderBeforeOutbound } from '../services/dropiOutboundOrderGuardService.js';
import { sendZapiImage } from '../services/zapiClient.js';
import { shouldUseZapiForOutbound, zapiPhoneForOutbound } from './zapiOutboundRouting.js';
import { recordZapiOutboundMirror } from '../services/zapiOutboundMirrorService.js';
import { operatorNoAutoResendForTarget } from '../services/operatorNoAutoResendService.js';
import { assertTransportPersistenceAllowed } from '../services/strictReadOnlyObservationService.js';
import {
    classifyPostSaleProviderFailureV116,
    postSaleTransactionalOutbound
} from '../services/postSaleTransactionalSafetyV116Service.js';

export const sendImage = async (jid, imagePath, caption = '', options = {}) => {
    assertTransportPersistenceAllowed({ transport: 'whatsapp', operation: 'send_image' });
    if (await operatorNoAutoResendForTarget({ jid, recipientDigits: options.recipientDigits || '', sendMode: options.sendMode || '' })) {
        console.log(`[LOG_SEND_BLOCKED] imagem bloqueada por protecao manual anti-reenvio -> ${jid}`);
        return false;
    }
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
        allowExistingDropiOrder: options.allowExistingDropiOrder === true || sendMode === 'manual_panel',
        outboundContext: options.outboundContext || ''
    });
    if (!dropiGuard.allowed) {
        console.log(`[LOG_SEND_BLOCKED] imagem bloqueada por pedido Dropi existente -> ${jid} | reason=${dropiGuard.reason} | order=${dropiGuard.orderId || ''} | tracking=${dropiGuard.trackingNumber || ''}`);
        return false;
    }

    if (shouldUseZapiForOutbound({ targetJid: jid, recipientDigits: options.recipientDigits || '', options })) {
        try {
            const phone = zapiPhoneForOutbound({ targetJid: jid, recipientDigits: options.recipientDigits || '' });
            const response = await sendZapiImage({
                phone,
                filePath: imagePath,
                caption,
                delayMessage: null
            });
            console.log(`[LOG_SEND_USING_ZAPI] Imagem enfileirada na Z-API -> ${phone} | Arquivo: ${imagePath} | messageId=${response?.messageId || response?.id || ''}`);
            recordOutboundSend({ sessionId: 'zapi', jid });
            await recordZapiOutboundMirror({
                phone,
                jid,
                type: 'image',
                body: caption || '[image]',
                mediaUrl: imagePath,
                response,
                isBot: options.sendMode !== 'manual_panel'
            });
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
            const detail = error?.response?.data || error.message || 'zapi_image_send_failed';
            console.error(`[OUTBOUND-ZAPI-ERROR] Falha ao enviar imagem pela Z-API para ${jid}:`, detail);
            const disposition = postSaleTransactionalOutbound(options)
                ? classifyPostSaleProviderFailureV116(error)
                : null;
            return options.returnDetails === true
                ? {
                    ok: false,
                    provider: 'zapi',
                    providerAttempted: true,
                    ambiguous: disposition?.ambiguous ?? false,
                    terminalState: disposition?.terminalState || '',
                    providerStatus: disposition?.providerStatus || 'failed',
                    error: typeof detail === 'string' ? detail : JSON.stringify(detail),
                    providerPayload: detail
                }
                : false;
        }
    }

    const maxAttempts = postSaleTransactionalOutbound(options) ? 1 : 2;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
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
            if (attempt === maxAttempts) {
                if (options.returnDetails === true) {
                    const disposition = postSaleTransactionalOutbound(options)
                        ? classifyPostSaleProviderFailureV116(error)
                        : null;
                    return {
                        ok: false,
                        provider: 'baileys',
                        providerAttempted: true,
                        ambiguous: disposition?.ambiguous ?? false,
                        terminalState: disposition?.terminalState || '',
                        providerStatus: disposition?.providerStatus || 'failed',
                        error: error.message || 'send_image_failed'
                    };
                }
                return false;
            }
            await waitForWhatsAppReady(15000, sessionId).catch(() => null);
        }
    }

    return false;
};
