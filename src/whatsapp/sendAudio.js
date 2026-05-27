import { getOwnPhoneDigits, getSock, waitForWhatsAppReady } from './connection.js';
import { canSendOutbound } from './outboundGuard.js';
import { recordOutboundSend, resolveOutboundSessionForJid } from './sessionRouter.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { applyAfterSendPacing, applyHumanPacing, withHumanizedOutboundQueue } from './humanPacing.js';
import { sendAudioViaZapi, shouldUseZapiForMedia } from './zapiOutbound.js';

ffmpeg.setFfmpegPath(ffmpegStatic);

const VOICE_NOTE_DIR = path.join(process.cwd(), 'public', 'media', 'generated', 'voice-notes');

const ensureDir = (dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const isNewer = (target, source) => {
    try {
        return fs.statSync(target).mtimeMs >= fs.statSync(source).mtimeMs;
    } catch {
        return false;
    }
};

const resolveVoiceNotePath = async (audioPath) => {
    if (path.extname(audioPath).toLowerCase() === '.ogg') return audioPath;

    ensureDir(VOICE_NOTE_DIR);
    const stat = fs.statSync(audioPath);
    const sourceKey = `${audioPath}:${stat.size}:${stat.mtimeMs}`;
    const hash = crypto.createHash('sha1').update(sourceKey).digest('hex').slice(0, 16);
    const base = path.basename(audioPath, path.extname(audioPath)).replace(/[^a-z0-9_-]+/gi, '_').slice(0, 80) || 'audio';
    const oggPath = path.join(VOICE_NOTE_DIR, `${base}_${hash}.ogg`);

    if (fs.existsSync(oggPath) && isNewer(oggPath, audioPath)) return oggPath;

    await new Promise((resolve, reject) => {
        ffmpeg(audioPath)
            .audioCodec('libopus')
            .audioFrequency(48000)
            .audioChannels(1)
            .format('ogg')
            .on('end', resolve)
            .on('error', reject)
            .save(oggPath);
    });

    return oggPath;
};

/**
 * Enterprise Audio Sender 
 * Transmits local Voice Notes (.ogg typically) as native Push-to-Talk (PTT)
 */
export const sendAudio = async (jid, audioPath, isPtt = true, options = {}) => {
    if (!fs.existsSync(audioPath)) {
        console.error(`[OUTBOUND-AUDIO-ERROR] ❌ Arquivo de áudio não encontrado fisicamente: ${audioPath}`);
        return false;
    }

    const zapiRoute = await shouldUseZapiForMedia({ jid, sessionId: options.sessionId || null });
    if (zapiRoute.reason === 'zapi_recipient_not_allowed') {
        console.log(`[ZAPI_SEND_BLOCKED] audio fora do piloto -> ${zapiRoute.phone || jid} | reason=${zapiRoute.reason}`);
        return false;
    }

    if (zapiRoute.use) {
        const zapiGuard = canSendOutbound({
            jid: zapiRoute.phone,
            text: audioPath,
            sessionId: zapiRoute.sessionId,
            ownDigits: zapiRoute.sessionId,
            kind: 'audio'
        });
        if (!zapiGuard.allowed) {
            console.log(`[ZAPI_SEND_BLOCKED] audio bloqueado -> ${zapiRoute.phone} | reason=${zapiGuard.reason}`);
            return false;
        }

        try {
            const { pacing, afterSendMs, sent } = await withHumanizedOutboundQueue(zapiRoute.phone, async () => {
                const pacing = await applyHumanPacing({ sock: null, jid: zapiRoute.phone, kind: 'audio', text: audioPath });
                const sent = await sendAudioViaZapi({ jid, audio: audioPath });
                const afterSendMs = sent.ok ? await applyAfterSendPacing({ kind: 'audio', audioPath }) : 0;
                return { pacing, afterSendMs, sent };
            });
            if (sent.ok) {
                console.log(`[ZAPI_SEND_OK] Audio disparado -> ${sent.phone} | Arquivo: ${audioPath} | pacing=${pacing.waitedMs}ms/${pacing.presence} | after=${afterSendMs}ms | reason=${zapiRoute.reason}`);
                recordOutboundSend({ sessionId: zapiRoute.sessionId, jid: zapiRoute.phone });
                return true;
            }
            console.warn(`[ZAPI_SEND_SKIPPED] audio ${sent.reason || 'unknown'} -> ${jid}`);
        } catch (error) {
            console.error(`[ZAPI_SEND_ERROR] Falha ao enviar audio para ${jid}:`, error?.response?.data || error);
        }
        return false;
    }

    let voiceNotePath = audioPath;
    try {
        voiceNotePath = await resolveVoiceNotePath(audioPath);
    } catch (error) {
        console.error(`[OUTBOUND-AUDIO-ERROR] ❌ Falha ao converter áudio para OGG/Opus: ${audioPath}`, error);
        return false;
    }

    const route = await resolveOutboundSessionForJid({ requestedSessionId: options.sessionId || null, jid });
    const sessionId = route.sessionId;
    const ownDigits = getOwnPhoneDigits(sessionId);
    const guard = canSendOutbound({ jid, text: audioPath, sessionId, ownDigits, kind: 'audio' });
    if (!guard.allowed) {
        console.log(`[LOG_SEND_BLOCKED] audio bloqueado -> ${jid} | reason=${guard.reason}`);
        return false;
    }

    for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
            const sock = getSock(sessionId) || await waitForWhatsAppReady(12000, sessionId);
            const payload = {
                audio: { url: voiceNotePath },
                mimetype: 'audio/ogg; codecs=opus',
                ptt: isPtt
            };

            const { pacing, afterSendMs, result } = await withHumanizedOutboundQueue(jid, async () => {
                const pacing = await applyHumanPacing({ sock, jid, kind: 'audio', text: voiceNotePath });
                const result = await sock.sendMessage(jid, payload);
                const afterSendMs = result ? await applyAfterSendPacing({ kind: 'audio', audioPath: voiceNotePath }) : 0;
                return { pacing, afterSendMs, result };
            });
            console.log(`[OUTBOUND] 🔊 Áudio/PTT transmitido -> ${jid} | Arquivo: ${voiceNotePath} | origem=${audioPath} | pacing=${pacing.waitedMs}ms/${pacing.presence} | after=${afterSendMs}ms | tentativa=${attempt} | session=${sessionId || 'auto'}`);
            if (result) recordOutboundSend({ sessionId, jid });
            return !!result;
        } catch (error) {
            console.error(`[OUTBOUND-AUDIO-ERROR] ❌ Falha ao enviar áudio para ${jid} | tentativa=${attempt}:`, error);
            if (attempt === 2) return false;
            await waitForWhatsAppReady(15000, sessionId).catch(() => null);
        }
    }
    return false;
};
