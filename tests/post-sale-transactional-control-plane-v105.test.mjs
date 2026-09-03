import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { canaryControllerV77EnforcementRequired } from '../src/services/canaryControllerV77Service.js';
import {
    POST_SALE_NOTIFICATION_DECISIONS,
    decidePostSaleNotification,
    evaluatePostSaleChronology,
    findManualHumanModeForShipment
} from '../src/services/postSaleNotificationDecisionService.js';
import {
    POST_SALE_TRANSACTIONAL_V105_DATASET_ID,
    POST_SALE_TRANSACTIONAL_V105_OVERRIDE_KEY,
    assertPostSaleTransactionalV105Manifest,
    buildPostSaleTransactionalV105Overlay,
    resolvePostSaleTransactionalV105Configuration
} from '../src/services/postSaleTransactionalControlPlaneV105Service.js';
import {
    POST_SALE_PUBLICATION_METADATA_V106_OVERRIDE_KEY,
    assertPostSalePublicationMetadataV106Manifest
} from '../src/services/postSalePublicationMetadataV106Service.js';
import {
    POST_SALE_HEALTH_ENVELOPE_V107_OVERRIDE_KEY,
    assertPostSaleHealthEnvelopeV107Manifest
} from '../src/services/postSaleHealthEnvelopeV107Service.js';
import { assertPostSaleEligibleBatchV108Manifest } from '../src/services/postSaleEligibleBatchV108Service.js';

const chain = (value) => ({
    sort() { return this; },
    select() { return this; },
    limit() { return this; },
    lean() { return Promise.resolve(value); },
    catch(handler) { return Promise.resolve(value).catch(handler); }
});

const baseShipment = (overrides = {}) => ({
    _id: 'shipment-v105',
    country: 'EC',
    orderId: 'EC-V105-TEST',
    client: { phone: '593990000001' },
    logistics: { status: 'PENDIENTE', trackingNumber: '123456789', agencyPickup: true },
    automation: { postSaleSafetyLedger: {} },
    review: { manualOnly: false, suppressedNotificationKinds: [] },
    outcomes: {},
    events: [],
    ...overrides
});

test('perfil V105 mantém bot e abre somente dispatcher transacional lote um', () => {
    const env = {
        META_PIXEL_ID_EC: POST_SALE_TRANSACTIONAL_V105_DATASET_ID,
        ...buildPostSaleTransactionalV105Overlay({ baseEnv: { META_PIXEL_ID_EC: POST_SALE_TRANSACTIONAL_V105_DATASET_ID } })
    };
    const profile = resolvePostSaleTransactionalV105Configuration(env);
    assert.equal(profile.ready, true);
    assert.equal(env.SHIPMENT_STATUS_DISPATCH_ENABLED, 'true');
    assert.equal(env.SHIPMENT_STATUS_DISPATCH_BATCH_LIMIT, '1');
    assert.equal(env.SHIPMENT_STATUS_DISPATCH_DAILY_LIMIT, '1');
    assert.equal(env.SHIPMENT_CARRIER_STATUS_SWEEP_ENABLED, 'false');
    assert.equal(env.WHATSAPP_BACKLOG_RECOVERY_ENABLED, 'false');
    assert.equal(env.DROPPI_EC_ACTIVE_SYNC_MODE, 'REPORT_ONLY');
    assert.equal(env.DROPPI_EC_ACTIVE_SYNC_ENABLED, 'false');
    assert.equal(env.META_RETRO_SEND, 'false');
    assert.equal(canaryControllerV77EnforcementRequired(env), false);
});

test('perfil V105 adulterado não desarma o controlador V77', () => {
    const env = {
        META_PIXEL_ID_EC: POST_SALE_TRANSACTIONAL_V105_DATASET_ID,
        ...buildPostSaleTransactionalV105Overlay({ baseEnv: { META_PIXEL_ID_EC: POST_SALE_TRANSACTIONAL_V105_DATASET_ID } }),
        SHIPMENT_STATUS_DISPATCH_BATCH_LIMIT: '2'
    };
    assert.equal(resolvePostSaleTransactionalV105Configuration(env).ready, false);
    assert.equal(canaryControllerV77EnforcementRequired(env), true);
});

