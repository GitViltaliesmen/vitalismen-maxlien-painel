import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
    assertEcPanelCustomerPersistenceV122Manifest,
    ecPanelCustomerPersistenceV122MongoAllowed,
    ecPanelCustomerPersistenceV122RouteDecision,
    resolveEcPanelCustomerPersistenceV122Configuration
} from '../src/services/ecPanelCustomerPersistenceV122Service.js';
import {
    EC_BOT_CORE_V78_DATASET_ID,
    buildEcBotCoreV78OverlayEnvironment,
    calculateEcBotCoreV78ProfileSha256
} from '../src/services/ecBotCoreOperationalV78Service.js';
import {
    ecBotCoreMutationRouteGuardV78,
    installEcBotCoreMongooseGuardV78
} from '../src/services/ecBotCoreRuntimeIntegrationV78Service.js';

const operationalEnv = Object.freeze({
    VITALISMEN_EC_BOT_CORE_OPERATIONAL: 'true',
    PANEL_AUTH_DISABLED: 'false'
});

const coreEnvironment = () => {
    const overlay = buildEcBotCoreV78OverlayEnvironment({
        baseEnv: { META_PIXEL_ID_EC: EC_BOT_CORE_V78_DATASET_ID }
    });
    const env = {
        ...overlay,
        META_PIXEL_ID_EC: EC_BOT_CORE_V78_DATASET_ID,
        PANEL_AUTH_DISABLED: 'false'
    };
    return {
        ...env,
        VITALISMEN_EC_BOT_CORE_PROFILE_SHA256: calculateEcBotCoreV78ProfileSha256(env)
    };
};

test('V122 libera somente preview e persistência autenticada da ficha', () => {
    assert.deepEqual(ecPanelCustomerPersistenceV122RouteDecision({
        method: 'POST',
        path: '/api/whatsapp/contact-state/593983996761%40c.us/resolve-customer-data',
        env: operationalEnv
    }), {
        enforced: true,
        allowed: true,
        reason: 'ec_panel_customer_v122_route_allowed',
        operation: 'authenticated-customer-data-preview'
    });
    assert.deepEqual(ecPanelCustomerPersistenceV122RouteDecision({
        method: 'PATCH',
        path: '/api/whatsapp/contact-state/593983996761%40c.us',
        env: operationalEnv
    }), {
        enforced: true,
        allowed: true,
        reason: 'ec_panel_customer_v122_route_allowed',
        operation: 'authenticated-customer-state-persist'
    });
});

test('V122 mantém pedidos, Dropi, Meta e outras mutações bloqueados', () => {
    for (const [method, path] of [
        ['POST', '/api/orders'],
        ['PATCH', '/api/orders/EC-ADMIN-1'],
        ['POST', '/api/dropi/apply'],
        ['POST', '/api/meta/purchase'],
        ['POST', '/api/whatsapp/contact-state/593983996761%40c.us'],
        ['PUT', '/api/whatsapp/contact-state/593983996761%40c.us'],
        ['POST', '/api/whatsapp/contact-state/593983996761%40c.us/identity-conflict'],
        ['PATCH', '/api/whatsapp/contact-state/593983996761%40c.us/delete']
    ]) {
        assert.equal(ecPanelCustomerPersistenceV122RouteDecision({ method, path, env: operationalEnv }).allowed, false, `${method} ${path}`);
    }
});

test('V122 falha fechado se a autenticação do painel estiver desativada', () => {
    const invalidEnv = { ...operationalEnv, PANEL_AUTH_DISABLED: 'true' };
    assert.deepEqual(resolveEcPanelCustomerPersistenceV122Configuration(invalidEnv), {
        enabled: true,
        ready: false,
        mode: 'EC_PANEL_AUTHENTICATED_CUSTOMER_PERSISTENCE',
        failures: ['PANEL_AUTH_DISABLED_must_be_false']
    });
    assert.equal(ecPanelCustomerPersistenceV122RouteDecision({
        method: 'PATCH',
        path: '/api/whatsapp/contact-state/593983996761%40c.us',
        env: invalidEnv
    }).reason, 'ec_panel_customer_v122_invalid_fail_closed');
});

test('V122 limita o contexto persistente ao ContactState da rota PATCH exata', () => {
    const context = {
        panelCustomerPersistenceV122: true,
        panelCustomerPersistenceOperation: 'authenticated-customer-state-persist'
    };
    assert.equal(ecPanelCustomerPersistenceV122MongoAllowed({
        method: 'PATCH',
        path: '/api/whatsapp/contact-state/593983996761%40c.us',
        collection: 'contactstates',
        context,
        env: operationalEnv
    }), true);
    for (const collection of ['orders', 'shipments', 'messages', 'users']) {
        assert.equal(ecPanelCustomerPersistenceV122MongoAllowed({
            method: 'PATCH',
            path: '/api/whatsapp/contact-state/593983996761%40c.us',
            collection,
            context,
            env: operationalEnv
        }), false, collection);
    }
});

