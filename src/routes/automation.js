import express from 'express';
import Order from '../models/Order.js';
import Shipment from '../models/Shipment.js';
import ContactState from '../models/ContactState.js';
import { authMiddleware } from '../middleware/auth.js';
import { getAllStatuses } from '../whatsapp/connection.js';
import { getQueueSize } from '../whatsapp/queue.js';
import { getSenderPoolStatus } from '../whatsapp/sessionRouter.js';
import { automationAllowedRecipients, automationPilotOnly } from '../whatsapp/automationSafety.js';
import { listReengagementCandidates } from '../services/reengagementService.js';
import { countAdminPanelAtendimentoGaps } from '../services/adminPanelLeadReconciliationService.js';
import {
    countCarrierStatusSweepCandidates,
    countShipmentDispatchCandidates,
    getShipmentDispatchState
} from '../services/shipmentStatusDispatcherService.js';

const router = express.Router();

router.use(authMiddleware);

const flag = (name) => String(process.env[name] || '').toLowerCase() === 'true';
const enabledUnlessOne = (name) => String(process.env[name] || '') !== '1';
const maskedTokenLength = (name) => String(process.env[name] || '').length;
const digitsOnly = (value = '') => String(value || '').replace(/\D/g, '');

const manualReviewShipmentQuery = {
    country: 'EC',
    $or: [
        { 'review.manualOnly': true },
        { 'review.reviewStatus': 'manual_send_required' }
    ]
};

const phoneTailCandidates = (phone = '') => {
    const digits = digitsOnly(phone);
    return [...new Set([
        digits,
        digits.length >= 10 ? digits.slice(-10) : '',
        digits.length >= 9 ? digits.slice(-9) : '',
        digits.length >= 8 ? digits.slice(-8) : ''
    ].filter(Boolean))];
};

const manualReviewAlertAnchor = (shipment = {}) => {
    const reviewEvents = Array.isArray(shipment.events)
        ? shipment.events.filter((event) => ['manual_send_required', 'manual_review_updated'].includes(String(event.kind || '')))
        : [];
    const latestReviewEvent = reviewEvents
        .map((event) => new Date(event.at || 0))
        .filter((date) => Number.isFinite(date.getTime()))
        .sort((a, b) => b.getTime() - a.getTime())[0];
    return latestReviewEvent || new Date(shipment.createdAt || 0);
};

const manualReviewAlertIsActive = (shipment = {}) => {
    const acknowledgedAt = shipment.automation?.opsAlertAcknowledgedAt
        ? new Date(shipment.automation.opsAlertAcknowledgedAt)
        : null;
    if (!acknowledgedAt || !Number.isFinite(acknowledgedAt.getTime())) return true;
    return acknowledgedAt < manualReviewAlertAnchor(shipment);
};

const acknowledgeManualReviewAlert = async ({ orderId = '', phone = '', user = null } = {}) => {
    const tails = phoneTailCandidates(phone);
    const targetClauses = [
        ...(orderId ? [{ orderId }] : []),
        ...tails.map((tail) => ({ 'client.phone': { $regex: `${tail}$` } }))
    ];
    if (!targetClauses.length) return { matched: 0, modified: 0 };
    const query = {
        $and: [
            manualReviewShipmentQuery,
            { $or: targetClauses }
        ]
    };

    const shipments = await Shipment.find(query).limit(12);
    const now = new Date();
    let modified = 0;
    for (const shipment of shipments) {
        shipment.automation.opsAlertAcknowledgedAt = now;
        shipment.automation.opsAlertAcknowledgedBy = user?.email || user?.name || 'painel';
        shipment.automation.opsAlertAcknowledgedKind = 'manual_review';
        shipment.events.push({
            kind: 'ops_alert_acknowledged',
            at: now,
            payload: {
                kind: 'manual_review',
                orderId: shipment.orderId,
                phone: shipment.client?.phone || phone || '',
                by: user?.email || user?.name || 'painel'
            }
        });
        shipment.events = shipment.events.slice(-60);
        await shipment.save();
        modified += 1;
    }
    return { matched: shipments.length, modified };
};

