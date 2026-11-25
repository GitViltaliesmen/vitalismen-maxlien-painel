import test from 'node:test';
import assert from 'node:assert/strict';
import { postSaleRecentShipmentModelV270, runPostSaleLinkedV270 } from '../src/services/postSaleLinkedV270Service.js';

const now = new Date('2026-11-24T18:00:00Z');
const forwardOnlySince = '2026-11-15T19:01:36.129Z';

test('reconciliação retroativa limita pedidos aos últimos sete dias sem alterar escrita existente', () => {
    let query;
    const model = {
        find: value => { query = value; return 'query'; },
        findOneAndUpdate: () => 'lock',
        updateOne: () => 'update'
    };
    const scoped = postSaleRecentShipmentModelV270({ now, forwardOnlySince, model });
    assert.equal(scoped.find({ country: 'EC', 'review.manualOnly': { $ne: true } }), 'query');
    assert.equal(query.country, 'EC');
    assert.deepEqual(query['review.manualOnly'], { $ne: true });
    assert.equal(query.createdAt.$gte.toISOString(), '2026-11-17T18:00:00.000Z');
    assert.equal(scoped.findOneAndUpdate(), 'lock');
    assert.equal(scoped.updateOne(), 'update');
    const narrow = postSaleRecentShipmentModelV270({ now, forwardOnlySince: '2026-11-23T00:00:00Z', model });
    narrow.find({ country: 'EC' });
    assert.equal(query.createdAt.$gte.toISOString(), '2026-11-23T00:00:00.000Z');
});

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