test('middleware V78 executa o PATCH em ContactState e nega escrita no preview ou em outra coleção', async () => {
    class FakeCollection {
        constructor(collectionName) {
            this.collectionName = collectionName;
        }

        updateOne() {
            return `updated:${this.collectionName}`;
        }
    }
    installEcBotCoreMongooseGuardV78({
        Collection: FakeCollection,
        mongo: { Collection: FakeCollection }
    });
    const env = coreEnvironment();
    const previous = new Map();
    for (const [key, value] of Object.entries(env)) {
        previous.set(key, Object.hasOwn(process.env, key) ? process.env[key] : undefined);
        process.env[key] = value;
    }
    try {
        const patchRequest = {
            method: 'PATCH',
            originalUrl: '/api/whatsapp/contact-state/593983996761%40c.us',
            body: {}
        };
        assert.equal(await ecBotCoreMutationRouteGuardV78(patchRequest, {}, () => (
            new FakeCollection('contactstates').updateOne()
        )), 'updated:contactstates');
        await assert.rejects(
            () => ecBotCoreMutationRouteGuardV78(patchRequest, {}, () => (
                new FakeCollection('messages').updateOne()
            )),
            /ec_bot_core_mongo_write_blocked:messages\.updateOne/
        );
        const previewRequest = {
            method: 'POST',
            originalUrl: '/api/whatsapp/contact-state/593983996761%40c.us/resolve-customer-data',
            body: {}
        };
        await assert.rejects(
            () => ecBotCoreMutationRouteGuardV78(previewRequest, {}, () => (
                new FakeCollection('contactstates').updateOne()
            )),
            /ec_bot_core_mongo_write_blocked:contactstates\.updateOne/
        );
    } finally {
        for (const [key, value] of previous) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    }
});

test('rotas V122 executam depois da autenticação e o painel usa preview seguido de PATCH', () => {
    const routes = fs.readFileSync('src/routes/whatsapp.js', 'utf8');
    const panel = fs.readFileSync('public/qr.html', 'utf8');
    const authIndex = routes.indexOf('router.use(authMiddleware)');
    const previewRoute = routes.indexOf("router.post('/contact-state/:phone/resolve-customer-data'");
    const persistRoute = routes.indexOf("router.patch('/contact-state/:phone'");
    assert.ok(authIndex >= 0 && previewRoute > authIndex && persistRoute > authIndex);
    const saveStart = panel.indexOf('async function persistSelectedCustomerDataNow');
    const saveEnd = panel.indexOf('async function persistSelectedCustomerData(options', saveStart);
    const saveFlow = panel.slice(saveStart, saveEnd);
    assert.ok(saveFlow.indexOf('/resolve-customer-data') >= 0);
    assert.ok(saveFlow.indexOf('/resolve-customer-data') < saveFlow.lastIndexOf("method: 'PATCH'"));
    assert.match(saveFlow, /customerDraft/);
    assert.match(saveFlow, /orderStatus: customerDraft\.status/);
});

test('integração V78 concede writeContext ao PATCH V122 sem ampliar rotas de pedidos', () => {
    const runtime = fs.readFileSync('src/services/ecBotCoreRuntimeIntegrationV78Service.js', 'utf8');
    assert.match(runtime, /ecPanelCustomerPersistenceV122RouteDecision/);
    assert.match(runtime, /decision\.reason === 'ec_panel_customer_v122_route_allowed'/);
    assert.match(runtime, /\['POST', 'PATCH'\]\.includes\(method\)/);
    assert.match(runtime, /panelCustomerPersistenceV122:/);
    assert.match(runtime, /context\?\.panelCustomerPersistenceV122 === true[\s\S]*?\? panelCustomerCollectionAllowed/);
    assert.doesNotMatch(runtime, /EC_PANEL_CUSTOMER_PERSISTENCE[^\n]*orders/i);
});

test('V122 valida o manifesto sucessor e preserva integrações externas', () => {
    const result = assertEcPanelCustomerPersistenceV122Manifest();
    assert.equal(result.ready, true);
    assert.equal(result.manifest.policy.allowedRouteCount, 2);
    assert.equal(result.manifest.policy.genericOrderRoutesAllowed, false);
    assert.equal(result.manifest.policy.whatsappOutboundChanged, false);
    assert.equal(result.manifest.policy.dropiChanged, false);
    assert.equal(result.manifest.policy.postSaleChanged, false);
    assert.equal(result.manifest.policy.metaChanged, false);
});
