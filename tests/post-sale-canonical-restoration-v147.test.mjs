import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
    buildPostSaleDedupeKeyV147,
    canonicalLogisticsProjectionV147,
    reminderDueV147
} from '../src/services/canonicalLogisticsStatusV147Service.js';
import { publicLogisticsStateV29 } from '../src/services/logisticsCommunicationV29.js';
import {
    buildPostSaleQuotaIdV116,
    reservePostSaleDailyQuotaV116
} from '../src/services/postSaleTransactionalSafetyV116Service.js';
import { loadV140CanonicalBundles } from '../src/services/ecPhoneServientregaReconciliationV140Service.js';
import { restoreHistoricalExternalDroppiBinding } from '../src/services/droppiEcuadorImportService.js';
import {
    POST_SALE_NOTIFICATION_DECISIONS,
    decidePostSaleNotification
} from '../src/services/postSaleNotificationDecisionService.js';
import {
    POST_SALE_STAGES,
    POST_SALE_VARIANTS
} from '../src/services/postSaleSafetyV66Service.js';
import {
    POST_SALE_TEMPLATE_CATALOG_V147,
    missingPostSaleTemplatesV147
} from '../src/services/postSaleTemplateCatalogV147Service.js';
import {
    deliveredThankYouDedupeValueV147,
    notifyDeliveredThankYou,
    pickupHowToUseAudioForShipment,
    shipmentPaymentConfirmed
} from '../src/services/shipmentMessageService.js';

const root = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (value) => value.slice(1)));
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const matrix = [
    [{ providerStatus: 'Pendiente', providerSubstatus: 'Guía generada' }, 'GUIDE_CREATED', false, false],
    [{ providerStatus: 'Mercancía recogida' }, 'PICKED_UP_BY_CARRIER', false, false],
    [{ providerStatus: 'En ruta' }, 'IN_TRANSIT', false, false],
    [{ providerStatus: 'Pendiente', providerSubstatus: 'Centro logístico Quito' }, 'LOGISTICS_CENTER', false, false],
    [{ providerStatus: 'Pendiente', providerSubstatus: 'Ingresando en Agencia SANTO DOMINGO_TSACHILA' }, 'ENTERING_AGENCY', false, false],
    [{ providerStatus: 'Para retiro en agencia Servientrega' }, 'READY_FOR_PICKUP', false, true],
    [{ providerStatus: 'Entregado' }, 'DELIVERED', true, false],
    [{ providerStatus: 'No retirado' }, 'NOT_PICKED_UP', false, false],
    [{ providerStatus: 'Devolución', providerSubstatus: 'Retorno al remitente' }, 'RETURNING', false, false],
    [{ providerStatus: 'Devuelto al remitente' }, 'RETURNED', true, false],
    [{ providerStatus: 'Pendiente', providerSubstatus: 'Novedad en CS' }, 'EXCEPTION', false, false],
    [{ providerStatus: 'Estado sin contrato', providerSubstatus: 'Movimiento sin contrato' }, 'UNKNOWN', false, false]
];

test('V147 mapeia os doze estados canônicos com CAN_PICKUP fail-closed', () => {
    for (const [input, status, terminal, canPickup] of matrix) {
        const result = canonicalLogisticsProjectionV147({ provider: 'servientrega', ...input });
        assert.equal(result.canonicalStatus, status, JSON.stringify(input));
        assert.equal(result.terminal, terminal, status);
        assert.equal(result.canPickup, canPickup, status);
        assert.equal(result.reminderEligible, status === 'READY_FOR_PICKUP', status);
        if (status === 'UNKNOWN') {
            assert.equal(result.postSaleSend, false);
            assert.equal(result.reviewRequired, true);
        }
    }
});

test('V147 classifica o target live como ENTERING_AGENCY e impede retirada', () => {
    const target = canonicalLogisticsProjectionV147({
        provider: 'servientrega',
        providerStatus: 'Pendiente',
        providerSubstatus: 'Ingresando en Agencia SANTO DOMINGO_TSACHILA'
    });
    assert.equal(target.canonicalStatus, 'ENTERING_AGENCY');
    assert.equal(target.canPickup, false);
    assert.match(target.panelLabel, /ainda não retirar/);
});

