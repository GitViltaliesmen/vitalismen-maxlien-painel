import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Message from '../src/models/Message.js';
import ContactState from '../src/models/ContactState.js';
import Order from '../src/models/Order.js';
import Shipment from '../src/models/Shipment.js';

dotenv.config();

const args = process.argv.slice(2);
const hasFlag = (name) => args.includes(`--${name}`);
const argValue = (name, fallback = '') => {
    const prefix = `--${name}=`;
    const found = args.find((arg) => arg.startsWith(prefix));
    return found ? found.slice(prefix.length) : fallback;
};

const sendEnabled = hasFlag('send');
const minMinutes = Math.max(2, Number.parseInt(argValue('min-minutes', '10'), 10) || 10);
const maxMinutes = Math.max(minMinutes, Number.parseInt(argValue('max-minutes', '1440'), 10) || 1440);
const limit = Math.max(1, Math.min(Number.parseInt(argValue('limit', '5'), 10) || 5, 20));
const apiUrl = argValue('api-url', process.env.OPT_IN_RESCUE_API_URL || 'http://127.0.0.1:3001/api/whatsapp/reengagement/send');
const apiToken = argValue('token', process.env.OPT_IN_RESCUE_API_TOKEN || '');
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/vitalismen';

const rescueText = argValue('message', '')
    || 'Hola, señor. Paso por aquí solo para saber si todavía desea Vit Power.\n\nSi quiere continuar, me responde *CONTINUAR* y le explico la promoción de hoy: al comprar ahora, recibe un bono especial en el momento de retirar su pedido.\n\nSi no desea seguir, no hay problema.';

const digitsOnly = (value = '') => String(value || '').replace(/\D/g, '');
const normalize = (value = '') => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const messageTime = (message = {}) => {
    if (message.createdAt) return new Date(message.createdAt);
    if (message.timestamp) return new Date(Number(message.timestamp) * 1000);
    return new Date(0);
};

const phoneTailCandidates = (...values) => [...new Set(values
    .map(digitsOnly)
    .filter(Boolean)
    .flatMap((digits) => [
        digits,
        digits.length >= 9 ? digits.slice(-9) : '',
        digits.length >= 10 ? digits.slice(-10) : '',
        digits.length >= 11 ? digits.slice(-11) : ''
    ])
    .filter((digits) => digits.length >= 8))];

const operationalPhones = () => [
    '5515998038637',
    '553183002800',
    '553171862958',
    '5515991418416',
    process.env.WHATSAPP_PRIORITY_TEST_PHONES,
    process.env.WHATSAPP_PANEL_OPERATIONAL_NUMBERS,
    process.env.WHATSAPP_INBOUND_TEST_ONLY_RECIPIENTS
]
    .join(',')
    .split(',')
    .map(digitsOnly)
    .filter(Boolean);

const isSamePhone = (left = '', right = '') => {
    const a = digitsOnly(left);
    const b = digitsOnly(right);
    return Boolean(a && b && (a === b || a.endsWith(b) || b.endsWith(a)));
};

const isOperationalPhone = (...values) => {
    const allowed = operationalPhones();
    return values
        .map(digitsOnly)
        .filter(Boolean)
        .some((candidate) => allowed.some((allowedPhone) => isSamePhone(candidate, allowedPhone)));
};

const isActiveOrClosedOrder = (order = null, shipment = null) => {
    const orderStatus = normalize(order?.status || '');
    const reviewStatus = normalize(shipment?.review?.reviewStatus || '');
    const checkpoint = normalize(shipment?.automation?.browserCheckpoint || '');
    return Boolean(
        ['confirmed', 'processing', 'shipped', 'delivered', 'returned', 'cancelled'].includes(orderStatus)
        || ['submitted', 'dropi_submit_running', 'dropi_submit_authorized'].includes(reviewStatus)
        || ['submitted_verified', 'order_closed', 'dropi_submit_running'].includes(checkpoint)
        || order?.dropiOrderId
        || order?.trackingNumber
        || shipment?.automation?.submittedToDroppiAt
        || shipment?.raw?.latestDroppiPayload?.dropiOrderId
        || shipment?.logistics?.trackingNumber
    );
};

