import crypto from 'crypto';
import ContactState from '../models/ContactState.js';
import Message from '../models/Message.js';
import { getZapiChats } from './zapiClient.js';

const digitsOnly = (value) => String(value || '').replace(/\D/g, '');

const parseZapiChatTime = (value) => {
    const raw = Number(String(value || '').trim());
    if (!Number.isFinite(raw) || raw <= 0) return 0;
    return raw > 100000000000 ? raw : raw * 1000;
};

const countryFromPhone = (phone = '') => {
    const digits = digitsOnly(phone);
    if (digits.startsWith('593')) return 'EC';
    if (digits.startsWith('55')) return 'BR';
    return 'OTHER';
};

const chatItems = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.chats)) return payload.chats;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
};

const latestMessageMs = (message = null) => {
    if (!message) return 0;
    const timestampMs = Number(message.timestamp || 0) * 1000;
    const createdMs = message.createdAt ? new Date(message.createdAt).getTime() : 0;
    const updatedMs = message.updatedAt ? new Date(message.updatedAt).getTime() : 0;
    return Math.max(timestampMs || 0, createdMs || 0, updatedMs || 0);
};

const stateQueryForPhone = (phone) => ({
    $or: [
        { phoneDigits: phone },
        { chatId: `${phone}@c.us` },
        { phoneDigits: { $regex: `${phone}$` } },
        ...(phone.length >= 9 ? [{ phoneDigits: { $regex: `${phone.slice(-9)}$` } }] : [])
    ]
});

const messageQueryForPhone = (phone, chatId = `${phone}@c.us`) => ({
    $or: [
        { peerPhone: phone },
        { chatId },
        { from: chatId },
        { to: chatId }
    ]
});

const recentPanelActivityWindowMs = () => {
    const value = Number.parseInt(String(process.env.ZAPI_CHAT_WATCHDOG_PANEL_ACTIVITY_WINDOW_SECONDS || '120'), 10);
    return Math.max(30, Number.isFinite(value) ? value : 120) * 1000;
};

const hasNearbyPanelActivity = async ({ phone, chatId, lastMs }) => {
    const windowMs = recentPanelActivityWindowMs();
    const startedAt = new Date(lastMs - windowMs);
    const endedAt = new Date(lastMs + windowMs);
    return Message.findOne({
        ...messageQueryForPhone(phone, chatId),
        createdAt: { $gte: startedAt, $lte: endedAt },
        provider: { $ne: 'zapi_chat_watchdog' },
        body: { $not: /^ALERTA: o WhatsApp conectado/i }
    })
        .sort({ createdAt: -1 })
        .select({ _id: 1, createdAt: 1, body: 1, from: 1, to: 1 })
        .lean()
        .catch(() => null);
};

const ensureStateForChat = async ({ phone, chat, now }) => {
    const existing = await ContactState.findOne(stateQueryForPhone(phone)).sort({ updatedAt: -1 });
    if (existing) return existing;
    return new ContactState({
        chatId: `${phone}@c.us`,
        phoneDigits: phone,
        countryCode: countryFromPhone(phone),
        human: {
            mode: 'auto',
            assignedName: 'Watchdog Z-API',
            assignedAt: now,
            lastManualBy: 'zapi_watchdog',
            note: 'Interacao tecnica detectada no WhatsApp conectado; sem conteudo de mensagem para exibir.'
        },
        metadata: {
            customerDraft: {
                name: String(chat.name || '').trim(),
                phone: `+${phone}`,
                country: countryFromPhone(phone),
                status: 'novo',
                source: 'zapi_chat_watchdog',
                entryAt: now.toISOString(),
                updatedAt: now.toISOString()
            }
        }
    });
};