const acknowledgeReengagementAlert = async ({ chatId = '', phone = '', user = null } = {}) => {
    const rawChatId = String(chatId || '').trim();
    const tails = phoneTailCandidates(phone || chatId);
    const query = {
        $or: [
            ...(rawChatId ? [{ chatId: rawChatId }] : []),
            ...tails.map((tail) => ({ phoneDigits: { $regex: `${tail}$` } })),
            ...tails.map((tail) => ({ chatId: { $regex: tail } }))
        ]
    };
    if (!query.$or.length) return { matched: 0, modified: 0 };
    const result = await ContactState.updateMany(query, {
        $set: {
            'metadata.operationalAlerts.reengagementAcknowledgedAt': new Date(),
            'metadata.operationalAlerts.reengagementAcknowledgedBy': user?.email || user?.name || 'painel',
            'metadata.lastHumanActionAt': new Date(),
            'metadata.lastHumanAction': 'ops_alert_opened'
        }
    });
    return { matched: result.matchedCount || 0, modified: result.modifiedCount || 0 };
};

const buildPipelineNotes = ({ flags, counts }) => {
    const notes = [];

    if (!flags.scheduler.enabled) {
        notes.push({
            kind: 'paused',
            label: 'Agendador pausado',
            detail: 'Recuperacao de rascunho, funil pendente e avisos de entrega nao rodam em ciclo automatico.'
        });
    }
    notes.push({
        kind: 'locked',
        label: 'Automacoes paralelas removidas',
        detail: 'Funil legado, recuperacao de rascunho e scheduler automatico de entrega foram removidos do agendador.'
    });
    if (!flags.meta.ecConfigured) {
        notes.push({
            kind: 'attention',
            label: 'Meta/Facebook incompleto',
            detail: 'Eventos Purchase do Equador so serao enviados com Pixel ID e token configurados.'
        });
    }
    if (counts.dropiPaymentRequired > 0) {
        notes.push({
            kind: 'blocked',
            label: 'Dropi aguardando saldo',
            detail: `${counts.dropiPaymentRequired} pedido(s) chegaram ate a etapa de envio e pararam apenas no saldo.`
        });
    }
    if (counts.adminPanelAtendimentoGaps > 0) {
        notes.push({
            kind: 'attention',
            label: 'Atendimento fora do painel',
            detail: `${counts.adminPanelAtendimentoGaps} lead(s) em atendimento ainda precisam sincronizar com o Painel Unificado.`
        });
    }

    return notes;
};

