import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/services/canaryControllerV77Service.js', import.meta.url), 'utf8');
const begin = source.indexOf('export const canaryControllerV77EnforcementRequired =');
const end = source.indexOf('export const canonicalCanaryControllerV77ProfilePayload =', begin);
const functionSource = source.slice(begin, end).replace('export const ', 'const ');
const run = ({ bot = false, v105 = false, v188 = false, operational = true } = {}) => {
    const sandbox = {
        resolveEcBotCoreV78Configuration: () => ({ enabled: bot, ready: bot }),
        resolvePostSaleTransactionalV105Configuration: () => ({ enabled: v105, ready: v105 }),
        resolvePostSaleFullOperationalV188Configuration: () => ({ enabled: true, ready: v188 }),
        CANARY_CONTROLLER_V77_FLAG: 'VITALISMEN_CANARY_CTRL_V77_ENABLED',
        OPERATIONAL_SENTINEL_FLAGS: ['SHIPMENT_STATUS_DISPATCH_ENABLED'],
        canaryControllerV77OperationalFlagsEnabled: (env) => env.SHIPMENT_STATUS_DISPATCH_ENABLED === 'true',
        isTrue: (value) => value === 'true',
        clean: String
    };
    vm.runInNewContext(`${functionSource}\nglobalThis.check = canaryControllerV77EnforcementRequired`, sandbox);
    return sandbox.check({ NODE_ENV: 'production', SHIPMENT_STATUS_DISPATCH_ENABLED: operational ? 'true' : 'false' });
};

test('V188 íntegro usa o pós-venda real sem ativar o canário QA', () => {
    assert.equal(run({ v188: true }), false);
});

test('V188 incompleto mantém a trava canário', () => {
    assert.equal(run({ v188: false }), true);
    assert.equal(run({ v188: false, operational: false }), false);
});
