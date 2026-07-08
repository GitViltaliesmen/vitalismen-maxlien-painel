import express from 'express';
import Order from '../models/Order.js';
import Shipment from '../models/Shipment.js';
import Message from '../models/Message.js';
import { authMiddleware } from '../middleware/auth.js';
import { sendPurchaseEventForOrder } from '../services/metaConversionsService.js';
import { syncOrderToOnlineAdminPanel } from '../services/adminPanelStatusService.js';
import {
    getCustomerPurchaseEligibility,
    PREPAID_REQUIRED_MESSAGE
} from '../services/customerPurchaseEligibilityService.js';
import {
    assertNoActiveDuplicateOrder,
    getOrderDuplicateGuard
} from '../services/orderDuplicateGuardService.js';
import { ecuadorPackageLabel, ecuadorProductMetadata, resolveEcuadorProductInfo } from '../services/ecuadorProductService.js';

const router = express.Router();

const normalizeOrderStatus = (status) => {
    const value = String(status || '').trim().toLowerCase().replace(/-/g, '_');
    const aliases = {
        confirmado: 'confirmed',
        pedido_enviado: 'processing',
        enviado: 'processing',
        entregue: 'delivered',
        recompra: 'delivered',
        cancelado: 'cancelled',
        devolvido: 'returned'
    };
    return aliases[value] || value;
};

const digitsOnly = (value) => String(value || '').replace(/\D/g, '');

const VALID_PACKAGE_QUANTITIES = new Set([1, 2, 3, 6]);

const normalizePackageQuantity = (value) => {
    const parsed = Number.parseInt(String(value ?? '').trim(), 10);
    return VALID_PACKAGE_QUANTITIES.has(parsed) ? parsed : 0;
};

const orderHasValidPackage = (order) => normalizePackageQuantity(order?.package?.quantity || order?.package?.id) > 0;

const isEcuadorCountry = (country = '') => String(country || '').trim().toUpperCase() === 'EC';

const productInfoFromOrderRequest = ({
    country = 'EC',
    productKey = '',
    productName = '',
    product = '',
    packageLabel = '',
    notes = '',
    tracking = {},
    existingOrder = null
} = {}) => {
    if (!isEcuadorCountry(country)) return null;
    return resolveEcuadorProductInfo(
        productKey,
        productName,
        product,
        packageLabel,
        notes,
        tracking,
        existingOrder || {}
    );
};

const productAwarePackageLabel = ({ country = 'EC', productInfo = null, quantity = 0, fallback = '' } = {}) => (
    isEcuadorCountry(country) && productInfo
        ? ecuadorPackageLabel(productInfo, quantity)
        : (fallback || `Package ${quantity}`)
);

const productTrackingMetadata = (productInfo = null) => (
    productInfo ? ecuadorProductMetadata(productInfo) : {}
);

const isBrazilTestOnly = ({ phone = '', country = '' } = {}) => {
    const normalizedCountry = String(country || '').trim().toUpperCase();
    const phoneDigits = digitsOnly(phone);
    return normalizedCountry === 'BR' || phoneDigits.startsWith('55');
};

const appendAuditNote = (current = '', note = '') => {
    const prefix = current ? `${String(current).trim()}\n` : '';
    return `${prefix}[${new Date().toISOString()}] ${note}`.trim();
};

const blankReviewQueueFilter = {
    $or: [
        { 'reviewQueue.status': { $exists: false } },
        { 'reviewQueue.status': '' },
        { 'reviewQueue.status': null }
    ]
};

const SALE_CONCLUDED_REGEX = /\b(pedido\s+(confirmado|confirmad[oó]|registrado)|venta\s+confirmada|confirm[oó]|autoriz[oó]|autorizado|listo|correcto|correto|de\s+acuerdo|esta\s+bien|s[ií]\b|si\s+senor|confirmar\s+pedido)\b/i;
const SALE_NOT_CONCLUDED_REGEX = /\b(no\s+quiero|no\s+confirmo|cancele|cancelar|despues|luego|no\s+por\s+ahora|solo\s+preguntaba)\b/i;

const messagePhoneClauses = (phone = '') => {
    const digits = digitsOnly(phone);
    const tails = [
        digits,
        digits.length >= 10 ? digits.slice(-10) : '',
        digits.length >= 9 ? digits.slice(-9) : ''
    ].filter(Boolean);
    return [...new Set(tails)].flatMap((tail) => ([
        { peerPhone: { $regex: `${tail}$` } },
        { chatId: { $regex: tail } },
        { from: { $regex: tail } },
        { to: { $regex: tail } }
    ]));
};

