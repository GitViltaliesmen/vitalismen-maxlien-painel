import express from 'express';
import Order from '../models/Order.js';
import Shipment from '../models/Shipment.js';
import { authMiddleware } from '../middleware/auth.js';
import { sendPurchaseEventForOrder } from '../services/metaConversionsService.js';
import {
    getCustomerPurchaseEligibility,
    PREPAID_REQUIRED_MESSAGE
} from '../services/customerPurchaseEligibilityService.js';

const router = express.Router();

const normalizeOrderStatus = (status) => {
    if (status === 'confirmado') return 'confirmed';
    return status;
};

const markPurchaseEventForOrder = async (order, req) => {
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

// GET /api/orders - List orders (authenticated)
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { country, status, page = 1, limit = 50, search, includeDrafts, readiness } = req.query;

        const query = {};
        const andConditions = [];

        if (country) query.country = country;
        const includeShipment = req.query.includeShipment === '1';
        if (status === 'dropi_pipeline') {
            query.status = { $in: ['confirmed', 'processing', 'shipped', 'delivered'] };
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
                .sort({ createdAt: -1 })
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

// DELETE /api/orders/:id - Delete order (authenticated)
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const result = await Order.deleteOne({ orderId: req.params.id });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.json({ success: true, message: 'Order deleted' });
    } catch (error) {
        console.error('Delete order error:', error);
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
                city: '',
                province: ''
            },
            package: {
                id: 0,
                label: '',
                quantity: 1
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
            if (customer.city) order.customer.city = customer.city;
            if (customer.province) order.customer.province = customer.province;
        }

        // Update package if provided
        if (packageId !== undefined) {
            order.package.id = packageId;
            order.package.label = packageLabel || `Package ${packageId}`;
            order.package.quantity = Number(packageId) || order.package.quantity || 1;
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

        try {
            await assertCashOnDeliveryEligible({
                phone: order.customer.phone,
                country: order.country
            });
        } catch (eligibilityError) {
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
        const { country, customer, packageId, packageLabel, total, currency, source = 'checkout', tracking, purchaseIntent } = req.body;

        // Validation
        if (!country || !customer || !packageId || !total) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (!customer.name || !customer.phone || !customer.address || !customer.city || !customer.province) {
            return res.status(400).json({ error: 'Incomplete customer data' });
        }

        try {
            await assertCashOnDeliveryEligible({
                phone: customer.phone,
                country
            });
        } catch (eligibilityError) {
            return sendEligibilityError(res, eligibilityError);
        }

        // Determine currency from country
        const orderCurrency = currency || 'USD';

        // Create order
        const order = new Order({
            country,
            customer: {
                name: customer.name,
                phone: customer.phone,
                address: customer.address,
                city: customer.city,
                province: customer.province
            },
            package: {
                id: packageId,
                label: packageLabel || `Package ${packageId}`,
                quantity: Number(packageId) || 1
            },
            total,
            currency: orderCurrency,
            source,
            status: 'pending',
            purchaseIntent: purchaseIntent || {},
            tracking: {
                ...(tracking || {}),
                ip: req.ip,
                userAgent: req.get('user-agent') || ''
            }
        });

        await order.save();

        console.log(`✅ New order created: ${order.orderId} - ${country} - ${customer.name}`);

        res.status(201).json({
            success: true,
            orderId: order.orderId,
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
        const { status, notes, trackingNumber, purchaseIntent } = req.body;
        const nextStatus = normalizeOrderStatus(status);

        const order = await Order.findOne({ orderId: req.params.id });

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        if (notes) order.notes = notes;
        if (trackingNumber) order.trackingNumber = trackingNumber;
        if (purchaseIntent) {
            order.purchaseIntent = {
                ...(order.purchaseIntent || {}),
                ...purchaseIntent
            };
        }

        if (nextStatus === 'confirmed') {
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

        if (nextStatus) order.status = nextStatus;

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
