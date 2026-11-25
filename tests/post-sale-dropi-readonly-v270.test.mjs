import test from 'node:test';
import assert from 'node:assert/strict';
import { postSaleV270DropiReadAllowed } from '../src/services/postSaleDropiReadOnlyV270Service.js';

const commit = 'a'.repeat(40);
const root = '/opt/vitalismen-automacao/releases/v270-test';
const context = { postSaleV270: true, postSaleV270Mode: 'dry-run',
    writeContext: false, method: 'POST', path: '/api/shipments/internal/post-sale-v270/cycle' };
const env = { POST_SALE_V270_COMMIT: commit, POST_SALE_V270_RUNTIME_ACTIVE: 'false' };
const allowed = (changes = {}) => postSaleV270DropiReadAllowed({
    env, context, sealed: { commit, root }, current: root, ...changes
});

test('V270 permite leitura exata no dry-run autenticado e selado', () => {
    assert.equal(allowed(), true);
    assert.equal(allowed({ context: { ...context, postSaleV270: false } }), false);
    assert.equal(allowed({ context: { ...context, path: '/api/shipments/other' } }), false);
    assert.equal(allowed({ context: { ...context, method: 'GET' } }), false);
    assert.equal(allowed({ sealed: { commit: 'b'.repeat(40), root } }), false);
    assert.equal(allowed({ current: '/opt/vitalismen-automacao/releases/old' }), false);
});

test('V270 só permite leitura no ciclo real com runtime aprovado', () => {
    const live = { ...context, postSaleV270Mode: 'run', writeContext: true };
    assert.equal(allowed({ context: live }), false);
    assert.equal(allowed({ context: live, env: { ...env, POST_SALE_V270_RUNTIME_ACTIVE: 'true' } }), true);
    assert.equal(allowed({ context: { ...live, writeContext: false },
        env: { ...env, POST_SALE_V270_RUNTIME_ACTIVE: 'true' } }), false);
});
