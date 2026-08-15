import 'dotenv/config';
import crypto from 'crypto';
import mongoose from 'mongoose';
import Order from '../src/models/Order.js';
import VslVisit from '../src/models/VslVisit.js';
import {
    getActionSourceForOrder,
    metaEventsReceived,
    resolvePurchaseEventDate,
    resolvePurchaseEventSourceUrl
} from '../src/services/metaConversionsService.js';

const startAt = new Date(process.env.META_AUDIT_START || '2026-08-12T05:00:00.000Z');
const endAt = new Date(process.env.META_AUDIT_END || '2026-08-16T05:00:00.000Z');
const timezone = process.env.META_AUDIT_TIMEZONE || 'America/Guayaquil';
const eligibleStatuses = new Set(['confirmed', 'processing', 'shipped', 'delivered']);

const validDate = (value) => {
    const date = value instanceof Date ? value : new Date(value || 0);
    return Number.isFinite(date.getTime()) && date.getTime() > 0 ? date : null;
};

const inRange = (value) => {
    const date = validDate(value);
    return Boolean(date && date >= startAt && date < endAt);
};

const iso = (value) => validDate(value)?.toISOString() || null;
const digitsOnly = (value) => String(value || '').replace(/\D/g, '');
const shortHash = (value) => value
    ? crypto.createHash('sha256').update(`meta-audit-v2|${String(value)}`).digest('hex').slice(0, 12)
    : '';

const maskCustomer = (order = {}) => `<masked:${shortHash(`${order.customer?.name || ''}|${digitsOnly(order.customer?.phone)}`)}>`;

const sourceHostPath = (value) => {
    try {
        const parsed = new URL(String(value || ''));
        return `${parsed.hostname}${parsed.pathname}`;
    } catch {
        return value ? 'invalid_url' : '';
    }
};

const dayAtEcuador = (value) => validDate(value)
    ? new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(validDate(value))
    : 'none';

const grouped = (values) => Object.entries(values.reduce((acc, value) => {
    const key = String(value || 'missing');
    acc[key] = (acc[key] || 0) + 1;
    return acc;
}, {})).sort((a, b) => b[1] - a[1]).map(([key, count]) => ({ key, count }));

const fbcTimestampKind = (value) => {
    const match = String(value || '').match(/^fb\.1\.(\d+)\./);
    if (!match) return value ? 'invalid' : 'missing';
    if (match[1].length >= 13) return 'milliseconds';
    if (match[1].length === 10) return 'seconds';
    return `digits_${match[1].length}`;
};

const legacyActionSource = (order = {}) => (
    order.tracking?.sourceUrl || order.tracking?.fbc || order.tracking?.fbp || order.tracking?.fbclid
        ? 'website'
        : (order.source === 'whatsapp' ? 'business_messaging' : 'website')
);

const assertInputs = () => {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI ausente');
    if (!validDate(startAt) || !validDate(endAt) || startAt >= endAt) {
        throw new Error('META_AUDIT_START/META_AUDIT_END invalidos');
    }
};

