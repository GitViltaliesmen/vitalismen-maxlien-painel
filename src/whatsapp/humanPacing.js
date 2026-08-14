import { execFile } from 'child_process';
import { parseFile } from 'music-metadata';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const outboundQueues = new Map();
const outboundPriorityUntil = new Map();
let globalQueue = Promise.resolve();
const audioDurationCache = new Map();

const enabled = () => String(process.env.WHATSAPP_HUMAN_PACING_ENABLED || 'true').toLowerCase() === 'true';
const manualMode = (value) => String(value || '').toLowerCase() === 'manual_panel';

const parseMs = (name, fallback) => {
    const value = Number.parseInt(String(process.env[name] || ''), 10);
    return Number.isFinite(value) && value >= 0 ? value : fallback;
};

const parseBool = (name, fallback = false) => {
    const raw = String(process.env[name] ?? '').trim().toLowerCase();
    if (!raw) return fallback;
    return ['1', 'true', 'yes', 'sim', 'on'].includes(raw);
};

const randomInt = (min, max) => {
    const low = Math.max(0, Math.min(min, max));
    const high = Math.max(low, max);
    return low + Math.floor(Math.random() * (high - low + 1));
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const baseDelayForKind = ({ kind, text = '', minMsOverride = null, maxMsOverride = null, sendMode = '' } = {}) => {
    const minMs = Number.isFinite(minMsOverride) ? minMsOverride : parseMs('WHATSAPP_HUMAN_PACING_MIN_MS', 1200);
    const maxMs = Number.isFinite(maxMsOverride) ? maxMsOverride : parseMs('WHATSAPP_HUMAN_PACING_MAX_MS', 6500);
    const chars = String(text || '').length;
    const isManual = manualMode(sendMode);

    if (isManual) return 0;

    if (kind === 'text') {
        const perCharMs = parseMs(
            isManual ? 'WHATSAPP_MANUAL_TEXT_PER_CHAR_MS' : 'WHATSAPP_HUMAN_PACING_TEXT_PER_CHAR_MS',
            isManual ? 8 : 22
        );
        const jitterMin = isManual ? 180 : 700;
        const jitterMax = isManual ? 650 : 1800;
        const manualCapMin = parseMs('WHATSAPP_MANUAL_TEXT_MIN_MS', 350);
        const manualCapMax = parseMs('WHATSAPP_MANUAL_TEXT_MAX_MS', 1800);
        const computed = (chars * perCharMs) + randomInt(jitterMin, jitterMax);
        return clamp(computed, isManual ? manualCapMin : minMs, isManual ? manualCapMax : maxMs);
    }

    if (kind === 'audio') {
        if (isManual) {
            return randomInt(
                parseMs('WHATSAPP_MANUAL_AUDIO_MIN_MS', 700),
                parseMs('WHATSAPP_MANUAL_AUDIO_MAX_MS', 2200)
            );
        }
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
    const isManual = manualMode(context.sendMode);
    if (isManual) return 0;
    if (kind === 'audio') {
        if (isManual) {
            return randomInt(
                parseMs('WHATSAPP_MANUAL_AFTER_AUDIO_MIN_MS', 3000),
                parseMs('WHATSAPP_MANUAL_AFTER_AUDIO_MAX_MS', 5000)
            );
        }
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
        if (isManual) {
            return randomInt(
                parseMs('WHATSAPP_MANUAL_AFTER_TEXT_MIN_MS', 300),
                parseMs('WHATSAPP_MANUAL_AFTER_TEXT_MAX_MS', 900)
            );
        }
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

const priorityKey = (jid = '') => String(jid || '').trim();

export const prioritizeNextOutbound = (jid, { ms = 120000, reason = 'priority' } = {}) => {
    const key = priorityKey(jid);
    if (!key) return false;
    const ttlMs = Math.max(1000, Number.isFinite(Number(ms)) ? Number(ms) : 120000);
    const until = Date.now() + ttlMs;
    outboundPriorityUntil.set(key, { until, reason });
    setTimeout(() => {
        const current = outboundPriorityUntil.get(key);
        if (current?.until === until) outboundPriorityUntil.delete(key);
    }, ttlMs + 1000).unref?.();
    console.log(`[OUTBOUND_PRIORITY] envio priorizado | jid=${key} | reason=${reason}`);
    return true;
};

const takeOutboundPriority = (jid = '') => {
    const key = priorityKey(jid);
    if (!key) return null;
    const current = outboundPriorityUntil.get(key);
    if (!current) return null;
    outboundPriorityUntil.delete(key);
    if (current.until && current.until >= Date.now()) return current;
    return null;
};

export const applyHumanPacing = async ({ sock, jid, kind = 'text', text = '', minMs = null, maxMs = null, sendMode = '' } = {}) => {
    if (!enabled() || !sock || !jid) return { waitedMs: 0, presence: 'disabled' };

    const presence = presenceForKind(kind);
    const waitMs = baseDelayForKind({ kind, text, minMsOverride: minMs, maxMsOverride: maxMs, sendMode });

    try {
        await sock.sendPresenceUpdate(presence, jid);
    } catch (error) {
        console.warn(`[PRESENCE] falha ao marcar ${presence} para ${jid}:`, error.message);
    }

    if (waitMs > 0) await sleep(waitMs);

    try {
        await sock.sendPresenceUpdate('paused', jid);
    } catch {
        // Presence is cosmetic; never block delivery if WhatsApp ignores it.
    }

    return { waitedMs: waitMs, presence };
};

export const applyAfterSendPacing = async ({ kind = 'text', text = '', audioPath = '', sendMode = '' } = {}) => {
    if (!enabled()) return 0;
    const waitMs = await afterSendDelayForKind(kind, { text, audioPath, sendMode });
    if (waitMs > 0) await sleep(waitMs);
    return waitMs;
};

export const withHumanizedOutboundQueue = async (jid, task, options = {}) => {
    if (!enabled() || !jid) return task();

    const queueKey = String(jid);
    const previous = outboundQueues.get(queueKey) || Promise.resolve();
    const priority = takeOutboundPriority(queueKey);
    const bypassGlobalQueue = options.bypassGlobalQueue === true || Boolean(priority);
    const sendMode = String(options.sendMode || '');
    const bypassManualQueue = manualMode(sendMode);
    const globalGapMinMs = Number.isFinite(options.globalGapMinMs)
        ? options.globalGapMinMs
        : parseMs('WHATSAPP_GLOBAL_QUEUE_GAP_MIN_MS', 1200);
    const globalGapMaxMs = Number.isFinite(options.globalGapMaxMs)
        ? options.globalGapMaxMs
        : parseMs('WHATSAPP_GLOBAL_QUEUE_GAP_MAX_MS', 5500);

    const current = previous
        .catch(() => null)
        .then(() => {
            if (bypassGlobalQueue || bypassManualQueue || parseBool('WHATSAPP_GLOBAL_QUEUE_DISABLED', false)) {
                if (priority) {
                    console.log(`[OUTBOUND_PRIORITY] fila global ignorada | jid=${queueKey} | reason=${priority.reason || 'priority'}`);
                }
                return task();
            }
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
