import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import ContactState from '../models/ContactState.js';
import { syncContactDraftToOnlineAdminPanel } from './adminPanelStatusService.js';

const ADMIN_DB_EC = '/opt/maxlien-mvp/leads_ec.sqlite3';
const PROTECTED_ADMIN_STATUSES = new Set(['confirmado', 'pedido_enviado', 'enviado', 'entregue', 'devolvido', 'cancelado']);
const CLOSED_DRAFT_STATUSES = new Set(['confirmed', 'processing', 'pedido_enviado', 'pedido-enviado', 'shipped', 'delivered']);

const digitsOnly = (value) => String(value || '').replace(/\D/g, '');
const phoneTail = (value) => digitsOnly(value).slice(-9);
const isValidEcPhone = (value) => {
    const digits = digitsOnly(value);
    return digits.startsWith('593') && digits.length >= 11;
};

const isClosedDraft = (status = '') => {
    const value = String(status || '').trim().toLowerCase();
    return CLOSED_DRAFT_STATUSES.has(value);
};

const runPython = (python) => {
    if (fs.existsSync(ADMIN_DB_EC)) {
        const result = spawnSync('python3', ['-'], {
            input: python,
            encoding: 'utf8',
            maxBuffer: 1024 * 1024 * 10
        });
        if (result.status !== 0) {
            return { ok: false, error: result.stderr || result.stdout || `exit_${result.status}` };
        }
        return JSON.parse(result.stdout || '{}');
    }

    const keyPath = path.join(os.homedir(), '.ssh', 'vps_auditoria_codex');
    if (!fs.existsSync(keyPath)) return { ok: false, skipped: true, reason: 'admin_db_and_ssh_key_not_found' };

    const result = spawnSync('ssh', [
        '-i',
        keyPath,
        '-o',
        'BatchMode=yes',
        '-o',
        'ConnectTimeout=10',
        'root@maxlien.shop',
        'python3',
        '-'
    ], {
        input: python,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 10
    });
    if (result.status !== 0) {
        return { ok: false, error: result.stderr || result.stdout || `exit_${result.status}` };
    }
    return JSON.parse(result.stdout || '{}');
};

const readAdminLeads = ({ fromId = 1725 } = {}) => {
    const python = `
import sqlite3, json
db_path = ${JSON.stringify(ADMIN_DB_EC)}
from_id = int(${JSON.stringify(fromId)})
con = sqlite3.connect(db_path)
con.row_factory = sqlite3.Row
rows = con.execute("""
    SELECT id, name, phone, phone_e164, status, event_id, created_at, updated_at, notes
    FROM leads
    WHERE id >= ?
    ORDER BY id ASC
""", (from_id,)).fetchall()
con.close()
print(json.dumps({"ok": True, "leads": [dict(row) for row in rows]}, ensure_ascii=False))
`;
    return runPython(python);
};

const buildAdminTailSet = (leads = []) => new Set(
    (leads || [])
        .map((lead) => phoneTail(lead.phone_e164 || lead.phone))
        .filter(Boolean)
);

const updateAdminLeadsToAtendendo = ({ leadIds = [] } = {}) => {
    const ids = [...new Set(leadIds.map((id) => Number.parseInt(String(id), 10)).filter(Number.isFinite))];
    if (!ids.length) return { ok: true, changed: 0, updatedIds: [] };
    const python = `
import sqlite3, json, datetime
db_path = ${JSON.stringify(ADMIN_DB_EC)}
ids = ${JSON.stringify(ids)}
protected = {"confirmado", "pedido_enviado", "enviado", "entregue", "devolvido", "cancelado"}
now = datetime.datetime.now(datetime.timezone.utc).isoformat()
con = sqlite3.connect(db_path)
cur = con.cursor()
updated = []
for lead_id in ids:
    row = cur.execute("SELECT status, notes FROM leads WHERE id=?", (lead_id,)).fetchone()
    if not row:
        continue
    old_status = str(row[0] or "").lower()
    if old_status in protected:
        continue
    notes = str(row[1] or "")
    marker = "Reconciliação WhatsApp: atendimento humano ativo"
    new_notes = notes if marker in notes else (notes + "\\n" + marker).strip()
    cur.execute("UPDATE leads SET status=?, notes=?, updated_at=? WHERE id=?", ("atendendo", new_notes, now, lead_id))
    updated.append(lead_id)
if updated:
    hist_cols = {row[1] for row in cur.execute("PRAGMA table_info(lead_history)").fetchall()}
    if {"lead_id", "action", "old_value", "new_value", "created_at"}.issubset(hist_cols):
        for lead_id in updated:
            cur.execute(
                "INSERT INTO lead_history (lead_id, action, old_value, new_value, created_at) VALUES (?, ?, ?, ?, ?)",
                (lead_id, "whatsapp_reconcile_atendendo", "", "atendendo", now)
            )
con.commit()
changed = con.total_changes
con.close()
print(json.dumps({"ok": True, "changed": changed, "updatedIds": updated}))
`;
    return runPython(python);
};

