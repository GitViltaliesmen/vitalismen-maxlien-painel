import test from 'node:test';
import assert from 'node:assert/strict';
import { runPostSaleLinkedV270 } from '../src/services/postSaleLinkedV270Service.js';

const now = new Date('2026-11-24T18:00:00Z');
const forwardOnlySince = '2026-11-15T19:01:36.129Z';

test('dry-run plans logistics and delivered stages without provider sends', async () => {
    const calls = [];
    const report = await runPostSaleLinkedV270({ dryRun: true, now, forwardOnlySince,
        transportReady: () => true,
        dropi: async ({ dryRun }) => { calls.push(['dropi', dryRun]); return { applied: 0 }; },
        logistics: async ({ dryRun, allowedActions }) => {
            calls.push(['logistics', dryRun, allowedActions]);
            return { candidates: 0, selected: 0, sent: 0 };
        },
        delivered: async ({ dryRun, notifyFns }) => {
            calls.push(['delivered', dryRun, Object.keys(notifyFns)]);
            return { candidates: 1, ready: 1, sent: 0 };
        }
    });
    assert.equal(report.physicalOutboundCount, 0);
    assert.deepEqual(report.stages.map(item => item.name), ['logistics', 'delivered']);
    assert.deepEqual(calls[2][2].sort(), ['DELIVERED_THANK_YOU', 'PICKUP_BONUS', 'PRODUCT_USAGE']);
});

test('live run stops after one linked-device delivery receipt', async () => {
    const prior = process.env.POST_SALE_V270_RUNTIME_ACTIVE;
    process.env.POST_SALE_V270_RUNTIME_ACTIVE = 'true';
    try {
        const report = await runPostSaleLinkedV270({ dryRun: false, now, forwardOnlySince,
            transportReady: () => true,
            dropi: async () => ({ applied: 0 }),
            logistics: async () => ({ candidates: 0, selected: 0, sent: 0 }),
            delivered: async () => ({ candidates: 1, ready: 1, sent: 1,
                provider: 'baileys', providerMessageId: 'linked-receipt-1' })
        });
        assert.equal(report.selected, 'delivered');
        assert.equal(report.physicalOutboundCount, 1);
        assert.equal(report.provider, 'baileys');
        assert.equal(report.providerMessageId, 'linked-receipt-1');
    } finally {
        if (prior === undefined) delete process.env.POST_SALE_V270_RUNTIME_ACTIVE;
        else process.env.POST_SALE_V270_RUNTIME_ACTIVE = prior;
    }
});
