const parseNonNegativeMs = (value, fallback) => {
    const parsed = Number.parseInt(String(value || ''), 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const randomDelayMs = (min, max, random = Math.random) => {
    const low = Math.max(0, Math.min(min, max));
    const high = Math.max(low, max);
    const sample = Math.max(0, Math.min(0.999999999, Number(random()) || 0));
    return low + Math.floor(sample * (high - low + 1));
};

export const nitrixEntryLayerMode = (env = process.env) => (
    String(env.NITRIX_FAST_STATE_ENTRY_LAYER || '').trim().toLowerCase() === 'two_audio_only'
        ? 'two_audio_only'
        : 'full_sequence'
);

// A camada e' propositalmente pura: pode ser testada sem banco, WhatsApp ou
// qualquer outra automacao. Os dois prazos sao persistidos pelo Fast State.
export const buildNitrixTwoAudioEntryJobs = (startedAt, { env = process.env, random = Math.random } = {}) => {
    const startMs = new Date(startedAt).getTime();
    if (!Number.isFinite(startMs)) throw new Error('nitrix_two_audio_start_invalid');
    // O primeiro audio usa uma janela curta a partir da entrada. Dez segundos
    // e' a referencia operacional; o sorteio 5–30 s evita rajada identica.
    const legacyFirstDelay = parseNonNegativeMs(env.NITRIX_FAST_STATE_ENTRY_AUDIO_01_DELAY_MS, 10000);
    const firstAudioMin = parseNonNegativeMs(env.NITRIX_FAST_STATE_ENTRY_AUDIO_01_MIN_MS, legacyFirstDelay);
    const firstAudioMax = parseNonNegativeMs(env.NITRIX_FAST_STATE_ENTRY_AUDIO_01_MAX_MS, firstAudioMin);
    const firstAudioDelay = randomDelayMs(firstAudioMin, firstAudioMax, random);
    // O segundo audio e' medido desde a entrada, nao desde o primeiro. Assim
    // ele sempre ocupa a janela total de 35–59 s e nunca adianta a conversa.
    const secondAudioMin = parseNonNegativeMs(env.NITRIX_FAST_STATE_ENTRY_AUDIO_02_AFTER_ENTRY_MIN_MS, 35000);
    const secondAudioMax = parseNonNegativeMs(env.NITRIX_FAST_STATE_ENTRY_AUDIO_02_AFTER_ENTRY_MAX_MS, secondAudioMin);
    const secondAudioDelay = randomDelayMs(secondAudioMin, secondAudioMax, random);
    const skipReason = 'entry_layer_two_audio_only';
    return [
        { id: 'opening_text', dueAt: '', scheduledAfterMs: 0, status: 'skipped', attempts: 0, skipReason },
        {
            id: 'audio_01',
            dueAt: new Date(startMs + firstAudioDelay).toISOString(),
            scheduledAfterMs: firstAudioDelay,
            status: 'pending',
            attempts: 0
        },
        {
            id: 'audio_02',
            dueAt: new Date(startMs + secondAudioDelay).toISOString(),
            scheduledAfterMs: secondAudioDelay,
            relativeTo: 'entry',
            status: 'pending',
            attempts: 0
        },
        { id: 'name_intro', dueAt: '', scheduledAfterMs: 0, status: 'skipped', attempts: 0, skipReason },
        { id: 'proof', dueAt: '', scheduledAfterMs: 0, status: 'skipped', attempts: 0, relativeTo: 'audio_02', skipReason },
        { id: 'bottle', dueAt: '', scheduledAfterMs: 0, status: 'skipped', attempts: 0, skipReason }
    ];
};
