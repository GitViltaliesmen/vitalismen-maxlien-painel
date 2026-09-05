import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import express from 'express';
import { once } from 'node:events';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';
import { manualUploadsDirV129, remoteMediaCacheDirV129, manualUploadPathFromUrlV129, manualUploadUrlFromPathV129, relocatedRemoteCacheFileV129 } from '../src/services/manualMediaStorageV129Service.js';
import { calculateFunctionalPayloadSha256V78 } from '../src/services/mutableRuntimeArtifactV78Service.js';
import { assertManualMediaStorageV129 } from '../scripts/guard-manual-media-storage-v129.mjs';

const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const fixture = t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'v129-storage-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const productionRoot = path.join(root, 'official');
    const cwd = path.join(productionRoot, 'releases', 'candidate');
    fs.mkdirSync(cwd, { recursive: true });
    fs.writeFileSync(path.join(cwd, 'published.txt'), 'immutable');
    return { cwd, productionRoot };
};

test('storage roots reuse shared/media and shared/runtime independently of release', t => {
    const options = fixture(t);
    const next = { ...options, cwd: path.join(options.productionRoot, 'releases', 'next') };
    assert.equal(manualUploadsDirV129(options), path.join(options.productionRoot, 'shared/media/uploads'));
    assert.equal(remoteMediaCacheDirV129(options), path.join(options.productionRoot, 'shared/runtime/remote-media-cache'));
    assert.equal(manualUploadsDirV129(options), manualUploadsDirV129(next));
    assert.equal(remoteMediaCacheDirV129(options), remoteMediaCacheDirV129(next));
    assert.notEqual(manualUploadsDirV129(options), remoteMediaCacheDirV129(options));
    assert.equal(manualUploadPathFromUrlV129('/media/uploads/%2e%2e%2fsecret', options), '');
    assert.equal(manualUploadPathFromUrlV129('/media/uploads/%5csecret', options), '');
});

test('manual audio executes the production data-URL branch and never writes to release', async t => {
    const options = fixture(t);
    const before = calculateFunctionalPayloadSha256V78(options.cwd);
    const bytes = Buffer.from('ID3-controlled-storage-fixture');
    const source = read('src/routes/whatsapp.js');
    const start = source.indexOf("            if (message.startsWith('data:')) {");
    const end = source.indexOf('            const normalizedMediaMessage', start);
    assert.ok(start > 0 && end > start);
    const sent = [], recorded = [];
    const deps = {
        message: `data:audio/mpeg;base64,${bytes.toString('base64')}`, fileName: 'qa.mp3', path, fs, crypto,
        manualUploadsDirV129: () => manualUploadsDirV129(options), phone: '5515998038637', effectiveSessionId: 'zapi', sendMode: 'manual_panel', allowAudioDedupeBypass: false, country: 'EC',
        sendWhatsAppMessage: async (phone, file, opts) => { sent.push({ phone, file, opts }); return { ok: true, provider: 'zapi', providerMessageId: 'fixture-storage-echo' }; },
        findOrCreateContactState: async () => ({ save: async () => {} }), applyManualSendHold: () => {},
        recordManualOutboundMessage: async args => { recorded.push(args); return { _id: 'fixture-message' }; },
        zapiOperationalPanelPhone: () => '5515991418416', req: { user: { _id: 'fixture-human' }, body: { clientGeneratedId: 'fixture-storage' } },
        clientGeneratedId: 'fixture-storage',
        res: { status() { return this; }, json(body) { this.body = body; return this; } }
    };
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    await new AsyncFunction(...Object.keys(deps), source.slice(start, end))(...Object.values(deps));
    assert.equal(sent.length, 1);
    assert.equal(sent[0].opts.sendMode, 'manual_panel');
    assert.ok(sent[0].file.startsWith(manualUploadsDirV129(options) + path.sep));
    assert.deepEqual(fs.readFileSync(sent[0].file), bytes);
    assert.equal(recorded.length, 1);
    assert.equal(recorded[0].providerMessageId, 'fixture-storage-echo');
    assert.equal(recorded[0].mediaUrl, '/media/uploads/' + path.basename(sent[0].file));
    assert.equal(calculateFunctionalPayloadSha256V78(options.cwd), before);
});

