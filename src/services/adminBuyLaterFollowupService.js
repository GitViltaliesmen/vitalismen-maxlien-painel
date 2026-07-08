import { spawnSync } from 'child_process';
import fs from 'fs';
import { sendText } from '../whatsapp/sendText.js';
import { isAutomationRecipientAllowed } from '../whatsapp/automationSafety.js';
import { toWhatsAppChatId } from '../utils/phone.js';

const ADMIN_DB_EC = '/opt/maxlien-mvp/leads_ec.sqlite3';
const digitsOnly = (value) => String(value || '').replace(/\D/g, '');
const parseNumber = (name, fallback) => {
    const parsed = Number.parseInt(String(process.env[name] || ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const runPython = (python) => {
    if (!fs.existsSync(ADMIN_DB_EC)) {
        return { ok: true, skipped: true, reason: 'admin_db_not_found', leads: [] };
    }
    const result = spawnSync('python3', ['-'], {
        input: python,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 5
    });
    if (result.status !== 0) {
        return { ok: false, error: result.stderr || result.stdout || `exit_${result.status}` };
    }
    return JSON.parse(result.stdout || '{}');
};

const buildBuyLaterText = (lead = {}) => {
    const name = String(lead.name || '').trim().split(/\s+/)[0] || 'señor';
    const targetDate = formatTargetDate(lead.buy_later_followup_at || lead.target_at);
    const targetText = targetDate ? ` antes del ${targetDate}` : ' por estas fechas';
    return `Hola ${name}, soy Valeria Zambrano de Vit Power. Quedamos en escribirle${targetText}. Si todavia desea continuar con su pedido, me responde por aqui y le ayudo a retomarlo.`;
};

const formatTargetDate = (value) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toLocaleDateString('es-EC', {
        timeZone: 'America/Guayaquil',
        day: '2-digit',
        month: '2-digit'
    });
};

const readDueBuyLaterLeads = ({ limit = 5 } = {}) => {
    const lookaheadMinutes = parseNumber('ADMIN_BUY_LATER_LOOKAHEAD_MINUTES', 120);
    const notifyBeforeDays = parseNumber('ADMIN_BUY_LATER_NOTIFY_BEFORE_DAYS', 3);
    const python = `
import sqlite3, json, datetime
db_path = ${JSON.stringify(ADMIN_DB_EC)}
limit = int(${JSON.stringify(limit)})
lookahead_minutes = int(${JSON.stringify(lookaheadMinutes)})
notify_before_days = int(${JSON.stringify(notifyBeforeDays)})
now = datetime.datetime.now(datetime.timezone.utc)
until = now + datetime.timedelta(minutes=lookahead_minutes)

def parse_dt(value):
    raw = str(value or '').strip()
    if not raw:
        return None
    try:
        raw = raw.replace('Z', '+00:00')
        for fmt in ('%d-%m-%Y %H:%M', '%d/%m/%Y %H:%M', '%d-%m-%Y', '%d/%m/%Y'):
            try:
                dt = datetime.datetime.strptime(raw, fmt)
                if fmt in ('%d-%m-%Y', '%d/%m/%Y'):
                    dt = dt.replace(hour=9, minute=0)
                dt = dt.replace(tzinfo=datetime.timezone(datetime.timedelta(hours=-3)))
                return dt.astimezone(datetime.timezone.utc)
            except Exception:
                pass
        if 'T' in raw:
            dt = datetime.datetime.fromisoformat(raw)
        else:
            dt = datetime.datetime.fromisoformat(raw.replace(' ', 'T'))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=datetime.timezone(datetime.timedelta(hours=-3)))
        return dt.astimezone(datetime.timezone.utc)
    except Exception:
        return None

con = sqlite3.connect(db_path)
con.row_factory = sqlite3.Row
cur = con.cursor()
cols = {row[1] for row in cur.execute("PRAGMA table_info(leads)").fetchall()}
for col in ["buy_later_followup_at", "buy_later_notified_at"]:
    if col not in cols:
        cur.execute(f"ALTER TABLE leads ADD COLUMN {col} TEXT")
con.commit()
rows = cur.execute("""
    SELECT id, name, phone, phone_e164, country, status, buy_later_followup_at, buy_later_notified_at
    FROM leads
    WHERE lower(coalesce(status,''))='comprar_depois'
      AND coalesce(buy_later_followup_at,'') <> ''
      AND coalesce(buy_later_notified_at,'') = ''
    ORDER BY buy_later_followup_at ASC, id ASC
    LIMIT ?
""", (max(limit * 5, 25),)).fetchall()
out = []
for row in rows:
    data = dict(row)
    target = parse_dt(data.get('buy_later_followup_at'))
    notify_at = target - datetime.timedelta(days=notify_before_days) if target else None
    if notify_at and notify_at <= until:
        data["target_at"] = target.isoformat()
        data["notify_at"] = notify_at.isoformat()
        out.append(data)
    if len(out) >= limit:
        break
con.close()
print(json.dumps({"ok": True, "leads": out}, ensure_ascii=False))
`;
    return runPython(python);
};

const markBuyLaterNotified = ({ leadId, status = 'sent', error = '' } = {}) => {
    const python = `
import sqlite3, json, datetime
db_path = ${JSON.stringify(ADMIN_DB_EC)}
lead_id = int(${JSON.stringify(leadId)})
status = ${JSON.stringify(status)}
error = ${JSON.stringify(String(error || '').slice(0, 500))}
now = datetime.datetime.now(datetime.timezone.utc).isoformat()
con = sqlite3.connect(db_path)
cur = con.cursor()
cols = {row[1] for row in cur.execute("PRAGMA table_info(leads)").fetchall()}
for col in ["buy_later_followup_at", "buy_later_notified_at"]:
    if col not in cols:
        cur.execute(f"ALTER TABLE leads ADD COLUMN {col} TEXT")
cur.execute("UPDATE leads SET buy_later_notified_at=? WHERE id=?", (now, lead_id))
hist_cols = {row[1] for row in cur.execute("PRAGMA table_info(lead_history)").fetchall()}
if {"lead_id", "action", "old_value", "new_value", "created_at"}.issubset(hist_cols):
    cur.execute(
        "INSERT INTO lead_history (lead_id, action, old_value, new_value, created_at) VALUES (?, ?, ?, ?, ?)",
        (lead_id, "comprar_depois_followup", "", status + ((": " + error) if error else ""), now)
    )
con.commit()
con.close()
print(json.dumps({"ok": True}))
`;
    return runPython(python);
};

export const processAdminBuyLaterFollowups = async ({ limit = 5 } = {}) => {
    const due = readDueBuyLaterLeads({ limit });
    if (!due.ok || due.skipped) return { ...due, processed: 0, sent: 0 };

    let processed = 0;
    let sent = 0;
    const items = [];
    for (const lead of due.leads || []) {
        processed += 1;
        const phone = digitsOnly(lead.phone_e164 || lead.phone);
        const jid = toWhatsAppChatId(phone, lead.country || 'EC');
        const safety = isAutomationRecipientAllowed(phone);
        if (!jid || !safety.allowed) {
            const reason = !jid ? 'invalid_phone' : safety.reason;
            items.push({ id: lead.id, sent: false, reason });
            continue;
        }
        try {
            const ok = await sendText(jid, buildBuyLaterText(lead), null, {
                recipientDigits: phone,
                force: false,
                humanize: true
            });
            if (ok) {
                sent += 1;
                markBuyLaterNotified({ leadId: lead.id, status: 'sent' });
            }
            items.push({ id: lead.id, sent: Boolean(ok), reason: ok ? 'sent' : 'send_failed' });
        } catch (error) {
            markBuyLaterNotified({ leadId: lead.id, status: 'failed', error: error.message });
            items.push({ id: lead.id, sent: false, reason: error.message });
        }
    }
    return { ok: true, candidates: due.leads?.length || 0, processed, sent, items };
};
