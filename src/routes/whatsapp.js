import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { listAudioTemplates } from '../services/audioTemplateService.js';
import { authMiddleware, adminOnly } from '../middleware/auth.js';
import Order from '../models/Order.js';
import Message from '../models/Message.js';
import ContactState from '../models/ContactState.js';
import { getAllStatuses, getOwnPhoneDigits, getSock, getStatus, registerWhatsAppSession, startWhatsApp } from '../whatsapp/connection.js';
import { sendText } from '../whatsapp/sendText.js';
import { sendAudio } from '../whatsapp/sendAudio.js';
import { canSendOutbound } from '../whatsapp/outboundGuard.js';
import { getSenderPoolStatus } from '../whatsapp/sessionRouter.js';
import { toWhatsAppChatId } from '../utils/phone.js';
import {
    listReengagementCandidates,
    sendReengagementToChat
} from '../services/reengagementService.js';

const router = express.Router();
const debugRoutesEnabled = String(process.env.ENABLE_WHATSAPP_DEBUG_ROUTES || '') === '1';

const resolveChatId = (phone, country) => (
    String(phone || '').includes('@') ? String(phone) : toWhatsAppChatId(phone, country)
);

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

        const mediaType = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)
            ? 'image'
            : ['mp4', 'mov', 'avi', 'mkv'].includes(ext)
                ? 'video'
                : 'document';

        await sock.sendMessage(chatId, { [mediaType]: { url: content } });
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