test('manual text executes unchanged route branch without creating media or cache files', async t => {
    const options = fixture(t);
    const before = calculateFunctionalPayloadSha256V78(options.cwd);
    const source = read('src/routes/whatsapp.js');
    const start = source.indexOf('        const quotedMessage = quotedMessageId', source.indexOf("router.post('/send'"));
    const end = source.indexOf('    } catch (error) {', start);
    const sent = [], recorded = [];
    const deps = {
        quotedMessageId: '', buildQuotedMessageFromRecord: () => null,
        phone: '5515998038637', message: 'QA storage text fixture', effectiveSessionId: 'zapi',
        sendMode: 'manual_panel', allowAudioDedupeBypass: false, country: 'EC', forceZapiManualTest: false,
        clientGeneratedId: 'fixture-text', req: { user: { _id: 'fixture-human' } },
        sendWhatsAppMessage: async (phone, message, opts) => { sent.push({ phone, message, opts }); return { ok: true, provider: 'zapi', providerMessageId: 'fixture-text' }; },
        findOrCreateContactState: async () => ({ save: async () => {} }), applyManualSendHold: () => {},
        recordManualOutboundMessage: async args => { recorded.push(args); return { _id: 'fixture-text' }; },
        zapiOperationalPanelPhone: () => '5515991418416', res: { json(body) { this.body = body; } },
        fs: new Proxy({}, { get: () => () => assert.fail('text branch must not write files') })
    };
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    await new AsyncFunction(...Object.keys(deps), 'let storedMessageRecordId;\n' + source.slice(start, end))(...Object.values(deps));
    assert.equal(sent.length, 1);
    assert.equal(recorded.length, 1);
    assert.equal(recorded[0].type, 'chat');
    assert.equal(sent[0].opts.outboundContext, 'manual_panel_text');
    assert.equal(fs.existsSync(manualUploadsDirV129(options)), false);
    assert.equal(fs.existsSync(remoteMediaCacheDirV129(options)), false);
    assert.equal(calculateFunctionalPayloadSha256V78(options.cwd), before);
});

test('old/new media keep HTTP URL, MIME, Range and bytes through refresh, restart and next release', async t => {
    const options = fixture(t);
    const before = calculateFunctionalPayloadSha256V78(options.cwd);
    const name = '1788566698625_ab9c67071f17.mp3';
    const bytes = Buffer.from('ID3-persistent-qa-bytes');
    fs.mkdirSync(manualUploadsDirV129(options), { recursive: true });
    const file = path.join(manualUploadsDirV129(options), name);
    fs.writeFileSync(file, bytes);
    const url = '/media/uploads/' + name;
    assert.equal(manualUploadPathFromUrlV129(url, options), file);
    assert.equal(manualUploadUrlFromPathV129(file, options), url);
    for (const release of ['candidate', 'next', 'rollback']) {
        const app = express();
        app.use('/media/uploads', express.static(manualUploadsDirV129({ ...options, cwd: path.join(options.productionRoot, 'releases', release) })));
        const server = app.listen(0, '127.0.0.1');
        await once(server, 'listening');
        try {
            const endpoint = `http://127.0.0.1:${server.address().port}${url}`;
            for (let refresh = 0; refresh < 2; refresh++) {
                const res = await fetch(endpoint);
                assert.equal(res.status, 200);
                assert.match(res.headers.get('content-type'), /^audio\/mpeg/);
                assert.deepEqual(Buffer.from(await res.arrayBuffer()), bytes);
            }
            const range = await fetch(endpoint, { headers: { Range: 'bytes=0-2' } });
            assert.equal(range.status, 206);
            assert.deepEqual(Buffer.from(await range.arrayBuffer()), bytes.subarray(0, 3));
        } finally { await new Promise(resolve => server.close(resolve)); }
    }
    assert.equal(calculateFunctionalPayloadSha256V78(options.cwd), before);
});

