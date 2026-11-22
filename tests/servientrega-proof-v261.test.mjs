import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/services/carrierTrackingService.js', import.meta.url), 'utf8');
const pure = source.slice(source.indexOf('const cleanGuide ='), source.indexOf('export const trackServientregaGuide'))
    + '\nglobalThis.verify = verifiedServientregaResult;';
const sandbox = {};
vm.runInNewContext(pure, sandbox);

test('não considera a própria guia solicitada como confirmação da transportadora', () => {
    assert.equal(sandbox.verify({ guia: '', statusAtual: '' }, '12345678'), false);
    assert.equal(sandbox.verify({ guia: '', statusAtual: 'En agencia' }, '12345678'), false);
    assert.equal(sandbox.verify({ guia: '12345678', statusAtual: '' }, '12345678'), false);
    assert.equal(sandbox.verify({ guia: '87654321', statusAtual: 'En agencia' }, '12345678'), false);
    assert.equal(sandbox.verify({ guia: '12345678', statusAtual: 'En agencia' }, '12345678'), true);
});

test('HTTP 403 encerra a consulta sem fabricar status ou guia', async () => {
    const functionSource = source.slice(source.indexOf('export const trackServientregaGuide'), source.indexOf('const normalizeLaarGuide'))
        .replace('export const ', 'const ');
    let closed = false;
    const context = {
        cleanGuide: (value) => String(value).trim(),
        DEFAULT_TIMEOUT_MS: 10_000,
        launchCarrierBrowser: async () => ({ page: {
            goto: async () => ({ status: () => 403 }),
            waitForLoadState: () => { throw Error('unexpected_wait'); }
        } }),
        closeCarrierBrowser: async () => { closed = true; }
    };
    vm.runInNewContext(`${functionSource}\nglobalThis.track = trackServientregaGuide`, context);
    const result = await context.track('12345678');
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'carrier_http_403');
    assert.equal(closed, true);
});
