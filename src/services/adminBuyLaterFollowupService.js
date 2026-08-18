import crypto from 'crypto';
import ContactState from '../models/ContactState.js';
import Message from '../models/Message.js';
import { ECUADOR_PRODUCTS, getEcuadorProductInfoByKey } from './ecuadorProductService.js';
import { texUltraCustomerName, texUltraGreetingSalutation } from './texUltraEntryGreetingService.js';
import { sendText } from '../whatsapp/sendText.js';
import { isAutomationRecipientAllowed } from '../whatsapp/automationSafety.js';
import { toWhatsAppChatId } from '../utils/phone.js';

const ECUADOR_TIMEZONE = 'America/Guayaquil';
const ECUADOR_UTC_OFFSET_HOURS = 5;
const REMINDER_LOCK_MINUTES = 10;
const REMINDER_WINDOW_START_DAYS = 4;
const REMINDER_WINDOW_END_DAYS = 3;
const PRODUCT_CUSTOMER_NAMES = new Map([
    [ECUADOR_PRODUCTS.texUltra.key, 'Tex Ultra'],
    [ECUADOR_PRODUCTS.nitrix.key, 'Nitrix Oxide'],
    [ECUADOR_PRODUCTS.vitPower.key, 'Vit Power']
]);

const digitsOnly = (value) => String(value || '').replace(/\D/g, '');
const dateValue = (value) => {
    const parsed = value instanceof Date ? value : new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};
const subdocumentValue = (value) => value?.toObject?.() || value || {};
const firstCustomerName = (...values) => {
    const fullName = texUltraCustomerName(...values);
    return fullName ? fullName.split(/\s+/)[0] : '';
};

export const normalizeBuyLaterDesiredDate = (value = '') => {
    const raw = String(value || '').trim();
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
    if (!match) return '';
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const probe = new Date(Date.UTC(year, month - 1, day));
    if (
        probe.getUTCFullYear() !== year
        || probe.getUTCMonth() !== month - 1
        || probe.getUTCDate() !== day
    ) return '';
    return `${match[1]}-${match[2]}-${match[3]}`;
};

export const buyLaterReminderWindow = (desiredOrderDate = '') => {
    const normalized = normalizeBuyLaterDesiredDate(desiredOrderDate);
    if (!normalized) return null;
    const [year, month, day] = normalized.split('-').map(Number);
    const targetLocalMidnightUtc = Date.UTC(
        year,
        month - 1,
        day,
        ECUADOR_UTC_OFFSET_HOURS,
        0,
        0,
        0
    );
    return {
        desiredOrderDate: normalized,
        windowStartAt: new Date(
            targetLocalMidnightUtc
            - REMINDER_WINDOW_START_DAYS * 24 * 60 * 60 * 1000
            + 9 * 60 * 60 * 1000
        ),
        windowEndAt: new Date(
            targetLocalMidnightUtc
            - REMINDER_WINDOW_END_DAYS * 24 * 60 * 60 * 1000
            + 18 * 60 * 60 * 1000
            + 59 * 60 * 1000
            + 59 * 1000
        )
    };
};

export const formatBuyLaterDesiredDate = (value = '') => {
    const normalized = normalizeBuyLaterDesiredDate(value);
    if (!normalized) return '';
    const [year, month, day] = normalized.split('-');
    return `${day}/${month}/${year}`;
};

export const buildBuyLaterReminderText = ({
    name = '',
    productKey = '',
    productName = '',
    desiredOrderDate = '',
    now = new Date()
} = {}) => {
    const date = formatBuyLaterDesiredDate(desiredOrderDate);
    const product = getEcuadorProductInfoByKey(productKey);
    const safeProductName = PRODUCT_CUSTOMER_NAMES.get(product?.key)
        || String(productName || '').trim();
    if (!date || !product || !safeProductName) return '';
    const customerName = firstCustomerName(name);
    const salutation = texUltraGreetingSalutation(now, ECUADOR_TIMEZONE);
    const opening = customerName
        ? `Hola, ${customerName}, ${salutation}.`
        : `Hola, ${salutation}.`;
    return `${opening} Soy Ana López. Usted nos indicó que desea realizar su pedido de ${safeProductName} para el ${date}. ¿Podemos preparar el pedido para enviarlo en la fecha acordada?`;
};

