import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { assertConversationHandledV129B } from '../scripts/guard-ec-conversation-handled-v129b.mjs';

import User from '../src/models/User.js';
import authRoutes from '../src/routes/auth.js';
import {
    assertEcAuthLoginV78PassThroughV127Manifest,
    EC_AUTH_LOGIN_V78_PASS_THROUGH_V127_ANCESTOR_OVERRIDES
} from '../src/services/ecAuthLoginV78PassThroughV127Service.js';
import {
    EC_BOT_CORE_V78_DATASET_ID,
    buildEcBotCoreV78OverlayEnvironment
} from '../src/services/ecBotCoreOperationalV78Service.js';
import {
    EC_AUTH_LOGIN_V78_PATH,
    assertEcBotCoreExternalEffectAllowedV78,
    ecBotCoreMutationRouteGuardV78,
    installEcBotCoreMongooseGuardV78,
    isExactEcAuthLoginV78Request
} from '../src/services/ecBotCoreRuntimeIntegrationV78Service.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('manifesto V127 fixa a exceção mínima e mantém produção não autorizada', () => {
    const result = assertEcAuthLoginV78PassThroughV127Manifest();
    assert.equal(result.ready, true);
    assert.deepEqual(result.overrides, EC_AUTH_LOGIN_V78_PASS_THROUGH_V127_ANCESTOR_OVERRIDES);
    assert.equal(result.manifest.policy.exactMethod, 'POST');
    assert.equal(result.manifest.policy.exactPath, '/api/auth/login');
    assert.equal(result.manifest.policy.genericAuthRoutesAllowed, false);
    assert.equal(result.manifest.policy.writeContextEnabled, false);
    assert.equal(result.manifest.policy.productionMutationAuthorized, false);
});

const operationalEnvironment = () => ({
    ...buildEcBotCoreV78OverlayEnvironment({
        baseEnv: { META_PIXEL_ID_EC: EC_BOT_CORE_V78_DATASET_ID }
    }),
    META_PIXEL_ID_EC: EC_BOT_CORE_V78_DATASET_ID
});

const withEnvironment = async (environment, operation) => {
    const previous = new Map();
    for (const [key, value] of Object.entries(environment)) {
        previous.set(key, Object.hasOwn(process.env, key) ? process.env[key] : undefined);
        process.env[key] = value;
    }
    try {
        return await operation();
    } finally {
        for (const [key, value] of previous) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    }
};

const blockedResponse = () => {
    const state = { status: 0, body: null };
    return {
        state,
        response: {
            status(code) {
                state.status = code;
                return this;
            },
            json(body) {
                state.body = body;
                return body;
            }
        }
    };
};

const sha256 = (relativePath) => crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(projectRoot, relativePath)))
    .digest('hex');

const listen = (app) => new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
    server.once('error', reject);
});

const close = (server) => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
});

test('reconhece somente POST /api/auth/login como passagem exata', () => {
    assert.equal(EC_AUTH_LOGIN_V78_PATH, '/api/auth/login');
    assert.equal(isExactEcAuthLoginV78Request({ method: 'POST', path: '/api/auth/login' }), true);
    assert.equal(isExactEcAuthLoginV78Request({ method: 'post', path: '/api/auth/login?source=panel' }), true);

    for (const candidate of [
        { method: 'GET', path: '/api/auth/login' },
        { method: 'PUT', path: '/api/auth/login' },
        { method: 'POST', path: '/api/auth/login/' },
        { method: 'POST', path: '/api/auth/register' },
        { method: 'POST', path: '/api/auth/users' },
        { method: 'POST', path: '/api/auth/login/reset' },
        { method: 'POST', path: ' /api/auth/login ' },
        { method: 'POST', path: '/api/orders' }
    ]) {
        assert.equal(isExactEcAuthLoginV78Request(candidate), false, `${candidate.method} ${candidate.path}`);
    }
});

test('guard V78 deixa somente o login exato alcançar o auth existente', async () => {
    await withEnvironment(operationalEnvironment(), async () => {
        const reached = await ecBotCoreMutationRouteGuardV78({
            method: 'POST',
            originalUrl: '/api/auth/login',
            body: {}
        }, {}, () => 'existing-auth-handler-reached');
        assert.equal(reached, 'existing-auth-handler-reached');

        for (const originalUrl of [
            '/api/auth/login/',
            '/api/auth/register',
            '/api/auth/users',
            '/api/auth/login/reset',
            '/api/orders'
        ]) {
            const blocked = blockedResponse();
            await ecBotCoreMutationRouteGuardV78({
                method: 'POST', originalUrl, body: {}
            }, blocked.response, () => assert.fail(`${originalUrl} não pode alcançar handler`));
            assert.equal(blocked.state.status, 423, originalUrl);
            assert.equal(blocked.state.body?.error, 'ec_bot_core_v78_operation_blocked', originalUrl);
        }
    });
});

