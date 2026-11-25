import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { runPostSaleLinkedV270Controller } from '../scripts/post-sale-linked-v270-controller.mjs';

const secret = 'a'.repeat(64);
const nonce = 'b'.repeat(32);
const now = 1795543200000;

test('controller signs one local request and accepts bounded receipt', async () => {
    let calls = 0;
    const report = await runPostSaleLinkedV270Controller({ mode: 'dry-run', secret, nonce, now,
        request: async (url, options) => {
            calls++;
            assert.equal(url, 'http://127.0.0.1:3001/api/shipments/internal/post-sale-v270/cycle');
            const body = JSON.parse(options.body);
            const expected = crypto.createHmac('sha256', secret)
                .update(`${now}.${nonce}.dry-run`).digest('hex');
            assert.equal(options.headers['x-postsale-v270-signature'], expected);
            assert.deepEqual(body, { issuedAt: now, mode: 'dry-run', nonce });
            return { ok: true, status: 200, json: async () => ({ ok: true,
                report: { mode: 'dry-run', physicalOutboundCount: 0 } }) };
        }
    });
    assert.equal(report.physicalOutboundCount, 0);
    assert.equal(calls, 1);
});

test('controller rejects bad receipts and never retries', async () => {
    let calls = 0;
    await assert.rejects(runPostSaleLinkedV270Controller({ mode: 'run', secret, nonce, now,
        request: async () => {
            calls++;
            return { ok: true, status: 200, json: async () => ({ ok: true,
                report: { mode: 'run', physicalOutboundCount: 2 } }) };
        }
    }), /cycle_rejected/);
    assert.equal(calls, 1);
});

test('controller requires a linked-device message ID for a live send', async () => {
    let calls = 0;
    await assert.rejects(runPostSaleLinkedV270Controller({ mode: 'run', secret, nonce, now,
        request: async () => {
            calls++;
            return { ok: true, status: 200, json: async () => ({ ok: true,
                report: { mode: 'run', physicalOutboundCount: 1, providerMessageId: '' } }) };
        }
    }), /cycle_rejected/);
    assert.equal(calls, 1);
});

test('controller rejects a provider receipt from the retired transport', async () => {
    await assert.rejects(runPostSaleLinkedV270Controller({ mode: 'run', secret, nonce, now,
        request: async () => ({ ok: true, status: 200, json: async () => ({ ok: true,
            report: { mode: 'run', physicalOutboundCount: 1,
                provider: 'zapi', providerMessageId: 'legacy-id' } }) })
    }), /cycle_rejected/);
});

test('controller refuses unknown mode or missing secret before network', async () => {
    await assert.rejects(runPostSaleLinkedV270Controller({ mode: 'force', secret }), /mode_invalid/);
    await assert.rejects(runPostSaleLinkedV270Controller({ mode: 'run', secret: '' }), /secret_missing/);
});
