import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
    captureInboundMedia,
    detectInboundMediaSignature,
    downloadInboundMedia,
    inboundMediaInternalUrl,
    inboundMediaStorageRoot,
    INBOUND_MEDIA_STATUS,
    isStoredInboundMediaPath
} from '../src/services/inboundMediaStorageService.js';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(20, 1)]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 '), Buffer.alloc(20, 2)]);
const OGG_OPUS = Buffer.concat([Buffer.from('OggS'), Buffer.alloc(24), Buffer.from('OpusHead'), Buffer.alloc(32, 3)]);

const response = (body, status = 200, contentType = 'application/octet-stream', extraHeaders = {}) => new Response(body, {
    status,
    headers: { 'content-type': contentType, ...extraHeaders }
});

const fetchReturning = (body, status, contentType, extraHeaders) => async () => response(body, status, contentType, extraHeaders);

const queryValue = (value) => ({
    select() { return this; },
    lean() { return Promise.resolve(value ? structuredClone(value) : null); }
});

const fakeMessageModel = (initial = {}) => {
    const state = { ...initial };
    const transitions = [];
    const apply = (update = {}) => {
        if (update.$set) Object.assign(state, update.$set);
        for (const key of Object.keys(update.$unset || {})) delete state[key];
        if (update.$set?.mediaStorageStatus) transitions.push(update.$set.mediaStorageStatus);
    };
    return {
        state,
        transitions,
        findById() {
            return queryValue(state);
        },
        findOneAndUpdate(filter, update) {
            if (state.mediaStorageStatus === INBOUND_MEDIA_STATUS.READY) return queryValue(null);
            apply(update);
            return queryValue(state);
        },
        async updateOne(filter, update) {
            if (filter.mediaFetchLockToken && filter.mediaFetchLockToken !== state.mediaFetchLockToken) {
                return { matchedCount: 0, modifiedCount: 0 };
            }
            apply(update);
            return { matchedCount: 1, modifiedCount: 1 };
        }
    };
};

test('assinaturas JPEG, PNG e WebP são validadas pelo conteúdo real', () => {
    assert.equal(detectInboundMediaSignature(JPEG, 'image/jpeg').mime, 'image/jpeg');
    assert.equal(detectInboundMediaSignature(PNG, 'image/png').mime, 'image/png');
    assert.equal(detectInboundMediaSignature(WEBP, 'image/webp').mime, 'image/webp');
});

test('áudio OGG/Opus válido é aceito e registra codec reproduzível', async () => {
    const result = await downloadInboundMedia({
        url: 'https://provider.test/temporary.ogg',
        declaredMime: 'audio/ogg; codecs=opus',
        expectedType: 'audio',
        fetchImpl: fetchReturning(OGG_OPUS, 200, 'audio/ogg'),
        allowUrl: () => true
    });
    assert.equal(result.storedMime, 'audio/ogg');
    assert.equal(result.codec, 'opus');
    assert.equal(result.size, OGG_OPUS.length);
    assert.match(result.sha256, /^[a-f0-9]{64}$/);
});

test('URL temporária é baixada uma vez e replay posterior usa o arquivo persistido', async (t) => {
    const storageRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'vitalismen-inbound-media-'));
    t.after(() => fs.promises.rm(storageRoot, { recursive: true, force: true }));
    const messageId = 'wamid.replay-safe';
    const model = fakeMessageModel({
        _id: messageId,
        hasMedia: true,
        mediaStorageStatus: INBOUND_MEDIA_STATUS.RECEIVED
    });
    let fetchCount = 0;
    const first = await captureInboundMedia({
        messageId,
        providerUrl: 'https://provider.test/temporary.ogg',
        providerMediaId: 'provider-media-1',
        originalMime: 'audio/ogg',
        expectedType: 'audio',
        storageRoot,
        allowUrl: () => true,
        fetchImpl: async () => {
            fetchCount += 1;
            return response(OGG_OPUS, 200, 'audio/ogg');
        },
        messageModel: model
    });
    assert.equal(first.status, INBOUND_MEDIA_STATUS.READY);
    assert.equal(fetchCount, 1);
    assert.deepEqual(model.transitions.slice(-3), ['FETCHING', 'STORED', 'READY']);
    assert.equal(model.state.mediaUrl, inboundMediaInternalUrl(messageId));
    assert.equal(model.state.providerMediaId, 'provider-media-1');
    assert.equal(model.state.mediaSize, OGG_OPUS.length);
    assert.equal(isStoredInboundMediaPath(model.state.storedMediaPath, storageRoot), true);
    assert.equal(fs.existsSync(model.state.storedMediaPath), true);

    const replay = await captureInboundMedia({
        messageId,
        providerUrl: 'https://provider.test/already-expired.ogg',
        originalMime: 'audio/ogg',
        expectedType: 'audio',
        storageRoot,
        allowUrl: () => true,
        fetchImpl: async () => {
            fetchCount += 1;
            return response('expired', 404, 'text/plain');
        },
        messageModel: model
    });
    assert.equal(replay.status, INBOUND_MEDIA_STATUS.READY);
    assert.equal(replay.cached, true);
    assert.equal(fetchCount, 1);
});