test('configuração V78 inválida continua fail-closed inclusive para login', async () => {
    const environment = { ...operationalEnvironment(), DISABLE_SCHEDULER: '0' };
    await withEnvironment(environment, async () => {
        const blocked = blockedResponse();
        await ecBotCoreMutationRouteGuardV78({
            method: 'POST', originalUrl: '/api/auth/login', body: {}
        }, blocked.response, () => assert.fail('login não pode contornar perfil V78 inválido'));
        assert.equal(blocked.state.status, 423);
        assert.equal(blocked.state.body?.reason, 'bot_core_invalid_fail_closed');
    });
});

test('contexto de login permite somente users.updateOne e nenhum outro write ou efeito', async () => {
    class FakeCollection {
        constructor(collectionName) {
            this.collectionName = collectionName;
        }

        updateOne() {
            return `updated:${this.collectionName}`;
        }

        insertOne() {
            return `inserted:${this.collectionName}`;
        }

        deleteOne() {
            return `deleted:${this.collectionName}`;
        }
    }

    installEcBotCoreMongooseGuardV78({ Collection: FakeCollection });

    await withEnvironment(operationalEnvironment(), async () => {
        const request = { method: 'POST', originalUrl: '/api/auth/login', body: {} };
        const updated = await ecBotCoreMutationRouteGuardV78(request, {}, () => (
            new FakeCollection('users').updateOne()
        ));
        assert.equal(updated, 'updated:users');

        for (const [collection, mutation] of [
            ['users', 'insertOne'],
            ['users', 'deleteOne'],
            ['orders', 'updateOne'],
            ['messages', 'updateOne']
        ]) {
            await assert.rejects(
                () => ecBotCoreMutationRouteGuardV78(request, {}, () => (
                    new FakeCollection(collection)[mutation]()
                )),
                new RegExp(`ec_bot_core_mongo_write_blocked:${collection}\\.${mutation}`)
            );
        }

        await ecBotCoreMutationRouteGuardV78(request, {}, () => {
            assert.throws(
                () => assertEcBotCoreExternalEffectAllowedV78('zapi_outbound_reply'),
                /bot_core_write_context_required/
            );
        });
    });
});

test('rate limiter de autenticação continua anterior ao guard e bloqueia a tentativa 101', async () => {
    const authLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 100,
        keyGenerator: (req) => {
            const cloudflareIp = String(req.headers['cf-connecting-ip'] || '').split(',')[0].trim();
            if (cloudflareIp) return `cf:${cloudflareIp}`;
            const realIp = String(req.headers['x-real-ip'] || '').split(',')[0].trim();
            if (realIp) return `real:${realIp}`;
            return `ip:${req.ip || req.socket?.remoteAddress || 'unknown'}`;
        },
        skip: () => false,
        validate: { trustProxy: false },
        message: { error: 'Too many attempts, please try again later.' }
    });
    const app = express();
    app.use(express.json());
    app.use('/api/auth', authLimiter);
    app.use(ecBotCoreMutationRouteGuardV78);
    app.use('/api/auth', authRoutes);
    let server;

    try {
        await withEnvironment(operationalEnvironment(), async () => {
            server = await listen(app);
            const url = `http://127.0.0.1:${server.address().port}/api/auth/login`;
            for (let attempt = 1; attempt <= 100; attempt += 1) {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'CF-Connecting-IP': '198.51.100.127'
                    },
                    body: '{}'
                });
                assert.equal(response.status, 400, `tentativa ${attempt}`);
            }
            const limited = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'CF-Connecting-IP': '198.51.100.127'
                },
                body: '{}'
            });
            assert.equal(limited.status, 429);
            assert.deepEqual(await limited.json(), { error: 'Too many attempts, please try again later.' });
        });
    } finally {
        if (server) await close(server);
    }
});

