import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const helperSource = fs.readFileSync('public/panel-intelligence/authenticated-media.js', 'utf8');
const panelSource = fs.readFileSync('public/qr.html', 'utf8');
const whatsappRouteSource = fs.readFileSync('src/routes/whatsapp.js', 'utf8');
const indexSource = fs.readFileSync('src/index.js', 'utf8');

const loadRuntime = ({ fetchImpl = async () => new Response('missing', { status: 404 }) } = {}) => {
    const window = {
        fetch: fetchImpl,
        location: { origin: 'https://ec.maxlien.shop' },
        URL: {
            createObjectURL(blob) {
                return `blob:test-${blob.size}`;
            }
        }
    };
    vm.runInNewContext(helperSource, { window, URL, Response, Blob }, { filename: 'authenticated-media.js' });
    return window.VitalismenAuthenticatedMedia;
};

test('runtime identifica endpoints protegidos sem colocar segredo na URL', () => {
    const runtime = loadRuntime();
    assert.equal(runtime.isProtectedMediaUrl('/api/whatsapp/media/wamid.1'), true);
    assert.equal(runtime.isProtectedMediaUrl('/api/whatsapp/media-proxy?url=https%3A%2F%2Fprovider.test%2Fa'), true);
    assert.equal(runtime.isProtectedMediaUrl('/media/templates/EC/audio.ogg'), false);
});

test('blob autenticado envia Bearer em header e preserva a URL sem token', async () => {
    const calls = [];
    const runtime = loadRuntime({
        fetchImpl: async (url, options) => {
            calls.push({ url, options });
            return new Response(new Blob(['audio-bytes'], { type: 'audio/ogg' }), {
                status: 200,
                headers: { 'content-type': 'audio/ogg' }
            });
        }
    });
    const result = await runtime.fetchObjectUrl('/api/whatsapp/media/wamid.1', { token: 'secret-panel-token' });
    assert.equal(result.objectUrl, 'blob:test-11');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, '/api/whatsapp/media/wamid.1');
    assert.equal(calls[0].options.headers.Authorization, 'Bearer secret-panel-token');
    assert.doesNotMatch(calls[0].url, /secret-panel-token|token=/i);
});

test('imagem autenticada também vira Blob local utilizável pelo link e pelo img', async () => {
    const runtime = loadRuntime({
        fetchImpl: async () => new Response(new Blob(['jpeg-bytes'], { type: 'image/jpeg' }), {
            status: 200,
            headers: { 'content-type': 'image/jpeg' }
        })
    });
    const result = await runtime.fetchObjectUrl('/api/whatsapp/media/wamid.image', { token: 'panel-token' });
    assert.equal(result.objectUrl, 'blob:test-10');
    assert.equal(result.contentType, 'image/jpeg');
    assert.equal(result.size, 10);
    assert.match(indexSource, /"img-src": \["'self'", "data:", "blob:", "https:"\]/);
    assert.match(indexSource, /"media-src": \["'self'", "data:", "blob:", "https:"\]/);
});

test('falha de provider tem motivo visível e específico para áudio e imagem', () => {
    const runtime = loadRuntime();
    assert.match(runtime.failureText({ kind: 'audio', status: 'FAILED', reason: 'provider_http_404' }), /Áudio indisponível.*expirou/);
    assert.match(runtime.failureText({ kind: 'image', status: 'FAILED', reason: 'mime_mismatch' }), /Imagem indisponível.*MIME real/);
    assert.match(runtime.failureText({ kind: 'audio', status: 'FETCHING' }), /sendo baixada/);
});

test('painel hidrata áudio, imagem e vídeo por blob autenticado e não cria player quebrado em FAILED', () => {
    assert.match(panelSource, /authenticated-media\.js/);
    assert.match(panelSource, /data-auth-media-src/);
    assert.match(panelSource, /hydrateAuthenticatedMedia\(box\)/);
    assert.match(panelSource, /mediaHealthBlocksRendering\(message\)/);
    assert.match(panelSource, /message\.mediaStorageStatus/);
    assert.match(panelSource, /message\.mediaDownloadError/);
    assert.match(panelSource, /VitalismenCleanChatV29\?\.presentMessages/);
    assert.doesNotMatch(panelSource, /mediaToken=|access_token=.*media|[?&]token=.*authMedia/i);
});

test('endpoint persistido continua atrás do authMiddleware e suporta Range pelo servidor local', () => {
    const authBarrier = whatsappRouteSource.indexOf('router.use(authMiddleware);');
    const mediaRoute = whatsappRouteSource.indexOf("router.get('/media/:messageId'");
    assert.ok(authBarrier > 0);
    assert.ok(mediaRoute > authBarrier);
    assert.match(whatsappRouteSource.slice(mediaRoute, mediaRoute + 1800), /serveLocalMediaFile/);
    assert.match(whatsappRouteSource.slice(mediaRoute, mediaRoute + 1800), /mediaStorageStatus !== 'READY'/);
    assert.match(whatsappRouteSource.slice(mediaRoute, mediaRoute + 1800), /X-Content-Type-Options/);
    assert.match(whatsappRouteSource, /const panelSafeProviderPayload/);
    const safePayloadBlock = whatsappRouteSource.slice(
        whatsappRouteSource.indexOf('const panelSafeProviderPayload'),
        whatsappRouteSource.indexOf('const enrichMessagesWithMedia')
    );
    assert.doesNotMatch(safePayloadBlock, /mediaUrl|imageUrl|audioUrl|downloadUrl|token/i);
});
