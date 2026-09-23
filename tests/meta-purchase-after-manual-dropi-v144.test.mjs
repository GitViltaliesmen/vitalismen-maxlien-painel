import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { ensurePurchaseAfterHumanDropiSuccessV141 } from '../src/routes/shipments.js';
import { buildEcBotCoreV78OverlayEnvironment, EC_BOT_CORE_V78_DATASET_ID } from '../src/services/ecBotCoreOperationalV78Service.js';
import { ecManualDropiMetaPurchaseAllowedV144 } from '../src/services/ecManualDropiMetaPurchaseV144Service.js';
import { sendPurchaseEventForOrder } from '../src/services/metaConversionsService.js';
import { canaryV75BlockedResultForContextV144 } from '../src/services/canaryIsolationV75Service.js';
import {
    ecBotCoreMutationRouteGuardV78,
    ecManualDropiHumanActionV138
} from '../src/services/ecBotCoreRuntimeIntegrationV78Service.js';

const operationalEnv = () => ({
    ...buildEcBotCoreV78OverlayEnvironment({
        baseEnv: { META_PIXEL_ID_EC: EC_BOT_CORE_V78_DATASET_ID }
    }),
    META_PIXEL_ID_EC: EC_BOT_CORE_V78_DATASET_ID,
    META_ACCESS_TOKEN_EC: 'fixture-token',
    PANEL_AUTH_DISABLED: 'false'
});

const submitContext = () => ({
    profile: 'EC_BOT_CORE_OPERATIONAL',
    method: 'POST',
    path: '/api/shipments/droppi/ec/orders/EC-ADMIN-FIXTURE/submit',
    writeContext: true,
    manualDropiV119: true,
    manualDropiOperation: 'submit',
    humanDropiActionV138: true,
    humanDropiActorId: 'operator-fixture',
    humanDropiRequestedOrderId: 'EC-ADMIN-FIXTURE'
});

test('V144 libera somente Purchase no submit Dropi autenticado e operacional', () => {
    const env = operationalEnv();
    const context = submitContext();
    assert.equal(ecManualDropiMetaPurchaseAllowedV144({ effect: 'meta_purchase', context, env }), true);
    assert.equal(canaryV75BlockedResultForContextV144('meta_purchase', env, context), null);
    assert.equal(ecManualDropiMetaPurchaseAllowedV144({ effect: 'meta', context, env }), false);
    assert.equal(ecManualDropiMetaPurchaseAllowedV144({ effect: 'dropi', context, env }), false);
    assert.equal(ecManualDropiMetaPurchaseAllowedV144({
        effect: 'meta_purchase', context: { ...context, manualDropiOperation: 'authorize-submit' }, env
    }), false);
    assert.equal(ecManualDropiMetaPurchaseAllowedV144({
        effect: 'meta_purchase', context: { ...context, humanDropiActionV138: false }, env
    }), false);
    assert.equal(ecManualDropiMetaPurchaseAllowedV144({
        effect: 'meta_purchase', context: { ...context, humanDropiActorId: '' }, env
    }), false);
});

test('Purchase continua bloqueado fora do contexto humano mesmo em dry-run', async () => {
    const result = await sendPurchaseEventForOrder({
        orderId: 'EC-ADMIN-FIXTURE',
        country: 'EC',
        source: 'manual',
        total: 80.99,
        package: { id: 3, quantity: 3 },
        customer: { name: 'Cliente Fixture', phone: '+593999999999' },
        tracking: { productKey: 'tex_ultra_ec' }
    }, { env: operationalEnv(), dryRun: true });
    assert.equal(result.ok, false);
    assert.equal(result.blocked, true);
    assert.equal(result.reason, 'bot_core_meta_purchase_blocked');
});

