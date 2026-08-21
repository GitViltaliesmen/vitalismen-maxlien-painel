import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import ffmpegStatic from 'ffmpeg-static';
import { normalizeZapiDeliveryStatus, zapiDeliveryStatusRank } from '../src/routes/zapi.js';
import { sendZapiAudio } from '../src/services/zapiClient.js';

const listen = (server) => new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const close = (server) => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));

test('outbound Z-API cobre MP3, OGG/Opus, aceite, rejeição, MIME, URL e arquivo ausente', async (t) => {
    const requests = [];
    const server = http.createServer((req, res) => {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => {
            const payload = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
            requests.push({ url: req.url, headers: req.headers, payload });
            if (payload.phone === '593999999999') {
                res.writeHead(422, { 'content-type': 'application/json' });
                res.end(JSON.stringify({ error: 'provider_rejected_audio' }));
                return;
            }
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ messageId: `provider-${requests.length}`, zaapId: `zaap-${requests.length}` }));
        });
    });
    await listen(server);
    t.after(() => close(server));

    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'vitalismen-zapi-audio-'));
    t.after(() => fs.promises.rm(tempDir, { recursive: true, force: true }));
    const mp3Path = path.resolve('public/media/templates/EC/OBRIGADO_PAGOU.mp3');
    const oggPath = path.resolve('public/media/templates/EC/OBRIGADO_PAGOU.ogg');
    const jpegPath = path.join(tempDir, 'wrong.jpg');
    await fs.promises.writeFile(jpegPath, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));

    const mp3Probe = spawnSync(ffmpegStatic, ['-hide_banner', '-v', 'error', '-t', '0.25', '-i', mp3Path, '-f', 'null', '-'], { encoding: 'utf8' });
    const oggProbe = spawnSync(ffmpegStatic, ['-hide_banner', '-t', '0.25', '-i', oggPath, '-f', 'null', '-'], { encoding: 'utf8' });
    assert.equal(mp3Probe.status, 0, mp3Probe.stderr);
    assert.equal(oggProbe.status, 0, oggProbe.stderr);
    assert.match(oggProbe.stderr, /Audio: opus.*48000 Hz, mono/i);

    const previous = {
        baseUrl: process.env.ZAPI_BASE_URL,
        instanceId: process.env.ZAPI_INSTANCE_ID,
        instanceToken: process.env.ZAPI_INSTANCE_TOKEN,
        clientToken: process.env.ZAPI_CLIENT_TOKEN
    };
    process.env.ZAPI_BASE_URL = `http://127.0.0.1:${server.address().port}`;
    process.env.ZAPI_INSTANCE_ID = 'instance-test';
    process.env.ZAPI_INSTANCE_TOKEN = 'instance-token-test';
    process.env.ZAPI_CLIENT_TOKEN = 'client-token-test';
    t.after(() => {
        if (previous.baseUrl === undefined) delete process.env.ZAPI_BASE_URL; else process.env.ZAPI_BASE_URL = previous.baseUrl;
        if (previous.instanceId === undefined) delete process.env.ZAPI_INSTANCE_ID; else process.env.ZAPI_INSTANCE_ID = previous.instanceId;
        if (previous.instanceToken === undefined) delete process.env.ZAPI_INSTANCE_TOKEN; else process.env.ZAPI_INSTANCE_TOKEN = previous.instanceToken;
        if (previous.clientToken === undefined) delete process.env.ZAPI_CLIENT_TOKEN; else process.env.ZAPI_CLIENT_TOKEN = previous.clientToken;
    });

    const mp3 = await sendZapiAudio({ phone: '+593 98 111 1111', filePath: mp3Path, waveform: true });
    const ogg = await sendZapiAudio({ phone: '+593 98 222 2222', filePath: oggPath, waveform: true });
    assert.equal(mp3.messageId, 'provider-1');
    assert.equal(ogg.messageId, 'provider-2');
    assert.match(requests[0].url, /\/send-audio$/);
    assert.equal(requests[0].headers['client-token'], 'client-token-test');
    assert.match(requests[0].payload.audio, /^data:audio\/mpeg;base64,/);
    assert.match(requests[1].payload.audio, /^data:audio\/ogg;base64,/);
    assert.equal(requests[1].payload.waveform, true);
    assert.ok(Buffer.from(requests[1].payload.audio.split(',')[1], 'base64').length > 0);

    await assert.rejects(
        sendZapiAudio({ phone: '593999999999', filePath: oggPath }),
        (error) => error.response?.status === 422 && error.response?.data?.error === 'provider_rejected_audio'
    );
    await assert.rejects(
        sendZapiAudio({ phone: '593981111111', filePath: path.join(tempDir, 'missing.ogg') }),
        /zapi_media_file_not_found/
    );
    assert.throws(
        () => sendZapiAudio({ phone: '593981111111', filePath: jpegPath }),
        /zapi_media_mime_mismatch/
    );
    await assert.rejects(
        sendZapiAudio({ phone: '593981111111', media: 'http://insecure.example/audio.ogg' }),
        /zapi_media_url_invalid_or_insecure/
    );
    assert.throws(
        () => sendZapiAudio({ phone: '593981111111', media: 'not-a-valid-url' }),
        /zapi_media_mime_mismatch/
    );
});

test('callback entregue/lido tem precedência sobre queued e falha posterior não rebaixa estado confirmado', () => {
    const accepted = normalizeZapiDeliveryStatus({ status: 'queued' });
    const delivered = normalizeZapiDeliveryStatus({ status: 'deliveryCallback' });
    const read = normalizeZapiDeliveryStatus({ status: 'READ' });
    const failed = normalizeZapiDeliveryStatus({ status: 'failed', error: 'provider failure' });
    assert.deepEqual(accepted, { deliveryStatus: 'sent', providerStatus: 'queued', ack: 1, sendError: '' });
    assert.equal(delivered.deliveryStatus, 'delivered');
    assert.equal(delivered.ack, 2);
    assert.equal(read.deliveryStatus, 'read');
    assert.equal(read.ack, 3);
    assert.equal(failed.deliveryStatus, 'failed');
    assert.ok(zapiDeliveryStatusRank(read.deliveryStatus, read.ack) > zapiDeliveryStatusRank(delivered.deliveryStatus, delivered.ack));
    assert.ok(zapiDeliveryStatusRank(delivered.deliveryStatus, delivered.ack) > zapiDeliveryStatusRank(accepted.deliveryStatus, accepted.ack));
    assert.ok(zapiDeliveryStatusRank(delivered.deliveryStatus, delivered.ack) > zapiDeliveryStatusRank(failed.deliveryStatus, failed.ack));
});
