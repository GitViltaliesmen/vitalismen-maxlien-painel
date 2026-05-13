import express from 'express';
import { spawnSync } from 'child_process';
import { authMiddleware, adminOnly } from '../middleware/auth.js';
import Shipment from '../models/Shipment.js';
import { upsertDroppiEcuadorShipment } from '../services/droppiEcuadorService.js';
import {
    notifyReadyForPickup,
    notifyPickupBonus,
    notifyPickupProofRequest,
    notifyShipmentGuideGenerated,
    notifyTreatmentRefillReminder,
    processPickupProofSweep,
    notifyShipmentReturned
} from '../services/shipmentMessageService.js';
import Order from '../models/Order.js';
import { importDroppiEcuadorText } from '../services/droppiEcuadorImportService.js';
import {
    prepareDroppiEcuadorOrderForManualSubmit,
    submitDroppiEcuadorOrder,
    syncDroppiEcuadorFromPanel
} from '../services/droppiEcuadorBrowserService.js';
import { markOnlineAdminPedidoEnviado } from '../services/adminPanelStatusService.js';
import {
    getShipmentDispatchState,
    processShipmentStatusDispatch,
    setShipmentDispatchPaused
} from '../services/shipmentStatusDispatcherService.js';
import { findServientregaEcuadorAgencies } from '../services/servientregaEcuadorAgencyService.js';
import { markSenderWalletDelivered } from '../whatsapp/sessionRouter.js';

const router = express.Router();

router.use(authMiddleware);

const getAdminLeadIdFromOrderId = (orderId) => {
    const match = String(orderId || '').match(/^EC-ADMIN-(\d+)$/i);
    return match ? Number.parseInt(match[1], 10) : null;
};

const markAdminLeadCancelled = ({ orderId, user = null, reason = 'fake_order_deleted' } = {}) => {
    const leadId = getAdminLeadIdFromOrderId(orderId);
    if (!leadId) return { ok: false, skipped: true, reason: 'not_admin_lead' };

    const python = `
import sqlite3, json, datetime
db_path = "/opt/maxlien-mvp/leads_ec.sqlite3"
lead_id = int(${JSON.stringify(leadId)})
reason = ${JSON.stringify(reason)}
user = ${JSON.stringify(user?.email || user?.name || 'panel')}
stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
con = sqlite3.connect(db_path)
cur = con.cursor()
row = cur.execute("SELECT status, notes FROM leads WHERE id=?", (lead_id,)).fetchone()
if not row:
    print(json.dumps({"ok": False, "reason": "lead_not_found", "leadId": lead_id}))
else:
    old_status, notes = row
    marker = f"[{stamp}] Pedido fake removido do painel novo por {user}; nao enviar para Dropi. Motivo: {reason}"
    new_notes = ((notes or "") + "\\n" + marker).strip()
    cur.execute("UPDATE leads SET status=?, notes=?, updated_at=? WHERE id=?", ("cancelado", new_notes, stamp, lead_id))
    cur.execute("INSERT INTO lead_status_history (lead_id, old_status, new_status, created_at) VALUES (?, ?, ?, ?)", (lead_id, old_status, "cancelado", stamp))
    cur.execute("INSERT INTO lead_history (lead_id, action, old_value, new_value, created_at) VALUES (?, ?, ?, ?, ?)", (lead_id, "fake_order_deleted", old_status or "", "cancelado", stamp))
    con.commit()
    print(json.dumps({"ok": True, "leadId": lead_id, "oldStatus": old_status, "newStatus": "cancelado"}))
con.close()
`;

    const result = spawnSync('python3', ['-'], {
        input: python,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024
    });
    if (result.status !== 0) {
        return {
            ok: false,
            reason: 'admin_lead_cancel_failed',
            error: result.stderr || result.stdout || `exit_${result.status}`
        };
    }
    try {
        return JSON.parse(result.stdout || '{}');
    } catch (error) {
        return { ok: false, reason: 'admin_lead_cancel_invalid_json', error: error.message };
    }
};

const markManualSendRequired = async (shipment, { reason = 'dropi_rejected', error = '', user = null } = {}) => {
    shipment.review.manualOnly = true;
    shipment.review.reviewReason = reason;
    shipment.review.reviewStatus = 'manual_send_required';
    shipment.automation.browserCheckpoint = 'manual_send_required';
    shipment.automation.browserLastError = error || shipment.automation.browserLastError || reason;
    shipment.events.push({
        kind: 'manual_send_required',
        at: new Date(),
        payload: {
            reason,
            error,
            requestedBy: user?.email || user?.name || ''
        }
    });
    shipment.events = shipment.events.slice(-60);
    await shipment.save();
    return shipment;
};