const main = async () => {
    assertInputs();
    await mongoose.connect(process.env.MONGODB_URI);

    const orders = await Order.find({
        country: 'EC',
        $or: [
            { createdAt: { $gte: startAt, $lt: endAt } },
            { entryAt: { $gte: startAt, $lt: endAt } },
            { confirmedAt: { $gte: startAt, $lt: endAt } },
            { 'tracking.metaPurchaseSentAt': { $gte: startAt, $lt: endAt } }
        ]
    }).sort({ createdAt: 1 }).lean();

    const relevant = orders.filter((order) => (
        inRange(resolvePurchaseEventDate(order)) || inRange(order.tracking?.metaPurchaseSentAt)
    ));
    const eligible = relevant.filter((order) => (
        eligibleStatuses.has(String(order.status || '').toLowerCase())
        && Number(order.total) > 0
        && inRange(resolvePurchaseEventDate(order))
    ));
    const sent = relevant.filter((order) => inRange(order.tracking?.metaPurchaseSentAt));

    const phoneTails = new Set(eligible.map((order) => digitsOnly(order.customer?.phone).slice(-9)).filter(Boolean));
    const visits = phoneTails.size
        ? await VslVisit.find({
            country: 'EC',
            lastSeenAt: { $gte: new Date(startAt.getTime() - 30 * 24 * 60 * 60 * 1000), $lt: endAt },
            customerPhone: { $exists: true, $ne: '' }
        }).lean()
        : [];
    const visitCounts = new Map();
    for (const visit of visits) {
        const tail = digitsOnly(visit.customerPhone).slice(-9);
        if (phoneTails.has(tail)) visitCounts.set(tail, (visitCounts.get(tail) || 0) + 1);
    }

    const rows = eligible.map((order) => {
        const tracking = order.tracking || {};
        const saleAt = resolvePurchaseEventDate(order);
        const oldSource = legacyActionSource(order);
        const correctedSource = getActionSourceForOrder(order);
        const eventSourceUrl = sourceHostPath(tracking.landingUrl || tracking.sourceUrl);
        const nameParts = String(order.customer?.name || '').trim().split(/\s+/).filter(Boolean).length;
        return {
            order_id: order.orderId,
            data: iso(saleAt),
            cliente: maskCustomer(order),
            valor: Number(order.total),
            currency: order.currency,
            purchase_enviado: Boolean(tracking.metaPurchaseSentAt),
            purchase_aceito_armazenado: metaEventsReceived(tracking.metaPurchaseResponse) > 0,
            event_id: tracking.metaPurchaseEventId || '',
            event_time_persistido: iso(tracking.metaPurchaseEventTime),
            event_source_url: eventSourceUrl,
            action_source_antigo: oldSource,
            action_source_corrigido: correctedSource,
            website_sem_event_source_url: oldSource === 'website' && !eventSourceUrl,
            fbc: Boolean(tracking.fbc),
            fbp: Boolean(tracking.fbp),
            fbclid: Boolean(tracking.fbclid),
            email: Boolean(order.customer?.email),
            telefone: Boolean(order.customer?.phone),
            ip_cliente_original: Boolean(tracking.clientIpOriginal),
            ua_cliente_original: Boolean(tracking.clientUserAgentOriginal),
            ip_legado: Boolean(tracking.ip),
            ua_legado: Boolean(tracking.userAgent),
            external_id: Boolean(tracking.ext_id),
            ad_id: tracking.metaAdId || '',
            adset_id: tracking.metaAdsetId || '',
            campaign_id: tracking.metaCampaignId || '',
            utm_campaign: tracking.utm_campaign || '',
            utm_content: tracking.utm_content || '',
            nome_partes: nameParts,
            visitas_vsl_por_telefone: visitCounts.get(digitsOnly(order.customer?.phone).slice(-9)) || 0,
            fbc_timestamp: fbcTimestampKind(tracking.fbc),
            tentativas_persistidas: Number(tracking.metaPurchaseAttempts || 0)
        };
    });

    const uniqueEventIds = new Set(sent.map((order) => order.tracking?.metaPurchaseEventId).filter(Boolean));
    const duplicateEventIds = grouped(sent.map((order) => order.tracking?.metaPurchaseEventId).filter(Boolean))
        .filter(({ count }) => count > 1);
    const days = [];
    for (let cursor = new Date(startAt); cursor < endAt; cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)) {
        const day = dayAtEcuador(cursor);
        const dailyEligible = rows.filter((row) => dayAtEcuador(row.data) === day);
        const dailySent = sent.filter((order) => dayAtEcuador(order.tracking?.metaPurchaseSentAt) === day);
        days.push({
            day,
            pedidos_elegiveis: dailyEligible.length,
            registros_purchase_enviados: dailySent.length,
            eventos_aceitos_armazenados: dailySent.reduce((sum, order) => sum + metaEventsReceived(order.tracking?.metaPurchaseResponse), 0),
            event_ids_unicos: new Set(dailySent.map((order) => order.tracking?.metaPurchaseEventId).filter(Boolean)).size,
            website_sem_event_source_url: dailyEligible.filter((row) => row.website_sem_event_source_url).length,
            com_fbc: dailyEligible.filter((row) => row.fbc).length,
            com_fbp: dailyEligible.filter((row) => row.fbp).length
        });
    }

    const output = {
        ok: true,
        readOnly: true,
        generatedAt: new Date().toISOString(),
        range: { startAt: startAt.toISOString(), endAtExclusive: endAt.toISOString(), timezone },
        counts: {
            pedidos_relevantes: relevant.length,
            vendas_reais_elegiveis: eligible.length,
            registros_purchase_enviados: sent.length,
            eventos_aceitos_armazenados: sent.reduce((sum, order) => sum + metaEventsReceived(order.tracking?.metaPurchaseResponse), 0),
            event_ids_unicos: uniqueEventIds.size,
            event_ids_duplicados: duplicateEventIds.length,
            pedidos_elegiveis_sem_purchase: rows.filter((row) => !row.purchase_enviado).length,
            purchase_marcado_enviado_sem_aceite: sent.filter((order) => metaEventsReceived(order.tracking?.metaPurchaseResponse) < 1).length,
            website_sem_event_source_url: rows.filter((row) => row.website_sem_event_source_url).length,
            sem_fbc: rows.filter((row) => !row.fbc).length,
            sem_fbp: rows.filter((row) => !row.fbp).length,
            sem_identificador_click_ou_utm: rows.filter((row) => !(
                row.fbc || row.fbp || row.fbclid || row.utm_campaign || row.utm_content
            )).length,
            com_ip_ua_legado_sem_ip_ua_original: rows.filter((row) => (
                row.ip_legado && row.ua_legado && !row.ip_cliente_original && !row.ua_cliente_original
            )).length,
            com_correlacao_vsl_por_telefone: rows.filter((row) => row.visitas_vsl_por_telefone > 0).length
        },
        daily: days,
        duplicateEventIds,
        distributions: {
            actionSourceOld: grouped(rows.map((row) => row.action_source_antigo)),
            actionSourceCorrected: grouped(rows.map((row) => row.action_source_corrigido)),
            sourceUrls: grouped(rows.map((row) => row.event_source_url || 'missing')),
            fbcTimestamp: grouped(rows.map((row) => row.fbc_timestamp)),
            legacyUserAgentHashes: grouped(eligible.map((order) => shortHash(order.tracking?.userAgent))).filter(({ key }) => key !== 'missing'),
            legacyIpHashes: grouped(eligible.map((order) => shortHash(order.tracking?.ip))).filter(({ key }) => key !== 'missing')
        },
        rows
    };

    console.log(JSON.stringify(output, null, 2));
    await mongoose.disconnect();
};

main().catch(async (error) => {
    await mongoose.disconnect().catch(() => null);
    console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
    process.exitCode = 1;
});
