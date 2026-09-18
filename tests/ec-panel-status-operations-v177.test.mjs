import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
    EC_PANEL_STATUS_V177_EXTERNAL_EFFECT_POLICY,
    EC_PANEL_STATUS_V177_QA_PHONE,
    EC_PANEL_STATUS_V177_STATUSES,
    ecPanelStatusV177Actor,
    ecPanelStatusV177MongoAllowed,
    ecPanelStatusV177Operation,
    ecPanelStatusV177RouteDecision,
    ecPanelStatusV177StatusPlan,
    isEcPanelStatusV177StrictLocalRequest
} from '../src/services/ecPanelStatusOperationsV177Service.js';
import {
    EC_BOT_CORE_V78_DATASET_ID,
    buildEcBotCoreV78OverlayEnvironment,
    calculateEcBotCoreV78ProfileSha256
} from '../src/services/ecBotCoreOperationalV78Service.js';
import {
    ecBotCoreMutationRouteGuardV78,
    ecPanelStatusAuthenticatedActionV177,
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

const withEnvironment = async (env, run) => {
    const previous = new Map();
    for (const [key, value] of Object.entries(env)) {
        previous.set(key, Object.hasOwn(process.env, key) ? process.env[key] : undefined);
        process.env[key] = value;
    }
    try {
        return await run();
    } finally {
        for (const [key, value] of previous) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    }
};

const responseCapture = () => ({
    statusCode: 200,
    payload: null,
    status(code) {
        this.statusCode = code;
        return this;
    },
    json(payload) {
        this.payload = payload;
        return payload;
    }
});

test('V177 valida os nove status e restringe Order a confirmar/recompra', () => {
    assert.equal(EC_PANEL_STATUS_V177_QA_PHONE, '5515998038637');
    assert.equal(EC_PANEL_STATUS_V177_STATUSES.length, 9);
    const orderStatuses = [];
    for (const status of EC_PANEL_STATUS_V177_STATUSES) {
        const first = ecPanelStatusV177StatusPlan(status);
        const repeated = ecPanelStatusV177StatusPlan(status);
        assert.equal(first.allowed, true, status);
        assert.deepEqual(repeated, first, `idempotencia:${status}`);
        if (first.orderWrite) orderStatuses.push(status);
    }
    assert.deepEqual(orderStatuses, ['confirmado', 'recompra']);
    assert.deepEqual(ecPanelStatusV177StatusPlan('desconhecido'), {
        allowed: false,
        status: 'desconhecido',
        operation: '',
        orderWrite: false
    });
});

test('V177 reconhece somente as quatro superfícies exatas e os dois contextos de pedido', () => {
    const allowed = [
        ['POST', '/api/whatsapp/chats/action', {}, 'chat-action'],
        ['POST', '/api/whatsapp/chats/bucket', {}, 'chat-bucket'],
        ['POST', '/api/whatsapp/internal/admin-status-sync', {}, 'internal-admin-status-sync'],
        ['POST', '/api/whatsapp/contact-state/5515998038637/identity-conflict', {}, 'identity-conflict'],
        ['PATCH', '/api/whatsapp/contact-state/5515998038637', { customerDraft: { status: 'confirmado' } }, 'confirm-order'],
        ['PATCH', '/api/whatsapp/contact-state/5515998038637', { customerDraft: { status: 'recompra' } }, 'repurchase-new-cycle']
    ];
    for (const [method, path, body, operation] of allowed) {
        assert.equal(ecPanelStatusV177Operation({ method, path, body }), operation);
    }
    for (const [method, path] of [
        ['POST', '/api/whatsapp/chats/action/extra'],
        ['PUT', '/api/whatsapp/chats/action'],
        ['POST', '/api/whatsapp/contact-state/5515998038637/identity-conflict/extra'],
        ['POST', '/api/orders'],
        ['DELETE', '/api/whatsapp/contact-state/5515998038637']
    ]) {
        assert.equal(ecPanelStatusV177Operation({ method, path, body: {} }), '', `${method} ${path}`);
    }
});

test('admin-status-sync aceita somente origem local estrita', () => {
    const local = {
        hostname: '127.0.0.1',
        ip: '127.0.0.1',
        socket: { remoteAddress: '127.0.0.1' },
        headers: { host: '127.0.0.1:3001' }
    };
    const external = {
        hostname: 'ec.maxlien.shop',
        ip: '203.0.113.10',
        socket: { remoteAddress: '127.0.0.1' },
        headers: { host: 'ec.maxlien.shop', 'x-forwarded-for': '203.0.113.10' }
    };
    assert.equal(isEcPanelStatusV177StrictLocalRequest(local), true);
    assert.equal(isEcPanelStatusV177StrictLocalRequest(external), false);
    assert.equal(ecPanelStatusV177RouteDecision({
        method: 'POST', path: '/api/whatsapp/internal/admin-status-sync', internalLocal: true, env: operationalEnv
    }).allowed, true);
    assert.equal(ecPanelStatusV177RouteDecision({
        method: 'POST', path: '/api/whatsapp/internal/admin-status-sync', internalLocal: false, env: operationalEnv
    }).reason, 'ec_panel_status_v177_internal_local_required');
});

test('V177 exige operador autenticado, ativo e diferente do bypass local sem senha', () => {
    assert.deepEqual(ecPanelStatusV177Actor({ _id: 'operator-1', isActive: true }), {
        active: true,
        actorId: 'operator-1'
    });
    for (const user of [null, {}, { _id: 'operator-2', isActive: false }, { _id: 'local-no-password', isActive: true }]) {
        assert.equal(ecPanelStatusV177Actor(user).active, false);
    }
});

test('Mongo V177 aplica a matriz coleção/método/contexto sem allowlist ampla', () => {
    const context = (operation, path, extra = {}) => ({
        writeContext: true,
        method: operation === 'confirm-order' || operation === 'repurchase-new-cycle' ? 'PATCH' : 'POST',
        path,
        panelStatusV177: true,
        panelStatusOperationV177: operation,
        panelStatusActorIdV177: operation === 'internal-admin-status-sync' ? 'internal-local-admin-panel' : 'operator-1',
        panelStatusTargetV177: EC_PANEL_STATUS_V177_QA_PHONE,
        panelStatusBodyV177: operation === 'confirm-order'
            ? { customerDraft: { status: 'confirmado' } }
            : operation === 'repurchase-new-cycle'
                ? { customerDraft: { status: 'recompra' } }
                : {},
        panelStatusHumanAuthenticatedV177: operation !== 'internal-admin-status-sync',
        panelStatusInternalLocalV177: operation === 'internal-admin-status-sync',
        ...extra
    });
    const action = context('chat-action', '/api/whatsapp/chats/action');
    assert.equal(ecPanelStatusV177MongoAllowed({ context: action, collection: 'contactstates', method: 'updateOne', env: operationalEnv }), true);
    assert.equal(ecPanelStatusV177MongoAllowed({ context: action, collection: 'messages', method: 'insertOne', env: operationalEnv }), true);
    const confirm = context('confirm-order', `/api/whatsapp/contact-state/${EC_PANEL_STATUS_V177_QA_PHONE}`);
    const repurchase = context('repurchase-new-cycle', `/api/whatsapp/contact-state/${EC_PANEL_STATUS_V177_QA_PHONE}`);
    for (const candidate of [confirm, repurchase]) {
        assert.equal(ecPanelStatusV177MongoAllowed({ context: candidate, collection: 'orders', method: 'insertOne', env: operationalEnv }), true);
        assert.equal(ecPanelStatusV177MongoAllowed({ context: candidate, collection: 'orders', method: 'updateOne', env: operationalEnv }), true);
        assert.equal(ecPanelStatusV177MongoAllowed({ context: candidate, collection: 'orders', method: 'deleteOne', env: operationalEnv }), false);
        assert.equal(ecPanelStatusV177MongoAllowed({ context: candidate, collection: 'orders', method: 'bulkWrite', env: operationalEnv }), false);
        assert.equal(ecPanelStatusV177MongoAllowed({ context: candidate, collection: 'shipments', method: 'updateOne', env: operationalEnv }), false);
    }
    assert.equal(ecPanelStatusV177MongoAllowed({
        context: { ...confirm, panelStatusV177: false }, collection: 'orders', method: 'insertOne', env: operationalEnv
    }), false);
    assert.equal(ecPanelStatusV177MongoAllowed({
        context: { ...confirm, panelStatusActorIdV177: '' }, collection: 'orders', method: 'insertOne', env: operationalEnv
    }), false);
    assert.equal(ecPanelStatusV177MongoAllowed({
        context: { ...confirm, path: '/api/orders' }, collection: 'orders', method: 'insertOne', env: operationalEnv
    }), false);
});

test('guard integrado bloqueia rota externa e concede orders somente após autenticação humana V177', async () => {
    class FakeCollectionV177 {
        constructor(collectionName) {
            this.collectionName = collectionName;
        }
        insertOne() { return `inserted:${this.collectionName}`; }
        updateOne() { return `updated:${this.collectionName}`; }
        deleteOne() { return `deleted:${this.collectionName}`; }
        bulkWrite() { return `bulk:${this.collectionName}`; }
    }
    installEcBotCoreMongooseGuardV78({ Collection: FakeCollectionV177, mongo: { Collection: FakeCollectionV177 } });
    await withEnvironment(coreEnvironment(), async () => {
        const confirmRequest = {
            method: 'PATCH',
            originalUrl: `/api/whatsapp/contact-state/${EC_PANEL_STATUS_V177_QA_PHONE}`,
            params: { phone: EC_PANEL_STATUS_V177_QA_PHONE },
            body: { customerDraft: { status: 'confirmado' } },
            user: { _id: 'operator-1', isActive: true }
        };
        await assert.rejects(() => ecBotCoreMutationRouteGuardV78(confirmRequest, responseCapture(), () => (
            new FakeCollectionV177('messages').insertOne()
        )), /ec_bot_core_mongo_write_blocked:messages\.insertOne/);
        const allowed = await ecBotCoreMutationRouteGuardV78(confirmRequest, responseCapture(), () => (
            ecPanelStatusAuthenticatedActionV177(confirmRequest, responseCapture(), () => (
                new FakeCollectionV177('orders').insertOne()
            ))
        ));
        assert.equal(allowed, 'inserted:orders');

        await assert.rejects(() => ecBotCoreMutationRouteGuardV78(confirmRequest, responseCapture(), () => (
            ecPanelStatusAuthenticatedActionV177(confirmRequest, responseCapture(), () => (
                new FakeCollectionV177('orders').deleteOne()
            ))
        )), /ec_bot_core_mongo_write_blocked:orders\.deleteOne/);

        const inactiveRequest = { ...confirmRequest, user: { _id: 'operator-2', isActive: false } };
        const inactiveResponse = responseCapture();
        await ecBotCoreMutationRouteGuardV78(inactiveRequest, inactiveResponse, () => (
            ecPanelStatusAuthenticatedActionV177(inactiveRequest, inactiveResponse, () => 'unexpected')
        ));
        assert.equal(inactiveResponse.statusCode, 403);
        assert.equal(inactiveResponse.payload.code, 'panel_status_v177_authenticated_human_required');

        const unauthenticatedRequest = { ...confirmRequest, user: undefined };
        const unauthenticatedResponse = responseCapture();
        await ecBotCoreMutationRouteGuardV78(unauthenticatedRequest, unauthenticatedResponse, () => (
            ecPanelStatusAuthenticatedActionV177(unauthenticatedRequest, unauthenticatedResponse, () => 'unexpected')
        ));
        assert.equal(unauthenticatedResponse.statusCode, 403);

        for (const request of [
            {
                method: 'POST', originalUrl: '/api/whatsapp/chats/action',
                body: { phone: EC_PANEL_STATUS_V177_QA_PHONE, action: 'atendimento' },
                user: { _id: 'operator-1', isActive: true }
            },
            {
                method: 'POST', originalUrl: '/api/whatsapp/chats/bucket',
                body: { phone: EC_PANEL_STATUS_V177_QA_PHONE, bucket: 'atendimento' },
                user: { _id: 'operator-1', isActive: true }
            },
            {
                method: 'POST', originalUrl: `/api/whatsapp/contact-state/${EC_PANEL_STATUS_V177_QA_PHONE}/identity-conflict`,
                params: { phone: EC_PANEL_STATUS_V177_QA_PHONE },
                body: { resolution: 'KEEP_CURRENT' },
                user: { _id: 'operator-1', isActive: true }
            }
        ]) {
            const result = await ecBotCoreMutationRouteGuardV78(request, responseCapture(), () => (
                ecPanelStatusAuthenticatedActionV177(request, responseCapture(), () => (
                    new FakeCollectionV177('messages').insertOne()
                ))
            ));
            assert.equal(result, 'inserted:messages', request.originalUrl);
        }

        const localRequest = {
            method: 'POST',
            originalUrl: '/api/whatsapp/internal/admin-status-sync',
            hostname: '127.0.0.1',
            ip: '127.0.0.1',
            socket: { remoteAddress: '127.0.0.1' },
            headers: { host: '127.0.0.1:3001' },
            body: { phone: EC_PANEL_STATUS_V177_QA_PHONE, status: 'atendendo' }
        };
        assert.equal(await ecBotCoreMutationRouteGuardV78(localRequest, responseCapture(), () => (
            new FakeCollectionV177('contactstates').updateOne()
        )), 'updated:contactstates');

        const externalRequest = {
            method: 'POST',
            originalUrl: '/api/whatsapp/internal/admin-status-sync',
            hostname: 'ec.maxlien.shop',
            ip: '203.0.113.10',
            socket: { remoteAddress: '127.0.0.1' },
            headers: { host: 'ec.maxlien.shop', 'x-forwarded-for': '203.0.113.10' },
            body: { phone: EC_PANEL_STATUS_V177_QA_PHONE, status: 'atendendo' }
        };
        const externalResponse = responseCapture();
        await ecBotCoreMutationRouteGuardV78(externalRequest, externalResponse, () => 'unexpected');
        assert.equal(externalResponse.statusCode, 423);
        assert.equal(externalResponse.payload.reason, 'ec_panel_status_v177_internal_local_required');

        const unknownResponse = responseCapture();
        await ecBotCoreMutationRouteGuardV78({
            method: 'POST', originalUrl: '/api/whatsapp/status/unknown', body: {}
        }, unknownResponse, () => 'unexpected');
        assert.equal(unknownResponse.statusCode, 423);
    });
});

test('rotas ficam depois do auth e o callback interno não escreve Order', () => {
    const source = fs.readFileSync('src/routes/whatsapp.js', 'utf8');
    const authIndex = source.indexOf('router.use(authMiddleware)');
    for (const route of [
        "router.post('/chats/action', ecPanelStatusAuthenticatedActionV177",
        "router.post('/chats/bucket', ecPanelStatusAuthenticatedActionV177",
        "router.patch('/contact-state/:phone', ecPanelStatusAuthenticatedActionV177",
        "router.post('/contact-state/:phone/identity-conflict', ecPanelStatusAuthenticatedActionV177"
    ]) {
        assert.ok(source.indexOf(route) > authIndex, route);
    }
    const internalStart = source.indexOf("router.post('/internal/admin-status-sync'");
    const internalEnd = source.indexOf('// Protect all WhatsApp routes', internalStart);
    const internalHandler = source.slice(internalStart, internalEnd);
    assert.match(internalHandler, /isEcPanelStatusV177StrictLocalRequest/);
    assert.match(internalHandler, /orderSyncSkipped: 'v177_authenticated_human_required'/);
    assert.doesNotMatch(internalHandler, /Order\.findOne|order\.save\(/);
});

test('V177 não concede efeitos externos Dropi, Meta Purchase ou WhatsApp', () => {
    assert.deepEqual(EC_PANEL_STATUS_V177_EXTERNAL_EFFECT_POLICY, {
        dropiMode: 'REPORT_ONLY',
        dropiApplyAllowed: false,
        metaPurchaseAllowed: false,
        whatsappOutboundAllowed: false
    });
    const source = fs.readFileSync('src/services/ecPanelStatusOperationsV177Service.js', 'utf8');
    assert.doesNotMatch(source, /sendZapi|sendText|sendAudio|sendImage|sendVideo|sendBrowserMetaEvent|submit.*Dropi/i);
});
