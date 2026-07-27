import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { enqueueMessage } from './queue.js';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { routeIncomingMessage } from '../services/agentRouter.js';
import { getOwnPhoneDigits } from './connection.js';
import { handlePickupProofInbound, isPickupProofText } from '../services/shipmentMessageService.js';
import { transcribeInboundAudioBuffer } from '../services/inboundAudioTranscriptionService.js';
import Message from '../models/Message.js';
import ContactState from '../models/ContactState.js';

const debugUpsert = String(process.env.WHATSAPP_DEBUG_UPSERT || '') === 'true';
const digitsOnly = (value) => String(value || '').replace(/\D/g, '');
const cleanSenderName = (value) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, 120);

const ecOnlyInboundEnabled = () => String(process.env.WHATSAPP_EC_ONLY_INBOUND || 'true').toLowerCase() !== 'false';

const parseDigitsList = (value) => String(value || '')
    .split(',')
    .map((item) => digitsOnly(item))
    .filter(Boolean);

const isSamePhone = (left, right) => {
    const a = digitsOnly(left);
    const b = digitsOnly(right);
    if (!a || !b) return false;
    return a === b || a.endsWith(b) || b.endsWith(a);
};

const operationalPanelPhones = () => [
    process.env.WHATSAPP_DEFAULT_SESSION_ID,
    process.env.WHATSAPP_SESSION_IDS,
    process.env.WHATSAPP_INBOUND_TEST_ONLY_RECIPIENTS,
    process.env.WHATSAPP_PANEL_OPERATIONAL_NUMBERS,
    process.env.WHATSAPP_AUTOMATION_ALLOWED_RECIPIENTS,
    process.env.WHATSAPP_TEST_ALLOWED_RECIPIENTS,
    process.env.WHATSAPP_AUTO_REPLY_ALLOWED_RECIPIENTS
].flatMap(parseDigitsList);

const isOperationalPanelPhone = (...identifiers) => {
    const allowed = operationalPanelPhones();
    if (!allowed.length) return false;
    return identifiers
        .map((item) => digitsOnly(item))
        .filter(Boolean)
        .some((candidate) => allowed.some((item) => isSamePhone(candidate, item)));
};

const isAllowedEcuadorCustomerJid = (remoteJid = '', senderPn = '') => {
    const jid = String(remoteJid || '');
    if (!jid || jid === 'status@broadcast' || jid.includes('@g.us') || jid.includes('@newsletter') || jid.includes('@broadcast')) {
        return false;
    }

    const senderDigits = digitsOnly(senderPn);
    if (senderDigits) return senderDigits.startsWith('593');

    const remoteDigits = digitsOnly(jid);
    if (jid.endsWith('@s.whatsapp.net') || jid.endsWith('@c.us')) return remoteDigits.startsWith('593');
    if (jid.endsWith('@lid')) return false;
    return false;
};

const knownEcuadorPhoneForLid = async (remoteJid = '') => {
    const jid = String(remoteJid || '');
    if (!jid.endsWith('@lid')) return '';
    try {
        const state = await ContactState.findOne({ chatId: jid })
            .select('phoneDigits metadata.lastSenderPn')
            .lean();
        const knownDigits = digitsOnly(state?.phoneDigits) || digitsOnly(state?.metadata?.lastSenderPn);
        return knownDigits.startsWith('593') ? knownDigits : '';
    } catch (error) {
        console.warn(`[DISPATCHER] falha ao consultar contato conhecido para ${jid}: ${error.message}`);
        return '';
    }
};

const hasInboundProofMedia = (message = {}) => Boolean(
    message.imageMessage
    || message.documentMessage
    || message.videoMessage
    || message.documentWithCaptionMessage
);

const getInboundAudioMessage = (message = {}) => message.audioMessage || null;

const hasInboundAudio = (message = {}) => Boolean(getInboundAudioMessage(message));