test('middleware real V78 atravessa o dry-run somente após autenticação humana do submit', { concurrency: false }, async () => {
    const env = operationalEnv();
    const previous = new Map(Object.keys(env).map((key) => [key, process.env[key]]));
    Object.assign(process.env, env);
    const req = {
        method: 'POST',
        originalUrl: '/api/shipments/droppi/ec/orders/EC-ADMIN-FIXTURE/submit',
        url: '/api/shipments/droppi/ec/orders/EC-ADMIN-FIXTURE/submit',
        user: { _id: 'operator-fixture', role: 'admin', isActive: true }
    };
    const res = {
        statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        json(payload) { throw new Error(`middleware_blocked:${this.statusCode}:${payload?.reason || payload?.code}`); }
    };
    try {
        const result = await new Promise((resolve, reject) => {
            ecBotCoreMutationRouteGuardV78(req, res, () => {
                ecManualDropiHumanActionV138(req, res, async () => {
                    try {
                        resolve(await sendPurchaseEventForOrder({
                            orderId: 'EC-ADMIN-FIXTURE',
                            country: 'EC',
                            source: 'manual',
                            total: 80.99,
                            package: { id: 3, quantity: 3 },
                            customer: { name: 'Cliente Fixture', phone: '+593999999999' },
                            tracking: { productKey: 'vit_power_ec' }
                        }, {
                            env: process.env,
                            dryRun: true,
                            attributionEnricher: async () => ({ ok: true, status: 'UNATTRIBUTED' })
                        }));
                    } catch (error) {
                        reject(error);
                    }
                });
            });
        });
        assert.equal(result.ok, true);
        assert.equal(result.dryRun, true);
        assert.equal(result.datasetId, EC_BOT_CORE_V78_DATASET_ID);
    } finally {
        for (const [key, value] of previous) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    }
});

test('pedido Dropi já existente não dispara Purchase retroativo', async () => {
    let calls = 0;
    const result = await ensurePurchaseAfterHumanDropiSuccessV141({
        order: { orderId: 'EC-ADMIN-HISTORICAL', tracking: {} },
        shipment: { automation: { dropiSubmitAuthorizedAt: new Date() } },
        dropiResult: { ok: true, alreadySubmitted: true, dropiOrderId: '123' },
        purchaseSender: async () => { calls += 1; return { ok: true, response: { events_received: 1 } }; }
    });
    assert.equal(result.reason, 'historical_or_existing_dropi_submission');
    assert.equal(calls, 0);
});

test('HTTP Meta sem evento aceito não grava sentAt nem selo verde', async () => {
    const order = { orderId: 'EC-ADMIN-NOT-ACCEPTED', tracking: {} };
    let saves = 0;
    let locks = 0;
    const result = await ensurePurchaseAfterHumanDropiSuccessV141({
        order,
        shipment: { automation: { dropiSubmitAuthorizedAt: new Date() } },
        dropiResult: { ok: true, dropiOrderId: '456' },
        freshDropiSubmission: true,
        purchaseSender: async () => ({ ok: true, eventId: order.orderId, response: { events_received: 0 } }),
        persistOrder: async () => { saves += 1; },
        purchaseLock: () => { locks += 1; }
    });
    assert.equal(result.ok, false);
    assert.equal(result.metaAccepted, false);
    assert.equal(order.tracking.metaPurchaseSentAt, undefined);
    assert.equal(order.tracking.metaPurchaseResponse.error, 'meta_purchase_not_accepted');
    assert.equal(saves, 1);
    assert.equal(locks, 0);
});

test('rotas históricas não recebem marcador fresh e o painel lê a persistência canônica', () => {
    const route = fs.readFileSync('src/routes/shipments.js', 'utf8');
    const panel = fs.readFileSync('public/leads-window.html', 'utf8');
    const historicalStart = route.indexOf('const previouslySubmitted = alreadySubmittedResponse');
    const freshStart = route.indexOf('const handleDropiSubmitResult');
    assert.ok(historicalStart > 0 && freshStart > 0);
    assert.doesNotMatch(route.slice(historicalStart, route.indexOf('assertEcDropiOrderReadyV138', historicalStart)), /freshDropiSubmission:\s*true/);
    assert.match(route.slice(freshStart, route.indexOf('const enqueueDropiSubmitJob', freshStart)), /freshDropiSubmission:\s*true/);
    assert.match(panel, /metaPurchaseSentAt/);
    assert.match(panel, /metaPurchaseResponse/);
    assert.match(panel, /Meta Purchase enviado/);
    assert.match(panel, /Meta erro/);
});