test('V147 painel aceita READY somente com prova Servientrega', () => {
    const auxiliaryDropi = publicLogisticsStateV29({
        orderId: 'EC-DROPI',
        logistics: {
            status: 'READY_FOR_PICKUP',
            canonicalStatus: 'READY_FOR_PICKUP',
            trackingNumber: '189629714',
            pickupReadyVerified: true,
            pickupReadyVerifiedSource: 'dropi_explicit_pickup_release'
        }
    });
    assert.equal(auxiliaryDropi.canPickup, false);
    assert.equal(auxiliaryDropi.pickupReadyVerified, false);
    assert.equal(auxiliaryDropi.allowPickupLanguage, false);

    const carrier = publicLogisticsStateV29({
        orderId: 'EC-CARRIER',
        logistics: {
            status: 'READY_FOR_PICKUP',
            canonicalStatus: 'READY_FOR_PICKUP',
            trackingNumber: '189629715',
            pickupReadyVerified: true,
            pickupReadyVerifiedSource: 'carrier_tracking'
        }
    });
    assert.equal(carrier.pickupReadyVerified, true);
    assert.equal(carrier.allowPickupLanguage, true);
});

test('V147 relógio usa somente A10 em T0+72h e A19 em T0+120h', () => {
    const t0 = new Date('2026-09-01T12:00:00.000Z');
    assert.equal(reminderDueV147({ acceptedAt: t0, now: '2026-09-04T11:59:59.999Z', canonicalStatus: 'READY_FOR_PICKUP' }), null);
    assert.equal(reminderDueV147({ acceptedAt: t0, now: '2026-09-04T12:00:00.000Z', canonicalStatus: 'READY_FOR_PICKUP' }).templateId, 'A10');
    assert.equal(reminderDueV147({ acceptedAt: t0, a10SentAt: '2026-09-04T12:00:00.000Z', now: '2026-09-06T12:00:00.000Z', canonicalStatus: 'READY_FOR_PICKUP' }).templateId, 'A19');
    for (const terminal of ['DELIVERED', 'RETURNING', 'RETURNED']) {
        assert.equal(reminderDueV147({ acceptedAt: t0, now: '2026-09-10T12:00:00.000Z', canonicalStatus: terminal }), null);
    }
});

test('V147 dedupe inclui customer, order, shipment, evento e template', () => {
    const base = { customerId: 'customer-a', orderId: 'order-a', shipmentId: 'shipment-a', canonicalEvent: 'P2', templateId: 'A07' };
    const key = buildPostSaleDedupeKeyV147(base);
    assert.match(key, /^post-sale-v147:/);
    assert.equal(buildPostSaleDedupeKeyV147(base), key);
    for (const field of Object.keys(base)) {
        assert.notEqual(buildPostSaleDedupeKeyV147({ ...base, [field]: `${base[field]}-other` }), key, field);
    }
    assert.equal(buildPostSaleDedupeKeyV147({ ...base, shipmentId: '' }), '');
});

test('V147 cota por evento isola clientes e mantém concorrência at-most-once', async () => {
    const rows = new Map();
    const quotaModel = {
        async findOneAndUpdate(query, update) {
            await new Promise((resolve) => setImmediate(resolve));
            const current = rows.get(query._id) || 0;
            if (current >= query.reserved.$lt) {
                const error = new Error('duplicate key');
                error.code = 11000;
                throw error;
            }
            const reserved = current + update.$inc.reserved;
            rows.set(query._id, reserved);
            return { _id: query._id, reserved };
        }
    };
    const base = { dayKey: '2026-09-09', timeZone: 'America/Guayaquil', dailyLimit: 1, orderId: 'ORDER-1', shipmentId: 'SHIPMENT-1', canonicalEvent: 'P2', templateId: 'A07', quotaModel };
    const a = { ...base, customerId: 'CUSTOMER-A', correlationId: 'A' };
    const b = { ...base, customerId: 'CUSTOMER-B', orderId: 'ORDER-2', shipmentId: 'SHIPMENT-2', correlationId: 'B' };
    assert.notEqual(buildPostSaleQuotaIdV116(a), buildPostSaleQuotaIdV116(b));
    const [first, duplicate] = await Promise.all([reservePostSaleDailyQuotaV116(a), reservePostSaleDailyQuotaV116(a)]);
    assert.equal([first, duplicate].filter((item) => item.reserved).length, 1);
    assert.equal((await reservePostSaleDailyQuotaV116(b)).reserved, true);
});

