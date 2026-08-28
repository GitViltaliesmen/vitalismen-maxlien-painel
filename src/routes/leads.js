import express from 'express';
import Order from '../models/Order.js';
import { getOrderDuplicateGuard } from '../services/orderDuplicateGuardService.js';
import { nextSellerForNewLead, sellerIsActive } from '../services/sellerRotationService.js';
import { sendBrowserMetaEvent } from '../services/metaConversionsService.js';
import { syncOrderToOnlineAdminPanel } from '../services/adminPanelStatusService.js';
import {
    ecuadorPackageLabel,
    ecuadorProductMetadata,
    resolveEcuadorProductInfo,
    validateExplicitEcuadorProductSelection
} from '../services/ecuadorProductService.js';

const router = express.Router();

const PRICE_MAP = { 1: 39.99, 2: 70, 3: 95.99, 6: 167.99 };

const clean = (value) => String(value || '').trim();

const digitsOnly = (value) => clean(value).replace(/\D/g, '');

const inferCountryFromPhone = (phone = '') => {
    const digits = digitsOnly(phone);
    if (digits.startsWith('593')) return 'EC';
    return 'EC';
};

const normalizePhoneByCountry = (value, country = 'EC') => {
    let digits = digitsOnly(value);
    if (!digits) return '';
    if (digits.startsWith('593')) return `+${digits}`;
    if (digits.length === 10 && digits.startsWith('0')) digits = digits.slice(1);
    if (!digits.startsWith('593')) digits = `593${digits}`;
    return `+${digits}`;
};

const packageLabel = (quantity, productInfo) => ecuadorPackageLabel(productInfo, quantity);

