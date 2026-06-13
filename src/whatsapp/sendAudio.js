import { getOwnPhoneDigits, getSock, waitForWhatsAppReady } from './connection.js';
import { canSendOutbound } from './outboundGuard.js';
import { recordOutboundSend, resolveOutboundSessionForJid } from './sessionRouter.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { applyAfterSendPacing, applyHumanPacing, withHumanizedOutboundQueue } from './humanPacing.js';
import {
    markOutboundDedupeFailed,
    markOutboundDedupeSent,
    reserveOutboundOnce
} from '../services/outboundDedupeService.js';
import { checkDropiOrderBeforeOutbound } from '../services/dropiOutboundOrderGuardService.js';

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

const getAudioMimetype = (audioPath, isPtt) => {
    if (isPtt) return 'audio/ogg; codecs=opus';

    const ext = path.extname(audioPath).toLowerCase();
    const map = {
        '.mp3': 'audio/mpeg',
        '.mpeg': 'audio/mpeg',
        '.ogg': 'audio/ogg; codecs=opus',
        '.opus': 'audio/ogg; codecs=opus',
        '.m4a': 'audio/mp4',
        '.mp4': 'audio/mp4',
        '.aac': 'audio/aac',
        '.wav': 'audio/wav',
        '.webm': 'audio/webm'
    };
    return map[ext] || 'audio/mpeg';
};

/**
 * Enterprise Audio Sender 
 * Transmits local Voice Notes (.ogg typically) as native Push-to-Talk (PTT)
 */
export const sendAudio = async (jid, audioPath, isPtt = true, options = {}) => {
    const route = await resolveOutboundSessionForJid({ requestedSessionId: options.sessionId || null, jid, country: options.country || '' });
    const sessionId = route.sessionId;
    const ownDigits = getOwnPhoneDigits(sessionId);
    const bypassDedupe = options.bypassDedupe === true || options.force === true;
    const bypassAudioDedupe = options.allowAudioDedupeBypass === true || bypassDedupe;
    const sendMode = options.sendMode || '';
    const guard = canSendOutbound({ jid, text: audioPath, sessionId, ownDigits, kind: 'audio', recipientDigits: options.recipientDigits || '', bypassDedupe: bypassAudioDedupe });
    if (!guard.allowed) {
        console.log(`[LOG_SEND_BLOCKED] audio bloqueado -> ${jid} | reason=${guard.reason}`);
        return false;
    }
    const dropiGuard = await checkDropiOrderBeforeOutbound({
        jid,
        recipientDigits: options.recipientDigits || '',
        text: options.guardText || options.outboundContext || audioPath,
        allowExistingDropiOrder: options.allowExistingDropiOrder === true,
        outboundContext: options.outboundContext || ''
    });
    if (!dropiGuard.allowed) {
        console.log(`[LOG_SEND_BLOCKED] audio bloqueado por pedido Dropi existente -> ${jid} | reason=${dropiGuard.reason} | order=${dropiGuard.orderId || ''} | tracking=${dropiGuard.trackingNumber || ''}`);
        return false;
    }

    if (!fs.existsSync(audioPath)) {
        console.error(`[OUTBOUND-AUDIO-ERROR] ❌ Arquivo de áudio não encontrado fisicamente: ${audioPath}`);
        return false;
    }

    let sendPath = audioPath;
    try {
        sendPath = isPtt ? await resolveVoiceNotePath(audioPath) : audioPath;
    } catch (error) {
        console.error(`[OUTBOUND-AUDIO-ERROR] ❌ Falha ao converter áudio para OGG/Opus: ${audioPath}`, error);
        return false;
    }

    const duplicateGuard = await reserveOutboundOnce({
        jid,
        recipientDigits: options.recipientDigits || '',
        sessionId,
        kind: 'audio',
        value: options.dedupeValue || sendPath,
        label: path.basename(sendPath),
        bypass: bypassAudioDedupe
    });
    if (!duplicateGuard.allowed) {
        console.log(`[LOG_SEND_BLOCKED] audio repetido bloqueado rigidamente -> ${jid} | reason=${duplicateGuard.reason} | phone=${duplicateGuard.phoneDigits || ''} | audio=${path.basename(sendPath)}`);
        return false;
    }

    for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
            console.log(`[OUTBOUND-AUDIO] start -> jid=${jid} | session=${sessionId || 'auto'} | attempt=${attempt} | path=${sendPath}`);
            const sock = getSock(sessionId) || await waitForWhatsAppReady(12000, sessionId);
            const payload = {
                audio: { url: sendPath },
                mimetype: getAudioMimetype(sendPath, isPtt),
                ptt: isPtt
            };

            const { pacing, afterSendMs, result } = await withHumanizedOutboundQueue(jid, async () => {
                const pacing = await applyHumanPacing({ sock, jid, kind: 'audio', text: sendPath, sendMode });
                console.log(`[OUTBOUND-AUDIO] sendMessage -> jid=${jid} | session=${sessionId || 'auto'} | attempt=${attempt} | pacing=${pacing.waitedMs}`);
                const result = await sock.sendMessage(jid, payload);
                let afterSendMs = 0;
                try {
                    afterSendMs = result ? await applyAfterSendPacing({ kind: 'audio', audioPath: sendPath, sendMode }) : 0;
                } catch (pacingError) {
                    console.warn(`[OUTBOUND-AUDIO] afterSend pacing ignored -> jid=${jid} | session=${sessionId || 'auto'} | attempt=${attempt} | error=${pacingError.message}`);
                }
                return { pacing, afterSendMs, result };
            }, { sendMode });
            console.log(`[OUTBOUND] 🔊 Áudio transmitido -> ${jid} | Arquivo: ${sendPath} | origem=${audioPath} | ptt=${isPtt ? 'sim' : 'nao'} | mimetype=${payload.mimetype} | pacing=${pacing.waitedMs}ms/${pacing.presence} | after=${afterSendMs}ms | tentativa=${attempt} | session=${sessionId || 'auto'}`);
            const confirmed = result !== false && result !== null && result !== undefined;
            if (confirmed) recordOutboundSend({ sessionId, jid });
            if (confirmed) await markOutboundDedupeSent({ key: duplicateGuard.key, semanticKey: duplicateGuard.semanticKey });
            return true;
        } catch (error) {
            console.error(`[OUTBOUND-AUDIO-ERROR] ❌ Falha ao enviar áudio para ${jid} | tentativa=${attempt}:`, error);
            if (attempt === 2) {
                await markOutboundDedupeFailed({ key: duplicateGuard.key, semanticKey: duplicateGuard.semanticKey, error: error.message });
                return false;
            }
            await waitForWhatsAppReady(15000, sessionId).catch(() => null);
        }
    }
    return false;
};
