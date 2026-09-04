import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
    assertEcPanelCustomerStatusPersistenceV123Manifest,
    customerStateSavedOrderSyncFailureV123
} from '../src/services/ecPanelCustomerStatusPersistenceV123Service.js';
import { ecPanelCustomerPersistenceV122MongoAllowed } from '../src/services/ecPanelCustomerPersistenceV122Service.js';

const operationalEnv = Object.freeze({
    VITALISMEN_EC_BOT_CORE_OPERATIONAL: 'true',
    PANEL_AUTH_DISABLED: 'false'
});

test('V123 classifica bloqueio de orders sem transformar ficha salva em erro', () => {
    const error = new Error('ec_bot_core_mongo_write_blocked:orders.insertOne');
    error.code = 'EC_BOT_CORE_V78_OPERATION_BLOCKED';
    assert.deepEqual(customerStateSavedOrderSyncFailureV123(error), {
        ok: false,
        skipped: true,
        failed: false,
        customerStateSaved: true,
        reason: 'customer_state_saved_order_sync_not_authorized',
        errorCode: 'EC_BOT_CORE_V78_OPERATION_BLOCKED'
    });
});

test('V123 preserva sucesso primário e sanitiza falha secundária inesperada', () => {
    const result = customerStateSavedOrderSyncFailureV123(new Error('segredo interno que nao deve sair'));
    assert.equal(result.customerStateSaved, true);
    assert.equal(result.failed, true);
    assert.equal(result.reason, 'customer_state_saved_order_sync_failed');
    assert.equal(result.errorCode, 'ORDER_SYNC_FAILED');
    assert.equal(JSON.stringify(result).includes('segredo interno'), false);
});

test('PATCH persiste ContactState antes de tentar sincronizar pedido confirmado', () => {
    const routes = fs.readFileSync('src/routes/whatsapp.js', 'utf8');
    const start = routes.indexOf("router.patch('/contact-state/:phone'");
    const end = routes.indexOf("router.post('/contact-state/:phone/identity-conflict'", start);
    const handler = routes.slice(start, end);
    const defer = handler.indexOf('deferredOperationalOrderDraft = cleanDraft');
    const primarySave = handler.indexOf('await state.save();');
    const optionalOrderSync = handler.indexOf('operationalOrderSync = await ensureOperationalOrderForConfirmedDraft');
    const response = handler.indexOf('res.json({ success: true, state, unifiedSync, operationalOrderSync })');
    assert.ok(defer >= 0 && primarySave > defer);
    assert.ok(optionalOrderSync > primarySave);
    assert.ok(response > optionalOrderSync);
    assert.match(handler, /catch \(error\) \{\s*operationalOrderSync = customerStateSavedOrderSyncFailureV123\(error\)/);
});

test('V123 não amplia o escopo Mongo V122 além de contactstates', () => {
    const context = {
        panelCustomerPersistenceV122: true,
        panelCustomerPersistenceOperation: 'authenticated-customer-state-persist'
    };
    assert.equal(ecPanelCustomerPersistenceV122MongoAllowed({
        method: 'PATCH',
        path: '/api/whatsapp/contact-state/593000000000%40c.us',
        collection: 'contactstates',
        context,
        env: operationalEnv
    }), true);
    for (const collection of ['orders', 'shipments', 'messages', 'users']) {
        assert.equal(ecPanelCustomerPersistenceV122MongoAllowed({
            method: 'PATCH',
            path: '/api/whatsapp/contact-state/593000000000%40c.us',
            collection,
            context,
            env: operationalEnv
        }), false, collection);
    }
});

test('V122 reconhece overrides sucessores sem afrouxar o próprio manifesto', () => {
    const source = fs.readFileSync('src/services/ecPanelCustomerPersistenceV122Service.js', 'utf8');
    assert.match(source, /modified\.has\(relativePath\) \|\| successorOverrides\.has\(relativePath\)/);
    assert.match(source, /clean\(collection\)\.toLowerCase\(\) === 'contactstates'/);
});

test('preload carrega V123 antes da V122 e fecha com o novo runtime guard', () => {
    const context = fs.readFileSync('scripts/lib/ec-runtime-successor-v97-context.mjs', 'utf8');
    const latest = context.indexOf('assertEcPanelCustomerStatusPersistenceV123Manifest()');
    const parent = context.indexOf('assertEcPanelCustomerPersistenceV122Manifest()');
    const runtimeGuard = context.indexOf('ecPanelCustomerStatusPersistenceFreezeRuntimeGuardV123.js');
    assert.ok(latest >= 0 && parent > latest && runtimeGuard > parent);
});

test('V123 preserva superfícies externas e valida o manifesto', () => {
    const result = assertEcPanelCustomerStatusPersistenceV123Manifest();
    assert.equal(result.ready, true);
    assert.equal(result.manifest.policy.customerStateSavedFirst, true);
    assert.equal(result.manifest.policy.orderSyncFailureCanRollbackCustomerState, false);
    assert.deepEqual(result.manifest.policy.allowedMongoCollections, ['contactstates']);
    assert.equal(result.manifest.policy.genericOrderRoutesAllowed, false);
    assert.equal(result.manifest.policy.whatsappOutboundChanged, false);
    assert.equal(result.manifest.policy.dropiChanged, false);
    assert.equal(result.manifest.policy.postSaleChanged, false);
    assert.equal(result.manifest.policy.metaChanged, false);
});
