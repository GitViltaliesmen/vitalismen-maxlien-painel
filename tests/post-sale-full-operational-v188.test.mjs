import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
    POST_SALE_V188_ALLOWED_WRITE_CLASSES,
    POST_SALE_V188_STAGES,
    buildPostSaleFullOperationalV188Overlay,
    isPostSaleV188SendWindowOpen,
    resolvePostSaleFullOperationalV188Configuration
} from '../src/services/postSaleFullOperationalV188Service.js';
import {
    PICKUP_REMINDER_SCHEDULE_V188,
    buildDeterministicBacklogHashV188,
    getDuePickupReminderStepV188,
    reconcilePickupProofAliasV188
} from '../src/services/postSaleFullExecutorV188Service.js';
import { treatmentRefillDueAtV188 } from '../src/services/postSaleRefillV188Service.js';
import {
    pickupHowToUseAudioForShipment,
    repurchaseProductPolicyForShipment
} from '../src/services/shipmentMessageService.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

test('perfil V188 isola o executor e libera somente classes explícitas de pós-venda', () => {
    const overlay = buildPostSaleFullOperationalV188Overlay();
    const resolved = resolvePostSaleFullOperationalV188Configuration(overlay);
    assert.equal(resolved.ready, true);
    assert.equal(overlay.VITALISMEN_EC_BOT_CORE_OPERATIONAL, 'false');
    assert.equal(overlay.VITALISMEN_STRICT_READ_ONLY, 'false');
    assert.equal(overlay.DISABLE_SCHEDULER, '1');
    assert.equal(overlay.SHIPMENT_STATUS_DISPATCH_DAILY_LIMIT, '1');
    assert.equal(overlay.DROPPI_EC_ACTIVE_SYNC_MODE, 'REPORT_ONLY');
    assert.equal(overlay.DROPPI_EC_ACTIVE_SYNC_ENABLED, 'false');
    assert.equal(overlay.DROPPI_PAYMENT_CLAIM_NOTIFY_ENABLED, 'false');
    assert.equal(overlay.DROPPI_PAYMENT_CLAIM_LIVE_CHECK_ENABLED, 'false');
    assert.equal(overlay.VITALISMEN_META_PURCHASE_ENABLED, 'false');
    assert.equal(overlay.META_RETRO_SEND, 'false');
    assert.equal(overlay.WHATSAPP_CONNECT_ENABLED, 'false');
    assert.equal(POST_SALE_V188_ALLOWED_WRITE_CLASSES.includes('*'), false);
    assert.deepEqual(resolved.allowedWriteClasses, POST_SALE_V188_ALLOWED_WRITE_CLASSES);
});

test('todos os 15 estágios canônicos estão registrados no sucessor V188', () => {
    assert.equal(POST_SALE_V188_STAGES.length, 15);
    assert.equal(new Set(POST_SALE_V188_STAGES).size, 15);
});

test('scheduler de retirada liga os seis dias sem alterar os textos aprovados', () => {
    const source = read('src/services/shipmentMessageService.js');
    assert.deepEqual(PICKUP_REMINDER_SCHEDULE_V188.map(({ kind, days }) => [kind, days]), [
        ['day1', 1], ['soft_day2', 2], ['day3', 3],
        ['soft_day4', 4], ['day5', 5], ['soft_day6', 6]
    ]);
    for (const kind of PICKUP_REMINDER_SCHEDULE_V188.map((step) => step.kind)) {
        assert.match(source, new RegExp(`${kind}: \\[`, 'm'));
    }
});

test('cadência V188 não retrocede quando uma etapa histórica posterior já foi enviada', () => {
    const shipment = {
        review: {},
        logistics: {
            status: 'READY_FOR_PICKUP',
            canonicalStatus: 'READY_FOR_PICKUP',
            pickupReadyVerified: true,
            pickupReadyVerifiedSource: 'carrier_tracking'
        },
        outcomes: { delivered: false, pickedUp: false, returned: false, prepaidOnly: false },
        automation: {
            readyForPickupNotifiedAt: new Date('2026-01-01T12:00:00.000Z'),
            reminderDay3At: new Date('2026-01-04T12:00:00.000Z')
        }
    };
    assert.equal(getDuePickupReminderStepV188(shipment, new Date('2026-01-05T12:00:00.000Z')).kind, 'soft_day4');
    shipment.automation.reminderDay5At = new Date('2026-01-06T12:00:00.000Z');
    assert.equal(getDuePickupReminderStepV188(shipment, new Date('2026-01-07T12:00:00.000Z')).kind, 'soft_day6');
});

test('SOFT_DAY2 satisfaz PICKUP_PROOF_REQUEST no mesmo provider id sem duplicar envio', async () => {
    const providerMessageId = 'provider-v188-proof';
    const shipment = {
        _id: 'shipment-v188-proof',
        country: 'EC',
        orderId: 'EC-V188-PROOF',
        client: { customerId: 'customer-v188-proof', phone: '+593999999999' },
        automation: {
            reminderSoftDay2At: new Date('2026-01-03T12:00:00.000Z'),
            pickupProofRequestedAt: new Date('2026-01-03T12:00:00.000Z'),
            postSaleSafetyLedger: {
                PICKUP_REMINDER_SOFT_DAY2: {
                    state: 'SENT', providerMessageId,
                    decidedAt: new Date('2026-01-03T12:00:00.000Z'),
                    finalizedAt: new Date('2026-01-03T12:00:00.000Z')
                }
            }
        }
    };
    let persisted = null;
    const chain = { sort: () => chain, limit: async () => [shipment] };
    const shipmentModel = {
        find: () => chain,
        updateOne: async (_query, update) => {
            persisted = update.$set['automation.postSaleSafetyLedger.PICKUP_PROOF_REQUEST'];
            return { modifiedCount: 1 };
        }
    };
    const report = await reconcilePickupProofAliasV188({ shipmentModel, now: new Date('2026-01-03T12:01:00.000Z') });
    assert.equal(report.reconciled, 1);
    assert.equal(persisted.state, 'SENT');
    assert.equal(persisted.providerMessageId, providerMessageId);
    assert.equal(persisted.reason, 'satisfied_by_soft_day2_single_message');
});