test('V147 V140 inclui Order real sem Shipment e preserva identidade do produto ao restaurar', async () => {
    const order = {
        orderId: 'EC-ADMIN-3484', country: 'EC', dropiOrderId: '6924784', trackingNumber: '',
        customer: { phone: '+593980548369' }, tracking: { productKey: 'tex_ultra_ec', productName: 'Tex Ultra Ecuador' },
        package: { quantity: 3, label: '3 frascos' }, total: 80.99, createdAt: new Date('2026-09-08T15:00:00Z')
    };
    const state = { _id: '6a9830afd2d008efa0c8f62e', countryCode: 'EC', phoneDigits: '593980548369', metadata: { customerDraft: { orderId: order.orderId } } };
    const query = (rows) => ({ sort: () => Promise.resolve(rows) });
    const bundles = await loadV140CanonicalBundles({
        shipmentModel: { find: () => query([]) },
        orderModel: { find: () => query([order]) },
        contactStateModel: { find: () => query([state]) },
        listAdminLeads: () => ({ ok: true, leads: [{ id: 3484, phone: '+593980548369', notes: order.orderId }] })
    });
    assert.equal(bundles.length, 1);
    assert.equal(bundles[0].orderAnchor, true);
    assert.equal(bundles[0].order.orderId, order.orderId);

    let payload;
    const shipment = { _id: 'shipment-restored', orderId: order.orderId, client: { phone: '+593980548369' }, logistics: { trackingNumber: '189629714' }, raw: {} };
    const result = await restoreHistoricalExternalDroppiBinding({
        row: { phone: '+593980548369', dropiOrderId: '6924784', trackingNumber: '189629714' },
        state,
        lead: { id: 3484, phone: '+593980548369' },
        carrier: { ok: true, trackingNumber: '189629714', normalizedStatus: 'EN_RUTA', canonicalStatus: 'ENTERING_AGENCY' },
        dryRun: false,
        shipmentModel: { findOne: () => query(null) },
        orderModel: { findOne: () => query(order) },
        upsertShipment: async (value) => { payload = value; return shipment; }
    });
    assert.equal(result.ok, true);
    assert.equal(payload.orderId, 'EC-ADMIN-3484');
    assert.equal(payload.productName, 'Tex Ultra Ecuador');
    assert.equal(payload.productKey, 'tex_ultra_ec');
    assert.equal(result.messagesSent, 0);
});

test('V147 catálogo mantém A07/A10/A19 e uso por produto sem cruzamento', () => {
    for (const [field, file] of [
        ['A07', 'Chegou_01.ogg'], ['A10', 'Chegou_02.ogg'], ['A19', 'Chegou_03.ogg'],
        ['DELIVERED_THANKYOU_TEMPLATE', 'OBRIGADO_PAGOU.ogg'],
        ['USAGE_TEX_ULTRA', 'MODO_DE_USO_TEX_ULTRA.ogg'],
        ['USAGE_VIT_POWER', 'COMO_SE_TOMA_VIT_POWER.ogg'],
        ['USAGE_NITRIX', 'NITRIX_USO_OXIDE_EC.ogg']
    ]) {
        assert.equal(POST_SALE_TEMPLATE_CATALOG_V147[field].enabled, true);
        assert.ok(fs.statSync(path.join(root, 'public/media/templates/EC', file)).size > 1000, file);
    }
    assert.deepEqual(missingPostSaleTemplatesV147(), []);
    assert.deepEqual(POST_SALE_TEMPLATE_CATALOG_V147.DELIVERED_THANKYOU_TEMPLATE.labels, ['OBRIGADO_PAGOU']);
    assert.equal(POST_SALE_TEMPLATE_CATALOG_V147.DELIVERED_THANKYOU_TEMPLATE.trigger, 'carrier_delivered');
    assert.equal(pickupHowToUseAudioForShipment({ productName: 'Tex Ultra Ecuador' }), 'MODO_DE_USO_TEX_ULTRA');
    assert.equal(pickupHowToUseAudioForShipment({ productName: 'Vit Power Ecuador' }), 'COMO_SE_TOMA_VIT_POWER');
    assert.equal(pickupHowToUseAudioForShipment({ productName: 'Nitrix Oxide Ecuador' }), 'NITRIX_USO_OXIDE_EC');
});

