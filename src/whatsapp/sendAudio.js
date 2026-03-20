import { getOwnPhoneDigits, getSock, waitForWhatsAppReady } from './connection.js';
import fs from 'fs';

/**
 * Enterprise Audio Sender 
 * Transmits local Voice Notes (.ogg typically) as native Push-to-Talk (PTT)
 */
export const sendAudio = async (jid, audioPath, isPtt = true) => {
    const ownDigits = getOwnPhoneDigits();
    const targetDigits = String(jid || '').replace(/\D/g, '');
    if (ownDigits && targetDigits === ownDigits) {
        console.log(`[LOG_SEND_BLOCKED_SELF] bloqueado envio de audio para o proprio numero -> ${jid}`);
        return false;
    }

    if (!fs.existsSync(audioPath)) {
        console.error(`[OUTBOUND-AUDIO-ERROR] ❌ Arquivo de áudio não encontrado fisicamente: ${audioPath}`);
        return false;
    }

    for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
            const sock = getSock() || await waitForWhatsAppReady(12000);
            const payload = {
                audio: { url: audioPath },
                mimetype: 'audio/ogg; codecs=opus',
                ptt: isPtt
            };

            const result = await sock.sendMessage(jid, payload);
            console.log(`[OUTBOUND] 🔊 Áudio/PTT transmitido -> ${jid} | Arquivo: ${audioPath} | tentativa=${attempt}`);
            return !!result;
        } catch (error) {
            console.error(`[OUTBOUND-AUDIO-ERROR] ❌ Falha ao enviar áudio para ${jid} | tentativa=${attempt}:`, error);
            if (attempt === 2) return false;
            await waitForWhatsAppReady(15000).catch(() => null);
        }
    }
    return false;
};