test('janela operacional usa 08:00–19:00 de America\/Guayaquil', () => {
    assert.equal(isPostSaleV188SendWindowOpen(new Date('2026-09-18T13:00:00.000Z')), true); // 08:00 EC
    assert.equal(isPostSaleV188SendWindowOpen(new Date('2026-09-19T00:00:00.000Z')), false); // 19:00 EC
});

test('reposição canônica usa 25, 50 e 70 dias a partir da entrega Servientrega', () => {
    const deliveredAt = new Date('2026-01-01T12:00:00.000Z');
    const shipment = (units) => ({
        _id: 'shipment-v188',
        orderId: `EC-V188-${units}`,
        country: 'EC',
        productName: 'Tex Ultra',
        client: { customerId: 'customer-v188', phone: '+593999999999' },
        logistics: {
            canonicalStatus: 'DELIVERED',
            canonicalEvidence: {
                provider: 'servientrega',
                source: 'carrier_tracking',
                rawStatus: 'ENTREGADO',
                observedAt: deliveredAt
            }
        },
        outcomes: { returned: false },
        treatment: { unitsPurchased: units },
        automation: {},
        raw: {}
    });
    assert.equal(treatmentRefillDueAtV188(shipment(1)).toISOString(), '2026-01-26T12:00:00.000Z');
    assert.equal(treatmentRefillDueAtV188(shipment(2)).toISOString(), '2026-02-20T12:00:00.000Z');
    assert.equal(treatmentRefillDueAtV188(shipment(3)).toISOString(), '2026-03-12T12:00:00.000Z');
});

test('áudio de uso e áudio de reposição permanecem isolados por produto', () => {
    const cases = [
        ['Tex Ultra', 'MODO_DE_USO_TEX_ULTRA', 'MODO_DE_USO_TEX_ULTRA'],
        ['Nitrix Oxide', 'NITRIX_USO_OXIDE_EC', 'NITRIX_USO_OXIDE_EC'],
        ['Vit Power', 'COMO_SE_TOMA_VIT_POWER', 'TEMPO_RESULTADO_VIT_POWER']
    ];
    for (const [productName, usageAudio, refillAudio] of cases) {
        const shipment = { productName, raw: {} };
        assert.equal(pickupHowToUseAudioForShipment(shipment), usageAudio);
        assert.equal(repurchaseProductPolicyForShipment(shipment).audioName, refillAudio);
        for (const baseName of new Set([usageAudio, refillAudio])) {
            assert.equal(fs.existsSync(path.join(projectRoot, 'public/media/templates/EC', `${baseName}.ogg`)), true);
        }
    }
});

test('snapshot conserva a mesma chave independentemente da ordem de leitura', () => {
    const a = { shipment_id: '1', order_id: 'A', stage_due: 'GUIDE', scheduled_at: '2026-01-01', dedupe_key: 'K1', classification: 'READY_TO_SEND' };
    const b = { shipment_id: '2', order_id: 'B', stage_due: 'IN_TRANSIT', scheduled_at: '2026-01-02', dedupe_key: 'K2', classification: 'NOT_ELIGIBLE' };
    assert.equal(buildDeterministicBacklogHashV188([a, b]), buildDeterministicBacklogHashV188([b, a]));
});

test('executor aplica lote um, janela e transporte Z-API sem iniciar Baileys', () => {
    const source = read('scripts/post-sale-full-v188.mjs');
    const ops = read('ops/post-sale-v188');
    assert.match(source, /outboundCount > 1/);
    assert.match(source, /getZapiStatus/);
    assert.match(source, /isPostSaleV188SendWindowOpen/);
    assert.doesNotMatch(source, /startScheduler|whatsapp\/connection|META_RETRO_SEND/);
    assert.match(ops, /flock -n/);
    assert.match(ops, /assert_pm2_bot_online/);
});

test('canário usa somente QA oficial sem criar pedido ou Shipment e prova dedupe', () => {
    const source = fs.readFileSync('scripts/post-sale-v188-qa-canary.mjs', 'utf8');
    const operations = fs.readFileSync('ops/post-sale-v188', 'utf8');
    assert.match(source, /EC_QA_TEST_PHONE_V78 !== '5515998038637'/);
    assert.match(source, /provider: 'zapi'/);
    assert.match(source, /orderCreated: false/);
    assert.match(source, /shipmentCreated: false/);
    assert.match(source, /PASS_QA_CANARY_DEDUPED/);
    assert.match(operations, /VITALISMEN_POSTSALE_V188_QA_CANARY/);
    assert.match(operations, /DUPLICATE_SEND_COUNT=0/);
    assert.match(operations, /NODE_OPTIONS= node - "\$audit_file"/);
});
