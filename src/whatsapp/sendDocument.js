import fs from 'fs';
import path from 'path';
import { getOwnPhoneDigits, getSock, waitForWhatsAppReady } from './connection.js';
import { canSendOutbound } from './outboundGuard.js';
import { recordOutboundSend, resolveOutboundSessionForJid } from './sessionRouter.js';
import { applyHumanPacing } from './humanPacing.js';
import { sendDocumentViaZapi, shouldUseZapiForMedia } from './zapiOutbound.js';

const isRemoteUrl = (value) => /^https?:\/\//i.test(String(value || '').trim());

const resolveMimeType = (filePath) => {
    const ext = path.extname(filePath || '').toLowerCase();
    if (ext === '.pdf') return 'application/pdf';
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    if (ext === '.png') return 'image/png';
    return 'application/octet-stream';
};

export const sendDocument = async (jid, filePath, fileName = '', caption = '', options = {}) => {
    const zapiRoute = await shouldUseZapiForMedia({ jid, sessionId: options.sessionId || null });
    if (zapiRoute.use) {
        const guard = canSendOutbound({
            jid: zapiRoute.phone,
            text: caption || fileName || filePath,
            sessionId: zapiRoute.sessionId,
            ownDigits: zapiRoute.sessionId,
            kind: 'document'
        });
        if (!guard.allowed) {
            console.log(`[ZAPI_SEND_BLOCKED] documento bloqueado -> ${zapiRoute.phone} | reason=${guard.reason}`);
            return false;
        }

        if (!filePath || (!isRemoteUrl(filePath) && !fs.existsSync(filePath))) {
            console.error(`[ZAPI_DOC_ERROR] Arquivo de documento nao encontrado: ${filePath}`);
            return false;
        }

        try {
            const extension = path.extname(String(fileName || filePath).split('?')[0]).replace(/^\./, '') || 'pdf';
            const sent = await sendDocumentViaZapi({ jid, document: filePath, extension });
            if (sent.ok) {
                console.log(`[ZAPI_SEND_OK] Documento disparado -> ${sent.phone} | Arquivo: ${filePath} | reason=${zapiRoute.reason}`);
                recordOutboundSend({ sessionId: zapiRoute.sessionId, jid: zapiRoute.phone });
                return true;
            }
            console.warn(`[ZAPI_DOC_SKIPPED] ${sent.reason || 'unknown'} -> ${jid}`);
        } catch (error) {
            console.error(`[ZAPI_DOC_ERROR] Falha ao enviar documento para ${jid}:`, error?.response?.data || error);
        }

        return false;
    }

    const route = await resolveOutboundSessionForJid({ requestedSessionId: options.sessionId || null, jid });
    const sessionId = route.sessionId;
    const ownDigits = getOwnPhoneDigits(sessionId);
    const guard = canSendOutbound({ jid, text: caption || fileName || filePath, sessionId, ownDigits, kind: 'document' });
    if (!guard.allowed) {
        console.log(`[LOG_SEND_BLOCKED] documento bloqueado -> ${jid} | reason=${guard.reason}`);
        return false;
    }

    if (!filePath || (!isRemoteUrl(filePath) && !fs.existsSync(filePath))) {
        console.error(`[OUTBOUND-DOC-ERROR] ❌ Arquivo de documento não encontrado: ${filePath}`);
        return false;
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
            const pacing = await applyHumanPacing({ sock, jid, kind: 'document', text: caption || fileName || filePath });
            const result = await sock.sendMessage(jid, payload);
            console.log(`[OUTBOUND] 📎 Documento enviado -> ${jid} | Arquivo: ${filePath} | pacing=${pacing.waitedMs}ms/${pacing.presence} | tentativa=${attempt} | session=${sessionId || 'auto'}`);
            if (result) recordOutboundSend({ sessionId, jid });
            return !!result;
        } catch (error) {
            console.error(`[OUTBOUND-DOC-ERROR] ❌ Falha ao enviar documento para ${jid} | tentativa=${attempt}:`, error);
            if (attempt === 2) return false;
            await waitForWhatsAppReady(15000, sessionId).catch(() => null);
        }
    }

    return false;
};
