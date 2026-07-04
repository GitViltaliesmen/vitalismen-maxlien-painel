import { spawnSync } from 'child_process';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import ContactState from '../src/models/ContactState.js';
import Message from '../src/models/Message.js';

dotenv.config();

const ADMIN_DB_EC = '/opt/maxlien-mvp/leads_ec.sqlite3';
const OFFICIAL_SESSIONS = ['553183002800', '553171862958', '5515991418416'];

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const includeUnknownSessions = args.has('--include-unknown-sessions');
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const limit = limitArg ? Number.parseInt(limitArg.split('=')[1], 10) : 0;

const digitsOnly = (value) => String(value || '').replace(/\D/g, '');
const phoneTail = (value) => digitsOnly(value).slice(-9);
const validEcPhone = (value) => /^5939\d{8}$/.test(digitsOnly(value));
const normalizeEcPhone = (value) => {
    const digits = digitsOnly(value);
    if (digits.startsWith('593')) return digits;
    return digits.length >= 9 ? `593${digits.slice(-9)}` : digits;
};
const VALID_PACKAGE_QUANTITIES = new Set(['1', '3', '6']);
const normalizePackageQuantity = (value) => {
    const text = String(value ?? '').trim();
    return VALID_PACKAGE_QUANTITIES.has(text) ? text : '0';
};

const parseDate = (value) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

const earliestDate = (...values) => {
    const dates = values.flat().map(parseDate).filter(Boolean);
    return dates.length ? new Date(Math.min(...dates.map((date) => date.getTime()))) : new Date();
};

const runPython = (python) => {
    const result = spawnSync('python3', ['-'], {
        input: python,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 30
    });
    if (result.status !== 0) {
        throw new Error(result.stderr || result.stdout || `python_exit_${result.status}`);
    }
    return JSON.parse(result.stdout || '{}');
};

const readAdminLeads = () => runPython(`
import sqlite3, json
db_path = ${JSON.stringify(ADMIN_DB_EC)}
con = sqlite3.connect(db_path)
con.row_factory = sqlite3.Row
rows = con.execute("""
    SELECT id, name, phone, phone_e164, status, event_id, created_at, updated_at
    FROM leads
""").fetchall()
con.close()
print(json.dumps({"ok": True, "count": len(rows), "leads": [dict(row) for row in rows]}, ensure_ascii=False))
`);

const mapStatus = ({ draftStatus = '', humanMode = '' } = {}) => {
    const value = String(draftStatus || '').trim().toLowerCase().replace(/-/g, '_');
    if (['entregue', 'delivered'].includes(value)) return 'entregue';
    if (['pedido_enviado', 'enviado', 'processing', 'shipped'].includes(value)) return 'pedido_enviado';
    if (['confirmado', 'confirmed'].includes(value)) return 'confirmado';
    if (['comprar_depois', 'buy_later'].includes(value)) return 'comprar_depois';
    if (['cancelado', 'cancelled', 'canceled'].includes(value)) return 'cancelado';
    if (['devolvido', 'returned'].includes(value)) return 'devolvido';
    if (value === 'recompra') return 'recompra';
    if (value === 'atendendo' || humanMode === 'manual') return 'atendendo';
    return 'novo';
};

const knownSessionsForState = (state = {}) => [
    state.metadata?.lastSessionId,
    state.metadata?.senderWallet?.assignedSessionId,
    ...(Array.isArray(state.metadata?.senderWallet?.seenSessions) ? state.metadata.senderWallet.seenSessions : []),
    state.metadata?.sessionContinuity?.lastInboundSessionId,
    state.metadata?.sessionContinuity?.lastOutboundSessionId
].map(digitsOnly).filter(Boolean);

const hasOfficialSession = (state = {}) => knownSessionsForState(state)
    .some((sessionId) => OFFICIAL_SESSIONS.includes(sessionId));

const messageEntryDateForPhone = async (phone) => {
    const tail = phoneTail(phone);
    if (!tail) return null;
    const message = await Message.findOne({
        $or: [
            { peerPhone: phone },
            { peerPhone: { $regex: `${tail}$` } },
            { chatId: { $regex: tail } },
            { from: { $regex: tail } },
            { to: { $regex: tail } }
        ]
    }).sort({ createdAt: 1 }).select('createdAt').lean();
    return message?.createdAt || null;
};

const buildCandidate = async (state) => {
    const draft = state.metadata?.customerDraft || {};
    const phone = normalizeEcPhone(
        draft.phone
        || state.phoneDigits
        || state.metadata?.customerPhoneDigits
        || state.metadata?.lastSenderPn
        || state.chatId
    );
    if (!validEcPhone(phone)) return null;
    if (state.metadata?.testOnly || state.metadata?.outboundTestOnly || state.metadata?.operationalPanelPhone) return null;

    const messageEntryAt = await messageEntryDateForPhone(phone);
    const entryAt = earliestDate(
        state.createdAt,
        state.firstInboundAt,
        draft.entryAt,
        draft.createdAt,
        draft.updatedAt,
        state.metadata?.firstSeenAt,
        messageEntryAt
    );
    const status = mapStatus({ draftStatus: draft.status, humanMode: state.human?.mode });
    return {
        phone,
        tail: phoneTail(phone),
        name: String(draft.name || state.metadata?.profileName || '').trim(),
        address: String(draft.address || '').trim(),
        city: String(draft.city || '').trim(),
        province: String(draft.province || '').trim(),
        product_qty: normalizePackageQuantity(draft.quantity),
        product_value: Number(draft.total || 0) || 0,
        status,
        entryAt: entryAt.toISOString(),
        lastActivityAt: parseDate(state.updatedAt)?.toISOString() || '',
        sessions: knownSessionsForState(state),
        hasOfficialSession: hasOfficialSession(state),
        sourceStateId: String(state._id)
    };
};