export const processZapiChatWatchdog = async ({
    pageSize = Number.parseInt(String(process.env.ZAPI_CHAT_WATCHDOG_PAGE_SIZE || '80'), 10) || 80,
    recentMinutes = Number.parseInt(String(process.env.ZAPI_CHAT_WATCHDOG_RECENT_MINUTES || '180'), 10) || 180
} = {}) => {
    const payload = await getZapiChats({ page: 1, pageSize });
    const items = chatItems(payload);
    const now = new Date();
    const minMs = now.getTime() - Math.max(10, recentMinutes) * 60 * 1000;
    const results = [];

    for (const chat of items) {
        const phone = digitsOnly(chat.phone);
        if (!phone || chat.isGroup === true || String(chat.isGroup || '').toLowerCase() === 'true') continue;
        if (countryFromPhone(phone) !== 'EC') continue;

        const lastMs = parseZapiChatTime(chat.lastMessageTime);
        if (!lastMs || lastMs < minMs || lastMs > now.getTime() + 5 * 60 * 1000) continue;

        const chatId = `${phone}@c.us`;
        const lastDbMessage = await Message.findOne(messageQueryForPhone(phone, chatId))
            .sort({ timestamp: -1, createdAt: -1 })
            .lean()
            .catch(() => null);
        const dbMs = latestMessageMs(lastDbMessage);
        if (dbMs && lastMs <= dbMs + 10000) continue;
        const nearbyActivity = await hasNearbyPanelActivity({ phone, chatId, lastMs });
        if (nearbyActivity) continue;

        const markerId = `zapi_watchdog_${phone}_${lastMs}`;
        const exists = await Message.exists({ _id: markerId });
        if (exists) continue;

        const state = await ensureStateForChat({ phone, chat, now: new Date(lastMs) });
        state.chatId = state.chatId || chatId;
        state.phoneDigits = state.phoneDigits || phone;
        state.countryCode = state.countryCode || 'EC';
        if (!state.firstInboundAt) state.firstInboundAt = new Date(lastMs);
        if (!state.firstInboundText) state.firstInboundText = 'Contato detectado pela Z-API.';
        state.human = {
            ...(state.human || {}),
            mode: state.human?.mode === 'manual' ? 'manual' : 'auto'
        };
        state.metadata = {
            ...(state.metadata || {}),
            zapiChatWatchdogAt: new Date().toISOString(),
            zapiChatWatchdogLastMessageTime: lastMs,
            zapiChatWatchdogUnread: String(chat.messagesUnread ?? chat.unread ?? ''),
            zapiChatWatchdogName: String(chat.name || ''),
            zapiChatWatchdogHiddenFromPanel: true,
            customerDraft: {
                ...(state.metadata?.customerDraft || {}),
                name: state.metadata?.customerDraft?.name || String(chat.name || '').trim(),
                phone: state.metadata?.customerDraft?.phone || `+${phone}`,
                country: 'EC',
                source: state.metadata?.customerDraft?.source || 'zapi_chat_watchdog',
                updatedAt: new Date().toISOString()
            }
        };
        state.updatedAt = new Date();
        state.markModified('metadata');
        await state.save();

        await Message.create({
            _id: markerId,
            chatId,
            peerPhone: phone,
            from: 'system',
            to: chatId,
            body: '',
            type: 'system',
            hasMedia: false,
            timestamp: Math.floor(lastMs / 1000),
            sessionId: 'zapi_chat_watchdog',
            ownerPhoneDigits: '',
            isFromMe: true,
            isBot: false,
            notifyName: String(chat.name || '') || 'Cliente EC',
            deliveryStatus: 'system',
            provider: 'zapi_chat_watchdog',
            providerMessageId: markerId,
            providerStatus: 'missing_received_webhook_hidden',
            providerPayload: {
                phone,
                chat,
                hiddenFromPanel: true,
                markerHash: crypto.createHash('sha1').update(markerId).digest('hex').slice(0, 12)
            }
        });

        results.push({ phone, markerId, lastMessageTime: lastMs, hiddenFromPanel: true });
    }

    if (results.length) {
        console.warn(`[ZAPI_CHAT_WATCHDOG] ${results.length} evento(s) tecnico(s) sem bolha no painel: ${results.map((item) => item.phone).join(',')}`);
    }
    return { scanned: items.length, created: results.length, results };
};
