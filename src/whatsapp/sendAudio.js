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
import { sendZapiAudio } from '../services/zapiClient.js';
import { shouldUseZapiForOutbound, zapiPhoneForOutbound } from './zapiOutboundRouting.js';
import ContactState from '../models/ContactState.js';
import { recordZapiOutboundMirror } from '../services/zapiOutboundMirrorService.js';
import { operatorNoAutoResendForTarget } from '../services/operatorNoAutoResendService.js';
import { assertTransportPersistenceAllowed } from '../services/strictReadOnlyObservationService.js';

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

const digitsOnly = (value) => String(value || '').replace(/\D/g, '');
const zapiFailoverEnabled = () => String(process.env.OUTBOUND_ZAPI_FAILOVER_ENABLED || 'true').toLowerCase() !== 'false';
const shouldTryZapiAudioFailover = ({ jid = '', options = {}, reason = '' } = {}) => {
    if (!zapiFailoverEnabled() || options.zapiFailoverAttempt === true) return false;
    if (options.provider === 'zapi' || options.sessionId === 'zapi') return false;
    if (!shouldUseZapiForOutbound({
        targetJid: jid,
        recipientDigits: options.recipientDigits || '',
        options: { ...options, provider: 'zapi' }
    })) return false;
    const value = String(reason || '').toLowerCase();
    return !value || /timeout|not.*ready|ready|closed|unauthorized_session|blocked_session|session|socket|connection|baileys/.test(value);
};
const recordZapiAudioFailover = async ({ jid = '', recipientDigits = '', reason = '', status = '', providerMessageId = '' } = {}) => {
    const phone = digitsOnly(recipientDigits) || digitsOnly(jid);
    if (!phone) return;
    const tails = [phone, phone.length >= 9 ? phone.slice(-9) : '', phone.length >= 10 ? phone.slice(-10) : ''].filter(Boolean);
    const or = [
        { chatId: jid },
        { phoneDigits: phone },
        ...tails.map((tail) => ({ phoneDigits: { $regex: `${tail}$` } }))
    ];
    await ContactState.updateOne(
        { $or: or },
        {
            $set: {
                'metadata.senderWallet.fallbackToZapiAt': new Date(),
                'metadata.senderWallet.fallbackToZapiKind': 'audio',
                'metadata.senderWallet.fallbackToZapiReason': String(reason || '').slice(0, 500),
                'metadata.senderWallet.fallbackToZapiStatus': status,
                ...(providerMessageId ? { 'metadata.senderWallet.fallbackToZapiProviderMessageId': providerMessageId } : {})
            },
            $inc: {
                'metadata.senderWallet.fallbackToZapiCount': 1
            }
        }
    ).catch((error) => console.warn(`[OUTBOUND-ZAPI-FAILOVER] falha ao registrar failover audio ${jid}: ${error.message}`));
};
const failoverWasSent = (result) => (result === true || result?.ok === true);

/**
 * Enterprise Audio Sender 
 * Transmits local Voice Notes (.ogg typically) as native Push-to-Talk (PTT)
 */
