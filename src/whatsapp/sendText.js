import { getSock, getSocketId, getOwnPhoneDigits, waitForWhatsAppReady } from './connection.js';

/**
 * Enterprise Text Wrapper for Baileys
 * Provides standardized error handling and formatting for plain text responses
 */
export const sendText = async (jid, text, quotedMsg = null) => {
    const ownDigits = getOwnPhoneDigits();
    const targetDigits = String(jid || '').replace(/\D/g, '');
    if (ownDigits && targetDigits === ownDigits) {
        console.log(`[LOG_SEND_BLOCKED_SELF] bloqueado envio de texto para o proprio numero -> ${jid}`);
        return false;
    }

    for (let attempt = 1; attempt <= 2; attempt += 1) {
        const sock = getSock();
        const sId = getSocketId();

        try {
            const readySock = sock || await waitForWhatsAppReady(12000);
            const payload = { text };
            const options = quotedMsg ? { quoted: quotedMsg } : undefined;

            await readySock.sendMessage(jid, payload, options);
            console.log(`[LOG_SEND_USING_SOCKET] [socketId=${sId}] 📤 Texto disparado -> ${jid} | Tamanho: ${text.length} chars | tentativa=${attempt}`);
            return true;
        } catch (error) {
            console.error(`[OUTBOUND-ERROR] ❌ Falha ao enviar texto para ${jid} | tentativa=${attempt}:`, error);
            if (attempt === 2) return false;
            await waitForWhatsAppReady(15000).catch(() => null);
        }
    }
    return false;
};
