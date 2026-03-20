import express from 'express';
import Order from '../models/Order.js';
import { authMiddleware } from '../middleware/auth.js';
import { processPendingFunnelByOrderId } from '../services/funnelService.js';
import { sendPurchaseEventForOrder } from '../services/metaConversionsService.js';

const router = express.Router();

// GET /api/orders - List orders (authenticated)
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { country, status, page = 1, limit = 50, search, includeDrafts } = req.query;

        const query = {};

        if (country) query.country = country;
        if (status) {
            query.status = status;
        } else if (!includeDrafts) {
            // By default, exclude drafts unless explicitly requested
            query.status = { $ne: 'draft' };
        }
        if (search) {
            query.$or = [
                { orderId: { $regex: search, $options: 'i' } },
                { 'customer.name': { $regex: search, $options: 'i' } },
                { 'customer.phone': { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [orders, total] = await Promise.all([
            Order.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            Order.countDocuments(query)
        ]);

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
        const currency = country === 'EC' ? 'USD' : 'COP';

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
        const { customer, packageId, packageLabel, total, tracking } = req.body;

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

        // Convert to pending
        order.status = 'pending';
        order.lastInteractionAt = new Date();

        // Ensure we store IP/UA for later CAPI usage
        order.tracking = order.tracking || {};
        if (!order.tracking.ip) order.tracking.ip = req.ip;
        if (!order.tracking.userAgent) order.tracking.userAgent = req.get('user-agent') || '';

        await order.save();

        console.log(`✅ Draft submitted: ${order.orderId} -> pending`);

        // Trigger funnel (audio01 + confirmation + offer)
        (async () => {
            try {
                await processPendingFunnelByOrderId(order.orderId);
            } catch (err) {
                console.error('Async Funnel Error:', err);
            }
        })();

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
        const { country, customer, packageId, packageLabel, total, currency, source = 'checkout', tracking } = req.body;

        // Validation
        if (!country || !customer || !packageId || !total) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (!customer.name || !customer.phone || !customer.address || !customer.city || !customer.province) {
            return res.status(400).json({ error: 'Incomplete customer data' });
        }

        // Determine currency from country
        const orderCurrency = currency || (country === 'EC' ? 'USD' : 'COP');

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
                quantity: 1
            },
            total,
            currency: orderCurrency,
            source,
            status: 'pending',
            tracking: {
                ...(tracking || {}),
                ip: req.ip,
                userAgent: req.get('user-agent') || ''
            }
        });

        await order.save();

        console.log(`✅ New order created: ${order.orderId} - ${country} - ${customer.name}`);

        // Trigger funnel (audio01 + confirmation + offer)
        (async () => {
            try {
                await processPendingFunnelByOrderId(order.orderId);
            } catch (err) {
                console.error('Async Funnel Error:', err);
            }
        })();

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
        const { status, notes, trackingNumber } = req.body;

        const order = await Order.findOne({ orderId: req.params.id });

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        if (status) order.status = status;
        if (notes) order.notes = notes;
        if (trackingNumber) order.trackingNumber = trackingNumber;

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

        // Update status to confirmed (current UX label is "Confirmar Pagamento")
        order.status = 'confirmed';

        // Ensure we have IP/UA stored (best effort)
        order.tracking = order.tracking || {};
        if (!order.tracking.ip) order.tracking.ip = req.ip;
        if (!order.tracking.userAgent) order.tracking.userAgent = req.get('user-agent') || '';

        // Idempotency
        if (order.tracking.metaPurchaseSentAt) {
            await order.save();
            return res.json({ success: true, alreadySent: true, order });
        }

        const result = await sendPurchaseEventForOrder(order);

        if (result.ok) {
            order.tracking.metaPurchaseEventId = result.eventId;
            order.tracking.metaPurchaseSentAt = new Date();
            order.tracking.metaPurchaseResponse = result.response;
        } else {
            // Store error response for debugging (no tokens)
            order.tracking.metaPurchaseEventId = result.eventId;
            order.tracking.metaPurchaseResponse = { ok: false, status: result.status, data: result.data, error: result.error };
        }

        await order.save();
        return res.json({ success: result.ok, result, order });
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
                }
            });
        } else {
            res.json({ found: false });
        }
    } catch (error) {
        console.error('Check phone error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