const insertCandidates = (items) => runPython(`
import sqlite3, json
db_path = ${JSON.stringify(ADMIN_DB_EC)}
items = json.loads(${JSON.stringify(JSON.stringify(items))})
con = sqlite3.connect(db_path)
cur = con.cursor()
cols = {row[1] for row in cur.execute("PRAGMA table_info(leads)").fetchall()}
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
cur.execute("""
    CREATE TABLE IF NOT EXISTS lead_activity_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lead_id INTEGER NOT NULL,
        activity_type TEXT,
        detail TEXT,
        created_at TEXT
    )
""")

def digits(value):
    return ''.join(ch for ch in str(value or '') if ch.isdigit())

def tail(value):
    return digits(value)[-9:]

existing = set()
for row in cur.execute("SELECT phone, phone_e164 FROM leads").fetchall():
    t = tail(row[1] or row[0])
    if t:
        existing.add(t)

created = []
skipped = []
for item in items:
    phone = item.get("phone") or ""
    t = tail(phone)
    if not t or t in existing:
        skipped.append({"phone": phone, "reason": "already_exists"})
        continue
    entry_at = item.get("entryAt") or item.get("lastActivityAt") or ""
    fields = {
        "name": item.get("name") or "",
        "phone": "+" + phone,
        "phone_e164": "+" + phone,
        "address": item.get("address") or "",
        "city": item.get("city") or "",
        "province": item.get("province") or "",
        "product_qty": item.get("product_qty") or "0",
        "product_value": item.get("product_value") or 0,
        "status": item.get("status") or "novo",
        "country": "EC",
        "created_at": entry_at,
        "updated_at": entry_at,
        "notes": "Cadastro mestre criado por varredura WhatsApp; data original preservada; nao e pedido novo. ContactState=" + (item.get("sourceStateId") or "")
    }
    fields = {k: v for k, v in fields.items() if k in cols}
    keys = list(fields.keys())
    cur.execute(
        "INSERT INTO leads (" + ",".join(keys) + ") VALUES (" + ",".join(["?"] * len(keys)) + ")",
        [fields[k] for k in keys]
    )
    lead_id = cur.lastrowid
    if "event_id" in cols:
        event_id = "EC-ADMIN-" + str(lead_id)
        cur.execute("UPDATE leads SET event_id=? WHERE id=?", (event_id, lead_id))
    status = fields.get("status", "novo")
    if status and status != "novo":
        cur.execute(
            "INSERT INTO lead_status_history (lead_id, old_status, new_status, action, created_at) VALUES (?, ?, ?, ?, ?)",
            (lead_id, "", status, "whatsapp_missing_admin_sweep", entry_at)
        )
    cur.execute(
        "INSERT INTO lead_activity_history (lead_id, activity_type, detail, created_at) VALUES (?, ?, ?, ?)",
        (lead_id, "whatsapp_missing_admin_sweep", "Criado a partir de contato WhatsApp sem ficha no Painel Unificado", entry_at)
    )
    existing.add(t)
    created.append({"leadId": lead_id, "phone": phone, "status": status, "entryAt": entry_at})

con.commit()
changed = con.total_changes
con.close()
print(json.dumps({"ok": True, "created": len(created), "createdItems": created, "skipped": skipped, "changed": changed}, ensure_ascii=False))
`);

const main = async () => {
    const admin = readAdminLeads();
    if (!admin.ok || !Number.isFinite(admin.count) || admin.count < 100) {
        throw new Error(`Leitura insegura do Painel Unificado: ${JSON.stringify({ ok: admin.ok, count: admin.count })}`);
    }
    const adminTails = new Set((admin.leads || [])
        .map((lead) => phoneTail(lead.phone_e164 || lead.phone))
        .filter(Boolean));

    await mongoose.connect(process.env.MONGODB_URI);
    const states = await ContactState.find({ countryCode: 'EC' })
        .select('chatId phoneDigits firstInboundAt createdAt updatedAt human tags metadata')
        .lean();

    const candidates = [];
    for (const state of states) {
        const candidate = await buildCandidate(state);
        if (!candidate) continue;
        if (adminTails.has(candidate.tail)) continue;
        if (!includeUnknownSessions && !candidate.hasOfficialSession) continue;
        candidates.push(candidate);
    }
    candidates.sort((a, b) => new Date(a.entryAt) - new Date(b.entryAt));
    const selected = Number.isFinite(limit) && limit > 0 ? candidates.slice(0, limit) : candidates;
    const summary = {
        ok: true,
        mode: apply ? 'apply' : 'dry_run',
        adminLeads: admin.count,
        scannedContactStates: states.length,
        missingCandidates: candidates.length,
        selected: selected.length,
        includeUnknownSessions,
        samples: selected.slice(0, 25).map(({ phone, name, status, entryAt, lastActivityAt, sessions }) => ({
            phone,
            name,
            status,
            entryAt,
            lastActivityAt,
            sessions
        }))
    };

    if (apply && selected.length) {
        summary.applyResult = insertCandidates(selected);
    }

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
