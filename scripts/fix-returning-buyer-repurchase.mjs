import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Order from '../src/models/Order.js';
import Shipment from '../src/models/Shipment.js';
import ContactState from '../src/models/ContactState.js';

dotenv.config();

const args = process.argv.slice(2);
const hasFlag = (name) => args.includes(`--${name}`);
const argValue = (name, fallback = '') => {
    const prefix = `--${name}=`;
    const found = args.find((arg) => arg.startsWith(prefix));
    return found ? found.slice(prefix.length) : fallback;
};

const digitsOnly = (value = '') => String(value || '').replace(/\D/g, '');
const appendNote = (current = '', note = '') => {
    const prefix = current ? `${String(current).trim()}\n` : '';
    return `${prefix}[${new Date().toISOString()}] ${note}`.trim();
};

const packageTotal = (quantity) => ({
    1: 39,
    2: 70,
    3: 95.99,
    6: 167.99
})[quantity] || 39;

const packageLabel = (quantity) => `Vit Power ${quantity} frasco${quantity > 1 ? 's' : ''}`;

const buildRepurchaseOrderId = () => {
    const stamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `EC-RECOMPRA-${stamp}-${random}`;
};

const normalizePhone = (value = '') => {
    const digits = digitsOnly(value);
    return digits ? `+${digits}` : '';
};

const phoneRegexes = (phone = '') => {
    const digits = digitsOnly(phone);
    return [...new Set([digits, digits.slice(-10), digits.slice(-9)].filter((item) => item.length >= 8))]
        .map((tail) => ({ 'customer.phone': { $regex: `${tail}$` } }));
};

const phoneStateQuery = (phone = '') => {
    const digits = digitsOnly(phone);
    const tails = [...new Set([digits, digits.slice(-10), digits.slice(-9)].filter((item) => item.length >= 8))];
    return {
        $or: [
            ...tails.map((tail) => ({ phoneDigits: { $regex: `${tail}$` } })),
            ...tails.map((tail) => ({ chatId: { $regex: tail } })),
            ...tails.map((tail) => ({ 'metadata.customerDraft.phone': { $regex: tail } }))
        ]
    };
};