router.get('/status', async (_req, res) => {
    try {
        const now = new Date();
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const flags = {
            scheduler: {
                enabled: enabledUnlessOne('DISABLE_SCHEDULER'),
                env: String(process.env.DISABLE_SCHEDULER || '0') === '1' ? 'DISABLE_SCHEDULER=1' : 'ativo'
            },
            autoReply: {
                enabled: flag('WHATSAPP_AUTO_REPLY_ENABLED')
            },
            funnel: {
                enabled: flag('WHATSAPP_FUNNEL_ENABLED')
            },
            productFollowup: {
                enabled: flag('WHATSAPP_PRODUCT_FOLLOWUP_ENABLED') || process.env.WHATSAPP_PRODUCT_FOLLOWUP_ENABLED === undefined
            },
            shipments: {
                enabled: flag('SHIPMENT_STATUS_DISPATCH_ENABLED'),
                actions: String(process.env.SHIPMENT_STATUS_DISPATCH_ACTIONS || 'ready_for_pickup')
                    .split(',')
                    .map((item) => item.trim())
                    .filter(Boolean),
                intervalMinutes: Number.parseInt(process.env.SHIPMENT_STATUS_DISPATCH_INTERVAL_MINUTES || '60', 10),
                batchLimit: Number.parseInt(process.env.SHIPMENT_STATUS_DISPATCH_BATCH_LIMIT || '3', 10),
                state: getShipmentDispatchState()
            },
            carrierSweep: {
                enabled: process.env.SHIPMENT_CARRIER_STATUS_SWEEP_ENABLED === undefined
                    ? true
                    : flag('SHIPMENT_CARRIER_STATUS_SWEEP_ENABLED'),
                intervalMinutes: Number.parseInt(process.env.SHIPMENT_CARRIER_STATUS_SWEEP_INTERVAL_MINUTES || '60', 10),
                batchLimit: Number.parseInt(process.env.SHIPMENT_CARRIER_STATUS_SWEEP_BATCH_LIMIT || '6', 10)
            },
            adminPanelImport: {
                enabled: flag('ADMIN_PANEL_IMPORT_ENABLED'),
                intervalMinutes: Number.parseInt(process.env.ADMIN_PANEL_IMPORT_INTERVAL_MINUTES || '5', 10),
                lookbackHours: Number.parseInt(process.env.ADMIN_PANEL_IMPORT_LOOKBACK_HOURS || '168', 10)
            },
            meta: {
                ecConfigured: Boolean(process.env.META_PIXEL_ID_EC && process.env.META_ACCESS_TOKEN_EC),
                ecPixelId: process.env.META_PIXEL_ID_EC || '',
                ecTokenConfigured: Boolean(process.env.META_ACCESS_TOKEN_EC),
                ecTokenLength: maskedTokenLength('META_ACCESS_TOKEN_EC'),
                testMode: Boolean(process.env.META_TEST_EVENT_CODE_EC || process.env.META_TEST_EVENT_CODE)
            },
            pilot: {
                enabled: automationPilotOnly(),
                allowedRecipients: automationAllowedRecipients()
            }
        };

        const [
            dropiPaymentRequired,
            buyLater,
            humanHeld,
            recentShipmentCandidates,
            reengagementCandidates,
            adminPanelGaps,
            shipmentDispatchCandidates,
            carrierSweepCandidates
        ] = await Promise.all([
            Shipment.countDocuments({
                $or: [
                    { 'review.reviewStatus': 'dropi_payment_required' },
                    { 'automation.browserCheckpoint': 'dropi_payment_required' }
                ]
            }),
            Order.countDocuments({
                $or: [
                    { 'purchaseIntent.readiness': 'buy_later' },
                    { 'purchaseIntent.followUpAt': { $exists: true, $ne: null } }
                ]
            }),
            ContactState.countDocuments({
                'human.mode': 'manual',
                $or: [
                    { 'human.pausedUntil': { $exists: false } },
                    { 'human.pausedUntil': null },
                    { 'human.pausedUntil': { $gt: now } }
                ]
            }),
            Shipment.countDocuments({
                country: 'EC',
                updatedAt: { $gte: thirtyDaysAgo },
                'client.phone': { $exists: true, $ne: '' },
                $or: [
                    { 'automation.guiaNotifiedAt': { $exists: false } },
                    { 'automation.readyForPickupNotifiedAt': { $exists: false } },
                    { 'automation.returnedNotifiedAt': { $exists: false } }
                ]
            }),
            listReengagementCandidates({ hours: 48, limit: 20 }).catch(() => []),
            countAdminPanelAtendimentoGaps({
                fromId: Number.parseInt(process.env.ADMIN_PANEL_ATENDIMENTO_FROM_ID || '1725', 10) || 1725
            }).catch(() => ({ ok: false, adminNovoInManual: 0, manualWithoutAdmin: 0 })),
            countShipmentDispatchCandidates({
                actions: String(process.env.SHIPMENT_STATUS_DISPATCH_ACTIONS || 'ready_for_pickup')
                    .split(',')
                    .map((item) => item.trim())
                    .filter(Boolean)
            }).catch(() => 0),
            countCarrierStatusSweepCandidates().catch(() => 0)
        ]);

        const dropiBlockedOrders = await Shipment.find({
            $or: [
                { 'review.reviewStatus': 'dropi_payment_required' },
                { 'automation.browserCheckpoint': 'dropi_payment_required' }
            ]
        })
            .sort({ updatedAt: -1 })
            .limit(12)
            .lean();

        const manualReviewOrdersAll = await Shipment.find(manualReviewShipmentQuery)
            .sort({ updatedAt: -1 })
            .limit(60)
            .lean();
        const manualReviewOrders = manualReviewOrdersAll.filter(manualReviewAlertIsActive).slice(0, 12);

        const counts = {
            dropiPaymentRequired,
            manualSendRequired: manualReviewOrdersAll.filter(manualReviewAlertIsActive).length,
            buyLater,
            humanHeld,
            shipmentNotificationCandidates: recentShipmentCandidates,
            shipmentDispatchCandidates,
            carrierSweepCandidates,
            reengagementCandidates: reengagementCandidates.length,
            adminPanelAtendimentoGaps: (adminPanelGaps.adminNovoInManual || 0) + (adminPanelGaps.manualWithoutAdmin || 0),
            adminPanelNovoEmAtendimento: adminPanelGaps.adminNovoInManual || 0,
            whatsappAtendimentoSemPainel: adminPanelGaps.manualWithoutAdmin || 0,
            whatsappQueue: getQueueSize()
        };

        res.json({
            timestamp: now.toISOString(),
            flags,
            whatsapp: {
                sessions: getAllStatuses(),
                senderPool: getSenderPoolStatus()
            },
            counts,
            dropiBlockedOrders: dropiBlockedOrders.map((shipment) => ({
                orderId: shipment.orderId,
                country: shipment.country,
                clientName: shipment.client?.name || '',
                city: shipment.client?.city || '',
                province: shipment.client?.province || '',
                carrier: shipment.logistics?.distributionCompany || shipment.logistics?.chosenCarrier || '',
                checkpoint: shipment.automation?.browserCheckpoint || '',
                reason: shipment.automation?.browserLastError || shipment.review?.reviewReason || ''
            })),
            manualReviewOrders: manualReviewOrders.map((shipment) => ({
                orderId: shipment.orderId,
                country: shipment.country,
                clientName: shipment.client?.name || '',
                phone: shipment.client?.phone || '',
                city: shipment.client?.city || '',
                province: shipment.client?.province || '',
                logisticsStatus: shipment.logistics?.status || '',
                trackingNumber: shipment.logistics?.trackingNumber || '',
                reviewStatus: shipment.review?.reviewStatus || '',
                reason: shipment.review?.reviewReason || shipment.automation?.browserLastError || ''
            })),
            reengagementCandidates: reengagementCandidates.slice(0, 12).map((candidate) => ({
                chatId: candidate.chatId || '',
                phone: candidate.phone || '',
                lastInboundAt: candidate.lastInboundAt || '',
                lastInboundText: candidate.lastInboundText || '',
                ageHours: candidate.ageHours || 0,
                templateKey: candidate.templateKey || ''
            })),
            notes: buildPipelineNotes({ flags, counts })
        });
    } catch (error) {
        console.error('Automation status error:', error);
        res.status(500).json({ error: 'Failed to load automation status' });
    }
});

router.post('/alerts/acknowledge', async (req, res) => {
    try {
        const kind = String(req.body?.kind || '').trim();
        const phone = String(req.body?.phone || '').trim();
        const chatId = String(req.body?.chatId || '').trim();
        const orderId = String(req.body?.orderId || '').trim();
        const results = {};

        if (kind === 'manual_review' || orderId) {
            results.manualReview = await acknowledgeManualReviewAlert({ orderId, phone, user: req.user });
        }
        if (kind === 'reengagement' || chatId) {
            results.reengagement = await acknowledgeReengagementAlert({ chatId, phone, user: req.user });
        }

        res.json({ ok: true, results });
    } catch (error) {
        console.error('Automation alert acknowledge error:', error);
        res.status(500).json({ error: 'Failed to acknowledge operational alert' });
    }
});

export default router;
