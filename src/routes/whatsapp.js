import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { listAudioTemplates, resolveCountryAudio } from '../services/audioTemplateService.js';
import { authMiddleware, adminOnly } from '../middleware/auth.js';
import Order from '../models/Order.js';
import Message from '../models/Message.js';
import ContactState from '../models/ContactState.js';
import { getSalesMedia } from '../services/salesMediaCatalog.js';
import { disconnectWhatsApp, getAllStatuses, getOwnPhoneDigits, getSock, getStatus, registerWhatsAppSession, startWhatsApp } from '../whatsapp/connection.js';
import { sendText } from '../whatsapp/sendText.js';
import { sendAudio } from '../whatsapp/sendAudio.js';
import { sendImage } from '../whatsapp/sendImage.js';
import { sendVideo } from '../whatsapp/sendVideo.js';
import { canSendOutbound } from '../whatsapp/outboundGuard.js';
import { getSenderPoolStatus } from '../whatsapp/sessionRouter.js';
import { toWhatsAppChatId } from '../utils/phone.js';
import {
    listReengagementCandidates,
    sendReengagementToChat
} from '../services/reengagementService.js';
import { syncContactDraftToOnlineAdminPanel } from '../services/adminPanelStatusService.js';
import { processBacklogRecovery } from '../services/backlogRecoveryService.js';
import { reconcileAdminPanelAtendimento } from '../services/adminPanelLeadReconciliationService.js';

const router = express.Router();
const debugRoutesEnabled = String(process.env.ENABLE_WHATSAPP_DEBUG_ROUTES || '') === '1';

const resolveChatId = (phone, country) => (
    String(phone || '').includes('@') ? String(phone) : toWhatsAppChatId(phone, country)
);

const digitsOnly = (value) => String(value || '').replace(/\D/g, '');

const normalizePanelCountry = (value, fallback = 'EC') => {
    const normalized = String(value || '').trim().toUpperCase();
    return ['EC', 'CO'].includes(normalized) ? normalized : fallback;
};

const countryPrefixFromDigits = (value) => {
    const digits = digitsOnly(value);
    if (digits.startsWith('593')) return 'EC';
    if (digits.startsWith('55')) return 'BR';
    return '';
};

const isAllowedPanelPhoneForCountry = (phone = '', country = 'EC') => {
    const digits = digitsOnly(phone);
    const normalizedCountry = normalizePanelCountry(country);
    if (normalizedCountry === 'EC') return digits.startsWith('593');
    if (normalizedCountry === 'CO') return digits.startsWith('57');
    return true;
};

const isBrazilTestOnly = ({ phone = '', country = '' } = {}) => (
    String(country || '').trim().toUpperCase() === 'BR' || digitsOnly(phone).startsWith('55')
);

const MANUAL_ACTION_TAGS = {
    atendimento_iniciado: 'Atendimento iniciado',
    dados_pedidos: 'Dados pedidos',
    dados_recebidos: 'Dados recebidos',
    audio_enviado: 'Audio enviado',
    prova_enviada: 'Prova enviada',
    preco_enviado: 'Preco enviado',
    aguardando_cliente: 'Aguardando cliente',
    pedido_confirmado: 'Pedido confirmado',
    enviado_dropi: 'Enviado Dropi',
    guia_enviada: 'Guia enviada',
    resolvido: 'Resolvido',
    revisar: 'Revisar'
};

const normalizeManualAction = (value = '') => String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_');

const findOrCreateContactStateForPanel = async ({ chatId = '', phone = '', country = 'EC' } = {}) => {
    const digits = digitsOnly(phone);
    const stateOr = [];
    if (chatId) stateOr.push({ chatId });
    if (digits) {
        stateOr.push({ phoneDigits: digits });
        stateOr.push({ phoneDigits: { $regex: `${digits}$` } });
        if (digits.length >= 9) stateOr.push({ phoneDigits: { $regex: `${digits.slice(-9)}$` } });
    }
    const existing = stateOr.length
        ? await ContactState.findOne({ $or: stateOr }).sort({ updatedAt: -1 })
        : null;
    if (existing) return existing;
    return new ContactState({
        chatId: chatId || (digits ? `${digits}@c.us` : `manual_${Date.now()}`),
        phoneDigits: digits,
        countryCode: normalizePanelCountry(country)
    });
};

const getPanelSessionScope = (requestedSessionId = '') => {
    const requested = String(requestedSessionId || '').trim();
    const statuses = getAllStatuses();
    const connected = statuses.filter((status) => status?.isReady || status?.status === 'connected');
    const configured = [
        requested,
        process.env.WHATSAPP_DEFAULT_SESSION_ID,
        ...(String(process.env.WHATSAPP_SESSION_IDS || '').split(','))
    ].map((item) => String(item || '').trim()).filter(Boolean);
    const sessionIds = [...new Set([
        ...configured,
        ...connected.map((status) => status.sessionId).filter(Boolean),
        ...connected.map((status) => status.ownPhoneDigits).filter(Boolean)
    ])];
    return { statuses, sessionIds };
};

const isValidPanelChatId = (chatId = '') => {
    const value = String(chatId || '');
    return Boolean(value && value !== 'status@broadcast' && !value.includes('@g.us'));
};

