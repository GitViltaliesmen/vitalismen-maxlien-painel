import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import mongoose from 'mongoose';
import connectDB from '../src/config/db.js';
import Order from '../src/models/Order.js';
import ContactState from '../src/models/ContactState.js';
import Shipment from '../src/models/Shipment.js';
import { getOrderDuplicateGuard } from '../src/services/orderDuplicateGuardService.js';

const phones = process.argv.slice(2);

if (!phones.length) {
    console.error('Uso: node scripts/diagnose-dropi-phones.mjs +593...');
    process.exit(1);
}

const onlyDigits = (value) => String(value || '').replace(/\D/g, '');
const tail = (value, size = 9) => onlyDigits(value).slice(-size);

const getAdminLeads = (phone) => {
    const phoneTail = tail(phone);
    if (!phoneTail) return [];
    try {
        const likeTail = `%${phoneTail}`.replace(/'/g, "''");
        const sql = `
            SELECT id,name,phone,phone_e164,status,city,province,product_qty,product_value,event_id,created_at,updated_at
            FROM leads
            WHERE phone LIKE '${likeTail}' OR phone_e164 LIKE '${likeTail}'
            ORDER BY updated_at DESC, created_at DESC
            LIMIT 20
        `;
        const output = execFileSync('sqlite3', [
            '-json',
            '/opt/maxlien-mvp/leads_ec.sqlite3',
            sql
        ], { encoding: 'utf8' });
        return output.trim() ? JSON.parse(output) : [];
    } catch (error) {
        return [{ error: error.message }];
    }
};

await connectDB();

const result = [];

for (const phone of phones) {
    const phoneTail = tail(phone);
    const phoneTail10 = tail(phone, 10);
    const regexes = [phoneTail, phoneTail10]
        .filter(Boolean)
        .map((value) => new RegExp(`${value}$`));

    const orderQuery = {
        country: 'EC',
        $or: regexes.map((regex) => ({ 'customer.phone': regex }))
    };

    const orders = regexes.length
        ? await Order.find(orderQuery).sort({ updatedAt: -1 }).lean()
        : [];

    const states = regexes.length
        ? await ContactState.find({
            country: 'EC',
            $or: regexes.map((regex) => ({ phone: regex }))
        }).sort({ updatedAt: -1 }).limit(5).lean().catch(() => [])
        : [];

    const orderRows = [];

    for (const order of orders) {
        const shipment = await Shipment.findOne({ orderId: order.orderId }).sort({ updatedAt: -1 }).lean();
        const authorized = Boolean(
            order.dropiAuthorizedAt
            || order.dropiManualAuthorizationAt
            || order.manualDropiAuthorization?.authorizedAt
            || shipment?.automation?.authorizedForDroppiAt
            || shipment?.automation?.manualAuthorizationAt
        );
        const submitted = Boolean(
            order.dropiOrderId
            || order.dropiTrackingCode
            || shipment?.trackingCode
            || shipment?.automation?.submittedToDroppiAt
            || shipment?.raw?.droppiOrder?.id
            || shipment?.raw?.dropiOrder?.id
        );
        const guard = await getOrderDuplicateGuard({
            phone: order.customer?.phone,
            country: 'EC',
            currentOrderId: order.orderId
        });

        let panelReason = 'deveria aparecer como pronto para enviar';
        if (!['confirmed', 'processing', 'shipped'].includes(String(order.status || '').toLowerCase())) {
            panelReason = 'nao entra em Pedidos Confirmados porque status nao esta confirmed/processing/shipped';
        } else if (submitted) {
            panelReason = 'nao aparece para envio porque ja foi enviado/tem Dropi ou rastreio';
        } else if (!guard.allowed) {
            panelReason = 'bloqueado por duplicidade';
        } else if (!authorized) {
            panelReason = 'aparece para autorizar antes de enviar';
        }

        orderRows.push({
            orderId: order.orderId,
            name: order.customer?.name,
            phone: order.customer?.phone,
            status: order.status,
            authorized,
            submitted,
            duplicate: guard.reason,
            duplicateOrderId: guard.duplicateOrderId || guard.latestOrderId || '',
            panelReason,
            updatedAt: order.updatedAt
        });
    }

    result.push({
        phone,
        adminLeads: getAdminLeads(phone),
        orders: orderRows,
        contactStates: states.map((state) => ({
            phone: state.phone,
            name: state.name || state.customerName || '',
            stage: state.stage || state.currentStep || state.status || '',
            orderId: state.orderId || '',
            updatedAt: state.updatedAt
        }))
    });
}

console.log(JSON.stringify(result, null, 2));
await mongoose.disconnect();
