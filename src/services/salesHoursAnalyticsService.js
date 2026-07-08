import fs from 'fs/promises';
import path from 'path';
import { spawnSync } from 'child_process';
import Order from '../models/Order.js';
import VslVisit from '../models/VslVisit.js';

const EC_ADMIN_DB = '/opt/maxlien-mvp/leads_ec.sqlite3';
const EC_TZ_OFFSET_MINUTES = -5 * 60;
const DEFAULT_DAYS = 14;
const MAX_DAYS = 120;
const SALES_STATUSES = new Set(['finalizado', 'pedido_enviado', 'entregue']);
const LOSS_STATUSES = new Set(['cancelado', 'devolvido']);

const reportPath = () => process.env.SALES_HOURS_OBSERVER_REPORT_PATH || 'runtime/sales-hours-observer-latest.json';
const spreadsheetDir = () => process.env.SALES_HOURS_OBSERVER_SPREADSHEET_DIR || process.env.PERFECT_FUNNEL_OBSERVER_SPREADSHEET_DIR || 'runtime/observer-spreadsheets';

const clampDays = (value) => {
    const parsed = Number.parseInt(String(value || ''), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_DAYS;
    return Math.min(parsed, MAX_DAYS);
};

const nowEcParts = () => {
    const now = new Date();
    const ec = new Date(now.getTime() + EC_TZ_OFFSET_MINUTES * 60 * 1000);
    return {
        now,
        ec,
        dateKey: ec.toISOString().slice(0, 10)
    };
};

const localDateKey = (date) => date.toISOString().slice(0, 10);
const money = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const pct = (num, den) => den > 0 ? Math.round((num / den) * 1000) / 10 : 0;
const asDate = (value) => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

const escapeCsv = (value) => {
    const text = String(value ?? '');
    if (!/[",\n;]/.test(text)) return text;
    return `"${text.replace(/"/g, '""')}"`;
};

const toCsv = (headers, rows) => [
    headers.map(escapeCsv).join(';'),
    ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(';'))
].join('\n');

const statusKind = (status) => {
    const normalized = String(status || '').trim().toLowerCase();
    if (SALES_STATUSES.has(normalized)) return 'sale';
    if (LOSS_STATUSES.has(normalized)) return 'loss';
    return 'open';
};

const parseLeadRows = (dbPath = EC_ADMIN_DB, country = 'EC', limit = 10000) => {
    const script = `
import json, sqlite3, sys
db_path = sys.argv[1]
country = sys.argv[2]
limit = int(sys.argv[3])
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()
rows = cur.execute("""
    SELECT id, name, phone, phone_e164, status, product_qty, product_value,
           created_at, updated_at, utm_source, utm_campaign, utm_content, event_source_url
    FROM leads
    WHERE upper(coalesce(country, ?)) = ?
    ORDER BY id DESC
    LIMIT ?
""", (country, country, limit)).fetchall()
print(json.dumps([dict(row) for row in rows], ensure_ascii=False))
`;
    const result = spawnSync('python3', ['-', dbPath, country, String(limit)], {
        input: script,
        encoding: 'utf8',
        maxBuffer: 20 * 1024 * 1024
    });
    if (result.status !== 0) {
        throw new Error((result.stderr || 'sqlite_read_failed').trim());
    }
    return JSON.parse(result.stdout || '[]');
};

const toEcDate = (value) => {
    if (!value) return null;
    const normalized = String(value).replace(' ', 'T').replace(/Z$/, '+00:00');
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return null;
    return new Date(date.getTime() + EC_TZ_OFFSET_MINUTES * 60 * 1000);
};

const mongoDateToEcDate = (value) => {
    const date = asDate(value);
    if (!date) return null;
    return new Date(date.getTime() + EC_TZ_OFFSET_MINUTES * 60 * 1000);
};

const ecDayKeyToUtcStart = (dayKey) => {
    const date = new Date(`${dayKey}T00:00:00.000Z`);
    return new Date(date.getTime() - EC_TZ_OFFSET_MINUTES * 60 * 1000);
};

const makeDaySkeleton = (days) => {
    const { ec } = nowEcParts();
    const endMidnight = new Date(Date.UTC(ec.getUTCFullYear(), ec.getUTCMonth(), ec.getUTCDate()));
    const items = [];
    for (let i = days - 1; i >= 0; i -= 1) {
        const date = new Date(endMidnight.getTime() - i * 24 * 60 * 60 * 1000);
        items.push(localDateKey(date));
    }
    return items;
};

const weekdayName = (index) => ['Domingo', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado'][index] || String(index);

const blankMetric = () => ({
    entries: 0,
    sales: 0,
    open: 0,
    losses: 0,
    revenue: 0,
    avgTicket: 0,
    conversionPct: 0,
    vslEntries: 0,
    pageViewCapi: 0,
    whatsappClicks: 0,
    whatsappCtr: 0,
    metaLeads: 0,
    metaLeadRate: 0,
    createdSales: 0,
    purchaseSent: 0,
    purchaseRate: 0,
    facebookInvestmentPct: 0,
    markedValue: 0
});

const addMetric = (bucket, lead) => {
    bucket.entries += 1;
    const kind = statusKind(lead.status);
    if (kind === 'sale') {
        bucket.sales += 1;
        bucket.revenue = money(bucket.revenue + Number(lead.product_value || 0));
    } else if (kind === 'loss') {
        bucket.losses += 1;
    } else {
        bucket.open += 1;
    }
};

const finalizeMetric = (bucket) => {
    bucket.revenue = money(bucket.revenue);
    bucket.markedValue = money(bucket.markedValue);
    bucket.conversionPct = pct(bucket.sales, bucket.entries);
    bucket.whatsappCtr = pct(bucket.whatsappClicks, bucket.vslEntries || bucket.pageViewCapi);
    bucket.metaLeadRate = pct(bucket.metaLeads, bucket.pageViewCapi || bucket.vslEntries);
    bucket.purchaseRate = pct(bucket.purchaseSent, bucket.pageViewCapi || bucket.vslEntries);
    bucket.avgTicket = bucket.sales > 0 ? money(bucket.revenue / bucket.sales) : 0;
    return bucket;
};

const addByEcBuckets = ({ dailyMap, hourlyMap, weekdayMap, value, apply }) => {
    const ecDate = mongoDateToEcDate(value);
    if (!ecDate) return false;
    const dayKey = localDateKey(ecDate);
    const dailyBucket = dailyMap?.get(dayKey);
    const hourlyBucket = hourlyMap?.get(ecDate.getUTCHours());
    const weekdayBucket = weekdayMap?.get(ecDate.getUTCDay());
    let applied = false;
    [dailyBucket, hourlyBucket, weekdayBucket].forEach((bucket) => {
        if (!bucket) return;
        apply(bucket);
        applied = true;
    });
    return applied;
};

const responseLooksAccepted = (response) => {
    if (!response) return false;
    if (response.ok) return true;
    if (response.events_received > 0) return true;
    if (response.data?.events_received > 0) return true;
    return false;
};

const scorePart = (value, maxValue) => (maxValue > 0 ? Math.min(100, (Number(value || 0) / maxValue) * 100) : 0);

const addFacebookInvestmentScore = (items = []) => {
    const maxPurchase = Math.max(0, ...items.map((item) => Number(item.purchaseSent || 0)));
    const maxValue = Math.max(0, ...items.map((item) => Number(item.markedValue || 0)));
    const maxLeadRate = Math.max(0, ...items.map((item) => Number(item.metaLeadRate || 0)));
    const maxWhatsappCtr = Math.max(0, ...items.map((item) => Number(item.whatsappCtr || 0)));
    const maxVslEntries = Math.max(0, ...items.map((item) => Number(item.vslEntries || 0)));

    items.forEach((item) => {
        const hasSignal = item.vslEntries || item.pageViewCapi || item.metaLeads || item.purchaseSent || item.markedValue;
        if (!hasSignal) {
            item.facebookInvestmentPct = 0;
            item.facebookInvestmentLabel = 'Sem dados';
            return;
        }
        const score = (
            scorePart(item.purchaseSent, maxPurchase) * 0.35
            + scorePart(item.markedValue, maxValue) * 0.25
            + scorePart(item.metaLeadRate, maxLeadRate) * 0.15
            + scorePart(item.whatsappCtr, maxWhatsappCtr) * 0.15
            + scorePart(item.vslEntries, maxVslEntries) * 0.10
        );
        item.facebookInvestmentPct = Math.round(score * 10) / 10;
        if (item.facebookInvestmentPct >= 70) item.facebookInvestmentLabel = 'Investir forte';
        else if (item.facebookInvestmentPct >= 45) item.facebookInvestmentLabel = 'Aumentar com teste';
        else if (item.facebookInvestmentPct >= 25) item.facebookInvestmentLabel = 'Manter observando';
        else item.facebookInvestmentLabel = 'Revisar antes de investir';
    });
    return items;
};

const enrichDailyWithMetaAnalytics = async ({ dailyMap, hourlyMap, weekdayMap, dayKeys, country }) => {
    const startDate = dayKeys[0];
    const endDate = dayKeys[dayKeys.length - 1];
    if (!startDate || !endDate) return { visitsRead: 0, ordersRead: 0, error: null };

    const startUtc = ecDayKeyToUtcStart(startDate);
    const endUtcExclusive = new Date(ecDayKeyToUtcStart(endDate).getTime() + 24 * 60 * 60 * 1000);
    const inRange = { $gte: startUtc, $lt: endUtcExclusive };
    const normalizedCountry = String(country || 'EC').toUpperCase();
    const stats = { visitsRead: 0, ordersRead: 0, error: null };

    try {
        const visits = await VslVisit.find({
            country: normalizedCountry,
            $or: [
                { createdAt: inRange },
                { firstSeenAt: inRange },
                { lastSeenAt: inRange },
                { lastClickAt: inRange },
                { metaPageViewSentAt: inRange },
                { metaLeadSentAt: inRange }
            ]
        }).lean();
        stats.visitsRead = visits.length;

        visits.forEach((visit) => {
            addByEcBuckets({ dailyMap, hourlyMap, weekdayMap, value: visit.firstSeenAt || visit.createdAt || visit.lastSeenAt, apply: (bucket) => {
                bucket.vslEntries += 1;
            } });

            if (visit.metaPageViewSentAt || responseLooksAccepted(visit.metaPageViewResponse)) {
                addByEcBuckets({ dailyMap, hourlyMap, weekdayMap, value: visit.metaPageViewSentAt || visit.createdAt || visit.firstSeenAt, apply: (bucket) => {
                    bucket.pageViewCapi += 1;
                } });
            }

            if (visit.lastClickAt || Number(visit.clickCount || 0) > 0) {
                addByEcBuckets({ dailyMap, hourlyMap, weekdayMap, value: visit.lastClickAt || visit.createdAt || visit.firstSeenAt, apply: (bucket) => {
                    bucket.whatsappClicks += Math.max(1, Number(visit.clickCount || 0));
                } });
            }

            if (visit.metaLeadSentAt || responseLooksAccepted(visit.metaLeadResponse)) {
                addByEcBuckets({ dailyMap, hourlyMap, weekdayMap, value: visit.metaLeadSentAt || visit.lastClickAt || visit.createdAt || visit.firstSeenAt, apply: (bucket) => {
                    bucket.metaLeads += 1;
                } });
            }
        });
    } catch (error) {
        stats.error = `vsl_visit_metrics_failed:${error.message || error}`;
    }

    try {
        const orders = await Order.find({
            country: normalizedCountry,
            $or: [
                { createdAt: inRange },
                { 'tracking.metaPurchaseSentAt': inRange }
            ]
        }).lean();
        stats.ordersRead = orders.length;

        orders.forEach((order) => {
            const value = Number(order.total || order.product_value || order.value || 0);
            addByEcBuckets({ dailyMap, hourlyMap, weekdayMap, value: order.createdAt, apply: (bucket) => {
                bucket.createdSales += 1;
                bucket.markedValue = money(bucket.markedValue + value);
            } });

            if (order.tracking?.metaPurchaseSentAt || responseLooksAccepted(order.tracking?.metaPurchaseResponse)) {
                addByEcBuckets({ dailyMap, hourlyMap, weekdayMap, value: order.tracking?.metaPurchaseSentAt || order.createdAt, apply: (bucket) => {
                    bucket.purchaseSent += 1;
                } });
            }
        });
    } catch (error) {
        stats.error = stats.error ? `${stats.error};order_metrics_failed:${error.message || error}` : `order_metrics_failed:${error.message || error}`;
    }

    return stats;
};

const buildRecommendations = ({ hourly, weekday, summary }) => {
    const recommendations = [];
    const minEntries = Math.max(2, Math.ceil((summary.totalVslEntries || summary.totalEntries) / 80));
    const investHours = hourly
        .filter((item) => (item.vslEntries >= minEntries || item.purchaseSent > 0) && item.facebookInvestmentPct >= 45)
        .sort((a, b) => (b.facebookInvestmentPct - a.facebookInvestmentPct) || (b.purchaseSent - a.purchaseSent) || (b.markedValue - a.markedValue))
        .slice(0, 4);
    const reduceHours = hourly
        .filter((item) => item.vslEntries >= minEntries && item.purchaseSent === 0 && item.facebookInvestmentPct < 25)
        .sort((a, b) => (b.vslEntries - a.vslEntries) || (a.facebookInvestmentPct - b.facebookInvestmentPct))
        .slice(0, 4);
    const bestDays = weekday
        .filter((item) => item.facebookInvestmentPct > 0)
        .sort((a, b) => (b.facebookInvestmentPct - a.facebookInvestmentPct) || (b.purchaseSent - a.purchaseSent) || (b.markedValue - a.markedValue))
        .slice(0, 3);

    investHours.forEach((item, index) => {
        recommendations.push({
            prioridade: index + 1,
            tipo: 'AUMENTAR INVESTIMENTO',
            alvo: `${item.hourLabel} Ecuador`,
            motivo: `Indice Facebook ${item.facebookInvestmentPct}%, ${item.vslEntries} VSL, ${item.metaLeads} leads, ${item.purchaseSent} purchase, $${item.markedValue}`,
            acao: 'Priorizar verba, criativo e atendimento nesse horario. Aumentar de forma gradual e acompanhar por 48 horas.',
            cautela: item.vslEntries < 50 ? 'Amostra pequena: escalar devagar.' : 'Horario com sinal forte.'
        });
    });

    bestDays.forEach((item, index) => {
        recommendations.push({
            prioridade: investHours.length + index + 1,
            tipo: 'DIA FORTE',
            alvo: item.weekday,
            motivo: `Indice Facebook ${item.facebookInvestmentPct}%, ${item.vslEntries} VSL, ${item.metaLeads} leads, ${item.purchaseSent} purchase, $${item.markedValue}`,
            acao: 'Usar como referencia para agenda de trafego, criativos e reforco de atendimento.',
            cautela: item.purchaseSent === 0 ? 'Ainda sem Purchase nesse recorte.' : 'Comparar com os proximos dias antes de dobrar verba.'
        });
    });

    reduceHours.forEach((item, index) => {
        recommendations.push({
            prioridade: investHours.length + bestDays.length + index + 1,
            tipo: 'REDUZIR OU REVISAR',
            alvo: `${item.hourLabel} Ecuador`,
            motivo: `${item.vslEntries} VSL, ${item.metaLeads} leads, ${item.purchaseSent} purchase, indice ${item.facebookInvestmentPct}%`,
            acao: 'Nao cortar no escuro: revisar criativo, promessa da VSL, resposta inicial e velocidade do bot nesse horario.',
            cautela: 'Pode haver pedidos ainda em atendimento. Confirmar antes de reduzir muito.'
        });
    });

    if (!recommendations.length) {
        recommendations.push({
            prioridade: 1,
            tipo: 'AGUARDAR MAIS DADOS',
            alvo: 'Periodo analisado',
            motivo: 'Ainda ha pouca amostra para decisao de trafego.',
            acao: 'Manter monitoramento por mais entradas antes de aumentar ou reduzir verba.',
            cautela: 'Nao tomar decisao com poucos clientes.'
        });
    }

    return recommendations.slice(0, 12);
};

const buildMarkdownPlan = (report) => {
    const bestHours = (report.summary.bestHours || []).map((item) => `- ${item.hourLabel}: ${item.sales} vendas, ${item.entries} entradas, ${item.conversionPct}%`).join('\n') || '- Sem horario forte ainda.';
    const recommendations = (report.recommendations || []).map((item) => `- ${item.tipo} | ${item.alvo}: ${item.acao} (${item.motivo})`).join('\n');
    return `# Observador de Horarios e Investimento EC

Gerado em: ${report.generatedAt}
Fuso usado: ${report.timezone}
Janela: ${report.range.days} dias

## Resumo
- Clientes que entraram: ${report.summary.totalEntries}
- Vendas/pedidos finalizados: ${report.summary.totalSales}
- Conversao: ${report.summary.conversionPct}%
- Faturamento registrado: $${report.summary.totalRevenue}
- Garantia: ${report.readOnlyGuarantee}

## Melhores horarios
${bestHours}

## Recomendacoes
${recommendations}
`;
};

const writeArtifacts = async (report) => {
    const dir = path.resolve(process.cwd(), spreadsheetDir());
    await fs.mkdir(dir, { recursive: true });
    report.files = {
        horarios: '/api/observation/sales-hours-spreadsheet/horarios',
        dias: '/api/observation/sales-hours-spreadsheet/dias',
        recomendacoes: '/api/observation/sales-hours-spreadsheet/recomendacoes',
        plano: '/api/observation/sales-hours-file/mapa-investimento-horarios.md'
    };

    const hourlyCsv = toCsv(
        [
            'hora',
            'indice_facebook_pct',
            'decisao_facebook',
            'entradas_vsl',
            'pageview_capi',
            'cliques_whatsapp',
            'ctr_whatsapp',
            'leads_meta',
            'lead_rate_meta',
            'purchase_enviado',
            'purchase_rate',
            'valor_marcado',
            'entradas_painel',
            'vendas_painel',
            'em_atendimento',
            'perdidos',
            'conversao_painel_pct',
            'faturamento_painel',
            'ticket_medio',
            'recomendacao'
        ],
        report.hourly.map((item) => ({
            hora: item.hourLabel,
            indice_facebook_pct: item.facebookInvestmentPct,
            decisao_facebook: item.facebookInvestmentLabel,
            entradas_vsl: item.vslEntries,
            pageview_capi: item.pageViewCapi,
            cliques_whatsapp: item.whatsappClicks,
            ctr_whatsapp: item.whatsappCtr,
            leads_meta: item.metaLeads,
            lead_rate_meta: item.metaLeadRate,
            purchase_enviado: item.purchaseSent,
            purchase_rate: item.purchaseRate,
            valor_marcado: item.markedValue,
            entradas_painel: item.entries,
            vendas_painel: item.sales,
            em_atendimento: item.open,
            perdidos: item.losses,
            conversao_painel_pct: item.conversionPct,
            faturamento_painel: item.revenue,
            ticket_medio: item.avgTicket,
            recomendacao: item.recommendation
        }))
    );
    const dailyCsv = toCsv(
        [
            'data',
            'indice_facebook_pct',
            'decisao_facebook',
            'entradas_vsl',
            'pageview_capi',
            'cliques_whatsapp',
            'ctr_whatsapp',
            'leads_meta',
            'lead_rate_meta',
            'vendas_criadas',
            'purchase_enviado',
            'purchase_rate',
            'valor_marcado',
            'entradas_painel',
            'vendas_painel',
            'em_atendimento',
            'perdidos',
            'conversao_painel_pct',
            'faturamento_painel',
            'ticket_medio'
        ],
        report.daily.map((item) => ({
            data: item.date,
            indice_facebook_pct: item.facebookInvestmentPct,
            decisao_facebook: item.facebookInvestmentLabel,
            entradas_vsl: item.vslEntries,
            pageview_capi: item.pageViewCapi,
            cliques_whatsapp: item.whatsappClicks,
            ctr_whatsapp: item.whatsappCtr,
            leads_meta: item.metaLeads,
            lead_rate_meta: item.metaLeadRate,
            vendas_criadas: item.createdSales,
            purchase_enviado: item.purchaseSent,
            purchase_rate: item.purchaseRate,
            valor_marcado: item.markedValue,
            entradas_painel: item.entries,
            vendas_painel: item.sales,
            em_atendimento: item.open,
            perdidos: item.losses,
            conversao_painel_pct: item.conversionPct,
            faturamento_painel: item.revenue,
            ticket_medio: item.avgTicket
        }))
    );
    const recommendationsCsv = toCsv(
        ['prioridade', 'tipo', 'alvo', 'motivo', 'acao', 'cautela'],
        report.recommendations
    );
    const markdown = buildMarkdownPlan(report);

    await Promise.all([
        fs.writeFile(path.join(dir, 'horarios-vendas.csv'), hourlyCsv),
        fs.writeFile(path.join(dir, 'dias-vendas.csv'), dailyCsv),
        fs.writeFile(path.join(dir, 'recomendacoes-investimento.csv'), recommendationsCsv),
        fs.writeFile(path.join(dir, 'mapa-investimento-horarios.md'), markdown),
        fs.writeFile(path.resolve(process.cwd(), reportPath()), JSON.stringify(report, null, 2))
    ]);

    return report;
};

export const scanSalesHoursAnalytics = async ({
    country = 'EC',
    days = DEFAULT_DAYS,
    limit = 10000
} = {}) => {
    const normalizedCountry = String(country || 'EC').toUpperCase();
    const daysWindow = clampDays(days);
    if (normalizedCountry !== 'EC') {
        throw new Error('sales_hours_observer_only_ec_enabled');
    }

    const dayKeys = makeDaySkeleton(daysWindow);
    const daySet = new Set(dayKeys);
    const dailyMap = new Map(dayKeys.map((key) => [key, { date: key, ...blankMetric() }]));
    const hourlyMap = new Map(Array.from({ length: 24 }, (_, hour) => [hour, { hour, hourLabel: `${String(hour).padStart(2, '0')}:00-${String(hour).padStart(2, '0')}:59`, ...blankMetric() }]));
    const weekdayMap = new Map(Array.from({ length: 7 }, (_, day) => [day, { weekdayIndex: day, weekday: weekdayName(day), ...blankMetric() }]));
    const rows = parseLeadRows(EC_ADMIN_DB, normalizedCountry, limit);

    rows.forEach((lead) => {
        const createdEc = toEcDate(lead.created_at);
        if (!createdEc) return;
        const dayKey = localDateKey(createdEc);
        if (!daySet.has(dayKey)) return;

        addMetric(dailyMap.get(dayKey), lead);
        addMetric(hourlyMap.get(createdEc.getUTCHours()), lead);
        addMetric(weekdayMap.get(createdEc.getUTCDay()), lead);
    });

    const metaMetrics = await enrichDailyWithMetaAnalytics({ dailyMap, hourlyMap, weekdayMap, dayKeys, country: normalizedCountry });
    const daily = addFacebookInvestmentScore([...dailyMap.values()].map(finalizeMetric));
    const hourly = addFacebookInvestmentScore([...hourlyMap.values()].map(finalizeMetric));
    const weekday = addFacebookInvestmentScore([...weekdayMap.values()].map(finalizeMetric));
    const total = finalizeMetric(daily.reduce((acc, item) => {
        acc.entries += item.entries;
        acc.sales += item.sales;
        acc.open += item.open;
        acc.losses += item.losses;
        acc.revenue = money(acc.revenue + item.revenue);
        acc.vslEntries += item.vslEntries;
        acc.pageViewCapi += item.pageViewCapi;
        acc.whatsappClicks += item.whatsappClicks;
        acc.metaLeads += item.metaLeads;
        acc.createdSales += item.createdSales;
        acc.purchaseSent += item.purchaseSent;
        acc.markedValue = money(acc.markedValue + item.markedValue);
        return acc;
    }, blankMetric()));

    hourly.forEach((item) => {
        if (item.facebookInvestmentPct >= 70) {
            item.recommendation = 'Investir forte com acompanhamento';
        } else if (item.facebookInvestmentPct >= 45) {
            item.recommendation = 'Aumentar com teste controlado';
        } else if (item.facebookInvestmentPct >= 25) {
            item.recommendation = 'Manter observando';
        } else if (item.vslEntries > 0 || item.pageViewCapi > 0) {
            item.recommendation = 'Revisar antes de investir';
        } else {
            item.recommendation = 'Sem dados';
        }
    });

    const summary = {
        totalEntries: total.entries,
        totalSales: total.sales,
        totalOpen: total.open,
        totalLosses: total.losses,
        totalRevenue: total.revenue,
        totalVslEntries: total.vslEntries,
        totalPageViewCapi: total.pageViewCapi,
        totalWhatsappClicks: total.whatsappClicks,
        whatsappCtr: total.whatsappCtr,
        totalMetaLeads: total.metaLeads,
        totalCreatedSales: total.createdSales,
        totalPurchaseSent: total.purchaseSent,
        totalMarkedValue: total.markedValue,
        avgTicket: total.avgTicket,
        conversionPct: total.conversionPct,
        metaMetrics,
        bestHours: hourly.filter((item) => item.facebookInvestmentPct > 0).sort((a, b) => (b.facebookInvestmentPct - a.facebookInvestmentPct) || (b.purchaseSent - a.purchaseSent)).slice(0, 5),
        bestDays: weekday.filter((item) => item.facebookInvestmentPct > 0).sort((a, b) => (b.facebookInvestmentPct - a.facebookInvestmentPct) || (b.purchaseSent - a.purchaseSent)).slice(0, 5)
    };
    const report = {
        ok: true,
        mode: 'sales_hours_observer_read_only',
        country: normalizedCountry,
        generatedAt: new Date().toISOString(),
        timezone: 'America/Guayaquil (UTC-05:00)',
        dayWindowLabel: '00:01 ate 00:00, agrupado pelo dia do Equador',
        range: {
            days: daysWindow,
            dates: dayKeys,
            startDate: dayKeys[0] || null,
            endDate: dayKeys[dayKeys.length - 1] || null
        },
        summary,
        daily,
        hourly,
        weekday,
        recommendations: buildRecommendations({ hourly, weekday, summary }),
        readOnlyGuarantee: 'Nao envia mensagem, nao altera cliente, nao cria pedido, nao envia Dropi. Apenas le o painel e gera relatorio.'
    };

    return writeArtifacts(report);
};

export const readSalesHoursAnalyticsReport = async () => {
    try {
        const raw = await fs.readFile(path.resolve(process.cwd(), reportPath()), 'utf8');
        return JSON.parse(raw);
    } catch {
        return null;
    }
};

export const readSalesHoursSpreadsheet = async (kind) => {
    const clean = String(kind || '').toLowerCase();
    const filenameByKind = {
        horarios: 'horarios-vendas.csv',
        dias: 'dias-vendas.csv',
        recomendacoes: 'recomendacoes-investimento.csv'
    };
    const filename = filenameByKind[clean];
    if (!filename) return null;
    try {
        return await fs.readFile(path.resolve(process.cwd(), spreadsheetDir(), filename), 'utf8');
    } catch {
        return null;
    }
};

export const readSalesHoursFile = async (filename) => {
    const clean = String(filename || '').replace(/[^a-z0-9_.-]/gi, '');
    if (clean !== 'mapa-investimento-horarios.md') return null;
    try {
        return await fs.readFile(path.resolve(process.cwd(), spreadsheetDir(), clean), 'utf8');
    } catch {
        return null;
    }
};