const realPhoneFromState = (state = {}) => {
    const sender = digitsOnly(state.metadata?.lastSenderPn);
    if (sender.length >= 9) return sender;
    const phone = digitsOnly(state.phoneDigits);
    const chatDigits = digitsOnly(state.chatId);
    if (phone.length >= 9 && !(String(state.chatId || '').endsWith('@lid') && phone === chatDigits)) return phone;
    return '';
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

const isLocalRequest = (req) => {
    const host = String(req.hostname || req.headers.host || '').split(':')[0];
    const ip = String(req.ip || req.socket?.remoteAddress || '');
    return ['localhost', '127.0.0.1', '::1'].includes(host)
        || ip === '127.0.0.1'
        || ip === '::1'
        || ip === '::ffff:127.0.0.1';
};

const publicMediaUrlFromPath = (filePath = '') => {
    const value = String(filePath || '').trim();
    if (!value) return '';
    if (/^https?:\/\//i.test(value) || value.startsWith('/media/')) return value;
    const publicDir = path.join(process.cwd(), 'public');
    const resolved = path.resolve(value);
    if (!resolved.startsWith(publicDir)) return '';
    return `/${path.relative(publicDir, resolved).split(path.sep).join('/')}`;
};

const audioPreviewUrlFor = (mediaUrl = '') => {
    const value = String(mediaUrl || '');
    if (!value.toLowerCase().endsWith('.ogg')) return '';
    const mp3Path = path.join(process.cwd(), 'public', value.replace(/^\//, '').replace(/\.ogg$/i, '.mp3'));
    return fs.existsSync(mp3Path) ? value.replace(/\.ogg$/i, '.mp3') : '';
};

const mediaAttachment = ({ type, label, mediaUrl, previewUrl = '' }) => {
    if (!mediaUrl) return null;
    return {
        type,
        label: String(label || '').trim(),
        mediaUrl,
        mediaPreviewUrl: previewUrl || audioPreviewUrlFor(mediaUrl)
    };
};

const resolveMessageMediaAttachments = async (message = {}) => {
    const attachments = [];
    const push = (attachment) => {
        if (!attachment?.mediaUrl) return;
        if (attachments.some((item) => item.mediaUrl === attachment.mediaUrl)) return;
        attachments.push(attachment);
    };

    if (message.mediaUrl) {
        push(mediaAttachment({
            type: message.type || 'media',
            label: message.body || message.type || 'midia',
            mediaUrl: message.mediaUrl,
            previewUrl: message.mediaPreviewUrl || ''
        }));
    }

    const body = String(message.body || '');
    const explicitMediaMatches = [...body.matchAll(/\b(audio|áudio|image|imagem|video|vídeo)\s*:\s*(\/media\/[^\s]+)/gi)];
    for (const match of explicitMediaMatches) {
        const rawType = String(match[1] || '').toLowerCase();
        const mediaUrl = String(match[2] || '').trim();
        const type = rawType.includes('audio') || rawType.includes('áudio')
            ? 'audio'
            : rawType.includes('video') || rawType.includes('vídeo')
                ? 'video'
                : 'image';
        push(mediaAttachment({ type, label: type, mediaUrl }));
    }

    const audioMatches = [...body.matchAll(/\[AUDIO\]\s*([A-Za-z0-9_ÁÉÍÓÚáéíóúÑñ-]+)/gi)];
    for (const match of audioMatches) {
        const baseName = match[1];
        const audioPath = await resolveCountryAudio({ country: 'EC', baseName }).catch(() => null);
        const mediaUrl = publicMediaUrlFromPath(audioPath);
        push(mediaAttachment({ type: 'audio', label: baseName, mediaUrl }));
    }

    const imageMatches = [...body.matchAll(/\[(?:IMAGEM|IMAGE|VIDEO)\]\s*([A-Za-z0-9_-]+)/gi)];
    for (const match of imageMatches) {
        const key = match[1];
        const media = getSalesMedia(key);
        const mediaUrl = publicMediaUrlFromPath(media?.path);
        push(mediaAttachment({ type: media?.type || 'image', label: key, mediaUrl }));
    }

    return attachments;
};

const enrichMessagesWithMedia = async (messages = []) => Promise.all((messages || []).map(async (message) => {
    const item = typeof message.toObject === 'function' ? message.toObject() : { ...message };
    const mediaAttachments = await resolveMessageMediaAttachments(item);
    if (mediaAttachments.length && !item.mediaUrl) {
        item.mediaUrl = mediaAttachments[0].mediaUrl;
        item.mediaPreviewUrl = mediaAttachments[0].mediaPreviewUrl || '';
        item.type = item.type === 'chat' ? mediaAttachments[0].type : item.type;
        item.hasMedia = true;
    }
    if (mediaAttachments.length) item.mediaAttachments = mediaAttachments;
    return item;
}));

const profilePictureJidCandidates = ({ primaryId = '', linkedIds = [], phoneDigits = '' } = {}) => {
    const candidates = new Set();
    [primaryId, ...linkedIds].filter(Boolean).forEach((id) => {
        const value = String(id || '');
        candidates.add(value);
        if (value.endsWith('@c.us')) candidates.add(value.replace('@c.us', '@s.whatsapp.net'));
    });
    const digits = digitsOnly(phoneDigits);
    if (digits.length >= 9) {
        candidates.add(`${digits}@s.whatsapp.net`);
        candidates.add(`${digits}@c.us`);
    }
    return [...candidates].filter((jid) => jid && jid !== 'status@broadcast' && !jid.includes('@g.us'));
};

const resolveProfilePictureUrl = async ({ sock, contactState, primaryId, linkedIds, phoneDigits }) => {
    const cachedUrl = String(contactState?.metadata?.profilePictureUrl || '');
    const fetchedAt = contactState?.metadata?.profilePictureFetchedAt
        ? new Date(contactState.metadata.profilePictureFetchedAt).getTime()
        : 0;
    const cacheFresh = fetchedAt && Date.now() - fetchedAt < 24 * 60 * 60 * 1000;
    if (cachedUrl && cacheFresh) return cachedUrl;
    if (!sock?.profilePictureUrl) return cachedUrl;

    const candidates = profilePictureJidCandidates({ primaryId, linkedIds, phoneDigits });
    for (const jid of candidates) {
        try {
            const url = await sock.profilePictureUrl(jid, 'image');
            if (url) {
                if (contactState?._id) {
                    await ContactState.updateOne(
                        { _id: contactState._id },
                        {
                            $set: {
                                'metadata.profilePictureUrl': url,
                                'metadata.profilePictureFetchedAt': new Date()
                            }
                        }
                    ).catch(() => null);
                }
                return url;
            }
        } catch (_error) {
            // Foto indisponivel, privada ou JID alternativo. Tentamos o proximo candidato.
        }
    }

    if (contactState?._id) {
        await ContactState.updateOne(
            { _id: contactState._id },
            { $set: { 'metadata.profilePictureFetchedAt': new Date() } }
        ).catch(() => null);
    }
    return cachedUrl;
};

const syncCustomerDraftFromState = (state, { action = 'contact_draft_sync' } = {}) => {
    const draft = state?.metadata?.customerDraft || {};
    const draftPhone = draft.phone || state?.phoneDigits || '';
    const draftCountry = draft.country || state?.countryCode || 'EC';
    if (isBrazilTestOnly({ phone: draftPhone, country: draftCountry })) {
        return { ok: false, skipped: true, reason: 'brazil_test_only' };
    }
    const result = syncContactDraftToOnlineAdminPanel(draft, {
        country: draftCountry,
        note: state?.human?.note || '',
        action,
        adminStatus: state?.human?.mode === 'manual' && !statusVisualClosed(draft.status)
            ? 'atendendo'
            : ''
    });
    if (!result?.ok && !result?.skipped) {
        console.warn('Painel Unificado contact sync failed:', result);
    }
    return result;
};

const statusVisualClosed = (status = '') => {
    const value = String(status || '').trim().toLowerCase().replace(/_/g, '-');
    return ['confirmed', 'processing', 'pedido-enviado', 'shipped', 'delivered', 'confirmado', 'enviado', 'entregue'].includes(value);
};

const scopedContactQuery = ({ country = 'EC', sessionId = '' } = {}) => {
    const { sessionIds } = getPanelSessionScope(sessionId);
    const query = {
        chatId: { $exists: true, $nin: ['', 'status@broadcast'], $not: /@g\.us$/ }
    };
    if (country && country !== 'all') {
        query.countryCode = country;
    }
    if (sessionIds.length) {
        query['metadata.lastSessionId'] = { $in: sessionIds };
    }
    return query;
};

const sendWhatsAppMessage = async (phone, content, options = {}) => {
    const chatId = resolveChatId(phone, options.country);
    if (!chatId) return false;

    if (options.isMedia) {
        if (typeof content !== 'string' || !fs.existsSync(content)) return false;
        const ext = content.split('.').pop()?.toLowerCase() || '';
        const isAudioFile = ['ogg', 'opus', 'mp3', 'wav', 'm4a', 'aac', 'webm'].includes(ext);
        if (isAudioFile) {
            return sendAudio(chatId, content, options.isPtt !== false, { sessionId: options.sessionId });
        }

        const mediaType = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'].includes(ext)
            ? 'image'
            : ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)
                ? 'video'
                : 'document';

        if (mediaType === 'image') {
            return sendImage(chatId, content, '', { sessionId: options.sessionId });
        }
        if (mediaType === 'video') {
            return sendVideo(chatId, content, '', { sessionId: options.sessionId });
        }

        const sock = getSock(options.sessionId);
        if (!sock) return false;
        const guard = canSendOutbound({
            jid: chatId,
            text: content,
            sessionId: options.sessionId,
            ownDigits: getOwnPhoneDigits(options.sessionId),
            kind: 'media'
        });
        if (!guard.allowed) {
            console.log(`[LOG_SEND_BLOCKED] media bloqueada -> ${chatId} | reason=${guard.reason}`);
            return false;
        }
        await sock.sendMessage(chatId, { document: { url: content }, fileName: path.basename(content) });
        return true;
    }

    return sendText(chatId, content, null, { sessionId: options.sessionId });
};

const buildLeadRecoveryTemplates = () => ([
    {
        id: 'social_bonus_1',
        label: 'Prueba social + bono',
        text: 'Hola 😊 Le escribo porque varios clientes que estaban con la misma duda ya recibieron su pedido y hoy estan felices con el resultado. Si quiere, le separo su tratamiento con un bono sorpresa para ayudarle a empezar.'
    },
    {
        id: 'social_bonus_2',
        label: 'Abastecer sistema',
        text: 'Hola 😊 Estoy cerrando el abastecimiento del sistema de hoy y todavia alcanzo a incluirle un bono sorpresa. Si quiere, le envio nuevamente la condicion para que no se quede por fuera.'
    },
    {
        id: 'social_delivery',
        label: 'Prueba social de entrega',
        text: 'Hola 😊 Le comparto que seguimos entregando pedidos normalmente y varios clientes ya retiraron o recibieron su tratamiento sin problema. Si quiere, todavia le aparto el suyo con un bono especial.'
    },
    {
        id: 'social_reactivation',
        label: 'Reactivacion suave',
        text: 'Hola 😊 Paso por aqui porque no quiero que deje esto para despues. Si todavia quiere resolverlo, puedo ayudarle hoy con una condicion especial y un bono sorpresa para facilitar su compra.'
    }
]);

const findOrCreateContactState = async (rawPhoneOrChatId) => {
    const raw = String(rawPhoneOrChatId || '');
    const chatId = raw.includes('@') ? raw : `${raw.replace(/\D/g, '')}@c.us`;
    const digits = raw.replace(/\D/g, '');
    const state = await ContactState.findOne({
        $or: [
            { chatId },
            ...(digits ? [
                { phoneDigits: digits },
                { phoneDigits: { $regex: `${digits}$` } }
            ] : [])
        ]
    });
    if (state) return state;
    return new ContactState({
        chatId,
        phoneDigits: digits,
        countryCode: 'EC'
    });
};

const recordManualOutboundMessage = async ({ phone, body, type = 'chat', mediaUrl = '', user, sessionId = '' }) => {
    const chatId = resolveChatId(phone);
    const digits = String(phone || '').replace(/\D/g, '');
    if (!chatId) return;

    await Message.create({
        _id: `manual_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
        chatId,
        peerPhone: digits,
        from: 'bot',
        to: chatId,
        body,
        type,
        mediaUrl,
        timestamp: Math.floor(Date.now() / 1000),
        isFromMe: true,
        isBot: false,
        sessionId: sessionId || '',
        ownerPhoneDigits: digitsOnly(sessionId),
        notifyName: user?.name || user?.email || ''
    }).catch(() => null);
};

// GET /api/whatsapp/status - PUBLIC for QR Code
router.get('/status', (req, res) => {
    const sessionId = req.query.sessionId ? String(req.query.sessionId) : null;
    if (sessionId) {
        return res.json(getStatus(sessionId));
    }
    return res.json({
        defaultSessionId: process.env.WHATSAPP_DEFAULT_SESSION_ID || 'default',
        sessions: getAllStatuses()
    });
});

router.post('/internal/recover-backlog', async (req, res) => {
    if (!isLocalRequest(req)) {
        return res.status(403).json({ error: 'local_only' });
    }

    try {
        const since = req.body?.since ? new Date(req.body.since) : new Date(Date.now() - 12 * 60 * 60 * 1000);
        const limit = Math.min(50, Math.max(1, Number.parseInt(String(req.body?.limit || '20'), 10) || 20));
        const delayMs = Math.min(60000, Math.max(0, Number.parseInt(String(req.body?.delayMs || '8000'), 10) || 8000));
        const dryRun = Boolean(req.body?.dryRun);
        const result = await processBacklogRecovery({ since, limit, delayMs, dryRun });
        return res.json({ ...result, since, selected: result.items?.length || 0 });
    } catch (error) {
        console.error('[RECOVERY] falha ao recuperar backlog:', error);
        return res.status(500).json({ error: error.message });
    }
});

router.post('/internal/reconcile-atendimento', async (req, res) => {
    if (!isLocalRequest(req)) {
        return res.status(403).json({ error: 'local_only' });
    }

    try {
        const fromId = Math.max(1, Number.parseInt(String(req.body?.fromId || process.env.ADMIN_PANEL_ATENDIMENTO_FROM_ID || '1725'), 10) || 1725);
        const createMissing = req.body?.createMissing !== false;
        const result = await reconcileAdminPanelAtendimento({ fromId, createMissing });
        return res.json(result);
    } catch (error) {
        console.error('[ADMIN_ATENDIMENTO] falha ao reconciliar atendimento:', error);
        return res.status(500).json({ error: error.message });
    }
});

// Protect all WhatsApp routes (except status)
router.use(authMiddleware);

router.get('/sessions', adminOnly, (req, res) => {
    res.json({
        defaultSessionId: process.env.WHATSAPP_DEFAULT_SESSION_ID || 'default',
        sessions: getAllStatuses()
    });
});

router.get('/sender-pool', adminOnly, (_req, res) => {
    res.json(getSenderPoolStatus());
});

router.get('/dashboard-metrics', async (req, res) => {
    try {
        const country = normalizePanelCountry(req.query.country);
        const now = new Date();
        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - 6);
        startOfWeek.setHours(0, 0, 0, 0);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const closedStatuses = ['confirmed', 'processing', 'shipped', 'delivered'];

        const contactQuery = scopedContactQuery({ country, sessionId: req.query.sessionId });
        const orderQuery = { country };
        const [contacts, orders] = await Promise.all([
            ContactState.find(contactQuery, {
                createdAt: 1,
                updatedAt: 1,
                firstInboundAt: 1,
                lastInboundAt: 1,
                lastOutboundAt: 1,
                human: 1,
                chatId: 1,
                phoneDigits: 1,
                metadata: 1
            }).lean(),
            Order.find({
                ...orderQuery,
                $or: [
                    { createdAt: { $gte: startOfMonth } },
                    { updatedAt: { $gte: startOfMonth } },
                    { status: { $in: closedStatuses } }
                ]
            }, { createdAt: 1, updatedAt: 1, status: 1, total: 1 }).lean()
        ]);

        const contactDate = (contact, kind) => {
            if (kind === 'entered') return new Date(contact.firstInboundAt || contact.createdAt || 0);
            return new Date(contact.lastInboundAt || contact.lastOutboundAt || contact.updatedAt || contact.createdAt || 0);
        };
        const inPeriod = (date, start) => date instanceof Date && !Number.isNaN(date.getTime()) && date >= start;
        const contactCounts = (start) => ({
            entered: contacts.filter((contact) => realPhoneFromState(contact) && inPeriod(contactDate(contact, 'entered'), start)).length,
            active: contacts.filter((contact) => realPhoneFromState(contact) && inPeriod(contactDate(contact, 'active'), start)).length
        });
        const orderCounts = (start) => {
            const periodOrders = orders.filter((order) => (
                closedStatuses.includes(String(order.status || '').toLowerCase())
                && inPeriod(new Date(order.updatedAt || order.createdAt || 0), start)
            ));
            return {
                closed: periodOrders.length,
                revenue: periodOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0)
            };
        };

        res.json({
            country,
            generatedAt: now.toISOString(),
            manualNow: contacts.filter((contact) => realPhoneFromState(contact) && contact.human?.mode === 'manual').length,
            today: { ...contactCounts(startOfDay), ...orderCounts(startOfDay) },
            week: { ...contactCounts(startOfWeek), ...orderCounts(startOfWeek) },
            month: { ...contactCounts(startOfMonth), ...orderCounts(startOfMonth) }
        });
    } catch (error) {
        console.error('Dashboard metrics error:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard metrics' });
    }
});

router.post('/chats/action', async (req, res) => {
    try {
        const action = normalizeManualAction(req.body?.action);
        if (!MANUAL_ACTION_TAGS[action]) {
            return res.status(400).json({ error: 'Acao invalida' });
        }
        const chatId = String(req.body?.chatId || '').trim();
        const phone = String(req.body?.phone || '').trim();
        const country = normalizePanelCountry(req.body?.country || 'EC');
        const state = await findOrCreateContactStateForPanel({ chatId, phone, country });
        const tag = `manual:${action}`;
        const tags = Array.isArray(state.tags) ? state.tags : [];
        state.tags = [...new Set([...tags, tag])];
        state.metadata = {
            ...(state.metadata || {}),
            lastManualAction: {
                action,
                label: MANUAL_ACTION_TAGS[action],
                at: new Date(),
                by: req.user?.name || req.user?.email || ''
            },
            manualActions: [
                ...(((state.metadata || {}).manualActions || []).slice(-24)),
                {
                    action,
                    label: MANUAL_ACTION_TAGS[action],
                    at: new Date(),
                    by: req.user?.name || req.user?.email || ''
                }
            ]
        };
        await state.save();
        res.json({
            success: true,
            tags: state.tags,
            action: state.metadata.lastManualAction
        });
    } catch (error) {
        console.error('Chat action tag error:', error);
        res.status(500).json({ error: error.message || 'Failed to update chat action' });
    }
});

router.post('/sessions/:sessionId/start', adminOnly, async (req, res) => {
    try {
        const sessionId = registerWhatsAppSession(req.params.sessionId);
        await startWhatsApp(sessionId);
        res.json({ success: true, session: getStatus(sessionId) });
    } catch (error) {
        console.error('Start WhatsApp session error:', error);
        res.status(500).json({ error: error.message || 'Failed to start session' });
    }
});

router.post('/sessions/:sessionId/disconnect', adminOnly, async (req, res) => {
    try {
        const sessionId = registerWhatsAppSession(req.params.sessionId);
        const logout = String(req.body?.logout ?? 'true').toLowerCase() !== 'false';
        const session = await disconnectWhatsApp(sessionId, { logout });
        res.json({ success: true, session });
    } catch (error) {
        console.error('Disconnect WhatsApp session error:', error);
        res.status(500).json({ error: error.message || 'Failed to disconnect session' });
    }
});

// GET /api/whatsapp/chats
router.get('/chats', async (req, res) => {
    try {
        const onlyLinked = String(req.query.onlyLinked || '').toLowerCase() === 'true' || String(req.query.onlyLinked || '') === '1';
        const allCountries = String(req.query.allCountries || '').toLowerCase() === 'true' || String(req.query.allCountries || '') === '1';
        const countryFilter = allCountries ? null : normalizePanelCountry(req.query.country);
        const pictureSock = getSock(req.query.sessionId);

        const buildPhoneKeys = ({ digits, country }) => {
            const d = String(digits || '').replace(/\D/g, '');
            const keys = new Set();
            const last10 = d.length >= 10 ? d.slice(-10) : '';
            const last9 = d.length >= 9 ? d.slice(-9) : '';
            if (last10) keys.add(last10);
            if (!last10 && last9) keys.add(last9);
            if (country === 'EC' && last10) keys.add(`593${last10}`);
            if (country === 'CO' && last10) keys.add(`57${last10}`);
            if (d.length >= 10 && d.length <= 15) keys.add(d);
            return Array.from(keys);
        };

        const fuzzyDigitsPattern = (digits) => {
            const d = String(digits || '').replace(/\D/g, '');
            if (!d) return null;
            return d.split('').join('\\D*');
        };

        const usableChatId = (value) => {
            const id = String(value || '');
            if (!id || id === 'bot' || !isValidPanelChatId(id)) return null;
            return id;
        };

        const conversations = new Map();
        const addConversationId = (message, rawId) => {
            const id = usableChatId(rawId);
            if (!id) return;
            const idDigits = digitsOnly(id);
            const rawPeerPhone = digitsOnly(message.peerPhone);
            const peerPhone = id.endsWith('@lid') && rawPeerPhone === idDigits ? '' : rawPeerPhone;
            const key = peerPhone || id;
            if (!conversations.has(key)) {
                conversations.set(key, {
                    key,
                    phone: peerPhone,
                    ids: new Set(),
                    primaryId: id,
                    timestamp: message.timestamp || 0
                });
            }

            const conversation = conversations.get(key);
            conversation.ids.add(id);
            if (peerPhone && !conversation.phone) conversation.phone = peerPhone;
            if ((message.timestamp || 0) >= (conversation.timestamp || 0)) {
                conversation.primaryId = id;
                conversation.timestamp = message.timestamp || 0;
            }
        };

        const recentStateQuery = allCountries
            ? { chatId: { $exists: true, $nin: ['', 'status@broadcast'], $not: /@g\.us$/ } }
            : scopedContactQuery({ country: countryFilter || 'EC', sessionId: req.query.sessionId });
        const recentStates = await ContactState.find(
            recentStateQuery,
            { chatId: 1, phoneDigits: 1, updatedAt: 1, metadata: 1 }
        )
            .sort({ updatedAt: -1 })
            .limit(500)
            .lean()
            .catch(() => []);

        recentStates.forEach((state) => {
            const realPhone = realPhoneFromState(state);
            if (!realPhone) return;
            addConversationId({
                peerPhone: realPhone,
                timestamp: state.updatedAt ? Math.floor(new Date(state.updatedAt).getTime() / 1000) : 0
            }, state.chatId);
        });

        const byPrimaryId = new Map();
        for (const [key, conversation] of Array.from(conversations.entries())) {
            const primaryId = conversation.primaryId;
            if (!primaryId) continue;
            const existing = byPrimaryId.get(primaryId);
            if (!existing) {
                byPrimaryId.set(primaryId, { key, conversation });
                continue;
            }

            conversation.ids.forEach((id) => existing.conversation.ids.add(id));
            if (!existing.conversation.phone && conversation.phone) existing.conversation.phone = conversation.phone;
            if ((conversation.timestamp || 0) > (existing.conversation.timestamp || 0)) {
                existing.conversation.timestamp = conversation.timestamp || 0;
            }
            conversations.delete(key);
        }

        for (const [key, conversation] of Array.from(conversations.entries())) {
            if (conversation.phone) continue;
            const lidIds = Array.from(conversation.ids).filter((id) => String(id).endsWith('@lid'));
            if (!lidIds.length) continue;

            const stateByLid = await ContactState.findOne({ chatId: { $in: lidIds } }).lean().catch(() => null);
            const messageWithPhone = await Message.findOne({
                $or: lidIds.flatMap((id) => ([{ chatId: id }, { from: id }, { to: id }])),
                peerPhone: { $exists: true, $ne: '' }
            }).sort({ timestamp: -1 }).lean().catch(() => null);
            const resolvedPhone = realPhoneFromState(stateByLid || {}) || digitsOnly(messageWithPhone?.peerPhone);
            if (!resolvedPhone) continue;

            const target = conversations.get(resolvedPhone);
            conversations.delete(key);
            if (target) {
                conversation.ids.forEach((id) => target.ids.add(id));
                if ((conversation.timestamp || 0) > (target.timestamp || 0)) {
                    target.primaryId = conversation.primaryId;
                    target.timestamp = conversation.timestamp || 0;
                }
            } else {
                conversation.key = resolvedPhone;
                conversation.phone = resolvedPhone;
                conversations.set(resolvedPhone, conversation);
            }
        }

        const allChats = Array.from(conversations.values())
            .filter((conversation) => usableChatId(conversation.primaryId) && !String(conversation.primaryId).includes('@g.us') && conversation.phone)
            .map((conversation) => ({
                conversationKey: conversation.key,
                linkedIds: Array.from(conversation.ids),
                phoneHint: conversation.phone,
                id: {
                    _serialized: conversation.primaryId,
                    user: conversation.phone || String(conversation.primaryId).replace(/\D/g, '') || conversation.primaryId
                },
                name: null,
                lastMessage: null,
                isGroup: String(conversation.primaryId).includes('@g.us')
            }));

        // Enrich chats with Order data
        const enrichedChats = await Promise.all(allChats.map(async (c) => {
            let phone = c.phoneHint || c.id.user; // default
            const isLid = c.id._serialized.endsWith('@lid');
            const linkedIds = Array.isArray(c.linkedIds) && c.linkedIds.length ? c.linkedIds : [c.id._serialized];
            const linkedConditions = linkedIds.flatMap((id) => ([
                { chatId: id },
                { from: id },
                { to: id }
            ]));
            const lastMessageForChat = await Message.findOne({
                $or: linkedConditions
            }).sort({ timestamp: -1 }).lean().catch(() => null);

            // If it's an LID, use the phone captured by the dispatcher instead of the opaque WhatsApp id.
            if (isLid) {
                const candidates = new Set();
                if (c.phoneHint) candidates.add(c.phoneHint);
                if (lastMessageForChat?.peerPhone) candidates.add(lastMessageForChat.peerPhone);
                const stateByLid = await ContactState.findOne({ chatId: { $in: linkedIds } }).lean().catch(() => null);
                if (stateByLid?.phoneDigits) candidates.add(stateByLid.phoneDigits);

                const found = Array.from(candidates)
                    .map((value) => String(value || '').replace(/\D/g, ''))
                    .find((value) => value.length >= 9);

                if (found) {
                    phone = found;
                }
            }

            const phoneDigits = String(phone || '').replace(/\D/g, '');
            const phoneCountryPrefix = countryPrefixFromDigits(phoneDigits);
            const keys = buildPhoneKeys({ digits: phoneDigits, country: countryFilter });

            const baseQuery = {};
            if (countryFilter) baseQuery.country = countryFilter;

            let order = null;
            const canMatchEcuadorOrder = phoneCountryPrefix !== 'BR';
            if (canMatchEcuadorOrder && keys.length) {
                const sortedKeys = [...keys].sort((a, b) => b.length - a.length);
                const orConditions = sortedKeys
                    .map((k) => fuzzyDigitsPattern(k))
                    .filter(Boolean)
                    .map((pattern) => ({ 'customer.phone': { $regex: `${pattern}\\D*$`, $options: 'i' } }));

                if (orConditions.length > 0) {
                    order = await Order.findOne({
                        ...baseQuery,
                        $or: orConditions
                    }).sort({ createdAt: -1 });
                }
            }
            if (canMatchEcuadorOrder && !order && keys.length) {
                const sortedKeys = [...keys].sort((a, b) => b.length - a.length);
                const orConditions = sortedKeys
                    .map((k) => fuzzyDigitsPattern(k))
                    .filter(Boolean)
                    .map((pattern) => ({ 'customer.phone': { $regex: pattern, $options: 'i' } }));

                if (orConditions.length > 0) {
                    order = await Order.findOne({
                        ...baseQuery,
                        $or: orConditions
                    }).sort({ createdAt: -1 });
                }
            }

            // If we matched an order, force the phone to match the order for consistency
            if (order && order.customer && order.customer.phone) {
                // Format it nicely or just use digits?
                // phone = order.customer.phone; 
            }

            const stateOr = linkedIds.map((id) => ({ chatId: id }));
            if (phoneDigits) {
                stateOr.push({ phoneDigits: phoneDigits });
                stateOr.push({ phoneDigits: { $regex: `${phoneDigits}$` } });
            }
            const contactState = await ContactState.findOne({ $or: stateOr }).sort({ updatedAt: -1 }).lean().catch(() => null);
            const customerDraft = contactState?.metadata?.customerDraft || {};
            const panelLastReadAt = contactState?.metadata?.panelLastReadAt
                ? Math.floor(new Date(contactState.metadata.panelLastReadAt).getTime() / 1000)
                : 0;

            const lastMessage = lastMessageForChat || await Message.findOne({
                $or: [
                    ...linkedConditions,
                    ...(phoneDigits ? [{ peerPhone: phoneDigits }] : [])
                ]
            }).sort({ timestamp: -1 }).lean().catch(() => null);
            const unreadCount = await Message.countDocuments({
                $or: [
                    ...linkedConditions,
                    ...(phoneDigits ? [{ peerPhone: phoneDigits }] : [])
                ],
                isFromMe: false,
                timestamp: { $gt: panelLastReadAt || 0 }
            }).catch(() => 0);
            const profilePictureUrl = await resolveProfilePictureUrl({
                sock: pictureSock,
                contactState,
                primaryId: c.id._serialized,
                linkedIds,
                phoneDigits
            });

            return {
                id: c.id._serialized,
                name: order?.customer?.name || customerDraft.name || c.name || c.id.user,
                phone: order?.customer?.phone || customerDraft.phone || phone, // This is now the real phone number (resolved)
                profilePictureUrl,
                unreadCount,
                lastMessage: lastMessage ? {
                    body: lastMessage.body,
                    timestamp: lastMessage.timestamp,
                    isFromMe: lastMessage.isFromMe,
                    type: lastMessage.type
                } : null,
                isGroup: c.isGroup,
                // Enriched Fields
                country: order ? order.country : contactState?.countryCode || null,
                city: order?.customer?.city || customerDraft.city || null,
                province: order?.customer?.province || customerDraft.province || null,
                address: order?.customer?.address || customerDraft.address || null,
                reference: order?.customer?.reference || customerDraft.reference || null,
                orderId: order ? order.orderId : null,
                orderStatus: order ? order.status : customerDraft.status || null,
                quantity: order?.package?.quantity || customerDraft.quantity || null,
                packageLabel: order?.package?.label || null,
                total: order?.total ?? customerDraft.total ?? null,
                currency: order?.currency || null,
                notes: order?.notes || contactState?.human?.note || '',
                assignedAgent: contactState?.assignedAgent || null,
                tags: contactState?.tags || [],
                human: contactState?.human || { mode: 'auto' }
            };
        }));

        const filtered = (onlyLinked ? enrichedChats.filter((c) => !!c.orderId) : enrichedChats)
            .filter((c) => !c.isGroup && digitsOnly(c.phone).length >= 9)
            .filter((c) => !countryFilter || isAllowedPanelPhoneForCountry(c.phone, countryFilter));

        filtered.sort((a, b) => {
            const tA = a.lastMessage?.timestamp || 0;
            const tB = b.lastMessage?.timestamp || 0;
            return tB - tA;
        });

        res.json(filtered);
    } catch (error) {
        console.error('Get chats error:', error);
        res.status(500).json({ error: 'Failed to fetch chats' });
    }
});

// GET /api/whatsapp/messages/:phone
router.get('/messages/:phone', async (req, res) => {
    try {
        const { phone } = req.params;
        const sync = String(req.query.sync || '').toLowerCase() === 'true' || String(req.query.sync || '') === '1';
        const chatId = phone.includes('@') ? phone : `${phone}@c.us`;
        const digits = phone.replace(/\D/g, '');
        const isLidChat = chatId.endsWith('@lid');
        const tails = phoneTailCandidates(digits);

        const stateQuery = phone.includes('@')
            ? { chatId }
            : {
                $or: [
                    ...(digits ? [{ phoneDigits: digits }, { chatId: { $regex: digits } }] : []),
                    ...tails.map((tail) => ({ phoneDigits: { $regex: `${tail}$` } })),
                    ...tails.map((tail) => ({ 'metadata.lastSenderPn': { $regex: tail } })),
                    ...tails.map((tail) => ({ 'metadata.customerDraft.phone': { $regex: tail } }))
                ]
            };
        const states = await ContactState.find(stateQuery).sort({ updatedAt: -1 }).limit(20).lean().catch(() => []);
        const linkedChatIds = [...new Set([
            chatId,
            ...states.map((state) => state.chatId).filter(Boolean)
        ].filter(isValidPanelChatId))];

        const lastLinkedMessage = await Message.findOne({
            $or: linkedChatIds.flatMap((id) => ([{ chatId: id }, { from: id }, { to: id }])),
            peerPhone: { $exists: true, $ne: '' }
        }).sort({ timestamp: -1 }).lean().catch(() => null);
        const state = states[0] || null;
        const realDigits = isLidChat
            ? (state?.phoneDigits || lastLinkedMessage?.peerPhone || '')
            : digits;

        const realPhones = [...new Set([
            realDigits,
            digits,
            ...states.map(realPhoneFromState),
            ...states.map((item) => digitsOnly(item.metadata?.customerDraft?.phone)),
            digitsOnly(lastLinkedMessage?.peerPhone)
        ].filter((item) => item && item.length >= 8))];

        const or = linkedChatIds.flatMap((id) => ([
            { chatId: id },
            { from: id },
            { to: id }
        ]));
        realPhones.forEach((item) => or.push({ peerPhone: item }));
        phoneTailCandidates(realPhones[0] || digits).forEach((tail) => {
            or.push({ peerPhone: { $regex: `${tail}$` } });
        });

        const messages = await Message.find({ $or: or })
            .sort({ timestamp: 1 })
            .limit(100);

        if (sync || messages.length < 5) {
            try {
                // No direct history sync is available on the Baileys runtime today.
            } catch {
                // ignore
            }
        }

        res.json(await enrichMessagesWithMedia(messages));
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

router.post('/chats/read', async (req, res) => {
    try {
        const { chatId = '', phone = '' } = req.body || {};
        const rawChatId = String(chatId || '');
        const digits = digitsOnly(phone || chatId);
        const query = {
            $or: [
                ...(rawChatId ? [{ chatId: rawChatId }] : []),
                ...(digits ? [
                    { phoneDigits: digits },
                    { phoneDigits: { $regex: `${digits}$` } },
                    { 'metadata.lastSenderPn': { $regex: digits } }
                ] : [])
            ]
        };
        if (!query.$or.length) {
            return res.status(400).json({ error: 'Chat ou telefone obrigatorio' });
        }

        const result = await ContactState.updateMany(query, {
            $set: {
                'metadata.panelLastReadAt': new Date()
            }
        });
        res.json({ success: true, matched: result.matchedCount || 0, modified: result.modifiedCount || 0 });
    } catch (error) {
        console.error('Mark chat read error:', error);
        res.status(500).json({ error: 'Failed to mark chat as read' });
    }
});

router.get('/customer-profile/:phone', async (req, res) => {
    try {
        const raw = String(req.params.phone || '');
        const digits = digitsOnly(raw);
        const tails = phoneTailCandidates(digits);
        const stateQuery = raw.includes('@')
            ? { chatId: raw }
            : {
                $or: [
                    ...(digits ? [{ phoneDigits: digits }, { chatId: { $regex: digits } }] : []),
                    ...tails.map((tail) => ({ phoneDigits: { $regex: `${tail}$` } })),
                    ...tails.map((tail) => ({ 'metadata.lastSenderPn': { $regex: tail } }))
                ]
            };

        const states = await ContactState.find(stateQuery).sort({ updatedAt: -1 }).limit(20).lean();
        const realPhones = [...new Set([
            digits,
            ...states.map(realPhoneFromState),
            ...states.map((state) => digitsOnly(state.metadata?.customerDraft?.phone))
        ].filter((item) => item && item.length >= 8))];
        const chatIds = [...new Set(states.map((state) => state.chatId).filter(Boolean))];
        const messageOr = [
            ...chatIds.flatMap((chatId) => ([{ chatId }, { from: chatId }, { to: chatId }])),
            ...realPhones.map((phone) => ({ peerPhone: phone })),
            ...phoneTailCandidates(realPhones[0] || digits).map((tail) => ({ peerPhone: { $regex: `${tail}$` } }))
        ];

        const messages = messageOr.length
            ? await Message.find({ $or: messageOr }).sort({ timestamp: -1 }).limit(80).lean()
            : [];
        const allOwnerPhones = [...new Set(messages.map((message) => digitsOnly(message.ownerPhoneDigits || message.sessionId)).filter(Boolean))];
        const inboundCount = messages.filter((message) => !message.isFromMe).length;
        const outboundCount = messages.filter((message) => message.isFromMe).length;
        const lastInbound = messages.find((message) => !message.isFromMe) || null;
        const lastOutbound = messages.find((message) => message.isFromMe) || null;
        const latestState = states[0] || null;
        const customerDraft = latestState?.metadata?.customerDraft || {};
        const primaryPhone = realPhones.find((phone) => phone.startsWith('55') || phone.startsWith('593')) || realPhones[0] || digits || '';

        const canMatchOrders = countryPrefixFromDigits(primaryPhone) !== 'BR';
        const orderTails = canMatchOrders ? [...new Set(realPhones.flatMap(phoneTailCandidates))] : [];
        const orderOr = orderTails.map((tail) => ({ 'customer.phone': { $regex: tail } }));
        const orders = orderOr.length
            ? await Order.find({ $or: orderOr }).sort({ updatedAt: -1, createdAt: -1 }).limit(10).lean()
            : [];
        const activeOrder = orders.find((order) => !['delivered', 'cancelled', 'returned'].includes(String(order.status || '').toLowerCase())) || orders[0] || null;
        const allChannels = [...new Set([
            ...chatIds,
            ...realPhones,
            ...allOwnerPhones.map((phone) => `atendido por ${phone}`)
        ].filter(Boolean))];

        const events = [
            ...messages.slice(0, 12).map((message) => ({
                at: message.timestamp ? new Date(message.timestamp * 1000) : message.createdAt,
                type: message.isFromMe ? 'saida' : 'entrada',
                label: message.isFromMe
                    ? `Mensagem enviada${message.ownerPhoneDigits ? ` por ${message.ownerPhoneDigits}` : ''}`
                    : 'Mensagem recebida',
                detail: String(message.body || message.type || '').slice(0, 120)
            })),
            ...orders.slice(0, 5).map((order) => ({
                at: order.updatedAt || order.createdAt,
                type: 'pedido',
                label: `${order.orderId || 'Pedido'} · ${order.status || 'sem status'}`,
                detail: [
                    order.customer?.name,
                    order.package?.quantity ? `${order.package.quantity} frasco(s)` : '',
                    order.total ? `${order.total} ${order.currency || 'USD'}` : ''
                ].filter(Boolean).join(' · ')
            }))
        ].sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime()).slice(0, 12);

        res.json({
            primaryPhone,
            displayName: activeOrder?.customer?.name || customerDraft.name || latestState?.metadata?.profileName || primaryPhone || raw,
            countryCode: latestState?.countryCode || countryPrefixFromDigits(primaryPhone) || activeOrder?.country || '',
            channels: allChannels,
            stats: {
                inboundCount,
                outboundCount,
                orderCount: orders.length,
                lastInboundAt: lastInbound?.timestamp ? new Date(lastInbound.timestamp * 1000) : null,
                lastOutboundAt: lastOutbound?.timestamp ? new Date(lastOutbound.timestamp * 1000) : null
            },
            activeOrder: activeOrder ? {
                orderId: activeOrder.orderId,
                status: activeOrder.status,
                quantity: activeOrder.package?.quantity || null,
                total: activeOrder.total ?? null,
                currency: activeOrder.currency || 'USD',
                dropiOrderId: activeOrder.dropiOrderId || '',
                shippingStatus: activeOrder.shippingStatus || '',
                customer: activeOrder.customer || {}
            } : null,
            continuity: {
                canContinueAcrossNumbers: true,
                lastSessionId: latestState?.metadata?.lastSessionId || '',
                currentOwnerPhoneDigits: latestState?.metadata?.senderWallet?.assignedSessionId || '',
                failoverFromSessionId: latestState?.metadata?.senderWallet?.failoverFromSessionId || '',
                lastFailoverAt: latestState?.metadata?.senderWallet?.lastFailoverAt || null
            },
            events
        });
    } catch (error) {
        console.error('Customer profile error:', error);
        res.status(500).json({ error: 'Failed to fetch customer profile' });
    }
});

router.get('/contact-state/:phone', async (req, res) => {
    try {
        const raw = String(req.params.phone || '');
        const digits = raw.replace(/\D/g, '');

        const query = raw.includes('@')
            ? { chatId: raw }
            : {
                $or: [
                    { phoneDigits: digits },
                    { phoneDigits: { $regex: `${digits}$` } },
                    { chatId: { $regex: digits } }
                ]
            };

        const state = await ContactState.findOne(query).sort({ updatedAt: -1 }).lean();
        if (!state) {
            return res.status(404).json({ error: 'Contact state not found' });
        }

        res.json(state);
    } catch (error) {
        console.error('Get contact state error:', error);
        res.status(500).json({ error: 'Failed to fetch contact state' });
    }
});

router.post('/contacts', async (req, res) => {
    try {
        const {
            name = '',
            phone = '',
            note = '',
            country = 'EC',
            mode = 'manual'
        } = req.body || {};
        const digits = digitsOnly(phone);
        if (digits.length < 8) {
            return res.status(400).json({ error: 'Telefone invalido' });
        }
        const effectiveCountry = digits.startsWith('55')
            ? 'BR'
            : (String(country || 'EC').toUpperCase() || 'EC');

        const state = await findOrCreateContactState(digits);
        state.phoneDigits = digits;
        state.countryCode = effectiveCountry;
        state.human = {
            ...(state.human || {}),
            mode: mode === 'auto' ? 'auto' : 'manual',
            assignedTo: req.user?._id?.toString?.() || state.human?.assignedTo || '',
            assignedName: req.user?.name || req.user?.email || state.human?.assignedName || 'Atendimento',
            assignedAt: new Date(),
            pausedUntil: mode === 'auto' ? null : new Date(Date.now() + 240 * 60 * 1000),
            lastManualAt: new Date(),
            lastManualBy: req.user?.name || req.user?.email || 'painel',
            note: String(note || state.human?.note || '').trim()
        };
        state.metadata = {
            ...(state.metadata || {}),
            manuallyCreatedAt: new Date().toISOString(),
            manuallyCreatedBy: req.user?.name || req.user?.email || 'painel',
            customerDraft: {
                ...(state.metadata?.customerDraft || {}),
                name: String(name || '').trim(),
                country: effectiveCountry,
                phone: String(phone || '').trim(),
                updatedAt: new Date().toISOString()
            }
        };
        await state.save();
        const unifiedSync = syncCustomerDraftFromState(state, { action: 'contact_created_from_whatsapp_panel' });
        res.json({ success: true, state, unifiedSync });
    } catch (error) {
        console.error('Create WhatsApp contact error:', error);
        res.status(500).json({ error: 'Failed to create contact' });
    }
});

router.post('/contact-state/:phone/claim', async (req, res) => {
    try {
        const state = await findOrCreateContactState(req.params.phone);
        const minutes = Math.max(15, Number.parseInt(String(req.body?.minutes || '240'), 10) || 240);
        state.human = {
            ...(state.human || {}),
            mode: 'manual',
            assignedTo: req.user._id.toString(),
            assignedName: req.user.name || req.user.email,
            assignedAt: new Date(),
            pausedUntil: new Date(Date.now() + minutes * 60 * 1000),
            lastManualAt: new Date(),
            lastManualBy: req.user.name || req.user.email,
            note: req.body?.note || state.human?.note || ''
        };
        state.metadata = {
            ...(state.metadata || {}),
            lastHumanActionAt: new Date(),
            lastHumanAction: 'claim',
            customerDraft: {
                ...(state.metadata?.customerDraft || {}),
                phone: state.metadata?.customerDraft?.phone || state.phoneDigits || digitsOnly(req.params.phone),
                country: state.metadata?.customerDraft?.country || state.countryCode || 'EC',
                status: statusVisualClosed(state.metadata?.customerDraft?.status) ? state.metadata.customerDraft.status : 'atendendo',
                updatedAt: new Date().toISOString()
            }
        };
        const tags = Array.isArray(state.tags) ? state.tags : [];
        if (!tags.some((tag) => String(tag || '').startsWith('manual:'))) {
            state.tags = [...new Set([...tags, 'manual:atendimento_iniciado'])];
        }
        await state.save();
        const unifiedSync = syncCustomerDraftFromState(state, { action: 'whatsapp_claim_atendendo' });
        res.json({ success: true, state, unifiedSync });
    } catch (error) {
        console.error('Claim contact error:', error);
        res.status(500).json({ error: 'Failed to claim contact' });
    }
});

router.post('/contact-state/:phone/release', async (req, res) => {
    try {
        const state = await findOrCreateContactState(req.params.phone);
        state.human = {
            ...(state.human || {}),
            mode: 'auto',
            pausedUntil: null,
            lastManualAt: new Date(),
            lastManualBy: req.user.name || req.user.email
        };
        state.metadata = {
            ...(state.metadata || {}),
            lastHumanActionAt: new Date(),
            lastHumanAction: 'release'
        };
        await state.save();
        res.json({ success: true, state });
    } catch (error) {
        console.error('Release contact error:', error);
        res.status(500).json({ error: 'Failed to release contact' });
    }
});

router.patch('/contact-state/:phone', async (req, res) => {
    try {
        const state = await findOrCreateContactState(req.params.phone);
        const { note, mode, assignedName, country, customerDraft } = req.body || {};
        state.human = {
            ...(state.human || {}),
            ...(mode === 'auto' || mode === 'manual' ? { mode } : {}),
            ...(typeof note === 'string' ? { note } : {}),
            ...(typeof assignedName === 'string' ? { assignedName } : {}),
            lastManualAt: new Date(),
            lastManualBy: req.user.name || req.user.email
        };
        if (customerDraft && typeof customerDraft === 'object') {
            const draftPhoneDigits = String(customerDraft.phone || '').replace(/\D/g, '');
            const effectiveCountry = draftPhoneDigits.startsWith('55')
                ? 'BR'
                : (String(customerDraft.country || country || state.countryCode || 'EC').toUpperCase() || 'EC');
            const cleanDraft = {
                name: String(customerDraft.name || '').trim(),
                phone: String(customerDraft.phone || '').trim(),
                city: String(customerDraft.city || '').trim(),
                province: String(customerDraft.province || '').trim(),
                address: String(customerDraft.address || '').trim(),
                reference: String(customerDraft.reference || '').trim(),
                status: String(customerDraft.status || '').trim(),
                quantity: String(customerDraft.quantity || '').trim(),
                total: String(customerDraft.total || '').trim(),
                country: effectiveCountry,
                updatedAt: new Date().toISOString()
            };
            if (draftPhoneDigits.length >= 9) {
                state.phoneDigits = draftPhoneDigits;
            }
            state.countryCode = cleanDraft.country;
            state.metadata = {
                ...(state.metadata || {}),
                customerDraft: cleanDraft
            };
        }
        await state.save();
        const unifiedSync = customerDraft && typeof customerDraft === 'object'
            ? syncCustomerDraftFromState(state, { action: 'contact_saved_from_whatsapp_panel' })
            : { ok: false, skipped: true, reason: 'no_customer_draft' };
        res.json({ success: true, state, unifiedSync });
    } catch (error) {
        console.error('Update contact state error:', error);
        res.status(500).json({ error: 'Failed to update contact state' });
    }
});

// GET /api/whatsapp/templates
router.get('/templates', async (req, res) => {
    try {
        const country = normalizePanelCountry(req.query.country);
        const templates = await listAudioTemplates(country);
        res.json({ templates });
    } catch (error) {
        console.error('Get templates error:', error);
        res.status(500).json({ error: 'Failed to fetch templates' });
    }
});

router.get('/reengagement/preview', adminOnly, async (req, res) => {
    try {
        const hours = Number.parseInt(String(req.query.hours || '48'), 10);
        const limit = Number.parseInt(String(req.query.limit || '50'), 10);
        const candidates = await listReengagementCandidates({ hours, limit });
        res.json({ candidates });
    } catch (error) {
        console.error('Reengagement preview error:', error);
        res.status(500).json({ error: 'Failed to build reengagement preview' });
    }
});

router.post('/reengagement/send', adminOnly, async (req, res) => {
    try {
        const { chatId, text, sessionId = null } = req.body || {};
        if (!chatId || !text) {
            return res.status(400).json({ error: 'chatId and text are required' });
        }

        const result = await sendReengagementToChat({ chatId, text, sessionId });
        res.json(result);
    } catch (error) {
        console.error('Reengagement send error:', error);
        res.status(500).json({ error: error.message || 'Failed to send reengagement' });
    }
});

router.get('/reengagement/templates', adminOnly, async (_req, res) => {
    res.json({ templates: buildLeadRecoveryTemplates() });
});

// POST /api/whatsapp/send
router.post('/send', authMiddleware, async (req, res) => {
    try {
        const { phone, message, isMedia, sessionId, fileName = '' } = req.body;
        if (!phone || !message) {
            return res.status(400).json({ error: 'Phone and message required' });
        }

        if (isMedia) {
            if (typeof message !== 'string') {
                return res.status(400).json({ error: 'For media, message must be a string' });
            }

            if (message.startsWith('data:')) {
                const match = message.match(/^data:([^;]+);base64,(.+)$/);
                if (!match) {
                    return res.status(400).json({ error: 'Invalid data URL (expected base64)' });
                }

                const rawMime = match[1];
                const originalFileName = String(fileName || '').trim();
                const extFromName = path.extname(originalFileName).slice(1).toLowerCase();
                const mimeFromExt = (ext) => {
                    const map = {
                        jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
                        webp: 'image/webp', gif: 'image/gif', heic: 'image/heic',
                        heif: 'image/heif', mp3: 'audio/mpeg', mpeg: 'audio/mpeg',
                        ogg: 'audio/ogg', opus: 'audio/ogg', m4a: 'audio/mp4',
                        aac: 'audio/aac', wav: 'audio/wav', webm: 'video/webm',
                        mp4: 'video/mp4', mov: 'video/quicktime'
                    };
                    return map[ext] || '';
                };
                const mime = rawMime === 'application/octet-stream' || rawMime === 'application/bin'
                    ? (mimeFromExt(extFromName) || rawMime)
                    : rawMime;
                const b64 = match[2];
                const buf = Buffer.from(b64, 'base64');
                if (!buf?.length) {
                    return res.status(400).json({ error: 'Empty media payload' });
                }

                const uploadsDir = path.join(process.cwd(), 'public', 'media', 'uploads');
                if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

                const extFromMime = (m, fallbackName = '') => {
                    const map = {
                        'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
                        'image/webp': 'webp', 'image/gif': 'gif', 'image/heic': 'heic',
                        'image/heif': 'heif', 'audio/mpeg': 'mp3',
                        'audio/mp3': 'mp3', 'audio/ogg': 'ogg', 'audio/webm': 'webm',
                        'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/x-m4a': 'm4a',
                        'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm',
                        'video/x-msvideo': 'avi', 'video/x-matroska': 'mkv'
                    };
                    const ext = path.extname(String(fallbackName || '')).slice(1).toLowerCase();
                    return map[m] || ext || (m.split('/')[1] || 'bin').split(';')[0];
                };

                const ext = extFromMime(mime, originalFileName);
                const filename = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}.${ext}`;
                const filePath = path.join(uploadsDir, filename);
                fs.writeFileSync(filePath, buf);

                const mediaKind = mime.startsWith('audio/')
                    ? 'audio'
                    : mime.startsWith('image/')
                        ? 'image'
                        : mime.startsWith('video/')
                            ? 'video'
                            : 'media';
                const sent = await sendWhatsAppMessage(phone, filePath, {
                    isMedia: true,
                    sessionId,
                    isPtt: mediaKind !== 'audio'
                });
                if (sent) {
                    const state = await findOrCreateContactState(phone);
                    state.human = {
                        ...(state.human || {}),
                        mode: 'manual',
                        assignedTo: req.user._id.toString(),
                        assignedName: req.user.name || req.user.email,
                        lastManualAt: new Date(),
                        lastManualBy: req.user.name || req.user.email
                    };
                    await state.save();
                    await recordManualOutboundMessage({
                        phone,
                        body: `${mediaKind === 'audio' ? 'Audio' : mediaKind === 'image' ? 'Imagem' : mediaKind === 'video' ? 'Video' : 'Midia'} enviado pelo painel`,
                        type: mediaKind,
                        mediaUrl: `/media/uploads/${filename}`,
                        user: req.user,
                        sessionId
                    });
                }
                return res.json({ success: sent, storedMediaUrl: `/media/uploads/${filename}` });
            }

            if (!message.startsWith('/media/')) {
                return res.status(400).json({ error: 'For media, message must be a /media/... path or a data:... base64 URL' });
            }

            const baseDir = path.join(process.cwd(), 'public', 'media');
            const relative = message.replace(/^\/media\//, '');
            const resolved = path.normalize(path.join(baseDir, relative));
            if (!resolved.startsWith(baseDir)) {
                return res.status(400).json({ error: 'Invalid media path' });
            }
            const ext = path.extname(resolved).slice(1).toLowerCase();
            const mediaKind = ['ogg', 'opus', 'mp3', 'wav', 'm4a', 'aac', 'webm'].includes(ext)
                ? 'audio'
                : ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'].includes(ext)
                    ? 'image'
                    : ['mp4', 'mov', 'avi', 'mkv'].includes(ext)
                        ? 'video'
                        : 'media';
            const sent = await sendWhatsAppMessage(phone, resolved, { isMedia: true, sessionId });
            if (sent) {
                const state = await findOrCreateContactState(phone);
                state.human = {
                    ...(state.human || {}),
                    mode: 'manual',
                    assignedTo: req.user._id.toString(),
                    assignedName: req.user.name || req.user.email,
                    lastManualAt: new Date(),
                    lastManualBy: req.user.name || req.user.email
                };
                await state.save();
                await recordManualOutboundMessage({
                    phone,
                    body: `${mediaKind === 'audio' ? 'Audio aprovado' : mediaKind === 'image' ? 'Imagem' : mediaKind === 'video' ? 'Video' : 'Midia'} enviado pelo painel`,
                    type: mediaKind,
                    mediaUrl: message,
                    user: req.user,
                    sessionId
                });
            }
            return res.json({ success: sent });
        }

        const sent = await sendWhatsAppMessage(phone, message, { sessionId });
        if (sent) {
            const state = await findOrCreateContactState(phone);
            state.human = {
                ...(state.human || {}),
                mode: 'manual',
                assignedTo: req.user._id.toString(),
                assignedName: req.user.name || req.user.email,
                lastManualAt: new Date(),
                lastManualBy: req.user.name || req.user.email
            };
            await state.save();
            await recordManualOutboundMessage({ phone, body: message, type: 'chat', user: req.user, sessionId });
        }
        res.json({ success: sent });
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ error: error.message || 'Failed to send message' });
    }
});

