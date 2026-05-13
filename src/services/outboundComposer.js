import fs from 'fs';
import path from 'path';
import { generateAudio } from './audioService.js';
import { sendAudio } from '../whatsapp/sendAudio.js';
import { sendText } from '../whatsapp/sendText.js';
import { sendImage } from '../whatsapp/sendImage.js';
import { sendVideo } from '../whatsapp/sendVideo.js';
import { getSalesMedia } from './salesMediaCatalog.js';
import { resolveCountryAudio } from './audioTemplateService.js';

const AUDIO_TAG_REGEX = /\[GERAR_AUDIO:\s*"([^"]+)"\]/i;
const IMAGE_TAG_REGEX = /\[ENVIAR_IMAGEM:\s*([a-zA-Z0-9_,-]+)\]/i;
const RECORDED_AUDIO_TAG_REGEX = /\[ENVIAR_AUDIO_GRAVADO:\s*([a-zA-Z0-9_,-]+)\]/i;
const BOT_MIN_GAP_MS = Number.parseInt(process.env.BOT_MIN_GAP_MS || '2500', 10);
const BOT_AUDIO_AFTER_TEXT_MS = Number.parseInt(process.env.BOT_AUDIO_AFTER_TEXT_MS || '1200', 10);
const APPROVED_AUDIO_ONLY = String(process.env.BOT_USE_APPROVED_AUDIO_ONLY || '').toLowerCase() === 'true';
const outboundLocks = new Map();
const lastOutboundAt = new Map();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const runWithOutboundLock = async (jid, task) => {
    const previous = outboundLocks.get(jid) || Promise.resolve();
    const current = previous
        .catch(() => undefined)
        .then(task)
        .finally(() => {
            if (outboundLocks.get(jid) === current) {
                outboundLocks.delete(jid);
            }
        });

    outboundLocks.set(jid, current);
    return current;
};

const respectMinGap = async (jid) => {
    const lastAt = lastOutboundAt.get(jid) || 0;
    const waitMs = Math.max(0, BOT_MIN_GAP_MS - (Date.now() - lastAt));
    if (waitMs > 0) {
        await sleep(waitMs);
    }
    lastOutboundAt.set(jid, Date.now());
};

const ensureGeneratedAudioDir = () => {
    const dir = path.join(process.cwd(), 'public', 'media', 'generated');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
};

export const parseOutboundPlan = (rawText) => {
    const text = String(rawText || '');
    const audioMatch = text.match(AUDIO_TAG_REGEX);
    const imageMatch = text.match(IMAGE_TAG_REGEX);
    const recordedAudioMatch = text.match(RECORDED_AUDIO_TAG_REGEX);

    const cleanText = text
        .replace(AUDIO_TAG_REGEX, '')
        .replace(/\[ENVIAR_IMAGEM:\s*[a-zA-Z0-9_,-]+\]/gi, '')
        .replace(/\[ENVIAR_AUDIO_GRAVADO:\s*[a-zA-Z0-9_,-]+\]/gi, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    return {
        cleanText,
        audioText: audioMatch ? audioMatch[1].trim() : null,
        recordedAudioNames: recordedAudioMatch
            ? recordedAudioMatch[1].split(',').map((item) => item.trim()).filter(Boolean)
            : [],
        imageKeys: imageMatch
            ? imageMatch[1].split(',').map((item) => item.trim()).filter(Boolean)
            : []
    };
};

export const executeOutboundPlan = async ({ jid, rawText, sessionId = null }) => {
    const plan = parseOutboundPlan(rawText);
    return executePreparedOutboundPlan({ jid, plan, sessionId });
};

export const enrichOutboundPlan = ({
    rawText,
    forceAudioText = null,
    forceImageKey = null,
    forceRecordedAudioName = null,
    recordedAudioCountry = null,
    mode = 'mixed'
}) => {
    const plan = parseOutboundPlan(rawText);
    return {
        cleanText: plan.cleanText,
        audioText: mode === 'text_only'
            ? null
            : (plan.audioText || (forceAudioText ? plan.cleanText : null)),
        recordedAudioNames: [
            ...(Array.isArray(plan.recordedAudioNames) ? plan.recordedAudioNames : []),
            ...(Array.isArray(forceRecordedAudioName)
                ? forceRecordedAudioName
                : (forceRecordedAudioName ? [forceRecordedAudioName] : []))
        ].filter(Boolean),
        recordedAudioCountry,
        imageKeys: [
            ...(Array.isArray(plan.imageKeys) ? plan.imageKeys : []),
            ...(Array.isArray(forceImageKey) ? forceImageKey : (forceImageKey ? [forceImageKey] : []))
        ].filter(Boolean),
        mode
    };
};

export const executePreparedOutboundPlan = async ({ jid, plan, sessionId = null, countryCode = null }) => {
    return runWithOutboundLock(jid, async () => {
        let textSent = false;
        let audioSent = false;
        let imageSent = false;

        const recordedAudioNames = Array.isArray(plan.recordedAudioNames) ? plan.recordedAudioNames : [];
        for (const baseName of recordedAudioNames) {
            const audioCountry = plan.recordedAudioCountry || countryCode;
            const audioPath = await resolveCountryAudio({ country: audioCountry, baseName });
            if (!audioPath) {
                console.warn(`[AUDIO] Audio gravado aprovado nao encontrado: ${audioCountry}/${baseName}`);
                continue;
            }
            await respectMinGap(jid);
            const sent = await sendAudio(jid, audioPath, true, { sessionId });
            audioSent = audioSent || sent;
        }

        if (plan.cleanText && plan.mode !== 'audio_only') {
            await respectMinGap(jid);
            textSent = await sendText(jid, plan.cleanText, null, { sessionId });
        }

        const imageKeys = Array.isArray(plan.imageKeys) ? plan.imageKeys : [];
        for (const imageKey of imageKeys) {
            const media = getSalesMedia(imageKey);
            if (!media) continue;
            await respectMinGap(jid);
            if (media.type === 'video') {
                const sent = await sendVideo(jid, media.path, media.caption || '', {
                    sessionId,
                    viewOnce: Boolean(media.viewOnce)
                });
                imageSent = imageSent || sent;
            } else {
                const sent = await sendImage(jid, media.path, media.caption || '', { sessionId });
                imageSent = imageSent || sent;
            }
        }

        if (plan.audioText) {
            if (APPROVED_AUDIO_ONLY) {
                console.log('[AUDIO] TTS bloqueado por BOT_USE_APPROVED_AUDIO_ONLY=true. Use audios aprovados do painel.');
                return {
                    textSent,
                    audioSent,
                    imageSent,
                    delivered: textSent || imageSent,
                    cleanText: plan.cleanText,
                    mode: plan.mode || 'mixed'
                };
            }
            const outputDir = ensureGeneratedAudioDir();
            const filename = `reply_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.ogg`;
            const outputPath = path.join(outputDir, filename);
            const audioPath = await generateAudio(plan.audioText, outputPath);
            if (audioPath) {
                if (textSent && BOT_AUDIO_AFTER_TEXT_MS > 0) {
                    await sleep(BOT_AUDIO_AFTER_TEXT_MS);
                }
                await respectMinGap(jid);
                audioSent = await sendAudio(jid, audioPath, true, { sessionId });
            }
        }

        return {
            textSent,
            audioSent,
            imageSent,
            delivered: textSent || audioSent || imageSent,
            cleanText: plan.cleanText,
            mode: plan.mode || 'mixed'
        };
    });
};
