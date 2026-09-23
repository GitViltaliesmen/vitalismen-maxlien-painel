import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import mongoose from 'mongoose';
import ContactState from '../src/models/ContactState.js';
import Order from '../src/models/Order.js';
import {
    detectExplicitEcuadorProductKey,
    ecuadorPackageLabel,
    getEcuadorProductInfoByKey
} from '../src/services/ecuadorProductService.js';
import { persistConfirmedOrderToOnlineAdminPanelV158 } from '../src/services/adminPanelStatusService.js';

const AUTHORIZATION = 'I_UNDERSTAND_SINGLE_EC_CONFIRMED_REPAIR';
const authorization = String(process.env.V158_CONFIRM_REPAIR_AUTHORIZE || '').trim();
const leadId = String(process.env.V158_CONFIRM_REPAIR_LEAD_ID || '').replace(/\D/g, '');
const backupDir = path.resolve(String(process.env.V158_CONFIRM_REPAIR_BACKUP_DIR || '').trim());
const dbPath = String(process.env.ONLINE_ADMIN_PANEL_DB_PATH || '/opt/maxlien-mvp/leads_ec.sqlite3').trim();
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGODB_URL || '';

if (authorization !== AUTHORIZATION) throw new Error('V158_CONFIRM_REPAIR_AUTHORIZE_INVALID');
if (!leadId || String(process.env.V158_CONFIRM_REPAIR_LEAD_ID || '').trim() !== leadId) throw new Error('V158_CONFIRM_REPAIR_LEAD_ID_INVALID');
if (!mongoUri) throw new Error('MONGODB_URI_REQUIRED');
if (!path.isAbsolute(backupDir) || !backupDir.startsWith('/opt/vitalismen-automacao/backups/')) {
    throw new Error('V158_CONFIRM_REPAIR_BACKUP_DIR_INVALID');
}
if (typeof process.getuid === 'function' && process.getuid() !== 0) throw new Error('ROOT_REQUIRED');

const sqliteLead = () => {
    const python = `
import json, sqlite3
con = sqlite3.connect(${JSON.stringify(dbPath)})
con.row_factory = sqlite3.Row
row = con.execute("SELECT * FROM leads WHERE id=?", (${Number(leadId)},)).fetchone()
print(json.dumps(dict(row) if row else None, ensure_ascii=False))
con.close()
`;
    const result = spawnSync('python3', ['-'], { input: python, encoding: 'utf8', maxBuffer: 1024 * 1024 });
    if (result.status !== 0) throw new Error(`SQLITE_READ_FAILED:${String(result.stderr || result.stdout || '').trim()}`);
    return JSON.parse(result.stdout || 'null');
};

const digitsOnly = (value = '') => String(value || '').replace(/\D/g, '');
const required = (name, value) => {
    if (value === undefined || value === null || String(value).trim() === '') throw new Error(`DRAFT_FIELD_REQUIRED:${name}`);
    return value;
};
const sanitizeBackupValue = (value) => JSON.parse(JSON.stringify(value));

fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
fs.chmodSync(backupDir, 0o700);
await mongoose.connect(mongoUri, { autoIndex: false, serverSelectionTimeoutMS: 10_000 });