const pickSellerAssignment = async ({ country = 'EC', source = 'checkout' } = {}) => {
    const assignment = await nextSellerForNewLead({ country, source });
    return {
        ...assignment,
        seller: digitsOnly(assignment?.seller || process.env.WHATSAPP_SELLER_E164 || process.env.WHATSAPP_DEFAULT_SESSION_ID)
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
    const phone = digitsOnly(seller || process.env.WHATSAPP_SELLER_E164 || process.env.WHATSAPP_DEFAULT_SESSION_ID);
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
};

const buildWhatsAppIntentUrl = ({ seller, message }) => {
    const phone = digitsOnly(seller || process.env.WHATSAPP_SELLER_E164 || process.env.WHATSAPP_DEFAULT_SESSION_ID);
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

const buildSellerMessage = ({ name, phone, province, city, address, reference, quantity, total, productInfo }) => [
    'Hola, quiero hacer mi pedido',
    '',
    `Producto: ${productInfo?.name || 'Vit Power'}`,
    `Nombre: ${name}`,
    `Telefono: ${phone}`,
    province ? `Provincia: ${province}` : '',
    city ? `Ciudad: ${city}` : '',
    address ? `Direccion: ${address}` : '',
    reference ? `Punto de referencia: ${reference}` : '',
    `Cantidad: ${quantity}`,
    `Total: $${total}`
].filter(Boolean).join('\n');

const sendInitiateCheckoutForLead = async ({ order, lead, body, req, quantity, total }) => {
    try {
        const eventId = firstClean(
            body?.initiateCheckoutEventId,
            body?.initiate_checkout_event_id,
            body?.event_id_initiate_checkout,
            `InitiateCheckout:${order?.orderId || Date.now()}`
        ).slice(0, 220);
        return await sendBrowserMetaEvent({
            country: order?.country || 'EC',
            eventName: 'InitiateCheckout',
            event_id: eventId,
            event_source_url: firstClean(body?.event_source_url, body?.eventSourceUrl, body?.sourceUrl, order?.tracking?.sourceUrl),
            client_user_agent: firstClean(body?.client_user_agent, body?.clientUserAgent, order?.tracking?.userAgent),
            client_ip_address: firstClean(body?.client_ip_address, body?.clientIpAddress, order?.tracking?.ip),
            fbc: firstClean(body?.fbc, order?.tracking?.fbc),
            fbp: firstClean(body?.fbp, order?.tracking?.fbp),
            external_id: firstClean(body?.external_id, body?.externalId, order?.tracking?.ext_id, order?.orderId),
            name: lead?.name,
            phone: lead?.phone,
            city: lead?.city,
            province: lead?.province,
            content_name: resolveEcuadorProductInfo(order).contentName,
            content_ids: resolveEcuadorProductInfo(order).contentIds,
            content_type: 'product',
            value: total,
            currency: order?.currency || 'USD',
            quantity,
            meta_destination: body?.meta_destination ?? body?.metaDestination
        }, req);
    } catch (error) {
        console.warn('[META] InitiateCheckout lead nao enviado:', error.message || error);
        return { ok: false, error: error.message || 'initiate_checkout_failed' };
    }
};

const syncVslOrderToPanel = (order, { action = 'vsl_lead_sync' } = {}) => {
    try {
        return syncOrderToOnlineAdminPanel(order, {
            status: order?.status || 'pending',
            action
        });
    } catch (error) {
        console.warn('[VSL_PANEL_SYNC] falha ao espelhar lead no painel:', error.message || error);
        return { ok: false, error: error.message || 'vsl_panel_sync_failed' };
    }
};

export const publicWhatsAppRedirect = async (req, res) => {
    const message = clean(req.query?.text || req.query?.msg || 'Hola, quiero hacer mi pedido.');
    const assignment = await pickSellerAssignment({ country: 'EC', source: 'wa_redirect' });
    res.redirect(buildWhatsAppUrl({ seller: assignment.seller, message }));
};

router.post('/', async (req, res) => {
    try {
        const quantity = Number.parseInt(clean(req.body?.product_qty || req.body?.quantity || '1'), 10) || 1;
        const safeQuantity = [1, 2, 3, 6].includes(quantity) ? quantity : 1;
        const total = Number.parseFloat(clean(req.body?.product_value || req.body?.total || PRICE_MAP[safeQuantity])) || PRICE_MAP[safeQuantity];
        const payloadCustomer = req.body?.customer || {};
        const country = clean(req.body?.country || inferCountryFromPhone(req.body?.phone || payloadCustomer.phone || req.body?.phone_number) || 'EC').toUpperCase();
        const phone = normalizePhoneByCountry(req.body?.phone || payloadCustomer.phone || req.body?.phone_number, country);
        if (country !== 'EC') {
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
        const productInfo = resolveEcuadorProductInfo(
            req.body?.productKey,
            req.body?.product,
            req.body?.productName,
            req.body?.content_name,
            req.body?.event_source_url,
            req.body?.eventSourceUrl,
            req.body?.sourceUrl,
            req.body?.utm_campaign,
            req.body?.utm_content
        );

        const productSelection = validateExplicitEcuadorProductSelection({
            productKey: req.body?.productKey,
            identifiers: [
                req.body?.product,
                req.body?.productName,
                req.body?.content_name,
                req.body?.event_source_url,
                req.body?.eventSourceUrl,
                req.body?.sourceUrl,
                req.body?.utm_campaign,
                req.body?.utm_content
            ]
        });

        if (!productSelection.ok || !productInfo.key) {
            return res.status(400).json({
                error: 'Produto EC explicito obrigatorio: tex_ultra_ec, nitrix_ec ou vit_power_ec.',
                reason: productSelection.reason || 'missing_explicit_product'
            });
        }

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
                label: packageLabel(safeQuantity, productInfo),
                quantity: safeQuantity
            },
            total,
            currency: 'USD',
            source: 'checkout',
            status: 'pending',
            purchaseIntent: {
                readiness: 'ready_now',
                requestedQuantity: safeQuantity,
                requestedPackageLabel: packageLabel(safeQuantity, productInfo),
                readyConfirmedAt: new Date()
            },
            tracking: {
                ...trackingFromBody(req.body, req),
                ...ecuadorProductMetadata(productInfo)
            }
        };

        const isMutableExisting = existing && ['draft', 'pending'].includes(String(existing.status || '').toLowerCase());
        if (existing && !isMutableExisting) {
            const eventId = clean(req.body?.event_id) || existing.orderId;
            const message = buildSellerMessage({ ...lead, quantity: safeQuantity, total, productInfo });
            const assignment = await pickExistingOrActiveSellerAssignment({
                existingSeller: existing.tracking?.waSelectedNumber,
                country,
                source: 'duplicate_reuse'
            });
            const seller = assignment.seller;
            const initiateCheckout = await sendInitiateCheckoutForLead({
                order: existing,
                lead,
                body: req.body,
                req,
                quantity: safeQuantity,
                total
            });
            const adminPanelSync = syncVslOrderToPanel(existing, { action: 'vsl_duplicate_reuse_sync' });
            return res.status(200).json({
                ok: true,
                success: true,
                orderId: existing.orderId,
                event_id: eventId,
                meta: {
                    initiateCheckout: {
                        ok: Boolean(initiateCheckout?.ok),
                        eventId: initiateCheckout?.eventId || null,
                        error: initiateCheckout?.ok ? null : (initiateCheckout?.error || 'META InitiateCheckout send failed')
                    }
                },
                adminPanelSync,
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

        const message = buildSellerMessage({ ...lead, quantity: safeQuantity, total, productInfo });
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
        const adminPanelSync = syncVslOrderToPanel(order, { action: existing ? 'vsl_lead_update_sync' : 'vsl_lead_create_sync' });
        const eventId = clean(req.body?.event_id) || order.orderId;
        const initiateCheckout = await sendInitiateCheckoutForLead({
            order,
            lead,
            body: req.body,
            req,
            quantity: safeQuantity,
            total
        });

        return res.status(existing ? 200 : 201).json({
            ok: true,
            success: true,
            orderId: order.orderId,
            event_id: eventId,
            meta: {
                initiateCheckout: {
                    ok: Boolean(initiateCheckout?.ok),
                    eventId: initiateCheckout?.eventId || null,
                    error: initiateCheckout?.ok ? null : (initiateCheckout?.error || 'META InitiateCheckout send failed')
                }
            },
            adminPanelSync,
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