const hasInboundMedia = (message = {}) => hasInboundProofMedia(message) || hasInboundAudio(message);

const unwrapMessage = (message = {}) => {
    let current = message;
    for (let i = 0; i < 4; i += 1) {
        if (current.ephemeralMessage?.message) current = current.ephemeralMessage.message;
        else if (current.viewOnceMessage?.message) current = current.viewOnceMessage.message;
        else if (current.viewOnceMessageV2?.message) current = current.viewOnceMessageV2.message;
        else break;
    }
    return current || {};
};

const getMessageText = (message = {}) => (
    message.conversation
    || message.extendedTextMessage?.text
    || message.imageMessage?.caption
    || message.videoMessage?.caption
    || message.documentMessage?.caption
    || message.documentWithCaptionMessage?.message?.documentMessage?.caption
    || message.buttonsResponseMessage?.selectedDisplayText
    || message.buttonsResponseMessage?.selectedButtonId
    || message.listResponseMessage?.title
    || message.listResponseMessage?.singleSelectReply?.selectedRowId
    || ''
);

const getInboundProofMediaType = (message = {}) => {
    if (message.imageMessage) return 'image';
    if (message.videoMessage) return 'video';
    if (message.documentMessage || message.documentWithCaptionMessage) return 'document';
    return '';
};

const getInboundMediaType = (message = {}) => {
    if (message.audioMessage) return 'audio';
    return getInboundProofMediaType(message);
};

const getInboundMediaPayload = (message = {}) => (
    message.imageMessage
    || message.videoMessage
    || message.audioMessage
    || message.documentMessage
    || message.documentWithCaptionMessage?.message?.documentMessage
    || {}
);

const mediaExtensionFromMime = (mime = '', fallback = 'bin') => {
    const clean = String(mime || '').split(';')[0].toLowerCase();
    const map = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/gif': 'gif',
        'audio/mpeg': 'mp3',
        'audio/mp3': 'mp3',
        'audio/ogg': 'ogg',
        'audio/opus': 'ogg',
        'audio/webm': 'webm',
        'audio/mp4': 'm4a',
        'audio/aac': 'aac',
        'video/mp4': 'mp4',
        'video/quicktime': 'mov',
        'video/webm': 'webm',
        'application/pdf': 'pdf'
    };
    return map[clean] || clean.split('/')[1] || fallback;
};

