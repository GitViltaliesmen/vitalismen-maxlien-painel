import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../src/config/db.js';
import ContactState from '../src/models/ContactState.js';
import Order from '../src/models/Order.js';
import { ECUADOR_PRODUCTS, detectExplicitEcuadorProductKey, resolveEcuadorProductInfo } from '../src/services/ecuadorProductService.js';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitArg = args.find((arg) => arg.startsWith('--limit='));
const limit = Math.max(1, Math.min(2000, Number.parseInt(limitArg?.split('=')[1] || '800', 10) || 800));
const onlyTail = String(args.find((arg) => arg.startsWith('--tail='))?.split('=')[1] || '').replace(/\D/g, '');

const digitsOnly = (value = '') => String(value || '').replace(/\D/g, '');
const tailsForPhone = (value = '') => {
    const digits = digitsOnly(value);
    return [...new Set([
        digits,
        digits.length >= 10 ? digits.slice(-10) : '',
        digits.length >= 9 ? digits.slice(-9) : '',
        digits.length >= 8 ? digits.slice(-8) : ''
    ].filter(Boolean))];
};
const panelStatusFromOrder = (status = '') => ({
    confirmed: 'confirmado',
    processing: 'pedido_enviado',
    shipped: 'pedido_enviado',
    delivered: 'entregue',
    cancelled: 'cancelado',
    returned: 'devolvido'
})[String(status || '').trim().toLowerCase()] || 'novo';
const productInfoForKey = (key = '') => (
    key === ECUADOR_PRODUCTS.vitPower.key ? ECUADOR_PRODUCTS.vitPower : ECUADOR_PRODUCTS.nitrix
);
const productMediaForInfo = (productInfo = {}) => (
    productInfo?.key === ECUADOR_PRODUCTS.vitPower.key
        ? '/media/sales/ec/vit_power.jpeg'
        : '/media/sales/ec/nitrix_bottle.png'
);

await connectDB();

try {
    const query = {
        country: 'EC',
        status: { $in: ['confirmed', 'processing', 'shipped', 'delivered'] },
        'customer.phone': { $exists: true, $ne: '' }
    };
    if (onlyTail) query['customer.phone'] = { $regex: `${onlyTail}$` };

    const orders = await Order.find(query)
        .sort({ entryAt: -1, createdAt: -1 })
        .limit(limit)
        .lean();

    let scanned = 0;
    let matched = 0;
    let changed = 0;
    const samples = [];

    for (const order of orders) {
        scanned += 1;
        const tails = tailsForPhone(order.customer?.phone);
        if (!tails.length) continue;
        const state = await ContactState.findOne({
            countryCode: 'EC',
            $or: tails.flatMap((tail) => ([
                { phoneDigits: { $regex: `${tail}$` } },
                { chatId: { $regex: tail } },
                { 'metadata.customerDraft.phone': { $regex: `${tail}$` } },
                { 'metadata.lastSenderPn': { $regex: `${tail}$` } }
            ]))
        }).sort({ updatedAt: -1, lastInboundAt: -1 }).lean();
        if (!state) continue;
        matched += 1;

        const currentDraft = state.metadata?.customerDraft || {};
        const productKey = detectExplicitEcuadorProductKey(order, currentDraft, state.metadata || {});
        const productInfo = productKey ? productInfoForKey(productKey) : resolveEcuadorProductInfo(order, currentDraft, state.metadata || {});
        const productMedia = productMediaForInfo(productInfo);
        const currentOrderId = String(currentDraft.orderId || '').trim();
        const sourceOrderId = currentOrderId && currentOrderId !== order.orderId
            ? currentOrderId
            : String(currentDraft.sourceOrderId || '').trim();
        const nextDraft = {
            ...currentDraft,
            name: order.customer?.name || currentDraft.name || '',
            phone: order.customer?.phone || currentDraft.phone || '',
            country: 'EC',
            city: order.customer?.city || currentDraft.city || '',
            province: order.customer?.province || currentDraft.province || '',
            address: order.customer?.address || currentDraft.address || '',
            reference: order.customer?.reference || currentDraft.reference || '',
            status: panelStatusFromOrder(order.status),
            quantity: order.package?.quantity ?? currentDraft.quantity ?? '',
            total: order.total ?? currentDraft.total ?? '',
            orderId: order.orderId,
            ...(sourceOrderId ? { sourceOrderId } : {}),
            product: productInfo.name,
            productKey: productInfo.key,
            productName: productInfo.name,
            productMedia,
            updatedAt: new Date().toISOString()
        };

        const needsChange = String(state.assignedAgent || '') !== productInfo.key
            || String(state.metadata?.productKey || '') !== productInfo.key
            || String(currentDraft.orderId || '') !== order.orderId
            || String(currentDraft.productKey || '') !== productInfo.key
            || String(currentDraft.productName || '') !== productInfo.name
            || String(currentDraft.product || '') !== productInfo.name
            || String(currentDraft.productMedia || '') !== productMedia;
        if (!needsChange) continue;

        changed += 1;
        samples.push({
            phone: order.customer?.phone || '',
            orderId: order.orderId,
            previousOrderId: currentDraft.orderId || '',
            productKey: productInfo.key,
            dryRun
        });
        if (!dryRun) {
            await ContactState.updateOne(
                { _id: state._id },
                {
                    $set: {
                        assignedAgent: productInfo.key,
                        phoneDigits: state.phoneDigits || digitsOnly(order.customer?.phone),
                        countryCode: 'EC',
                        'metadata.productKey': productInfo.key,
                        'metadata.productName': productInfo.name,
                        'metadata.productMedia': productMedia,
                        'metadata.customerDraft': nextDraft
                    }
                }
            );
        }
    }

    console.log(JSON.stringify({
        ok: true,
        dryRun,
        scanned,
        matched,
        changed,
        samples: samples.slice(0, 20)
    }, null, 2));
} finally {
    await mongoose.disconnect().catch(() => null);
}