const findSaleConclusionEvidence = async (order) => {
    const phoneClauses = messagePhoneClauses(order.customer?.phone || '');
    if (!phoneClauses.length) return '';
    const since = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
    const messages = await Message.find({
        $or: phoneClauses,
        createdAt: { $gte: since },
        body: { $type: 'string', $ne: '' }
    })
        .sort({ createdAt: -1 })
        .limit(80)
        .select('body isFromMe createdAt')
        .lean();
    const negative = messages.find((message) => SALE_NOT_CONCLUDED_REGEX.test(message.body || ''));
    if (negative) return '';
    const positive = messages.find((message) => SALE_CONCLUDED_REGEX.test(message.body || ''));
    if (!positive) return '';
    return String(positive.body || '').replace(/\s+/g, ' ').trim().slice(0, 180);
};

const hasShipmentProgress = (shipment = null, order = null) => {
    const status = String(shipment?.logistics?.status || order?.shippingStatus || '').toUpperCase();
    return Boolean(order?.dropiOrderId || order?.trackingNumber || shipment?.raw?.droppiOrder?.id || shipment?.logistics?.trackingNumber)
        || /GUIA|PREPARADO|PENDIENTE|MERCANCIA|BODEGA|DESPACHO|RUTA|REPARTO|READY_FOR_PICKUP|AGENCIA|ENTREGADO|DEVUELTO|CANCELADO/.test(status);
};

const markOrderReviewQueue = async (order, { status, reason = '', evidence = '', user = null } = {}) => {
    const now = new Date();
    order.reviewQueue = order.reviewQueue || {};
    order.reviewQueue.status = status;
    order.reviewQueue.reason = reason;
    order.reviewQueue.evidence = evidence;
    if (status === 'conferir_pedidos') {
        order.reviewQueue.movedAt = now;
        order.reviewQueue.movedBy = user?.email || user?.name || 'painel';
    }
    if (status === 'finalizado') {
        order.reviewQueue.finalizedAt = now;
        order.reviewQueue.finalizedBy = user?.email || user?.name || 'painel';
    }
    order.notes = appendAuditNote(order.notes, `${status === 'finalizado' ? 'Pedido finalizado operacionalmente' : 'Pedido enviado para Conferir Pedidos'}: ${reason || 'acao_painel'}${evidence ? ` | Evidencia: ${evidence}` : ''}`);
    await order.save();
    if (status === 'finalizado' || status === 'conferir_pedidos') {
        syncOrderToOnlineAdminPanel(order, {
            status,
            action: status === 'finalizado' ? 'order_review_finalized' : 'order_sent_to_review'
        });
    }
    return order;
};

const sendBrazilTestOnlyError = (res) => res.status(409).json({
    success: false,
    error: 'brazil_test_only',
    message: 'Numero brasileiro liberado somente para teste de atendimento. Nao criar, confirmar ou enviar pedido.'
});

const markPurchaseEventForOrder = async (order, req) => {
    if (!orderHasValidPackage(order)) {
        return { ok: false, skipped: true, reason: 'missing_valid_quantity', order };
    }
    if (!(Number(order.total || 0) > 0)) {
        return { ok: false, skipped: true, reason: 'missing_positive_total', order };
    }
    if (!order.confirmedAt) order.confirmedAt = new Date();
    order.status = 'confirmed';

    order.tracking = order.tracking || {};
    if (!order.tracking.ip) order.tracking.ip = req.ip;
    if (!order.tracking.userAgent) order.tracking.userAgent = req.get('user-agent') || '';

    if (order.tracking.metaPurchaseSentAt) {
        await order.save();
        return { ok: true, alreadySent: true, order };
    }

    const result = await sendPurchaseEventForOrder(order);

    order.tracking.metaPurchaseEventId = result.eventId;
    if (result.ok) {
        order.tracking.metaPurchaseSentAt = new Date();
        order.tracking.metaPurchaseResponse = result.response;
    } else {
        order.tracking.metaPurchaseResponse = {
            ok: false,
            status: result.status,
            data: result.data,
            error: result.error
        };
    }

    await order.save();
    return { ok: result.ok, result, order };
};

const assertCashOnDeliveryEligible = async ({ phone, country = 'EC' }) => {
    const eligibility = await getCustomerPurchaseEligibility({ phone, country });
    if (eligibility.eligible) return eligibility;
    const error = new Error(eligibility.message || PREPAID_REQUIRED_MESSAGE);
    error.statusCode = 409;
    error.code = 'prepaid_only_required';
    error.eligibility = eligibility;
    throw error;
};