const saveInboundMediaFile = async ({ msg, message = {}, mediaType = '', sock, existingBuffer = null }) => {
    const payload = getInboundMediaPayload(message);
    const buffer = existingBuffer || await downloadMediaMessage(
        msg,
        'buffer',
        {},
        {
            logger: sock.logger,
            reuploadRequest: sock.updateMediaMessage
        }
    );
    if (!buffer?.length) return '';

    const uploadsDir = path.join(process.cwd(), 'public', 'media', 'inbound');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    const ext = mediaExtensionFromMime(payload.mimetype, mediaType === 'audio' ? 'ogg' : 'bin');
    const filename = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}.${ext}`;
    fs.writeFileSync(path.join(uploadsDir, filename), buffer);
    return `/media/inbound/${filename}`;
};

const recordInboundMediaMessage = async ({ remoteJid, senderPn = '', messageId = '', body = '', message = {}, mediaUrl = '', sessionId = '' }) => {
    const mediaType = getInboundMediaType(message);
    if (!mediaType || !remoteJid || !messageId) return;
    try {
        const ownerSet = sessionId
            ? {
                sessionId,
                ownerPhoneDigits: digitsOnly(sessionId)
            }
            : {};
        await Message.updateOne(
            { _id: messageId },
            {
                ...(Object.keys(ownerSet).length ? { $set: ownerSet } : {}),
                $setOnInsert: {
                    chatId: remoteJid,
                    peerPhone: String(senderPn || remoteJid || '').replace(/\D/g, ''),
                    from: remoteJid,
                    to: 'bot',
                    body: body || `[${mediaType.toUpperCase()}] recebido`,
                    type: mediaType,
                    hasMedia: true,
                    mediaUrl,
                    isFromMe: false,
                    isBot: false,
                    timestamp: Math.floor(Date.now() / 1000)
                }
            },
            { upsert: true }
        );
    } catch (error) {
        if (error.code !== 11000) {
            console.warn(`[DISPATCHER] falha ao registrar midia inbound -> ${remoteJid}: ${error.message}`);
        }
    }
};

export const setupDispatcher = (sock, currentSocketId = 'N/A', sessionId = 'default') => {
    sock.ev.on('messages.upsert', async (payload) => {
        const { messages, type } = payload;
        const msg = messages[0];
        if (debugUpsert && msg) {
            console.log(`[DISPATCHER_DEBUG] upsert type=${type} fromMe=${Boolean(msg.key?.fromMe)} remote=${msg.key?.remoteJid || ''} senderPn=${msg.key?.senderPn || ''} id=${msg.key?.id || ''} keys=${Object.keys(msg.message || {}).join(',')} | session=${sessionId}`);
        }
        if (!msg || !msg.message || msg.key.fromMe) return;
        if (!['notify', 'append'].includes(String(type || ''))) return;
        const remoteJid = msg.key.remoteJid;
        const senderPn = msg.key?.senderPn || msg.key?.participant || null;
        const knownEcPhone = await knownEcuadorPhoneForLid(remoteJid);
        const operationalPanelPhone = isOperationalPanelPhone(remoteJid, senderPn);
        if (ecOnlyInboundEnabled() && !operationalPanelPhone && !isAllowedEcuadorCustomerJid(remoteJid, senderPn) && !knownEcPhone) {
            console.log(`[DISPATCHER] inbound bloqueado fora do EC -> ${remoteJid} | senderPn=${senderPn || 'sem_senderPn'} | session=${sessionId}`);
            return;
        }
        const message = unwrapMessage(msg.message);
        const ownDigits = getOwnPhoneDigits(sessionId);
        const remoteDigits = String(remoteJid || '').replace(/\D/g, '');
        if (ownDigits && remoteDigits === ownDigits) {
            console.log(`[DISPATCHER] ignorando mensagem do proprio numero -> ${remoteJid} | session=${sessionId}`);
            return;
        }
        const text = getMessageText(message);
        if (!text && !hasInboundMedia(message)) {
            console.log(`[DISPATCHER] ignorando evento sem texto/midia -> ${remoteJid} | keys=${Object.keys(message || {}).join(',')} | session=${sessionId}`);
            return;
        }
        console.log(`[DISPATCHER] [socketId=${currentSocketId}] inbound -> ${remoteJid} | text="${text.slice(0, 80)}" | session=${sessionId}`);
        enqueueMessage(remoteJid, async () => {
            try {
                let effectiveText = text;
                let downloadedMediaBuffer = null;
                let inboundMediaUrl = '';
                let inboundFallbackReason = '';
                const audioMessage = getInboundAudioMessage(message);
                if (!effectiveText && audioMessage) {
                    try {
                        downloadedMediaBuffer = await downloadMediaMessage(
                            msg,
                            'buffer',
                            {},
                            {
                                logger: sock.logger,
                                reuploadRequest: sock.updateMediaMessage
                            }
                        );
                        const transcription = await transcribeInboundAudioBuffer({
                            buffer: downloadedMediaBuffer,
                            mimetype: audioMessage.mimetype || 'audio/ogg',
                            messageId: msg.key.id
                        });
                        if (transcription.ok) {
                            effectiveText = transcription.text;
                            console.log(`[AUDIO-INBOUND] transcrito -> ${remoteJid} | "${effectiveText.slice(0, 120)}" | session=${sessionId}`);
                        } else {
                            console.log(`[AUDIO-INBOUND] audio sem transcricao util -> ${remoteJid} | motivo=${transcription.skipped || transcription.error || 'unknown'} | session=${sessionId}`);
                        }
                    } catch (audioError) {
                        console.warn(`[AUDIO-INBOUND] falha ao baixar/transcrever audio -> ${remoteJid}: ${audioError.message}`);
                    }
                }

                if (hasInboundMedia(message)) {
                    try {
                        inboundMediaUrl = await saveInboundMediaFile({
                            msg,
                            message,
                            mediaType: getInboundMediaType(message),
                            sock,
                            existingBuffer: downloadedMediaBuffer
                        });
                        await recordInboundMediaMessage({
                            remoteJid,
                            senderPn,
                            messageId: msg.key.id,
                            body: effectiveText,
                            message,
                            mediaUrl: inboundMediaUrl,
                            sessionId
                        });
                    } catch (mediaError) {
                        console.warn(`[DISPATCHER] falha ao salvar midia inbound -> ${remoteJid}: ${mediaError.message}`);
                    }
                }

                if (!effectiveText && audioMessage) {
                    inboundFallbackReason = 'audio_without_transcription';
                    effectiveText = `[ENTRADA_SEM_RESPOSTA:${inboundFallbackReason}]`;
                    console.log(`[DISPATCHER] audio sem transcricao encaminhado para fallback -> ${remoteJid} | session=${sessionId}`);
                }

                if (
                    hasInboundProofMedia(message)
                    && String(process.env.PICKUP_PROOF_BONUS_ENABLED || 'false').toLowerCase() === 'true'
                ) {
                    const proofResult = await handlePickupProofInbound({
                        chatId: remoteJid,
                        messageId: msg.key.id,
                        sessionId,
                        proofText: effectiveText,
                        hasMedia: true
                    });
                    if (proofResult.handled) {
                        console.log(`[DISPATCHER] comprovante de retirada processado -> ${remoteJid} | order=${proofResult.orderId} | bonus=${proofResult.bonusSent}`);
                        return;
                    }
                }

                if (
                    effectiveText
                    && isPickupProofText(effectiveText)
                    && String(process.env.PICKUP_PROOF_BONUS_ENABLED || 'false').toLowerCase() === 'true'
                ) {
                    const proofResult = await handlePickupProofInbound({
                        chatId: remoteJid,
                        messageId: msg.key.id,
                        sessionId,
                        proofText: effectiveText,
                        hasMedia: false
                    });
                    if (proofResult.handled) {
                        console.log(`[DISPATCHER] texto de retirada processado -> ${remoteJid} | order=${proofResult.orderId} | bonus=${proofResult.bonusSent}`);
                        return;
                    }
                }

                if (!effectiveText && hasInboundProofMedia(message)) {
                    const mediaType = getInboundProofMediaType(message) || 'media';
                    inboundFallbackReason = `${mediaType}_without_caption`;
                    effectiveText = `[ENTRADA_SEM_RESPOSTA:${inboundFallbackReason}]`;
                    console.log(`[DISPATCHER] midia sem legenda encaminhada para fallback -> ${remoteJid} | tipo=${mediaType} | session=${sessionId}`);
                }

                await routeIncomingMessage({
                    id: msg.key.id,
                    from: remoteJid,
                    senderPn,
                    senderName: cleanSenderName(msg.pushName || msg.verifiedBizName || msg.name || ''),
                    body: effectiveText,
                    inboundMediaType: getInboundMediaType(message),
                    inboundMediaUrl,
                    inboundFallbackReason,
                    inboundWasLid: String(remoteJid || '').endsWith('@lid'),
                    fullMessage: effectiveText === text ? msg : {
                        ...msg,
                        transcribedAudioText: effectiveText
                    },
                    sessionId
                });
            } catch (err) {
                console.error('Erro no dispatcher:', err);
            }
        });
    });
};