const buildManualContactIndex = async () => {
    const states = await ContactState.find({
        countryCode: 'EC',
        'human.mode': 'manual'
    }).lean();

    const byTail = new Map();
    const validManual = [];
    for (const state of states) {
        const draft = state.metadata?.customerDraft || {};
        if (isClosedDraft(draft.status)) continue;
        const phone = digitsOnly(draft.phone || state.phoneDigits || state.metadata?.lastSenderPn || state.chatId);
        if (!isValidEcPhone(phone)) continue;
        const tail = phoneTail(phone);
        if (!tail) continue;
        validManual.push({ state, phone, tail });
        if (!byTail.has(tail)) byTail.set(tail, []);
        byTail.get(tail).push(state);
    }
    return { byTail, validManual };
};

const ensureAtendimentoTag = async (states = []) => {
    let tagged = 0;
    const seen = new Set();
    for (const state of states) {
        if (!state?._id || seen.has(String(state._id))) continue;
        seen.add(String(state._id));
        const tags = Array.isArray(state.tags) ? state.tags : [];
        if (tags.some((tag) => String(tag || '').startsWith('manual:'))) continue;
        const result = await ContactState.updateOne(
            { _id: state._id },
            {
                $set: {
                    'metadata.lastManualAction': {
                        action: 'atendimento_iniciado',
                        label: 'Atendimento iniciado',
                        at: new Date(),
                        by: 'reconciliacao'
                    }
                },
                $addToSet: { tags: 'manual:atendimento_iniciado' }
            }
        );
        if (result.modifiedCount) tagged += 1;
    }
    return tagged;
};

export const reconcileAdminPanelAtendimento = async ({ fromId = 1725, createMissing = true } = {}) => {
    const admin = readAdminLeads({ fromId });
    if (!admin.ok) return { ok: false, reason: 'admin_read_failed', error: admin.error || admin.reason };
    const allAdmin = readAdminLeads({ fromId: 1 });
    if (!allAdmin.ok) return { ok: false, reason: 'admin_all_read_failed', error: allAdmin.error || allAdmin.reason };

    const { byTail, validManual } = await buildManualContactIndex();
    const protectedSkipped = [];
    const matched = [];
    const toUpdate = [];
    const matchedStates = [];
    const allAdminTails = buildAdminTailSet(allAdmin.leads || []);

    for (const lead of admin.leads || []) {
        const tail = phoneTail(lead.phone_e164 || lead.phone);
        const states = tail ? byTail.get(tail) || [] : [];
        if (!states.length) continue;
        matched.push(lead.id);
        matchedStates.push(...states);
        const status = String(lead.status || '').toLowerCase();
        if (PROTECTED_ADMIN_STATUSES.has(status)) {
            protectedSkipped.push(lead.id);
            continue;
        }
        if (status !== 'atendendo') toUpdate.push(lead.id);
    }

    const update = updateAdminLeadsToAtendendo({ leadIds: toUpdate });
    const tagged = await ensureAtendimentoTag(matchedStates);

    let createdMissing = 0;
    if (createMissing) {
        for (const item of validManual) {
            if (allAdminTails.has(item.tail)) continue;
            const draft = item.state.metadata?.customerDraft || {};
            const sync = syncContactDraftToOnlineAdminPanel({
                ...draft,
                phone: draft.phone || item.phone,
                country: draft.country || item.state.countryCode || 'EC',
                status: 'atendendo'
            }, {
                country: draft.country || item.state.countryCode || 'EC',
                note: item.state.human?.note || 'Atendimento humano ativo no WhatsApp',
                action: 'whatsapp_reconcile_missing_atendendo',
                adminStatus: 'atendendo'
            });
            if (sync?.ok && sync.mode === 'created') createdMissing += 1;
        }
    }

    return {
        ok: true,
        fromId,
        scannedAdminLeads: admin.leads?.length || 0,
        manualContacts: validManual.length,
        matched: matched.length,
        requestedUpdates: toUpdate.length,
        updatedIds: update.updatedIds || [],
        protectedSkipped,
        tagged,
        createdMissing,
        update
    };
};

export const countAdminPanelAtendimentoGaps = async ({ fromId = 1725 } = {}) => {
    const admin = readAdminLeads({ fromId });
    if (!admin.ok) return { ok: false, reason: 'admin_read_failed' };
    const allAdmin = readAdminLeads({ fromId: 1 });
    if (!allAdmin.ok) return { ok: false, reason: 'admin_all_read_failed' };
    const { byTail, validManual } = await buildManualContactIndex();
    const allAdminTails = buildAdminTailSet(allAdmin.leads || []);
    let adminNovoInManual = 0;
    for (const lead of admin.leads || []) {
        const status = String(lead.status || '').toLowerCase();
        if (PROTECTED_ADMIN_STATUSES.has(status) || status === 'atendendo') continue;
        const tail = phoneTail(lead.phone_e164 || lead.phone);
        if (tail && byTail.has(tail)) adminNovoInManual += 1;
    }
    const manualWithoutAdmin = validManual.filter((item) => !allAdminTails.has(item.tail)).length;
    return {
        ok: true,
        fromId,
        adminNovoInManual,
        manualWithoutAdmin,
        manualContacts: validManual.length
    };
};
