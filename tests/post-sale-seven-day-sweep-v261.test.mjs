import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/services/shipmentStatusDispatcherService.js', import.meta.url), 'utf8');
const pure = source.slice(source.indexOf('export const carrierStatusSweepQuery'),
    source.indexOf('export const countCarrierStatusSweepCandidates'))
    .replace('export const ', 'const ')
    + '\nglobalThis.query = carrierStatusSweepQuery;';
const sandbox = {
    DAY_MS: 86_400_000,
    CARRIER_SWEEP_FINAL_STATUSES: [],
    carrierStatusSweepMaxAgeDays: () => 30,
    carrierStatusSweepIntervalMinutes: () => 60,
    carrierStatusSweepMinGapMinutes: () => 60,
    buildCanaryV75RecipientQuery: () => ({})
};
vm.runInNewContext(pure, sandbox);

test('limita a reconciliação retroativa à data de criação definida', () => {
    const since = new Date('2026-11-15T00:00:00Z');
    const query = sandbox.query({ createdSince: since });
    assert.equal(query.country, 'EC');
    assert.equal(new Date(query.createdAt.$gte).toISOString(), since.toISOString());
    assert.equal('createdAt' in sandbox.query({}), false);
    assert.throws(() => sandbox.query({ createdSince: 'inválido' }), /carrier_status_sweep_created_since_invalid/);
});
