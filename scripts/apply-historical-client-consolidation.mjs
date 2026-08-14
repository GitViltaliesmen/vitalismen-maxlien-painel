import { spawnSync } from 'child_process';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import ContactState from '../src/models/ContactState.js';
import Order from '../src/models/Order.js';
import Shipment from '../src/models/Shipment.js';

dotenv.config();

const ADMIN_DBS = {
    EC: '/opt/maxlien-mvp/leads_ec.sqlite3'
};

const OPERATIONAL_PHONES = new Set([
    '553183002800',
    '553171862958',
    '5515991418416',
    '5515998038637'
]);

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');

const digitsOnly = (value) => String(value || '').replace(/\D/g, '');
const phoneTail = (value) => digitsOnly(value).slice(-9);
const isoOrNow = (value) => {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date.toISOString() : new Date().toISOString();
};
const isOperationalOrTest = (phone, name = '') => {
    const normalizedPhone = digitsOnly(phone);
    const tail = phoneTail(normalizedPhone);
    if (OPERATIONAL_PHONES.has(normalizedPhone) || [...OPERATIONAL_PHONES].some((item) => phoneTail(item) === tail)) return true;
    if (/guard codex|teste|^test$/i.test(String(name || '').trim())) return true;
    if (/^(57)?3000000000{0,2}1?$/.test(normalizedPhone)) return true;
    return ['3000000001', '573000000000', '573000000001'].includes(normalizedPhone);
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
    return JSON.parse(result.stdout || '{}');
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
print(json.dumps({"ok": True, "rows": rows}, ensure_ascii=False))
`).rows || [];

const addCandidate = (map, phone, data = {}) => {
    const normalizedPhone = digitsOnly(phone);
    const tail = phoneTail(normalizedPhone);
    const name = String(data.name || '').trim();
    if (!tail || tail.length < 7 || isOperationalOrTest(normalizedPhone, name)) return;
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
    current.name = current.name || name;
    current.country = current.country || data.country || '';
    current.status = betterStatus(current.status, data.status || 'novo');
    if (data.firstSeenAt && (!current.firstSeenAt || new Date(data.firstSeenAt) < new Date(current.firstSeenAt))) current.firstSeenAt = data.firstSeenAt;
    if (data.lastSeenAt && (!current.lastSeenAt || new Date(data.lastSeenAt) > new Date(current.lastSeenAt))) current.lastSeenAt = data.lastSeenAt;
    if (data.source) current.sources.push(data.source);
    if (data.unified) current.unified = data.unified;
    map.set(tail, current);
};

const buildCandidates = async () => {
    const unifiedLeads = readUnifiedPanelLeads();
    const unifiedByTail = new Map();
    for (const lead of unifiedLeads) {
        const tail = phoneTail(lead.phone_e164 || lead.phone);
        if (tail && !isOperationalOrTest(lead.phone_e164 || lead.phone, lead.name)) unifiedByTail.set(tail, lead);
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
        if (isOperationalOrTest(lead.phone_e164 || lead.phone, lead.name)) continue;
        const tail = phoneTail(lead.phone_e164 || lead.phone);
        if (!tail) continue;
        candidates.set(tail, {
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
        const phone = draft.phone || state.phoneDigits || state.chatId;
        addCandidate(candidates, phone, {
            source: 'whatsapp_contact',
            name: draft.name,
            country: draft.country || state.countryCode,
            status: normalizeStatus(draft.status, { humanMode: state.human?.mode }),
            firstSeenAt: state.firstInboundAt || state.createdAt,
            lastSeenAt: state.updatedAt,
            unified: unifiedByTail.get(phoneTail(phone)) || null
        });
    }
    for (const order of orders) {
        const phone = order.customerPhone || order.phone || order.customer?.phone;
        addCandidate(candidates, phone, {
            source: 'order',
            country: order.country,
            status: normalizeStatus(order.status, { shippingStatus: order.shippingStatus }),
            firstSeenAt: order.createdAt,
            lastSeenAt: order.updatedAt,
            unified: unifiedByTail.get(phoneTail(phone)) || null
        });
    }
    for (const shipment of shipments) {
        const phone = shipment.client?.phone || shipment.customerPhone || shipment.phone || shipment.recipientPhone;
        addCandidate(candidates, phone, {
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
            unified: unifiedByTail.get(phoneTail(phone)) || null
        });
    }
    await mongoose.disconnect();
    return { unifiedLeads, contacts, orders, shipments, candidates: [...candidates.values()].map((item) => ({ ...item, sources: [...new Set(item.sources)] })) };
};

const applyChanges = ({ missingImports, safeDeliveredUpdates }) => runPython(`
import sqlite3, json
from datetime import datetime, timezone

dbs = ${JSON.stringify(ADMIN_DBS)}
missing = json.loads(${JSON.stringify(JSON.stringify(missingImports))})
updates = json.loads(${JSON.stringify(JSON.stringify(safeDeliveredUpdates))})
now = datetime.now(timezone.utc).isoformat()

def ensure(cur):
    cur.execute("""
        CREATE TABLE IF NOT EXISTS lead_status_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lead_id INTEGER NOT NULL,
            old_status TEXT,
            new_status TEXT,
            action TEXT,
            created_at TEXT
        )
    """)
    cols = {row[1] for row in cur.execute("PRAGMA table_info(lead_status_history)").fetchall()}
    if "action" not in cols:
        cur.execute("ALTER TABLE lead_status_history ADD COLUMN action TEXT")
    cur.execute("""
        CREATE TABLE IF NOT EXISTS lead_activity_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lead_id INTEGER NOT NULL,
            activity_type TEXT,
            detail TEXT,
            created_at TEXT
        )
    """)

def cols(cur):
    return {row[1] for row in cur.execute("PRAGMA table_info(leads)").fetchall()}

def digits(value):
    return "".join(ch for ch in str(value or "") if ch.isdigit())

def tail(value):
    return digits(value)[-9:]

created = []
updated = []
skipped = []

for country, path in dbs.items():
    con = sqlite3.connect(path)
    cur = con.cursor()
    ensure(cur)
    lead_cols = cols(cur)
    existing = {}
    for row in cur.execute("SELECT id, phone, phone_e164, status, COALESCE(notes, '') FROM leads").fetchall():
        t = tail(row[2] or row[1])
        if t:
            existing[t] = row

    for item in [i for i in missing if (i.get("country") or "EC").upper() == country]:
        t = tail(item.get("phone"))
        if not t or t in existing:
            skipped.append({"phone": item.get("phone"), "reason": "exists_or_invalid"})
            continue
        entry_at = item.get("firstSeenAt") or now
        last_at = item.get("lastSeenAt") or entry_at
        fields = {
            "name": item.get("name") or "",
            "phone": "+" + digits(item.get("phone")),
            "phone_e164": "+" + digits(item.get("phone")),
            "status": item.get("status") or "pedido_enviado",
            "country": country,
            "created_at": entry_at,
            "updated_at": last_at,
            "source": "historico_whatsapp",
            "notes": "Etiqueta: Historico WhatsApp | resgate_retroativo_whatsapp | nao e pedido novo | fontes=" + ",".join(item.get("sources") or [])
        }
        fields = {k: v for k, v in fields.items() if k in lead_cols}
        keys = list(fields.keys())
        cur.execute("INSERT INTO leads (" + ",".join(keys) + ") VALUES (" + ",".join(["?"] * len(keys)) + ")", [fields[k] for k in keys])
        lead_id = cur.lastrowid
        if "event_id" in lead_cols:
            event_id = country + "-ADMIN-" + str(lead_id)
            cur.execute("UPDATE leads SET event_id=? WHERE id=?", (event_id, lead_id))
        cur.execute(
            "INSERT INTO lead_status_history (lead_id, old_status, new_status, action, created_at) VALUES (?, ?, ?, ?, ?)",
            (lead_id, "", fields.get("status", item.get("status") or "pedido_enviado"), "resgate_retroativo_whatsapp", entry_at)
        )
        cur.execute(
            "INSERT INTO lead_activity_history (lead_id, activity_type, detail, created_at) VALUES (?, ?, ?, ?)",
            (lead_id, "historico_whatsapp", "Cliente resgatado de paineis historicos; data original preservada; nao e pedido novo.", entry_at)
        )
        created.append({"leadId": lead_id, "phone": item.get("phone"), "status": fields.get("status"), "entryAt": entry_at})

    for item in [i for i in updates if (i.get("country") or "EC").upper() == country]:
        lead_id = int(item.get("unifiedId") or 0)
        if not lead_id:
            skipped.append({"phone": item.get("phone"), "reason": "missing_lead_id"})
            continue
        row = cur.execute("SELECT status, COALESCE(notes, '') FROM leads WHERE id=?", (lead_id,)).fetchone()
        if not row:
            skipped.append({"phone": item.get("phone"), "reason": "lead_not_found"})
            continue
        old_status = str(row[0] or "")
        if old_status.strip().lower() in {"entregue", "devolvido", "cancelado", "recompra"}:
            skipped.append({"phone": item.get("phone"), "reason": "already_final"})
            continue
        notes = str(row[1] or "")
        marker = "Status consolidado por varredura historica: entregue"
        if marker not in notes and "notes" in lead_cols:
            notes = (notes + "\\n" + marker).strip() if notes else marker
            cur.execute("UPDATE leads SET status=?, updated_at=?, notes=? WHERE id=?", ("entregue", now, notes, lead_id))
        elif "updated_at" in lead_cols:
            cur.execute("UPDATE leads SET status=?, updated_at=? WHERE id=?", ("entregue", now, lead_id))
        else:
            cur.execute("UPDATE leads SET status=? WHERE id=?", ("entregue", lead_id))
        cur.execute(
            "INSERT INTO lead_status_history (lead_id, old_status, new_status, action, created_at) VALUES (?, ?, ?, ?, ?)",
            (lead_id, old_status, "entregue", "status_consolidado_paineis", now)
        )
        cur.execute(
            "INSERT INTO lead_activity_history (lead_id, activity_type, detail, created_at) VALUES (?, ?, ?, ?)",
            (lead_id, "status_consolidado_paineis", "Status atualizado para entregue por sinais consolidados em WhatsApp/pedidos/remessas; data de entrada preservada.", now)
        )
        updated.append({"leadId": lead_id, "phone": item.get("phone"), "oldStatus": old_status, "newStatus": "entregue"})

    con.commit()
    con.close()

print(json.dumps({"ok": True, "created": created, "updated": updated, "skipped": skipped}, ensure_ascii=False))
`);

const main = async () => {
    const data = await buildCandidates();
    const missingImports = [];
    const safeDeliveredUpdates = [];

    for (const candidate of data.candidates) {
        if (isOperationalOrTest(candidate.phone, candidate.name || candidate.unified?.name)) continue;
        const currentStatus = candidate.unified ? normalizeStatus(candidate.unified.status) : '';
        const country = String(candidate.country || candidate.unified?.country || candidate.unified?.country_db || 'EC').toUpperCase();
        if (
            !candidate.unified
            && country === 'EC'
            && candidate.status === 'pedido_enviado'
            && candidate.name
            && candidate.sources.includes('whatsapp_contact')
            && candidate.sources.includes('order')
        ) {
            missingImports.push({
                phone: candidate.phone,
                name: candidate.name,
                country,
                status: candidate.status,
                sources: candidate.sources,
                firstSeenAt: isoOrNow(candidate.firstSeenAt),
                lastSeenAt: isoOrNow(candidate.lastSeenAt || candidate.firstSeenAt)
            });
        }
        if (
            candidate.unified
            && country === 'EC'
            && candidate.status === 'entregue'
            && ['pedido_enviado', 'confirmado'].includes(currentStatus)
            && candidate.sources.includes('whatsapp_contact')
            && (candidate.sources.includes('order') || candidate.sources.includes('shipment'))
        ) {
            safeDeliveredUpdates.push({
                phone: candidate.phone,
                name: candidate.name || candidate.unified?.name || '',
                country,
                currentStatus,
                status: candidate.status,
                unifiedId: candidate.unified.id,
                unifiedCreatedAt: candidate.unified.created_at || '',
                sources: candidate.sources
            });
        }
    }

    const summary = {
        ok: true,
        mode: apply ? 'apply' : 'dry_run',
        scanned: {
            unifiedLeads: data.unifiedLeads.length,
            contacts: data.contacts.length,
            orders: data.orders.length,
            shipments: data.shipments.length,
            uniquePhones: data.candidates.length
        },
        planned: {
            importHistoricoWhatsapp: missingImports.length,
            updateEntregue: safeDeliveredUpdates.length
        },
        importSamples: missingImports.slice(0, 20),
        updateSamples: safeDeliveredUpdates.slice(0, 20)
    };

    if (apply) summary.applyResult = applyChanges({ missingImports, safeDeliveredUpdates });
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
