import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
    assertEcManualDropiReleaseV119Manifest,
    ecManualDropiReleaseV119ExternalEffectAllowed,
    ecManualDropiReleaseV119MongoAllowed,
    ecManualDropiReleaseV119RouteDecision,
    resolveEcManualDropiReleaseV119Configuration
} from '../src/services/ecManualDropiReleaseV119Service.js';
import {
    EC_BOT_CORE_V78_DATASET_ID,
    buildEcBotCoreV78OverlayEnvironment
} from '../src/services/ecBotCoreOperationalV78Service.js';
import { canaryV75BlockedResult } from '../src/services/canaryIsolationV75Service.js';
import {
    ecBotCoreMutationRouteGuardV78,
    installEcBotCoreMongooseGuardV78
} from '../src/services/ecBotCoreRuntimeIntegrationV78Service.js';

const operationalEnv = Object.freeze({
    VITALISMEN_EC_BOT_CORE_OPERATIONAL: 'true',
    PANEL_AUTH_DISABLED: 'false'
});

const authorizePath = '/api/shipments/droppi/ec/orders/EC-ADMIN-3493/authorize-submit';
const submitPath = '/api/shipments/droppi/ec/orders/EC-ADMIN-3493/submit';

test('V119 libera somente autorização e envio manual autenticado de um pedido EC', () => {
    assert.equal(ecManualDropiReleaseV119RouteDecision({ method: 'POST', path: authorizePath, env: operationalEnv }).operation, 'authorize-submit');
    assert.equal(ecManualDropiReleaseV119RouteDecision({ method: 'POST', path: submitPath, env: operationalEnv }).operation, 'submit');
    for (const [method, path] of [
        ['GET', submitPath],
        ['POST', '/api/shipments/droppi/ec/dispatch/run'],
        ['POST', '/api/shipments/droppi/ec/sync'],
        ['POST', '/api/shipments/droppi/ec/orders/EC-ADMIN-3493/prepare-manual'],
        ['POST', '/api/shipments/droppi/ec/admin-leads/3493/configure-order']
    ]) {
        assert.equal(ecManualDropiReleaseV119RouteDecision({ method, path, env: operationalEnv }).allowed, false, `${method} ${path}`);
    }
});

test('V119 falha fechado sem autenticação obrigatória do painel', () => {
    const invalidEnv = { ...operationalEnv, PANEL_AUTH_DISABLED: 'true' };
    assert.deepEqual(resolveEcManualDropiReleaseV119Configuration(invalidEnv), {
        enabled: true,
        ready: false,
        mode: 'EC_AUTHENTICATED_MANUAL_DROPI',
        failures: ['PANEL_AUTH_DISABLED_must_be_false']
    });
    assert.equal(ecManualDropiReleaseV119RouteDecision({
        method: 'POST', path: submitPath, env: invalidEnv
    }).allowed, false);
});

test('V119 limita escrita Mongo a pedidos, remessas e contato no contexto exato', () => {
    const context = {
        method: 'POST',
        path: submitPath,
        writeContext: true,
        manualDropiV119: true,
        manualDropiOperation: 'submit'
    };
    for (const collection of ['orders', 'shipments', 'contactstates']) {
        assert.equal(ecManualDropiReleaseV119MongoAllowed({ collection, context, method: context.method, path: context.path, env: operationalEnv }), true);
    }
    for (const collection of ['messages', 'vslvisits', 'users']) {
        assert.equal(ecManualDropiReleaseV119MongoAllowed({ collection, context, method: context.method, path: context.path, env: operationalEnv }), false);
    }
    assert.equal(ecManualDropiReleaseV119MongoAllowed({
        collection: 'orders',
        context: { ...context, path: '/api/shipments/droppi/ec/dispatch/run' },
        method: 'POST',
        path: '/api/shipments/droppi/ec/dispatch/run',
        env: operationalEnv
    }), false);
});

test('V119 libera efeito Dropi somente durante o POST submit contextual', () => {
    assert.equal(ecManualDropiReleaseV119ExternalEffectAllowed({
        effect: 'dropi',
        context: {
            method: 'POST',
            path: submitPath,
            writeContext: true,
            manualDropiV119: true,
            manualDropiOperation: 'submit'
        },
        env: operationalEnv
    }), true);
    assert.equal(ecManualDropiReleaseV119ExternalEffectAllowed({
        effect: 'dropi',
        context: {
            method: 'POST',
            path: authorizePath,
            writeContext: true,
            manualDropiV119: true,
            manualDropiOperation: 'authorize-submit'
        },
        env: operationalEnv
    }), false);
});

