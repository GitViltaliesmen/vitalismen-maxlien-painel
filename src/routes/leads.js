import express from 'express';
import Order from '../models/Order.js';
import { getOrderDuplicateGuard } from '../services/orderDuplicateGuardService.js';
import { nextSellerForNewLead, sellerIsActive } from '../services/sellerRotationService.js';

const router = express.Router();

const PRICE_MAP = { 1: 39.99, 3: 95.99, 6: 167.99 };

const clean = (value) => String(value || '').trim();

const digitsOnly = (value) => clean(value).replace(/\D/g, '');

const inferCountryFromPhone = (phone = '') => {
    const digits = digitsOnly(phone);
    if (digits.startsWith('57')) return 'CO';
    if (digits.startsWith('593')) return 'EC';
    return 'EC';
};

const normalizePhoneByCountry = (value, country = 'EC') => {
    let digits = digitsOnly(value);
    if (!digits) return '';
    const normalizedCountry = clean(country).toUpperCase();
    if (normalizedCountry === 'CO') {
        if (digits.startsWith('57')) return `+${digits}`;
        if (digits.startsWith('0') && digits.length === 10) digits = digits.slice(1);
        if (!digits.startsWith('57')) digits = `57${digits}`;
        return `+${digits}`;
    }
    if (digits.startsWith('593')) return `+${digits}`;
    if (digits.length === 10 && digits.startsWith('0')) digits = digits.slice(1);
    if (!digits.startsWith('593')) digits = `593${digits}`;
    return `+${digits}`;
};

const packageLabel = (quantity) => `Vit Power ${quantity} frasco${quantity > 1 ? 's' : ''}`;

const pickSellerAssignment = async ({ country = 'EC', source = 'checkout' } = {}) => {
    const assignment = await nextSellerForNewLead({ country, source });
    return {
        ...assignment,
        seller: digitsOnly(assignment?.seller || process.env.WHATSAPP_SELLER_E164 || process.env.WHATSAPP_DEFAULT_SESSION_ID || '553183002800')
    };
};

const pickExistingOrActiveSellerAssignment = async ({ existingSeller = '', country = 'EC', source = 'checkout' } = {}) => {
    const seller = digitsOnly(existingSeller);
    if (seller && sellerIsActive({ seller, country })) {
        return { seller, reason: 'existing_assignment_active' };
    }
    const assignment = await pickSellerAssignment({ country, source: `${source}_failover` });
    return {
        ...assignment,
        previousSeller: seller,
        reason: seller
            ? `${assignment.reason}_from_inactive_existing_${seller.slice(-4)}`
            : assignment.reason
    };
};

const buildWhatsAppUrl = ({ seller, message }) => {
    const phone = digitsOnly(seller || process.env.WHATSAPP_SELLER_E164 || '553183002800');
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
};

const buildWhatsAppIntentUrl = ({ seller, message }) => {
    const phone = digitsOnly(seller || process.env.WHATSAPP_SELLER_E164 || '553183002800');
    return `intent://send?phone=${phone}&text=${encodeURIComponent(message)}#Intent;scheme=whatsapp;package=com.whatsapp;end`;
};

const firstClean = (...values) => {
    for (const value of values) {
        const cleaned = clean(value);
        if (cleaned) return cleaned;
    }
    return '';
};

const requestIp = (req) => firstClean(
    req.get('cf-connecting-ip'),
    req.get('x-real-ip'),
    req.headers?.['x-forwarded-for']?.split(',')?.[0],
    req.ip,
    req.socket?.remoteAddress
);

const trackingFromBody = (body, req) => {
    const tracking = {};

    const directKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'fbc', 'fbp'];
    for (const key of directKeys) {
        const value = clean(body?.[key]);
        if (value) tracking[key] = value;
    }

    tracking.ext_id = firstClean(body?.external_id, body?.externalId, body?.ext_id);
    tracking.sourceUrl = firstClean(body?.event_source_url, body?.eventSourceUrl, body?.sourceUrl);
    tracking.userAgent = firstClean(body?.client_user_agent, body?.clientUserAgent, body?.user_agent, req.get('user-agent'));
    tracking.ip = firstClean(requestIp(req), body?.client_ip_address, body?.clientIpAddress, body?.ip);

    for (const key of Object.keys(tracking)) {
        if (!tracking[key]) delete tracking[key];
    }

    return tracking;
};

const buildSellerMessage = ({ name, phone, province, city, address, reference, quantity, total }) => [
    'Hola, quiero hacer mi pedido',
    '',
    `Nombre: ${name}`,
    `Telefono: ${phone}`,
    province ? `Provincia: ${province}` : '',
    city ? `Ciudad: ${city}` : '',
    address ? `Direccion: ${address}` : '',
    reference ? `Punto de referencia: ${reference}` : '',
    `Cantidad: ${quantity}`,
    `Total: $${total}`
].filter(Boolean).join('\n');

export const publicWhatsAppRedirect = async (req, res) => {
    const message = clean(req.query?.text || req.query?.msg || 'Hola, quiero hacer mi pedido.');
    const assignment = await pickSellerAssignment({ country: 'EC', source: 'wa_redirect' });
    res.redirect(buildWhatsAppUrl({ seller: assignment.seller, message }));
};

