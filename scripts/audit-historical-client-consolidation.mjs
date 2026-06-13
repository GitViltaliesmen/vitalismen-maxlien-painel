import { spawnSync } from 'child_process';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import ContactState from '../src/models/ContactState.js';
import Order from '../src/models/Order.js';
import Shipment from '../src/models/Shipment.js';

dotenv.config();

const ADMIN_DBS = {
    EC: '/opt/maxlien-mvp/leads_ec.sqlite3',
    CO: '/opt/maxlien-mvp/leads_co.sqlite3'
};
const OPERATIONAL_PHONES = new Set([
    '553183002800',
    '553171862958',
    '5515991418416',
    '5515998038637',
    '573001234567'
]);

const digitsOnly = (value) => String(value || '').replace(/\D/g, '');
const phoneTail = (value) => digitsOnly(value).slice(-9);
const isOperationalOrTest = (phone, name = '') => {
    const normalizedPhone = digitsOnly(phone);
    const tail = phoneTail(normalizedPhone);
    if (OPERATIONAL_PHONES.has(normalizedPhone) || [...OPERATIONAL_PHONES].some((item) => phoneTail(item) === tail)) return true;
    if (/guard codex|teste|^test$/i.test(String(name || '').trim())) return true;
    return ['3000000001', '573000000000'].includes(normalizedPhone);
};

const normalizeStatus = (raw = '', source = {}) => {
    const value = String(raw || '').trim().toLowerCase().replace(/[ -]/g, '_');
    const shipping = String(source.shippingStatus || source.logisticsStatus || '').toUpperCase();
    if (source.returned || /DEVUEL|DEVOL|RETURN/.test(shipping) || ['devolvido', 'returned'].includes(value)) return 'devolvido';
    if (source.delivered || source.pickedUp || /ENTREG|DELIVER/.test(shipping) || ['entregue', 'delivered'].includes(value)) return 'entregue';
    if (['pedido_enviado', 'enviado', 'processing', 'shipped', 'in_transit', 'ready_for_pickup'].includes(value) || /GUIA|TRANSIT|RUTA|RETIRO|AGENCIA/.test(shipping)) return 'pedido_enviado';
    if (['confirmado', 'confirmed'].includes(value)) return 'confirmado';
    if (['atendendo', 'manual', 'human', 'attending'].includes(value) || source.humanMode === 'manual') return 'atendendo';
    if (['novo', 'new'].includes(value)) return 'novo';
    return value || 'novo';
};

const statusRank = {
    novo: 0,
    atendendo: 1,
    confirmado: 2,
    pedido_enviado: 3,
    entregue: 4,
    devolvido: 4,
    cancelado: 4,
    recompra: 5,
    finalizado: 6
};

const betterStatus = (current, candidate) => (
    (statusRank[candidate] ?? 0) > (statusRank[current] ?? 0) ? candidate : current
);

const runPython = (python) => {
    const result = spawnSync('python3', ['-'], {
        input: python,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 30
    });
    if (result.status !== 0) throw new Error(result.stderr || result.stdout || `python_exit_${result.status}`);
    return JSON.parse(result.stdout || '[]');
};

const readUnifiedPanelLeads = () => runPython(`
import sqlite3, json
dbs = ${JSON.stringify(ADMIN_DBS)}
rows = []
for country, path in dbs.items():
    con = sqlite3.connect(path)
    con.row_factory = sqlite3.Row
    for row in con.execute("""
        SELECT id, name, phone, phone_e164, status, created_at, updated_at, country, notes
        FROM leads
    """).fetchall():
        item = dict(row)
        item["country_db"] = country
        rows.append(item)
    con.close()
print(json.dumps(rows, ensure_ascii=False))
`);

const addCandidate = (map, phone, data = {}) => {
    const normalizedPhone = digitsOnly(phone);
    const tail = phoneTail(normalizedPhone);
    if (!tail || tail.length < 7) return;
    const name = String(data.name || '').trim();
    if (isOperationalOrTest(normalizedPhone, name)) return;
    const current = map.get(tail) || {
        phone: normalizedPhone,
        name: '',
        country: '',
        status: 'novo',
        sources: [],
        firstSeenAt: '',
        lastSeenAt: '',
        unified: data.unified || null
    };
    current.phone = current.phone || normalizedPhone;
    current.name = current.name || data.name || '';
    current.country = current.country || data.country || '';
    current.status = betterStatus(current.status, data.status || 'novo');
    if (data.firstSeenAt && (!current.firstSeenAt || new Date(data.firstSeenAt) < new Date(current.firstSeenAt))) current.firstSeenAt = data.firstSeenAt;
    if (data.lastSeenAt && (!current.lastSeenAt || new Date(data.lastSeenAt) > new Date(current.lastSeenAt))) current.lastSeenAt = data.lastSeenAt;
    if (data.source) current.sources.push(data.source);
    map.set(tail, current);
};

