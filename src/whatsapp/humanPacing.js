import { execFile } from 'child_process';
import { parseFile } from 'music-metadata';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const outboundQueues = new Map();
let globalQueue = Promise.resolve();
const audioDurationCache = new Map();

const enabled = () => String(process.env.WHATSAPP_HUMAN_PACING_ENABLED || 'true').toLowerCase() === 'true';

const parseMs = (name, fallback) => {
    const value = Number.parseInt(String(process.env[name] || ''), 10);
    return Number.isFinite(value) && value >= 0 ? value : fallback;
};

const randomInt = (min, max) => {
    const low = Math.max(0, Math.min(min, max));
    const high = Math.max(low, max);
    return low + Math.floor(Math.random() * (high - low + 1));
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const baseDelayForKind = ({ kind, text = '' }) => {
    const minMs = parseMs('WHATSAPP_HUMAN_PACING_MIN_MS', 1200);
    const maxMs = parseMs('WHATSAPP_HUMAN_PACING_MAX_MS', 6500);
    const chars = String(text || '').length;

    if (kind === 'text') {
        const perCharMs = parseMs('WHATSAPP_HUMAN_PACING_TEXT_PER_CHAR_MS', 22);
        return clamp((chars * perCharMs) + randomInt(700, 1800), minMs, maxMs);
    }

    if (kind === 'audio') {
        return randomInt(
            parseMs('WHATSAPP_HUMAN_PACING_AUDIO_MIN_MS', 2500),
            parseMs('WHATSAPP_HUMAN_PACING_AUDIO_MAX_MS', 9000)
        );
    }

    return randomInt(
        parseMs('WHATSAPP_HUMAN_PACING_MEDIA_MIN_MS', 1200),
        parseMs('WHATSAPP_HUMAN_PACING_MEDIA_MAX_MS', 4500)
    );
};

const getAudioDurationMs = async (audioPath = '') => {
    const key = String(audioPath || '');
    if (!key) return 0;
    if (audioDurationCache.has(key)) return audioDurationCache.get(key);

    try {
        const metadata = await parseFile(key, { duration: true });
        const durationMs = metadata?.format?.duration ? Math.round(metadata.format.duration * 1000) : 0;
        if (durationMs > 0) {
            audioDurationCache.set(key, durationMs);
            return durationMs;
        }
    } catch {
        // Fall back to macOS afinfo below.
    }

    try {
        const { stdout } = await execFileAsync('/usr/bin/afinfo', [key], { timeout: 4000 });
        const match = String(stdout || '').match(/estimated duration:\s*([0-9.]+)/i);
        const durationMs = match ? Math.round(Number.parseFloat(match[1]) * 1000) : 0;
        const safeMs = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 0;
        audioDurationCache.set(key, safeMs);
        return safeMs;
    } catch {
        audioDurationCache.set(key, 0);
        return 0;
    }
};

const afterSendDelayForKind = async (kind, context = {}) => {
    if (kind === 'audio') {
        const fixedMin = randomInt(
            parseMs('WHATSAPP_HUMAN_AFTER_AUDIO_MIN_MS', 4500),
            parseMs('WHATSAPP_HUMAN_AFTER_AUDIO_MAX_MS', 12000)
        );
        if (String(process.env.WHATSAPP_AUDIO_WAIT_BY_DURATION || 'true').toLowerCase() !== 'true') {
            return fixedMin;
        }

        const durationMs = await getAudioDurationMs(context.audioPath || context.text || '');
        if (!durationMs) return fixedMin;

        const multiplier = Number.parseFloat(process.env.WHATSAPP_AUDIO_WAIT_DURATION_MULTIPLIER || '1');
        const jitterMs = randomInt(
            parseMs('WHATSAPP_AUDIO_WAIT_JITTER_MIN_MS', 1500),
            parseMs('WHATSAPP_AUDIO_WAIT_JITTER_MAX_MS', 6500)
        );
        const maxMs = parseMs('WHATSAPP_AUDIO_WAIT_MAX_MS', 90000);
        return clamp(Math.round(durationMs * (Number.isFinite(multiplier) ? multiplier : 1)) + jitterMs, fixedMin, maxMs);
    }

    if (kind === 'text') {
        return randomInt(
            parseMs('WHATSAPP_HUMAN_AFTER_TEXT_MIN_MS', 2500),
            parseMs('WHATSAPP_HUMAN_AFTER_TEXT_MAX_MS', 7000)
        );
    }

    return randomInt(
        parseMs('WHATSAPP_HUMAN_AFTER_MEDIA_MIN_MS', 3500),
        parseMs('WHATSAPP_HUMAN_AFTER_MEDIA_MAX_MS', 9000)
    );
};

const presenceForKind = (kind) => {
    if (kind === 'audio') return 'recording';
    if (kind === 'text') return 'composing';
    return 'composing';
};

export const applyHumanPacing = async ({ sock, jid, kind = 'text', text = '' } = {}) => {
    if (!enabled() || !jid) return { waitedMs: 0, presence: 'disabled' };

    const presence = presenceForKind(kind);
    const waitMs = baseDelayForKind({ kind, text });

    if (sock) {
        try {
            await sock.sendPresenceUpdate(presence, jid);
        } catch (error) {
            console.warn(`[PRESENCE] falha ao marcar ${presence} para ${jid}:`, error.message);
        }
    }

    if (waitMs > 0) await sleep(waitMs);

    if (sock) {
        try {
            await sock.sendPresenceUpdate('paused', jid);
        } catch {
            // Presence is cosmetic; never block delivery if WhatsApp ignores it.
        }
    }

    return { waitedMs: waitMs, presence: sock ? presence : `${presence}:wait-only` };
};

export const applyAfterSendPacing = async ({ kind = 'text', text = '', audioPath = '' } = {}) => {
    if (!enabled()) return 0;
    const waitMs = await afterSendDelayForKind(kind, { text, audioPath });
    if (waitMs > 0) await sleep(waitMs);
    return waitMs;
};

export const withHumanizedOutboundQueue = async (jid, task) => {
    if (!enabled() || !jid) return task();

    const queueKey = String(jid);
    const previous = outboundQueues.get(queueKey) || Promise.resolve();
    const globalGapMinMs = parseMs('WHATSAPP_GLOBAL_QUEUE_GAP_MIN_MS', 1200);
    const globalGapMaxMs = parseMs('WHATSAPP_GLOBAL_QUEUE_GAP_MAX_MS', 5500);

    const current = previous
        .catch(() => null)
        .then(() => {
            const run = globalQueue
                .catch(() => null)
                .then(async () => {
                    const gapMs = randomInt(globalGapMinMs, globalGapMaxMs);
                    if (gapMs > 0) await sleep(gapMs);
                    return task();
                });
            globalQueue = run.catch(() => null);
            return run;
        })
        .finally(() => {
            if (outboundQueues.get(queueKey) === current) {
                outboundQueues.delete(queueKey);
            }
        });

    outboundQueues.set(queueKey, current);
    return current;
};