for (const status of [401, 403, 404]) {
    test(`falha HTTP ${status} do provider recebe motivo persistível`, async () => {
        await assert.rejects(
            downloadInboundMedia({
                url: 'https://provider.test/expired',
                declaredMime: 'audio/ogg',
                expectedType: 'audio',
                fetchImpl: fetchReturning('denied', status, 'text/plain'),
                allowUrl: () => true
            }),
            (error) => error.code === `provider_http_${status}` && error.statusCode === status
        );
    });
}

test('falha de captura termina em FAILED com motivo auditável sem expor a URL no mediaUrl', async (t) => {
    const storageRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'vitalismen-inbound-failed-'));
    t.after(() => fs.promises.rm(storageRoot, { recursive: true, force: true }));
    const messageId = 'wamid.expired-before-capture';
    const model = fakeMessageModel({
        _id: messageId,
        hasMedia: true,
        mediaStorageStatus: INBOUND_MEDIA_STATUS.RECEIVED
    });
    const result = await captureInboundMedia({
        messageId,
        providerUrl: 'https://provider.test/expired.ogg?signed=secret',
        originalMime: 'audio/ogg',
        expectedType: 'audio',
        storageRoot,
        allowUrl: () => true,
        fetchImpl: fetchReturning('expired', 404, 'text/plain'),
        messageModel: model
    });
    assert.deepEqual(result, { status: INBOUND_MEDIA_STATUS.FAILED, error: 'provider_http_404' });
    assert.equal(model.state.mediaStorageStatus, INBOUND_MEDIA_STATUS.FAILED);
    assert.equal(model.state.mediaDownloadError, 'provider_http_404');
    assert.equal(model.state.mediaUrl, inboundMediaInternalUrl(messageId));
    assert.doesNotMatch(model.state.mediaUrl, /provider\.test|signed|secret/);
});

test('codec OGG não reproduzível falha fechado', () => {
    assert.throws(
        () => detectInboundMediaSignature(Buffer.concat([Buffer.from('OggS'), Buffer.alloc(64)]), 'audio/ogg'),
        (error) => error.code === 'unsupported_audio_codec'
    );
});

test('imagem inválida e MIME divergente não são armazenados como válidos', async () => {
    await assert.rejects(
        downloadInboundMedia({
            url: 'https://provider.test/not-an-image.jpg',
            declaredMime: 'image/jpeg',
            expectedType: 'image',
            fetchImpl: fetchReturning(Buffer.from('not-an-image'), 200, 'image/jpeg'),
            allowUrl: () => true
        }),
        (error) => error.code === 'invalid_media_signature'
    );
    await assert.rejects(
        downloadInboundMedia({
            url: 'https://provider.test/wrong-mime.png',
            declaredMime: 'image/png',
            expectedType: 'image',
            fetchImpl: fetchReturning(JPEG, 200, 'image/png'),
            allowUrl: () => true
        }),
        (error) => error.code === 'mime_mismatch'
    );
});

test('arquivo vazio, tamanho excedido, redirect inseguro e URL inválida falham fechado', async () => {
    await assert.rejects(
        downloadInboundMedia({
            url: 'https://provider.test/empty',
            declaredMime: 'audio/ogg',
            expectedType: 'audio',
            fetchImpl: fetchReturning(Buffer.alloc(0), 200, 'audio/ogg'),
            allowUrl: () => true
        }),
        (error) => error.code === 'empty_media'
    );
    await assert.rejects(
        downloadInboundMedia({
            url: 'https://provider.test/large',
            declaredMime: 'audio/ogg',
            expectedType: 'audio',
            maxBytes: 4,
            fetchImpl: fetchReturning(OGG_OPUS, 200, 'audio/ogg', { 'content-length': String(OGG_OPUS.length) }),
            allowUrl: () => true
        }),
        (error) => error.code === 'media_too_large'
    );
    await assert.rejects(
        downloadInboundMedia({
            url: 'https://provider.test/redirect',
            declaredMime: 'audio/ogg',
            expectedType: 'audio',
            fetchImpl: fetchReturning('', 302, 'text/plain', { location: 'http://127.0.0.1/private' }),
            allowUrl: (url) => url.startsWith('https://provider.test/')
        }),
        (error) => error.code === 'provider_redirect_not_allowed'
    );
    await assert.rejects(
        downloadInboundMedia({ url: 'notaurl', fetchImpl: fetchReturning(OGG_OPUS, 200, 'audio/ogg') }),
        (error) => error.code === 'provider_url_not_allowed'
    );
});

test('raiz de produção é compartilhada entre releases e raiz local permanece isolada', () => {
    assert.equal(
        inboundMediaStorageRoot({}, '/opt/vitalismen-automacao/releases/20260821T000000Z_candidate'),
        '/opt/vitalismen-automacao/shared/media/inbound'
    );
    assert.match(inboundMediaStorageRoot({}, '/tmp/vitalismen-candidate'), /\.runtime\/media\/inbound$/);
});
