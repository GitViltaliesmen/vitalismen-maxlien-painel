import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import customerContextRoutes, { createCustomerCurrentContextHandler } from '../src/routes/customerContext.js';
import { authMiddleware } from '../src/middleware/auth.js';
import { CustomerContextInputError } from '../src/services/customerCurrentContextService.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const fakeResponse = () => ({
    statusCode: 200,
    headers: {},
    body: null,
    status(code) { this.statusCode = code; return this; },
    set(name, value) { this.headers[name] = value; return this; },
    json(body) { this.body = body; return this; }
});

test('rota GET segue a convencao /api/customer-context/:phone e exige authMiddleware', () => {
    const layer = customerContextRoutes.stack.find((item) => item.route?.path === '/:phone');
    assert.ok(layer, 'rota GET /:phone nao encontrada');
    assert.equal(layer.route.methods.get, true);
    assert.equal(Boolean(layer.route.methods.post || layer.route.methods.patch || layer.route.methods.delete), false);
    assert.deepEqual(layer.route.stack.map((item) => item.handle.name), ['authMiddleware', '']);

    const indexSource = fs.readFileSync(path.join(projectRoot, 'src', 'index.js'), 'utf8');
    assert.match(indexSource, /import customerContextRoutes from '\.\/routes\/customerContext\.js';/);
    assert.match(indexSource, /app\.use\('\/api\/customer-context', customerContextRoutes\);/);
});

test('autenticacao existente rejeita acesso publico quando o painel exige Bearer', async () => {
    const previous = process.env.PANEL_AUTH_DISABLED;
    process.env.PANEL_AUTH_DISABLED = 'false';
    try {
        const request = {
            hostname: 'ec.maxlien.shop',
            headers: { host: 'ec.maxlien.shop' },
            ip: '203.0.113.20',
            socket: { remoteAddress: '203.0.113.20' }
        };
        const response = fakeResponse();
        let nextCalled = false;
        await authMiddleware(request, response, () => { nextCalled = true; });
        assert.equal(nextCalled, false);
        assert.equal(response.statusCode, 401);
        assert.deepEqual(response.body, { error: 'No token provided' });
    } finally {
        if (previous === undefined) delete process.env.PANEL_AUTH_DISABLED;
        else process.env.PANEL_AUTH_DISABLED = previous;
    }
});

test('handler devolve contrato estruturado, no-store e encaminha apenas o telefone', async () => {
    const calls = [];
    const context = {
        schemaVersion: 'v16.customer-current-context.readonly.1',
        generatedAt: '2026-08-16T18:00:00.000Z',
        readOnly: true,
        applicationAllowed: false,
        match: { method: 'canonical_ec_phone', candidates: ['593991234567'], ambiguous: false },
        customer: {
            phone: { value: '593991234567', source: { kind: 'canonical_request' }, confidence: 'ALTA_CONFIANCA', updatedAt: null, applicationAllowed: false },
            identity: { applicationAllowed: false },
            location: { applicationAllowed: false },
            currentProduct: { applicationAllowed: false },
            vslOrigin: { applicationAllowed: false },
            currentOrder: { applicationAllowed: false },
            history: [],
            funnel: { applicationAllowed: false },
            conflicts: [],
            applicationAllowed: false
        }
    };
    const handler = createCustomerCurrentContextHandler({
        readContext: async (phone) => { calls.push(phone); return context; }
    });
    const response = fakeResponse();
    await handler({ params: { phone: '+593 99 123 4567' } }, response);
    assert.deepEqual(calls, ['+593 99 123 4567']);
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['Cache-Control'], 'no-store');
    assert.deepEqual(response.body, context);
    assert.equal(response.body.customer.applicationAllowed, false);
});

test('telefone invalido retorna 400 somente leitura sem consultar outro caminho', async () => {
    const handler = createCustomerCurrentContextHandler({
        readContext: async () => {
            throw new CustomerContextInputError('INVALID_EC_PHONE', 'Telefone EC invalido.');
        }
    });
    const response = fakeResponse();
    await handler({ params: { phone: '5511999999999' } }, response);
    assert.equal(response.statusCode, 400);
    assert.equal(response.headers['Cache-Control'], 'no-store');
    assert.equal(response.body.error, 'INVALID_EC_PHONE');
    assert.equal(response.body.readOnly, true);
    assert.equal(response.body.applicationAllowed, false);
});

test('falha interna retorna contrato seguro sem vazar erro ou acionar fallback', async () => {
    const previousError = console.error;
    console.error = () => {};
    try {
        const handler = createCustomerCurrentContextHandler({
            readContext: async () => { throw new Error('token-secreto-nao-pode-vazar'); }
        });
        const response = fakeResponse();
        await handler({ params: { phone: '593991234567' } }, response);
        assert.equal(response.statusCode, 500);
        assert.equal(response.headers['Cache-Control'], 'no-store');
        assert.equal(response.body.error, 'CUSTOMER_CONTEXT_UNAVAILABLE');
        assert.doesNotMatch(JSON.stringify(response.body), /token-secreto/);
        assert.equal(response.body.readOnly, true);
        assert.equal(response.body.applicationAllowed, false);
    } finally {
        console.error = previousError;
    }
});

test('arquivo da rota nao possui operacoes de escrita, envio ou integracoes externas', () => {
    const source = fs.readFileSync(path.join(projectRoot, 'src', 'routes', 'customerContext.js'), 'utf8');
    assert.doesNotMatch(source, /router\.(?:post|put|patch|delete)\s*\(/);
    assert.doesNotMatch(source, /\.(?:save|updateOne|updateMany|findOneAndUpdate|insertOne|create|deleteOne|deleteMany|bulkWrite)\s*\(/);
    assert.doesNotMatch(source, /(?:droppi|dropi|metaConversions|sendText|sendAudio|zapi|openai|scheduler|autosave)/i);
    assert.match(source, /router\.get\('\/:phone', authMiddleware,/);
});
