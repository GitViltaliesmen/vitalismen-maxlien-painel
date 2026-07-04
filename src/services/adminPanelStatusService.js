import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const ADMIN_STATUS = 'pedido_enviado';
const ADMIN_STATUS_ATENDENDO = 'atendendo';

const resolveAdminDbPath = (country) => {
    const normalized = String(country || '').trim().toUpperCase();
    if (normalized === 'EC') return '/opt/maxlien-mvp/leads_ec.sqlite3';
    if (normalized === 'CO') return '/opt/maxlien-mvp/leads_co.sqlite3';
    return '';
};

const resolveAdminLeadId = (orderId) => {
    const match = String(orderId || '').match(/^[A-Z]{2}-ADMIN-(\d+)$/i);
    return match ? match[1] : '';
};

const digitsOnly = (value) => String(value || '').replace(/\D/g, '');

const normalizePanelPhoneDigits = (phone = '', country = 'EC') => {
    const digits = digitsOnly(phone);
    const normalizedCountry = String(country || 'EC').trim().toUpperCase();
    if (normalizedCountry === 'EC') {
        if (digits.startsWith('593')) return digits;
        if (digits.startsWith('09') && digits.length === 10) return `593${digits.slice(1)}`;
        if (digits.startsWith('9') && digits.length === 9) return `593${digits}`;
    }
    if (normalizedCountry === 'CO') {
        if (digits.startsWith('57')) return digits;
        if (digits.startsWith('3') && digits.length === 10) return `57${digits}`;
    }
    return digits;
};

const isSupportedClientPhone = (phone = '', country = 'EC') => {
    const normalizedCountry = String(country || 'EC').trim().toUpperCase();
    const digits = normalizePanelPhoneDigits(phone, normalizedCountry);
    if (normalizedCountry === 'EC') return /^5939\d{8}$/.test(digits);
    if (normalizedCountry === 'CO') return /^573\d{9}$/.test(digits);
    return false;
};