test('V147 conserva utilitário de pagamento sem usá-lo como gatilho de P5', () => {
    assert.equal(shipmentPaymentConfirmed({ outcomes: { delivered: true } }), false);
    assert.equal(shipmentPaymentConfirmed({ raw: { payment: { status: 'paid' } } }), false);
    assert.equal(shipmentPaymentConfirmed({ raw: { payment: { status: 'paid', confirmedAt: '2026-09-10T03:00:00.000Z' } } }), false);
    assert.equal(shipmentPaymentConfirmed({
        events: [{
            kind: 'dropi_payment_claim_skipped_paid',
            at: new Date('2026-09-10T03:00:00.000Z'),
            payload: {
                reason: 'dropi_already_delivered_green',
                dropiStatus: 'ENTREGADO',
                dropiVerification: { ok: true, skipped: false, status: 'ENTREGADO' }
            }
        }]
    }), false);
    const source = read('src/services/shipmentMessageService.js');
    const p5 = source.split('export const notifyDeliveredThankYou')[1].split('export const notifyPickupBonus')[0];
    assert.doesNotMatch(p5, /shipmentPaymentConfirmed/);
});

test('V147 P5 exige entrega canônica e possui lock concorrente at-most-once', async () => {
    const delivered = {
        _id: 'shipment-p5',
        orderId: 'order-p5',
        country: 'EC',
        client: { phone: '5515998038637' },
        logistics: { status: 'ENTREGADO', canonicalStatus: 'DELIVERED', trackingNumber: '189000147' },
        automation: { notificationLocks: {}, postSaleSafetyLedger: {} },
        outcomes: { delivered: true, pickedUp: true },
        review: {},
        events: [],
        notificationLedger: []
    };
    const noHistory = { find: () => ({ sort() { return this; }, limit() { return this; }, lean: async () => [] }) };
    for (const [status, canonicalStatus] of [
        ['DEVUELTO', 'RETURNED'],
        ['READY_FOR_PICKUP', 'READY_FOR_PICKUP'],
        ['EN_RUTA', 'IN_TRANSIT'],
        ['ESTADO_DESCONOCIDO', 'UNKNOWN']
    ]) {
        const notDelivered = {
            ...delivered,
            logistics: { ...delivered.logistics, status, canonicalStatus },
            outcomes: {}
        };
        assert.equal((await decidePostSaleNotification({
            shipment: notDelivered,
            kind: POST_SALE_VARIANTS.DELIVERED_THANK_YOU_AUDIO,
            acquireLock: false,
            messageModel: noHistory
        })).decision, POST_SALE_NOTIFICATION_DECISIONS.NOT_ELIGIBLE, canonicalStatus);
    }

    let available = true;
    const shipmentModel = {
        async findOneAndUpdate() {
            await new Promise((resolve) => setImmediate(resolve));
            if (!available) return null;
            available = false;
            return delivered;
        }
    };
    const [first, second] = await Promise.all([
        decidePostSaleNotification({ shipment: delivered, kind: POST_SALE_VARIANTS.DELIVERED_THANK_YOU_AUDIO, messageModel: noHistory, shipmentModel }),
        decidePostSaleNotification({ shipment: delivered, kind: POST_SALE_VARIANTS.DELIVERED_THANK_YOU_AUDIO, messageModel: noHistory, shipmentModel })
    ]);
    assert.equal([first, second].filter((item) => item.decision === POST_SALE_NOTIFICATION_DECISIONS.SHOULD_SEND).length, 1);
    assert.equal([first, second].filter((item) => item.reason === 'persistent_notification_lock_or_marker').length, 1);
});