const main = async () => {
    const unifiedLeads = readUnifiedPanelLeads();
    const unifiedByTail = new Map();
    for (const lead of unifiedLeads) {
        const tail = phoneTail(lead.phone_e164 || lead.phone);
        if (tail) unifiedByTail.set(tail, lead);
    }

    await mongoose.connect(process.env.MONGODB_URI);
    const contacts = await ContactState.find({})
        .select('chatId phoneDigits countryCode firstInboundAt createdAt updatedAt human metadata.customerDraft')
        .lean();
    const orders = await Order.find({})
        .select('orderId customerPhone phone customer.phone status shippingStatus createdAt updatedAt country')
        .lean();
    const shipments = await Shipment.find({})
        .select('orderId country client.phone customerPhone phone recipientPhone logistics.status outcomes.delivered outcomes.pickedUp outcomes.returned createdAt updatedAt')
        .lean();

    const candidates = new Map();
    for (const lead of unifiedLeads) {
        const tail = phoneTail(lead.phone_e164 || lead.phone);
        if (isOperationalOrTest(lead.phone_e164 || lead.phone, lead.name)) continue;
        if (tail) candidates.set(tail, {
            phone: digitsOnly(lead.phone_e164 || lead.phone),
            name: lead.name || '',
            country: lead.country || lead.country_db || '',
            status: normalizeStatus(lead.status),
            sources: ['unified_panel'],
            firstSeenAt: lead.created_at || '',
            lastSeenAt: lead.updated_at || lead.created_at || '',
            unified: lead
        });
    }

    for (const state of contacts) {
        const draft = state.metadata?.customerDraft || {};
        addCandidate(candidates, draft.phone || state.phoneDigits || state.chatId, {
            source: 'whatsapp_contact',
            name: draft.name,
            country: draft.country || state.countryCode,
            status: normalizeStatus(draft.status, { humanMode: state.human?.mode }),
            firstSeenAt: state.firstInboundAt || state.createdAt,
            lastSeenAt: state.updatedAt,
            unified: unifiedByTail.get(phoneTail(draft.phone || state.phoneDigits || state.chatId)) || null
        });
    }
    for (const order of orders) {
        addCandidate(candidates, order.customerPhone || order.phone || order.customer?.phone, {
            source: 'order',
            country: order.country,
            status: normalizeStatus(order.status, { shippingStatus: order.shippingStatus }),
            firstSeenAt: order.createdAt,
            lastSeenAt: order.updatedAt,
            unified: unifiedByTail.get(phoneTail(order.customerPhone || order.phone || order.customer?.phone)) || null
        });
    }
    for (const shipment of shipments) {
        addCandidate(candidates, shipment.client?.phone || shipment.customerPhone || shipment.phone || shipment.recipientPhone, {
            source: 'shipment',
            country: shipment.country,
            status: normalizeStatus('', {
                logisticsStatus: shipment.logistics?.status,
                delivered: shipment.outcomes?.delivered,
                pickedUp: shipment.outcomes?.pickedUp,
                returned: shipment.outcomes?.returned
            }),
            firstSeenAt: shipment.createdAt,
            lastSeenAt: shipment.updatedAt,
            unified: unifiedByTail.get(phoneTail(shipment.client?.phone || shipment.customerPhone || shipment.phone || shipment.recipientPhone)) || null
        });
    }

    await mongoose.disconnect();

    const relevantStatuses = new Set(['atendendo', 'confirmado', 'pedido_enviado', 'entregue', 'devolvido']);
    const missing = [];
    const differences = [];
    const safeOperationalUpdates = [];
    const archivedFinalizado = [];

    for (const candidate of candidates.values()) {
        if (isOperationalOrTest(candidate.phone, candidate.name || candidate.unified?.name)) continue;
        candidate.sources = [...new Set(candidate.sources)];
        if (!candidate.unified) {
            if (relevantStatuses.has(candidate.status)) missing.push(candidate);
            continue;
        }
        const currentStatus = normalizeStatus(candidate.unified.status);
        if (currentStatus === candidate.status || !relevantStatuses.has(candidate.status)) continue;
        const diff = { ...candidate, currentStatus };
        differences.push(diff);
        if (String(candidate.unified.status || '').trim().toLowerCase() === 'finalizado') {
            archivedFinalizado.push(diff);
        } else if (
            ['pedido_enviado', 'entregue', 'devolvido'].includes(candidate.status)
            && !['entregue', 'devolvido', 'cancelado', 'recompra'].includes(currentStatus)
        ) {
            safeOperationalUpdates.push(diff);
        }
    }

    const countBy = (items, keyFn) => items.reduce((acc, item) => {
        const key = keyFn(item);
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});

    const sample = (items, limit = 25) => items.slice(0, limit).map((item) => ({
        phone: item.phone,
        name: item.name,
        country: item.country,
        currentStatus: item.currentStatus || item.unified?.status || '',
        consolidatedStatus: item.status,
        unifiedId: item.unified?.id || '',
        unifiedCreatedAt: item.unified?.created_at || '',
        sources: item.sources,
        firstSeenAt: item.firstSeenAt,
        lastSeenAt: item.lastSeenAt
    }));

    console.log(JSON.stringify({
        ok: true,
        mode: 'dry_run_read_only',
        unifiedLeads: unifiedLeads.length,
        scanned: {
            contacts: contacts.length,
            orders: orders.length,
            shipments: shipments.length,
            uniquePhones: candidates.size
        },
        missingCandidates: {
            total: missing.length,
            byStatus: countBy(missing, (item) => item.status),
            samples: sample(missing)
        },
        statusDifferences: {
            total: differences.length,
            byCurrentToConsolidated: countBy(differences, (item) => `${item.unified?.status || ''} -> ${item.status}`),
            samples: sample(differences)
        },
        safeOperationalUpdates: {
            total: safeOperationalUpdates.length,
            byStatus: countBy(safeOperationalUpdates, (item) => item.status),
            samples: sample(safeOperationalUpdates)
        },
        archivedFinalizado: {
            total: archivedFinalizado.length,
            byConsolidatedStatus: countBy(archivedFinalizado, (item) => item.status),
            samples: sample(archivedFinalizado, 10)
        }
    }, null, 2));
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