const markDropiPaymentRequired = async (shipment, { reason = 'dropi_payment_required', error = '', user = null } = {}) => {
    shipment.review.manualOnly = false;
    shipment.review.reviewReason = reason;
    shipment.review.reviewStatus = 'dropi_payment_required';
    shipment.automation.browserCheckpoint = 'dropi_payment_required';
    shipment.automation.browserLastError = error || shipment.automation.browserLastError || reason;
    shipment.events.push({
        kind: 'dropi_payment_required',
        at: new Date(),
        payload: {
            reason,
            error,
            requestedBy: user?.email || user?.name || ''
        }
    });
    shipment.events = shipment.events.slice(-60);
    await shipment.save();
    return shipment;
};

const describeDropiSubmitFailure = (value, fallback = 'Dropi rejeitou o envio. Pedido marcado para envio manual.') => {
    const text = String(value || '');
    if (/two-factor|2fa|autenticaci[oó]n de dos factores|dois fatores/i.test(text)) {
        return 'Dropi pediu autenticacao de dois fatores. Atualize a sessao Dropi antes de tentar enviar novamente.';
    }
    if (/missing DROPI_EC_EMAIL|missing DROPI_EC_PASSWORD|credenciais|credentials/i.test(text)) {
        return 'Credenciais Dropi ausentes ou nao carregadas no servidor. Corrija o login Dropi antes de enviar.';
    }
    if (/XServer|DISPLAY|headed browser|navegador visual/i.test(text)) {
        return 'Preparar Dropi exige navegador visual e nao funciona no VPS. Use Enviar para Dropi ou envio manual.';
    }
    return fallback;
};

const markManualSent = async (shipment, { note = '', user = null } = {}) => {
    shipment.review.manualOnly = false;
    shipment.review.reviewStatus = 'manual_sent';
    shipment.review.reviewReason = '';
    shipment.automation.submittedToDroppiAt = shipment.automation.submittedToDroppiAt || new Date();
    shipment.automation.browserCheckpoint = 'manual_sent';
    shipment.automation.browserLastError = '';
    if (!shipment.logistics.status || shipment.logistics.status === 'created') {
        shipment.logistics.status = 'PENDIENTE';
    }
    shipment.events.push({
        kind: 'droppi_order_manual_sent',
        at: new Date(),
        payload: {
            note,
            markedBy: user?.email || user?.name || ''
        }
    });
    shipment.events = shipment.events.slice(-60);
    await shipment.save();

    await Order.updateOne(
        { orderId: shipment.orderId },
        { $set: { status: 'processing' } }
    ).catch(() => null);

    const adminStatusResult = await markOnlineAdminPedidoEnviado({
        orderId: shipment.orderId,
        country: shipment.country || 'EC'
    }).catch((error) => ({ ok: false, error: error.message || 'admin_status_update_failed' }));
    if (adminStatusResult?.ok) {
        shipment.events.push({
            kind: 'online_admin_status_updated',
            at: new Date(),
            payload: adminStatusResult
        });
        shipment.events = shipment.events.slice(-60);
        await shipment.save();
    } else if (!adminStatusResult?.skipped) {
        console.warn('Online admin status update failed for manual sent:', adminStatusResult);
    }

    return shipment;
};

const ensureShipmentForOrder = async (order, country) => {
    let shipment = await Shipment.findOne({ orderId: order.orderId });
    if (shipment) return shipment;
    return upsertDroppiEcuadorShipment({
        orderId: order.orderId,
        productName: 'Vit Power',
        clientName: order.customer?.name || '',
        phone: order.customer?.phone || '',
        address: order.customer?.address || '',
        city: order.customer?.city || '',
        province: order.customer?.province || '',
        reference: order.customer?.reference || '',
        status: 'created'
    });
};

const getSubmittedDropiOrderId = (order, shipment) => String(
    order?.dropiOrderId
    || shipment?.raw?.droppiOrder?.id
    || shipment?.raw?.droppiOrder?.order_id
    || shipment?.raw?.droppiOrder?.orderId
    || ''
).trim();

const alreadySubmittedResponse = (order, shipment) => {
    const dropiOrderId = getSubmittedDropiOrderId(order, shipment);
    if (!dropiOrderId && !shipment?.automation?.submittedToDroppiAt) return null;
    return {
        ok: true,
        alreadySubmitted: true,
        dropiOrderId,
        shipment,
        message: dropiOrderId
            ? `Pedido ja enviado para Dropi. ID ${dropiOrderId}.`
            : 'Pedido ja marcado como enviado para Dropi.'
    };
};

