import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import Message from '../models/Message.js';
import ContactState from '../models/ContactState.js';
import { syncContactDraftToOnlineAdminPanel } from './adminPanelStatusService.js';

const ADMIN_DB_EC = '/opt/maxlien-mvp/leads_ec.sqlite3';
const PROTECTED_ADMIN_STATUSES = new Set(['comprar_depois', 'confirmado', 'pedido_enviado', 'enviado', 'entregue', 'recompra', 'devolvido', 'cancelado']);
const CLOSED_DRAFT_STATUSES = new Set(['confirmed', 'processing', 'pedido_enviado', 'pedido-enviado', 'shipped', 'delivered']);

const digitsOnly = (value) => String(value || '').replace(/\D/g, '');
const phoneTail = (value) => digitsOnly(value).slice(-9);
const parseNumber = (name, fallback) => {
    const parsed = Number.parseInt(String(process.env[name] || ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};
const isValidEcPhone = (value) => {
    const digits = digitsOnly(value);
    return /^5939\d{8}$/.test(digits);
};

const normalizeEcPhone = (value) => {
    const digits = digitsOnly(value);
    if (digits.startsWith('593')) return digits;
    return digits.length >= 9 ? `593${digits.slice(-9)}` : digits;
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

const readAdminLeads = ({ fromId = 1 } = {}) => {
    const python = `
import sqlite3, json
db_path = ${JSON.stringify(ADMIN_DB_EC)}
from_id = int(${JSON.stringify(fromId)})
con = sqlite3.connect(db_path)
con.row_factory = sqlite3.Row
rows = con.execute("""
    SELECT id, name, phone, phone_e164, status, event_id, created_at, updated_at, notes,
           address, city, province, product_qty, product_value, country
    FROM leads
    WHERE id >= ?
    ORDER BY COALESCE(updated_at, created_at, '') DESC, id DESC
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

const adminStatusToDraftStatus = (status = '') => {
    const value = String(status || '').toLowerCase();
    if (value === 'confirmado') return 'confirmed';
    if (value === 'comprar_depois') return 'buy_later';
    if (value === 'pedido_enviado' || value === 'enviado') return 'processing';
    if (value === 'entregue') return 'delivered';
    if (value === 'atendendo') return 'atendendo';
    return 'novo';
};

const findContactStateByPhone = async (phone = '') => {
    const tail = phoneTail(phone);
    if (!tail) return null;
    const exactState = await ContactState.findOne({
        $or: [
            { phoneDigits: { $regex: `${tail}$` } },
            { 'metadata.lastSenderPn': { $regex: tail } },
            { chatId: { $regex: `${tail}@` } }
        ]
    }).sort({ updatedAt: -1 });
    if (exactState) return exactState;

    return ContactState.findOne({
        'metadata.customerDraft.phone': { $regex: tail }
    }).sort({ updatedAt: -1 });
};

const findContactStateByAdminLeadId = async (leadId = '', phone = '') => {
    const parsed = Number.parseInt(String(leadId || ''), 10);
    if (!Number.isFinite(parsed)) return null;
    const states = await ContactState.find({
        $or: [
            { 'metadata.adminPanelLeadId': parsed },
            { 'metadata.adminPanelLeadId': String(parsed) }
        ]
    }).sort({ updatedAt: -1 }).limit(8);
    const tail = phoneTail(phone);
    if (tail) {
        const matchingPhone = states.find((state) => [
            state.phoneDigits,
            state.chatId,
            state.metadata?.lastSenderPn,
            state.metadata?.customerDraft?.phone
        ].some((value) => phoneTail(value) === tail));
        if (matchingPhone) return matchingPhone;
    }
    return states[0] || null;
};

const applyAdminLeadToContactState = (state, lead, phone) => {
    const draft = state.metadata?.customerDraft || {};
    const status = String(lead.status || '').toLowerCase();
    const adminUpdatedAt = new Date(lead.updated_at || lead.created_at || Date.now());
    const validAdminUpdatedAt = Number.isNaN(adminUpdatedAt.getTime()) ? new Date() : adminUpdatedAt;
    const currentPhoneDigits = digitsOnly(state.phoneDigits);
    const normalizedPhone = normalizeEcPhone(phone || lead.phone_e164 || lead.phone);
    const currentLooksLikeEcPhone = isValidEcPhone(currentPhoneDigits);
    const adminLeadIdMatches = String(state.metadata?.adminPanelLeadId || '') === String(lead.id || '');
    const currentTail = phoneTail(currentPhoneDigits);
    const normalizedTail = phoneTail(normalizedPhone);
    const shouldTrustAdminPhone = adminLeadIdMatches && isValidEcPhone(normalizedPhone) && currentTail !== normalizedTail;
    if (shouldTrustAdminPhone) {
        state.metadata = {
            ...(state.metadata || {}),
            previousPhoneDigitsBeforeAdminSync: state.phoneDigits || ''
        };
        state.phoneDigits = normalizedPhone;
        state.chatId = `${normalizedPhone}@c.us`;
    } else if (!currentLooksLikeEcPhone && isValidEcPhone(normalizedPhone)) {
        state.metadata = {
            ...(state.metadata || {}),
            previousPhoneDigitsBeforeAdminSync: state.phoneDigits || ''
        };
        state.phoneDigits = normalizedPhone;
    } else {
        state.phoneDigits = state.phoneDigits || normalizedPhone || phone;
    }
    state.countryCode = 'EC';
    state.assignedAgent = 'vit_power_ec';
    state.updatedAt = validAdminUpdatedAt;
    if (!state.createdAt && lead.created_at) {
        const adminCreatedAt = new Date(lead.created_at);
        if (!Number.isNaN(adminCreatedAt.getTime())) state.createdAt = adminCreatedAt;
    }
    state.metadata = {
        ...(state.metadata || {}),
        adminPanelLeadId: lead.id,
        adminPanelStatus: lead.status || '',
        adminPanelCreatedAt: lead.created_at || '',
        adminPanelUpdatedAt: lead.updated_at || '',
        adminPanelSyncedAt: new Date(),
        lastSessionId: state.metadata?.lastSessionId || process.env.WHATSAPP_DEFAULT_SESSION_ID || '',
        lastActiveChatId: state.chatId,
        customerDraft: {
            ...draft,
            name: lead.name || draft.name || '',
            phone: isValidEcPhone(normalizedPhone) ? normalizedPhone : (draft.phone || phone),
            country: draft.country || 'EC',
            address: lead.address || draft.address || '',
            city: lead.city || draft.city || '',
            province: lead.province || draft.province || '',
            quantity: String(lead.product_qty || draft.quantity || ''),
            total: String(lead.product_value || draft.total || ''),
            orderId: lead.event_id || (lead.id ? `EC-ADMIN-${lead.id}` : '') || draft.orderId || '',
            status: adminStatusToDraftStatus(lead.status) || draft.status || 'novo',
            updatedAt: validAdminUpdatedAt.toISOString()
        }
    };
    const tags = Array.isArray(state.tags) ? state.tags : [];
    state.tags = [...new Set([
        ...tags,
        'PANEL_UNIFIED_IMPORTED',
        `admin:${status || 'novo'}`
    ])];
    state.markModified?.('metadata');
};

const saveAdminLeadContactState = async (state, lead, phone, options = { timestamps: false }) => {
    try {
        await state.save(options);
        return state;
    } catch (error) {
        if (error?.code !== 11000 || !error?.keyPattern?.chatId) throw error;
        const duplicateChatId = error.keyValue?.chatId || (phone ? `${phone}@c.us` : '');
        const existing = duplicateChatId
            ? await ContactState.findOne({ chatId: duplicateChatId })
            : await findContactStateByPhone(phone);
        if (!existing || String(existing._id) === String(state._id)) throw error;
        applyAdminLeadToContactState(existing, lead, phone);
        await existing.save(options);
        return existing;
    }
};

const phoneTailCandidates = (value = '') => {
    const digits = digitsOnly(value);
    return [...new Set([
        digits,
        digits.length >= 8 ? digits.slice(-8) : '',
        digits.length >= 9 ? digits.slice(-9) : '',
        digits.length >= 10 ? digits.slice(-10) : '',
        digits.length >= 11 ? digits.slice(-11) : ''
    ].filter((item) => item && item.length >= 7))];
};

const findContactStateForMessageRow = async (row = {}) => {
    const tails = [...new Set([
        row._id,
        row.chatId,
        row.peerPhone
    ].filter(Boolean).flatMap((value) => phoneTailCandidates(value)))];
    const query = {
        $or: [
            { chatId: row._id || row.chatId },
            ...tails.flatMap((tail) => [
                { phoneDigits: { $regex: `${tail}$` } },
                { 'metadata.lastSenderPn': { $regex: tail } },
                { chatId: { $regex: `${tail}@` } }
            ])
        ].filter((item) => Object.values(item)[0])
    };
    const states = await ContactState.find(query).sort({ updatedAt: -1 }).limit(8).lean();
    return states.find((state) => digitsOnly(state?.metadata?.lastSenderPn).startsWith('593'))
        || states.find((state) => digitsOnly(state?.phoneDigits).startsWith('593'))
        || states.find((state) => String(state?.chatId || '').endsWith('@lid'))
        || states[0]
        || null;
};

const realPhoneForMessageRow = ({ row = {}, state = null } = {}) => {
    const sender = digitsOnly(state?.metadata?.lastSenderPn);
    if (sender.startsWith('593')) return sender;
    const peer = digitsOnly(row.peerPhone);
    if (peer.startsWith('593')) return peer;
    const statePhone = digitsOnly(state?.phoneDigits);
    if (statePhone.startsWith('593')) return statePhone;
    const chat = digitsOnly(row._id || row.chatId);
    return chat.startsWith('593') ? chat : '';
};

const buildRecentWhatsappContacts = async ({ since } = {}) => {
    const rows = await Message.aggregate([
        {
            $match: {
                createdAt: { $gte: since },
                isFromMe: false,
                isBot: false,
                chatId: { $not: /newsletter|broadcast|@g\.us/ },
                peerPhone: { $not: /^55/ }
            }
        },
        { $sort: { createdAt: -1 } },
        {
            $group: {
                _id: '$chatId',
                lastInboundAt: { $first: '$createdAt' },
                peerPhone: { $first: '$peerPhone' },
                body: { $first: '$body' },
                sessionId: { $first: '$sessionId' }
            }
        },
        { $sort: { lastInboundAt: 1 } }
    ]);

    const byPhone = new Map();
    for (const row of rows) {
        const state = await findContactStateForMessageRow(row);
        const phone = realPhoneForMessageRow({ row, state });
        if (!isValidEcPhone(phone)) continue;
        const current = byPhone.get(phone);
        if (!current || new Date(row.lastInboundAt) > new Date(current.row.lastInboundAt)) {
            byPhone.set(phone, { row, state, phone, tail: phoneTail(phone) });
        }
    }
    return [...byPhone.values()];
};

const updateAdminLeadsToAtendendo = ({ leadIds = [] } = {}) => {
    const ids = [...new Set(leadIds.map((id) => Number.parseInt(String(id), 10)).filter(Number.isFinite))];
    if (!ids.length) return { ok: true, changed: 0, updatedIds: [] };
    const python = `
import sqlite3, json, datetime
db_path = ${JSON.stringify(ADMIN_DB_EC)}
ids = ${JSON.stringify(ids)}
protected = {"comprar_depois", "confirmado", "pedido_enviado", "enviado", "entregue", "recompra", "devolvido", "cancelado"}
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

export const reconcileRecentWhatsappContactsToAdminPanel = async ({
    since = new Date(Date.now() - parseNumber('ADMIN_PANEL_CONTACT_SWEEP_LOOKBACK_HOURS', 36) * 60 * 60 * 1000),
    limit = parseNumber('ADMIN_PANEL_CONTACT_SWEEP_CREATE_LIMIT', 20)
} = {}) => {
    const allAdmin = readAdminLeads({ fromId: 1 });
    if (!allAdmin.ok) return { ok: false, reason: 'admin_all_read_failed', error: allAdmin.error || allAdmin.reason };

    const allAdminTails = buildAdminTailSet(allAdmin.leads || []);
    const contacts = await buildRecentWhatsappContacts({ since });
    const missing = contacts.filter((item) => item.tail && !allAdminTails.has(item.tail));
    const selected = missing.slice(0, Math.max(1, limit));
    const created = [];

    for (const item of selected) {
        const draft = item.state?.metadata?.customerDraft || {};
        const manualActive = item.state?.human?.mode === 'manual' && !isClosedDraft(draft.status);
        const sync = syncContactDraftToOnlineAdminPanel({
            ...draft,
            phone: draft.phone || item.phone,
            country: draft.country || item.state?.countryCode || 'EC',
            status: manualActive ? 'atendendo' : (draft.status || 'novo')
        }, {
            country: draft.country || item.state?.countryCode || 'EC',
            note: [
                item.state?.human?.note || '',
                'Varredura WhatsApp: contato recente sem ficha no Painel Unificado',
                String(item.row?.body || '').trim() ? `Ultima mensagem: ${String(item.row.body).slice(0, 120)}` : ''
            ].filter(Boolean).join(' | '),
            action: 'whatsapp_recent_contact_sweep',
            adminStatus: manualActive ? 'atendendo' : 'novo'
        });
        if (sync?.ok && sync.mode === 'created') {
            created.push({ phone: item.phone, leadId: sync.lead_id, status: sync.status || (manualActive ? 'atendendo' : 'novo') });
            allAdminTails.add(item.tail);
        }
    }

    return {
        ok: true,
        since: since.toISOString(),
        scannedContacts: contacts.length,
        missing: missing.length,
        created: created.length,
        createdItems: created,
        limited: missing.length > selected.length
    };
};

export const reconcileAdminLeadsToWhatsappPanel = async ({
    fromId = parseNumber('ADMIN_PANEL_TO_WHATSAPP_FROM_ID', 1),
    limit = parseNumber('ADMIN_PANEL_TO_WHATSAPP_CREATE_LIMIT', 200)
} = {}) => {
    const admin = readAdminLeads({ fromId });
    if (!admin.ok) return { ok: false, reason: 'admin_read_failed', error: admin.error || admin.reason };

    let created = 0;
    let updated = 0;
    const createdItems = [];
    const missing = [];
    const selected = (admin.leads || []).slice(0, Math.max(1, limit));

    for (const lead of selected) {
        const phone = normalizeEcPhone(lead.phone_e164 || lead.phone);
        if (!isValidEcPhone(phone)) continue;
        let state = await findContactStateByPhone(phone);
        if (!state) state = await findContactStateByAdminLeadId(lead.id, phone);
        if (!state) {
            state = new ContactState({
                chatId: `${phone}@c.us`,
                phoneDigits: phone,
                countryCode: 'EC',
                assignedAgent: 'vit_power_ec'
            });
            applyAdminLeadToContactState(state, lead, phone);
            const savedState = await saveAdminLeadContactState(state, lead, phone);
            if (String(savedState._id) === String(state._id)) {
                created += 1;
                createdItems.push({ id: lead.id, phone, status: lead.status || '', chatId: savedState.chatId });
            } else {
                updated += 1;
            }
            continue;
        }
        applyAdminLeadToContactState(state, lead, phone);
        await saveAdminLeadContactState(state, lead, phone);
        updated += 1;
    }

    for (const lead of admin.leads || []) {
        const phone = normalizeEcPhone(lead.phone_e164 || lead.phone);
        if (!isValidEcPhone(phone)) continue;
        const state = await findContactStateByPhone(phone);
        if (!state) missing.push({ id: lead.id, phone, status: lead.status || '' });
    }

    return {
        ok: true,
        fromId,
        scannedAdminLeads: admin.leads?.length || 0,
        created,
        updated,
        missing: missing.length,
        missingItems: missing,
        createdItems
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
