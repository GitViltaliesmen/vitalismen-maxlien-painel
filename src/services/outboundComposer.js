import fs from 'fs';
import path from 'path';
import { generateAudio } from './audioService.js';
import { sendAudio } from '../whatsapp/sendAudio.js';
import { sendText } from '../whatsapp/sendText.js';

const AUDIO_TAG_REGEX = /\[GERAR_AUDIO:\s*"([^"]+)"\]/i;
const BOT_MIN_GAP_MS = Number.parseInt(process.env.BOT_MIN_GAP_MS || '2500', 10);
const BOT_AUDIO_AFTER_TEXT_MS = Number.parseInt(process.env.BOT_AUDIO_AFTER_TEXT_MS || '1200', 10);
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

    const cleanText = text
        .replace(AUDIO_TAG_REGEX, '')
        .replace(/\[ENVIAR_IMAGEM:\s*[a-zA-Z0-9_-]+\]/gi, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    return {
        cleanText,
        audioText: audioMatch ? audioMatch[1].trim() : null,
        imageKey: null
    };
};

export const executeOutboundPlan = async ({ jid, rawText }) => {
    const plan = parseOutboundPlan(rawText);
    return executePreparedOutboundPlan({ jid, plan });
};

export const enrichOutboundPlan = ({
    rawText,
    forceAudioText = null,
    forceImageKey = null,
    mode = 'mixed'
}) => {
    const plan = parseOutboundPlan(rawText);
    return {
        cleanText: plan.cleanText,
        audioText: mode === 'text_only'
            ? null
            : (plan.audioText || (forceAudioText ? plan.cleanText : null)),
        imageKey: plan.imageKey || forceImageKey || null,
        mode
    };
};

export const executePreparedOutboundPlan = async ({ jid, plan }) => {
    return runWithOutboundLock(jid, async () => {
        let textSent = false;
        let audioSent = false;

        if (plan.cleanText && plan.mode !== 'audio_only') {
            await respectMinGap(jid);
            textSent = await sendText(jid, plan.cleanText);
        }

        if (plan.audioText) {
            const outputDir = ensureGeneratedAudioDir();
            const filename = `reply_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.ogg`;
            const outputPath = path.join(outputDir, filename);
            const audioPath = await generateAudio(plan.audioText, outputPath);
            if (audioPath) {
                if (textSent && BOT_AUDIO_AFTER_TEXT_MS > 0) {
                    await sleep(BOT_AUDIO_AFTER_TEXT_MS);
                }
                await respectMinGap(jid);
                audioSent = await sendAudio(jid, audioPath, true);
            }
        }

        return {
            textSent,
            audioSent,
            imageSent: false,
            delivered: textSent || audioSent,
            cleanText: plan.cleanText,
            mode: plan.mode || 'mixed'
        };
    });
};
