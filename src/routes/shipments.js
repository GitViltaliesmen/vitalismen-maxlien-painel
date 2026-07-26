import express from 'express';
import { spawnSync } from 'child_process';
import { authMiddleware, adminOnly } from '../middleware/auth.js';
import Shipment from '../models/Shipment.js';
import AutomationRun from '../models/AutomationRun.js';
import {
    buildDroppiEcuadorOrderPayload,
    upsertDroppiEcuadorShipment,
    validateEcuadorDropiPhone
} from '../services/droppiEcuadorService.js';
import {
    notifyReadyForPickup,
    notifyPickupBonus,
    notifyPickupProofRequest,
    notifyShipmentGuideGenerated,
    notifyTreatmentRefillReminder,
    processPickupProofSweep,
    notifyShipmentReturned,
    repurchaseReminderDelayDaysForUnits
} from '../services/shipmentMessageService.js';
import Order from '../models/Order.js';
import { importDroppiEcuadorText } from '../services/droppiEcuadorImportService.js';
import {
    prepareDroppiEcuadorSubmission,
    prepareDroppiEcuadorOrderForManualSubmit,
    submitDroppiEcuadorOrder,
    searchDroppiEcuadorOrdersFromPanel,
    syncActiveDroppiEcuadorOrdersFromPanel,
    syncDroppiEcuadorInvoiceForShipment,
    syncDroppiEcuadorFromPanel
} from '../services/droppiEcuadorBrowserService.js';
import {
    saveCarrierTrackingResult,
    trackCarrierGuide
} from '../services/carrierTrackingService.js';
import {
    markOnlineAdminPedidoEnviado,
    syncOrderToOnlineAdminPanel,
    updateOnlineAdminLeadProductSelection
} from '../services/adminPanelStatusService.js';
import {
    countCarrierStatusSweepCandidates,
    countShipmentDispatchCandidates,
    getShipmentDispatchState,
    processCarrierStatusSweep,
    processShipmentStatusDispatch,
    setShipmentDispatchPaused
} from '../services/shipmentStatusDispatcherService.js';
import {
    buildGuidePrintReport,
    processGuidePrintDispatch
} from '../services/guidePrintDispatcherService.js';
import { findServientregaEcuadorAgencies } from '../services/servientregaEcuadorAgencyService.js';
import { markSenderWalletDelivered } from '../whatsapp/sessionRouter.js';
import { getOrderDuplicateGuard } from '../services/orderDuplicateGuardService.js';
import {
    ECUADOR_PRODUCTS,
    detectExplicitEcuadorProductKey,
    ecuadorPackageLabel,
    ecuadorProductMetadata,
    findEcuadorOfferByTotal,
    getEcuadorOffer,
    getEcuadorProductInfoByKey,
    listEcuadorDropiProducts,
    resolveEcuadorProductInfo
} from '../services/ecuadorProductService.js';

const router = express.Router();

router.use(authMiddleware);

const activeDropiSubmitJobs = new Set();
let dropiSubmitQueue = Promise.resolve();

const getAdminLeadIdFromOrderId = (orderId) => {
    const match = String(orderId || '').match(/^EC-ADMIN-(\d+)$/i);
    return match ? Number.parseInt(match[1], 10) : null;
};

