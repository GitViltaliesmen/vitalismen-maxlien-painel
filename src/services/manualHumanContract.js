import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash, randomUUID } from 'node:crypto';

const sha = value => createHash('sha256').update(value).digest('hex');
const textFingerprint = value => createHash('sha1').update(`text:${value.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()}`).digest('hex');
const exactKeys = (object, keys) => object && typeof object === 'object' && !Array.isArray(object)
    && Object.keys(object).every(key => keys.includes(key));
const fail = (statusCode, code) => { throw Object.assign(new Error(code), { statusCode, code }); };
export const manualRequestPath = req => String(req.originalUrl || req.url || '').split('?')[0];
export const isManualRequest = req => req.method === 'POST' && manualRequestPath(req) === '/api/whatsapp/send';
export const MANUAL_QA_RECIPIENT = '5515998038637';
export const MANUAL_QA_OWNER = '553171862958';

// Authority is private to this instance. No body field, req.user or ambient env creates a grant.
export const createManualHumanContract = (deps, { now = Date.now, lifetimeMs = 15000 } = {}) => {
    const grants = new WeakMap();
    const scope = new AsyncLocalStorage();
    const respond = (res, status, body) => res.status(status).json(body);
    const requireLive = grant => {
        if (!grant || grant.closed || now() > grant.deadline) fail(423, 'manual_authorization_expired');
    };
    const prepare = async req => {
        if (!isManualRequest(req)) return false;
        if (grants.has(req)) { requireLive(grants.get(req)); return true; }
        const b = req.body;
        if (req.headers?.origin !== 'https://ec.maxlien.shop') fail(423, 'manual_origin_required');
        if (!exactKeys(b, ['phone', 'message', 'sessionId', 'sendMode', 'clientGeneratedId', 'manualIntent',
            'country', 'delayTypingSeconds', 'quotedMessageId', 'isMedia'])
            || b.sendMode !== 'manual_panel' || b.isMedia === true || (b.isMedia !== undefined && b.isMedia !== false)
            || !exactKeys(b.manualIntent, ['confirmed', 'actionId']) || b.manualIntent.confirmed !== true
            || b.manualIntent.actionId !== b.clientGeneratedId
            || !/^[a-zA-Z0-9_-]{16,100}$/.test(b.clientGeneratedId || '')
            || typeof b.message !== 'string' || !b.message.trim() || b.message.length > 4000
            || b.quotedMessageId || ![undefined, 0].includes(b.delayTypingSeconds)
            || ![undefined, 'EC', 'BR'].includes(b.country) || !deps.sessionAllowed(b.sessionId)
            || deps.ownerPhoneDigits !== MANUAL_QA_OWNER
            || typeof b.phone !== 'string' || !(b.phone === MANUAL_QA_RECIPIENT || /^593[2-79]\d{8}$/.test(b.phone))) {
            fail(423, 'manual_individual_text_required');
        }
        const token = /^Bearer ([^\s]+)$/.exec(req.headers?.authorization || '')?.[1];
        if (!token) fail(401, 'manual_session_required');
        let actor;
        try { actor = await deps.authenticate(token); } catch { fail(401, 'manual_session_invalid'); }
        if (!actor || !/^[a-f0-9]{24}$/i.test(actor.id || '') || actor.isActive !== true
            || !['admin', 'operator'].includes(actor.role) || !Number.isFinite(actor.expiresAt)
            || actor.expiresAt <= now()) fail(401, 'manual_real_session_required');
        const text = b.message.trim();
        if (!await deps.validateRecipient(b.phone, actor, text)) fail(423, 'manual_recipient_not_authorized');
        grants.set(req, {
            actor: Object.freeze({ ...actor }), token, sessionHash: sha(token), phone: b.phone, text,
            actionId: b.clientGeneratedId, key: `human:${sha(actor.id + ':' + b.clientGeneratedId)}`,
            fingerprint: textFingerprint(text), payloadHash: sha(b.phone + '\n' + text),
            nonce: randomUUID(), deadline: Math.min(now() + lifetimeMs, actor.expiresAt), executing: false, closed: false
        });
        return true;
    };
    const hasGrant = req => {
        try { requireLive(grants.get(req)); return true; } catch { return false; }
    };
    const inPhase = (grant, phase, callback) => scope.run({ grant, phase, effectChecked: false, transportUsed: false }, callback);
    const mongoAllowed = (collection, method, args = []) => {
        const ctx = scope.getStore(); if (!ctx || ctx.grant.closed) return false;
        const g = ctx.grant; const c = String(collection).toLowerCase(); const [doc, update] = args;
        if (c === 'outbounddedupes' && method === 'insertOne' && ctx.phase === 'reserve') {
            return doc?.key === g.key && doc.phoneDigits === g.phone && doc.kind === 'text'
                && doc.fingerprint === g.fingerprint && doc.logicalMessageId === g.nonce
                && doc.channelId === g.sessionHash && doc.retryAllowed === false && doc.status === 'reserved'
                && doc.label === `human:${g.actor.id}:${g.actionId}:${g.payloadHash}`;
        }
        if (c === 'outbounddedupes' && method === 'updateOne' && ['sent', 'ambiguous'].includes(ctx.phase)) {
            return exactKeys(doc, ['key', 'status', 'logicalMessageId', 'fingerprint'])
                && doc.key === g.key && doc.status === 'reserved' && doc.logicalMessageId === g.nonce
                && doc.fingerprint === g.fingerprint && exactKeys(update, ['$set', '$setOnInsert'])
                && exactKeys(update.$setOnInsert || {}, ['createdAt'])
                && exactKeys(update.$set, ['status', 'retryAllowed', 'sentAt', 'ambiguousAt', 'updatedAt', 'provider', 'providerMessageId'])
                && update.$set?.status === ctx.phase && update.$set.retryAllowed === false;
        }
        if (c === 'messages' && method === 'insertOne' && ctx.phase === 'history') {
            return doc?._id === `human_${sha(g.key)}` && doc.chatId === `${g.phone}@s.whatsapp.net`
                && doc.peerPhone === g.phone && doc.body === g.text && doc.isFromMe === true
                && doc.from === deps.ownerPhoneDigits && doc.to === g.phone
                && doc.sessionId === deps.ownerPhoneDigits && doc.ownerPhoneDigits === deps.ownerPhoneDigits
                && doc.type === 'chat' && doc.isBot === false && doc.attendantId === g.actor.id
                && doc.senderRole === 'human' && doc.clientGeneratedId === g.actionId;
        }
        return false;
    };
    const externalAllowed = effect => {
        const ctx = scope.getStore();
        if (!ctx || ctx.phase !== 'transport' || ctx.effectChecked || ctx.grant.closed
            || now() > ctx.grant.deadline || effect !== 'zapi_outbound_reply') return false;
        ctx.effectChecked = true; return true;
    };
    const transportAllowed = (transport, operation) => {
        const ctx = scope.getStore();
        if (!ctx || ctx.phase !== 'transport' || !ctx.effectChecked || ctx.transportUsed
            || ctx.grant.closed || now() > ctx.grant.deadline || transport !== 'zapi' || operation !== 'send_text') return false;
        ctx.transportUsed = true; return true;
    };
    const execute = async (req, res) => {
        const g = grants.get(req);
        try { requireLive(g); } catch { return respond(res, 423, { error: 'manual_authorization_required' }); }
        if (g.executing) return respond(res, 409, { error: 'manual_action_in_progress' });
        g.executing = true;
        const ledger = { key: g.key, phoneDigits: g.phone, jid: `${g.phone}@s.whatsapp.net`, kind: 'text',
            fingerprint: g.fingerprint, logicalMessageId: g.nonce, channelId: g.sessionHash,
            label: `human:${g.actor.id}:${g.actionId}:${g.payloadHash}`, sessionId: 'zapi', retryAllowed: false,
            status: 'reserved', firstReservedAt: new Date(now()) };
        const finalize = async (status, providerMessageId = '') => inPhase(g, status, () => deps.finalize(
            { key: g.key, status: 'reserved', logicalMessageId: g.nonce, fingerprint: g.fingerprint },
            { $set: { status, retryAllowed: false, provider: 'zapi', providerMessageId,
                [status === 'sent' ? 'sentAt' : 'ambiguousAt']: new Date(now()) } }));
        try {
            // A read-only index check is mandatory. No createIndex or reservation update/upsert is used.
            if (!await deps.indexesReady()) return respond(res, 503, { error: 'manual_unique_indexes_required' });
            try { await inPhase(g, 'reserve', () => deps.reserve(ledger)); }
            catch (error) {
                if (error.code !== 11000) return respond(res, 503, { error: 'manual_reservation_uncertain', reconcileRequired: true });
                const previous = await deps.findReservation(g.key, g.phone, g.fingerprint);
                if (previous?.key === g.key && previous.channelId === g.sessionHash
                    && previous.label === ledger.label && previous.status === 'sent') {
                    if (!await deps.historyExists(`human_${sha(g.key)}`, g.actor.id, g.phone, g.actionId)) {
                        return respond(res, 202, { success: false, providerAccepted: true, reconcileRequired: true, automaticRetry: false });
                    }
                    return respond(res, 200, { success: true, duplicate: true, providerMessageId: previous.providerMessageId });
                }
                return respond(res, 409, { error: 'manual_action_reserved_or_duplicate', reconcileRequired: true });
            }
            // Revalidate session and access after reserving. No reservation is ever reacquired.
            const actor = await deps.authenticate(g.token);
            requireLive(g);
            if (actor?.id !== g.actor.id || actor.isActive !== true || !['admin', 'operator'].includes(actor.role)
                || !Number.isFinite(actor.expiresAt) || actor.expiresAt <= now() || !await deps.validateRecipient(g.phone, actor, g.text)) {
                await finalize('ambiguous'); return respond(res, 423, { error: 'manual_authorization_revoked', reconcileRequired: true });
            }
            let provider;
            try {
                provider = await inPhase(g, 'transport', () => deps.sendText({ phone: g.phone, message: g.text,
                    messageId: `human_${sha(g.key)}` }));
                if (!provider?.messageId && !provider?.id) throw Error('manual_provider_confirmation_missing');
            } catch {
                try { await finalize('ambiguous'); } catch { /* reserved + retryAllowed=false remains terminal to this contract */ }
                return respond(res, 202, { success: false, error: 'manual_send_ambiguous', reconcileRequired: true, automaticRetry: false });
            }
            const id = String(provider.messageId || provider.id);
            try {
                if (!await finalize('sent', id)) throw Error('manual_ledger_finalize_failed');
                await inPhase(g, 'history', () => deps.recordHistory({
                    _id: `human_${sha(g.key)}`, chatId: `${g.phone}@s.whatsapp.net`, peerPhone: g.phone,
                    body: g.text, isFromMe: true, from: deps.ownerPhoneDigits, to: g.phone,
                    type: 'chat', isBot: false, attendantId: g.actor.id,
                    senderRole: 'human', clientGeneratedId: g.actionId, sessionId: deps.ownerPhoneDigits,
                    provider: 'zapi', providerMessageId: id, deliveryStatus: 'provider_accepted',
                    timestamp: now(), ownerPhoneDigits: deps.ownerPhoneDigits
                }));
            } catch { return respond(res, 202, { success: false, providerAccepted: true, reconcileRequired: true, automaticRetry: false }); }
            return respond(res, 200, { success: true, provider: 'zapi', providerMessageId: id, deliveryStatus: 'provider_accepted' });
        } catch { return respond(res, 423, { error: 'manual_contract_failed_closed', reconcileRequired: true }); }
        finally { g.closed = true; g.token = ''; }
    };
    return Object.freeze({ prepare, hasGrant, execute, mongoAllowed, externalAllowed, transportAllowed });
};