const sendEligibilityError = (res, error) => res.status(error.statusCode || 409).json({
    success: false,
    error: error.code || 'prepaid_only_required',
    message: error.message || PREPAID_REQUIRED_MESSAGE,
    paymentMode: 'prepaid_only',
    reason: error.eligibility?.reason || 'previous_order_not_picked_up',
    latestOrderId: error.eligibility?.latestShipment?.orderId || ''
});

const sendDuplicateOrderError = (res, errorOrGuard) => {
    const guard = errorOrGuard.guard || errorOrGuard;
    return res.status(errorOrGuard.statusCode || 409).json({
        success: false,
        error: guard.reason || errorOrGuard.code || 'active_duplicate_order',
        message: guard.message || errorOrGuard.message || 'Pedido duplicado bloqueado',
        duplicateOrderId: guard.duplicateOrderId || '',
        duplicateStatus: guard.duplicateStatus || '',
        latestOrderId: guard.latestOrderId || '',
        requiresManualAuthorization: Boolean(guard.requiresManualAuthorization)
    });
};

// GET /api/orders - List orders (authenticated)
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { country, status, page = 1, limit = 50, search, includeDrafts, readiness, review } = req.query;

        const query = {};
        const andConditions = [];

        if (country) query.country = country;
        const includeShipment = req.query.includeShipment === '1';
        if (review) {
            query['reviewQueue.status'] = review;
        }
        if (status === 'dropi_pipeline') {
            query.status = { $in: ['confirmed', 'processing', 'shipped', 'delivered'] };
            if (!review) {
                andConditions.push({
                    $or: [
                        { 'reviewQueue.status': { $exists: false } },
                        { 'reviewQueue.status': '' },
                        { 'reviewQueue.status': null }
                    ]
                });
            }
        } else if (status) {
            query.status = status;
        } else if (!includeDrafts) {
            // By default, exclude drafts unless explicitly requested
            query.status = { $ne: 'draft' };
        }
        if (search) {
            andConditions.push({ $or: [
                { orderId: { $regex: search, $options: 'i' } },
                { 'customer.name': { $regex: search, $options: 'i' } },
                { 'customer.phone': { $regex: search, $options: 'i' } }
            ] });
        }
        if (readiness === 'buy_later') {
            andConditions.push({ $or: [
                { 'purchaseIntent.readiness': 'buy_later' },
                { 'purchaseIntent.followUpAt': { $exists: true, $ne: null } }
            ] });
        } else if (readiness) {
            query['purchaseIntent.readiness'] = readiness;
        }
        if (andConditions.length) {
            query.$and = andConditions;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [orderDocs, total] = await Promise.all([
            Order.find(query)
                .sort({ entryAt: -1, createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            Order.countDocuments(query)
        ]);
        const orders = orderDocs.map((order) => order.toObject());

        if (includeShipment && orders.length) {
            const orderIds = orders.map((order) => order.orderId).filter(Boolean);
            const shipments = await Shipment.find({ orderId: { $in: orderIds } }).lean();
            const shipmentByOrderId = new Map(shipments.map((shipment) => [shipment.orderId, shipment]));
            orders.forEach((order) => {
                order.shipment = shipmentByOrderId.get(order.orderId) || null;
            });
        }

        res.json({
            orders,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/orders/stats - Order statistics (authenticated)
router.get('/stats', authMiddleware, async (req, res) => {
    try {
        const { country } = req.query;
        const query = country ? { country } : {};

        const stats = await Order.aggregate([
            { $match: query },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    total: { $sum: '$total' }
                }
            }
        ]);

        const countryStats = await Order.aggregate([
            { $match: query },
            {
                $group: {
                    _id: '$country',
                    count: { $sum: 1 },
                    total: { $sum: '$total' }
                }
            }
        ]);

        res.json({ statusStats: stats, countryStats });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/orders/review/bulk-from-confirmed - Move old confirmed queue into Conferir Pedidos or finalize without deleting history.
router.post('/review/bulk-from-confirmed', authMiddleware, async (req, res) => {
    try {
        const country = String(req.body?.country || req.query?.country || 'EC').trim().toUpperCase();
        const limit = Math.max(1, Math.min(Number.parseInt(String(req.body?.limit || '300'), 10) || 300, 1000));
        const dryRun = req.body?.dryRun !== false;
        const orders = await Order.find({
            country,
            status: 'confirmed',
            ...blankReviewQueueFilter
        }).sort({ createdAt: -1 }).limit(limit);
        const shipments = await Shipment.find({
            orderId: { $in: orders.map((order) => order.orderId).filter(Boolean) }
        }).lean();
        const shipmentByOrderId = new Map(shipments.map((shipment) => [shipment.orderId, shipment]));
        const results = [];
        let toReview = 0;
        let finalized = 0;
        let skipped = 0;

        for (const order of orders) {
            const shipment = shipmentByOrderId.get(order.orderId);
            if (hasShipmentProgress(shipment, order)) {
                skipped += 1;
                results.push({ orderId: order.orderId, action: 'skip', reason: 'already_has_dropi_or_tracking' });
                continue;
            }
            const evidence = await findSaleConclusionEvidence(order);
            if (evidence) {
                toReview += 1;
                results.push({ orderId: order.orderId, action: 'conferir_pedidos', evidence });
                if (!dryRun) {
                    await markOrderReviewQueue(order, {
                        status: 'conferir_pedidos',
                        reason: 'bulk_from_pedidos_confirmados_with_history',
                        evidence,
                        user: req.user
                    });
                }
            } else {
                finalized += 1;
                results.push({ orderId: order.orderId, action: 'finalizado', reason: 'no_sale_conclusion_history_found' });
                if (!dryRun) {
                    await markOrderReviewQueue(order, {
                        status: 'finalizado',
                        reason: 'bulk_from_pedidos_confirmados_without_history',
                        user: req.user
                    });
                }
            }
        }

        res.json({
            success: true,
            dryRun,
            scanned: orders.length,
            toReview,
            finalized,
            skipped,
            results
        });
    } catch (error) {
        console.error('Bulk review move error:', error);
        res.status(500).json({ error: 'Failed to move confirmed orders to review' });
    }
});

// POST /api/orders/:id/send-to-review - Send a single order to Conferir Pedidos.
router.post('/:id/send-to-review', authMiddleware, async (req, res) => {
    try {
        const order = await Order.findOne({ orderId: req.params.id });
        if (!order) return res.status(404).json({ error: 'Order not found' });
        const evidence = String(req.body?.evidence || '') || await findSaleConclusionEvidence(order);
        await markOrderReviewQueue(order, {
            status: 'conferir_pedidos',
            reason: String(req.body?.reason || 'operator_sent_to_review'),
            evidence,
            user: req.user
        });
        res.json({ success: true, order });
    } catch (error) {
        console.error('Send order to review error:', error);
        res.status(500).json({ error: 'Failed to send order to review' });
    }
});

// POST /api/orders/:id/finalize-review - Close noisy/old confirmed items without deleting history.
router.post('/:id/finalize-review', authMiddleware, async (req, res) => {
    try {
        const order = await Order.findOne({ orderId: req.params.id });
        if (!order) return res.status(404).json({ error: 'Order not found' });
        await markOrderReviewQueue(order, {
            status: 'finalizado',
            reason: String(req.body?.reason || 'operator_finalized_review'),
            evidence: String(req.body?.evidence || ''),
            user: req.user
        });
        res.json({ success: true, order });
    } catch (error) {
        console.error('Finalize order review error:', error);
        res.status(500).json({ error: 'Failed to finalize order review' });
    }
});

// POST /api/orders/:id/clear-review - Remove from Conferir Pedidos after manual approval.
router.post('/:id/clear-review', authMiddleware, async (req, res) => {
    try {
        const order = await Order.findOne({ orderId: req.params.id });
        if (!order) return res.status(404).json({ error: 'Order not found' });
        order.reviewQueue = {
            ...(order.reviewQueue || {}),
            status: '',
            reason: String(req.body?.reason || 'approved_from_conferir_pedidos'),
            movedBy: req.user?.email || req.user?.name || 'painel'
        };
        order.notes = appendAuditNote(order.notes, `Pedido aprovado e removido de Conferir Pedidos: ${order.reviewQueue.reason}`);
        await order.save();
        res.json({ success: true, order });
    } catch (error) {
        console.error('Clear order review error:', error);
        res.status(500).json({ error: 'Failed to clear order review' });
    }
});

// GET /api/orders/:id - Get single order
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const order = await Order.findOne({ orderId: req.params.id });

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.json({ order });
    } catch (error) {
        console.error('Get order error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/orders/:id - Archive/cancel order without erasing customer history.
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const order = await Order.findOne({ orderId: req.params.id });

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const previousStatus = order.status;
        order.status = 'cancelled';
        order.notes = appendAuditNote(
            order.notes,
            `Pedido arquivado pelo painel sem apagar historico. Status anterior: ${previousStatus || 'sem_status'}.`
        );
        await order.save();
        syncOrderToOnlineAdminPanel(order, { status: 'cancelled', action: 'order_archived_from_panel' });

        res.json({
            success: true,
            deleted: false,
            archived: true,
            order,
            message: 'Order archived without deleting customer history'
        });
    } catch (error) {
        console.error('Archive order error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ==========================================
// DRAFT SYSTEM ROUTES
// ==========================================

// POST /api/orders/draft - Create a new draft (public)
// Called when user enters phone + full name (2 names)
router.post('/draft', async (req, res) => {
    try {
        const { country, phone, name, tracking } = req.body;

        if (!country || !phone || !name) {
            return res.status(400).json({ error: 'Country, phone and name are required' });
        }

        // Validate name has at least 2 words
        const nameParts = name.trim().split(/\s+/);
        if (nameParts.length < 2) {
            return res.status(400).json({ error: 'Full name must have at least 2 names' });
        }

        // Determine currency from country
        const currency = 'USD';

        // 1. Check if a DRAFT already exists for this phone
        // We match by the last 10 digits to be safe against format differences
        const phoneDigits = phone.replace(/\D/g, '').slice(-10);
        const existingDraft = await Order.findOne({
            country,
            status: 'draft',
            'customer.phone': { $regex: phoneDigits }
        }).sort({ createdAt: -1 });

        const duplicateGuard = await getOrderDuplicateGuard({
            phone,
            country,
            currentOrderId: existingDraft?.orderId || ''
        });
        if (!duplicateGuard.allowed) return sendDuplicateOrderError(res, duplicateGuard);

        if (existingDraft) {
            // Update the existing draft with latest name/formatting
            existingDraft.customer.name = name;
            existingDraft.customer.phone = phone; // update to latest format used by user
            existingDraft.updatedAt = new Date();

            if (tracking) {
                existingDraft.tracking = {
                    ...(existingDraft.tracking || {}),
                    ...(tracking || {}),
                    ip: req.ip,
                    userAgent: req.get('user-agent') || ''
                };
            }

            await existingDraft.save();
            console.log(`♻️ Draft reused: ${existingDraft.orderId} - ${name}`);

            return res.status(200).json({
                success: true,
                draftId: existingDraft.orderId,
                message: 'Draft updated'
            });
        }

        // Create draft order
        const draft = new Order({
            country,
            currency,
            customer: {
                phone: phone,
                name: name,
                address: '',
                reference: '',
                city: '',
                province: ''
            },
            package: {
                id: 0,
                label: '',
                quantity: 0
            },
            total: 0,
            status: 'draft',
            source: 'checkout',
            draftCreatedAt: new Date(),
            tracking: {
                ...(tracking || {}),
                ip: req.ip,
                userAgent: req.get('user-agent') || ''
            }
        });

        await draft.save();

        console.log(`📝 Draft created: ${draft.orderId} - ${country} - ${name} - ${phone}`);

        res.status(201).json({
            success: true,
            draftId: draft.orderId,
            message: 'Draft created'
        });
    } catch (error) {
        console.error('Create draft error:', error);
        res.status(500).json({ error: 'Failed to create draft' });
    }
});

// GET /api/orders/draft/:id/tracking - Debug tracking payload (public, dev-only)
router.get('/draft/:id/tracking', async (req, res) => {
    try {
        if (String(process.env.DEBUG_TRACKING || '') !== '1') {
            return res.status(404).json({ error: 'Not found' });
        }

        const order = await Order.findOne({ orderId: req.params.id });
        if (!order) return res.status(404).json({ error: 'Not found' });

        const t = order.tracking || {};
        return res.json({
            orderId: order.orderId,
            country: order.country,
            status: order.status,
            tracking: {
                fbclid: t.fbclid || null,
                fbc: t.fbc || null,
                fbp: t.fbp || null,
                sourceUrl: t.sourceUrl || null,
                ip: t.ip || null,
                userAgentLength: typeof t.userAgent === 'string' ? t.userAgent.length : null,
                metaPurchaseSentAt: t.metaPurchaseSentAt || null
            }
        });
    } catch (error) {
        console.error('Debug tracking error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// PATCH /api/orders/draft/:id - Update draft in real-time (public)
// Called as user fills form fields
router.patch('/draft/:id', async (req, res) => {
    try {
        const { customer, packageId, packageLabel, total, tracking, purchaseIntent } = req.body;

        const order = await Order.findOne({ orderId: req.params.id, status: 'draft' });

        if (!order) {
            return res.status(404).json({ error: 'Draft not found' });
        }

        // Update customer data if provided
        if (customer) {
            if (customer.name) order.customer.name = customer.name;
            if (customer.phone) order.customer.phone = customer.phone;
            if (customer.address) order.customer.address = customer.address;
            if (customer.reference !== undefined) order.customer.reference = customer.reference || '';
            if (customer.city) order.customer.city = customer.city;
            if (customer.province) order.customer.province = customer.province;
        }

        // Update package if provided
        if (packageId !== undefined) {
            const normalizedQuantity = normalizePackageQuantity(packageId);
            order.package.id = normalizedQuantity;
            order.package.label = normalizedQuantity ? (packageLabel || `Package ${normalizedQuantity}`) : '';
            order.package.quantity = normalizedQuantity;
        }

        // Update total if provided
        if (total !== undefined) {
            order.total = total;
        }

        if (tracking) {
            order.tracking = order.tracking || {};
            for (const [k, v] of Object.entries(tracking)) {
                if (v !== undefined && v !== null && String(v).length > 0) {
                    order.tracking[k] = v;
                }
            }
            // Always refresh IP/UA if missing
            if (!order.tracking.ip) order.tracking.ip = req.ip;
            if (!order.tracking.userAgent) order.tracking.userAgent = req.get('user-agent') || '';
        }

        if (purchaseIntent) {
            order.purchaseIntent = {
                ...(order.purchaseIntent || {}),
                ...purchaseIntent
            };
        }

        await order.save();

        res.json({
            success: true,
            orderId: order.orderId,
            message: 'Draft updated'
        });
    } catch (error) {
        console.error('Update draft error:', error);
        res.status(500).json({ error: 'Failed to update draft' });
    }
});

// POST /api/orders/draft/:id/submit - Convert draft to pending (public)
// Called on final form submit
router.post('/draft/:id/submit', async (req, res) => {
    try {
        const { purchaseIntent } = req.body || {};
        const order = await Order.findOne({ orderId: req.params.id, status: 'draft' });

        if (!order) {
            return res.status(404).json({ error: 'Draft not found' });
        }

        // Validate required fields before submitting
        if (!order.customer.name || !order.customer.phone ||
            !order.customer.address || !order.customer.city || !order.customer.province) {
            return res.status(400).json({ error: 'Incomplete customer data' });
        }

        if (!order.package.id || order.total <= 0) {
            return res.status(400).json({ error: 'Package not selected' });
        }

        if (isBrazilTestOnly({ phone: order.customer?.phone, country: order.country })) {
            return sendBrazilTestOnlyError(res);
        }

        try {
            await assertNoActiveDuplicateOrder({
                phone: order.customer.phone,
                country: order.country,
                currentOrderId: order.orderId
            });
            await assertCashOnDeliveryEligible({
                phone: order.customer.phone,
                country: order.country
            });
        } catch (eligibilityError) {
            if (eligibilityError.code === 'active_duplicate_order') {
                return sendDuplicateOrderError(res, eligibilityError);
            }
            return sendEligibilityError(res, eligibilityError);
        }

        // Convert to pending
        order.status = 'pending';
        order.lastInteractionAt = new Date();
        if (purchaseIntent) {
            order.purchaseIntent = {
                ...(order.purchaseIntent || {}),
                ...purchaseIntent
            };
        }

        // Ensure we store IP/UA for later CAPI usage
        order.tracking = order.tracking || {};
        if (!order.tracking.ip) order.tracking.ip = req.ip;
        if (!order.tracking.userAgent) order.tracking.userAgent = req.get('user-agent') || '';

        await order.save();

        console.log(`✅ Draft submitted: ${order.orderId} -> pending`);

        res.json({
            success: true,
            orderId: order.orderId,
            message: 'Order submitted successfully'
        });
    } catch (error) {
        console.error('Submit draft error:', error);
        res.status(500).json({ error: 'Failed to submit order' });
    }
});

// ==========================================
// LEGACY ROUTES (for backward compatibility)
// ==========================================

// POST /api/orders - Create order directly (public - from checkout)
router.post('/', async (req, res) => {
    try {
        const { country, customer, packageId, packageLabel, total, currency, source = 'checkout', tracking, purchaseIntent, status, notes, productKey, productName, product } = req.body;

        // Validation
        if (!country || !customer || !packageId || !total) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        const normalizedPackageQuantity = normalizePackageQuantity(packageId);
        if (!normalizedPackageQuantity) {
            return res.status(400).json({ error: 'Quantidade valida obrigatoria: 1, 2, 3 ou 6 frascos.' });
        }

        if (!customer.name || !customer.phone || !customer.address || !customer.city || !customer.province) {
            return res.status(400).json({ error: 'Incomplete customer data' });
        }

        if (isBrazilTestOnly({ phone: customer.phone, country })) {
            return sendBrazilTestOnlyError(res);
        }

        try {
            await assertNoActiveDuplicateOrder({
                phone: customer.phone,
                country
            });
            await assertCashOnDeliveryEligible({
                phone: customer.phone,
                country
            });
        } catch (eligibilityError) {
            if (eligibilityError.code === 'active_duplicate_order') {
                return sendDuplicateOrderError(res, eligibilityError);
            }
            return sendEligibilityError(res, eligibilityError);
        }

        // Determine currency from country
        const orderCurrency = currency || 'USD';
        const requestedStatus = normalizeOrderStatus(status);
        const allowedInitialStatuses = new Set(['draft', 'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned']);
        const initialStatus = allowedInitialStatuses.has(requestedStatus) ? requestedStatus : 'pending';
        const productInfo = productInfoFromOrderRequest({
            country,
            productKey,
            productName,
            product,
            packageLabel,
            notes,
            tracking
        });
        const productTracking = productTrackingMetadata(productInfo);

        // Create order
        const order = new Order({
            country,
            customer: {
                name: customer.name,
                phone: customer.phone,
                address: customer.address,
                reference: customer.reference || '',
                city: customer.city,
                province: customer.province
            },
            package: {
                id: normalizedPackageQuantity,
                label: productAwarePackageLabel({
                    country,
                    productInfo,
                    quantity: normalizedPackageQuantity,
                    fallback: packageLabel
                }),
                quantity: normalizedPackageQuantity
            },
            total,
            currency: orderCurrency,
            source,
            status: initialStatus,
            notes: typeof notes === 'string' ? notes : '',
            purchaseIntent: purchaseIntent || {},
            tracking: {
                ...(tracking || {}),
                ...productTracking,
                ip: req.ip,
                userAgent: req.get('user-agent') || ''
            }
        });

        await order.save();
        let purchase = null;
        if (initialStatus === 'confirmed') {
            purchase = await markPurchaseEventForOrder(order, req);
        }

        console.log(`✅ New order created: ${order.orderId} - ${country} - ${customer.name}`);

        res.status(201).json({
            success: true,
            orderId: order.orderId,
            purchase: purchase ? {
                ok: purchase.ok,
                alreadySent: purchase.alreadySent || false,
                eventId: purchase.result?.eventId || purchase.order?.tracking?.metaPurchaseEventId || '',
                response: purchase.result?.response || purchase.order?.tracking?.metaPurchaseResponse || null
            } : null,
            message: 'Order created successfully'
        });
    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({ error: 'Failed to create order' });
    }
});

// PATCH /api/orders/:id - Update order status (authenticated)
router.patch('/:id', authMiddleware, async (req, res) => {
    try {
        const { status, notes, trackingNumber, purchaseIntent, customer, package: packageData, total, productKey, productName, product } = req.body;
        const nextStatus = normalizeOrderStatus(status);

        const order = await Order.findOne({ orderId: req.params.id });

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const requestedCustomerPhone = typeof customer?.phone === 'string' ? customer.phone : order.customer?.phone;
        const requestedCountry = typeof req.body.country === 'string' ? req.body.country : order.country;
        if (isBrazilTestOnly({ phone: requestedCustomerPhone, country: requestedCountry })) {
            return sendBrazilTestOnlyError(res);
        }

        if (typeof notes === 'string') order.notes = notes;
        if (trackingNumber) order.trackingNumber = trackingNumber;
        const productInfo = productInfoFromOrderRequest({
            country: order.country,
            productKey,
            productName,
            product,
            packageLabel: packageData?.label,
            notes,
            tracking: order.tracking || {},
            existingOrder: order
        });
        if (productInfo) {
            order.tracking = {
                ...(order.tracking || {}),
                ...productTrackingMetadata(productInfo)
            };
        }
        if (customer && typeof customer === 'object') {
            const allowedCustomerFields = ['name', 'phone', 'address', 'reference', 'city', 'province'];
            allowedCustomerFields.forEach((field) => {
                if (typeof customer[field] === 'string') {
                    order.customer[field] = customer[field].trim();
                }
            });
        }
        if (packageData && typeof packageData === 'object') {
            if (Object.prototype.hasOwnProperty.call(packageData, 'quantity')) {
                const normalizedQuantity = normalizePackageQuantity(packageData.quantity);
                order.package.quantity = normalizedQuantity;
                order.package.id = normalizedQuantity;
            }
            if (order.package.quantity) {
                order.package.label = productAwarePackageLabel({
                    country: order.country,
                    productInfo,
                    quantity: order.package.quantity,
                    fallback: typeof packageData.label === 'string' ? packageData.label.trim() : order.package.label
                });
            } else if (typeof packageData.label === 'string') {
                order.package.label = '';
            }
        }
        if (total !== undefined && total !== null && total !== '') {
            const parsedTotal = Number(total);
            if (Number.isFinite(parsedTotal) && parsedTotal >= 0) {
                order.total = parsedTotal;
            }
        }
        if (purchaseIntent) {
            order.purchaseIntent = {
                ...(order.purchaseIntent || {}),
                ...purchaseIntent
            };
        }

        if (nextStatus === 'confirmed') {
            try {
                await assertNoActiveDuplicateOrder({
                    phone: order.customer?.phone,
                    country: order.country,
                    currentOrderId: order.orderId
                });
            } catch (duplicateError) {
                return sendDuplicateOrderError(res, duplicateError);
            }
            const purchase = await markPurchaseEventForOrder(order, req);
            return res.json({
                ok: purchase.ok,
                success: purchase.ok,
                alreadySent: purchase.alreadySent || false,
                result: purchase.result,
                order: purchase.order,
                message: purchase.alreadySent
                    ? 'Order already confirmed'
                    : purchase.ok
                        ? 'Order confirmed and purchase event sent'
                        : 'Order confirmed, but purchase event failed'
            });
        }

        if (nextStatus) {
            const previousStatus = String(order.status || '').toLowerCase();
            order.status = nextStatus;
            if (nextStatus === 'confirmed' && previousStatus !== 'confirmed' && !order.confirmedAt) {
                order.confirmedAt = new Date();
            }
        }

        await order.save();

        res.json({
            success: true,
            order,
            message: 'Order updated'
        });
    } catch (error) {
        console.error('Update order error:', error);
        res.status(500).json({ error: 'Failed to update order' });
    }
});

// POST /api/orders/:id/confirm-payment - Confirm payment + send META Purchase (authenticated)
router.post('/:id/confirm-payment', authMiddleware, async (req, res) => {
    try {
        const order = await Order.findOne({ orderId: req.params.id });
        if (!order) return res.status(404).json({ error: 'Order not found' });
        if (isBrazilTestOnly({ phone: order.customer?.phone, country: order.country })) {
            return sendBrazilTestOnlyError(res);
        }
        try {
            await assertNoActiveDuplicateOrder({
                phone: order.customer?.phone,
                country: order.country,
                currentOrderId: order.orderId
            });
        } catch (duplicateError) {
            return sendDuplicateOrderError(res, duplicateError);
        }

        const purchase = await markPurchaseEventForOrder(order, req);
        return res.json({
            ok: purchase.ok,
            success: purchase.ok,
            alreadySent: purchase.alreadySent || false,
            result: purchase.result,
            order: purchase.order
        });
    } catch (error) {
        console.error('Confirm payment error:', error);
        res.status(500).json({ error: 'Failed to confirm payment' });
    }
});

// POST /api/orders/check-phone - Check if phone exists (public - for returning user flow)
router.post('/check-phone', async (req, res) => {
    try {
        const { phone, country } = req.body;

        if (!phone) {
            return res.status(400).json({ error: 'Phone required' });
        }

        if (isBrazilTestOnly({ phone, country })) {
            return res.json({
                found: false,
                eligibility: {
                    eligible: false,
                    paymentMode: 'test_only',
                    reason: 'brazil_test_only',
                    message: 'Numero brasileiro liberado somente para teste de atendimento. Nao criar, confirmar ou enviar pedido.'
                }
            });
        }

        const eligibility = await getCustomerPurchaseEligibility({
            phone,
            country: country || 'EC'
        });

        // Find most recent completed order with this phone (not drafts)
        const order = await Order.findOne({
            'customer.phone': { $regex: phone.replace(/\D/g, '').slice(-10) },
            status: { $ne: 'draft' },
            ...(country && { country })
        }).sort({ createdAt: -1 });

        if (order) {
            res.json({
                found: true,
                user: {
                    name: order.customer.name,
                    phone: order.customer.phone,
                    address: order.customer.address,
                    city: order.customer.city,
                    province: order.customer.province
                },
                eligibility: {
                    eligible: eligibility.eligible,
                    paymentMode: eligibility.paymentMode,
                    reason: eligibility.reason,
                    message: eligibility.eligible ? '' : eligibility.message
                }
            });
        } else {
            res.json({
                found: false,
                eligibility: {
                    eligible: eligibility.eligible,
                    paymentMode: eligibility.paymentMode,
                    reason: eligibility.reason,
                    message: eligibility.eligible ? '' : eligibility.message
                }
            });
        }
    } catch (error) {
        console.error('Check phone error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
