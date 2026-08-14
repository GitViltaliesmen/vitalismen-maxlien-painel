import 'dotenv/config';
import mongoose from 'mongoose';
import Order from '../src/models/Order.js';
import VslVisit from '../src/models/VslVisit.js';
import { getMetaConfigForCountry } from '../src/services/metaConversionsService.js';

const country = String(process.env.META_AUDIT_COUNTRY || 'EC').trim().toUpperCase();
const days = Math.max(1, Number.parseInt(String(process.env.META_AUDIT_DAYS || '30'), 10) || 30);
const limit = Math.max(1, Number.parseInt(String(process.env.META_AUDIT_LIMIT || '20'), 10) || 20);
const statuses = String(process.env.META_AUDIT_STATUSES || 'confirmed,processing,shipped,delivered')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const parseOnlineCreatedAtFromNotes = (notes = '') => {
    const match = String(notes || '').match(/Criado online:\s*([^|]+)/i);
    if (!match) return null;
    const value = match[1].trim();
    if (!value) return null;
    const normalized = value.includes(' ') && !value.includes('T') ? value.replace(' ', 'T') : value;
    const date = new Date(normalized);
    return Number.isFinite(date.getTime()) ? date : null;
};

const resolveOriginalSaleDate = (order = {}) => (
    parseOnlineCreatedAtFromNotes(order.notes)
    || order.purchaseIntent?.readyConfirmedAt
    || order.updatedAt
    || order.createdAt
);

const ageDaysFor = (date) => {
    const time = new Date(date).getTime();
    if (!Number.isFinite(time)) return null;
    return Math.floor((Date.now() - time) / (24 * 60 * 60 * 1000));
};

const responseStatus = (response = null) => {
    if (!response) return { accepted: false, eventsReceived: 0, error: '' };
    const eventsReceived = Number(response.events_received ?? response.data?.events_received ?? 0) || 0;
    return {
        accepted: eventsReceived > 0,
        eventsReceived,
        error: response.error || response.data?.error?.message || ''
    };
};

const compactOrder = (order = {}) => {
    const saleDate = resolveOriginalSaleDate(order);
    const response = responseStatus(order.tracking?.metaPurchaseResponse);
    const tracking = order.tracking || {};
    const hasAttribution = Boolean(
        tracking.fbc
        || tracking.fbp
        || tracking.fbclid
        || tracking.utm_source
        || tracking.utm_medium
        || tracking.utm_campaign
        || tracking.utm_content
        || tracking.utm_term
    );
    return {
        orderId: order.orderId,
        status: order.status,
        total: order.total,
        currency: order.currency,
        source: order.source,
        city: order.customer?.city || '',
        province: order.customer?.province || '',
        originalSaleAt: saleDate ? new Date(saleDate).toISOString() : null,
        ageDays: saleDate ? ageDaysFor(saleDate) : null,
        capiEligibleNow: saleDate ? ageDaysFor(saleDate) <= 7 : false,
        metaPurchaseSentAt: order.tracking?.metaPurchaseSentAt || null,
        metaPurchaseEventId: order.tracking?.metaPurchaseEventId || '',
        metaAccepted: response.accepted,
        eventsReceived: response.eventsReceived,
        metaError: response.error,
        hasAttribution,
        fbc: Boolean(tracking.fbc),
        fbp: Boolean(tracking.fbp),
        fbclid: Boolean(tracking.fbclid),
        sourceUrl: Boolean(tracking.sourceUrl),
        utmCampaign: tracking.utm_campaign || '',
        attributionSource: tracking.attributionSource || '',
        recovery: order.tracking?.metaPurchaseSentAt
            ? 'none_sent'
            : (saleDate && ageDaysFor(saleDate) <= 7 ? 'capi_retro_possible' : 'offline_export_required')
    };
};

