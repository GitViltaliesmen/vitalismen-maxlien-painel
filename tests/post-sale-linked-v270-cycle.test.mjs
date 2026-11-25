import test from 'node:test';
import assert from 'node:assert/strict';
import { executePostSaleLinkedV270Cycle } from '../src/services/postSaleLinkedV270Cycle.js';

const base = ({ dryRun = true, stages, ready = true, open = true } = {}) => ({
    dryRun,
    now: new Date('2026-11-24T18:00:00Z'),
    forwardOnlySince: '2026-11-15T19:01:36.129Z',
    transportReady: () => ready,
    windowOpen: () => open,
    reconcile: async () => ({ candidates: 1 }),
    stages: stages || [{ name: 'guide', run: async () => ({ candidates: 1, selected: 1, sent: 0 }) }]
});

test('dry-run shows candidate and performs zero outbound', async () => {
    const report = await executePostSaleLinkedV270Cycle(base());
    assert.equal(report.mode, 'dry-run');
    assert.equal(report.stages[0].ready, 1);
    assert.equal(report.physicalOutboundCount, 0);
});

test('live run stops immediately after one send', async () => {
    let second = 0;
    const report = await executePostSaleLinkedV270Cycle(base({ dryRun: false, stages: [
        { name: 'guide', run: async () => ({ sent: 1 }) },
        { name: 'bonus', run: async () => { second++; return { sent: 1 }; } }
    ] }));
    assert.equal(report.selected, 'guide');
    assert.equal(report.physicalOutboundCount, 1);
    assert.equal(second, 0);
});

test('closed window blocks reconciliation and outbound', async () => {
    let touched = 0;
    const plan = base({ dryRun: false, open: false });
    plan.reconcile = async () => { touched++; };
    plan.stages[0].run = async () => { touched++; };
    const report = await executePostSaleLinkedV270Cycle(plan);
    assert.equal(report.physicalOutboundCount, 0);
    assert.equal(touched, 0);
});

test('disconnected transport and invalid cutoff fail closed', async () => {
    await assert.rejects(executePostSaleLinkedV270Cycle(base({ ready: false })), /not_ready/);
    await assert.rejects(executePostSaleLinkedV270Cycle({ ...base(), forwardOnlySince: 'invalid' }), /cutoff_invalid/);
});

test('dry-run refuses an accidental physical send', async () => {
    await assert.rejects(executePostSaleLinkedV270Cycle(base({ stages: [
        { name: 'fault', run: async () => ({ sent: 1 }) }
    ] })), /dry_run_sent/);
});

test('concurrent cycle is refused and released after completion', async () => {
    let release;
    const blocked = new Promise(resolve => { release = resolve; });
    const first = executePostSaleLinkedV270Cycle(base({ stages: [
        { name: 'wait', run: async () => { await blocked; return { sent: 0 }; } }
    ] }));
    await assert.rejects(executePostSaleLinkedV270Cycle(base()), /already_running/);
    release();
    await first;
    assert.equal((await executePostSaleLinkedV270Cycle(base())).physicalOutboundCount, 0);
});

test('a stage reporting more than one send fails the cycle', async () => {
    await assert.rejects(executePostSaleLinkedV270Cycle(base({ dryRun: false, stages: [
        { name: 'fault', run: async () => ({ sent: 2 }) }
    ] })), /outbound_limit_exceeded/);
});
