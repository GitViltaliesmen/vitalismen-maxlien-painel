import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {
    EC_BOT_CORE_R5_NODE_OPTIONS,
    EC_BOT_CORE_V78_DATASET_ID,
    buildEcBotCoreV78OverlayEnvironment,
    ecBotCoreV78RouteDecision,
    resolveEcBotCoreV78Configuration
} from '../src/services/ecBotCoreOperationalV78Service.js';
import {
    ecBotCoreMutationRouteGuardV78,
    installEcBotCoreMongooseGuardV78
} from '../src/services/ecBotCoreRuntimeIntegrationV78Service.js';

test('R5 preserva apenas as escritas operacionais V78 permitidas', async () => {
    const localFixture = process.env.VITALISMEN_R5_PRECOMMIT_ONLY === 'true'
        && process.platform === 'win32'
        && !path.resolve('.').replaceAll('\\', '/').startsWith('/opt/vitalismen-automacao/');
    const previousContext = globalThis.__VITALISMEN_R5_OPERATIONAL_CONTEXT;
    if (localFixture) {
        assert.equal(globalThis.__VITALISMEN_R5_PRECOMMIT_CONTEXT?.loaded, true);
        globalThis.__VITALISMEN_R5_OPERATIONAL_CONTEXT = Object.freeze({ loaded: true });
    }
    const previousEnv = new Map();
    try {
        assert.equal(globalThis.__VITALISMEN_R5_OPERATIONAL_CONTEXT?.loaded, true);
        const overlay = buildEcBotCoreV78OverlayEnvironment({
            baseEnv: { META_PIXEL_ID_EC: EC_BOT_CORE_V78_DATASET_ID },
            nodeOptions: EC_BOT_CORE_R5_NODE_OPTIONS
        });
        const env = { ...overlay, META_PIXEL_ID_EC: EC_BOT_CORE_V78_DATASET_ID };
        assert.equal(resolveEcBotCoreV78Configuration(env).ready, true);
        assert.equal(ecBotCoreV78RouteDecision({
            method: 'POST', path: '/api/zapi/webhook/delivery', env
        }).allowed, true);
        for (const forbidden of ['/api/orders', '/api/dropi/apply', '/api/meta/purchase']) {
            assert.equal(ecBotCoreV78RouteDecision({
                method: 'POST', path: forbidden, env
            }).allowed, false, forbidden);
        }
        class FakeCollection {
            constructor(collectionName) { this.collectionName = collectionName; }
            updateOne() { return 'updated:' + this.collectionName; }
        }
        assert.equal(installEcBotCoreMongooseGuardV78({
            Collection: FakeCollection, mongo: { Collection: FakeCollection }
        }).installed, true);
        for (const [key, value] of Object.entries(env)) {
            previousEnv.set(key, Object.hasOwn(process.env, key) ? process.env[key] : undefined);
            process.env[key] = value;
        }
        const req = { method: 'POST', originalUrl: '/api/zapi/webhook/delivery', body: {} };
        const res = { status(code) { this.code = code; return this; },
            json(body) { this.body = body; return this; } };
        assert.equal(await ecBotCoreMutationRouteGuardV78(req, res,
            () => new FakeCollection('messages').updateOne()), 'updated:messages');
        await assert.rejects(() => ecBotCoreMutationRouteGuardV78(req, res,
            () => new FakeCollection('orders').updateOne()),
        /ec_bot_core_mongo_write_blocked:orders\.updateOne/);
    } finally {
        for (const [key, value] of previousEnv) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
        if (localFixture) {
            if (previousContext === undefined) delete globalThis.__VITALISMEN_R5_OPERATIONAL_CONTEXT;
            else globalThis.__VITALISMEN_R5_OPERATIONAL_CONTEXT = previousContext;
        }
    }
});
