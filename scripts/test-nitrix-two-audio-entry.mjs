import {
    buildNitrixTwoAudioEntryJobs,
    nitrixEntryLayerMode
} from '../src/services/nitrixEntryTwoAudioLayer.js';

const assert = (condition, message) => {
    if (!condition) throw new Error(message);
};

const startedAt = new Date('2026-07-13T12:00:00.000Z');
const layer = nitrixEntryLayerMode({ NITRIX_FAST_STATE_ENTRY_LAYER: 'two_audio_only' });
assert(layer === 'two_audio_only', 'camada explicita deve selecionar somente dois audios');
assert(nitrixEntryLayerMode({}) === 'full_sequence', 'sem liberacao explicita deve preservar a sequencia anterior');

const jobs = buildNitrixTwoAudioEntryJobs(startedAt, {
    env: {
        NITRIX_FAST_STATE_ENTRY_AUDIO_01_MIN_MS: '5000',
        NITRIX_FAST_STATE_ENTRY_AUDIO_01_MAX_MS: '30000',
        NITRIX_FAST_STATE_ENTRY_AUDIO_02_AFTER_ENTRY_MIN_MS: '35000',
        NITRIX_FAST_STATE_ENTRY_AUDIO_02_AFTER_ENTRY_MAX_MS: '59000'
    },
    random: () => 0
});
const byId = (id) => jobs.find((job) => job.id === id);

assert(byId('opening_text')?.status === 'skipped', 'camada de dois audios nao envia texto de abertura');
assert(byId('audio_01')?.status === 'pending', 'audio 1 deve entrar na fila');
assert(new Date(byId('audio_01')?.dueAt).getTime() === startedAt.getTime() + 5000, 'limite inferior do audio 1 deve ser 5 segundos apos a entrada');
assert(byId('audio_02')?.status === 'pending', 'audio 2 deve entrar na fila');
assert(new Date(byId('audio_02')?.dueAt).getTime() === startedAt.getTime() + 35000, 'limite inferior do audio 2 deve ser 35 segundos apos a entrada');
assert(byId('audio_02')?.relativeTo === 'entry', 'audio 2 deve preservar seu horario absoluto desde a entrada');
assert(byId('audio_02')?.scheduledAfterMs === 35000, 'audio 2 deve registrar a janela desde a entrada');
for (const id of ['name_intro', 'proof', 'bottle']) {
    assert(byId(id)?.status === 'skipped', `${id} nao pode ser enviado nesta camada`);
    assert(byId(id)?.skipReason === 'entry_layer_two_audio_only', `${id} deve registrar o bloqueio da camada`);
}

const maxJobs = buildNitrixTwoAudioEntryJobs(startedAt, {
    env: {
        NITRIX_FAST_STATE_ENTRY_AUDIO_01_MIN_MS: '5000',
        NITRIX_FAST_STATE_ENTRY_AUDIO_01_MAX_MS: '30000',
        NITRIX_FAST_STATE_ENTRY_AUDIO_02_AFTER_ENTRY_MIN_MS: '35000',
        NITRIX_FAST_STATE_ENTRY_AUDIO_02_AFTER_ENTRY_MAX_MS: '59000'
    },
    random: () => 1
});
assert(new Date(maxJobs.find((job) => job.id === 'audio_01')?.dueAt).getTime() === startedAt.getTime() + 30000, 'limite superior do audio 1 deve ser 30 segundos apos a entrada');
assert(maxJobs.find((job) => job.id === 'audio_02')?.scheduledAfterMs === 59000, 'limite superior do audio 2 deve ser 59 segundos apos a entrada');

console.log('Nitrix two-audio entry layer: OK');
