import fs from 'fs';
import path from 'path';
import { getOwnPhoneDigits, getSock, waitForWhatsAppReady } from './connection.js';
import { canSendOutbound } from './outboundGuard.js';
import { recordOutboundSend, resolveOutboundSessionForJid } from './sessionRouter.js';
import { applyHumanPacing } from './humanPacing.js';
import { checkDropiOrderBeforeOutbound } from '../services/dropiOutboundOrderGuardService.js';

const isRemoteUrl = (value) => /^https?:\/\//i.test(String(value || '').trim());

const resolveMimeType = (filePath) => {
    const ext = path.extname(filePath || '').toLowerCase();
    if (ext === '.pdf') return 'application/pdf';
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    if (ext === '.png') return 'image/png';
    return 'application/octet-stream';
};

export const sendDocument = async (jid, filePath, fileName = '', caption = '', options = {}) => {
    const route = await resolveOutboundSessionForJid({ requestedSessionId: options.sessionId || null, jid, country: options.country || '' });
    const sessionId = route.sessionId;
    const ownDigits = getOwnPhoneDigits(sessionId);
    const sendMode = options.sendMode || '';
    const guard = canSendOutbound({ jid, text: caption || fileName || filePath, sessionId, ownDigits, kind: 'document', recipientDigits: options.recipientDigits || '' });
    if (!guard.allowed) {
        console.log(`[LOG_SEND_BLOCKED] documento bloqueado -> ${jid} | reason=${guard.reason}`);
        return false;
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
            const pacing = await applyHumanPacing({ sock, jid, kind: 'document', text: caption || fileName || filePath, sendMode });
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
