import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { authorizePostSaleLinkedV270 } from '../src/services/postSaleLinkedV270Auth.js';

const secret = 'a'.repeat(64);
const commit = 'b'.repeat(40);
const now = 1795543200000;
let nonceIndex = 0;
const request = (changes = {}) => {
    const body = { issuedAt: now, mode: 'dry-run', nonce: (++nonceIndex).toString(16).padStart(32, '0') };
    const req = { body, socket: { remoteAddress: '127.0.0.1' }, headers: {} };
    Object.assign(req, changes);
    req.headers['x-postsale-v270-signature'] = crypto.createHmac('sha256', secret)
        .update(`${req.body.issuedAt}.${req.body.nonce}.${req.body.mode}`).digest('hex');
    return req;
};

test.before(() => {
    process.env.POST_SALE_V270_HMAC_SECRET = secret;
    process.env.POST_SALE_V270_COMMIT = commit;
    globalThis.__VITALISMEN_SEALED_SUCCESSOR_CONTEXT = { commit };
});

test.after(() => {
    delete process.env.POST_SALE_V270_HMAC_SECRET;
    delete process.env.POST_SALE_V270_COMMIT;
    delete globalThis.__VITALISMEN_SEALED_SUCCESSOR_CONTEXT;
});

test('signed loopback request succeeds once and replay fails', () => {
    const req = request();
    assert.equal(authorizePostSaleLinkedV270(req, now), true);
    assert.equal(authorizePostSaleLinkedV270(req, now), false);
});

test('forged or forwarded request fails', () => {
    assert.equal(authorizePostSaleLinkedV270(request({ socket: { remoteAddress: '203.0.113.7' } }), now), false);
    assert.equal(authorizePostSaleLinkedV270(request({ headers: { 'x-forwarded-for': '127.0.0.1' } }), now), false);
});

test('extra action, stale timestamp, and changed mode fail', () => {
    const extra = request();
    extra.body.force = true;
    assert.equal(authorizePostSaleLinkedV270(extra, now), false);
    const stale = request();
    assert.equal(authorizePostSaleLinkedV270(stale, now + 30_001), false);
    const forged = request();
    forged.body.mode = 'run';
    assert.equal(authorizePostSaleLinkedV270(forged, now), false);
});

test('seal commit mismatch fails', () => {
    const req = request();
    globalThis.__VITALISMEN_SEALED_SUCCESSOR_CONTEXT = { commit: 'c'.repeat(40) };
    assert.equal(authorizePostSaleLinkedV270(req, now), false);
    globalThis.__VITALISMEN_SEALED_SUCCESSOR_CONTEXT = { commit };
});