const hasRecentOptInRescue = (state = null) => {
    const sentAt = state?.metadata?.reengagement?.optInRescueBonusSentAt
        || state?.metadata?.optInRescueBonusSentAt
        || '';
    if (!sentAt) return false;
    const sentMs = new Date(sentAt).getTime();
    return Boolean(sentMs && Date.now() - sentMs < 7 * 24 * 60 * 60 * 1000);
};

const findContext = async (lastMessage) => {
    const tails = phoneTailCandidates(lastMessage.peerPhone, lastMessage.from, lastMessage.chatId);
    const stateOr = [
        { chatId: lastMessage.chatId },
        ...tails.flatMap((tail) => [
            { phoneDigits: { $regex: `${tail}$` } },
            { 'metadata.customerPhoneDigits': { $regex: `${tail}$` } },
            { 'metadata.lastSenderPn': { $regex: tail } }
        ])
    ];
    const [state, order, shipment, previousRescue] = await Promise.all([
        ContactState.findOne({ $or: stateOr }).sort({ updatedAt: -1 }).lean().catch(() => null),
        tails.length
            ? Order.findOne({ country: 'EC', $or: tails.map((tail) => ({ 'customer.phone': { $regex: `${tail}$` } })) }).sort({ updatedAt: -1 }).lean().catch(() => null)
            : null,
        tails.length
            ? Shipment.findOne({ country: 'EC', $or: tails.map((tail) => ({ 'client.phone': { $regex: `${tail}$` } })) }).sort({ updatedAt: -1 }).lean().catch(() => null)
            : null,
        Message.findOne({
            chatId: lastMessage.chatId,
            isFromMe: true,
            body: /CONTINUAR.*bono especial|bono especial.*CONTINUAR/i
        }).sort({ createdAt: -1 }).lean().catch(() => null)
    ]);
    return { state, order, shipment, previousRescue };
};

const skipReason = ({ lastMessage, state, order, shipment, previousRescue, waitedMinutes }) => {
    const phoneDigits = digitsOnly(state?.phoneDigits) || digitsOnly(lastMessage.peerPhone) || digitsOnly(lastMessage.chatId);
    const stage = String(state?.metadata?.lastKnownFunnelStage
        || state?.metadata?.perAgentMemory?.vit_power_ec?.lastFunnelStage
        || state?.metadata?.perAgentMemory?.vit_power_ec?.principalSdrStage
        || '');
    const normalizedStage = normalize(stage);
    const body = normalize(lastMessage.body || '');
    const allowedStages = new Set([
        '',
        'qualification',
        'greeting',
        'sdr_after_initial',
        'initial_product_presentation',
        'package_selection',
        'first_response_sla_ack',
        'unanswered_inbound_ack'
    ]);

    if (waitedMinutes < minMinutes || waitedMinutes > maxMinutes) return 'outside_window';
    if (!phoneDigits.startsWith('593')) return 'not_ec_phone';
    if (isOperationalPhone(phoneDigits, lastMessage.chatId, lastMessage.peerPhone)) return 'operational_or_test_phone';
    if (state?.metadata?.testOnly || state?.metadata?.operationalPanelPhone || state?.metadata?.outboundTestOnly) return 'test_or_operational_state';
    if (state?.human?.mode === 'manual' && state?.human?.pausedUntil && new Date(state.human.pausedUntil).getTime() > Date.now()) return 'manual_hold_active';
    if (/order_closed|post_order|pedido_confirmado|submitted_verified|dropi/i.test(normalizedStage)) return 'closed_or_dropi_stage';
    if (!allowedStages.has(normalizedStage)) return 'stage_not_safe_for_bonus_opt_in';
    if (isActiveOrClosedOrder(order, shipment)) return 'active_or_closed_order';
    if (previousRescue || hasRecentOptInRescue(state)) return 'already_sent_recently';
    if (/\b(no quiero|no deseo|cancele|cancelar|equivoque|equivoqué|no pedi|no ped[ií]|no necesito|no tengo contacto|stop|bloquear)\b/i.test(body)) return 'negative_or_cancel_text';
    if (/\b(domicilio|entrega|entregar|cuando llega|cu[aá]ndo llega|que dias|qué días|hora|horario|agencia|servientrega|retiro|retirar)\b/i.test(body)) return 'specific_question_needs_context';
    if (/\b(profesor|profesora|antropologia|antropología|mis profesores|universidad|tarea)\b/i.test(body)) return 'off_topic_text';
    if (!body || body === '[image]' || body === '[video]') return 'media_without_context';
    return '';
};

