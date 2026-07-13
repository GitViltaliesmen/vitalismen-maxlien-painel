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
    const firstAudioDelay = parseNonNegativeMs(env.NITRIX_FAST_STATE_ENTRY_AUDIO_01_DELAY_MS, 10000);
    // Mantem compatibilidade com a configuracao fixa anterior, mas a camada
    // oficial usa a janela 5–30 s para que a segunda midia nao tenha ritmo
    // mecanico entre entradas reais.
    const legacySecondDelay = parseNonNegativeMs(env.NITRIX_FAST_STATE_ENTRY_AUDIO_02_AFTER_FIRST_MS, 20000);
    const secondAudioMin = parseNonNegativeMs(env.NITRIX_FAST_STATE_ENTRY_AUDIO_02_AFTER_FIRST_MIN_MS, legacySecondDelay);
    const secondAudioMax = parseNonNegativeMs(env.NITRIX_FAST_STATE_ENTRY_AUDIO_02_AFTER_FIRST_MAX_MS, secondAudioMin);
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
        { id: 'audio_02', dueAt: '', scheduledAfterMs: secondAudioDelay, status: 'pending', attempts: 0 },
        { id: 'name_intro', dueAt: '', scheduledAfterMs: 0, status: 'skipped', attempts: 0, skipReason },
        { id: 'proof', dueAt: '', scheduledAfterMs: 0, status: 'skipped', attempts: 0, relativeTo: 'audio_02', skipReason },
        { id: 'bottle', dueAt: '', scheduledAfterMs: 0, status: 'skipped', attempts: 0, skipReason }
    ];
};