const main = async () => {
    const apply = hasFlag('apply');
    const phone = argValue('phone', '593982805735');
    const oldOrderId = argValue('old-order', 'EC-ADMIN-680');
    const pickupDate = new Date(argValue('pickup-date', '2026-04-24T15:00:00.000Z'));
    const quantity = Number.parseInt(argValue('quantity', '3'), 10) || 3;
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/vitalismen';

    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 });

    const [oldOrder, oldShipment, state] = await Promise.all([
        Order.findOne({ orderId: oldOrderId }),
        Shipment.findOne({ orderId: oldOrderId }),
        ContactState.findOne(phoneStateQuery(phone)).sort({ updatedAt: -1 })
    ]);

    if (!oldOrder) throw new Error(`Pedido antigo nao encontrado: ${oldOrderId}`);

    const existingRepurchase = await Order.findOne({
        country: 'EC',
        previousOrderId: oldOrderId,
        $or: phoneRegexes(phone)
    }).sort({ createdAt: -1 });

    const draft = state?.metadata?.customerDraft || {};
    const entryAt = state?.lastInboundAt || state?.updatedAt || new Date();
    const total = packageTotal(quantity);
    const customer = {
        name: draft.name || oldOrder.customer?.name || 'Victor Cevallos',
        phone: normalizePhone(draft.phone || phone || oldOrder.customer?.phone),
        address: draft.address || oldOrder.customer?.address || '',
        reference: draft.reference || oldOrder.customer?.reference || '',
        city: draft.city || oldOrder.customer?.city || '',
        province: draft.province || oldOrder.customer?.province || ''
    };

    const summary = {
        apply,
        phone,
        oldOrderId,
        oldOrderStatus: oldOrder.status,
        oldShipmentStatus: oldShipment?.logistics?.status || '',
        existingRepurchaseOrderId: existingRepurchase?.orderId || '',
        newOrderPreview: existingRepurchase ? null : {
            customer,
            quantity,
            total,
            entryAt
        }
    };

    if (!apply) {
        console.log(JSON.stringify({ ok: true, dryRun: true, summary }, null, 2));
        await mongoose.disconnect();
        return;
    }

    oldOrder.status = 'delivered';
    oldOrder.previousDeliveredAt = oldOrder.previousDeliveredAt || pickupDate;
    oldOrder.notes = appendNote(
        oldOrder.notes,
        `Pedido historico marcado como entregue/retirado em 2026-04-24 para liberar recompra real. Fonte: correcao operacional solicitada pelo atendimento.`
    );
    await oldOrder.save();

    if (oldShipment) {
        oldShipment.logistics.status = 'ENTREGADO';
        oldShipment.logistics.lastStatusAt = oldShipment.logistics.lastStatusAt || pickupDate;
        oldShipment.automation.deliveredConfirmedAt = oldShipment.automation.deliveredConfirmedAt || pickupDate;
        oldShipment.outcomes.delivered = true;
        oldShipment.outcomes.pickedUp = true;
        oldShipment.review.manualOnly = false;
        oldShipment.review.reviewStatus = oldShipment.review.reviewStatus || 'historical_delivered';
        oldShipment.notes = appendNote(oldShipment.notes, 'Marcado como historico entregue/retirado para nao bloquear recompra real.');
        oldShipment.events.push({
            kind: 'historical_pickup_confirmed',
            at: new Date(),
            payload: {
                pickedUpAt: pickupDate,
                reason: 'returning_buyer_repurchase_fix',
                oldOrderId
            }
        });
        oldShipment.events = oldShipment.events.slice(-60);
        await oldShipment.save();
    }

    let repurchase = existingRepurchase;
    let shipment = repurchase ? await Shipment.findOne({ orderId: repurchase.orderId }) : null;

    if (!repurchase) {
        repurchase = new Order({
            orderId: buildRepurchaseOrderId(),
            country: 'EC',
            customer,
            package: {
                id: quantity,
                label: packageLabel(quantity),
                quantity
            },
            total,
            currency: 'USD',
            status: 'confirmed',
            source: 'whatsapp',
            entryAt,
            entryReason: 'repeat_purchase_after_delivered',
            previousOrderId: oldOrderId,
            previousDeliveredAt: pickupDate,
            confirmedAt: entryAt,
            notes: appendNote('', `Recompra real criada a partir da conversa WhatsApp. Pedido anterior ${oldOrderId} retirado em 2026-04-24. Cliente pediu promocao de ${quantity} frascos.`),
            purchaseIntent: {
                readiness: 'ready_now',
                requestedQuantity: quantity,
                requestedPackageLabel: packageLabel(quantity),
                readyConfirmedAt: entryAt
            },
            conversationMemory: {
                currentIntent: 'repurchase_intent',
                funnelStage: 'order_closed',
                lastCustomerMessageAt: state?.lastInboundAt || entryAt,
                lastBotMessageAt: state?.lastOutboundAt || entryAt,
                lastSummary: `Recompra confirmada apos pedido historico ${oldOrderId}.`
            },
            draftCreatedAt: entryAt,
            lastInteractionAt: entryAt
        });
        await repurchase.save();
    }

    if (!shipment) {
        shipment = new Shipment({
            orderId: repurchase.orderId,
            country: 'EC',
            provider: 'droppi',
            productName: 'Vit Power',
            client: {
                ...customer,
                phone: digitsOnly(customer.phone)
            },
            logistics: {
                status: 'created',
                preferredCarrier: 'SERVIENTREGA',
                agencyPickup: /servientrega|agencia/i.test(customer.address),
                agencyName: /servientrega/i.test(customer.address) ? customer.address.replace(/^Servientrega\s*/i, '').split('-')[0].trim() : ''
            },
            treatment: {
                unitsPurchased: quantity,
                daysPerUnit: 30,
                targetUnits: 6
            },
            review: {
                manualOnly: false,
                reviewReason: 'recompra_real_requires_operator_dropi_authorization',
                reviewStatus: 'awaiting_dropi_authorization'
            },
            notes: appendNote('', `Remessa criada para recompra real. Conferir dados e autorizar Dropi pelo painel.`),
            events: [{
                kind: 'repurchase_order_created',
                at: new Date(),
                payload: {
                    previousOrderId: oldOrderId,
                    quantity,
                    total
                }
            }]
        });
        await shipment.save();
    }

    if (state) {
        const tags = new Set([...(Array.isArray(state.tags) ? state.tags : []), 'RECOMPRA_REAL', 'COMMERCIAL_READY']);
        state.tags = [...tags];
        state.metadata = {
            ...(state.metadata || {}),
            customerDraft: {
                ...(state.metadata?.customerDraft || {}),
                ...customer,
                phone: digitsOnly(customer.phone),
                country: 'EC',
                quantity: String(quantity),
                total: String(total),
                status: 'confirmed',
                orderId: repurchase.orderId,
                previousOrderId: oldOrderId,
                entryReason: 'repeat_purchase_after_delivered',
                updatedAt: new Date().toISOString()
            },
            orderStatus: 'PEDIDO_CONFIRMADO',
            lastKnownFunnelStage: 'order_closed',
            returningBuyerFix: {
                at: new Date(),
                oldOrderId,
                newOrderId: repurchase.orderId,
                previousDeliveredAt: pickupDate
            }
        };
        state.markModified('metadata');
        await state.save();
    }

    console.log(JSON.stringify({
        ok: true,
        applied: true,
        oldOrderId,
        oldOrderStatus: 'delivered',
        repurchaseOrderId: repurchase.orderId,
        shipmentOrderId: shipment.orderId,
        quantity,
        total
    }, null, 2));

    await mongoose.disconnect();
};

main().catch(async (error) => {
    console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
    await mongoose.disconnect().catch(() => null);
    process.exit(1);
});