const recordManualOutboundMessage = async ({ phone, body, type = 'chat', mediaUrl = '', user }) => {
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

// GET /api/whatsapp/chats
router.get('/chats', async (req, res) => {
    try {
        const onlyLinked = String(req.query.onlyLinked || '').toLowerCase() === 'true' || String(req.query.onlyLinked || '') === '1';
        const countryFilter = req.query.country === 'EC' ? String(req.query.country) : null;

        const buildPhoneKeys = ({ digits, country }) => {
            const d = String(digits || '').replace(/\D/g, '');
            const keys = new Set();
            const last10 = d.length >= 10 ? d.slice(-10) : '';
            const last9 = d.length >= 9 ? d.slice(-9) : '';
            if (last10) keys.add(last10);
            if (!last10 && last9) keys.add(last9);
            if (country === 'EC' && last10) keys.add(`593${last10}`);
            if (d.length >= 10 && d.length <= 15) keys.add(d);
            return Array.from(keys);
        };

        const fuzzyDigitsPattern = (digits) => {
            const d = String(digits || '').replace(/\D/g, '');
            if (!d) return null;
            return d.split('').join('\\D*');
        };

        // Current source of truth for chats is MongoDB, which is populated by the Baileys dispatcher.
        const recentMessages = await Message.find({}, { chatId: 1, from: 1, to: 1, peerPhone: 1, timestamp: 1 })
            .sort({ timestamp: -1 })
            .limit(500);

        const digitsOnly = (value) => String(value || '').replace(/\D/g, '');
        const usableChatId = (value) => {
            const id = String(value || '');
            if (!id || id === 'bot' || id === 'status@broadcast') return null;
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

        recentMessages.forEach(m => {
            addConversationId(m, m.chatId);
            addConversationId(m, m.from);
            addConversationId(m, m.to);
        });

        for (const [key, conversation] of Array.from(conversations.entries())) {
            if (conversation.phone) continue;
            const lidIds = Array.from(conversation.ids).filter((id) => String(id).endsWith('@lid'));
            if (!lidIds.length) continue;

            const stateByLid = await ContactState.findOne({ chatId: { $in: lidIds } }).lean().catch(() => null);
            const messageWithPhone = await Message.findOne({
                $or: lidIds.flatMap((id) => ([{ chatId: id }, { from: id }, { to: id }])),
                peerPhone: { $exists: true, $ne: '' }
            }).sort({ timestamp: -1 }).lean().catch(() => null);
            const resolvedPhone = digitsOnly(stateByLid?.phoneDigits || messageWithPhone?.peerPhone);
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
            .filter((conversation) => usableChatId(conversation.primaryId))
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
            const keys = buildPhoneKeys({ digits: phoneDigits, country: countryFilter });

            const baseQuery = {};
            if (countryFilter) baseQuery.country = countryFilter;

            let order = null;
            if (keys.length) {
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
            if (!order && keys.length) {
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
            const contactState = await ContactState.findOne({ $or: stateOr }).lean().catch(() => null);

            const lastMessage = lastMessageForChat || await Message.findOne({
                $or: [
                    ...linkedConditions,
                    ...(phoneDigits ? [{ peerPhone: phoneDigits }] : [])
                ]
            }).sort({ timestamp: -1 }).lean().catch(() => null);

            return {
                id: c.id._serialized,
                name: c.name || order?.customer?.name || c.id.user,
                phone: phone, // This is now the real phone number (resolved)
               unreadCount: 0,
                lastMessage: lastMessage ? {
                    body: lastMessage.body,
                    timestamp: lastMessage.timestamp,
                    isFromMe: lastMessage.isFromMe,
                    type: lastMessage.type
                } : null,
                isGroup: c.isGroup,
                // Enriched Fields
                country: order ? order.country : contactState?.countryCode || null,
                city: order && order.customer ? order.customer.city : null,
                orderId: order ? order.orderId : null,
                orderStatus: order ? order.status : null,
                assignedAgent: contactState?.assignedAgent || null,
                tags: contactState?.tags || [],
                human: contactState?.human || { mode: 'auto' }
            };
        }));

        const filtered = onlyLinked ? enrichedChats.filter((c) => !!c.orderId) : enrichedChats;

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

        const state = phone.includes('@')
            ? await ContactState.findOne({ chatId }).sort({ updatedAt: -1 }).lean().catch(() => null)
            : null;
        const lastLinkedMessage = phone.includes('@')
            ? await Message.findOne({
                $or: [
                    { chatId },
                    { from: chatId },
                    { to: chatId }
                ],
                peerPhone: { $exists: true, $ne: '' }
            }).sort({ timestamp: -1 }).lean().catch(() => null)
            : null;
        const realDigits = isLidChat
            ? (state?.phoneDigits || lastLinkedMessage?.peerPhone || '')
            : digits;

        const or = [
            { chatId: chatId },
            { from: chatId },
            { to: chatId }
        ];
        if (realDigits) or.push({ peerPhone: String(realDigits).replace(/\D/g, '') });

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

        res.json(messages);
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
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
            lastHumanAction: 'claim'
        };
        await state.save();
        res.json({ success: true, state });
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
        const { note, mode, assignedName } = req.body || {};
        state.human = {
            ...(state.human || {}),
            ...(mode === 'auto' || mode === 'manual' ? { mode } : {}),
            ...(typeof note === 'string' ? { note } : {}),
            ...(typeof assignedName === 'string' ? { assignedName } : {}),
            lastManualAt: new Date(),
            lastManualBy: req.user.name || req.user.email
        };
        await state.save();
        res.json({ success: true, state });
    } catch (error) {
        console.error('Update contact state error:', error);
        res.status(500).json({ error: 'Failed to update contact state' });
    }
});

// GET /api/whatsapp/templates
router.get('/templates', async (req, res) => {
    try {
        const { country } = req.query;
        if (country !== 'EC') {
            return res.status(400).json({ error: 'country must be EC' });
        }
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
router.post('/send', async (req, res) => {
    try {
        const { phone, message, isMedia, sessionId } = req.body;
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

                const mime = match[1];
                const b64 = match[2];
                const buf = Buffer.from(b64, 'base64');
                if (!buf?.length) {
                    return res.status(400).json({ error: 'Empty media payload' });
                }

                const uploadsDir = path.join(process.cwd(), 'public', 'media', 'uploads');
                if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

                const extFromMime = (m) => {
                    const map = {
                        'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
                        'image/webp': 'webp', 'image/gif': 'gif', 'audio/mpeg': 'mp3',
                        'audio/mp3': 'mp3', 'audio/ogg': 'ogg', 'audio/webm': 'webm',
                        'video/mp4': 'mp4'
                    };
                    return map[m] || (m.split('/')[1] || 'bin').split(';')[0];
                };

                const ext = extFromMime(mime);
                const filename = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}.${ext}`;
                const filePath = path.join(uploadsDir, filename);
                fs.writeFileSync(filePath, buf);

                const sent = await sendWhatsAppMessage(phone, filePath, { isMedia: true, sessionId });
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
                        body: 'Audio/midia enviado pelo funil',
                        type: 'media',
                        mediaUrl: `/media/uploads/${filename}`,
                        user: req.user
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
                    body: 'Audio/midia aprovado enviado',
                    type: 'media',
                    mediaUrl: message,
                    user: req.user
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
            await recordManualOutboundMessage({ phone, body: message, type: 'chat', user: req.user });
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