const sendToApi = async ({ chatId, phone = '', text, sessionId = null }) => {
    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {})
        },
        body: JSON.stringify({ chatId, phone, text, sessionId })
    });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok && data?.success !== false, status: response.status, data };
};

const markRescueSent = async ({ state, chatId, text }) => {
    const query = state?._id ? { _id: state._id } : { chatId };
    await ContactState.updateOne(query, {
        $set: {
            'metadata.optInRescueBonusSentAt': new Date(),
            'metadata.optInRescueBonusText': text,
            'metadata.reengagement.optInRescueBonusSentAt': new Date(),
            'metadata.reengagement.optInRescueBonusText': text,
            'metadata.reengagement.lastTemplateKey': 'opt_in_bonus_continue',
            'metadata.perAgentMemory.vit_power_ec.lastFunnelStage': 'opt_in_rescue_waiting_continue',
            'metadata.lastKnownFunnelStage': 'opt_in_rescue_waiting_continue'
        }
    }).catch(() => null);
};

const main = async () => {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 });
    const now = Date.now();
    const lastByChat = await Message.aggregate([
        {
            $match: {
                chatId: { $nin: [null, '', 'status@broadcast'], $not: /@g\.us$/ }
            }
        },
        { $sort: { createdAt: -1, timestamp: -1 } },
        { $group: { _id: '$chatId', lastMessage: { $first: '$$ROOT' } } },
        {
            $match: {
                'lastMessage.isFromMe': false,
                'lastMessage.isBot': false,
                'lastMessage.from': { $not: /^bot$/i }
            }
        },
        { $sort: { 'lastMessage.createdAt': -1 } },
        { $limit: 300 }
    ]);

    const selected = [];
    const selectedKeys = new Set();
    const skipped = {};
    for (const row of lastByChat) {
        const lastMessage = row.lastMessage;
        const waitedMinutes = Math.round((now - messageTime(lastMessage).getTime()) / 60000);
        const context = await findContext(lastMessage);
        const reason = skipReason({ lastMessage, waitedMinutes, ...context });
        if (reason) {
            skipped[reason] = (skipped[reason] || 0) + 1;
            continue;
        }
        const selectedKey = context.state?._id?.toString?.()
            || context.state?.phoneDigits
            || lastMessage.peerPhone
            || digitsOnly(lastMessage.chatId);
        if (selectedKeys.has(selectedKey)) {
            skipped.duplicate_candidate = (skipped.duplicate_candidate || 0) + 1;
            continue;
        }
        selectedKeys.add(selectedKey);
        selected.push({
            chatId: context.state?.chatId || lastMessage.chatId,
            lastInboundChatId: lastMessage.chatId,
            phone: context.state?.phoneDigits || lastMessage.peerPhone || digitsOnly(lastMessage.chatId),
            waitedMinutes,
            lastText: String(lastMessage.body || '').replace(/\s+/g, ' ').trim().slice(0, 180),
            stage: context.state?.metadata?.lastKnownFunnelStage || '',
            sessionId: null,
            previousSessionId: context.state?.metadata?.lastSessionId || null,
            stateId: context.state?._id?.toString?.() || ''
        });
        if (selected.length >= limit) break;
    }

    const sent = [];
    if (sendEnabled) {
        for (const item of selected) {
            const result = await sendToApi({ chatId: item.chatId, phone: item.phone, text: rescueText, sessionId: item.sessionId });
            sent.push({ ...item, send: result });
            if (result.ok) {
                const state = item.stateId ? await ContactState.findById(item.stateId).lean().catch(() => null) : null;
                await markRescueSent({ state, chatId: item.chatId, text: rescueText });
                await new Promise((resolve) => setTimeout(resolve, 2500));
            }
        }
    }

    console.log(JSON.stringify({
        mode: sendEnabled ? 'send' : 'dry-run',
        windowMinutes: { min: minMinutes, max: maxMinutes },
        limit,
        message: rescueText,
        selectedCount: selected.length,
        selected,
        sent,
        skipped
    }, null, 2));
    await mongoose.disconnect();
};

main().catch(async (error) => {
    console.error(`[OPT-IN-RESCUE] erro: ${error.message}`);
    await mongoose.disconnect().catch(() => null);
    process.exit(1);
});