const normalizeAdminStatus = ({ status, shippingStatus } = {}) => {
    const shipping = String(shippingStatus || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toUpperCase();
    if (/ENTREGAD[OA]/.test(shipping)) return 'entregue';
    if (/DEVUELT[OA]|DEVOLUCION/.test(shipping)) return 'devolvido';
    if (/GUIA|RUTA|REPARTO|DESPACHO|BODEGA|AGENCIA|PENDIENTE/.test(shipping)) return ADMIN_STATUS;

    const value = String(status || '').trim().toLowerCase().replace(/-/g, '_');
    if (['novo', 'comprar_depois', 'confirmado', 'pedido_enviado', 'entregue', 'recompra', 'cancelado', 'devolvido'].includes(value)) {
        return value;
    }
    if (value === 'delivered') return 'entregue';
    if (value === 'returned') return 'devolvido';
    if (value === 'cancelled') return 'cancelado';
    if (value === 'canceled') return 'cancelado';
    if (value === 'finalizado') return 'finalizado';
    if (value === 'conferir_pedidos') return 'conferir_pedidos';
    if (value === 'shipped') return ADMIN_STATUS;
    if (value === 'processing') return ADMIN_STATUS;
    if (value === 'confirmed') return 'confirmado';
    if (value === 'atendendo' || value === 'manual' || value === 'in_service') return ADMIN_STATUS_ATENDENDO;
    return 'novo';
};

const VALID_ADMIN_PACKAGE_QUANTITIES = new Set([1, 3, 6]);

const normalizeAdminPackageQuantity = (value) => {
    const parsed = Number.parseInt(String(value ?? '').trim(), 10);
    return VALID_ADMIN_PACKAGE_QUANTITIES.has(parsed) ? parsed : 0;
};

const isArchivedDuplicateOrder = (order) => {
    const reviewQueue = order?.reviewQueue || {};
    const text = [
        reviewQueue.reason,
        reviewQueue.evidence,
        order?.notes
    ].map((item) => String(item || '').toLowerCase()).join(' ');
    return reviewQueue.status === 'finalizado'
        && /duplicad|duplicate/.test(text);
};

const runAdminPanelPython = ({ country, python }) => {
    const dbPath = resolveAdminDbPath(country);
    if (!dbPath) return { ok: false, skipped: true, reason: 'unsupported_country' };

    if (fs.existsSync(dbPath)) {
        const result = spawnSync('python3', ['-'], {
            input: python,
            encoding: 'utf8',
            maxBuffer: 1024 * 1024
        });
        if (result.status !== 0) {
            return {
                ok: false,
                reason: 'local_update_failed',
                error: result.stderr || result.stdout || `exit_${result.status}`
            };
        }
        try {
            return JSON.parse(result.stdout || '{}');
        } catch (error) {
            return { ok: false, reason: 'invalid_local_update_response', error: error.message };
        }
    }

    const keyPath = path.join(os.homedir(), '.ssh', 'vps_auditoria_codex');
    if (!fs.existsSync(keyPath)) return { ok: false, skipped: true, reason: 'admin_db_and_ssh_key_not_found' };

    const result = spawnSync(
        'ssh',
        [
            '-i',
            keyPath,
            '-o',
            'BatchMode=yes',
            '-o',
            'ConnectTimeout=10',
            'root@maxlien.shop',
            'python3',
            '-'
        ],
        { input: python, encoding: 'utf8', maxBuffer: 1024 * 1024 }
    );

    if (result.status !== 0) {
        return {
            ok: false,
            reason: 'ssh_update_failed',
            error: result.stderr || result.stdout || `exit_${result.status}`
        };
    }

    try {
        return JSON.parse(result.stdout || '{}');
    } catch (error) {
        return { ok: false, reason: 'invalid_update_response', error: error.message };
    }
};

export const listOnlineAdminLeadsByWindow = ({ country = 'EC', fromDate = null, toDate = null, statuses = [], limit = 800 } = {}) => {
    const normalizedCountry = String(country || 'EC').trim().toUpperCase();
    const dbPath = resolveAdminDbPath(normalizedCountry);
    if (!dbPath) return { ok: false, skipped: true, reason: 'unsupported_country', leads: [] };

    const payload = {
        country: normalizedCountry,
        fromDate: fromDate ? new Date(fromDate).toISOString() : '',
        toDate: toDate ? new Date(toDate).toISOString() : '',
        statuses: Array.isArray(statuses) ? statuses.map((item) => String(item || '').trim()).filter(Boolean) : [],
        limit: Math.max(1, Math.min(Number.parseInt(String(limit || 800), 10) || 800, 5000)),
        db_path: dbPath
    };

    const python = `
import sqlite3, json, datetime
payload = ${JSON.stringify(payload)}
db_path = payload["db_path"]
country = str(payload.get("country") or "EC").upper()
limit = int(payload.get("limit") or 800)
statuses = [str(item).strip().lower() for item in payload.get("statuses") or [] if str(item).strip()]
from_date = payload.get("fromDate") or ""
to_date = payload.get("toDate") or ""

def parse_dt(value):
    if not value:
        return None
    text = str(value).replace("Z", "+00:00")
    try:
        return datetime.datetime.fromisoformat(text)
    except Exception:
        try:
            return datetime.datetime.strptime(str(value)[:19], "%Y-%m-%dT%H:%M:%S")
        except Exception:
            return None

start = parse_dt(from_date)
end = parse_dt(to_date)

con = sqlite3.connect(db_path)
con.row_factory = sqlite3.Row
cur = con.cursor()
cols = {row[1] for row in cur.execute("PRAGMA table_info(leads)").fetchall()}
date_col = "updated_at" if "updated_at" in cols else ("created_at" if "created_at" in cols else "")
where = []
params = []
if "country" in cols:
    where.append("COALESCE(country, ?) = ?")
    params.extend([country, country])
if statuses and "status" in cols:
    where.append("LOWER(COALESCE(status, '')) IN (" + ",".join(["?"] * len(statuses)) + ")")
    params.extend(statuses)
if date_col and start:
    where.append(f"COALESCE({date_col}, created_at, '') >= ?")
    params.append(start.isoformat())
if date_col and end:
    where.append(f"COALESCE({date_col}, created_at, '') <= ?")
    params.append(end.isoformat())

select_cols = [
    "id", "name", "phone", "phone_e164", "address", "city", "province",
    "reference", "product_qty", "product_value", "status", "event_id",
    "created_at", "updated_at", "notes"
]
available = [col for col in select_cols if col in cols]
sql = "SELECT " + ",".join(available or ["id"]) + " FROM leads"
if where:
    sql += " WHERE " + " AND ".join(where)
if date_col:
    sql += f" ORDER BY COALESCE({date_col}, created_at, '') DESC"
else:
    sql += " ORDER BY id DESC"
sql += " LIMIT ?"
params.append(limit)

def digits(value):
    return "".join(ch for ch in str(value or "") if ch.isdigit())

leads = []
for row in cur.execute(sql, params).fetchall():
    data = dict(row)
    lead_id = str(data.get("id") or "").strip()
    leads.append({
        "id": lead_id,
        "orderId": (data.get("event_id") or (country + "-ADMIN-" + lead_id)),
        "country": country,
        "name": data.get("name") or "",
        "phone": data.get("phone_e164") or data.get("phone") or "",
        "phoneDigits": digits(data.get("phone_e164") or data.get("phone") or ""),
        "address": data.get("address") or "",
        "city": data.get("city") or "",
        "province": data.get("province") or "",
        "reference": data.get("reference") or "",
        "quantity": data.get("product_qty", 0) or 0,
        "total": data.get("product_value", 0) or 0,
        "status": data.get("status") or "",
        "rawStatus": data.get("status") or "",
        "createdAt": data.get("created_at") or "",
        "updatedAt": data.get("updated_at") or data.get("created_at") or "",
        "notes": data.get("notes") or ""
    })
con.close()
print(json.dumps({"ok": True, "source": "sqlite_or_ssh", "count": len(leads), "leads": leads}, ensure_ascii=False))
`;

    const result = runAdminPanelPython({ country: normalizedCountry, python });
    return {
        ok: Boolean(result.ok),
        source: result.source || 'sqlite_or_ssh',
        count: Number(result.count || 0),
        leads: Array.isArray(result.leads) ? result.leads : [],
        reason: result.reason || result.error || ''
    };
};

export const syncOrderToOnlineAdminPanel = (order, { status, action = 'order_sync' } = {}) => {
    if (!order || process.env.ONLINE_ADMIN_PANEL_SYNC_ENABLED === 'false') {
        return { ok: false, skipped: true, reason: 'disabled_or_missing_order' };
    }
    if (isArchivedDuplicateOrder(order)) {
        return { ok: false, skipped: true, reason: 'archived_duplicate_order' };
    }

    const country = String(order.country || 'EC').trim().toUpperCase();
    const dbPath = resolveAdminDbPath(country);
    if (!dbPath) return { ok: false, skipped: true, reason: 'unsupported_country' };

    const quantity = normalizeAdminPackageQuantity(order.package?.quantity ?? order.package?.id);
    const payload = {
        order_id: String(order.orderId || '').trim(),
        admin_lead_id: resolveAdminLeadId(order.orderId),
        country,
        name: String(order.customer?.name || '').trim(),
        phone: String(order.customer?.phone || '').trim(),
        phone_digits: digitsOnly(order.customer?.phone || ''),
        address: String(order.customer?.address || '').trim(),
        city: String(order.customer?.city || '').trim(),
        province: String(order.customer?.province || '').trim(),
        product_qty: quantity,
        product_value: Number(order.total || 0) || 0,
        buy_later_followup_at: order.purchaseIntent?.followUpAt || '',
        status: normalizeAdminStatus({
            status: status || order.status,
            shippingStatus: order.shippingStatus
        }),
        notes: String(order.notes || '').trim(),
        action,
        db_path: dbPath,
        tracking: {
            fbp: order.tracking?.fbp || '',
            fbc: order.tracking?.fbc || '',
            fbclid: order.tracking?.fbclid || '',
            utm_source: order.tracking?.utm_source || '',
            utm_campaign: order.tracking?.utm_campaign || '',
            utm_content: order.tracking?.utm_content || '',
            client_ip_address: order.tracking?.ip || '',
            client_user_agent: order.tracking?.userAgent || '',
            event_source_url: order.tracking?.sourceUrl || ''
        }
    };

    if (!payload.order_id || (!payload.name && !payload.phone)) {
        return { ok: false, skipped: true, reason: 'missing_order_identity' };
    }

    const python = `
import sqlite3, json, datetime
payload = ${JSON.stringify(payload)}
db_path = payload["db_path"]
now = datetime.datetime.now(datetime.timezone.utc).isoformat()

con = sqlite3.connect(db_path)
cur = con.cursor()
cols = {row[1] for row in cur.execute("PRAGMA table_info(leads)").fetchall()}
hist_cols = {row[1] for row in cur.execute("PRAGMA table_info(lead_history)").fetchall()}
status_hist_cols = {row[1] for row in cur.execute("PRAGMA table_info(lead_status_history)").fetchall()}

def canonical_event_id(country, lead_id):
    return (str(country or "EC").strip().upper() or "EC") + "-ADMIN-" + str(int(lead_id))

def pick_existing():
    if payload.get("admin_lead_id"):
        row = cur.execute("SELECT id, status, notes FROM leads WHERE id=?", (int(payload["admin_lead_id"]),)).fetchone()
        if row: return row
    if "event_id" in cols and payload.get("order_id"):
        row = cur.execute("SELECT id, status, notes FROM leads WHERE event_id=?", (payload["order_id"],)).fetchone()
        if row: return row
    if "notes" in cols and payload.get("order_id"):
        row = cur.execute("SELECT id, status, notes FROM leads WHERE notes LIKE ? ORDER BY id DESC LIMIT 1", ("%"+payload["order_id"]+"%",)).fetchone()
        if row: return row
    tail = str(payload.get("phone_digits") or "")[-9:]
    if tail:
        pieces = []
        params = []
        if "phone_e164" in cols:
            pieces.append("replace(replace(replace(phone_e164,'+',''),' ',''),'-','') LIKE ?")
            params.append("%"+tail)
        if "phone" in cols:
            pieces.append("replace(replace(replace(phone,'+',''),' ',''),'-','') LIKE ?")
            params.append("%"+tail)
        if pieces:
            country = payload.get("country") or "EC"
            row = cur.execute(
                "SELECT id, status, notes FROM leads WHERE (" + " OR ".join(pieces) + ") AND COALESCE(country, ?) = ? ORDER BY id DESC LIMIT 1",
                params + [country, country]
            ).fetchone()
            if row: return row
    return None

def build_notes(existing_notes=""):
    base = str(existing_notes or payload.get("notes") or "").strip()
    marker = "Pedido automacao: " + payload.get("order_id", "")
    detail = marker + " | " + payload.get("action", "order_sync")
    if marker and marker in base:
        return base
    return (base + "\\n" + detail).strip() if base else detail

existing = pick_existing()
fields = {
    "name": payload.get("name", ""),
    "phone": payload.get("phone", ""),
    "address": payload.get("address", ""),
    "city": payload.get("city", ""),
    "province": payload.get("province", ""),
    "product_qty": payload.get("product_qty", 0),
    "product_value": payload.get("product_value", 0),
    "status": payload.get("status", "novo"),
    "country": payload.get("country", "EC"),
    "updated_at": now,
    "event_id": payload.get("order_id", ""),
    "phone_e164": payload.get("phone", ""),
    "notes": build_notes(existing[2] if existing else "")
}
if payload.get("buy_later_followup_at"):
    fields["buy_later_followup_at"] = payload.get("buy_later_followup_at")
for k, v in payload.get("tracking", {}).items():
    fields[k] = v
fields = {k: v for k, v in fields.items() if k in cols}
protected_statuses = {"comprar_depois", "confirmado", "pedido_enviado", "enviado", "entregue", "recompra", "devolvido", "cancelado", "conferir_pedidos"}
archived_statuses = {"finalizado"}
soft_statuses = {"novo", "atendendo"}
status_rank = {
    "novo": 0,
    "atendendo": 1,
    "comprar_depois": 2,
    "confirmado": 3,
    "pedido_enviado": 4,
    "enviado": 4,
    "entregue": 5,
    "devolvido": 5,
    "cancelado": 5,
    "recompra": 6,
    "conferir_pedidos": 7,
    "finalizado": 8
}

def should_keep_existing_status(old_status, incoming_status):
    old = str(old_status or "").strip().lower()
    new = str(incoming_status or "").strip().lower()
    if not old or not new or old == new:
        return False
    if old in archived_statuses:
        return True
    if old == "conferir_pedidos" and new in {"entregue", "devolvido", "cancelado"}:
        return False
    if old in protected_statuses and new in soft_statuses:
        return True
    return status_rank.get(old, -1) > status_rank.get(new, -1)

if existing:
    lead_id, old_status, _old_notes = existing
    fields.pop("updated_at", None)
    for blank_safe_key in ["name", "address", "city", "province"]:
        if blank_safe_key in fields and not str(fields.get(blank_safe_key) or "").strip():
            fields.pop(blank_safe_key, None)
    if "product_value" in fields and not float(fields.get("product_value") or 0):
        fields.pop("product_value", None)
    if "status" in fields and should_keep_existing_status(old_status, fields.get("status")):
        fields["status"] = old_status
    assignments = ", ".join([f"{k}=?" for k in fields])
    cur.execute(f"UPDATE leads SET {assignments} WHERE id=?", list(fields.values()) + [lead_id])
    mode = "updated"
else:
    if "created_at" in cols:
        fields["created_at"] = now
    keys = list(fields.keys())
    cur.execute(
        "INSERT INTO leads (" + ",".join(keys) + ") VALUES (" + ",".join(["?"] * len(keys)) + ")",
        [fields[k] for k in keys]
    )
    lead_id = cur.lastrowid
    old_status = ""
    mode = "created"

if "event_id" in cols:
    canonical_id = canonical_event_id(payload.get("country") or "EC", lead_id)
    if fields.get("event_id") != canonical_id:
        cur.execute("UPDATE leads SET event_id=? WHERE id=?", (canonical_id, lead_id))
        fields["event_id"] = canonical_id

if {"lead_id", "action", "old_value", "new_value", "created_at"}.issubset(hist_cols):
    final_status = fields.get("status", payload.get("status", "novo"))
    cur.execute(
        "INSERT INTO lead_history (lead_id, action, old_value, new_value, created_at) VALUES (?, ?, ?, ?, ?)",
        (lead_id, payload.get("action", "order_sync"), str(old_status or ""), final_status, now)
    )
if {"lead_id", "old_status", "new_status", "created_at"}.issubset(status_hist_cols):
    new_status = fields.get("status", payload.get("status", "novo"))
    if str(old_status or "") != str(new_status or ""):
        cur.execute(
            "INSERT INTO lead_status_history (lead_id, old_status, new_status, created_at) VALUES (?, ?, ?, ?)",
            (lead_id, str(old_status or ""), str(new_status or ""), now)
        )
con.commit()
changed = con.total_changes
con.close()
print(json.dumps({"ok": True, "mode": mode, "lead_id": lead_id, "status": fields.get("status", payload.get("status")), "changed": changed}))
`;

    return runAdminPanelPython({ country, python });
};

export const syncContactDraftToOnlineAdminPanel = (draft = {}, { country = 'EC', note = '', action = 'contact_draft_sync', adminStatus = '' } = {}) => {
    if (!draft || process.env.ONLINE_ADMIN_PANEL_SYNC_ENABLED === 'false') {
        return { ok: false, skipped: true, reason: 'disabled_or_missing_draft' };
    }

    const normalizedCountry = String(country || 'EC').trim().toUpperCase();
    const phoneDigits = normalizePanelPhoneDigits(draft.phone || '', normalizedCountry);
    if (normalizedCountry === 'BR' || phoneDigits.startsWith('55')) {
        return { ok: false, skipped: true, reason: 'brazil_test_only' };
    }
    const dbPath = resolveAdminDbPath(normalizedCountry);
    if (!dbPath) return { ok: false, skipped: true, reason: 'unsupported_country' };
    if (!isSupportedClientPhone(phoneDigits, normalizedCountry)) {
        return { ok: false, skipped: true, reason: 'invalid_client_phone' };
    }

    const payload = {
        country: normalizedCountry,
        event_id: '',
        name: String(draft.name || '').trim(),
        phone: phoneDigits ? `+${phoneDigits}` : String(draft.phone || '').trim(),
        phone_digits: phoneDigits,
        address: String(draft.address || '').trim(),
        city: String(draft.city || '').trim(),
        province: String(draft.province || '').trim(),
        product_qty: normalizeAdminPackageQuantity(draft.quantity),
        product_value: Number(draft.total || 0) || 0,
        buy_later_followup_at: draft.buyLaterFollowupAt || draft.buy_later_followup_at || '',
        status: adminStatus || normalizeAdminStatus({ status: draft.status || 'draft' }),
        notes: String(note || '').trim(),
        action,
        db_path: dbPath
    };

    if (!payload.phone_digits) {
        return { ok: false, skipped: true, reason: 'missing_contact_identity' };
    }

    const python = `
import sqlite3, json, datetime
payload = ${JSON.stringify(payload)}
db_path = payload["db_path"]
now = datetime.datetime.now(datetime.timezone.utc).isoformat()

con = sqlite3.connect(db_path)
cur = con.cursor()
cols = {row[1] for row in cur.execute("PRAGMA table_info(leads)").fetchall()}
hist_cols = {row[1] for row in cur.execute("PRAGMA table_info(lead_history)").fetchall()}
status_hist_cols = {row[1] for row in cur.execute("PRAGMA table_info(lead_status_history)").fetchall()}

def canonical_event_id(country, lead_id):
    return (str(country or "EC").strip().upper() or "EC") + "-ADMIN-" + str(int(lead_id))

def pick_existing():
    tail = str(payload.get("phone_digits") or "")[-9:]
    if tail:
        pieces = []
        params = []
        if "phone_e164" in cols:
            pieces.append("replace(replace(replace(phone_e164,'+',''),' ',''),'-','') LIKE ?")
            params.append("%"+tail)
        if "phone" in cols:
            pieces.append("replace(replace(replace(phone,'+',''),' ',''),'-','') LIKE ?")
            params.append("%"+tail)
        if pieces:
            row = cur.execute(
                "SELECT id, status, notes FROM leads WHERE (" + " OR ".join(pieces) + ") AND COALESCE(country, ?) = ? ORDER BY id DESC LIMIT 1",
                params + [payload.get("country") or "EC", payload.get("country") or "EC"]
            ).fetchone()
            if row: return row
    return None

def build_notes(existing_notes=""):
    base = str(existing_notes or payload.get("notes") or "").strip()
    marker = "Ficha atendimento: " + (payload.get("phone_digits") or payload.get("phone") or payload.get("name") or "")
    detail = marker + " | " + payload.get("action", "contact_draft_sync")
    if marker and marker in base:
        return base
    return (base + "\\n" + detail).strip() if base else detail

existing = pick_existing()
fields = {
    "name": payload.get("name", ""),
    "phone": payload.get("phone", ""),
    "address": payload.get("address", ""),
    "city": payload.get("city", ""),
    "province": payload.get("province", ""),
    "product_qty": payload.get("product_qty", 0),
    "product_value": payload.get("product_value", 0),
    "status": payload.get("status", "novo"),
    "country": payload.get("country", "EC"),
    "updated_at": now,
    "event_id": payload.get("event_id", ""),
    "phone_e164": payload.get("phone", ""),
    "notes": build_notes(existing[2] if existing else "")
}
if payload.get("buy_later_followup_at"):
    fields["buy_later_followup_at"] = payload.get("buy_later_followup_at")
fields = {k: v for k, v in fields.items() if k in cols}
protected_statuses = {"comprar_depois", "confirmado", "pedido_enviado", "enviado", "entregue", "recompra", "devolvido", "cancelado", "conferir_pedidos"}
archived_statuses = {"finalizado"}
soft_statuses = {"novo", "atendendo"}
status_rank = {
    "novo": 0,
    "atendendo": 1,
    "comprar_depois": 2,
    "confirmado": 3,
    "pedido_enviado": 4,
    "enviado": 4,
    "entregue": 5,
    "devolvido": 5,
    "cancelado": 5,
    "recompra": 6,
    "conferir_pedidos": 7,
    "finalizado": 8
}

def should_keep_existing_status(old_status, incoming_status):
    old = str(old_status or "").strip().lower()
    new = str(incoming_status or "").strip().lower()
    if not old or not new or old == new:
        return False
    if old in archived_statuses:
        return True
    if old == "conferir_pedidos" and new in {"entregue", "devolvido", "cancelado"}:
        return False
    if old in protected_statuses and new in soft_statuses:
        return True
    return status_rank.get(old, -1) > status_rank.get(new, -1)

if existing:
    lead_id, old_status, _old_notes = existing
    fields.pop("updated_at", None)
    for blank_safe_key in ["name", "address", "city", "province"]:
        if blank_safe_key in fields and not str(fields.get(blank_safe_key) or "").strip():
            fields.pop(blank_safe_key, None)
    if "product_value" in fields and not float(fields.get("product_value") or 0):
        fields.pop("product_value", None)
    if "status" in fields and should_keep_existing_status(old_status, fields.get("status")):
        fields["status"] = old_status
    assignments = ", ".join([f"{k}=?" for k in fields])
    cur.execute(f"UPDATE leads SET {assignments} WHERE id=?", list(fields.values()) + [lead_id])
    mode = "updated"
else:
    if "created_at" in cols:
        fields["created_at"] = now
    keys = list(fields.keys())
    cur.execute(
        "INSERT INTO leads (" + ",".join(keys) + ") VALUES (" + ",".join(["?"] * len(keys)) + ")",
        [fields[k] for k in keys]
    )
    lead_id = cur.lastrowid
    old_status = ""
    mode = "created"

if "event_id" in cols:
    canonical_id = canonical_event_id(payload.get("country") or "EC", lead_id)
    if fields.get("event_id") != canonical_id:
        cur.execute("UPDATE leads SET event_id=? WHERE id=?", (canonical_id, lead_id))
        fields["event_id"] = canonical_id

if {"lead_id", "action", "old_value", "new_value", "created_at"}.issubset(hist_cols):
    final_status = fields.get("status", payload.get("status", "novo"))
    cur.execute(
        "INSERT INTO lead_history (lead_id, action, old_value, new_value, created_at) VALUES (?, ?, ?, ?, ?)",
        (lead_id, payload.get("action", "contact_draft_sync"), str(old_status or ""), final_status, now)
    )
if {"lead_id", "old_status", "new_status", "created_at"}.issubset(status_hist_cols):
    new_status = fields.get("status", payload.get("status", "novo"))
    if str(old_status or "") != str(new_status or ""):
        cur.execute(
            "INSERT INTO lead_status_history (lead_id, old_status, new_status, created_at) VALUES (?, ?, ?, ?)",
            (lead_id, str(old_status or ""), str(new_status or ""), now)
        )
con.commit()
changed = con.total_changes
con.close()
print(json.dumps({"ok": True, "mode": mode, "lead_id": lead_id, "status": fields.get("status", payload.get("status")), "changed": changed}))
`;

    return runAdminPanelPython({ country: normalizedCountry, python });
};

const safeJsonStringify = (value) => {
    try {
        return JSON.stringify(value || {});
    } catch (_error) {
        return '{}';
    }
};

export const recordOnlineAdminPurchaseLock = ({ order = null, purchase = {}, sourceOrderId = '', country = '' } = {}) => {
    const normalizedCountry = String(country || order?.country || 'EC').trim().toUpperCase();
    const dbPath = resolveAdminDbPath(normalizedCountry);
    if (!dbPath) return { ok: false, skipped: true, reason: 'unsupported_country' };
    if (normalizedCountry !== 'EC') return { ok: false, skipped: true, reason: 'purchase_lock_ec_only' };

    const hintedLeadId = resolveAdminLeadId(sourceOrderId)
        || resolveAdminLeadId(order?.previousOrderId)
        || resolveAdminLeadId(order?.orderId);
    const responsePayload = safeJsonStringify(
        purchase.response
        || order?.tracking?.metaPurchaseResponse
        || {}
    ).slice(0, 20000);
    const payload = {
        db_path: dbPath,
        lead_id: hintedLeadId,
        phone: String(order?.customer?.phone || '').trim(),
        phone_digits: digitsOnly(order?.customer?.phone || ''),
        status: purchase.ok === false ? 'error' : 'sent',
        event_id: String(purchase.eventId || order?.tracking?.metaPurchaseEventId || order?.orderId || '').trim(),
        country: normalizedCountry,
        response_payload: responsePayload,
        error: String(purchase.error || '').slice(0, 1000)
    };

const python = `
import sqlite3, json, datetime
payload = ${JSON.stringify(payload)}
db_path = payload["db_path"]
now = datetime.datetime.now(datetime.timezone.utc).isoformat()

def digits(value):
    return "".join(ch for ch in str(value or "") if ch.isdigit())

def normalized_phone_expr(column):
    return "replace(replace(replace(coalesce(" + column + ", ''), '+',''),' ',''),'-','')"

con = sqlite3.connect(db_path)
con.row_factory = sqlite3.Row
cur = con.cursor()
cur.execute("""
    CREATE TABLE IF NOT EXISTS purchase_capi_lock (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lead_id INTEGER NOT NULL UNIQUE,
        phone TEXT,
        status TEXT NOT NULL,
        created_at TEXT,
        event_id TEXT,
        country TEXT,
        response_payload TEXT,
        error TEXT,
        updated_at TEXT
    )
""")
lead = None
lead_id = str(payload.get("lead_id") or "").strip()
if lead_id.isdigit():
    lead = cur.execute(
        "SELECT id, phone, phone_e164, status FROM leads WHERE id=?",
        (int(lead_id),)
    ).fetchone()

phone_digits = digits(payload.get("phone_digits") or payload.get("phone"))
tail = phone_digits[-9:] if len(phone_digits) >= 9 else ""
if lead is None and tail:
    lead = cur.execute(
        "SELECT id, phone, phone_e164, status FROM leads "
        "WHERE " + normalized_phone_expr("phone_e164") + " LIKE ? "
        "OR " + normalized_phone_expr("phone") + " LIKE ? "
        "ORDER BY COALESCE(updated_at, created_at, '') DESC, id DESC LIMIT 1",
        ("%" + tail, "%" + tail)
    ).fetchone()

if lead is None:
    con.close()
    print(json.dumps({"ok": False, "skipped": True, "reason": "lead_not_found_for_purchase_lock"}))
else:
    lead_id = int(lead["id"])
    phone = payload.get("phone") or lead["phone_e164"] or lead["phone"] or ""
    existing = cur.execute(
        "SELECT id, event_id, status FROM purchase_capi_lock WHERE lead_id=?",
        (lead_id,)
    ).fetchone()
    if existing:
        cur.execute(
            "UPDATE purchase_capi_lock SET phone=?, status=?, event_id=?, country=?, response_payload=?, error=?, updated_at=? WHERE lead_id=?",
            (
                phone,
                payload.get("status") or "sent",
                payload.get("event_id") or existing["event_id"] or "",
                payload.get("country") or "EC",
                payload.get("response_payload") or "",
                payload.get("error") or "",
                now,
                lead_id
            )
        )
        mode = "updated"
    else:
        cur.execute(
            "INSERT INTO purchase_capi_lock (lead_id, phone, status, created_at, event_id, country, response_payload, error, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                lead_id,
                phone,
                payload.get("status") or "sent",
                now,
                payload.get("event_id") or "",
                payload.get("country") or "EC",
                payload.get("response_payload") or "",
                payload.get("error") or "",
                now
            )
        )
        mode = "created"
    con.commit()
    changed = con.total_changes
    con.close()
    print(json.dumps({
        "ok": True,
        "mode": mode,
        "lead_id": lead_id,
        "event_id": payload.get("event_id") or "",
        "status": payload.get("status") or "sent",
        "changed": changed
    }))
`;

    return runAdminPanelPython({ country: normalizedCountry, python });
};

export const markOnlineAdminPedidoEnviado = ({ orderId, country }) => {
    const leadId = resolveAdminLeadId(orderId);
    const dbPath = resolveAdminDbPath(country);
    if (!leadId || !dbPath) {
        return { ok: false, skipped: true, reason: 'not_online_admin_order' };
    }

const python = `
import sqlite3, json, datetime
db_path = ${JSON.stringify(dbPath)}
lead_id = int(${JSON.stringify(leadId)})
status = ${JSON.stringify(ADMIN_STATUS)}
now = datetime.datetime.now(datetime.timezone.utc).isoformat()
con = sqlite3.connect(db_path)
cur = con.cursor()
row = cur.execute("SELECT status FROM leads WHERE id=?", (lead_id,)).fetchone()
old_status = str(row[0] if row else "").strip().lower()
final_statuses = {"entregue", "cancelado", "devolvido", "recompra"}
if old_status in final_statuses:
    status = old_status
else:
    cur.execute("UPDATE leads SET status=? WHERE id=?", (status, lead_id))
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
    if old_status != status:
        cur.execute(
            "INSERT INTO lead_status_history (lead_id, old_status, new_status, action, created_at) VALUES (?, ?, ?, ?, ?)",
            (lead_id, old_status, status, "mark_pedido_enviado", now)
        )
con.commit()
changed = con.total_changes
con.close()
print(json.dumps({"ok": True, "lead_id": lead_id, "status": status, "old_status": old_status, "changed": changed}))
`;

    return runAdminPanelPython({ country, python });
};
