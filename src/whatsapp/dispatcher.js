import { enqueueMessage } from './queue.js';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { routeIncomingMessage } from '../services/agentRouter.js';
import { getOwnPhoneDigits } from './connection.js';
import { handlePickupProofInbound } from '../services/shipmentMessageService.js';
import { transcribeInboundAudioBuffer } from '../services/inboundAudioTranscriptionService.js';
import Message from '../models/Message.js';

const debugUpsert = String(process.env.WHATSAPP_DEBUG_UPSERT || '') === 'true';

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

const recordInboundProofMediaMessage = async ({ remoteJid, senderPn = '', messageId = '', body = '', message = {} }) => {
    const mediaType = getInboundProofMediaType(message);
    if (!mediaType || !remoteJid || !messageId) return;
    try {
        await Message.updateOne(
            { _id: messageId },
            {
                $setOnInsert: {
                    chatId: remoteJid,
                    peerPhone: String(senderPn || remoteJid || '').replace(/\D/g, ''),
                    from: remoteJid,
                    to: 'bot',
                    body: body || `[MEDIA] ${mediaType}`,
                    type: mediaType,
                    hasMedia: true,
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
        if (type !== 'notify') return;
        if (!msg || !msg.message || msg.key.fromMe) return;
        const remoteJid = msg.key.remoteJid;
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
                const audioMessage = getInboundAudioMessage(message);
                if (!effectiveText && audioMessage) {
                    try {
                        const buffer = await downloadMediaMessage(
                            msg,
                            'buffer',
                            {},
                            {
                                logger: sock.logger,
                                reuploadRequest: sock.updateMediaMessage
                            }
                        );
                        const transcription = await transcribeInboundAudioBuffer({
                            buffer,
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

                if (!effectiveText && audioMessage) {
                    console.log(`[DISPATCHER] ignorando audio sem transcricao -> ${remoteJid} | session=${sessionId}`);
                    return;
                }

                if (hasInboundProofMedia(message)) {
                    await recordInboundProofMediaMessage({
                        remoteJid,
                        senderPn: msg.key?.senderPn || msg.key?.participant || null,
                        messageId: msg.key.id,
                        body: effectiveText,
                        message
                    });
                }

                if (
                    hasInboundProofMedia(message)
                    && String(process.env.PICKUP_PROOF_BONUS_ENABLED || 'false').toLowerCase() === 'true'
                ) {
                    const proofResult = await handlePickupProofInbound({
                        chatId: remoteJid,
                        messageId: msg.key.id,
                        sessionId
                    });
                    if (proofResult.handled) {
                        console.log(`[DISPATCHER] comprovante de retirada processado -> ${remoteJid} | order=${proofResult.orderId} | bonus=${proofResult.bonusSent}`);
                        return;
                    }
                }

                await routeIncomingMessage({
                    id: msg.key.id,
                    from: remoteJid,
                    senderPn: msg.key?.senderPn || msg.key?.participant || null,
                    body: effectiveText,
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
