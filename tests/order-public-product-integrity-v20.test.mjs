import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import Order from '../src/models/Order.js';
import ordersRoutes from '../src/routes/orders.js';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const routeHandler = (routePath, method = 'post') => {
    const layer = ordersRoutes.stack.find((item) => item.route?.path === routePath && item.route.methods[method]);
    assert.ok(layer, `rota ${method.toUpperCase()} ${routePath} nao encontrada`);
    return layer.route.stack.at(-1).handle;
};

const routeMiddleware = (routePath, middlewareName, method = 'post') => {
    const layer = ordersRoutes.stack.find((item) => item.route?.path === routePath && item.route.methods[method]);
    assert.ok(layer, `rota ${method.toUpperCase()} ${routePath} nao encontrada`);
    const middleware = layer.route.stack.find((item) => item.handle.name === middlewareName)?.handle;
    assert.ok(middleware, `middleware ${middlewareName} nao encontrado em ${routePath}`);
    return middleware;
};

const invokeJsonHandler = async (handler, { body = {}, params = {}, user = null } = {}) => {
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
    await handler({
        body,
        params,
        headers: {},
        hostname: 'ec.maxlien.shop',
        ip: '203.0.113.10',
        get: () => 'v20-regression-test',
        ...(user ? { user } : {})
    }, res);
    return result;
};

const completePublicOrder = (overrides = {}) => ({
    country: 'EC',
    customer: {
        name: 'Cliente Sintetico',
        phone: '+593999999999',
        address: 'Endereco sintetico',
        city: 'Quito',
        province: 'Pichincha'
    },
    packageId: 1,
    total: 35.99,
    productKey: 'tex_ultra_ec',
    ...overrides
});

test('POST publico de pedido rejeita estado operacional antes de consultar ou persistir', async () => {
    const handler = routeHandler('/');
    for (const status of ['confirmed', 'confirmado', 'processing', 'shipped', 'delivered']) {
        const result = await invokeJsonHandler(handler, {
            body: completePublicOrder({ status })
        });
        assert.equal(result.statusCode, 400);
        assert.equal(result.payload?.error, 'public_order_status_not_allowed');
    }
});

test('autenticacao opcional deixa checkout publico seguir e rejeita Bearer invalido', async () => {
    const middleware = routeMiddleware('/', 'optionalPanelAuth');
    const previousPanelAuthDisabled = process.env.PANEL_AUTH_DISABLED;
    process.env.PANEL_AUTH_DISABLED = 'false';
    let nextCount = 0;
    const publicResult = { statusCode: 200, payload: null };
    const response = {
        status(code) {
            publicResult.statusCode = code;
            return this;
        },
        json(payload) {
            publicResult.payload = payload;
            return this;
        }
    };
    try {
        await middleware({
            headers: {},
            hostname: 'ec.maxlien.shop',
            ip: '203.0.113.10',
            socket: { remoteAddress: '203.0.113.10' }
        }, response, () => {
            nextCount += 1;
        });
        assert.equal(nextCount, 1);
        assert.equal(publicResult.statusCode, 200);

        await middleware({
            headers: { authorization: 'Bearer token-invalido' },
            hostname: 'ec.maxlien.shop',
            ip: '203.0.113.10',
            socket: { remoteAddress: '203.0.113.10' }
        }, response, () => {
            nextCount += 1;
        });
        assert.equal(nextCount, 1);
        assert.equal(publicResult.statusCode, 401);
        assert.equal(publicResult.payload?.error, 'Invalid token');

        process.env.PANEL_AUTH_DISABLED = 'true';
        const externalRequestWithBearer = {
            headers: { authorization: 'Bearer token-sem-validacao' },
            hostname: 'ec.maxlien.shop',
            ip: '203.0.113.10',
            socket: { remoteAddress: '203.0.113.10' }
        };
        await middleware(externalRequestWithBearer, response, () => {
            nextCount += 1;
        });
        assert.equal(nextCount, 2);
        assert.equal(externalRequestWithBearer.user, undefined);
    } finally {
        if (previousPanelAuthDisabled === undefined) delete process.env.PANEL_AUTH_DISABLED;
        else process.env.PANEL_AUTH_DISABLED = previousPanelAuthDisabled;
    }
});