// DEBUG: Test specific chat retrieval
router.get('/debug-chat/:phone', adminOnly, async (req, res) => {
    try {
        if (!debugRoutesEnabled) {
            return res.status(404).json({ error: 'Not found' });
        }

        const { phone } = req.params;
        const chatId = phone.includes('@') ? phone : `${phone}@c.us`;
        res.json({
            result: 'UNSUPPORTED_ON_BAILEYS_RUNTIME',
            chatId,
            message: 'Debug chat inspection from the legacy client was removed during consolidation.'
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// DEBUG: Fix LIDs
router.get('/fix-lids', adminOnly, async (req, res) => {
    try {
        if (!debugRoutesEnabled) {
            return res.status(404).json({ error: 'Not found' });
        }

        const lids = await Message.distinct('chatId', { chatId: { $regex: /@lid$/ } });
        console.log(`Found ${lids.length} LIDs to fix`);
        const results = [];
        for (const lid of lids) {
            let real = null;

            // Manual mapping for the user's known case
            if (lid === '9681342844995@lid') {
                real = '553184539234@c.us';
            }

            if (real) {
                const newChatId = real.includes('@') ? real : `${real}@c.us`;
                const newPeerPhone = newChatId.replace(/\D/g, '');

                // Update everything
                const updateRes = await Message.updateMany(
                    { chatId: lid },
                    { $set: { chatId: newChatId, peerPhone: newPeerPhone } }
                );

                await Message.updateMany({ from: lid }, { $set: { from: newChatId } });
                await Message.updateMany({ to: lid }, { $set: { to: newChatId } });

                results.push({ lid, real: newChatId, updated: updateRes.modifiedCount });
            } else {
                results.push({ lid, error: 'Could not resolve to c.us' });
            }
        }

        res.json({ count: lids.length, results });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

export default router;