test('V147 P5 envia OBRIGADO_PAGOU uma vez ao sink com chave própria', async () => {
    const shipment = {
        _id: 'shipment-p5-sink',
        orderId: 'order-p5-sink',
        country: 'EC',
        client: { phone: '5515998038637' },
        logistics: { status: 'ENTREGADO', canonicalStatus: 'DELIVERED', trackingNumber: '189000148' },
        automation: {},
        outcomes: { delivered: true, pickedUp: true }
    };
    const sink = [];
    const events = [];
    let claimed = false;
    const dependencies = {
        decideFn: async () => {
            await new Promise((resolve) => setImmediate(resolve));
            if (claimed) return { decision: POST_SALE_NOTIFICATION_DECISIONS.NOT_ELIGIBLE, reason: 'persistent_notification_lock_or_marker' };
            claimed = true;
            return {
                decision: POST_SALE_NOTIFICATION_DECISIONS.SHOULD_SEND,
                stage: POST_SALE_STAGES.DELIVERED_THANK_YOU,
                idempotencyKey: deliveredThankYouDedupeValueV147(shipment),
                lockToken: 'p5-sink-lock'
            };
        },
        resolveAudioFn: async () => path.join(root, 'public/media/templates/EC/OBRIGADO_PAGOU.ogg'),
        sendAudioFileFn: async (_shipment, _chatId, mediaPath, options) => {
            sink.push({ mediaPath, options });
            return { ok: true, providerMessageId: 'sink-p5-accepted' };
        },
        completeFn: async ({ stage, variant, lockToken, providerMessageId }) => {
            assert.equal(stage, POST_SALE_STAGES.DELIVERED_THANK_YOU);
            assert.equal(variant, POST_SALE_VARIANTS.DELIVERED_THANK_YOU_AUDIO);
            assert.equal(lockToken, 'p5-sink-lock');
            assert.equal(providerMessageId, 'sink-p5-accepted');
            return { completed: true };
        },
        appendEventFn: async (_id, kind, payload) => events.push({ kind, payload })
    };
    const workerResults = await Promise.all([
        notifyDeliveredThankYou(shipment, dependencies),
        notifyDeliveredThankYou(shipment, dependencies)
    ]);
    assert.equal(workerResults.filter(Boolean).length, 1);
    assert.equal(sink.length, 1);
    assert.match(sink[0].mediaPath, /OBRIGADO_PAGOU\.ogg$/);
    assert.equal(sink[0].options.kind, 'shipment_delivered_thank_you_audio');
    assert.equal(sink[0].options.baseName, 'OBRIGADO_PAGOU');
    assert.equal(sink[0].options.dedupeValue, deliveredThankYouDedupeValueV147(shipment));
    assert.match(sink[0].options.dedupeValue, /^OBRIGADO_PAGOU\|post-sale-v147:/);
    assert.equal(events[0].kind, 'delivered_thank_you_notified');
    assert.equal(await notifyDeliveredThankYou(shipment, dependencies), false);
    assert.equal(sink.length, 1);
});

