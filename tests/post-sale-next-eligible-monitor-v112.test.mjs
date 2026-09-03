import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
    buildPostSaleNextEligibleReportV112,
    latestRealPostSaleStageV112,
    postSaleActionForShipmentV112,
    postSaleNextEligibleCandidateQueryV112
} from '../src/services/postSaleNextEligibleMonitorV112Service.js';

const shipment = (overrides = {}) => ({
    orderId: 'EC-V112-TEST',
    country: 'EC',
    client: { phone: '593999999999' },
    logistics: { status: 'ENTREGADO', trackingNumber: '123456789' },
    outcomes: { delivered: true },
    automation: { postSaleSafetyLedger: {} },
    ...overrides
});

test('V112 consulta todos os ramos atuais sem pré-remover human ou cooldown', () => {
    const query = postSaleNextEligibleCandidateQueryV112();
    assert.equal(query.country, 'EC');
    assert.equal(query.$or.length, 5);
    assert.equal(query['review.manualOnly'], undefined);
    assert.equal(query.$and, undefined);
});

test('V112 conserva a mesma prioridade de ação do dispatcher V108', () => {
    assert.equal(postSaleActionForShipmentV112(shipment()), 'delivered_bonus');
    assert.equal(postSaleActionForShipmentV112(shipment({
        logistics: { status: 'EN_RUTA', trackingNumber: '123456789' },
        outcomes: {}
    })), 'guide');
});

test('V112 relata a etapa terminal posterior do ledger como evidência real mais nova', () => {
    assert.equal(latestRealPostSaleStageV112(shipment({
        logistics: { status: 'EN_RUTA', trackingNumber: '123456789' },
        outcomes: {},
        automation: {
            postSaleSafetyLedger: {
                READY_FOR_PICKUP: { stage: 'READY_FOR_PICKUP', state: 'RECOVERED_MANUAL' }
            }
        }
    })), 'READY_FOR_PICKUP');
});

test('V112 só declara SHOULD_SEND quando decisão, cooldown e guards permitem', async () => {
    const rows = [
        shipment({ orderId: 'EC-ELIGIBLE' }),
        shipment({ orderId: 'EC-HUMAN' }),
        shipment({ orderId: 'EC-COOLDOWN', automation: { postSaleSafetyLedger: {}, lastReminderAt: new Date('2026-09-03T13:50:00.000Z') } })
    ];
    const now = new Date('2026-09-03T14:00:00.000Z');
    const decide = async ({ shipment: item }) => ({
        decision: item.orderId === 'EC-HUMAN' ? 'MANUAL_REVIEW_REQUIRED' : 'SHOULD_SEND',
        reason: item.orderId === 'EC-HUMAN' ? 'human_mode_manual' : 'eligible_dry_run',
        stage: 'PICKUP_BONUS',
        idempotencyKey: ''
    });
    const findHuman = async ({ shipment: item }) => item.orderId === 'EC-HUMAN' ? { _id: 'manual' } : null;
    const report = await buildPostSaleNextEligibleReportV112({
        shipments: rows,
        decidePostSaleNotification: decide,
        findManualHumanModeForShipment: findHuman,
        now
    });
    assert.equal(report.POSTSALE_CANDIDATES, 3);
    assert.equal(report.POSTSALE_ELIGIBLE, 1);
    assert.equal(report.FIRST_ELIGIBLE_ORDER, 'EC-ELIGIBLE');
    assert.deepEqual(report.ITEMS.map((item) => item.DECISION), ['SHOULD_SEND', 'BLOCK_HUMAN', 'BLOCK_COOLDOWN']);
    assert.equal(report.PROVIDER_CALLS, 0);
    assert.equal(report.MONGO_MUTATIONS, 0);
});

test('V112 ops delega o único envio ao control plane V105 e nunca promove lote', () => {
    const source = fs.readFileSync('ops/post-sale-next-eligible-v112', 'utf8');
    assert.match(source, /npm run senior:check/);
    assert.match(source, /post-sale-v105" authorize/);
    assert.match(source, /post-sale-v105" activate/);
    assert.match(source, /post-sale-v105" batch-plan/);
    assert.match(source, /post-sale-v105" batch-run/);
    assert.match(source, /post-sale-v105" contain/);
    assert.match(source, /"sent": 1/);
    assert.doesNotMatch(source, /BATCH_MAX=3|BATCH_MAX=5|DAILY_LIMIT=3|DAILY_LIMIT=5/);
});
