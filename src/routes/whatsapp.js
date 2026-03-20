import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { listAudioTemplates } from '../services/audioTemplateService.js';
import { authMiddleware, adminOnly } from '../middleware/auth.js';
import Order from '../models/Order.js';
import Message from '../models/Message.js';
import ContactState from '../models/ContactState.js';
import { getSock, getStatus } from '../whatsapp/connection.js';
import { sendText } from '../whatsapp/sendText.js';
import { sendAudio } from '../whatsapp/sendAudio.js';
import { toWhatsAppChatId } from '../utils/phone.js';

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
            return sendAudio(chatId, content, options.isPtt !== false);
        }

        const sock = getSock();
        if (!sock) return false;

        const mediaType = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)
            ? 'image'
            : ['mp4', 'mov', 'avi', 'mkv'].includes(ext)
                ? 'video'
                : 'document';

        await sock.sendMessage(chatId, { [mediaType]: { url: content } });
        return true;
    }

    return sendText(chatId, content);
};

// GET /api/whatsapp/status - PUBLIC for QR Code
router.get('/status', (req, res) => {
    res.json(getStatus());
});

// Protect all WhatsApp routes (except status)
router.use(authMiddleware);

// GET /api/whatsapp/chats
router.get('/chats', async (req, res) => {
    try {
        const onlyLinked = String(req.query.onlyLinked || '').toLowerCase() === 'true' || String(req.query.onlyLinked || '') === '1';
        const countryFilter = req.query.country === 'CO' || req.query.country === 'EC' ? String(req.query.country) : null;

        const buildPhoneKeys = ({ digits, country }) => {
            const d = String(digits || '').replace(/\D/g, '');
            const keys = new Set();
            const last10 = d.length >= 10 ? d.slice(-10) : '';
            const last9 = d.length >= 9 ? d.slice(-9) : '';
            if (last10) keys.add(last10);
            if (!last10 && last9) keys.add(last9);
            if (country === 'CO' && last10) keys.add(`57${last10}`);
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
        const recentMessages = await Message.find({}, { chatId: 1, from: 1, to: 1, timestamp: 1 })
            .sort({ timestamp: -1 })
            .limit(500);

        const activeIds = new Set();
        recentMessages.forEach(m => {
            if (m.chatId && m.chatId !== 'status@broadcast') activeIds.add(m.chatId);
            if (m.from && m.from !== 'status@broadcast') activeIds.add(m.from);
            if (m.to && m.to !== 'status@broadcast') activeIds.add(m.to);
        });

        const allChats = Array.from(activeIds)
            .filter((id) => id && id !== 'bot' && id !== 'status@broadcast')
            .map((id) => ({
                id: { _serialized: id, user: String(id).replace(/\D/g, '') || id },
                name: null,
                lastMessage: null,
                isGroup: String(id).includes('@g.us')
            }));

        // Enrich chats with Order data
        const enrichedChats = await Promise.all(allChats.map(async (c) => {
            let phone = c.id.user; // default
            let isLid = c.id._serialized.endsWith('@lid');

            // If it's an LID, we MUST find the real phone number from messages to match the Order
            if (isLid) {
                // Try reasonable sources for the real phone number
                const candidates = new Set();

                // 1. Check lastMessage
                if (c.lastMessage) {
                    if (c.lastMessage.from && c.lastMessage.from.endsWith('@c.us')) candidates.add(c.lastMessage.from);
                    if (c.lastMessage.to && c.lastMessage.to.endsWith('@c.us')) candidates.add(c.lastMessage.to);
                    if (c.lastMessage.author && c.lastMessage.author.endsWith('@c.us')) candidates.add(c.lastMessage.author);
                }

                // 2. If no luck, maybe fetch a few messages? (Expensive but necessary for these broken chats)
                if (candidates.size === 0) {
                    try {
                        const msgs = await c.fetchMessages({ limit: 3 });
                        msgs.forEach(m => {
                            if (m.from && m.from.endsWith('@c.us')) candidates.add(m.from);
                            if (m.to && m.to.endsWith('@c.us')) candidates.add(m.to);
                            if (m.author && m.author.endsWith('@c.us')) candidates.add(m.author);
                        });
                    } catch (e) { /* ignore */ }
                }

                // Pick the one that is NOT me
                // We don't easily know "me" here without client.info.wid, but usually the other party is the customer
                // Let's filter out known bot numbers if we knew them, but for now just pick the first valid c.us that looks like a user

                const found = Array.from(candidates).find(wid => {
                    // Filter out generic short codes if any? Usually c.us are phones.
                    return true;
                    // ideally we compare against client.info.wid._serialized but client might be null here if using just mongo? 
                    // actually we have client in scope.
                });

                if (found) {
                    phone = found.replace('@c.us', '').replace(/\D/g, '');
                    // Update the display name to be the phone number if it's currently the LID
                    if (c.name === c.id.user) c.name = phone;
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

            return {
                id: c.id._serialized,
                name: c.name || c.id.user,
                phone: phone, // This is now the real phone number (resolved)
               unreadCount: 0,
                lastMessage: c.lastMessage ? {
                    body: c.lastMessage.body,
                    timestamp: c.lastMessage.timestamp
                } : null,
                isGroup: c.isGroup,
                // Enriched Fields
                country: order ? order.country : null,
                city: order && order.customer ? order.customer.city : null,
                orderId: order ? order.orderId : null,
                orderStatus: order ? order.status : null
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

        const or = [
            { chatId: chatId },
            { from: chatId },
            { to: chatId }
        ];
        if (digits) or.push({ peerPhone: digits });

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

// GET /api/whatsapp/templates
router.get('/templates', async (req, res) => {
    try {
        const { country } = req.query;
        if (country !== 'CO' && country !== 'EC') {
            return res.status(400).json({ error: 'country must be CO or EC' });
        }
        const templates = await listAudioTemplates(country);
        res.json({ templates });
    } catch (error) {
        console.error('Get templates error:', error);
        res.status(500).json({ error: 'Failed to fetch templates' });
    }
});

// POST /api/whatsapp/send
router.post('/send', async (req, res) => {
    try {
        const { phone, message, isMedia } = req.body;
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

                const sent = await sendWhatsAppMessage(phone, filePath, { isMedia: true });
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
            const sent = await sendWhatsAppMessage(phone, resolved, { isMedia: true });
            return res.json({ success: sent });
        }

        const sent = await sendWhatsAppMessage(phone, message);
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
