import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import leadsRoutes from '../src/routes/leads.js';
import shipmentsRoutes from '../src/routes/shipments.js';
import {
    ECUADOR_PRODUCTS,
    validateExplicitEcuadorProductSelection
} from '../src/services/ecuadorProductService.js';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const routeHandler = (router, routePath, method = 'post') => {
    const layer = router.stack.find((item) => item.route?.path === routePath);
    assert.ok(layer, `rota ${method.toUpperCase()} ${routePath} nao encontrada`);
    const handlers = layer.route.stack.map((item) => item.handle);
    return handlers.at(-1);
};

const invokeJsonHandler = async (handler, body = {}) => {
    const result = { statusCode: 200, payload: null };
    const res = {
        status(code) {
            result.statusCode = code;
            return this;
        },
        json(payload) {
            result.payload = payload;
            return this;
        }
    };
    await handler({ body, user: { role: 'admin' } }, res);
    return result;
};

test('selecao EC estrita aceita chave isolada e rejeita ausencia, chave invalida e conflito', () => {
    const valid = validateExplicitEcuadorProductSelection({ productKey: 'tex_ultra_ec' });
    assert.equal(valid.ok, true);
    assert.equal(valid.product.key, ECUADOR_PRODUCTS.texUltra.key);

    assert.equal(validateExplicitEcuadorProductSelection({}).reason, 'missing_explicit_product');
    assert.equal(
        validateExplicitEcuadorProductSelection({ productKey: 'produto_inexistente' }).reason,
        'invalid_product_key'
    );
    assert.equal(
        validateExplicitEcuadorProductSelection({
            productKey: 'tex_ultra_ec',
            identifiers: ['Nitrix Oxide Ecuador']
        }).reason,
        'conflicting_product_identifiers'
    );
});

test('POST de leads le productKey e rejeita entradas ausentes, invalidas ou conflitantes antes de persistir', async () => {
    const handler = routeHandler(leadsRoutes, '/');

    const validKeyOnly = await invokeJsonHandler(handler, { productKey: 'vit_power_ec' });
    assert.equal(validKeyOnly.statusCode, 400);
    assert.equal(validKeyOnly.payload?.error, 'Incomplete lead data');

    for (const body of [
        {},
        { productKey: 'produto_inexistente' },
        { productKey: 'tex_ultra_ec', productName: 'Nitrix Oxide Ecuador' }
    ]) {
        const result = await invokeJsonHandler(handler, body);
        assert.equal(result.statusCode, 400);
        assert.match(result.payload?.error || '', /Produto EC explicito obrigatorio/);
    }
});

test('autenticacao sensivel da V17 permanece antes das rotas protegidas', () => {
    const route = read('src/routes/leads.js');
    const panelAuth = read('tests/panel-sensitive-routes-auth.test.mjs');
    assert.match(route, /resolveEcuadorProductInfo\(\s*req\.body\?\.productKey,/);
    assert.match(panelAuth, /\/status'\), \['authMiddleware'/);
    assert.match(panelAuth, /\['\/config', '\/status', '\/device'\]/);
    assert.match(panelAuth, /observador inteiro passa pela autenticacao/);
});

test('guia manual bloqueia produto faltante, desconhecido ou nao configurado antes de qualquer efeito', async () => {
    const handler = routeHandler(shipmentsRoutes, '/manual-guide');

    const missing = await invokeJsonHandler(handler, { country: 'EC' });
    assert.equal(missing.statusCode, 400);
    assert.equal(missing.payload?.error, 'manual_guide_explicit_ec_product_required');

    const unknown = await invokeJsonHandler(handler, { country: 'EC', productKey: 'produto_inexistente' });
    assert.equal(unknown.statusCode, 400);
    assert.equal(unknown.payload?.reason, 'invalid_product_key');

    const previousNitrixEnabled = process.env.DROPPI_EC_NITRIX_PRODUCT_ENABLED;
    process.env.DROPPI_EC_NITRIX_PRODUCT_ENABLED = 'false';
    try {
        const unconfigured = await invokeJsonHandler(handler, { country: 'EC', productKey: 'nitrix_ec' });
        assert.equal(unconfigured.statusCode, 409);
        assert.equal(unconfigured.payload?.error, 'manual_guide_ec_product_not_configured');
    } finally {
        if (previousNitrixEnabled === undefined) delete process.env.DROPPI_EC_NITRIX_PRODUCT_ENABLED;
        else process.env.DROPPI_EC_NITRIX_PRODUCT_ENABLED = previousNitrixEnabled;
    }

    const valid = await invokeJsonHandler(handler, { country: 'EC', productKey: 'vit_power_ec' });
    assert.equal(valid.statusCode, 400);
    assert.equal(valid.payload?.error, 'missing_tracking');

    const source = read('src/routes/shipments.js');
    const start = source.indexOf("router.post('/manual-guide'");
    const end = source.indexOf("router.post('/pickup-proof/sweep'", start);
    const body = source.slice(start, end);
    const gate = body.indexOf('manualGuideProductSelection');
    assert.ok(gate >= 0);
    for (const effect of [
        'getOrderDuplicateGuard',
        'new Order(',
        'await order.save()',
        'upsertDroppiEcuadorShipment',
        'notifyReadyForPickup',
        'notifyShipmentGuideGenerated',
        'syncOrderToOnlineAdminPanel'
    ]) {
        assert.ok(body.indexOf(effect) > gate, `${effect} precisa ficar depois do bloqueio de produto`);
    }
});
