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
        NITRIX_FAST_STATE_ENTRY_AUDIO_01_DELAY_MS: '10000',
        NITRIX_FAST_STATE_ENTRY_AUDIO_02_AFTER_FIRST_MS: '20000'
    }
});
const byId = (id) => jobs.find((job) => job.id === id);

assert(byId('opening_text')?.status === 'skipped', 'camada de dois audios nao envia texto de abertura');
assert(byId('audio_01')?.status === 'pending', 'audio 1 deve entrar na fila');
assert(new Date(byId('audio_01')?.dueAt).getTime() === startedAt.getTime() + 10000, 'audio 1 deve ficar em 10 segundos');
assert(byId('audio_02')?.status === 'pending', 'audio 2 deve entrar na fila');
assert(byId('audio_02')?.dueAt === '', 'audio 2 deve esperar o envio aceito do audio 1');
assert(byId('audio_02')?.scheduledAfterMs === 20000, 'audio 2 deve esperar 20 segundos apos o audio 1');
for (const id of ['name_intro', 'proof', 'bottle']) {
    assert(byId(id)?.status === 'skipped', `${id} nao pode ser enviado nesta camada`);
    assert(byId(id)?.skipReason === 'entry_layer_two_audio_only', `${id} deve registrar o bloqueio da camada`);
}

console.log('Nitrix two-audio entry layer: OK');