test('human.mode manual é encontrado por identidade EC e bloqueia SHOULD_SEND', async () => {
    const manualModel = { findOne: () => chain({ _id: 'contact', human: { mode: 'manual' } }) };
    const state = await findManualHumanModeForShipment({ shipment: baseShipment(), contactStateModel: manualModel });
    assert.equal(state.human.mode, 'manual');
    const messageModel = { find: () => chain([]) };
    const result = await decidePostSaleNotification({
        shipment: baseShipment(),
        kind: 'guide',
        acquireLock: false,
        contactStateModel: manualModel,
        messageModel
    });
    assert.equal(result.decision, POST_SALE_NOTIFICATION_DECISIONS.MANUAL_REVIEW_REQUIRED);
    assert.equal(result.reason, 'human_mode_manual');
});

test('cronologia bloqueia GUIDE e IN_TRANSIT depois de estágio posterior', () => {
    assert.equal(evaluatePostSaleChronology({
        shipment: baseShipment({ logistics: { status: 'READY_FOR_PICKUP', trackingNumber: '123456789' } }),
        kind: 'guide'
    }).allowed, false);
    assert.equal(evaluatePostSaleChronology({
        shipment: baseShipment({ logistics: { status: 'ENTREGADO', trackingNumber: '123456789' } }),
        kind: 'in_transit'
    }).allowed, false);
    for (const status of ['RETIRADO', 'PICKED_UP', 'DELIVERED', 'RETURNED', 'LISTO PARA RETIRO']) {
        assert.equal(evaluatePostSaleChronology({
            shipment: baseShipment({ logistics: { status, trackingNumber: '123456789' } }),
            kind: 'guide'
        }).allowed, false, status);
    }
});

test('helper oferece permits separados, contenção e lote sem retry', () => {
    const helper = fs.readFileSync('ops/post-sale-v105', 'utf8');
    assert.match(helper, /bridge-authorize/);
    assert.match(helper, /bridge-apply/);
    assert.match(helper, /batch-run/);
    assert.match(helper, /restore_bot_core/);
    assert.match(helper, /BATCH_MAX=1/);
    assert.match(helper, /post-sale-v105-batch-one\.invoked/);
    assert.match(helper, /VITALISMEN_EC_POSTSALE_TRANSACTIONAL_OPERATIONAL=false/);
    assert.doesNotMatch(helper, /pm2 jlist \| node -/);
    assert.doesNotMatch(helper, /WHATSAPP_BACKLOG_RECOVERY_ENABLED=true/);
});

test('manifesto V105 protege o control plane e os guards', () => {
    const latest = assertPostSaleEligibleBatchV108Manifest();
    globalThis[POST_SALE_HEALTH_ENVELOPE_V107_OVERRIDE_KEY] = latest.overrides;
    const healthSuccessor = assertPostSaleHealthEnvelopeV107Manifest();
    globalThis[POST_SALE_PUBLICATION_METADATA_V106_OVERRIDE_KEY] = [...latest.overrides, ...healthSuccessor.overrides];
    const publicationSuccessor = assertPostSalePublicationMetadataV106Manifest();
    globalThis[POST_SALE_TRANSACTIONAL_V105_OVERRIDE_KEY] = [
        ...latest.overrides,
        ...healthSuccessor.overrides,
        ...publicationSuccessor.overrides
    ];
    const result = assertPostSaleTransactionalV105Manifest();
    assert.equal(result.ready, true);
    assert.equal(result.manifest.policy.batchMax, 1);
    assert.equal(result.manifest.policy.humanModeManualBlocked, true);
});
