import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/services/postSaleForwardOnlyV194Service.js', import.meta.url), 'utf8');
const start = source.indexOf('export const processForwardLogisticsStageV194 = async (');
const end = source.indexOf('\nexport default processForwardLogisticsStageV194;', start);
assert.ok(start >= 0 && end > start);
const body = source.slice(start, end)
    .replace('export const processForwardLogisticsStageV194', 'const processForwardLogisticsStageV194');

test('perfil limitado consulta somente guia, trânsito e retirada', async () => {
    const queried = [];
    const model = {
        find(query) {
            queried.push(query.actionMarker);
            return { sort: () => ({ limit: async () => [] }) };
        }
    };
    const sandbox = {
        LOGISTICS_ACTIONS: ['guide', 'in_transit', 'ready_for_pickup', 'returned']
            .map((action) => ({ action, query: { actionMarker: action } })),
        asDate: (value) => new Date(value),
        Shipment: model,
        notifyShipmentGuideGenerated: () => {},
        notifyShipmentInTransit: () => {},
        notifyReadyForPickup: () => {},
        notifyShipmentReturned: () => {}
    };
    vm.runInNewContext(`${body}\nglobalThis.process = processForwardLogisticsStageV194;`, sandbox);
    const report = await sandbox.process({
        forwardOnlySince: new Date('2026-11-15T00:00:00Z'),
        shipmentModel: model,
        allowedActions: ['guide', 'in_transit', 'ready_for_pickup'],
        dryRun: true
    });
    assert.deepEqual(queried, ['guide', 'in_transit', 'ready_for_pickup']);
    assert.equal(report.sent, 0);
});

test('envio real exige perfil V263 e não chama outras etapas', () => {
    const executor = fs.readFileSync(new URL('../scripts/post-sale-full-v188.mjs', import.meta.url), 'utf8');
    const overlay = fs.readFileSync(new URL('../scripts/create-post-sale-v188-overlay.mjs', import.meta.url), 'utf8');
    assert.match(overlay, /POST_SALE_V263_ALLOWED_STAGES: 'guide,in_transit,ready_for_pickup'/);
    assert.match(executor, /action === 'run' && !limitedScope/);
    for (const stage of ['reminders', 'delivered', 'refill', 'customerInvites']) {
        assert.match(executor, new RegExp(`if \\(\\!limitedScope && outboundCount === 0\\) \\{\\s+${stage} =`));
    }
    assert.match(executor, /const proof = limitedScope \? null/);
    assert.match(executor, /const carrierPolling = limitedScope \? null/);
});
