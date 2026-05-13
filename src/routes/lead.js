import express from 'express';
import Order from '../models/Order.js';

const router = express.Router();

const PRICE_MAP = {
    1: 39.99,
    3: 95.99,
    6: 167.99
};

const PACKAGE_LABEL_MAP = {
    1: '1 frasco',
    3: '3 frascos',
    6: '6 frascos'
};

const digits = (value) => String(value || '').replace(/\D/g, '');
const clean = (value) => String(value || '').trim();

const buildTracking = (body, req) => ({
    fbclid: clean(body.fbclid),
    fbc: clean(body.fbc),
    fbp: clean(body.fbp),
    ext_id: clean(body.ext_id),
    utm_source: clean(body.utm_source),
    utm_medium: clean(body.utm_medium),
    utm_campaign: clean(body.utm_campaign),
    utm_content: clean(body.utm_content),
    utm_term: clean(body.utm_term),
    sourceUrl: clean(body.event_source_url || body.sourceUrl),
    ip: req.ip,
    userAgent: clean(body.user_agent) || req.get('user-agent') || ''
});

router.post('/', async (req, res) => {
    try {
        const country = clean(req.body.country || 'EC').toUpperCase();
        const name = clean(req.body.name);
        const phone = digits(req.body.phone);
        const province = clean(req.body.province);
        const city = clean(req.body.city);
        const address = clean(req.body.address);
        const reference = clean(req.body.reference);
        const quantity = Number.parseInt(req.body.product_qty, 10);
        const fallbackPrice = PRICE_MAP[quantity] || PRICE_MAP[1];
        const total = Number.parseFloat(req.body.product_value) || fallbackPrice;

        if (country !== 'EC') {
            return res.status(400).json({ success: false, error: 'Unsupported country' });
        }

        if (!name || !phone || !province || !city || !address || !reference || !quantity || !total) {
            return res.status(400).json({ success: false, error: 'Incomplete lead data' });
        }

        const phoneDigits = phone.slice(-10);
        let order = await Order.findOne({
            country,
            status: 'draft',
            'customer.phone': { $regex: phoneDigits }
        }).sort({ createdAt: -1 });

        if (!order) {
            order = new Order({
                country,
                currency: 'USD',
                status: 'draft',
                source: 'checkout'
            });
        }

        order.customer = {
            ...(order.customer || {}),
            name,
            phone,
            province,
            city,
            address,
            reference
        };

        order.package = {
            ...(order.package || {}),
            id: quantity,
            quantity,
            label: PACKAGE_LABEL_MAP[quantity] || `${quantity} frascos`
        };

        order.total = Number(total.toFixed(2));
        order.tracking = {
            ...(order.tracking || {}),
            ...buildTracking(req.body, req)
        };
        order.purchaseIntent = {
            ...(order.purchaseIntent || {}),
            readiness: 'ready_now',
            requestedQuantity: quantity,
            requestedPackageLabel: order.package.label,
            desiredPurchaseTiming: 'vsl_checkout_form'
        };
        order.draftCreatedAt = order.draftCreatedAt || new Date();

        await order.save();

        return res.status(200).json({
            success: true,
            draftId: order.orderId,
            orderId: order.orderId,
            event_id: order.orderId,
            wa_url: null
        });
    } catch (error) {
        console.error('Create VSL lead error:', error);
        return res.status(500).json({ success: false, error: 'Failed to register lead' });
    }
});

export default router;
