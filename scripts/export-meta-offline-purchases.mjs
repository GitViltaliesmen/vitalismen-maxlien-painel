import 'dotenv/config';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import mongoose from 'mongoose';
import Order from '../src/models/Order.js';

const country = String(process.env.META_OFFLINE_COUNTRY || 'EC').trim().toUpperCase();
const limit = Number(process.env.META_OFFLINE_LIMIT || 1000);
const includeSent = process.env.META_OFFLINE_INCLUDE_SENT === 'YES';
const outputDir = process.env.META_OFFLINE_OUTPUT_DIR || 'exports/meta';
const adminOnly = process.env.META_OFFLINE_ADMIN_ONLY === 'YES';
const days = Math.max(0, Number.parseInt(String(process.env.META_OFFLINE_DAYS || '0'), 10) || 0);
const statuses = String(process.env.META_OFFLINE_STATUSES || 'confirmed,processing,shipped,delivered')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const parseOnlineCreatedAtFromNotes = (notes = '') => {
    const match = String(notes || '').match(/Criado online:\s*([^|]+)/i);
    if (!match) return null;
    const value = match[1].trim();
    if (!value) return null;
    const normalized = value.includes(' ') && !value.includes('T')
        ? value.replace(' ', 'T')
        : value;
    const date = new Date(normalized);
    return Number.isFinite(date.getTime()) ? date : null;
};

const resolveOriginalSaleDate = (order) => (
    parseOnlineCreatedAtFromNotes(order.notes)
    || order.purchaseIntent?.readyConfirmedAt
    || order.updatedAt
    || order.createdAt
);

const unixSeconds = (value) => Math.floor(new Date(value).getTime() / 1000);

const normalize = (value) => String(value || '').trim().toLowerCase();

const VALID_PACKAGE_QUANTITIES = new Set([1, 3, 6]);

const normalizePackageQuantity = (value) => {
    const parsed = Number.parseInt(String(value ?? '').trim(), 10);
    return VALID_PACKAGE_QUANTITIES.has(parsed) ? parsed : 0;
};

const sha256 = (value) => {
    const normalized = normalize(value);
    if (!normalized) return '';
    return crypto.createHash('sha256').update(normalized).digest('hex');
};

const normalizePhoneDigits = ({ phone, country: orderCountry }) => {
    let digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return '';
    if (orderCountry === 'EC') {
        if (digits.length === 10 && digits.startsWith('0')) digits = digits.slice(1);
        if (!digits.startsWith('593')) digits = `593${digits}`;
    }
    return digits;
};

const splitName = (fullName) => {
    const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return { firstName: '', lastName: '' };
    if (parts.length === 1) return { firstName: parts[0], lastName: '' };
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
};

const csvValue = (value) => {
    const text = String(value ?? '');
    if (!/[",\n\r]/.test(text)) return text;
    return `"${text.replace(/"/g, '""')}"`;
};

const toCsv = (rows) => rows.map((row) => row.map(csvValue).join(',')).join('\n') + '\n';

const buildRows = (orders) => {
    const eventRows = [[
        'event_name',
        'event_time',
        'event_id',
        'order_id',
        'value',
        'currency',
        'content_name',
        'content_ids',
        'quantity',
        'ph',
        'fn',
        'ln',
        'ct',
        'st',
        'country',
        'source'
    ]];

    const audienceRows = [[
        'phone',
        'fn',
        'ln',
        'ct',
        'st',
        'country',
        'external_id',
        'value',
        'currency',
        'order_id',
        'event_time'
    ]];

    const skipped = [];

    for (const order of orders) {
        const eventDate = resolveOriginalSaleDate(order);
        const eventTime = unixSeconds(eventDate);
        const value = Number(order.total || 0);
        const quantity = normalizePackageQuantity(order.package?.quantity ?? order.package?.id);
        const phoneDigits = normalizePhoneDigits({ phone: order.customer?.phone, country: order.country });
        const { firstName, lastName } = splitName(order.customer?.name);

        if (!Number.isFinite(eventTime) || eventTime <= 0) {
            skipped.push({ orderId: order.orderId, reason: 'invalid_event_time' });
            continue;
        }
        if (!Number.isFinite(value) || value <= 0) {
            skipped.push({ orderId: order.orderId, reason: 'invalid_value' });
            continue;
        }
        if (!quantity) {
            skipped.push({ orderId: order.orderId, reason: 'invalid_quantity' });
            continue;
        }
        if (!phoneDigits && !firstName && !lastName) {
            skipped.push({ orderId: order.orderId, reason: 'missing_user_identifier' });
            continue;
        }

        eventRows.push([
            'Purchase',
            eventTime,
            order.orderId,
            order.orderId,
            value.toFixed(2),
            order.currency || 'USD',
            'Vit Power Ecuador',
            'vit_power_ec',
            quantity,
            sha256(phoneDigits),
            sha256(firstName),
            sha256(lastName),
            sha256(order.customer?.city),
            sha256(order.customer?.province),
            sha256(order.country),
            order.source || 'manual'
        ]);

        audienceRows.push([
            sha256(phoneDigits),
            sha256(firstName),
            sha256(lastName),
            sha256(order.customer?.city),
            sha256(order.customer?.province),
            sha256(order.country),
            sha256(order.orderId),
            value.toFixed(2),
            order.currency || 'USD',
            order.orderId,
            eventTime
        ]);
    }

    return { eventRows, audienceRows, skipped };
};

const main = async () => {
    if (country !== 'EC') {
        throw new Error('META_OFFLINE_COUNTRY precisa ser EC neste projeto oficial.');
    }

    await mongoose.connect(process.env.MONGODB_URI);

    const query = {
        country,
        status: { $in: statuses },
        total: { $gt: 0 }
    };
    if (adminOnly) query.orderId = /^EC-ADMIN-/;
    if (days > 0) {
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        query.$or = [
            { updatedAt: { $gte: since } },
            { createdAt: { $gte: since } }
        ];
    }

    if (!includeSent) {
        query['tracking.metaPurchaseSentAt'] = { $exists: false };
    }

    const orders = await Order.find(query)
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(limit);

    const { eventRows, audienceRows, skipped } = buildRows(orders);
    await fs.mkdir(outputDir, { recursive: true });

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const eventPath = path.join(outputDir, `meta-offline-purchases-${country}-${stamp}.csv`);
    const audiencePath = path.join(outputDir, `meta-buyer-audience-${country}-${stamp}.csv`);
    const summaryPath = path.join(outputDir, `meta-export-summary-${country}-${stamp}.json`);

    await fs.writeFile(eventPath, toCsv(eventRows), 'utf8');
    await fs.writeFile(audiencePath, toCsv(audienceRows), 'utf8');

    const summary = {
        ok: true,
        country,
        includeSent,
        adminOnly,
        days,
        statuses,
        matchedOrders: orders.length,
        exportedEvents: eventRows.length - 1,
        exportedAudienceRows: audienceRows.length - 1,
        skipped,
        files: {
            offlinePurchasesCsv: path.resolve(eventPath),
            buyerAudienceCsv: path.resolve(audiencePath),
            summaryJson: path.resolve(summaryPath)
        }
    };

    await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf8');
    await mongoose.disconnect();
    console.log(JSON.stringify(summary, null, 2));
};

main().catch(async (error) => {
    try {
        await mongoose.disconnect();
    } catch {
        // ignore disconnect errors
    }
    console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
    process.exit(1);
});