const main = async () => {
    if (country !== 'EC') {
        throw new Error('Esta auditoria operacional e exclusiva do Equador.');
    }

    await mongoose.connect(process.env.MONGODB_URI);

    const { pixelId, accessToken } = getMetaConfigForCountry(country);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const base = {
        country,
        status: { $in: statuses },
        total: { $gt: 0 },
        $or: [
            { updatedAt: { $gte: since } },
            { createdAt: { $gte: since } }
        ]
    };
    const sentQuery = { ...base, 'tracking.metaPurchaseSentAt': { $exists: true } };
    const pendingQuery = { ...base, 'tracking.metaPurchaseSentAt': { $exists: false } };
    const errorQuery = {
        ...base,
        'tracking.metaPurchaseSentAt': { $exists: false },
        'tracking.metaPurchaseResponse.error': { $exists: true }
    };

    const [
        confirmed,
        sent,
        pending,
        failed,
        pageView,
        viewContent,
        initiateCheckout,
        lead,
        pendingOrders,
        failedOrders,
        lastSentOrders
    ] = await Promise.all([
        Order.countDocuments(base),
        Order.countDocuments(sentQuery),
        Order.countDocuments(pendingQuery),
        Order.countDocuments(errorQuery),
        VslVisit.countDocuments({ country, metaPageViewSentAt: { $gte: since } }),
        VslVisit.countDocuments({ country, metaViewContentSentAt: { $gte: since } }),
        VslVisit.countDocuments({ country, metaInitiateCheckoutSentAt: { $gte: since } }),
        VslVisit.countDocuments({ country, metaLeadSentAt: { $gte: since } }),
        Order.find(pendingQuery).sort({ updatedAt: -1, createdAt: -1 }).limit(limit).lean(),
        Order.find(errorQuery).sort({ updatedAt: -1, createdAt: -1 }).limit(limit).lean(),
        Order.find(sentQuery).sort({ 'tracking.metaPurchaseSentAt': -1 }).limit(limit).lean()
    ]);

    const sentOrdersForAttribution = await Order.find(sentQuery)
        .select('tracking')
        .lean();
    const attributedSent = sentOrdersForAttribution.filter((order) => {
        const tracking = order.tracking || {};
        return Boolean(
            tracking.fbc
            || tracking.fbp
            || tracking.fbclid
            || tracking.utm_source
            || tracking.utm_medium
            || tracking.utm_campaign
            || tracking.utm_content
            || tracking.utm_term
        );
    }).length;
    const sourceUrlOnlySent = sentOrdersForAttribution.filter((order) => {
        const tracking = order.tracking || {};
        const hasAdAttribution = Boolean(
            tracking.fbc
            || tracking.fbp
            || tracking.fbclid
            || tracking.utm_source
            || tracking.utm_medium
            || tracking.utm_campaign
            || tracking.utm_content
            || tracking.utm_term
        );
        return !hasAdAttribution && Boolean(tracking.sourceUrl);
    }).length;

    const report = {
        ok: true,
        generatedAt: new Date().toISOString(),
        country,
        days,
        statuses,
        meta: {
            pixelId: pixelId || '',
            tokenConfigured: Boolean(accessToken),
            tokenLength: String(accessToken || '').length,
            testMode: Boolean(process.env.META_TEST_EVENT_CODE_EC || process.env.META_TEST_EVENT_CODE),
            apiVersion: process.env.META_CAPI_API_VERSION || 'v20.0'
        },
        counts: {
            confirmed,
            purchaseSent: sent,
            purchasePending: pending,
            purchaseFailed: failed,
            purchaseSentWithAttribution: attributedSent,
            purchaseSentSourceUrlOnly: sourceUrlOnlySent,
            purchaseSentBlind: Math.max(0, sent - attributedSent),
            pageView,
            viewContent,
            initiateCheckout,
            lead
        },
        pending: pendingOrders.map(compactOrder),
        failures: failedOrders.map(compactOrder),
        lastSent: lastSentOrders.map(compactOrder),
        recommendations: []
    };

    const capiRecoverable = report.pending.filter((item) => item.recovery === 'capi_retro_possible').length;
    const offlineRequired = report.pending.filter((item) => item.recovery === 'offline_export_required').length;
    if (!report.meta.pixelId || !report.meta.tokenConfigured) {
        report.recommendations.push('Configurar META_PIXEL_ID_EC e META_ACCESS_TOKEN_EC antes de enviar Purchase.');
    }
    if (report.meta.testMode) {
        report.recommendations.push('Remover META_TEST_EVENT_CODE_EC/META_TEST_EVENT_CODE em producao.');
    }
    if (capiRecoverable) {
        report.recommendations.push(`${capiRecoverable} Purchase(s) pendente(s) ainda podem ser recuperados por CAPI retroativo.`);
    }
    if (offlineRequired) {
        report.recommendations.push(`${offlineRequired} Purchase(s) pendente(s) estao fora da janela CAPI e devem ir para exportacao Offline/Compradores.`);
    }
    if (report.counts.purchaseSentBlind) {
        report.recommendations.push(`${report.counts.purchaseSentBlind} Purchase(s) enviados foram aceitos pela Meta, mas estao sem fbc/fbp/fbclid/UTM e podem nao atribuir no Ads Manager; ${report.counts.purchaseSentSourceUrlOnly} possuem apenas sourceUrl.`);
    }
    if (!report.recommendations.length) {
        report.recommendations.push('Camada Meta EC sem pendencias criticas no periodo auditado.');
    }

    await mongoose.disconnect();
    console.log(JSON.stringify(report, null, 2));
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
