import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import funnelMetricsRoutes, { createFunnelMetricsHandler } from '../src/routes/funnelMetrics.js';
import { adminOnly, authMiddleware } from '../src/middleware/auth.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const fakeModel = (rows, observedQueries) => ({
    find(query) {
        observedQueries.push(query);
        return {
            select() { return this; },
            lean() { return Promise.resolve(rows); }
        };
    }
});

const fakeResponse = () => ({
    statusCode: 200,
    headers: {},
    body: null,
    status(code) { this.statusCode = code; return this; },
    set(name, value) { this.headers[name] = value; return this; },
    json(body) { this.body = body; return this; }
});

test('rota declara autenticao e autorizacao administrativa antes do handler', () => {
    const routeLayer = funnelMetricsRoutes.stack.find((layer) => layer.route?.path === '/');
    assert.ok(routeLayer, 'rota GET / nao encontrada');
    assert.equal(routeLayer.route.methods.get, true);
    assert.deepEqual(
        routeLayer.route.stack.map((layer) => layer.handle.name),
        ['authMiddleware', 'adminOnly', '']
    );
});

test('servidor monta a API e a pagina usa Bearer com renderizacao protegida', () => {
    const indexSource = fs.readFileSync(path.join(projectRoot, 'src', 'index.js'), 'utf8');
    const page = fs.readFileSync(path.join(projectRoot, 'public', 'funnel-metrics.html'), 'utf8');
    assert.match(indexSource, /app\.get\('\/funnel-metrics\.html'/);
    assert.match(indexSource, /app\.use\('\/api\/funnel-metrics', funnelMetricsRoutes\)/);
    assert.match(page, /\/api\/funnel-metrics\?days=/);
    assert.match(page, /Authorization: `Bearer \$\{state\.token\}`/);
    assert.match(page, /const escapeHtml =/);
    const scripts = [...page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
    assert.equal(scripts.length, 1);
    Function(scripts[0]);
});

test('authMiddleware rejeita requisicao publica sem Bearer e adminOnly rejeita usuario comum', async () => {
    const previous = process.env.PANEL_AUTH_DISABLED;
    process.env.PANEL_AUTH_DISABLED = 'false';
    try {
        const publicRequest = {
            hostname: 'ec.maxlien.shop',
            headers: { host: 'ec.maxlien.shop' },
            ip: '203.0.113.10',
            socket: { remoteAddress: '203.0.113.10' }
        };
        const authResponse = fakeResponse();
        let authNext = false;
        await authMiddleware(publicRequest, authResponse, () => { authNext = true; });
        assert.equal(authNext, false);
        assert.equal(authResponse.statusCode, 401);
        assert.deepEqual(authResponse.body, { error: 'No token provided' });

        const adminResponse = fakeResponse();
        let adminNext = false;
        adminOnly({ ...publicRequest, user: { role: 'attendant' } }, adminResponse, () => { adminNext = true; });
        assert.equal(adminNext, false);
        assert.equal(adminResponse.statusCode, 403);

        adminOnly({ ...publicRequest, user: { role: 'admin' } }, fakeResponse(), () => { adminNext = true; });
        assert.equal(adminNext, true);
    } finally {
        if (previous === undefined) delete process.env.PANEL_AUTH_DISABLED;
        else process.env.PANEL_AUTH_DISABLED = previous;
    }
});

test('handler consulta somente EC, respeita days e devolve no-store', async () => {
    const queries = [];
    const handler = createFunnelMetricsHandler({
        VisitModel: fakeModel([], queries),
        OrderModel: fakeModel([], queries),
        CorrelationModel: fakeModel([], queries),
        clock: () => new Date('2026-08-15T15:00:00.000Z'),
        pixelId: () => 'pixel-test',
        adsInsights: async () => ({ status: 'available', totals: { landingPageViews: 1000 } })
    });
    const response = fakeResponse();
    await handler({ query: { days: '3' } }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['Cache-Control'], 'no-store');
    assert.equal(response.body.days, 3);
    assert.equal(response.body.rows.length, 3);
    assert.equal(response.body.metaAds.totals.landingPageViews, 1000);
    assert.equal(queries.length, 3);
    assert.equal(queries.every((query) => query.country === 'EC'), true);
});