test('auth existente preserva credenciais, JWT e sessão protegida depois do guard V78', async () => {
    const originalFindOne = User.findOne;
    const originalFindById = User.findById;
    let saveCount = 0;
    class AuthCollection {
        constructor(collectionName) {
            this.collectionName = collectionName;
        }

        updateOne() {
            return `updated:${this.collectionName}`;
        }
    }
    installEcBotCoreMongooseGuardV78({ Collection: AuthCollection });

    const syntheticUser = {
        _id: '000000000000000000000001',
        email: 'admin@example.test',
        name: 'Admin sintético',
        role: 'admin',
        isActive: true,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        async comparePassword(password) {
            return password === 'correct-synthetic-password';
        },
        async save() {
            assert.equal(new AuthCollection('users').updateOne(), 'updated:users');
            saveCount += 1;
            return this;
        }
    };

    User.findOne = async ({ email }) => email === syntheticUser.email ? syntheticUser : null;
    User.findById = () => ({
        select: async () => syntheticUser
    });

    const app = express();
    app.set('trust proxy', true);
    app.use(express.json());
    app.use(ecBotCoreMutationRouteGuardV78);
    app.use('/api/auth', authRoutes);
    let server;

    try {
        await withEnvironment({
            ...operationalEnvironment(),
            JWT_SECRET: 'synthetic-auth-test-secret',
            PANEL_AUTH_DISABLED: 'false'
        }, async () => {
            server = await listen(app);
            const baseUrl = `http://127.0.0.1:${server.address().port}`;

            const missing = await fetch(`${baseUrl}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: '{}'
            });
            assert.equal(missing.status, 400);
            assert.deepEqual(await missing.json(), { error: 'Email and password required' });

            const invalid = await fetch(`${baseUrl}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: syntheticUser.email, password: 'invalid-password' })
            });
            assert.equal(invalid.status, 401);
            assert.deepEqual(await invalid.json(), { error: 'Invalid credentials' });
            assert.equal(saveCount, 0);

            const valid = await fetch(`${baseUrl}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: syntheticUser.email,
                    password: 'correct-synthetic-password'
                })
            });
            assert.equal(valid.status, 200);
            const authenticated = await valid.json();
            assert.equal(authenticated.user.email, syntheticUser.email);
            assert.equal(authenticated.user.role, 'admin');
            assert.match(authenticated.token, /^[^.]+\.[^.]+\.[^.]+$/);
            assert.equal(saveCount, 1);

            const session = await fetch(`${baseUrl}/api/auth/me`, {
                headers: {
                    Authorization: `Bearer ${authenticated.token}`,
                    Host: 'panel.example.test',
                    'X-Forwarded-Host': 'panel.example.test',
                    'X-Forwarded-For': '203.0.113.10'
                }
            });
            assert.equal(session.status, 200);
            assert.equal((await session.json()).user.email, syntheticUser.email);

            const invalidSession = await fetch(`${baseUrl}/api/auth/me`, {
                headers: {
                    Authorization: 'Bearer invalid.jwt.token',
                    Host: 'panel.example.test',
                    'X-Forwarded-Host': 'panel.example.test',
                    'X-Forwarded-For': '203.0.113.10'
                }
            });
            assert.equal(invalidSession.status, 401);
            assert.deepEqual(await invalidSession.json(), { error: 'Invalid token' });
        });
    } finally {
        if (server) await close(server);
        User.findOne = originalFindOne;
        User.findById = originalFindById;
    }
});

test('auth e rate limiter preservam V125; painel corresponde ao sucessor V129 validado', () => {
    assert.equal(sha256('src/routes/auth.js'), '91d732e58dd17bc2232a38c778e249f9298b40da8987f74560936bf84a186bce');
    assert.equal(sha256('src/middleware/auth.js'), 'b40ab3aa2f0f265f04922ee5ad6115379c1dca26fd5ad8856554df1a1ab095ba');
    assert.equal(sha256('src/index.js'), '48f7e5ee9d97e6fc8fe6e0d928a2f6645801a355d74c62bf9baf04b208f3f27b');
    const readStateSuccessor = assertConversationHandledV129B();
    assert.equal(sha256('public/qr.html'), readStateSuccessor.protectedFiles['public/qr.html']);
    assert.equal(sha256('src/services/ecBotCoreOperationalV78Service.js'), '7f738af46a93dcf178c25b0d0b51f4947cb6bb59d10893c1529190b878dfb562');

    const index = fs.readFileSync(path.join(projectRoot, 'src/index.js'), 'utf8');
    const limiterIndex = index.indexOf("app.use('/api/auth', authLimiter);");
    const v78Index = index.indexOf('app.use(ecBotCoreMutationRouteGuardV78);');
    const authRouterIndex = index.indexOf("app.use('/api/auth', authRoutes);");
    assert.ok(limiterIndex >= 0 && limiterIndex < v78Index && v78Index < authRouterIndex);
});
