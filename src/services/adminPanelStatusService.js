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

const normalizeAdminStatus = ({ status, shippingStatus } = {}) => {
    const shipping = String(shippingStatus || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toUpperCase();
    if (/ENTREGAD[OA]/.test(shipping)) return 'entregue';
    if (/DEVUELT[OA]|DEVOLUCION/.test(shipping)) return 'devolvido';
    if (/GUIA|RUTA|REPARTO|DESPACHO|BODEGA|AGENCIA|PENDIENTE/.test(shipping)) return ADMIN_STATUS;

    const value = String(status || '').trim().toLowerCase();
    if (value === 'delivered') return 'entregue';
    if (value === 'returned') return 'devolvido';
    if (value === 'cancelled') return 'cancelado';
    if (value === 'shipped') return 'enviado';
    if (value === 'processing') return ADMIN_STATUS;
    if (value === 'confirmed') return 'confirmado';
    if (value === 'atendendo' || value === 'manual' || value === 'in_service') return ADMIN_STATUS_ATENDENDO;
    return 'novo';
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

export const syncOrderToOnlineAdminPanel = (order, { status, action = 'order_sync' } = {}) => {
    if (!order || process.env.ONLINE_ADMIN_PANEL_SYNC_ENABLED === 'false') {
        return { ok: false, skipped: true, reason: 'disabled_or_missing_order' };
    }

    const country = String(order.country || 'EC').trim().toUpperCase();
    const dbPath = resolveAdminDbPath(country);
    if (!dbPath) return { ok: false, skipped: true, reason: 'unsupported_country' };

    const quantity = Number(order.package?.quantity || order.package?.id || 1) || 1;
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
    "product_qty": payload.get("product_qty", 1),
    "product_value": payload.get("product_value", 0),
    "status": payload.get("status", "novo"),
    "country": payload.get("country", "EC"),
    "updated_at": now,
    "event_id": payload.get("order_id", ""),
    "phone_e164": payload.get("phone", ""),
    "notes": build_notes(existing[2] if existing else "")
}
for k, v in payload.get("tracking", {}).items():
    fields[k] = v
fields = {k: v for k, v in fields.items() if k in cols}
protected_statuses = {"confirmado", "pedido_enviado", "enviado", "entregue", "devolvido", "cancelado"}
soft_statuses = {"novo", "atendendo"}

if existing:
    lead_id, old_status, _old_notes = existing
    if "status" in fields and str(old_status or "").lower() in protected_statuses and str(fields.get("status") or "").lower() in soft_statuses:
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

if {"lead_id", "action", "old_value", "new_value", "created_at"}.issubset(hist_cols):
    cur.execute(
        "INSERT INTO lead_history (lead_id, action, old_value, new_value, created_at) VALUES (?, ?, ?, ?, ?)",
        (lead_id, payload.get("action", "order_sync"), str(old_status or ""), payload.get("status", "novo"), now)
    )
con.commit()
changed = con.total_changes
con.close()
print(json.dumps({"ok": True, "mode": mode, "lead_id": lead_id, "status": payload.get("status"), "changed": changed}))
`;

    return runAdminPanelPython({ country, python });
};

export const syncContactDraftToOnlineAdminPanel = (draft = {}, { country = 'EC', note = '', action = 'contact_draft_sync', adminStatus = '' } = {}) => {
    if (!draft || process.env.ONLINE_ADMIN_PANEL_SYNC_ENABLED === 'false') {
        return { ok: false, skipped: true, reason: 'disabled_or_missing_draft' };
    }

    const normalizedCountry = String(country || 'EC').trim().toUpperCase();
    const phoneDigits = digitsOnly(draft.phone || '');
    if (normalizedCountry === 'BR' || phoneDigits.startsWith('55')) {
        return { ok: false, skipped: true, reason: 'brazil_test_only' };
    }
    const dbPath = resolveAdminDbPath(normalizedCountry);
    if (!dbPath) return { ok: false, skipped: true, reason: 'unsupported_country' };

    const contactKey = phoneDigits
        ? `${normalizedCountry}-PANEL-${phoneDigits.slice(-9)}`
        : `${normalizedCountry}-PANEL-${String(draft.name || 'CLIENTE').trim().replace(/[^A-Za-z0-9]+/g, '-').slice(0, 32).toUpperCase() || 'CLIENTE'}`;
    const payload = {
        country: normalizedCountry,
        event_id: contactKey,
        name: String(draft.name || '').trim(),
        phone: String(draft.phone || '').trim(),
        phone_digits: phoneDigits,
        address: String(draft.address || '').trim(),
        city: String(draft.city || '').trim(),
        province: String(draft.province || '').trim(),
        product_qty: Number(draft.quantity || 0) || 1,
        product_value: Number(draft.total || 0) || 0,
        status: adminStatus || normalizeAdminStatus({ status: draft.status || 'draft' }),
        notes: String(note || '').trim(),
        action,
        db_path: dbPath
    };

    if (!payload.name && !payload.phone_digits) {
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
    if payload.get("name") and "name" in cols:
        row = cur.execute("SELECT id, status, notes FROM leads WHERE lower(name)=lower(?) AND COALESCE(country, ?) = ? ORDER BY id DESC LIMIT 1", (payload["name"], payload.get("country") or "EC", payload.get("country") or "EC")).fetchone()
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
    "product_qty": payload.get("product_qty", 1),
    "product_value": payload.get("product_value", 0),
    "status": payload.get("status", "novo"),
    "country": payload.get("country", "EC"),
    "updated_at": now,
    "event_id": payload.get("event_id", ""),
    "phone_e164": payload.get("phone", ""),
    "notes": build_notes(existing[2] if existing else "")
}
fields = {k: v for k, v in fields.items() if k in cols}
protected_statuses = {"confirmado", "pedido_enviado", "enviado", "entregue", "devolvido", "cancelado"}
soft_statuses = {"novo", "atendendo"}

if existing:
    lead_id, old_status, _old_notes = existing
    if "status" in fields and str(old_status or "").lower() in protected_statuses and str(fields.get("status") or "").lower() in soft_statuses:
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

if {"lead_id", "action", "old_value", "new_value", "created_at"}.issubset(hist_cols):
    cur.execute(
        "INSERT INTO lead_history (lead_id, action, old_value, new_value, created_at) VALUES (?, ?, ?, ?, ?)",
        (lead_id, payload.get("action", "contact_draft_sync"), str(old_status or ""), payload.get("status", "novo"), now)
    )
con.commit()
changed = con.total_changes
con.close()
print(json.dumps({"ok": True, "mode": mode, "lead_id": lead_id, "status": payload.get("status"), "changed": changed}))
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
import sqlite3, json
db_path = ${JSON.stringify(dbPath)}
lead_id = int(${JSON.stringify(leadId)})
status = ${JSON.stringify(ADMIN_STATUS)}
con = sqlite3.connect(db_path)
cur = con.cursor()
cur.execute("UPDATE leads SET status=? WHERE id=?", (status, lead_id))
con.commit()
changed = con.total_changes
con.close()
print(json.dumps({"ok": True, "lead_id": lead_id, "status": status, "changed": changed}))
`;

    return runAdminPanelPython({ country, python });
};