const normalizeBatchLimit = (value, fallback = 3, max = 10) => {
    const parsed = Number.parseInt(value || fallback, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.min(parsed, max);
};

const looksLikeEcuadorOrder = (order, shipment) => {
    const phoneDigits = String(order?.customer?.phone || shipment?.client?.phone || '').replace(/\D/g, '');
    const province = String(order?.customer?.province || shipment?.client?.province || '').trim().toUpperCase();
    const city = String(order?.customer?.city || shipment?.client?.city || '').trim().toUpperCase();
    if (phoneDigits.startsWith('55')) return false;
    if (/^(SP|RJ|MG|PR|SC|RS|BA|GO|PE|CE)$/i.test(province)) return false;
    if (/SOROCABA|SAO PAULO|SÃO PAULO|CAMPINAS|RIO DE JANEIRO/i.test(city)) return false;
    if (phoneDigits.startsWith('593')) return true;
    return phoneDigits.length >= 8 && phoneDigits.length <= 10 && /^0?9/.test(phoneDigits);
};

const isAuthorizedForDropiSubmit = (shipment) => Boolean(shipment?.automation?.dropiSubmitAuthorizedAt);

const getPendingDropiEcOrders = async (limit = 3) => {
    const orders = await Order.find({
        country: 'EC',
        status: 'confirmed'
    }).sort({ updatedAt: 1, createdAt: 1 }).limit(Math.max(limit * 3, limit));

    const candidates = [];
    for (const order of orders) {
        const shipment = await ensureShipmentForOrder(order, 'EC');
        if (alreadySubmittedResponse(order, shipment)) continue;
        if (shipment.review?.manualOnly) continue;
        if (shipment.review?.reviewStatus === 'dropi_payment_required') continue;
        if (!isAuthorizedForDropiSubmit(shipment)) continue;
        if (!looksLikeEcuadorOrder(order, shipment)) continue;
        candidates.push({ order, shipment });
        if (candidates.length >= limit) break;
    }
    return candidates;
};

router.get('/', adminOnly, async (req, res) => {
    try {
        const { country, status, search } = req.query;
        const query = {};
        if (country) query.country = country;
        if (status) query['logistics.status'] = status;
        if (search) {
            query.$or = [
                { orderId: { $regex: search, $options: 'i' } },
                { 'client.name': { $regex: search, $options: 'i' } },
                { 'client.phone': { $regex: search, $options: 'i' } },
                { 'logistics.trackingNumber': { $regex: search, $options: 'i' } }
            ];
        }

        const shipments = await Shipment.find(query).sort({ updatedAt: -1 }).limit(200);
        res.json({ shipments });
    } catch (error) {
        console.error('Get shipments error:', error);
        res.status(500).json({ error: 'Failed to fetch shipments' });
    }
});

router.get('/manual-queue', adminOnly, async (_req, res) => {
    try {
        const shipments = await Shipment.find({
            $or: [
                { 'review.manualOnly': true },
                { 'logistics.status': 'NOVEDAD' },
                { 'logistics.status': 'DEVUELTO' },
                { 'logistics.trackingNumber': '' }
            ]
        }).sort({ updatedAt: -1 }).limit(200);

        res.json({ shipments });
    } catch (error) {
        console.error('Manual queue error:', error);
        res.status(500).json({ error: 'Failed to fetch manual queue' });
    }
});

router.get('/dispatch/status', adminOnly, async (_req, res) => {
    res.json(getShipmentDispatchState());
});

router.post('/dispatch/pause', adminOnly, async (req, res) => {
    const { reason = 'manual_pause' } = req.body || {};
    res.json(setShipmentDispatchPaused(true, reason));
});

router.post('/dispatch/resume', adminOnly, async (req, res) => {
    const { reason = 'manual_resume' } = req.body || {};
    res.json(setShipmentDispatchPaused(false, reason));
});

router.post('/dispatch/run', adminOnly, async (req, res) => {
    try {
        const {
            limit = process.env.SHIPMENT_STATUS_DISPATCH_BATCH_LIMIT || 5,
            dryRun = false,
            force = false,
            actions = []
        } = req.body || {};
        const result = await processShipmentStatusDispatch({
            limit,
            dryRun: Boolean(dryRun),
            force: Boolean(force),
            actions
        });
        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('Shipment dispatch run error:', error);
        res.status(500).json({ error: error.message || 'Failed to run shipment dispatch' });
    }
});

router.get('/servientrega/ec/agencies', adminOnly, async (req, res) => {
    try {
        const { city = '', province = '', q = '', limit = 5 } = req.query || {};
        const agencies = findServientregaEcuadorAgencies({
            city,
            province,
            query: q,
            limit: Math.min(Number.parseInt(limit, 10) || 5, 10)
        });
        res.json({
            success: true,
            count: agencies.length,
            agencies
        });
    } catch (error) {
        console.error('Servientrega EC agencies lookup error:', error);
        res.status(500).json({ error: error.message || 'Failed to search agencies' });
    }
});

router.post('/droppi/ec/sync', adminOnly, async (req, res) => {
    try {
        const shipment = await upsertDroppiEcuadorShipment(req.body || {});
        res.json({ success: true, shipment });
    } catch (error) {
        console.error('Droppi EC sync error:', error);
        res.status(500).json({ error: error.message || 'Failed to sync shipment' });
    }
});

router.post('/droppi/ec/import-text', adminOnly, async (req, res) => {
    try {
        const { text = '', sessionId = '', autoNotify = true } = req.body || {};
        if (!String(text || '').trim()) {
            return res.status(400).json({ error: 'text is required' });
        }

        const result = await importDroppiEcuadorText({
            text,
            sessionId,
            autoNotify: autoNotify !== false
        });

        res.json({
            success: true,
            imported: result.imported,
            notified: result.notified,
            shipments: result.shipments
        });
    } catch (error) {
        console.error('Droppi EC import-text error:', error);
        res.status(500).json({ error: error.message || 'Failed to import Droppi text' });
    }
});

router.post('/droppi/ec/orders/:orderId/submit', adminOnly, async (req, res) => {
    try {
        const order = await Order.findOne({ orderId: req.params.orderId });
        if (!order) return res.status(404).json({ error: 'Order not found' });

        const shipment = await ensureShipmentForOrder(order, 'EC');

        const alreadySubmitted = alreadySubmittedResponse(order, shipment);
        if (alreadySubmitted) return res.json(alreadySubmitted);
        if (!isAuthorizedForDropiSubmit(shipment)) {
            return res.status(409).json({
                success: false,
                authorizationRequired: true,
                shipment,
                error: 'Pedido precisa ser autorizado antes do envio para Dropi.',
                message: 'Pedido ainda nao foi autorizado para envio na Dropi. Confira os dados e autorize antes de enviar.'
            });
        }

        const result = await submitDroppiEcuadorOrder({ order, shipment });
        if (result?.ok === false) {
            const updatedShipment = await Shipment.findOne({ orderId: order.orderId }) || shipment;
            if (result.paymentRequired || result.reason === 'dropi_payment_required') {
                const paymentShipment = await markDropiPaymentRequired(updatedShipment, {
                    reason: 'dropi_payment_required',
                    error: result.error || result.reason || 'payment_required',
                    user: req.user
                });
                return res.json({
                    ...result,
                    paymentRequired: true,
                    manualSendRequired: false,
                    shipment: paymentShipment,
                    message: 'Dropi chegou ate o envio, mas bloqueou por saldo/credito insuficiente.'
                });
            }
            const manualShipment = await markManualSendRequired(updatedShipment, {
                reason: 'dropi_rejected',
                error: result.error || result.reason || 'submit_failed',
                user: req.user
            });
            return res.json({
                ...result,
                manualSendRequired: true,
                shipment: manualShipment,
                message: describeDropiSubmitFailure(result.error || result.reason)
            });
        }
        res.json(result);
    } catch (error) {
        console.error('Droppi EC submit error:', error);
        try {
            const shipment = await Shipment.findOne({ orderId: req.params.orderId });
            if (shipment) {
                const manualShipment = await markManualSendRequired(shipment, {
                    reason: 'dropi_submit_error',
                    error: error.message || 'Failed to submit Droppi order',
                    user: req.user
                });
                return res.json({
                    ok: false,
                    reason: 'dropi_submit_error',
                    error: error.message || 'Failed to submit Droppi order',
                    manualSendRequired: true,
                    shipment: manualShipment,
                    message: describeDropiSubmitFailure(error.message)
                });
            }
        } catch (markError) {
            console.error('Mark manual send required EC error:', markError);
        }
        res.status(500).json({ error: error.message || 'Failed to submit Droppi order' });
    }
});

router.post('/droppi/ec/orders/:orderId/authorize-submit', adminOnly, async (req, res) => {
    try {
        const order = await Order.findOne({ orderId: req.params.orderId });
        if (!order) return res.status(404).json({ error: 'Order not found' });
        if (order.country !== 'EC') return res.status(400).json({ error: 'Only EC orders can be authorized here' });

        const shipment = await ensureShipmentForOrder(order, 'EC');
        const alreadySubmitted = alreadySubmittedResponse(order, shipment);
        if (alreadySubmitted) return res.json(alreadySubmitted);
        if (!looksLikeEcuadorOrder(order, shipment)) {
            shipment.review.manualOnly = true;
            shipment.review.reviewReason = 'destination_or_phone_not_ecuador';
            shipment.review.reviewStatus = 'invalid_ec_destination_review';
            shipment.events.push({
                kind: 'dropi_submit_authorization_rejected',
                at: new Date(),
                payload: {
                    reason: 'destination_or_phone_not_ecuador',
                    requestedBy: req.user?.email || req.user?.id || ''
                }
            });
            shipment.events = shipment.events.slice(-60);
            await shipment.save();
            return res.status(400).json({
                success: false,
                error: 'Pedido bloqueado: destino/telefone nao parece Equador.',
                shipment
            });
        }

        shipment.automation.dropiSubmitAuthorizedAt = new Date();
        shipment.automation.dropiSubmitAuthorizedBy = req.user?.email || String(req.user?._id || '');
        shipment.automation.dropiSubmitAuthorizationNote = req.body?.note || '';
        shipment.review.manualOnly = false;
        if (!shipment.review.reviewStatus || shipment.review.reviewStatus === 'pending_review') {
            shipment.review.reviewStatus = 'dropi_submit_authorized';
        }
        shipment.events.push({
            kind: 'dropi_submit_authorized',
            at: new Date(),
            payload: {
                authorizedBy: shipment.automation.dropiSubmitAuthorizedBy,
                note: shipment.automation.dropiSubmitAuthorizationNote
            }
        });
        shipment.events = shipment.events.slice(-60);
        await shipment.save();

        res.json({ success: true, shipment });
    } catch (error) {
        console.error('Authorize Dropi EC submit error:', error);
        res.status(500).json({ error: error.message || 'Failed to authorize Dropi EC submit' });
    }
});

router.post('/droppi/ec/orders/:orderId/revoke-submit-authorization', adminOnly, async (req, res) => {
    try {
        const shipment = await Shipment.findOne({ orderId: req.params.orderId });
        if (!shipment) return res.status(404).json({ error: 'Shipment not found' });

        shipment.automation.dropiSubmitAuthorizedAt = null;
        shipment.automation.dropiSubmitAuthorizedBy = '';
        shipment.automation.dropiSubmitAuthorizationNote = '';
        if (shipment.review.reviewStatus === 'dropi_submit_authorized') {
            shipment.review.reviewStatus = 'dropi_submit_authorization_revoked';
        }
        shipment.events.push({
            kind: 'dropi_submit_authorization_revoked',
            at: new Date(),
            payload: {
                revokedBy: req.user?.email || String(req.user?._id || ''),
                reason: req.body?.reason || ''
            }
        });
        shipment.events = shipment.events.slice(-60);
        await shipment.save();

        res.json({ success: true, shipment });
    } catch (error) {
        console.error('Revoke Dropi EC submit authorization error:', error);
        res.status(500).json({ error: error.message || 'Failed to revoke Dropi EC submit authorization' });
    }
});

router.post('/droppi/ec/dispatch/run', adminOnly, async (req, res) => {
    try {
        const {
            limit = process.env.DROPPI_EC_SUBMIT_BATCH_LIMIT || 3,
            dryRun = true
        } = req.body || {};
        const effectiveLimit = normalizeBatchLimit(limit, 3, 10);
        const candidates = await getPendingDropiEcOrders(effectiveLimit);

        if (dryRun !== false) {
            return res.json({
                success: true,
                dryRun: true,
                processed: candidates.length,
                candidates: candidates.map(({ order, shipment }) => ({
                    orderId: order.orderId,
                    phoneTail: String(order.customer?.phone || shipment.client?.phone || '').replace(/\D/g, '').slice(-4),
                    name: order.customer?.name || shipment.client?.name || '',
                    city: order.customer?.city || shipment.client?.city || '',
                    province: order.customer?.province || shipment.client?.province || '',
                    package: order.package,
                    total: order.total,
                    authorizedAt: shipment.automation?.dropiSubmitAuthorizedAt || null,
                    authorizedBy: shipment.automation?.dropiSubmitAuthorizedBy || '',
                    reviewStatus: shipment.review?.reviewStatus || ''
                }))
            });
        }

        const results = [];
        for (const { order, shipment } of candidates) {
            const result = await submitDroppiEcuadorOrder({ order, shipment });
            if (result?.ok === false) {
                const updatedShipment = await Shipment.findOne({ orderId: order.orderId }) || shipment;
                if (result.paymentRequired || result.reason === 'dropi_payment_required') {
                    const paymentShipment = await markDropiPaymentRequired(updatedShipment, {
                        reason: 'dropi_payment_required',
                        error: result.error || result.reason || 'payment_required',
                        user: req.user
                    });
                    results.push({
                        orderId: order.orderId,
                        ok: false,
                        paymentRequired: true,
                        reason: result.reason || 'dropi_payment_required',
                        shipmentStatus: paymentShipment.logistics?.status || ''
                    });
                    continue;
                }
                const manualShipment = await markManualSendRequired(updatedShipment, {
                    reason: 'dropi_rejected',
                    error: result.error || result.reason || 'submit_failed',
                    user: req.user
                });
                results.push({
                    orderId: order.orderId,
                    ok: false,
                    manualSendRequired: true,
                    reason: result.reason || 'submit_failed',
                    shipmentStatus: manualShipment.logistics?.status || ''
                });
                continue;
            }
            results.push({
                orderId: order.orderId,
                ok: true,
                dropiOrderId: result?.result?.dropiResponse?.objects?.id || '',
                carrier: result?.result?.chosenCarrier || '',
                message: 'submitted'
            });
        }

        res.json({
            success: true,
            dryRun: false,
            processed: candidates.length,
            sent: results.filter((item) => item.ok).length,
            failed: results.filter((item) => !item.ok).length,
            results
        });
    } catch (error) {
        console.error('Droppi EC dispatch run error:', error);
        res.status(500).json({ error: error.message || 'Failed to run Dropi EC dispatch' });
    }
});

router.post('/droppi/ec/orders/:orderId/prepare-manual', adminOnly, async (req, res) => {
    try {
        const order = await Order.findOne({ orderId: req.params.orderId });
        if (!order) return res.status(404).json({ error: 'Order not found' });

        const shipment = await ensureShipmentForOrder(order, 'EC');

        const alreadySubmitted = alreadySubmittedResponse(order, shipment);
        if (alreadySubmitted) return res.json(alreadySubmitted);

        const result = await prepareDroppiEcuadorOrderForManualSubmit({ order, shipment });
        if (result?.ok === false) {
            const updatedShipment = await Shipment.findOne({ orderId: order.orderId }) || shipment;
            const manualShipment = await markManualSendRequired(updatedShipment, {
                reason: 'dropi_prepare_manual_failed',
                error: result.error || result.reason || 'prepare_manual_failed',
                user: req.user
            });
            return res.json({
                ...result,
                manualSendRequired: true,
                shipment: manualShipment,
                message: 'Nao consegui preparar a Dropi. Pedido ficou marcado para revisao/manual.'
            });
        }

        res.json(result);
    } catch (error) {
        console.error('Droppi EC prepare manual error:', error);
        try {
            const shipment = await Shipment.findOne({ orderId: req.params.orderId });
            if (shipment) {
                const manualShipment = await markManualSendRequired(shipment, {
                    reason: 'dropi_prepare_manual_error',
                    error: error.message || 'Failed to prepare Droppi order',
                    user: req.user
                });
                return res.json({
                    ok: false,
                    reason: 'dropi_prepare_manual_error',
                    error: error.message || 'Failed to prepare Droppi order',
                    manualSendRequired: true,
                    shipment: manualShipment,
                    message: 'Nao consegui preparar a Dropi. Pedido ficou marcado para revisao/manual.'
                });
            }
        } catch (markError) {
            console.error('Mark manual prepare required EC error:', markError);
        }
        res.status(500).json({ error: error.message || 'Failed to prepare Droppi order' });
    }
});

router.post('/pickup-proof/sweep', adminOnly, async (req, res) => {
    try {
        const limit = Math.max(1, Math.min(Number.parseInt(String(req.body?.limit || '50'), 10) || 50, 200));
        const dryRun = req.body?.dryRun !== false;
        const result = await processPickupProofSweep({ limit, dryRun });
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('Pickup proof sweep error:', error);
        res.status(500).json({ error: 'Failed to sweep pickup proofs' });
    }
});

router.post('/:orderId/panel-sync', adminOnly, async (req, res) => {
    try {
        const shipment = await Shipment.findOne({ orderId: req.params.orderId });
        if (!shipment) return res.status(404).json({ error: 'Shipment not found' });
        if (shipment.country !== 'EC') {
            return res.status(400).json({ error: 'Only EC shipments are supported here' });
        }
        const result = await syncDroppiEcuadorFromPanel({ shipment });
        res.json(result);
    } catch (error) {
        console.error('Droppi panel sync error:', error);
        res.status(500).json({ error: error.message || 'Failed to sync panel' });
    }
});

router.post('/:orderId/notify-guide', adminOnly, async (req, res) => {
    try {
        const shipment = await Shipment.findOne({ orderId: req.params.orderId });
        if (!shipment) return res.status(404).json({ error: 'Shipment not found' });
        const result = await notifyShipmentGuideGenerated(shipment);
        res.json(result);
    } catch (error) {
        console.error('Notify guide error:', error);
        res.status(500).json({ error: 'Failed to notify guide' });
    }
});

router.post('/:orderId/notify-pickup', adminOnly, async (req, res) => {
    try {
        const shipment = await Shipment.findOne({ orderId: req.params.orderId });
        if (!shipment) return res.status(404).json({ error: 'Shipment not found' });
        const success = await notifyReadyForPickup(shipment);
        res.json({ success });
    } catch (error) {
        console.error('Notify pickup error:', error);
        res.status(500).json({ error: 'Failed to notify pickup' });
    }
});

router.post('/:orderId/notify-returned', adminOnly, async (req, res) => {
    try {
        const shipment = await Shipment.findOne({ orderId: req.params.orderId });
        if (!shipment) return res.status(404).json({ error: 'Shipment not found' });
        const success = await notifyShipmentReturned(shipment);
        res.json({ success });
    } catch (error) {
        console.error('Notify returned error:', error);
        res.status(500).json({ error: 'Failed to notify returned' });
    }
});

router.post('/:orderId/request-pickup-proof', adminOnly, async (req, res) => {
    try {
        const shipment = await Shipment.findOne({ orderId: req.params.orderId });
        if (!shipment) return res.status(404).json({ error: 'Shipment not found' });
        const success = await notifyPickupProofRequest(shipment);
        res.json({ success });
    } catch (error) {
        console.error('Request pickup proof error:', error);
        res.status(500).json({ error: 'Failed to request pickup proof' });
    }
});

router.post('/:orderId/confirm-pickup', adminOnly, async (req, res) => {
    try {
        const shipment = await Shipment.findOne({ orderId: req.params.orderId });
        if (!shipment) return res.status(404).json({ error: 'Shipment not found' });

        const {
            productPhotoUrl = '',
            agencyReceiptPhotoUrl = '',
            pickedUpAt = new Date().toISOString(),
            sendBonus = true
        } = req.body || {};

        const pickedAt = new Date(pickedUpAt);
        const units = Number(shipment.treatment?.unitsPurchased || 1) || 1;
        const daysPerUnit = Number(shipment.treatment?.daysPerUnit || 30) || 30;
        const treatmentEndsAt = new Date(pickedAt.getTime() + (units * daysPerUnit * 24 * 60 * 60 * 1000));
        const refillReminderDueAt = new Date(treatmentEndsAt.getTime() - (5 * 24 * 60 * 60 * 1000));

        shipment.outcomes.pickedUp = true;
        shipment.outcomes.delivered = true;
        shipment.outcomes.returned = false;
        shipment.outcomes.prepaidOnly = false;
        shipment.automation.deliveredConfirmedAt = pickedAt;
        shipment.automation.prepaidOnlyNotifiedAt = null;
        shipment.proof.productPhotoUrl = productPhotoUrl;
        shipment.proof.agencyReceiptPhotoUrl = agencyReceiptPhotoUrl;
        shipment.proof.pickupProofReceivedAt = new Date();
        shipment.treatment.treatmentEndsAt = treatmentEndsAt;
        shipment.treatment.refillReminderDueAt = refillReminderDueAt;
        shipment.review.manualOnly = false;
        shipment.review.reviewReason = '';
        shipment.review.reviewStatus = 'pickup_confirmed';
        shipment.events.push({
            kind: 'pickup_confirmed',
            at: new Date(),
            payload: {
                productPhotoUrl,
                agencyReceiptPhotoUrl,
                pickedUpAt: pickedAt,
                customerEligibility: 'released_for_new_order'
            }
        });
        shipment.events = shipment.events.slice(-60);
        await shipment.save();
        const bonusSent = sendBonus === false ? false : await notifyPickupBonus(shipment);
        await markSenderWalletDelivered({ phone: shipment.client?.phone });

        res.json({
            success: true,
            bonusSent,
            shipment
        });
    } catch (error) {
        console.error('Confirm pickup error:', error);
        res.status(500).json({ error: 'Failed to confirm pickup' });
    }
});

router.post('/:orderId/notify-bonus', adminOnly, async (req, res) => {
    try {
        const shipment = await Shipment.findOne({ orderId: req.params.orderId });
        if (!shipment) return res.status(404).json({ error: 'Shipment not found' });
        const success = await notifyPickupBonus(shipment);
        res.json({ success });
    } catch (error) {
        console.error('Notify bonus error:', error);
        res.status(500).json({ error: 'Failed to notify bonus' });
    }
});

router.post('/:orderId/manual-review', adminOnly, async (req, res) => {
    try {
        const shipment = await Shipment.findOne({ orderId: req.params.orderId });
        if (!shipment) return res.status(404).json({ error: 'Shipment not found' });

        const {
            manualOnly = true,
            reviewReason = '',
            reviewStatus = 'pending_review',
            refusalReason = ''
        } = req.body || {};

        shipment.review.manualOnly = Boolean(manualOnly);
        shipment.review.reviewReason = reviewReason || shipment.review.reviewReason;
        shipment.review.reviewStatus = reviewStatus || shipment.review.reviewStatus;
        if (refusalReason) shipment.outcomes.refusalReason = refusalReason;
        shipment.events.push({
            kind: 'manual_review_updated',
            at: new Date(),
            payload: {
                manualOnly: shipment.review.manualOnly,
                reviewReason: shipment.review.reviewReason,
                reviewStatus: shipment.review.reviewStatus,
                refusalReason: shipment.outcomes.refusalReason
            }
        });
        shipment.events = shipment.events.slice(-60);
        await shipment.save();

        res.json({ success: true, shipment });
    } catch (error) {
        console.error('Manual review error:', error);
        res.status(500).json({ error: 'Failed to update manual review' });
    }
});

router.post('/:orderId/manual-send-required', adminOnly, async (req, res) => {
    try {
        const order = await Order.findOne({ orderId: req.params.orderId });
        const shipment = order
            ? await ensureShipmentForOrder(order, 'EC')
            : await Shipment.findOne({ orderId: req.params.orderId });
        if (!shipment) return res.status(404).json({ error: 'Shipment not found' });

        const updated = await markManualSendRequired(shipment, {
            reason: req.body?.reason || 'manual_send_requested',
            error: req.body?.error || '',
            user: req.user
        });
        res.json({ success: true, shipment: updated });
    } catch (error) {
        console.error('Manual send required error:', error);
        res.status(500).json({ error: 'Failed to request manual send' });
    }
});

router.post('/:orderId/requeue-dropi-submit', adminOnly, async (req, res) => {
    try {
        const order = await Order.findOne({ orderId: req.params.orderId });
        const shipment = order
            ? await ensureShipmentForOrder(order, 'EC')
            : await Shipment.findOne({ orderId: req.params.orderId });
        if (!shipment) return res.status(404).json({ error: 'Shipment not found' });
        if (shipment.country !== 'EC') return res.status(400).json({ error: 'Only EC shipments are supported here' });

        const alreadySubmitted = alreadySubmittedResponse(order, shipment);
        if (alreadySubmitted) return res.status(409).json({
            ...alreadySubmitted,
            error: alreadySubmitted.message
        });
        if (shipment.logistics?.trackingNumber) {
            return res.status(409).json({
                success: false,
                error: 'Pedido ja tem guia. Nao pode voltar para envio Dropi.',
                shipment
            });
        }

        shipment.review.manualOnly = false;
        shipment.review.reviewReason = '';
        shipment.review.reviewStatus = 'dropi_submit_authorized';
        shipment.automation.browserCheckpoint = '';
        shipment.automation.browserLastError = '';
        shipment.automation.dropiSubmitAuthorizedAt = new Date();
        shipment.automation.dropiSubmitAuthorizedBy = req.user?.email || String(req.user?._id || '');
        shipment.automation.dropiSubmitAuthorizationNote = req.body?.note || 'Recolocado no painel para Enviar para Dropi.';
        shipment.events.push({
            kind: 'dropi_requeued_to_normal_send',
            at: new Date(),
            payload: {
                reason: req.body?.reason || 'operator_requeue',
                targetStage: 'send_to_dropi',
                requestedBy: req.user?.email || req.user?.name || ''
            }
        });
        shipment.events = shipment.events.slice(-60);
        await shipment.save();

        res.json({
            success: true,
            shipment,
            message: 'Pedido voltou para a etapa 2 Enviar para Dropi.'
        });
    } catch (error) {
        console.error('Requeue Dropi submit error:', error);
        res.status(500).json({ error: error.message || 'Failed to requeue Dropi submit' });
    }
});

router.post('/:orderId/mark-manual-sent', adminOnly, async (req, res) => {
    try {
        const order = await Order.findOne({ orderId: req.params.orderId });
        const shipment = order
            ? await ensureShipmentForOrder(order, 'EC')
            : await Shipment.findOne({ orderId: req.params.orderId });
        if (!shipment) return res.status(404).json({ error: 'Shipment not found' });

        const updated = await markManualSent(shipment, {
            note: req.body?.note || '',
            user: req.user
        });
        res.json({ success: true, shipment: updated });
    } catch (error) {
        console.error('Mark manual sent error:', error);
        res.status(500).json({ error: 'Failed to mark manual sent' });
    }
});

router.post('/:orderId/delete-fake', adminOnly, async (req, res) => {
    try {
        const { reason = 'fake_order_deleted' } = req.body || {};
        const order = await Order.findOne({ orderId: req.params.orderId });
        const shipment = await Shipment.findOne({ orderId: req.params.orderId });
        if (!order && !shipment) return res.status(404).json({ error: 'Order not found' });

        const hasDropiId = Boolean(order?.dropiOrderId || shipment?.raw?.droppiOrder?.id || shipment?.raw?.droppiOrder?.order_id);
        const wasSubmitted = Boolean(shipment?.automation?.submittedToDroppiAt);
        const hasTracking = Boolean(shipment?.logistics?.trackingNumber || order?.trackingNumber);
        if (hasDropiId || wasSubmitted || hasTracking) {
            return res.status(409).json({
                success: false,
                error: 'Pedido ja tem envio/guia Dropi. Cancele manualmente na Dropi antes de remover daqui.',
                hasDropiId,
                wasSubmitted,
                hasTracking
            });
        }

        const adminCancelResult = markAdminLeadCancelled({
            orderId: req.params.orderId,
            user: req.user,
            reason
        });

        if (shipment) {
            shipment.events.push({
                kind: 'fake_order_deleted',
                at: new Date(),
                payload: {
                    reason,
                    deletedBy: req.user?.email || req.user?.name || '',
                    adminCancelResult
                }
            });
            shipment.events = shipment.events.slice(-60);
            await shipment.save();
        }

        await Shipment.deleteOne({ orderId: req.params.orderId });
        await Order.deleteOne({ orderId: req.params.orderId });

        res.json({
            success: true,
            deleted: true,
            orderId: req.params.orderId,
            adminCancelResult
        });
    } catch (error) {
        console.error('Delete fake order error:', error);
        res.status(500).json({ error: error.message || 'Failed to delete fake order' });
    }
});

router.post('/:orderId/notify-refill', adminOnly, async (req, res) => {
    try {
        const shipment = await Shipment.findOne({ orderId: req.params.orderId });
        if (!shipment) return res.status(404).json({ error: 'Shipment not found' });
        const success = await notifyTreatmentRefillReminder(shipment);
        res.json({ success });
    } catch (error) {
        console.error('Notify refill error:', error);
        res.status(500).json({ error: 'Failed to notify refill' });
    }
});

export default router;