export const nextBuyLaterReminderState = ({
    previous = {},
    status = '',
    desiredOrderDate = '',
    productKey = '',
    productName = '',
    customerName = '',
    now = new Date()
} = {}) => {
    const current = subdocumentValue(previous);
    if (String(status || '').trim().toLowerCase() !== 'comprar_depois') {
        return {
            ...current,
            active: false,
            lockUntil: null,
            lockedAt: null,
            awaitingReply: false,
            cancelledAt: dateValue(now) || new Date()
        };
    }
    const window = buyLaterReminderWindow(desiredOrderDate);
    const product = getEcuadorProductInfoByKey(productKey);
    if (!window) throw new Error('buy_later_desired_date_invalid');
    if (!product) throw new Error('buy_later_product_required');
    const scheduleKey = `${window.desiredOrderDate}:${product.key}`;
    const previousScheduleKey = `${current.desiredOrderDate || ''}:${current.productKey || ''}`;
    const unchanged = scheduleKey === previousScheduleKey;
    return {
        ...(unchanged ? current : {}),
        active: true,
        desiredOrderDate: window.desiredOrderDate,
        productKey: product.key,
        productName: productName || product.name,
        customerName: String(customerName || '').trim(),
        scheduledAt: unchanged && current.scheduledAt ? current.scheduledAt : (dateValue(now) || new Date()),
        windowStartAt: window.windowStartAt,
        windowEndAt: window.windowEndAt,
        lockUntil: unchanged ? current.lockUntil || null : null,
        lockedAt: unchanged ? current.lockedAt || null : null,
        sentAt: unchanged ? current.sentAt || null : null,
        failedAt: unchanged ? current.failedAt || null : null,
        providerMessageId: unchanged ? current.providerMessageId || '' : '',
        attemptCount: unchanged ? Number(current.attemptCount || 0) : 0,
        lastAttemptAt: unchanged ? current.lastAttemptAt || null : null,
        lastError: unchanged ? current.lastError || '' : '',
        awaitingReply: unchanged ? current.awaitingReply === true : false,
        cancelledAt: null
    };
};

const messageHistoryQuery = ({ phone = '', chatId = '', body = '' } = {}) => {
    const digits = digitsOnly(phone || chatId);
    const tail = digits.slice(-9);
    const targets = [
        chatId ? { chatId } : null,
        digits ? { peerPhone: digits } : null,
        tail ? { peerPhone: { $regex: `${tail}$` } } : null,
        tail ? { chatId: { $regex: tail } } : null,
        tail ? { to: { $regex: tail } } : null
    ].filter(Boolean);
    return {
        body,
        $and: [
            { $or: [{ isFromMe: true }, { isBot: true }, { from: 'bot' }] },
            { $or: targets }
        ]
    };
};

const releaseReminderLock = ({ stateId, lockedAt, now, error }) => ContactState.updateOne(
    { _id: stateId, 'buyLaterReminder.lockedAt': lockedAt },
    {
        $set: {
            'buyLaterReminder.lockUntil': null,
            'buyLaterReminder.lockedAt': null,
            'buyLaterReminder.lastAttemptAt': now,
            'buyLaterReminder.failedAt': now,
            'buyLaterReminder.lastError': String(error || 'send_failed').slice(0, 500)
        },
        $inc: { 'buyLaterReminder.attemptCount': 1 }
    }
);

const markReminderAsSent = ({ state, lockedAt, sentAt, providerMessageId = '', body = '' }) => ContactState.updateOne(
    { _id: state._id, 'buyLaterReminder.lockedAt': lockedAt },
    {
        $set: {
            'buyLaterReminder.sentAt': sentAt,
            'buyLaterReminder.failedAt': null,
            'buyLaterReminder.providerMessageId': providerMessageId,
            'buyLaterReminder.lockUntil': null,
            'buyLaterReminder.lockedAt': null,
            'buyLaterReminder.lastAttemptAt': sentAt,
            'buyLaterReminder.lastError': '',
            'buyLaterReminder.awaitingReply': true,
            'metadata.buyLaterFollowup': {
                awaitingReply: true,
                desiredOrderDate: state.buyLaterReminder.desiredOrderDate,
                productKey: state.buyLaterReminder.productKey,
                productName: state.buyLaterReminder.productName,
                sentAt,
                reminderText: body
            }
        },
        $inc: { 'buyLaterReminder.attemptCount': 1 }
    }
);

const claimReminder = ({ stateId, now }) => {
    const lockedAt = new Date(now);
    const lockUntil = new Date(lockedAt.getTime() + REMINDER_LOCK_MINUTES * 60 * 1000);
    return ContactState.findOneAndUpdate(
        {
            _id: stateId,
            'buyLaterReminder.active': true,
            'buyLaterReminder.sentAt': null,
            'buyLaterReminder.failedAt': null,
            'buyLaterReminder.windowStartAt': { $lte: lockedAt },
            'buyLaterReminder.windowEndAt': { $gte: lockedAt },
            $or: [
                { 'buyLaterReminder.lockUntil': null },
                { 'buyLaterReminder.lockUntil': { $exists: false } },
                { 'buyLaterReminder.lockUntil': { $lte: lockedAt } }
            ]
        },
        {
            $set: {
                'buyLaterReminder.lockedAt': lockedAt,
                'buyLaterReminder.lockUntil': lockUntil
            }
        },
        { new: true }
    );
};