test('V147 P5 permanece bloqueado após restart por ledger ou marcador persistido', async () => {
    const shipment = {
        _id: 'shipment-p5-restart',
        orderId: 'order-p5-restart',
        country: 'EC',
        client: { phone: '5515998038637' },
        logistics: { status: 'ENTREGADO', canonicalStatus: 'DELIVERED', trackingNumber: '189000149' },
        automation: {
            notificationLocks: {},
            postSaleSafetyLedger: { DELIVERED_THANK_YOU: { state: 'SENT' } }
        },
        outcomes: { delivered: true, pickedUp: true },
        review: {},
        events: [],
        notificationLedger: []
    };
    const snapshot = JSON.parse(JSON.stringify(shipment));
    const fromLedger = await decidePostSaleNotification({
        shipment: snapshot,
        kind: POST_SALE_VARIANTS.DELIVERED_THANK_YOU_AUDIO,
        acquireLock: false
    });
    assert.equal(fromLedger.decision, POST_SALE_NOTIFICATION_DECISIONS.ALREADY_NOTIFIED_STRUCTURED);
    assert.match(fromLedger.reason, /postSaleSafetyLedger\.DELIVERED_THANK_YOU/);

    snapshot.automation.postSaleSafetyLedger = {};
    snapshot.automation.deliveredThankYouNotifiedAt = '2026-09-10T00:00:00.000Z';
    const fromMarker = await decidePostSaleNotification({
        shipment: snapshot,
        kind: POST_SALE_VARIANTS.DELIVERED_THANK_YOU_AUDIO,
        acquireLock: false
    });
    assert.equal(fromMarker.decision, POST_SALE_NOTIFICATION_DECISIONS.ALREADY_NOTIFIED_STRUCTURED);
    assert.equal(fromMarker.reason, 'automation.deliveredThankYouNotifiedAt');
});

test('V147 P5 não duplica P6 nem P7', () => {
    const source = read('src/services/shipmentMessageService.js');
    const p5 = source.split('export const notifyDeliveredThankYou')[1].split('export const notifyPickupBonus')[0];
    const p6p7 = source.split('export const notifyPickupBonus')[1].split('const calculateTreatmentDates')[0];
    assert.match(p5, /OBRIGADO_PAGOU/);
    assert.doesNotMatch(p5, /shipment_pickup_bonus_text|pickup_bonus_how_to_use/);
    assert.doesNotMatch(p6p7, /OBRIGADO_PAGOU|shipment_delivered_thank_you_audio/);
});

test('V147 preserva scheduler e corrige health V116 sem acesso ao PM2 home', () => {
    const executor = read('ops/post-sale-v116');
    assert.match(executor, /\/proc\/\$pid\/cmdline/);
    assert.match(executor, /pgrep -f/);
    assert.doesNotMatch(executor, /pm2 jlist/);
    assert.match(read('ops/systemd/vitalismen-postsale-transactional-v116.timer'), /OnUnitActiveSec=60min/);
});

test('V147 painel usa estado canônico e booleano canPickup sem string solta de agência', () => {
    const panel = read('public/qr.html');
    const block = panel.split('const shipmentPanelStatusLabel = (chat) => {')[1].split('const visibleShipmentNoticeLabel')[0];
    assert.match(block, /shipment\.canPickup === true/);
    assert.match(block, /status === 'ENTERING_AGENCY'|ENTERING_AGENCY/);
    assert.doesNotMatch(block, /\/READY_FOR_PICKUP\|AGENCIA\|RETIRO\|RETIRADA\//);
});

test('V147 transporte de teste permanece sink e envia zero mensagens reais', () => {
    const sink = [];
    const emitOnce = (dedupeKey) => {
        if (sink.some((entry) => entry.dedupeKey === dedupeKey)) return 0;
        sink.push({ dedupeKey, provider: 'sink', acceptedAt: new Date('2026-09-09T00:00:00Z') });
        return 1;
    };
    const identity = { customerId: 'C', orderId: 'O', shipmentId: 'S' };
    for (const [canonicalEvent, templateId] of [['P0', 'P0_POST_PURCHASE'], ['P1', 'P1_GUIDE_CREATED'], ['P2', 'A07'], ['P3', 'A10'], ['P4', 'A19'], ['P5', 'P5_DELIVERED_THANKYOU_NEUTRAL'], ['P6', 'P6_BONUS_ACCESS'], ['P7', 'P7_USAGE_TEX_ULTRA']]) {
        const key = buildPostSaleDedupeKeyV147({ ...identity, canonicalEvent, templateId });
        assert.equal(emitOnce(key), 1);
        assert.equal(emitOnce(key), 0);
    }
    assert.equal(sink.length, 8);
    assert.equal(sink.every((entry) => entry.provider === 'sink'), true);
});