router.post('/', async (req, res) => {
    try {
        const quantity = Number.parseInt(clean(req.body?.product_qty || req.body?.quantity || '1'), 10) || 1;
        const safeQuantity = [1, 3, 6].includes(quantity) ? quantity : 1;
        const total = Number.parseFloat(clean(req.body?.product_value || req.body?.total || PRICE_MAP[safeQuantity])) || PRICE_MAP[safeQuantity];
        const payloadCustomer = req.body?.customer || {};
        const country = clean(req.body?.country || inferCountryFromPhone(req.body?.phone || payloadCustomer.phone || req.body?.phone_number) || 'EC').toUpperCase();
        const phone = normalizePhoneByCountry(req.body?.phone || payloadCustomer.phone || req.body?.phone_number, country);
        if (!['EC', 'CO'].includes(country)) {
            return res.status(400).json({ error: 'Unsupported lead country' });
        }
        const lead = {
            name: clean(req.body?.name || payloadCustomer.name),
            phone,
            address: clean(req.body?.address || payloadCustomer.address),
            reference: clean(req.body?.reference || payloadCustomer.reference),
            city: clean(req.body?.city || payloadCustomer.city),
            province: clean(req.body?.province || payloadCustomer.province)
        };

        if (!lead.name || !lead.phone) {
            return res.status(400).json({ error: 'Incomplete lead data' });
        }

        const phoneTail = digitsOnly(lead.phone).slice(-9);
        const existing = phoneTail
            ? await Order.findOne({
                country,
                status: { $in: ['draft', 'pending', 'confirmed', 'processing', 'shipped'] },
                'customer.phone': { $regex: phoneTail }
            }).sort({ entryAt: -1, createdAt: -1 })
            : null;
        const duplicateGuard = await getOrderDuplicateGuard({
            phone: lead.phone,
            country,
            currentOrderId: existing?.orderId || ''
        });

        const orderData = {
            country,
            customer: lead,
            package: {
                id: safeQuantity,
                label: packageLabel(safeQuantity),
                quantity: safeQuantity
            },
            total,
            currency: 'USD',
            source: 'checkout',
            status: 'pending',
            purchaseIntent: {
                readiness: 'ready_now',
                requestedQuantity: safeQuantity,
                requestedPackageLabel: packageLabel(safeQuantity),
                readyConfirmedAt: new Date()
            },
            tracking: trackingFromBody(req.body, req)
        };

        const isMutableExisting = existing && ['draft', 'pending'].includes(String(existing.status || '').toLowerCase());
        if (existing && !isMutableExisting) {
            const eventId = clean(req.body?.event_id) || existing.orderId;
            const message = buildSellerMessage({ ...lead, quantity: safeQuantity, total });
            const assignment = await pickExistingOrActiveSellerAssignment({
                existingSeller: existing.tracking?.waSelectedNumber,
                country,
                source: 'duplicate_reuse'
            });
            const seller = assignment.seller;
            return res.status(200).json({
                ok: true,
                success: true,
                orderId: existing.orderId,
                event_id: eventId,
                wa_url: buildWhatsAppUrl({ seller, message }),
                wa_app_url: buildWhatsAppIntentUrl({ seller, message }),
                wa_selected_number: seller,
                seller_rotation: assignment,
                alreadyExisted: true,
                duplicateBlocked: true,
                duplicateGuard: {
                    ...duplicateGuard,
                    allowed: false,
                    reason: duplicateGuard.reason === 'active_duplicate_order'
                        ? duplicateGuard.reason
                        : 'existing_active_order_reused',
                    duplicateOrderId: existing.orderId,
                    duplicateStatus: existing.status,
                    message: `Cliente ja possui pedido ativo (${existing.orderId}). Nao foi criado pedido duplicado.`
                }
            });
        }

        const order = existing || new Order(orderData);
        if (existing) {
            order.customer = orderData.customer;
            order.package = orderData.package;
            order.total = orderData.total;
            order.currency = orderData.currency;
            order.source = orderData.source;
            order.status = order.status === 'draft' ? 'pending' : order.status;
            order.purchaseIntent = {
                ...(order.purchaseIntent || {}),
                ...orderData.purchaseIntent
            };
            order.tracking = {
                ...(order.tracking || {}),
                ...orderData.tracking
            };
        }

        const message = buildSellerMessage({ ...lead, quantity: safeQuantity, total });
        const assignment = await pickExistingOrActiveSellerAssignment({
            existingSeller: order.tracking?.waSelectedNumber,
            country,
            source: 'checkout'
        });
        const seller = assignment.seller;
        order.tracking = {
            ...(order.tracking || {}),
            waSelectedNumber: seller
        };

        await order.save();
        const eventId = clean(req.body?.event_id) || order.orderId;

        return res.status(existing ? 200 : 201).json({
            ok: true,
            success: true,
            orderId: order.orderId,
            event_id: eventId,
            wa_url: buildWhatsAppUrl({ seller, message }),
            wa_app_url: buildWhatsAppIntentUrl({ seller, message }),
            wa_selected_number: seller,
            seller_rotation: assignment,
            alreadyExisted: Boolean(existing),
            duplicateBlocked: !duplicateGuard.allowed,
            duplicateGuard
        });
    } catch (error) {
        console.error('Create public lead error:', error);
        return res.status(500).json({ error: 'Failed to create lead' });
    }
});

export default router;