export const processAdminBuyLaterFollowups = async ({ limit = 5, now = new Date() } = {}) => {
    const currentTime = dateValue(now) || new Date();
    const safeLimit = Math.max(1, Math.min(Number.parseInt(String(limit || 5), 10) || 5, 20));
    const candidates = await ContactState.find({
        countryCode: 'EC',
        'buyLaterReminder.active': true,
        'buyLaterReminder.sentAt': null,
        'buyLaterReminder.failedAt': null,
        'buyLaterReminder.windowStartAt': { $lte: currentTime },
        'buyLaterReminder.windowEndAt': { $gte: currentTime }
    })
        .sort({ 'buyLaterReminder.windowStartAt': 1, _id: 1 })
        .limit(safeLimit)
        .select('_id chatId phoneDigits countryCode assignedAgent metadata.customerDraft buyLaterReminder')
        .lean();

    let processed = 0;
    let sent = 0;
    const items = [];
    for (const candidate of candidates) {
        const state = await claimReminder({ stateId: candidate._id, now: currentTime });
        if (!state) continue;
        processed += 1;
        const lockedAt = state.buyLaterReminder.lockedAt;
        const draft = state.metadata?.customerDraft || {};
        const phone = digitsOnly(state.phoneDigits || draft.phone || state.chatId);
        const jid = toWhatsAppChatId(phone, state.countryCode || 'EC');
        const body = buildBuyLaterReminderText({
            name: state.buyLaterReminder.customerName || draft.name,
            productKey: state.buyLaterReminder.productKey,
            productName: state.buyLaterReminder.productName,
            desiredOrderDate: state.buyLaterReminder.desiredOrderDate,
            now: currentTime
        });
        const safety = isAutomationRecipientAllowed(phone);
        if (!jid || !body || !safety.allowed) {
            const reason = !jid ? 'invalid_phone' : (!body ? 'invalid_reminder_contract' : safety.reason);
            await releaseReminderLock({ stateId: state._id, lockedAt, now: currentTime, error: reason });
            items.push({ id: String(state._id), sent: false, reason });
            continue;
        }

        const previousMessage = await Message.findOne(messageHistoryQuery({
            phone,
            chatId: state.chatId,
            body
        })).sort({ createdAt: -1 }).select('_id createdAt providerMessageId').lean();
        if (previousMessage) {
            await markReminderAsSent({
                state,
                lockedAt,
                sentAt: previousMessage.createdAt || currentTime,
                providerMessageId: previousMessage.providerMessageId || String(previousMessage._id || ''),
                body
            });
            items.push({ id: String(state._id), sent: false, reason: 'recovered_from_history' });
            continue;
        }

        const antiSpamKey = `buy_later_date:${state._id}:${state.buyLaterReminder.desiredOrderDate}:${state.buyLaterReminder.productKey}`;
        try {
            const result = await sendText(jid, body, null, {
                recipientDigits: phone,
                sessionId: state.metadata?.lastSessionId || null,
                country: 'EC',
                force: false,
                humanize: false,
                returnDetails: true,
                outboundContext: 'buy_later_date_reminder',
                antiSpamKey,
                dedupeValue: antiSpamKey
            });
            if (!result?.ok) {
                const reason = result?.error || result?.providerStatus || 'send_failed';
                await releaseReminderLock({ stateId: state._id, lockedAt, now: currentTime, error: reason });
                items.push({ id: String(state._id), sent: false, reason });
                continue;
            }
            await markReminderAsSent({
                state,
                lockedAt,
                sentAt: currentTime,
                providerMessageId: result.providerMessageId || '',
                body
            });
            sent += 1;
            items.push({ id: String(state._id), sent: true, reason: 'sent' });
        } catch (error) {
            await releaseReminderLock({ stateId: state._id, lockedAt, now: currentTime, error: error.message });
            items.push({ id: String(state._id), sent: false, reason: error.message });
        }
    }
    return { ok: true, candidates: candidates.length, processed, sent, items };
};

export const BUY_LATER_REMINDER_POLICY = Object.freeze({
    timezone: ECUADOR_TIMEZONE,
    windowStartDaysBefore: REMINDER_WINDOW_START_DAYS,
    windowEndDaysBefore: REMINDER_WINDOW_END_DAYS,
    lockMinutes: REMINDER_LOCK_MINUTES,
    maxAutomaticAttempts: 1,
    sendsMedia: false,
    createsOrder: false,
    sendsDropi: false,
    sendsMeta: false,
    scheduleId: crypto.createHash('sha256').update('buy_later_date_reminder_v24').digest('hex').slice(0, 16)
});
