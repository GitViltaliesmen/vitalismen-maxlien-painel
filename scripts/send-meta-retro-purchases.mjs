import 'dotenv/config';
import mongoose from 'mongoose';
import Order from '../src/models/Order.js';
import {
    buildPurchaseEventPayloadForOrder,
    getMetaConfigForCountry,
    sendPurchaseEventForOrder
} from '../src/services/metaConversionsService.js';

const country = String(process.env.META_RETRO_COUNTRY || 'EC').trim().toUpperCase();
const days = Number(process.env.META_RETRO_DAYS || 62);
const capiMaxServerDays = Math.min(days, 7);
const limit = Number(process.env.META_RETRO_LIMIT || 500);
const dryRun = process.env.META_RETRO_SEND !== 'YES';
const includeAlreadySent = process.env.META_RETRO_INCLUDE_SENT === 'YES';
const actionSource = process.env.META_RETRO_ACTION_SOURCE || '';
const statuses = String(process.env.META_RETRO_STATUSES || 'confirmed,processing,shipped,delivered')
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
    order.confirmedAt
    || parseOnlineCreatedAtFromNotes(order.notes)
    || order.purchaseIntent?.readyConfirmedAt
    || order.entryAt
    || order.draftCreatedAt
    || order.createdAt
);

const unixSeconds = (date) => Math.floor(new Date(date).getTime() / 1000);

const resolvePreparedOrder = (order) => {
    const eventDate = resolveOriginalSaleDate(order);
    const eventTime = unixSeconds(eventDate);
    if (!Number.isFinite(eventTime)) {
        return {
            order,
            eventDate: null,
            eventTime: null,
            ageDays: null,
            ok: false,
            reason: 'invalid_original_sale_date'
        };
    }

    const now = Date.now();
    const eventMs = new Date(eventDate).getTime();
    const ageDays = Math.floor((now - eventMs) / (24 * 60 * 60 * 1000));
    if (eventMs > now + 5 * 60 * 1000) {
        return {
            order,
            eventDate,
            eventTime,
            ageDays,
            ok: false,
            reason: 'original_sale_date_in_future'
        };
    }

    if (eventMs < now - capiMaxServerDays * 24 * 60 * 60 * 1000) {
        return {
            order,
            eventDate,
            eventTime,
            ageDays,
            ok: false,
            reason: 'outside_meta_server_window'
        };
    }

    return {
        order,
        eventDate,
        eventTime,
        ageDays,
        ok: true
    };
};

const summarizePayload = (payload) => {
    const event = payload?.data?.[0] || {};
    return {
        event_name: event.event_name,
        event_time: event.event_time,
        event_id: event.event_id,
        action_source: event.action_source,
        user_data_keys: Object.keys(event.user_data || {}),
        custom_data: event.custom_data || {}
    };
};

const main = async () => {
    const { pixelId, accessToken } = getMetaConfigForCountry(country);
    if (!pixelId || !accessToken) {
        throw new Error(`META_PIXEL_ID_${country} e META_ACCESS_TOKEN_${country} precisam estar configurados no .env`);
    }

    if (!Number.isFinite(days) || days <= 0) {
        throw new Error('META_RETRO_DAYS deve ser um numero positivo.');
    }

    await mongoose.connect(process.env.MONGODB_URI);

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const query = {
        country,
        status: { $in: statuses },
        total: { $gt: 0 },
        $or: [
            { updatedAt: { $gte: cutoff } },
            { createdAt: { $gte: cutoff } }
        ]
    };

    if (!includeAlreadySent) {
        query['tracking.metaPurchaseSentAt'] = { $exists: false };
    }

    const candidateLimit = Math.max(limit * 5, limit);
    const candidateOrders = await Order.find(query)
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(candidateLimit);

    const preparedOrders = candidateOrders.map(resolvePreparedOrder);
    const skippedBeforeLimit = preparedOrders.filter((item) => !item.ok);
    const orders = preparedOrders
        .filter((item) => item.ok)
        .sort((a, b) => b.eventTime - a.eventTime)
        .slice(0, limit);

    const result = {
        ok: true,
        dryRun,
        country,
        actionSource,
        days,
        capiMaxServerDays,
        limit,
        statuses,
        includeAlreadySent,
        candidates: candidateOrders.length,
        matched: orders.length,
        skippedBeforeLimit: skippedBeforeLimit.length,
        sent: 0,
        skipped: 0,
        failed: 0,
        skippedDetails: skippedBeforeLimit.slice(0, 30).map((item) => ({
            orderId: item.order?.orderId || '',
            status: item.order?.status || '',
            total: item.order?.total || 0,
            source: item.order?.source || '',
            originalSaleAt: item.eventDate ? new Date(item.eventDate).toISOString() : null,
            ageDays: item.ageDays,
            reason: item.reason
        })),
        events: []
    };

    for (const prepared of orders) {
        const { order, eventTime, ageDays } = prepared;

        const built = buildPurchaseEventPayloadForOrder(order, { eventTime, actionSource });
        if (!built.ok) {
            result.skipped += 1;
            result.events.push({
                orderId: order.orderId,
                ok: false,
                skipped: true,
                reason: built.error
            });
            continue;
        }

        if (dryRun) {
            result.events.push({
                orderId: order.orderId,
                dryRun: true,
                originalSaleAt: new Date(eventTime * 1000).toISOString(),
                ageDays,
                payload: summarizePayload(built.payload)
            });
            continue;
        }

        const sendResult = await sendPurchaseEventForOrder(order, { eventTime, actionSource });
        if (sendResult.ok) {
            result.sent += 1;
        } else {
            result.failed += 1;
        }

        result.events.push({
            orderId: order.orderId,
            ok: sendResult.ok,
            originalSaleAt: new Date(eventTime * 1000).toISOString(),
            ageDays,
            eventId: sendResult.eventId,
            response: sendResult.response,
            error: sendResult.error,
            status: sendResult.status,
            data: sendResult.data
        });
    }

    await mongoose.disconnect();
    console.log(JSON.stringify(result, null, 2));
};

main().catch(async (error) => {
    try {
        await mongoose.disconnect();
    } catch {
        // ignore disconnect errors during shutdown
    }
    console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
    process.exit(1);
});