test('legacy cache metadata resolves external bytes without changing JSON or needing old release', t => {
    const options = fixture(t);
    const name = 'a'.repeat(64) + '.webp';
    const metadata = { filePath: '/removed-release/public/media/remote-cache/' + name, contentType: 'image/webp', cachedAt: '2026-09-05T00:06:16Z' };
    const original = JSON.stringify(metadata);
    const before = calculateFunctionalPayloadSha256V78(options.cwd);
    fs.mkdirSync(remoteMediaCacheDirV129(options), { recursive: true });
    fs.writeFileSync(path.join(remoteMediaCacheDirV129(options), name), 'cache-bytes');
    assert.equal(relocatedRemoteCacheFileV129(metadata, options), path.join(remoteMediaCacheDirV129(options), name));
    assert.equal(JSON.stringify(metadata), original);
    assert.equal(relocatedRemoteCacheFileV129({ filePath: '../../secret' }, options), '');
    fs.rmSync(path.join(remoteMediaCacheDirV129(options), name));
    assert.equal(relocatedRemoteCacheFileV129(metadata, options), '');
    assert.equal(calculateFunctionalPayloadSha256V78(options.cwd), before);
});

test('real cache handler writes externally and reuses the cached body without upstream dependency', async t => {
    const options = fixture(t);
    const before = calculateFunctionalPayloadSha256V78(options.cwd);
    const source = read('src/routes/whatsapp.js');
    const begin = source.indexOf("router.get('/media-proxy',");
    const end = source.indexOf("router.get('/media/:messageId'", begin);
    let handler, upstreamCalls = 0;
    const writers = [];
    const bytes = Buffer.from('image-fixture-bytes');
    const cachePaths = () => ({ dir: remoteMediaCacheDirV129(options), metaPath: path.join(remoteMediaCacheDirV129(options), 'a'.repeat(64) + '.json'), filePath: path.join(remoteMediaCacheDirV129(options), 'a'.repeat(64) + '.webp') });
    const deps = {
        router: { get: (_path, fn) => { handler = fn; } },
        fs: { ...fs, createWriteStream: (...args) => { const stream = fs.createWriteStream(...args); writers.push(stream); return stream; } },
        isAllowedRemoteMediaUrl: () => true, remoteMediaCachePaths: cachePaths,
        relocatedRemoteCacheFileV129: meta => relocatedRemoteCacheFileV129(meta, options),
        serveLocalMediaFile: (_req, res, file, mime) => res.type(mime).send(fs.readFileSync(file)),
        axios: { get: async () => { upstreamCalls++; return { status: 200, headers: { 'content-type': 'image/webp', 'content-length': bytes.length }, data: Readable.from([bytes]) }; } }
    };
    new Function(...Object.keys(deps), source.slice(begin, end))(...Object.values(deps));
    const app = express();
    app.get('/proxy', handler);
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    try {
        const endpoint = `http://127.0.0.1:${server.address().port}/proxy?url=https://media.z-api.io/fixture.webp`;
        const first = await fetch(endpoint);
        assert.equal(first.status, 200);
        assert.deepEqual(Buffer.from(await first.arrayBuffer()), bytes);
        await Promise.all(writers.map(stream => finished(stream)));
        const second = await fetch(endpoint);
        assert.equal(second.status, 200);
        assert.deepEqual(Buffer.from(await second.arrayBuffer()), bytes);
        assert.equal(upstreamCalls, 1);
        assert.equal(JSON.parse(fs.readFileSync(cachePaths().metaPath)).filePath, cachePaths().filePath);
        assert.equal(calculateFunctionalPayloadSha256V78(options.cwd), before);
    } finally { await new Promise(resolve => server.close(resolve)); }
});

test('publication manifest protects storage, inherited read state, auth and provider parser', () => {
    const manifest = assertManualMediaStorageV129();
    for (const file of ['src/routes/zapi.js', 'src/services/panelReadStateService.js', 'public/qr.html', 'src/services/zapiOutboundMirrorService.js']) assert.ok(manifest.protectedFiles[file]);
    // Only storage imports/mounts changed in index; auth/rate limit bytes are still the approved baseline.
    const originalIndex = read('src/index.js')
        .replace("import { manualUploadsDirV129, remoteMediaCacheDirV129 } from './services/manualMediaStorageV129Service.js';\n", '')
        .replace("app.use('/media/uploads', express.static(manualUploadsDirV129(), {\n    setHeaders: (res) => res.set(noStoreHeaders)\n}));\napp.use('/media/remote-cache', express.static(remoteMediaCacheDirV129(), {\n    setHeaders: (res) => res.set(noStoreHeaders)\n}));\n", '');
    assert.equal(hash(originalIndex), '48f7e5ee9d97e6fc8fe6e0d928a2f6645801a355d74c62bf9baf04b208f3f27b');
});