test('POST publico de pedido rejeita produto ausente, invalido ou conflitante', async () => {
    const handler = routeHandler('/');
    for (const body of [
        completePublicOrder({ productKey: '' }),
        completePublicOrder({ productKey: 'produto_inexistente' }),
        completePublicOrder({ productKey: 'tex_ultra_ec', productName: 'Nitrix Oxide Ecuador' })
    ]) {
        const result = await invokeJsonHandler(handler, { body });
        assert.equal(result.statusCode, 400);
        assert.match(result.payload?.reason || '', /missing_explicit_product|invalid_product_key|conflicting_product_identifiers/);
    }
});

test('criacao de rascunho rejeita identificador de produto invalido antes de consultar o banco', async () => {
    const handler = routeHandler('/draft');
    const result = await invokeJsonHandler(handler, {
        body: {
            country: 'EC',
            name: 'Cliente Sintetico',
            phone: '+593999999999',
            productKey: 'produto_inexistente'
        }
    });
    assert.equal(result.statusCode, 400);
    assert.equal(result.payload?.reason, 'invalid_product_key');
});

test('rascunho pode nascer sem produto, mas nao pode virar pending sem produto explicito', async () => {
    const handler = routeHandler('/draft/:id/submit');
    const previousFindOne = Order.findOne;
    let saveCount = 0;
    Order.findOne = async () => ({
        orderId: 'EC-DRAFT-V20-SINTETICO',
        country: 'EC',
        status: 'draft',
        customer: {
            name: 'Cliente Sintetico',
            phone: '+593999999999',
            address: 'Endereco sintetico',
            city: 'Quito',
            province: 'Pichincha'
        },
        package: { id: 1, quantity: 1, label: '1 frasco' },
        total: 35.99,
        tracking: {},
        async save() {
            saveCount += 1;
        }
    });
    try {
        const result = await invokeJsonHandler(handler, {
            params: { id: 'EC-DRAFT-V20-SINTETICO' }
        });
        assert.equal(result.statusCode, 400);
        assert.equal(result.payload?.reason, 'missing_explicit_product');
        assert.equal(saveCount, 0);
    } finally {
        Order.findOne = previousFindOne;
    }
});

test('PATCH autenticado rejeita troca de produto internamente conflitante sem salvar', async () => {
    const handler = routeHandler('/:id', 'patch');
    const previousFindOne = Order.findOne;
    let saveCount = 0;
    Order.findOne = async () => ({
        orderId: 'EC-ORDER-V20-SINTETICO',
        country: 'EC',
        status: 'pending',
        customer: { phone: '+593999999999' },
        package: { id: 1, quantity: 1, label: 'Tex Ultra Ecuador 1 frasco' },
        tracking: { productKey: 'tex_ultra_ec', productName: 'Tex Ultra Ecuador' },
        async save() {
            saveCount += 1;
        }
    });
    try {
        const result = await invokeJsonHandler(handler, {
            params: { id: 'EC-ORDER-V20-SINTETICO' },
            body: {
                productKey: 'tex_ultra_ec',
                productName: 'Nitrix Oxide Ecuador'
            }
        });
        assert.equal(result.statusCode, 400);
        assert.equal(result.payload?.reason, 'conflicting_product_identifiers');
        assert.equal(saveCount, 0);
    } finally {
        Order.findOne = previousFindOne;
    }
});

test('Purchase na criacao direta exige usuario autenticado e rascunho valida produto antes dos efeitos', () => {
    const source = read('src/routes/orders.js');
    const publicStart = source.indexOf("router.post('/', optionalPanelAuth");
    const publicEnd = source.indexOf("router.patch('/:id'", publicStart);
    const publicRoute = source.slice(publicStart, publicEnd);
    assert.ok(publicStart >= 0, 'criacao publica precisa passar pela autenticacao opcional');
    assert.match(publicRoute, /allowedPublicInitialStatuses = new Set\(\['draft', 'pending'\]\)/);
    assert.match(publicRoute, /if \(initialStatus === 'confirmed' && req\.user\)/);

    const submitStart = source.indexOf("router.post('/draft/:id/submit'");
    const submitEnd = source.indexOf('// LEGACY ROUTES', submitStart);
    const submitRoute = source.slice(submitStart, submitEnd);
    const productGate = submitRoute.indexOf('if (!productSelection.ok)');
    assert.ok(productGate >= 0, 'gate de produto do submit nao encontrado');
    assert.ok(submitRoute.indexOf('assertNoActiveDuplicateOrder') > productGate);
    assert.ok(submitRoute.indexOf('await order.save()') > productGate);
});
