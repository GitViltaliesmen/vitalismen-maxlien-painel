const parseNonNegativeMs = (value, fallback) => {
    const parsed = Number.parseInt(String(value || ''), 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

export const nitrixEntryLayerMode = (env = process.env) => (
    String(env.NITRIX_FAST_STATE_ENTRY_LAYER || '').trim().toLowerCase() === 'two_audio_only'
        ? 'two_audio_only'
        : 'full_sequence'
);

// A camada e' propositalmente pura: pode ser testada sem banco, WhatsApp ou
// qualquer outra automacao. Os dois prazos sao persistidos pelo Fast State.
export const buildNitrixTwoAudioEntryJobs = (startedAt, { env = process.env } = {}) => {
    const startMs = new Date(startedAt).getTime();
    if (!Number.isFinite(startMs)) throw new Error('nitrix_two_audio_start_invalid');
    const firstAudioDelay = parseNonNegativeMs(env.NITRIX_FAST_STATE_ENTRY_AUDIO_01_DELAY_MS, 10000);
    const secondAudioDelay = parseNonNegativeMs(env.NITRIX_FAST_STATE_ENTRY_AUDIO_02_AFTER_FIRST_MS, 20000);
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