try {
    const lead = sqliteLead();
    if (!lead) throw new Error('SQLITE_LEAD_NOT_FOUND');
    const leadPhone = digitsOnly(lead.phone || lead.telefono || '');
    if (String(lead.country || 'EC').trim().toUpperCase() !== 'EC') throw new Error('LEAD_NOT_EC');
    if (!leadPhone) throw new Error('SQLITE_LEAD_PHONE_REQUIRED');
    const phoneTail = leadPhone.slice(-9);
    const state = await ContactState.findOne({
        countryCode: 'EC',
        $or: [
            { phoneDigits: { $regex: `${phoneTail}$` } },
            { chatId: { $regex: phoneTail } },
            { 'metadata.customerDraft.phone': { $regex: `${phoneTail}$` } }
        ]
    }).sort({ updatedAt: -1 });
    if (!state) throw new Error('CONTACT_STATE_NOT_FOUND');
    const draft = state.metadata?.customerDraft?.toObject?.() || state.metadata?.customerDraft || {};
    if (String(draft.status || '').trim().toLowerCase() !== 'confirmado') throw new Error('CONFIRMED_INTENT_NOT_PERSISTED');
    if (state.customerDataResolution?.orderDataReady !== true) throw new Error('ORDER_DATA_NOT_READY');

    const quantity = Number.parseInt(required('quantity', draft.quantity || lead.product_qty), 10);
    const total = Number(String(required('total', draft.total || lead.product_value)).replace(',', '.'));
    if (!Number.isInteger(quantity) || quantity <= 0 || !Number.isFinite(total) || total <= 0) throw new Error('QUANTITY_TOTAL_INVALID');
    const productKey = detectExplicitEcuadorProductKey(draft, state.metadata || {});
    const productInfo = getEcuadorProductInfoByKey(productKey);
    if (!productInfo?.key) throw new Error('EXPLICIT_PRODUCT_REQUIRED');
    const deliveryMode = String(required('deliveryMode', draft.deliveryMode)).trim();
    const customer = {
        name: String(required('name', draft.name || lead.name)).trim(),
        phone: `+${digitsOnly(required('phone', draft.phone || lead.phone))}`,
        address: String(required('address', draft.address || lead.address)).trim(),
        reference: String(draft.reference || '').trim(),
        city: String(required('city', draft.city || lead.city)).trim(),
        province: String(required('province', draft.province || lead.province)).trim()
    };
    const delivery = {
        mode: deliveryMode,
        agencyId: String(draft.agencyId || '').trim(),
        agencyName: String(draft.agencyName || '').trim()
    };
    if (delivery.mode === 'agency' && !delivery.agencyName) throw new Error('AGENCY_NAME_REQUIRED');

    const adminOrderId = `EC-ADMIN-${leadId}`;
    const relatedOrders = await Order.find({
        country: 'EC',
        $or: [
            { orderId: adminOrderId },
            { 'customer.phone': { $regex: `${phoneTail}$` } }
        ]
    }).sort({ updatedAt: -1, createdAt: -1 });
    const snapshotPath = path.join(backupDir, `confirmed-repair-lead-${leadId}-before-${Date.now()}.json`);
    fs.writeFileSync(snapshotPath, `${JSON.stringify({
        capturedAt: new Date().toISOString(),
        leadId,
        sqliteLead: sanitizeBackupValue(lead),
        contactState: sanitizeBackupValue(state.toObject()),
        orders: relatedOrders.map((order) => sanitizeBackupValue(order.toObject()))
    }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    fs.chmodSync(snapshotPath, 0o600);

    let order = relatedOrders.find((candidate) => candidate.orderId === adminOrderId)
        || relatedOrders.find((candidate) => candidate.status === 'confirmed')
        || null;
    if (order && !['draft', 'pending', 'confirmed'].includes(String(order.status || '').trim().toLowerCase())) {
        throw new Error(`EXISTING_ORDER_ALREADY_ADVANCED:${order.orderId}:${order.status}`);
    }
    const created = !order;
    if (!order) order = new Order({ orderId: adminOrderId });
    order.country = 'EC';
    order.customer = customer;
    order.delivery = delivery;
    order.customerDataResolution = state.customerDataResolution?.toObject?.() || state.customerDataResolution || {};
    order.package = { id: quantity, quantity, label: ecuadorPackageLabel(productInfo, quantity) };
    order.total = total;
    order.currency = 'USD';
    order.status = 'confirmed';
    order.source = 'manual';
    order.entryReason = 'admin_panel_confirmed_whatsapp_mirror';
    order.previousOrderId = order.previousOrderId || adminOrderId;
    order.confirmedAt = order.confirmedAt || new Date();
    order.tracking = {
        ...(order.tracking?.toObject?.() || order.tracking || {}),
        productKey: productInfo.key,
        productName: productInfo.name,
        product: productInfo.name,
        country: 'EC',
        attributionSource: 'panel_confirmed_repair_v158'
    };
    order.notes = [order.notes, `Reparo V158 do aceite humano persistido no painel EC #${leadId}.`].filter(Boolean).join('\n');
    await order.save();

    const correlationId = `repair-v158-${leadId}-${Date.now()}`;
    const panelPersistence = persistConfirmedOrderToOnlineAdminPanelV158(order, {
        action: 'repair_confirmed_order_v158',
        leadId,
        requestedBy: 'production_repair_v158',
        correlationId
    });
    if (!panelPersistence.ok) throw new Error(`SQLITE_CONFIRM_PERSISTENCE_FAILED:${panelPersistence.reason || 'not_verified'}`);

    state.metadata = {
        ...(state.metadata || {}),
        customerDraft: {
            ...draft,
            orderId: order.orderId,
            sourceOrderId: adminOrderId,
            previousOrderId: order.previousOrderId || adminOrderId,
            currentNegotiationOrderId: order.orderId,
            status: 'confirmado',
            product: productInfo.name,
            productName: productInfo.name,
            productKey: productInfo.key,
            updatedAt: new Date().toISOString()
        }
    };
    state.markModified('metadata');
    await state.save();

    const [finalOrder, finalState] = await Promise.all([
        Order.findOne({ country: 'EC', orderId: order.orderId, status: 'confirmed', confirmedAt: { $ne: null } }).lean(),
        ContactState.findById(state._id).lean()
    ]);
    const finalLead = sqliteLead();
    const contactOrderId = String(finalState?.metadata?.customerDraft?.orderId || '');
    const verified = Boolean(
        finalOrder
        && contactOrderId === order.orderId
        && String(finalState?.metadata?.customerDraft?.status || '').toLowerCase() === 'confirmado'
        && String(finalLead?.status || '').toLowerCase() === 'confirmado'
    );
    if (!verified) throw new Error('FINAL_READ_AFTER_WRITE_FAILED');

    console.log(JSON.stringify({
        ok: true,
        leadId,
        phoneTail: `***${phoneTail.slice(-4)}`,
        orderId: order.orderId,
        created,
        mongoStatus: finalOrder.status,
        mongoConfirmedAt: finalOrder.confirmedAt,
        contactDraftStatus: finalState.metadata.customerDraft.status,
        sqliteStatus: finalLead.status,
        persistenceVerified: panelPersistence.persistenceVerified,
        readAfterWriteVerified: panelPersistence.readAfterWriteVerified,
        visibleInConfirmedQuery: panelPersistence.visibleInConfirmedQuery,
        matchedCount: panelPersistence.matchedCount,
        modifiedCount: panelPersistence.modifiedCount,
        correlationId,
        snapshotPath,
        whatsappCalls: 0,
        dropiCalls: 0,
        metaCalls: 0,
        messagesSent: 0
    }, null, 2));
} finally {
    await mongoose.disconnect().catch(() => null);
}
