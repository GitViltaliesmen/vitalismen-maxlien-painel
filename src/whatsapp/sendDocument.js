import fs from 'fs';
import path from 'path';
import { getOwnPhoneDigits, getSock, waitForWhatsAppReady } from './connection.js';
import { canSendOutbound } from './outboundGuard.js';
import { recordOutboundSend, resolveOutboundSessionForJid } from './sessionRouter.js';
import { applyHumanPacing } from './humanPacing.js';
import { checkDropiOrderBeforeOutbound } from '../services/dropiOutboundOrderGuardService.js';
import { sendZapiDocument } from '../services/zapiClient.js';
import { shouldUseZapiForOutbound, zapiPhoneForOutbound } from './zapiOutboundRouting.js';

const isRemoteUrl = (value) => /^https?:\/\//i.test(String(value || '').trim());

const resolveMimeType = (filePath) => {
    const ext = path.extname(filePath || '').toLowerCase();
    if (ext === '.pdf') return 'application/pdf';
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    if (ext === '.png') return 'image/png';
    return 'application/octet-stream';
};

const sendDocumentFailure = (options, payload = {}) => (
    options.returnDetails === true
        ? { ok: false, providerStatus: 'failed', ...payload }
        : false
);

export const sendDocument = async (jid, filePath, fileName = '', caption = '', options = {}) => {
    const route = await resolveOutboundSessionForJid({ requestedSessionId: options.sessionId || null, jid, country: options.country || '' });
    const sessionId = route.sessionId;
    const ownDigits = getOwnPhoneDigits(sessionId);
    const sendMode = options.sendMode || '';
    const guard = canSendOutbound({ jid, text: caption || fileName || filePath, sessionId, ownDigits, kind: 'document', recipientDigits: options.recipientDigits || '' });
    if (!guard.allowed) {
        console.log(`[LOG_SEND_BLOCKED] documento bloqueado -> ${jid} | reason=${guard.reason}`);
        return sendDocumentFailure(options, { reason: guard.reason });
    }
    const dropiGuard = await checkDropiOrderBeforeOutbound({
        jid,
        recipientDigits: options.recipientDigits || '',
        text: options.guardText || caption || fileName || filePath,
        allowExistingDropiOrder: options.allowExistingDropiOrder === true,
        outboundContext: options.outboundContext || ''
    });
    if (!dropiGuard.allowed) {
        console.log(`[LOG_SEND_BLOCKED] documento bloqueado por pedido Dropi existente -> ${jid} | reason=${dropiGuard.reason} | order=${dropiGuard.orderId || ''} | tracking=${dropiGuard.trackingNumber || ''}`);
        return sendDocumentFailure(options, { reason: dropiGuard.reason });
    }

    if (!filePath || (!isRemoteUrl(filePath) && !fs.existsSync(filePath))) {
        console.error(`[OUTBOUND-DOC-ERROR] ❌ Arquivo de documento não encontrado: ${filePath}`);
        return sendDocumentFailure(options, { reason: 'document_not_found' });
    }

    if (shouldUseZapiForOutbound({ targetJid: jid, recipientDigits: options.recipientDigits || '', options })) {
        try {
            const phone = zapiPhoneForOutbound({ targetJid: jid, recipientDigits: options.recipientDigits || '' });
            const response = await sendZapiDocument({
                phone,
                filePath,
                fileName: fileName || path.basename(filePath),
                caption,
                delayMessage: sendMode === 'manual_panel' ? process.env.ZAPI_MANUAL_DELAY_MESSAGE_SECONDS || 1 : null
            });
            console.log(`[LOG_SEND_USING_ZAPI] Documento enfileirado na Z-API -> ${phone} | Arquivo: ${filePath} | messageId=${response?.messageId || response?.id || ''}`);
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
            const detail = error?.response?.data || error.message || 'zapi_document_send_failed';
            console.error(`[OUTBOUND-ZAPI-ERROR] Falha ao enviar documento pela Z-API para ${jid}:`, detail);
            return sendDocumentFailure(options, {
                provider: 'zapi',
                error: typeof detail === 'string' ? detail : JSON.stringify(detail),
                providerPayload: detail
            });
        }
    }

    const payload = {
        document: { url: filePath },
        mimetype: resolveMimeType(filePath),
        fileName: fileName || path.basename(filePath)
    };

    if (caption) payload.caption = caption;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
            const sock = getSock(sessionId) || await waitForWhatsAppReady(12000, sessionId);
            const pacing = await applyHumanPacing({ sock, jid, kind: 'document', text: caption || fileName || filePath, sendMode });
            const result = await sock.sendMessage(jid, payload);
            console.log(`[OUTBOUND] 📎 Documento enviado -> ${jid} | Arquivo: ${filePath} | pacing=${pacing.waitedMs}ms/${pacing.presence} | tentativa=${attempt} | session=${sessionId || 'auto'}`);
            if (result) recordOutboundSend({ sessionId, jid });
            return options.returnDetails === true
                ? {
                    ok: Boolean(result),
                    provider: 'baileys',
                    providerMessageId: result?.key?.id || result?.message?.key?.id || '',
                    providerStatus: result ? 'sent' : 'failed',
                    providerPayload: result || {}
                }
                : !!result;
        } catch (error) {
            console.error(`[OUTBOUND-DOC-ERROR] ❌ Falha ao enviar documento para ${jid} | tentativa=${attempt}:`, error);
            if (attempt === 2) return sendDocumentFailure(options, {
                provider: 'baileys',
                error: error.message || 'send_document_failed'
            });
            await waitForWhatsAppReady(15000, sessionId).catch(() => null);
        }
    }

    return sendDocumentFailure(options, { reason: 'send_document_failed' });
};