const parseMoney = (value, fallback = 0) => {
    const parsed = Number(String(value ?? '').replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : fallback;
};

const VALID_PACKAGE_QUANTITIES = new Set([1, 2, 3, 6]);

const normalizePackageQuantity = (value) => {
    const parsed = Number.parseInt(String(value ?? '').trim(), 10);
    return VALID_PACKAGE_QUANTITIES.has(parsed) ? parsed : 0;
};

const packageLabel = (quantity, productInfo = null) => {
    const qty = normalizePackageQuantity(quantity);
    if (!qty) return 'sem quantidade';
    return productInfo ? ecuadorPackageLabel(productInfo, qty) : (qty === 1 ? '1 frasco' : `${qty} frascos`);
};

const getAdminLeadSnapshot = ({ orderId } = {}) => {
    const leadId = getAdminLeadIdFromOrderId(orderId);
    if (!leadId) return null;

    const python = `
import sqlite3, json
db_path = "/opt/maxlien-mvp/leads_ec.sqlite3"
lead_id = int(${JSON.stringify(leadId)})
con = sqlite3.connect(db_path)
con.row_factory = sqlite3.Row
cur = con.cursor()
row = cur.execute("SELECT * FROM leads WHERE id=?", (lead_id,)).fetchone()
print(json.dumps(dict(row) if row else None, ensure_ascii=False))
con.close()
`;

    const result = spawnSync('python3', ['-'], {
        input: python,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024
    });
    if (result.status !== 0) return null;
    try {
        return JSON.parse(result.stdout || 'null');
    } catch (_error) {
        return null;
    }
};

const createOperationalOrderFromAdminLead = async (requestedOrderId, lead) => {
    const leadId = getAdminLeadIdFromOrderId(requestedOrderId);
    if (!leadId || !lead) return null;
    const phone = String(lead.phone || '').trim();
    const phoneDigits = phone.replace(/\D/g, '');
    const status = String(lead.status || '').trim().toLowerCase();
    if (!phoneDigits || status !== 'confirmado') return null;

    const quantity = normalizePackageQuantity(lead.product_qty);
    const total = parseMoney(lead.product_value, 0);
    if (!quantity || total <= 0) return null;
    const createdAt = lead.created_at ? new Date(lead.created_at) : null;
    const productInfo = resolveEcuadorProductInfo(lead.notes, lead.event_source_url, lead.utm_campaign, lead.utm_content);
    const order = new Order({
        orderId: requestedOrderId,
        country: 'EC',
        customer: {
            name: String(lead.name || '').trim(),
            phone,
            address: String(lead.address || '').trim(),
            city: String(lead.city || '').trim(),
            province: String(lead.province || '').trim()
        },
        package: {
            id: quantity,
            label: packageLabel(quantity, productInfo),
            quantity
        },
        total,
        currency: 'USD',
        status: 'confirmed',
        source: 'manual',
        entryAt: createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt : new Date(),
        entryReason: 'admin_confirmed_dropi_bridge',
        notes: [
            'Criado automaticamente do painel admin para envio Dropi.',
            `Produto: ${productInfo.name}`,
            `Lead admin EC #${leadId}`,
            `Status original: ${lead.status || ''}`
        ].join(' | ')
    });
    await order.save();
    return order;
};

const findCurrentOrderForAdminLead = async (requestedOrderId) => {
    const lead = getAdminLeadSnapshot({ orderId: requestedOrderId });
    const leadPhone = String(lead?.phone || '').replace(/\D/g, '');
    if (!leadPhone) return null;

    const candidates = await Order.find({
        country: 'EC',
        status: { $in: ['draft', 'pending', 'confirmed', 'processing', 'shipped'] }
    }).sort({ updatedAt: -1 }).limit(300);

    const tail = leadPhone.slice(-9);
    const match = candidates.find((order) => {
        const orderPhone = String(order.customer?.phone || '').replace(/\D/g, '');
        return orderPhone && (
            orderPhone === leadPhone
            || orderPhone.endsWith(tail)
            || leadPhone.endsWith(orderPhone.slice(-9))
        );
    });

    if (!match) return null;
    match._mappedFromAdminLead = {
        requestedOrderId,
        leadId: lead.id,
        leadName: lead.name || '',
        leadPhone: lead.phone || ''
    };
    return match;
};

const findOrderForDropiRequest = async (requestedOrderId) => {
    const order = await Order.findOne({ orderId: requestedOrderId });
    if (order) return order;
    const mappedOrder = await findCurrentOrderForAdminLead(requestedOrderId);
    if (mappedOrder) return mappedOrder;
    const lead = getAdminLeadSnapshot({ orderId: requestedOrderId });
    return createOperationalOrderFromAdminLead(requestedOrderId, lead);
};

const appendAuditNote = (current = '', note = '') => {
    const prefix = current ? `${String(current).trim()}\n` : '';
    return `${prefix}[${new Date().toISOString()}] ${note}`.trim();
};

const dropiProductSelectionMarker = ({ product, offer }) => (
    `[DROPI_PRODUCT] key=${product.key}; name=${product.name}; priceCatalog=${offer.priceCatalog}; quantity=${offer.quantity}; total=${offer.total.toFixed(2)}`
);

const replaceDropiProductSelectionMarker = (current = '', marker = '') => {
    const withoutPrevious = String(current || '')
        .split(/\r?\n/)
        .filter((line) => !line.trim().startsWith('[DROPI_PRODUCT]'))
        .join('\n')
        .trim();
    return [withoutPrevious, marker].filter(Boolean).join('\n');
};

const dropiProductEnabled = (product = {}) => {
    if (product.key === ECUADOR_PRODUCTS.vitPower.key) return true;
    if (product.key === ECUADOR_PRODUCTS.nitrix.key) {
        return String(process.env.DROPPI_EC_NITRIX_PRODUCT_ENABLED || '').toLowerCase() === 'true'
            && Boolean(String(process.env.DROPPI_EC_NITRIX_PRODUCT_URL || '').trim())
            && Boolean(String(process.env.DROPPI_EC_NITRIX_PRODUCT_NAME || '').trim());
    }
    if (product.key === ECUADOR_PRODUCTS.texUltra.key) {
        return String(process.env.DROPPI_EC_TEX_ULTRA_PRODUCT_ENABLED || '').toLowerCase() === 'true'
            && Boolean(String(process.env.DROPPI_EC_TEX_ULTRA_PRODUCT_URL || product.dropiUrl || '').trim())
            && Boolean(String(process.env.DROPPI_EC_TEX_ULTRA_PRODUCT_NAME || product.dropiName || '').trim());
    }
    return false;
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

const parseDispatchActions = (value) => {
    const raw = Array.isArray(value) ? value : String(value || process.env.SHIPMENT_STATUS_DISPATCH_ACTIONS || 'guide,in_transit,ready_for_pickup,returned,delivered_bonus').split(',');
    return raw
        .map((item) => String(item || '').trim())
        .filter(Boolean);
};

const positiveInt = (value, fallback, max = 30) => {
    const parsed = Number.parseInt(String(value || ''), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.min(parsed, max);
};

const digitsOnly = (value) => String(value || '').replace(/\D/g, '');

const normalizeManualShipmentStatus = (value) => {
    const raw = String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
    if (['READY_FOR_PICKUP', 'AGENCIA', 'RETIRADA', 'RETIRO'].includes(raw)) return 'READY_FOR_PICKUP';
    if (['EN_RUTA', 'RUTA', 'TRANSITO', 'IN_TRANSIT'].includes(raw)) return 'EN_RUTA';
    if (['EN_REPARTO', 'REPARTO'].includes(raw)) return 'EN_REPARTO';
    if (['DEVUELTO', 'RETURNED'].includes(raw)) return 'DEVUELTO';
    if (['ENTREGADO', 'DELIVERED'].includes(raw)) return 'ENTREGADO';
    return 'GUIA_GENERADA';
};

const normalizeManualPhone = (phone, country = 'EC') => {
    const digits = digitsOnly(phone);
    if (!digits) return '';
    if (String(country || '').toUpperCase() === 'EC' && digits.length === 9) return `593${digits}`;
    if (String(country || '').toUpperCase() === 'EC' && digits.length === 10 && digits.startsWith('0')) return `593${digits.slice(1)}`;
    return digits;
};

const normalizeManualBoolean = (value) => {
    if (typeof value === 'boolean') return value;
    return ['1', 'true', 'yes', 'sim', 'si'].includes(String(value || '').trim().toLowerCase());
};

const findRecentOrderByPhone = async ({ phone, country = 'EC' } = {}) => {
    const digits = normalizeManualPhone(phone, country);
    const tail = digits.slice(-9);
    if (!tail) return null;
    return Order.findOne({
        country: 'EC',
        status: { $in: ['pending', 'confirmed', 'processing', 'shipped'] },
        'customer.phone': { $regex: `${tail}$` }
    }).sort({ updatedAt: -1 });
};

const retroactiveSyncQuery = ({ days = 10 } = {}) => {
    const cutoff = new Date(Date.now() - positiveInt(days, 10, 90) * 24 * 60 * 60 * 1000);
    return {
        country: 'EC',
        provider: 'droppi',
        'client.phone': { $exists: true, $ne: '' },
        updatedAt: { $gte: cutoff },
        $or: [
            { 'logistics.status': { $in: ['CREATED', 'created', 'PENDIENTE', 'GUIA_GENERADA', 'READY_FOR_PICKUP', 'EN_RUTA', 'EN_REPARTO', 'EN_DESPACHO', 'EN_BODEGA_TRANSPORTADORA'] } },
            { 'logistics.trackingNumber': { $exists: true, $ne: '' } },
            { 'automation.submittedToDroppiAt': { $exists: true, $ne: null } },
            { 'raw.manualDropiOrderId': { $exists: true, $ne: '' } },
            { 'raw.latestDroppiPayload.dropiOrderId': { $exists: true, $ne: '' } }
        ]
    };
};

const describeDropiSubmitFailure = (value, fallback = 'Dropi rejeitou o envio. Pedido marcado para envio manual.') => {
    const text = String(value || '');
    if (/two-factor|2fa|autenticaci[oó]n de dos factores|dois fatores/i.test(text)) {
        return 'Dropi pediu autenticacao de dois fatores. Atualize a sessao Dropi antes de tentar enviar novamente.';
    }
    if (/missing DROPI_EC_EMAIL|missing DROPI_EC_PASSWORD|credenciais|credentials/i.test(text)) {
        return 'Credenciais Dropi ausentes ou nao carregadas no servidor. Corrija o login Dropi antes de enviar.';
    }
    if (/department option not selected|city option not selected|city field did not unlock|city was not accepted|ciudad|Departamento|Ciudad/i.test(text)) {
        return 'Dropi nao aceitou provincia/cidade deste pedido. Confira cidade/provincia antes de reenviar.';
    }
    if (/shipping quote did not run|shipping quote returned without carrier options|shipping quote destination mismatch|cotiza/i.test(text)) {
        return 'Dropi nao carregou a cotacao de envio para esta cidade. A automacao tentou atualizar cidade/cotacao; confira no envio manual ou tente novamente.';
    }
    if (/servientrega not returned in shipping quote/i.test(text)) {
        return 'Dropi cotou este destino, mas Servientrega nao apareceu na cotacao da automacao. Confira no envio manual antes de trocar transportadora.';
    }
    if (/servientrega required|Servientrega|shipping quote|transportadora|carrier/i.test(text)) {
        return 'Dropi nao liberou Servientrega para esse destino agora. Pedido ficou para envio manual/revisao sem trocar transportadora.';
    }
    if (/duplicad|duplicate|ya existe/i.test(text)) {
        return 'Possivel pedido duplicado na Dropi. Confira antes de reenviar.';
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
    const productInfo = resolveEcuadorProductInfo(order);
    return upsertDroppiEcuadorShipment({
        orderId: order.orderId,
        productName: productInfo.name,
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
    const trackingNumber = String(order?.trackingNumber || shipment?.logistics?.trackingNumber || '').trim();
    if (!dropiOrderId && !trackingNumber && !shipment?.automation?.submittedToDroppiAt) return null;
    return {
        ok: true,
        alreadySubmitted: true,
        dropiOrderId,
        trackingNumber,
        shipment,
        message: dropiOrderId
            ? `PEDIDO JA FOI ENVIADO - Dropi ${dropiOrderId}.`
            : 'PEDIDO JA FOI ENVIADO para Dropi.'
    };
};

const buildDropiSubmitStatus = ({ order, shipment, orderId }) => {
    const targetOrderId = order?.orderId || shipment?.orderId || orderId;
    const alreadySubmitted = alreadySubmittedResponse(order, shipment);
    if (alreadySubmitted) {
        return {
            ...alreadySubmitted,
            status: 'submitted',
            processing: false,
            orderStatus: order?.status || '',
            reviewStatus: shipment?.review?.reviewStatus || '',
            checkpoint: shipment?.automation?.browserCheckpoint || '',
            lastError: shipment?.automation?.browserLastError || ''
        };
    }

    const reviewStatus = shipment?.review?.reviewStatus || '';
    const checkpoint = shipment?.automation?.browserCheckpoint || '';
    const lastError = shipment?.automation?.browserLastError || '';
    const active = targetOrderId ? activeDropiSubmitJobs.has(targetOrderId) : false;
    const running = active
        || reviewStatus === 'dropi_submit_running'
        || checkpoint === 'dropi_submit_queued'
        || checkpoint === 'dropi_submit_locked_waiting';

    if (running) {
        return {
            ok: true,
            success: true,
            status: 'processing',
            processing: true,
            submitQueued: true,
            shipment,
            orderStatus: order?.status || '',
            reviewStatus,
            checkpoint,
            lastError,
            message: 'Envio Dropi ainda esta processando.'
        };
    }

    if (reviewStatus === 'dropi_payment_required' || checkpoint === 'dropi_payment_required') {
        return {
            ok: false,
            success: false,
            status: 'payment_required',
            paymentRequired: true,
            shipment,
            orderStatus: order?.status || '',
            reviewStatus,
            checkpoint,
            lastError,
            message: 'Dropi chegou ate o envio, mas bloqueou por saldo/credito insuficiente.'
        };
    }

    if (shipment?.review?.manualOnly || reviewStatus === 'manual_send_required') {
        return {
            ok: false,
            success: false,
            status: 'manual_required',
            manualSendRequired: true,
            shipment,
            orderStatus: order?.status || '',
            reviewStatus,
            checkpoint,
            lastError,
            reason: shipment?.review?.reviewReason || 'manual_send_required',
            error: lastError,
            message: describeDropiSubmitFailure(lastError || shipment?.review?.reviewReason)
        };
    }

    if (!isAuthorizedForDropiSubmit(shipment)) {
        return {
            ok: false,
            success: false,
            status: 'authorization_required',
            authorizationRequired: true,
            shipment,
            orderStatus: order?.status || '',
            reviewStatus,
            checkpoint,
            lastError,
            message: 'Pedido ainda nao foi autorizado para envio na Dropi.'
        };
    }

    return {
        ok: true,
        success: true,
        status: 'authorized',
        processing: false,
        shipment,
        orderStatus: order?.status || '',
        reviewStatus,
        checkpoint,
        lastError,
        message: 'Pedido autorizado e aguardando envio.'
    };
};

const buildManualDropiCopyText = ({ order, prepared }) => {
    const payload = prepared?.payload || {};
    return [
        `Pedido: ${order.orderId}`,
        `Cliente: ${[payload.firstName, payload.lastName].filter(Boolean).join(' ') || order.customer?.name || ''}`,
        `Telefone: ${payload.phone || order.customer?.phone || ''}`,
        `Provincia: ${payload.department || order.customer?.province || ''}`,
        `Cidade: ${payload.city || order.customer?.city || ''}`,
        `Endereco: ${payload.address || order.customer?.address || ''}`,
        `Referencia: ${order.customer?.reference || ''}`,
        `Produto: ${payload.productName || 'Vit Power'}`,
        `Quantidade: ${payload.quantity || order.package?.quantity || ''}`,
        `Valor: ${payload.price || order.total || ''}`,
        payload.agencyPickup ? 'Entrega: Retiro em agencia/Servientrega' : 'Entrega: Domicilio'
    ].filter(Boolean).join('\n');
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
    if (!validateEcuadorDropiPhone(phoneDigits).ok) return false;
    if (phoneDigits.startsWith('55')) return false;
    if (/^(SP|RJ|MG|PR|SC|RS|BA|GO|PE|CE)$/i.test(province)) return false;
    if (/SOROCABA|SAO PAULO|SÃO PAULO|CAMPINAS|RIO DE JANEIRO/i.test(city)) return false;
    return true;
};

const dropiDestinationBlockedResponse = (res, order, shipment) => {
    const phoneDigits = String(order?.customer?.phone || shipment?.client?.phone || '').replace(/\D/g, '');
    const phoneValidation = validateEcuadorDropiPhone(phoneDigits);
    const isBrazil = phoneValidation.reason === 'brazil_phone_not_allowed_for_dropi' || phoneDigits.startsWith('55');
    return res.status(409).json({
        success: false,
        error: isBrazil ? 'brazil_test_only' : phoneValidation.reason || 'destination_or_phone_not_ecuador',
        message: isBrazil
            ? 'Numero brasileiro liberado somente para teste de atendimento. Nao enviar pedido nem Dropi.'
            : 'Pedido bloqueado: telefone precisa ser celular valido do Equador para enviar na Dropi.',
        phoneValidation,
        shipment
    });
};

const isAuthorizedForDropiSubmit = (shipment) => Boolean(shipment?.automation?.dropiSubmitAuthorizedAt);

const duplicateGuardResponse = (res, guard) => res.status(409).json({
    success: false,
    duplicateBlocked: true,
    error: guard.reason || 'active_duplicate_order',
    message: guard.message || 'Pedido duplicado bloqueado',
    duplicateOrderId: guard.duplicateOrderId || '',
    duplicateStatus: guard.duplicateStatus || '',
    duplicateDropiOrderId: guard.duplicateDropiOrderId || '',
    duplicateTrackingNumber: guard.duplicateTrackingNumber || '',
    duplicateSubmittedAt: guard.duplicateSubmittedAt || null,
    latestOrderId: guard.latestOrderId || '',
    requiresManualAuthorization: Boolean(guard.requiresManualAuthorization)
});

const getDropiDuplicateGuardForOrder = async (order, shipment) => {
    if (order?._adminLeadVirtual) {
        return { allowed: true, reason: 'admin_lead_manual_submission' };
    }
    const currentOrderId = String(order?.orderId || shipment?.orderId || '');
    if (/^EC-REENVIO-\d+-/i.test(currentOrderId)) {
        return { allowed: true, reason: 'authorized_replacement_order' };
    }
    return getOrderDuplicateGuard({
        phone: order.customer?.phone || shipment.client?.phone,
        country: order.country || 'EC',
        currentOrderId: order.orderId,
        trackingNumber: order.trackingNumber || shipment.logistics?.trackingNumber || '',
        dropiOrderId: order.dropiOrderId || getSubmittedDropiOrderId(order, shipment)
    });
};

const markDropiSubmitQueued = async (shipment, { user = null, reason = 'dropi_submit_queued' } = {}) => {
    shipment.review.manualOnly = false;
    shipment.review.reviewReason = '';
    shipment.review.reviewStatus = 'dropi_submit_running';
    shipment.automation.browserCheckpoint = reason;
    shipment.automation.browserLastError = '';
    shipment.events.push({
        kind: reason,
        at: new Date(),
        payload: {
            requestedBy: user?.email || user?.name || ''
        }
    });
    shipment.events = shipment.events.slice(-60);
    await shipment.save();
    return shipment;
};

const handleDropiSubmitResult = async ({ order, shipment, result, user = null }) => {
    if (result?.ok === false) {
        if (result.duplicateBlocked) {
            return {
                ...result,
                manualSendRequired: false,
                shipment,
                message: result.message || result.error || 'Pedido duplicado bloqueado'
            };
        }
        const updatedShipment = await Shipment.findOne({ orderId: order.orderId }) || shipment;
        if (result.reason === 'locked') {
            updatedShipment.review.manualOnly = false;
            updatedShipment.review.reviewReason = '';
            updatedShipment.review.reviewStatus = 'dropi_submit_running';
            updatedShipment.automation.browserCheckpoint = 'dropi_submit_locked_waiting';
            updatedShipment.automation.browserLastError = '';
            updatedShipment.events.push({
                kind: 'dropi_submit_locked_waiting',
                at: new Date(),
                payload: {
                    requestedBy: user?.email || user?.name || '',
                    reason: 'locked'
                }
            });
            updatedShipment.events = updatedShipment.events.slice(-60);
            await updatedShipment.save();
            return {
                ...result,
                processing: true,
                submitQueued: true,
                shipment: updatedShipment,
                message: 'Envio Dropi ja esta em processamento. Atualize em instantes.'
            };
        }
        if (result.paymentRequired || result.reason === 'dropi_payment_required') {
            const paymentShipment = await markDropiPaymentRequired(updatedShipment, {
                reason: 'dropi_payment_required',
                error: result.error || result.reason || 'payment_required',
                user
            });
            return {
                ...result,
                paymentRequired: true,
                manualSendRequired: false,
                shipment: paymentShipment,
                message: 'Dropi chegou ate o envio, mas bloqueou por saldo/credito insuficiente.'
            };
        }
        const manualShipment = await markManualSendRequired(updatedShipment, {
            reason: 'dropi_rejected',
            error: result.error || result.reason || 'submit_failed',
            user
        });
        return {
            ...result,
            manualSendRequired: true,
            shipment: manualShipment,
            message: describeDropiSubmitFailure(result.error || result.reason)
        };
    }
    return result;
};

const enqueueDropiSubmitJob = async ({ order, shipment, user = null }) => {
    const orderId = order.orderId;
    if (activeDropiSubmitJobs.has(orderId)) {
        return {
            ok: true,
            success: true,
            submitQueued: true,
            processing: true,
            shipment,
            message: 'Envio Dropi ja esta em processamento. Atualize em instantes.'
        };
    }

    activeDropiSubmitJobs.add(orderId);
    const queuedShipment = await markDropiSubmitQueued(shipment, { user });

    dropiSubmitQueue = dropiSubmitQueue
        .catch((error) => {
            console.error('Dropi EC submit queue previous job error:', error);
        })
        .then(async () => {
            try {
                const latestShipment = await Shipment.findOne({ orderId }) || queuedShipment;
                const latestAlreadySubmitted = alreadySubmittedResponse(order, latestShipment);
                if (latestAlreadySubmitted) return latestAlreadySubmitted;
                const result = await submitDroppiEcuadorOrder({ order, shipment: latestShipment });
                const handled = await handleDropiSubmitResult({ order, shipment: latestShipment, result, user });
                if (handled?.ok === false && !handled?.processing) {
                    console.warn('Dropi EC async submit finished with issue:', {
                        orderId,
                        reason: handled.reason,
                        error: handled.error
                    });
                }
                return handled;
            } catch (error) {
                console.error('Dropi EC async submit error:', error);
                try {
                    const latestShipment = await Shipment.findOne({ orderId }) || queuedShipment;
                    await markManualSendRequired(latestShipment, {
                        reason: 'dropi_submit_error',
                        error: error.message || 'Failed to submit Droppi order',
                        user
                    });
                } catch (markError) {
                    console.error('Mark async manual send required EC error:', markError);
                }
                return null;
            } finally {
                activeDropiSubmitJobs.delete(orderId);
            }
        });

    return {
        ok: true,
        success: true,
        submitQueued: true,
        processing: true,
        shipment: queuedShipment,
        message: 'Envio iniciado na Dropi. O painel vai atualizar em instantes.'
    };
};

const getPendingDropiEcOrders = async (limit = 3) => {
    const candidates = [];
    const shipments = await Shipment.find({
        country: 'EC',
        'automation.dropiSubmitAuthorizedAt': { $exists: true, $ne: null },
        $or: [
            { 'automation.submittedToDroppiAt': { $exists: false } },
            { 'automation.submittedToDroppiAt': null }
        ],
        'review.manualOnly': { $ne: true },
        'review.reviewStatus': { $ne: 'dropi_payment_required' }
    }).sort({
        'automation.dropiSubmitAuthorizedAt': 1,
        updatedAt: 1,
        createdAt: 1
    }).limit(Math.max(limit * 5, limit));

    for (const shipment of shipments) {
        const order = await Order.findOne({
            orderId: shipment.orderId,
            country: 'EC',
            status: 'confirmed'
        });
        if (!order) continue;
        if (alreadySubmittedResponse(order, shipment)) continue;
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

router.get('/carrier/ec/sweep/status', adminOnly, async (_req, res) => {
    const state = getShipmentDispatchState();
    const candidates = await countCarrierStatusSweepCandidates().catch(() => 0);
    res.json({
        success: true,
        candidates,
        carrierSweep: state.carrierSweep || null
    });
});

router.post('/carrier/ec/sweep/run', adminOnly, async (req, res) => {
    try {
        const {
            limit = process.env.SHIPMENT_CARRIER_STATUS_SWEEP_BATCH_LIMIT || 6,
            dryRun = false,
            force = false
        } = req.body || {};
        const result = await processCarrierStatusSweep({
            limit,
            dryRun: Boolean(dryRun),
            force: Boolean(force)
        });
        await AutomationRun.create({
            kind: 'carrier_status_sweep_run',
            status: 'completed',
            requestedBy: req.user?.email || req.user?.name || '',
            payload: {
                dryRun: Boolean(dryRun),
                force: Boolean(force),
                limit,
                processed: result.processed || 0,
                refreshed: result.refreshed || 0,
                statusChanged: result.statusChanged || 0,
                failed: result.failed || 0
            }
        }).catch(() => null);
        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('Carrier status sweep error:', error);
        res.status(500).json({ error: error.message || 'Failed to run carrier status sweep' });
    }
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
        await AutomationRun.create({
            kind: 'shipment_dispatch_run',
            status: 'completed',
            requestedBy: req.user?.email || req.user?.name || '',
            payload: {
                dryRun: Boolean(dryRun),
                force: Boolean(force),
                actions,
                limit,
                processed: result.processed || 0,
                sent: result.sent || 0,
                skipped: result.skipped || 0
            }
        }).catch(() => null);
        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('Shipment dispatch run error:', error);
        res.status(500).json({ error: error.message || 'Failed to run shipment dispatch' });
    }
});

router.post('/dropi-active-sync/report', adminOnly, async (req, res) => {
    try {
        const {
            maxRows = process.env.DROPPI_EC_ACTIVE_SYNC_MAX_ROWS || 1000,
            actions = [],
            writeReport = true
        } = req.body || {};
        const selectedActions = parseDispatchActions(actions);
        const result = await syncActiveDroppiEcuadorOrdersFromPanel({
            maxRows: positiveInt(maxRows, 1000, 1000),
            dryRun: true,
            reportOnly: true,
            actions: selectedActions,
            writeReport: writeReport !== false
        });
        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('Dropi active sync report error:', error);
        res.status(500).json({ error: error.message || 'Failed to generate Dropi active sync report' });
    }
});

router.post('/guide-print/report', adminOnly, async (req, res) => {
    try {
        const {
            limit = 50,
            generate = false
        } = req.body || {};
        const result = await buildGuidePrintReport({
            limit: positiveInt(limit, 50, 100),
            generate: Boolean(generate)
        });
        await AutomationRun.create({
            kind: 'shipment_guide_print_report',
            status: 'completed',
            requestedBy: req.user?.email || req.user?.name || '',
            payload: {
                generate: Boolean(generate),
                limit: positiveInt(limit, 50, 100),
                count: result.count || 0
            }
        }).catch(() => null);
        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('Guide print report error:', error);
        res.status(500).json({ error: error.message || 'Failed to generate guide print report' });
    }
});

router.post('/guide-print/dispatch', adminOnly, async (req, res) => {
    try {
        const {
            dryRun = true,
            limit = 1
        } = req.body || {};
        const result = await processGuidePrintDispatch({
            dryRun: dryRun !== false,
            limit: positiveInt(limit, 1, 1)
        });
        await AutomationRun.create({
            kind: 'shipment_guide_print_dispatch',
            status: 'completed',
            requestedBy: req.user?.email || req.user?.name || '',
            payload: {
                dryRun: dryRun !== false,
                limit: 1,
                processed: result.processed || 0,
                sent: result.sent || 0,
                skipped: result.skipped || 0,
                failed: result.failed || 0
            }
        }).catch(() => null);
        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('Guide print dispatch error:', error);
        res.status(500).json({ error: error.message || 'Failed to dispatch guide print' });
    }
});

router.get('/dispatch/history', adminOnly, async (req, res) => {
    try {
        const limit = positiveInt(req.query?.limit, 25, 100);
        const eventKinds = [
            'droppi_panel_sync_completed',
            'droppi_panel_sync_failed',
            'guia_notified',
            'in_transit_notified',
            'ready_for_pickup_notified',
            'returned_notified',
            'shipment_dispatch_attempt',
            'pickup_bonus_notified'
        ];
        const shipments = await Shipment.find({
            country: 'EC',
            events: { $elemMatch: { kind: { $in: eventKinds } } }
        })
            .sort({ updatedAt: -1 })
            .limit(80)
            .lean();
        const runs = await AutomationRun.find({
            kind: { $in: ['shipment_dispatch_run', 'shipment_dispatch_retroactive'] }
        })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean()
            .catch(() => []);

        const shipmentHistory = shipments
            .flatMap((shipment) => (shipment.events || [])
                .filter((event) => eventKinds.includes(event.kind))
                .map((event) => ({
                    orderId: shipment.orderId,
                    phoneTail: String(shipment.client?.phone || '').replace(/\D/g, '').slice(-4),
                    clientName: shipment.client?.name || '',
                    status: shipment.logistics?.status || '',
                    trackingNumber: shipment.logistics?.trackingNumber || '',
                    kind: event.kind,
                    at: event.at,
                    payload: event.payload || {}
                })))
            .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
            .slice(0, limit);

        const runHistory = runs.map((run) => ({
            orderId: 'PAINEL',
            phoneTail: '',
            clientName: run.requestedBy || '',
            status: run.status || '',
            trackingNumber: '',
            kind: run.kind,
            at: run.createdAt,
            payload: run.payload || {}
        }));

        const history = [...runHistory, ...shipmentHistory]
            .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
            .slice(0, limit);

        res.json({ success: true, history });
    } catch (error) {
        console.error('Shipment dispatch history error:', error);
        res.status(500).json({ error: error.message || 'Failed to load shipment dispatch history' });
    }
});

router.post('/dispatch/retroactive', adminOnly, async (req, res) => {
    try {
        const {
            days = 10,
            syncLimit = 10,
            dispatchLimit = process.env.SHIPMENT_STATUS_DISPATCH_BATCH_LIMIT || 3,
            dryRun = true,
            skipSync = false,
            actions = []
        } = req.body || {};
        const selectedActions = parseDispatchActions(actions);
        const shipments = skipSync ? [] : await Shipment.find(retroactiveSyncQuery({ days }))
            .sort({ updatedAt: -1, createdAt: -1 })
            .limit(positiveInt(syncLimit, 10, 50));

        const synced = [];
        for (const shipment of shipments) {
            const before = {
                orderId: shipment.orderId,
                status: shipment.logistics?.status || '',
                trackingNumber: shipment.logistics?.trackingNumber || '',
                phoneTail: String(shipment.client?.phone || '').replace(/\D/g, '').slice(-4)
            };
            const result = await syncDroppiEcuadorFromPanel({ shipment });
            const refreshed = await Shipment.findById(shipment._id).lean();
            synced.push({
                ...before,
                ok: Boolean(result?.ok),
                reason: result?.reason || '',
                afterStatus: refreshed?.logistics?.status || '',
                afterTrackingNumber: refreshed?.logistics?.trackingNumber || ''
            });
        }

        const pendingBeforeDispatch = await countShipmentDispatchCandidates({ actions: selectedActions });
        const dispatch = await processShipmentStatusDispatch({
            limit: positiveInt(dispatchLimit, 3, 30),
            dryRun: Boolean(dryRun),
            force: true,
            actions: selectedActions
        });
        const pendingAfterDispatch = await countShipmentDispatchCandidates({ actions: selectedActions });
        await AutomationRun.create({
            kind: 'shipment_dispatch_retroactive',
            status: 'completed',
            requestedBy: req.user?.email || req.user?.name || '',
            payload: {
                mode: dryRun ? 'dry-run' : 'send',
                days: positiveInt(days, 10, 90),
                syncLimit: positiveInt(syncLimit, 10, 50),
                dispatchLimit: positiveInt(dispatchLimit, 3, 30),
                actions: selectedActions,
                syncedCount: synced.length,
                syncFailed: synced.filter((item) => !item.ok).length,
                pendingBeforeDispatch,
                processed: dispatch.processed || 0,
                sent: dispatch.sent || 0,
                skipped: dispatch.skipped || 0,
                pendingAfterDispatch
            }
        }).catch(() => null);

        res.json({
            success: true,
            mode: dryRun ? 'dry-run' : 'send',
            days: positiveInt(days, 10, 90),
            syncLimit: positiveInt(syncLimit, 10, 50),
            dispatchLimit: positiveInt(dispatchLimit, 3, 30),
            actions: selectedActions,
            syncedCount: synced.length,
            synced,
            pendingBeforeDispatch,
            dispatch,
            pendingAfterDispatch
        });
    } catch (error) {
        console.error('Shipment retroactive dispatch error:', error);
        res.status(500).json({ error: error.message || 'Failed to run retroactive shipment dispatch' });
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

router.post('/droppi/ec/search-panel', adminOnly, async (req, res) => {
    try {
        const {
            q = '',
            term = '',
            terms = [],
            phone = '',
            tail = '',
            trackingNumber = '',
            limit = 20
        } = req.body || {};
        const searchTerms = [
            q,
            term,
            phone,
            tail,
            trackingNumber,
            ...(Array.isArray(terms) ? terms : String(terms || '').split(','))
        ]
            .map((value) => String(value || '').trim())
            .filter(Boolean);

        const result = await searchDroppiEcuadorOrdersFromPanel({
            terms: searchTerms,
            limit: positiveInt(limit, 20, 100)
        });

        res.json({
            success: Boolean(result.ok),
            ...result
        });
    } catch (error) {
        console.error('Droppi EC search-panel error:', error);
        res.status(500).json({ error: error.message || 'Failed to search Dropi panel' });
    }
});

router.post('/carrier/ec/track', adminOnly, async (req, res) => {
    try {
        const {
            orderId = '',
            trackingNumber = '',
            carrier = '',
            persist = false,
            updateStatus = false
        } = req.body || {};
        const searchTracking = String(trackingNumber || '').trim();
        const query = orderId
            ? { orderId: String(orderId).trim() }
            : (searchTracking ? { 'logistics.trackingNumber': searchTracking } : null);
        const shipment = query ? await Shipment.findOne({ country: 'EC', ...query }) : null;
        const effectiveTracking = searchTracking || shipment?.logistics?.trackingNumber || '';
        if (!effectiveTracking) {
            return res.status(400).json({
                success: false,
                error: 'missing_tracking_number',
                message: 'Informe trackingNumber ou orderId com guia salva.'
            });
        }
        const effectiveCarrier = carrier
            || shipment?.logistics?.distributionCompany
            || shipment?.logistics?.chosenCarrier
            || 'servientrega';
        const result = await trackCarrierGuide({
            trackingNumber: effectiveTracking,
            carrier: effectiveCarrier
        });
        let savedShipment = null;
        if (persist && shipment?._id) {
            savedShipment = await saveCarrierTrackingResult({
                shipmentId: shipment._id,
                result,
                updateStatus: updateStatus === true
            });
        }
        res.json({
            success: Boolean(result.ok),
            dryRun: !persist,
            persisted: Boolean(savedShipment),
            updateStatus: Boolean(updateStatus === true && savedShipment),
            shipment: savedShipment,
            result
        });
    } catch (error) {
        console.error('Carrier EC tracking error:', error);
        res.status(500).json({ error: error.message || 'Failed to track carrier guide' });
    }
});

router.post('/droppi/ec/orders/:orderId/invoice/sync', adminOnly, async (req, res) => {
    try {
        const shipment = await Shipment.findOne({
            country: 'EC',
            provider: 'droppi',
            orderId: req.params.orderId
        });
        if (!shipment) return res.status(404).json({ error: 'Shipment not found' });

        const result = await syncDroppiEcuadorInvoiceForShipment({
            shipment,
            download: req.body?.download !== false
        });

        const updatedShipment = await Shipment.findById(shipment._id).lean();
        res.json({
            success: Boolean(result.ok),
            ...result,
            shipment: updatedShipment
        });
    } catch (error) {
        console.error('Droppi EC invoice sync error:', error);
        res.status(500).json({ error: error.message || 'Failed to sync Dropi invoice' });
    }
});

router.get('/droppi/ec/products', adminOnly, (_req, res) => {
    const products = listEcuadorDropiProducts().map((item) => ({
        ...item,
        dropiEnabled: dropiProductEnabled(getEcuadorProductInfoByKey(item.key))
    }));
    res.json({
        success: true,
        products,
        authorizationRequired: true,
        directAutomaticSend: false
    });
});

router.post('/droppi/ec/admin-leads/:leadId/configure-order', adminOnly, async (req, res) => {
    try {
        const leadId = Number.parseInt(String(req.params.leadId || ''), 10);
        const product = getEcuadorProductInfoByKey(req.body?.productKey);
        const requestedPriceCatalog = String(req.body?.priceCatalog || '').trim().toLowerCase();
        const offer = getEcuadorOffer({
            productKey: product?.key,
            priceCatalog: requestedPriceCatalog,
            quantity: req.body?.quantity
        });
        if (!leadId || !product || !['normal', 'promotional'].includes(requestedPriceCatalog) || !offer) {
            return res.status(400).json({
                success: false,
                error: 'Selecione produto, tabela e quantidade validos.',
                allowedProducts: Object.values(ECUADOR_PRODUCTS).map((item) => item.key)
            });
        }

        const adminOrderId = `EC-ADMIN-${leadId}`;
        const requestedOrderId = String(req.body?.orderId || adminOrderId).trim();
        let lead = getAdminLeadSnapshot({ orderId: adminOrderId });
        if (!lead) return res.status(404).json({ success: false, error: 'Lead EC nao encontrado.' });
        const leadStatus = String(lead.status || '').trim().toLowerCase();
        if (['pedido_enviado', 'enviado', 'entregue', 'devolvido', 'cancelado', 'finalizado'].includes(leadStatus)) {
            return res.status(409).json({
                success: false,
                error: 'Este pedido ja foi enviado ou esta bloqueado para alteracao de produto/preco.',
                status: leadStatus
            });
        }

        let order = await Order.findOne({ orderId: requestedOrderId });
        if (!order && requestedOrderId !== adminOrderId) {
            order = await Order.findOne({ orderId: adminOrderId });
        }
        if (order) {
            const leadPhone = String(lead.phone || '').replace(/\D/g, '').slice(-9);
            const orderPhone = String(order.customer?.phone || '').replace(/\D/g, '').slice(-9);
            if (!leadPhone || !orderPhone || leadPhone !== orderPhone) {
                return res.status(409).json({
                    success: false,
                    error: 'O pedido operacional nao pertence ao telefone deste lead.'
                });
            }
            if (!['draft', 'pending', 'confirmed'].includes(String(order.status || ''))) {
                return res.status(409).json({
                    success: false,
                    error: 'Produto/preco so pode ser alterado antes do envio para Dropi.',
                    status: order.status
                });
            }
            const existingShipment = await Shipment.findOne({ orderId: order.orderId });
            const submitted = alreadySubmittedResponse(order, existingShipment);
            if (submitted) {
                return res.status(409).json({
                    success: false,
                    error: submitted.message,
                    alreadySubmitted: true,
                    dropiOrderId: submitted.dropiOrderId
                });
            }
        }

        const marker = dropiProductSelectionMarker({ product, offer });
        const leadUpdate = updateOnlineAdminLeadProductSelection({
            leadId,
            country: 'EC',
            productKey: product.key,
            productName: product.name,
            priceCatalog: offer.priceCatalog,
            quantity: offer.quantity,
            total: offer.total,
            requestedBy: req.user?.email || req.user?.name || ''
        });
        if (!leadUpdate?.ok) {
            return res.status(409).json({
                success: false,
                error: 'Nao foi possivel atualizar produto/preco no lead.',
                detail: leadUpdate
            });
        }

        lead = {
            ...lead,
            product_qty: offer.quantity,
            product_value: offer.total,
            notes: leadUpdate.notes || replaceDropiProductSelectionMarker(lead.notes, marker)
        };
        if (!order) {
            order = await createOperationalOrderFromAdminLead(adminOrderId, lead);
        }
        if (!order) {
            return res.status(409).json({
                success: false,
                error: 'O lead precisa estar confirmado e completo antes de preparar o pedido Dropi.'
            });
        }

        order.package = {
            ...(order.package || {}),
            id: offer.quantity,
            quantity: offer.quantity,
            label: ecuadorPackageLabel(product, offer.quantity)
        };
        order.total = offer.total;
        order.notes = replaceDropiProductSelectionMarker(order.notes, marker);
        order.tracking = {
            ...(order.tracking?.toObject?.() || order.tracking || {}),
            ...ecuadorProductMetadata(product)
        };
        await order.save();

        let shipment = await Shipment.findOne({ orderId: order.orderId });
        if (shipment) {
            shipment.productName = product.name;
            shipment.raw = {
                ...(shipment.raw || {}),
                productSelection: {
                    ...offer,
                    configuredAt: new Date().toISOString(),
                    configuredBy: req.user?.email || req.user?.name || ''
                }
            };
            shipment.automation.dropiSubmitAuthorizedAt = null;
            shipment.automation.dropiSubmitAuthorizedBy = '';
            shipment.automation.dropiSubmitAuthorizationNote = '';
            const productReviewStatuses = new Set([
                '',
                'pending_review',
                'wrong_product_nitrix_manual_review',
                'dropi_product_price_selection_required',
                'dropi_product_target_not_enabled',
                'awaiting_dropi_authorization',
                'dropi_submit_authorized',
                'dropi_submit_authorization_revoked'
            ]);
            if (productReviewStatuses.has(String(shipment.review.reviewStatus || ''))) {
                shipment.review.manualOnly = false;
                shipment.review.reviewReason = '';
                shipment.review.reviewStatus = 'awaiting_dropi_authorization';
            }
            shipment.events.push({
                kind: 'dropi_product_price_configured',
                at: new Date(),
                payload: {
                    ...offer,
                    configuredBy: req.user?.email || req.user?.name || ''
                }
            });
            shipment.events = shipment.events.slice(-60);
            await shipment.save();
        }

        const payload = buildDroppiEcuadorOrderPayload({ order });
        res.json({
            success: true,
            orderId: order.orderId,
            product,
            offer,
            payload,
            dropiEnabled: dropiProductEnabled(product),
            authorizationRequired: true,
            message: `${product.name} ${offer.quantity} unidade(s) por USD ${offer.total.toFixed(2)} configurado. Autorize antes do envio real.`
        });
    } catch (error) {
        console.error('Configure Dropi EC product/price error:', error);
        res.status(500).json({ error: error.message || 'Failed to configure Dropi EC product/price' });
    }
});

router.post('/droppi/ec/orders/:orderId/submit', adminOnly, async (req, res) => {
    try {
        const order = await findOrderForDropiRequest(req.params.orderId);
        if (!order) return res.status(404).json({ error: 'Order not found' });

        const shipment = await ensureShipmentForOrder(order, 'EC');
        if (!looksLikeEcuadorOrder(order, shipment)) return dropiDestinationBlockedResponse(res, order, shipment);

        const alreadySubmitted = alreadySubmittedResponse(order, shipment);
        if (alreadySubmitted) return res.json(alreadySubmitted);
        const duplicateGuard = await getDropiDuplicateGuardForOrder(order, shipment);
        if (!duplicateGuard.allowed) return duplicateGuardResponse(res, duplicateGuard);
        if (!isAuthorizedForDropiSubmit(shipment)) {
            return res.status(409).json({
                success: false,
                authorizationRequired: true,
                shipment,
                error: 'Pedido precisa ser autorizado antes do envio para Dropi.',
                message: 'Pedido ainda nao foi autorizado para envio na Dropi. Confira os dados e autorize antes de enviar.'
            });
        }

        const queued = await enqueueDropiSubmitJob({ order, shipment, user: req.user });
        res.json(queued);
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

router.get('/droppi/ec/orders/:orderId/submit-status', adminOnly, async (req, res) => {
    try {
        const order = await findOrderForDropiRequest(req.params.orderId);
        const shipment = await Shipment.findOne({ orderId: order?.orderId || req.params.orderId });
        if (!order && !shipment) return res.status(404).json({ error: 'Order not found' });
        res.json(buildDropiSubmitStatus({ order, shipment, orderId: req.params.orderId }));
    } catch (error) {
        console.error('Droppi EC submit status error:', error);
        res.status(500).json({ error: error.message || 'Failed to read Dropi submit status' });
    }
});

router.get('/droppi/ec/orders/:orderId/manual-link', adminOnly, async (req, res) => {
    try {
        const order = await findOrderForDropiRequest(req.params.orderId);
        if (!order) return res.status(404).json({ error: 'Order not found' });
        if (order.country !== 'EC') return res.status(400).json({ error: 'Only EC orders are supported here' });

        const shipment = await ensureShipmentForOrder(order, 'EC');
        if (!looksLikeEcuadorOrder(order, shipment)) return dropiDestinationBlockedResponse(res, order, shipment);
        const alreadySubmitted = alreadySubmittedResponse(order, shipment);
        if (alreadySubmitted) return res.json(alreadySubmitted);
        const duplicateGuard = await getDropiDuplicateGuardForOrder(order, shipment);
        if (!duplicateGuard.allowed) return duplicateGuardResponse(res, duplicateGuard);

        const prepared = await prepareDroppiEcuadorSubmission(order);
        shipment.review.manualOnly = true;
        shipment.review.reviewStatus = 'manual_dropi_ready';
        shipment.review.reviewReason = 'normal_submit_fallback_manual_dropi';
        shipment.automation.browserCheckpoint = 'manual_dropi_link_ready';
        shipment.automation.browserLastError = '';
        shipment.events.push({
            kind: 'manual_dropi_link_ready',
            at: new Date(),
            payload: {
                productUrl: prepared.productUrl,
                reason: req.query?.reason || ''
            }
        });
        shipment.events = shipment.events.slice(-60);
        await shipment.save();

        res.json({
            ok: true,
            manualFallback: true,
            dropiUrl: prepared.productUrl,
            payload: prepared.payload,
            copyText: buildManualDropiCopyText({ order, prepared }),
            shipment,
            message: 'Abra a Dropi, confira/crie o pedido manualmente e depois marque Manual enviado.'
        });
    } catch (error) {
        console.error('Droppi EC manual link error:', error);
        res.status(500).json({ error: error.message || 'Failed to prepare manual Dropi link' });
    }
});

router.post('/droppi/ec/orders/:orderId/authorize-submit', adminOnly, async (req, res) => {
    try {
        const order = await findOrderForDropiRequest(req.params.orderId);
        if (!order) return res.status(404).json({ error: 'Order not found' });
        if (order.country !== 'EC') return res.status(400).json({ error: 'Only EC orders can be authorized here' });

        const shipment = await ensureShipmentForOrder(order, 'EC');
        const alreadySubmitted = alreadySubmittedResponse(order, shipment);
        if (alreadySubmitted) return res.json(alreadySubmitted);
        const explicitProductKey = detectExplicitEcuadorProductKey(order, shipment?.productName, shipment?.notes);
        const selectedOffer = findEcuadorOfferByTotal({
            productKey: explicitProductKey,
            quantity: order.package?.quantity || order.package?.id,
            total: order.total
        });
        if (!explicitProductKey || !selectedOffer) {
            return res.status(409).json({
                success: false,
                productSelectionRequired: true,
                error: 'Selecione produto e uma opcao oficial de preco antes de autorizar a Dropi.',
                message: 'Abra Produto e preco Dropi no menu do lead antes de autorizar.'
            });
        }
        const selectedProduct = getEcuadorProductInfoByKey(explicitProductKey);
        if (!dropiProductEnabled(selectedProduct)) {
            return res.status(409).json({
                success: false,
                productSelectionRequired: false,
                productTargetRequired: true,
                reason: 'dropi_product_target_not_enabled',
                error: `${selectedProduct?.name || 'Produto'} ainda nao foi validado no catalogo Dropi EC.`
            });
        }
        const productOnlyReviewStatuses = new Set([
            '',
            'pending_review',
            'wrong_product_nitrix_manual_review',
            'dropi_product_price_selection_required',
            'dropi_product_target_not_enabled',
            'awaiting_dropi_authorization',
            'dropi_submit_authorized',
            'dropi_submit_authorization_revoked'
        ]);
        if (shipment.review?.manualOnly && !productOnlyReviewStatuses.has(String(shipment.review.reviewStatus || ''))) {
            return res.status(409).json({
                success: false,
                manualSendRequired: true,
                reason: shipment.review.reviewReason || shipment.review.reviewStatus || 'manual_review_required',
                error: 'Este pedido possui uma revisao manual de rota/agencia que precisa ser resolvida antes da autorizacao Dropi.'
            });
        }
        const duplicateGuard = await getDropiDuplicateGuardForOrder(order, shipment);
        if (!duplicateGuard.allowed) return duplicateGuardResponse(res, duplicateGuard);
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
        shipment.automation.dropiSubmitAuthorizationNote = duplicateGuard.requiresManualAuthorization
            ? [req.body?.note || '', duplicateGuard.message || 'Recompra liberada manualmente'].filter(Boolean).join(' | ')
            : req.body?.note || '';
        shipment.review.manualOnly = false;
        if (
            !shipment.review.reviewStatus
            || shipment.review.reviewStatus === 'pending_review'
            || shipment.review.reviewStatus === 'awaiting_dropi_authorization'
            || shipment.review.reviewStatus === 'dropi_submit_authorization_revoked'
        ) {
            shipment.review.reviewStatus = 'dropi_submit_authorized';
        }
        shipment.events.push({
            kind: 'dropi_submit_authorized',
            at: new Date(),
            payload: {
                authorizedBy: shipment.automation.dropiSubmitAuthorizedBy,
                note: shipment.automation.dropiSubmitAuthorizationNote,
                duplicateGuard
            }
        });
        shipment.events = shipment.events.slice(-60);
        await shipment.save();

        res.json({
            success: true,
            shipment,
            mappedFromOrderId: order._mappedFromAdminLead?.requestedOrderId || '',
            mappedToOrderId: order._mappedFromAdminLead ? order.orderId : ''
        });
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
            if (result?.duplicateBlocked) {
                results.push({
                    orderId: order.orderId,
                    ok: false,
                    duplicateBlocked: true,
                    reason: result.reason || 'dropi_duplicate_blocked',
                    duplicateOrderId: result.guard?.duplicateOrderId || '',
                    duplicateDropiOrderId: result.guard?.duplicateDropiOrderId || '',
                    duplicateTrackingNumber: result.guard?.duplicateTrackingNumber || '',
                    message: result.message || result.error || 'Pedido duplicado bloqueado'
                });
                continue;
            }
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
                dropiOrderId: result?.dropiOrderId
                    || result?.result?.dropiOrderId
                    || result?.result?.verifiedDropiOrderId
                    || result?.result?.dropiResponse?.objects?.id
                    || '',
                trackingNumber: result?.trackingNumber
                    || result?.result?.trackingNumber
                    || result?.result?.verifiedTrackingNumber
                    || '',
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
        const order = await findOrderForDropiRequest(req.params.orderId);
        if (!order) return res.status(404).json({ error: 'Order not found' });

        const shipment = await ensureShipmentForOrder(order, 'EC');
        if (!looksLikeEcuadorOrder(order, shipment)) return dropiDestinationBlockedResponse(res, order, shipment);

        const alreadySubmitted = alreadySubmittedResponse(order, shipment);
        if (alreadySubmitted) return res.json(alreadySubmitted);
        const duplicateGuard = await getDropiDuplicateGuardForOrder(order, shipment);
        if (!duplicateGuard.allowed) return duplicateGuardResponse(res, duplicateGuard);

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

router.post('/manual-guide', adminOnly, async (req, res) => {
    try {
        const {
            orderId = '',
            name = '',
            phone = '',
            country = 'EC',
            city = '',
            province = '',
            address = '',
            reference = '',
            quantity = 1,
            total = 0,
            trackingNumber = '',
            status = 'GUIA_GENERADA',
            agencyPickup = false,
            notifyNow = true,
            forceNotify = true,
            note = ''
        } = req.body || {};

        const effectiveCountry = String(country || 'EC').toUpperCase();
        if (effectiveCountry !== 'EC') {
            return res.status(400).json({
                error: 'manual_guide_ec_only',
                message: 'Guia manual por enquanto esta liberada somente para Equador.'
            });
        }

        let cleanPhone = normalizeManualPhone(phone, effectiveCountry);
        const cleanTracking = String(trackingNumber || '').replace(/\s+/g, '').trim();
        if (!cleanTracking) {
            return res.status(400).json({
                error: 'missing_tracking',
                message: 'Informe a guia/rastreio para enviar manualmente.'
            });
        }

        const normalizedStatus = normalizeManualShipmentStatus(status);
        const manualAgencyPickup = normalizeManualBoolean(agencyPickup)
            || normalizedStatus === 'READY_FOR_PICKUP'
            || /servientrega|agencia|retiro|concesion/i.test(String(address || ''));
        const qty = Math.max(1, Number.parseInt(String(quantity || '1'), 10) || 1);
        const amount = Number.parseFloat(String(total || '0')) || 0;
        const operatorNote = String(note || '').trim() || 'Guia manual criada pelo painel WhatsApp.';
        const trackingDuplicateGuard = await getOrderDuplicateGuard({
            phone: cleanPhone,
            country: effectiveCountry,
            currentOrderId: String(orderId || '').trim(),
            trackingNumber: cleanTracking
        });
        if (!trackingDuplicateGuard.allowed) {
            return duplicateGuardResponse(res, trackingDuplicateGuard);
        }

        let order = orderId ? await Order.findOne({ orderId: String(orderId).trim() }) : null;
        if (!order) {
            order = await Order.findOne({
                country: 'EC',
                trackingNumber: cleanTracking
            }).sort({ updatedAt: -1 });
        }
        if (!order) {
            const existingShipment = await Shipment.findOne({
                country: 'EC',
                'logistics.trackingNumber': cleanTracking
            }).sort({ updatedAt: -1 });
            if (existingShipment?.orderId) {
                order = await Order.findOne({ orderId: existingShipment.orderId });
            }
        }
        if (!order) {
            order = await findRecentOrderByPhone({ phone: cleanPhone, country: 'EC' });
        }

        const orderPhone = normalizeManualPhone(order?.customer?.phone || '', 'EC');
        if (orderPhone && !validateEcuadorDropiPhone(cleanPhone).ok) {
            cleanPhone = orderPhone;
        }

        const phoneValidation = validateEcuadorDropiPhone(cleanPhone);
        if (!phoneValidation.ok) {
            return res.status(400).json({
                error: phoneValidation.reason || 'invalid_ecuador_phone',
                message: 'Informe um WhatsApp celular valido do Equador, ou os 4 ultimos digitos de um cliente ativo.',
                phoneValidation
            });
        }

        if (!order) {
            order = new Order({
                country: 'EC',
                customer: {
                    name: String(name || '').trim() || `Cliente ${cleanPhone.slice(-4)}`,
                    phone: cleanPhone,
                    address: String(address || '').trim(),
                    reference: String(reference || '').trim(),
                    city: String(city || '').trim(),
                    province: String(province || '').trim()
                },
                package: {
                    id: qty,
                    label: ecuadorPackageLabel(resolveEcuadorProductInfo(req.body?.productName, req.body?.product, operatorNote), qty),
                    quantity: qty
                },
                total: amount,
                currency: 'USD',
                status: normalizedStatus === 'ENTREGADO'
                    ? 'delivered'
                    : normalizedStatus === 'DEVUELTO'
                        ? 'returned'
                        : 'shipped',
                source: 'manual',
                notes: operatorNote,
                trackingNumber: cleanTracking,
                shippingStatus: normalizedStatus
            });
            await order.save();
        } else {
            order.customer = {
                ...(order.customer || {}),
                name: String(name || '').trim() || order.customer?.name || '',
                phone: cleanPhone || order.customer?.phone || '',
                address: String(address || '').trim() || order.customer?.address || '',
                reference: String(reference || '').trim() || order.customer?.reference || '',
                city: String(city || '').trim() || order.customer?.city || '',
                province: String(province || '').trim() || order.customer?.province || ''
            };
            order.package = {
                ...(order.package || {}),
                id: order.package?.id || qty,
                label: order.package?.label || ecuadorPackageLabel(resolveEcuadorProductInfo(req.body?.productName, req.body?.product, operatorNote), qty),
                quantity: order.package?.quantity || qty
            };
            if (amount) order.total = amount;
            order.trackingNumber = cleanTracking;
            order.shippingStatus = normalizedStatus;
            order.status = normalizedStatus === 'ENTREGADO'
                ? 'delivered'
                : normalizedStatus === 'DEVUELTO'
                    ? 'returned'
                    : 'shipped';
            order.notes = [order.notes || '', operatorNote].filter(Boolean).join('\n').trim();
            await order.save();
        }

        let shipment = await upsertDroppiEcuadorShipment({
            orderId: order.orderId,
            productName: resolveEcuadorProductInfo(req.body?.productName, req.body?.product, order.package?.label, operatorNote).name,
            clientName: String(name || '').trim() || order.customer?.name || '',
            phone: cleanPhone,
            address: String(address || '').trim() || order.customer?.address || '',
            city: String(city || '').trim() || order.customer?.city || '',
            province: String(province || '').trim() || order.customer?.province || '',
            reference: String(reference || '').trim() || order.customer?.reference || '',
            quantity: qty,
            status: normalizedStatus,
            trackingNumber: cleanTracking,
            distributionCompany: 'SERVIENTREGA',
            chosenCarrier: 'SERVIENTREGA',
            preferredCarrier: 'SERVIENTREGA',
            agencyPickup: manualAgencyPickup,
            notes: operatorNote,
            reviewStatus: 'manual_guide_registered',
            reviewReason: 'manual_guide_missing_from_panel',
            detail: operatorNote
        });

        shipment.events.push({
            kind: 'manual_guide_registered_from_whatsapp_panel',
            at: new Date(),
            payload: {
                trackingNumber: cleanTracking,
                status: normalizedStatus,
                notifyNow: notifyNow !== false,
                forceNotify: forceNotify !== false,
                requestedBy: req.user?.email || req.user?.name || ''
            }
        });
        shipment.events = shipment.events.slice(-60);
        if (forceNotify !== false) {
            shipment.automation.guiaNotifiedAt = null;
            shipment.automation.readyForPickupNotifiedAt = null;
            shipment.automation.lastReminderAt = null;
            shipment.automation.lastReminderKind = '';
        }
        await shipment.save();

        let notifyResult = null;
        if (notifyNow !== false) {
            if (normalizedStatus === 'READY_FOR_PICKUP') {
                notifyResult = {
                    success: await notifyReadyForPickup(shipment, { force: forceNotify !== false }),
                    kind: 'ready_for_pickup'
                };
            } else {
                notifyResult = await notifyShipmentGuideGenerated(shipment, { force: forceNotify !== false });
            }
            shipment = await Shipment.findOne({ orderId: order.orderId }) || shipment;
        }

        syncOrderToOnlineAdminPanel(order, {
            status: order.status,
            action: 'manual_guide_created_from_whatsapp_panel'
        });

        res.json({
            success: true,
            order,
            shipment,
            notifyResult,
            message: notifyNow !== false
                ? 'Guia manual criada e aviso enviado/processado.'
                : 'Guia manual criada.'
        });
    } catch (error) {
        console.error('Manual guide error:', error);
        res.status(500).json({ error: error.message || 'Failed to create manual guide' });
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
        const result = await notifyShipmentGuideGenerated(shipment, { force: req.body?.force === true });
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
        const success = await notifyReadyForPickup(shipment, { force: req.body?.force === true });
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
        const refillReminderDueAt = new Date(pickedAt.getTime() + (repurchaseReminderDelayDaysForUnits(units) * 24 * 60 * 60 * 1000));

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
        const order = await Order.findOne({ orderId: shipment.orderId }).catch(() => null);
        if (order) {
            order.status = 'delivered';
            order.shippingStatus = shipment.logistics?.status || 'ENTREGADO';
            if (shipment.logistics?.trackingNumber) order.trackingNumber = shipment.logistics.trackingNumber;
            await order.save();
            syncOrderToOnlineAdminPanel(order, { status: 'delivered', action: 'pickup_confirmed' });
        }
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
        if (!looksLikeEcuadorOrder(order, shipment)) return dropiDestinationBlockedResponse(res, order, shipment);

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
        if (!looksLikeEcuadorOrder(order, shipment)) return dropiDestinationBlockedResponse(res, order, shipment);
        if (!isAuthorizedForDropiSubmit(shipment)) {
            return res.status(409).json({
                success: false,
                authorizationRequired: true,
                shipment,
                error: 'Pedido precisa ser autorizado antes de marcar envio manual.',
                message: 'Todo pedido precisa de autorizacao antes de qualquer envio, inclusive envio manual.'
            });
        }

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

        if (shipment) {
            shipment.review = {
                ...(shipment.review || {}),
                reviewStatus: 'fake_order_deleted',
                reviewReason: reason,
                manualOnly: true
            };
            shipment.notes = appendAuditNote(
                shipment.notes,
                `Pedido fake arquivado sem apagar historico. Usuario: ${req.user?.email || req.user?.name || 'admin'}.`
            );
            await shipment.save();
        }

        if (order) {
            const previousStatus = order.status;
            order.status = 'cancelled';
            order.notes = appendAuditNote(
                order.notes,
                `Pedido fake arquivado sem apagar historico. Status anterior: ${previousStatus || 'sem_status'}. Usuario: ${req.user?.email || req.user?.name || 'admin'}.`
            );
            await order.save();
        }

        res.json({
            success: true,
            deleted: false,
            archived: true,
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