test('middleware V78 propaga contexto V119 e mantém rotas Dropi amplas bloqueadas', async () => {
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
    const env = {
        ...buildEcBotCoreV78OverlayEnvironment({
            baseEnv: { META_PIXEL_ID_EC: EC_BOT_CORE_V78_DATASET_ID }
        }),
        META_PIXEL_ID_EC: EC_BOT_CORE_V78_DATASET_ID,
        PANEL_AUTH_DISABLED: 'false'
    };
    const previous = new Map();
    for (const [key, value] of Object.entries(env)) {
        previous.set(key, Object.hasOwn(process.env, key) ? process.env[key] : undefined);
        process.env[key] = value;
    }
    try {
        const authorizeResult = await ecBotCoreMutationRouteGuardV78({
            method: 'POST', originalUrl: authorizePath, body: {}
        }, {}, () => ({
            orderWrite: new FakeCollection('orders').updateOne(),
            shipmentWrite: new FakeCollection('shipments').updateOne(),
            externalEffect: canaryV75BlockedResult('dropi')
        }));
        assert.equal(authorizeResult.orderWrite, 'updated:orders');
        assert.equal(authorizeResult.shipmentWrite, 'updated:shipments');
        assert.equal(authorizeResult.externalEffect.reason, 'bot_core_dropi_blocked');

        const submitResult = await ecBotCoreMutationRouteGuardV78({
            method: 'POST', originalUrl: submitPath, body: {}
        }, {}, () => ({
            orderWrite: new FakeCollection('orders').updateOne(),
            shipmentWrite: new FakeCollection('shipments').updateOne(),
            externalEffect: canaryV75BlockedResult('dropi')
        }));
        assert.equal(submitResult.orderWrite, 'updated:orders');
        assert.equal(submitResult.shipmentWrite, 'updated:shipments');
        assert.equal(submitResult.externalEffect, null);
        assert.throws(() => new FakeCollection('orders').updateOne(), /ec_bot_core_mongo_write_blocked/);

        const blocked = {};
        const blockedResponse = {
            status(code) {
                blocked.status = code;
                return this;
            },
            json(body) {
                blocked.body = body;
                return body;
            }
        };
        await ecBotCoreMutationRouteGuardV78({
            method: 'POST', originalUrl: '/api/shipments/droppi/ec/dispatch/run', body: {}
        }, blockedResponse, () => assert.fail('dispatch amplo não pode alcançar handler'));
        assert.equal(blocked.status, 423);
        assert.equal(blocked.body.error, 'ec_bot_core_v78_operation_blocked');
    } finally {
        for (const [key, value] of previous) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    }
});

test('consulta de status V119 é somente leitura e o transporte conserva anti-duplicidade', () => {
    const routes = fs.readFileSync('src/routes/shipments.js', 'utf8');
    const statusStart = routes.indexOf("router.get('/droppi/ec/orders/:orderId/submit-status'");
    const statusEnd = routes.indexOf("router.get('/droppi/ec/orders/:orderId/manual-link'", statusStart);
    const statusHandler = routes.slice(statusStart, statusEnd);
    assert.match(statusHandler, /findExistingOrderForDropiRequest/);
    assert.doesNotMatch(statusHandler, /findOrderForDropiRequest/);
    assert.doesNotMatch(statusHandler, /ensureShipmentForOrder/);

    const browser = fs.readFileSync('src/services/droppiEcuadorBrowserService.js', 'utf8');
    const submitStart = browser.indexOf('export const submitDroppiEcuadorOrder');
    const submitEnd = browser.indexOf('export const prepareDroppiEcuadorOrderForManualSubmit', submitStart);
    const submit = browser.slice(submitStart, submitEnd);
    assert.match(submit, /checkDropiSubmitSafety/);
    assert.match(submit, /lockShipmentForBrowserWorkEc/);
    assert.match(submit, /canaryV75BlockedResult\('dropi'\)/);
    assert.match(submit, /dropiOrderId/);

    const canary = fs.readFileSync('src/services/canaryIsolationV75Service.js', 'utf8');
    assert.match(canary, /isEcManualDropiExternalEffectAllowedV119\(effect, env\)/);
});

test('V119 valida manifesto e mantém automações fora do escopo', () => {
    const result = assertEcManualDropiReleaseV119Manifest();
    assert.equal(result.ready, true);
    assert.equal(result.manifest.policy.allowedPostRouteCount, 2);
    assert.equal(result.manifest.policy.automaticDispatchAllowed, false);
    assert.equal(result.manifest.policy.historicalBackfillAllowed, false);
    assert.equal(result.manifest.policy.whatsappChanged, false);
    assert.equal(result.manifest.policy.metaChanged, false);

    const workflow = fs.readFileSync('.github/workflows/ec-panel-quality.yml', 'utf8');
    assert.match(
        workflow,
        /NODE_OPTIONS=--import=\.\/scripts\/lib\/ec-runtime-successor-v97-context\.mjs npm run senior:check/
    );
});
