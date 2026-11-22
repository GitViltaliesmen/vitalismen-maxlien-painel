import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createTexMeasurementV243, texMeasurementDisplayCodeV258 } from '../src/services/texUltraMeasurementV243Service.js';

const at = Date.parse('2026-11-22T03:00:00Z');
const reference = 'TX243-' + 'a'.repeat(64);
const code = 'VID-1A2B3C4D';
const body = `Hola, quiero el tratamiento Tex Ultra.\nVi Tex Ultra en el video y deseo el tratamiento.\nRef: ${code}`;

test('short code requires a persisted official inbound, resolves once, and leaves the bot message intact', async t => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tex258-'));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    const sent = [], writes = [], resolved = [];
    let persisted = { body, timestamp: at / 1000 };
    const state = {
        phoneDigits: '593999000001', metadata: { productKey: 'tex_ultra_ec', existing: true },
        updateOne: async value => writes.push(value)
    };
    const capability = {
        isCurrent: () => true, directory, key: 'c'.repeat(64),
        ownerPhone: '5531971862958', officialPhone: '553171862958',
        activatedAt: new Date(at - 60000).toISOString()
    };
    const service = createTexMeasurementV243({
        capability: () => capability, now: () => at,
        context: async () => ({ method: 'POST', writeContext: true, path: '/api/zapi/webhook' }),
        findInbound: async () => persisted,
        resolveCode: async value => { resolved.push(value); return reference; },
        post: async proof => { sent.push(proof); return { ok: true, verified: true, datasetId: '1100892582698669' }; }
    });
    const input = { state, inboundText: body, sourceMessageId: 'real-inbound-id', sessionId: 'zapi' };
    assert.equal(texMeasurementDisplayCodeV258(body), code);
    persisted = { body: 'different', timestamp: at / 1000 };
    assert.equal(await service.observe(input), null);
    assert.equal(sent.length, 0);
    persisted = { body, timestamp: at / 1000 };
    assert.equal((await service.observe(input)).ok, true);
    assert.equal((await service.observe(input)).duplicate, true);
    assert.deepEqual(resolved, [code, code]);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].reference, reference);
    assert.equal(writes.length, 2);
    assert.equal(state.metadata.existing, true);
    assert.equal(texMeasurementDisplayCodeV258(body + '\ncomprar'), '');
});