export const sendAudio = async (jid, audioPath, isPtt = true, options = {}) => {
    assertTransportPersistenceAllowed({ transport: 'whatsapp', operation: 'send_audio' });
    if (await operatorNoAutoResendForTarget({ jid, recipientDigits: options.recipientDigits || '', sendMode: options.sendMode || '' })) {
        console.log(`[LOG_SEND_BLOCKED] audio bloqueado por protecao manual anti-reenvio -> ${jid}`);
        return false;
    }
    const route = await resolveOutboundSessionForJid({ requestedSessionId: options.sessionId || null, jid, country: options.country || '' });
    const sessionId = route.sessionId;
    const ownDigits = getOwnPhoneDigits(sessionId);
    const bypassDedupe = options.bypassDedupe === true || options.force === true;
    const bypassAudioDedupe = options.allowAudioDedupeBypass === true || bypassDedupe;
    const sendMode = options.sendMode || '';
    const guard = canSendOutbound({ jid, text: audioPath, sessionId, ownDigits, kind: 'audio', recipientDigits: options.recipientDigits || '', bypassDedupe: bypassAudioDedupe });
    if (!guard.allowed) {
        console.log(`[LOG_SEND_BLOCKED] audio bloqueado -> ${jid} | reason=${guard.reason}`);
        if (shouldTryZapiAudioFailover({ jid, options, reason: guard.reason })) {
            console.warn(`[OUTBOUND-ZAPI-FAILOVER] audio bloqueado por sessao; tentando Z-API -> ${jid} | reason=${guard.reason}`);
            await recordZapiAudioFailover({ jid, recipientDigits: options.recipientDigits || '', reason: guard.reason, status: 'retrying' });
            const failover = await sendAudio(jid, audioPath, isPtt, {
                ...options,
                sessionId: 'zapi',
                provider: 'zapi',
                zapiFailoverAttempt: true,
                outboundContext: `${options.outboundContext || 'auto_audio'}_zapi_failover`
            });
            await recordZapiAudioFailover({
                jid,
                recipientDigits: options.recipientDigits || '',
                reason: guard.reason,
                status: failoverWasSent(failover) ? 'sent' : 'failed',
                providerMessageId: failover?.providerMessageId || ''
            });
            return failover;
        }
        return false;
    }
    const dropiGuard = await checkDropiOrderBeforeOutbound({
        jid,
        recipientDigits: options.recipientDigits || '',
        text: options.guardText || options.outboundContext || audioPath,
        allowExistingDropiOrder: options.allowExistingDropiOrder === true || sendMode === 'manual_panel',
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

    if (shouldUseZapiForOutbound({ targetJid: jid, recipientDigits: options.recipientDigits || '', options })) {
        try {
            const phone = zapiPhoneForOutbound({ targetJid: jid, recipientDigits: options.recipientDigits || '' });
            const response = await sendZapiAudio({
                phone,
                filePath: sendPath,
                delayMessage: null,
                delayTyping: null,
                waveform: true
            });
            console.log(`[LOG_SEND_USING_ZAPI] Audio enfileirado na Z-API -> ${phone} | Arquivo: ${sendPath} | messageId=${response?.messageId || response?.id || ''}`);
            recordOutboundSend({ sessionId: 'zapi', jid });
            await recordZapiOutboundMirror({
                phone,
                jid,
                type: 'audio',
                body: '[audio]',
                mediaUrl: sendPath,
                response,
                isBot: options.sendMode !== 'manual_panel'
            });
            await markOutboundDedupeSent({ key: duplicateGuard.key, semanticKey: duplicateGuard.semanticKey });
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
            const detail = error?.response?.data || error.message || 'zapi_audio_send_failed';
            console.error(`[OUTBOUND-ZAPI-ERROR] Falha ao enviar audio pela Z-API para ${jid}:`, detail);
            await markOutboundDedupeFailed({
                key: duplicateGuard.key,
                semanticKey: duplicateGuard.semanticKey,
                error: typeof detail === 'string' ? detail : JSON.stringify(detail)
            });
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
                if (shouldTryZapiAudioFailover({ jid, options, reason: error.message })) {
                    console.warn(`[OUTBOUND-ZAPI-FAILOVER] audio falhou por Baileys; tentando Z-API -> ${jid} | reason=${error.message}`);
                    await recordZapiAudioFailover({ jid, recipientDigits: options.recipientDigits || '', reason: error.message, status: 'retrying' });
                    const failover = await sendAudio(jid, audioPath, isPtt, {
                        ...options,
                        sessionId: 'zapi',
                        provider: 'zapi',
                        zapiFailoverAttempt: true,
                        outboundContext: `${options.outboundContext || 'auto_audio'}_zapi_failover`
                    });
                    await recordZapiAudioFailover({
                        jid,
                        recipientDigits: options.recipientDigits || '',
                        reason: error.message,
                        status: failoverWasSent(failover) ? 'sent' : 'failed',
                        providerMessageId: failover?.providerMessageId || ''
                    });
                    return failover;
                }
                return false;
            }
            await waitForWhatsAppReady(15000, sessionId).catch(() => null);
        }
    }
    return false;
};
