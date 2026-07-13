import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import ContactState from '../models/ContactState.js';
import Message from '../models/Message.js';
import { resolveCountryAudio } from './audioTemplateService.js';
import { sendAudio } from '../whatsapp/sendAudio.js';
import { sendImage } from '../whatsapp/sendImage.js';
import { sendText } from '../whatsapp/sendText.js';
import { getSalesMedia } from './salesMediaCatalog.js';
import { getNextItemByPurpose, markPurposeItemSent } from './funnelPurposeMemoryService.js';
import { NITRIX_EC_PRODUCT_PROFILE, nitrixPriceForQuantity, nitrixPriceText } from './nitrixProductProfile.js';
import { isSimpleGreeting, startsWithOfficialInitialCtaMessage } from './initialFunnelTriggers.js';
import { buildNitrixTwoAudioEntryJobs, nitrixEntryLayerMode } from './nitrixEntryTwoAudioLayer.js';

const AGENT_KEY = NITRIX_EC_PRODUCT_PROFILE.key;
const memoryPath = `metadata.perAgentMemory.${AGENT_KEY}`;
const digitsOnly = (value = '') => String(value || '').replace(/\D/g, '');
const enabled = () => String(process.env.NITRIX_FAST_STATE_ENABLED || 'false').toLowerCase() === 'true';
// A liberacao e fechada por padrao. Um telefone de QA vazio jamais pode abrir
// clientes reais; somente `ROLLOUT_MODE=full` e uma decisao operacional
// explicita liberam a camada para toda entrada VSL Nitrix comprovada.
export const nitrixFastStateRolloutMode = (env = process.env) => (
    String(env.NITRIX_FAST_STATE_ROLLOUT_MODE || 'qa').trim().toLowerCase() === 'full'
        ? 'full'
        : 'qa'
);
const testPhone = (env = process.env) => digitsOnly(env.NITRIX_FAST_STATE_TEST_PHONE || '');
export const nitrixFastStateAllowsState = (state = {}, env = process.env) => {
    if (nitrixFastStateRolloutMode(env) === 'full') return true;
    const configured = testPhone(env);
    return Boolean(configured) && digitsOnly(state.phoneDigits || state.chatId || '').endsWith(configured);
};
// O contato de QA pode repetir a mesma sequencia apos um reset controlado.
// Em producao isto permanece sempre falso e a trava global anti-audio-repetido
// continua obrigatoria para todos os clientes.
export const nitrixFastStateAllowsQaDedupeBypass = (state = {}, env = process.env) => (
    nitrixFastStateRolloutMode(env) === 'qa'
    && Boolean(testPhone(env))
    && nitrixFastStateAllowsState(state, env)
);
const bypassAudioDedupeOnlyForConfiguredTest = (state = {}) => nitrixFastStateAllowsQaDedupeBypass(state);
// O worker e' serial dentro deste processo: duas chamadas do scheduler ou de
// timers de entrada nunca disparam uma rajada em paralelo.
let isProcessingFastStateJobs = false;
let nextScheduledMediaSlotAt = 0;
const recentEntryCopyIndexes = {
    opening: [],
    nameIntro: []
};
const parseMs = (name, fallback) => {
    const value = Number.parseInt(String(process.env[name] || ''), 10);
    return Number.isFinite(value) && value >= 0 ? value : fallback;
};
const randomizedDelayMs = (minName, maxName, fallbackMin, fallbackMax) => {
    const min = parseMs(minName, fallbackMin);
    const max = parseMs(maxName, fallbackMax);
    const low = Math.max(0, Math.min(min, max));
    const high = Math.max(low, max);
    return low + Math.floor(Math.random() * (high - low + 1));
};
const openingTextDelayMs = () => randomizedDelayMs(
    'NITRIX_FAST_STATE_OPENING_TEXT_MIN_MS',
    'NITRIX_FAST_STATE_OPENING_TEXT_MAX_MS',
    0,
    800
);
const firstAudioAfterOpeningMs = () => randomizedDelayMs(
    'NITRIX_FAST_STATE_FIRST_AUDIO_AFTER_OPENING_MIN_MS',
    'NITRIX_FAST_STATE_FIRST_AUDIO_AFTER_OPENING_MAX_MS',
    3000,
    5500
);
const nameIntroDelayMs = () => randomizedDelayMs(
    'NITRIX_FAST_STATE_NAME_INTRO_MIN_MS',
    'NITRIX_FAST_STATE_NAME_INTRO_MAX_MS',
    4000,
    9000
);
const jobRetryMs = () => randomizedDelayMs(
    'NITRIX_FAST_STATE_RETRY_MIN_MS',
    'NITRIX_FAST_STATE_RETRY_MAX_MS',
    45000,
    90000
);
const jobMaxAttempts = () => Math.max(1, parseMs('NITRIX_FAST_STATE_JOB_MAX_ATTEMPTS', 2));
const globalMediaGapMs = () => randomizedDelayMs(
    'NITRIX_FAST_STATE_GLOBAL_MEDIA_MIN_GAP_MS',
    'NITRIX_FAST_STATE_GLOBAL_MEDIA_MAX_GAP_MS',
    2500,
    6000
);
const queueSlaMsForJob = (job = {}) => parseMs(
    ['opening_text', 'audio_01'].includes(job.id)
        ? 'NITRIX_FAST_STATE_FIRST_AUDIO_QUEUE_SLA_MS'
        : 'NITRIX_FAST_STATE_QUEUE_SLA_MS',
    ['opening_text', 'audio_01'].includes(job.id) ? 45000 : 120000
);
const nowIso = () => new Date().toISOString();
const toMs = (value) => new Date(value || '').getTime();

const scheduleFastStateProcessingAt = (dueAt, limit = 4) => {
    const dueAtMs = toMs(dueAt);
    if (!Number.isFinite(dueAtMs)) return;
    const waitMs = Math.max(0, dueAtMs - Date.now());
    setTimeout(() => processNitrixFastStateJobs({ limit }).catch(() => null), waitMs);
};

const scheduleNextFastStateJob = (flow = {}, limit = 4) => {
    if (flow.status !== 'running') return;
    const nextDueAt = (flow.jobs || [])
        .filter((job) => job.status === 'pending' && Number.isFinite(toMs(job.dueAt)))
        .map((job) => job.dueAt)
        .sort((left, right) => toMs(left) - toMs(right))[0];
    if (nextDueAt) scheduleFastStateProcessingAt(nextDueAt, limit);
};

const reserveScheduledMediaSlot = (now = Date.now()) => {
    if (now < nextScheduledMediaSlotAt) return { allowed: false, availableAt: nextScheduledMediaSlotAt };
    const gapMs = globalMediaGapMs();
    nextScheduledMediaSlotAt = now + gapMs;
    return { allowed: true, gapMs, availableAt: nextScheduledMediaSlotAt };
};

const flowOf = (state = {}) => state?.metadata?.perAgentMemory?.[AGENT_KEY]?.fastState || null;
const clone = (value) => JSON.parse(JSON.stringify(value || {}));
const productMemory = (state = {}) => state?.metadata?.perAgentMemory?.[AGENT_KEY] || {};
const updateFlow = async (state, flow, extra = {}) => {
    const memory = { ...productMemory(state), fastState: flow, ...extra };
    state.metadata = {
        ...(state.metadata || {}),
        perAgentMemory: {
            ...((state.metadata || {}).perAgentMemory || {}),
            [AGENT_KEY]: memory
        },
        lastKnownFunnelStage: extra.lastFunnelStage || memory.lastFunnelStage || 'nitrix_fast_state'
    };
    state.markModified('metadata');
    await state.save();
};

// Depois de uma chamada ao provedor, nunca podemos gravar uma fotografia
// antiga por cima de uma resposta que o cliente acabou de enviar. Este commit
// condicional e' a barreira que vence a corrida entre o worker e o inbound.
const commitDispatchedFlowIfCurrent = async ({ state, flow, jobIndex, extra = {} }) => {
    const memory = { ...productMemory(state), fastState: flow, ...extra };
    const startedAt = new Date(flow.startedAt);
    const result = await ContactState.updateOne(
        {
            _id: state._id,
            [`${memoryPath}.fastState.generation`]: flow.generation,
            [`${memoryPath}.fastState.status`]: 'running',
            [`${memoryPath}.fastState.jobs.${jobIndex}.status`]: 'sending',
            $or: [
                { lastInboundAt: { $exists: false } },
                { lastInboundAt: { $lte: startedAt } }
            ]
        },
        {
            $set: {
                [`${memoryPath}`]: memory,
                'metadata.lastKnownFunnelStage': extra.lastFunnelStage || memory.lastFunnelStage || 'nitrix_fast_state',
                human: state.human || {},
                tags: Array.isArray(state.tags) ? state.tags : []
            }
        }
    );
    return result.modifiedCount === 1;
};

const safeChatId = (state = {}) => state.chatId || `${digitsOnly(state.phoneDigits)}@c.us`;
const isExplicitHumanHold = (state = {}) => {
    const human = state.human || {};
    const actor = String(human.lastManualBy || '').trim();
    return human.mode === 'manual' && actor && !['vsl_ec', 'nitrix_route_guard', 'nitrix_fast_state'].includes(actor);
};

const vslNitrixSourceConfirmed = (state = {}) => {
    const metadata = state.metadata || {};
    const draft = metadata.customerDraft || {};
    const values = [
        metadata.productKey,
        draft.productKey,
        metadata.productSource,
        metadata.vslPath,
        metadata.vslPage,
        metadata.vslSourceUrl,
        state.assignedAgent
    ].map((value) => String(value || '').toLowerCase());
    const isNitrix = values.some((value) => (
        value === AGENT_KEY
        || value === 'nx_ec'
        || value.includes('nitrix')
        || value.startsWith('/n')
        || value.includes('maxlien.shop/n')
    ));
    const hasVslEvidence = metadata.vslEntryPanelLead === true
        || values.some((value) => value.startsWith('/n') || value.includes('maxlien.shop/n') || value.includes('vsl'))
        || (state.tags || []).includes('VSL_EC');
    return isNitrix && hasVslEvidence;
};

const knownCustomerFullName = (state = {}) => {
    const draft = state?.metadata?.customerDraft || {};
    return looksLikeName(draft.name || '');
};

const chooseEntryCopy = (purpose, variants = []) => {
    if (!variants.length) return null;
    const recent = recentEntryCopyIndexes[purpose] || [];
    const allIndexes = variants.map((_, index) => index);
    const candidates = allIndexes.filter((index) => !recent.includes(index));
    const pool = candidates.length ? candidates : allIndexes;
    const index = pool[Math.floor(Math.random() * pool.length)];
    recentEntryCopyIndexes[purpose] = [...recent, index].slice(-3);
    return { variantIndex: index, text: variants[index] };
};

const entryCopyPlan = (state = {}) => ({
    opening: chooseEntryCopy('opening', NITRIX_EC_PRODUCT_PROFILE.entry.openingVariants),
    nameIntro: knownCustomerFullName(state)
        ? null
        : chooseEntryCopy('nameIntro', NITRIX_EC_PRODUCT_PROFILE.entry.nameIntroVariants)
});

const initialVslGreeting = (text = '') => (
    isSimpleGreeting(text)
    || startsWithOfficialInitialCtaMessage(text)
    || looksLikeName(text)
);

const recordOutbound = async ({ chatId, peerPhone, body, type = 'chat', mediaPath = '', sessionId = '' }) => {
    const mediaUrl = String(mediaPath || '').startsWith('/media/')
        ? mediaPath
        : (String(mediaPath || '').includes('/public/')
            ? `/${String(mediaPath).split('/public/').pop()}`
            : '');
    await Message.create({
        _id: `nitrix_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
        chatId,
        peerPhone: digitsOnly(peerPhone || chatId),
        from: 'bot',
        to: chatId,
        body,
        type,
        hasMedia: Boolean(mediaUrl),
        mediaUrl,
        mediaPreviewUrl: /\.ogg$/i.test(mediaUrl) ? mediaUrl.replace(/\.ogg$/i, '.mp3') : '',
        isFromMe: true,
        isBot: true,
        sessionId: sessionId || undefined,
        timestamp: Math.floor(Date.now() / 1000)
    }).catch(() => null);
};

const sendPlainText = async ({
    state,
    flow,
    text,
    context = 'nitrix_fast_state_reply',
    scheduled = false,
    antiSpamKey = '',
    allowHistoryDedupeBypass = false
}) => {
    const chatId = safeChatId(state);
    // O unico telefone de QA conserva historico de muitos testes. Ele pode
    // repetir a mesma classe semantica para validar a nova camada; clientes
    // reais continuam sujeitos a toda a deduplicacao do provedor.
    const bypassTextDedupeForConfiguredTest = scheduled && bypassAudioDedupeOnlyForConfiguredTest(state);
    const sent = await sendText(chatId, text, null, {
        sessionId: flow.sessionId || null,
        country: 'EC',
        outboundContext: context,
        humanize: false,
        skipAfterSendPacing: scheduled,
        ...(bypassTextDedupeForConfiguredTest ? { bypassDedupe: true, allowTextDedupeBypass: true } : {}),
        ...(antiSpamKey ? { antiSpamKey } : {}),
        ...(allowHistoryDedupeBypass ? { allowHistoryDedupeBypass: true } : {})
    });
    if (sent) await recordOutbound({ chatId, peerPhone: state.phoneDigits, body: text, sessionId: flow.sessionId });
    return Boolean(sent);
};

const healthTopic = (text = '') => {
    const body = String(text).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (/(presion|precion|tension|hipertens|losartan|enalapril|captopril|amlodipino|metoprolol)/.test(body)) return 'presion';
    if (/(diabet|azucar|glucosa|insulina|metformina)/.test(body)) return 'diabetes';
    if (/(corazon|cardiac|infarto|preinfarto|arritmia|marcapasos|derrame|acv)/.test(body)) return 'corazon';
    if (/(medicamento|medicacion|nitrato|nitroglicerina|anticoagulante|warfarina|rivaroxaban|apixaban|clopidogrel|aspirina)/.test(body)) return 'medicamentos';
    if (/(cirugia|operacion|operad|prostata|hospital)/.test(body)) return 'cirugia';
    if (/(rinon|renal|higado|hepatic)/.test(body)) return 'renal_hepatica';
    if (/(natural|seguro|contraindica|efecto.*secund|me hace dano|me hace mal)/.test(body)) return 'seguridad';
    return '';
};
const asksPrice = (text = '') => /\b(precio|precios|valor|cuanto cuesta|cuanto vale|costo|promo|promocion)\b/i.test(text);
const asksGuarantee = (text = '') => /\b(garantia|garantizado|devolucion|reembolso)\b/i.test(text);
const asksUsage = (text = '') => /\b(como se toma|como tomar|como uso|como usar|dosis|posologia)\b/i.test(text);
const asksProduct = (text = '') => /\b(que es|que producto|para que sirve|nitrix)\b/i.test(text);
const selectedPackageQuantity = (text = '') => {
    const value = String(text || '').toLowerCase().trim().replace(/\s+/g, ' ');
    if (/^(?:1|un|uno|una)(?:\s+(?:frasco|frasco[s]?|botella|botellas))?$/.test(value)) return 1;
    if (/^(?:3|tres)(?:\s+(?:frasco|frascos|botella|botellas))?$/.test(value)) return 3;
    if (/^(?:6|seis)(?:\s+(?:frasco|frascos|botella|botellas))?$/.test(value)) return 6;
    return 0;
};
const looksLikeName = (text = '') => {
    const parts = String(text || '').trim().split(/\s+/).filter(Boolean);
    return parts.length >= 2 && parts.length <= 5 && parts.every((part) => /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ'-]{2,}$/.test(part));
};
const affirmative = (text = '') => /^(si|sí|correcto|ese|ese mismo|claro|exacto|quiero ese|lo quiero|listo|ok|okay)\b/i.test(String(text || '').trim());
const nextUsageCompanion = (flow = {}) => {
    const variants = NITRIX_EC_PRODUCT_PROFILE.usage.companionVariants || [];
    if (!variants.length) return '';
    const index = Math.max(0, Number(flow.usageVariantIndex || 0));
    flow.usageVariantIndex = (index + 1) % variants.length;
    return variants[index % variants.length];
};

const bottleWasSent = (flow = {}) => Boolean(flow?.bottle?.sentAt);
const sendBottleOnce = async ({ state, flow, reason }) => {
    if (bottleWasSent(flow)) return { ok: true, alreadySent: true };
    const bottle = NITRIX_EC_PRODUCT_PROFILE.bottle;
    const localPath = path.join(process.cwd(), 'public', bottle.media.replace(/^\/+/, ''));
    if (!fs.existsSync(localPath)) return { ok: false, error: 'nitrix_bottle_not_found' };
    const chatId = safeChatId(state);
    const sent = await sendImage(chatId, localPath, bottle.caption, {
        sessionId: flow.sessionId || null,
        country: 'EC',
        outboundContext: 'nitrix_bottle',
        skipAfterSendPacing: true
    });
    if (!sent) return { ok: false, error: 'nitrix_bottle_not_sent' };
    flow.bottle = { sentAt: nowIso(), reason, confirmedAt: '' };
    await recordOutbound({ chatId, peerPhone: state.phoneDigits, body: '[IMAGEM] nitrix_bottle', type: 'image', mediaPath: localPath, sessionId: flow.sessionId });
    return { ok: true, alreadySent: false };
};

const cancelPendingJobs = (flow, reason) => {
    flow.jobs = (flow.jobs || []).map((job) => (
        ['pending', 'sending'].includes(job.status)
            ? { ...job, status: 'cancelled', cancelledAt: nowIso(), cancelReason: reason }
            : job
    ));
    flow.status = 'interrupted';
    flow.interruptedAt = nowIso();
    flow.interruptReason = reason;
    return flow;
};

const sendHealthAnswer = async ({ state, flow, topic }) => {
    flow.healthTopics = flow.healthTopics || {};
    const alreadySent = Boolean(flow.healthTopics[topic]?.audioSentAt);
    if (!alreadySent) {
        const audioName = NITRIX_EC_PRODUCT_PROFILE.health.approvedAudioName;
        const audioPath = await resolveCountryAudio({ country: 'EC', baseName: audioName });
        if (audioPath) {
            const sent = await sendAudio(safeChatId(state), audioPath, true, {
                sessionId: flow.sessionId || null,
                country: 'EC',
                outboundContext: 'nitrix_health_approved_audio',
                skipAfterSendPacing: true
            });
            if (sent) {
                await recordOutbound({ chatId: safeChatId(state), peerPhone: state.phoneDigits, body: `[AUDIO] ${audioName}`, type: 'audio', mediaPath: audioPath, sessionId: flow.sessionId });
                flow.healthTopics[topic] = { audioSentAt: nowIso(), approvedAudioName: audioName };
            }
        }
    }
    await sendPlainText({ state, flow, text: NITRIX_EC_PRODUCT_PROFILE.health.companionText, context: 'nitrix_health_companion' });
    return true;
};

const respondToCustomer = async ({ state, flow, text }) => {
    const topic = healthTopic(text);
    if (topic) return sendHealthAnswer({ state, flow, topic });
    if (asksGuarantee(text)) return sendPlainText({ state, flow, text: NITRIX_EC_PRODUCT_PROFILE.guarantee.text, context: 'nitrix_guarantee' });
    if (asksUsage(text)) {
        const audioName = NITRIX_EC_PRODUCT_PROFILE.usage.approvedAudioName;
        if (audioName) {
            const audioPath = await resolveCountryAudio({ country: 'EC', baseName: audioName });
            if (audioPath && await sendAudio(safeChatId(state), audioPath, true, { sessionId: flow.sessionId || null, country: 'EC', outboundContext: 'nitrix_usage', skipAfterSendPacing: true })) {
                await recordOutbound({ chatId: safeChatId(state), peerPhone: state.phoneDigits, body: `[AUDIO] ${audioName}`, type: 'audio', mediaPath: audioPath, sessionId: flow.sessionId });
                const companion = nextUsageCompanion(flow);
                if (companion) await sendPlainText({ state, flow, text: companion, context: 'nitrix_usage_companion' });
                return true;
            }
        }
        return sendPlainText({ state, flow, text: 'El audio oficial de uso de Nitrix no está disponible en este momento. Le acompaño por aquí para que la orientación correcta quede confirmada.', context: 'nitrix_usage_fallback' });
    }
    if (asksPrice(text)) {
        const bottle = await sendBottleOnce({ state, flow, reason: 'price' });
        if (!bottle.ok) return false;
        flow.priceShownAt = nowIso();
        flow.priceCatalog = 'original';
        const textPrice = `${bottle.alreadySent ? '' : `${NITRIX_EC_PRODUCT_PROFILE.bottle.confirmationText}\n\n`}${nitrixPriceText()}\n\n¿Cuál opción desea?`;
        return sendPlainText({ state, flow, text: textPrice, context: 'nitrix_price' });
    }
    const quantity = selectedPackageQuantity(text);
    if (quantity && flow.priceShownAt) {
        const offer = nitrixPriceForQuantity(quantity, flow.priceCatalog || 'original');
        if (!offer) return sendPlainText({ state, flow, text: 'Esa opción no está disponible en este momento. Puede elegir 1, 3 o 6 frascos.', context: 'nitrix_quantity_unavailable' });
        flow.selectedQuantity = quantity;
        flow.selectedOffer = { quantity: offer.quantity, amount: offer.amount, currency: offer.currency, selectedAt: nowIso() };
        state.metadata = {
            ...(state.metadata || {}),
            customerDraft: {
                ...((state.metadata || {}).customerDraft || {}),
                quantity: offer.quantity,
                total: offer.amount,
                currency: offer.currency,
                updatedAt: nowIso()
            }
        };
        if (!flow.customerFullName) {
            return sendPlainText({ state, flow, text: `Perfecto. Quedó seleccionada la opción de ${offer.label}. Para registrarle correctamente, ¿me indica por favor su nombre completo?`, context: 'nitrix_quantity_name_request' });
        }
        return sendPlainText({ state, flow, text: `Perfecto. Quedó seleccionada la opción de ${offer.label}. Le acompaño con el siguiente dato para continuar su pedido.`, context: 'nitrix_quantity_selected' });
    }
    if (asksProduct(text)) return sendPlainText({ state, flow, text: 'Nitrix Oxide Ecuador es el producto de este chat. Dígame qué información desea confirmar y le respondo por aquí.', context: 'nitrix_product' });
    if (looksLikeName(text)) {
        state.metadata = { ...(state.metadata || {}), customerDraft: { ...((state.metadata || {}).customerDraft || {}), name: String(text).trim(), updatedAt: nowIso() } };
        flow.customerFullName = String(text).trim();
        flow.customerFullNameCapturedAt = nowIso();
        return sendPlainText({ state, flow, text: 'Gracias, ya registré su nombre completo. ¿Qué información de Nitrix desea confirmar?', context: 'nitrix_name' });
    }
    if (flow.status === 'waiting_bottle_confirmation' && affirmative(text)) {
        flow.bottle = { ...(flow.bottle || {}), confirmedAt: nowIso() };
        if (!flow.customerFullName) return sendPlainText({ state, flow, text: 'Perfecto. Para registrarle correctamente, ¿me indica por favor su nombre completo?', context: 'nitrix_name_request' });
    }
    return sendPlainText({ state, flow, text: 'Le entiendo. Dígame su duda concreta sobre Nitrix —por ejemplo precio, garantía, uso o entrega— y le respondo por aquí.', context: 'nitrix_general' });
};

export const buildNitrixEntryJobsForTest = (startedAt, {
    hasKnownName = false,
    entryLayer = nitrixEntryLayerMode()
} = {}) => {
    if (entryLayer === 'two_audio_only') return buildNitrixTwoAudioEntryJobs(startedAt);
    // Sorteia uma vez por conversa e persiste os prazos abaixo. Assim, a
    // sequencia parece humana e um reinicio nao recalcula nem deixa os envios
    // cairem em um ritmo mecanico.
    const openingDelay = openingTextDelayMs();
    const firstAudioDelay = firstAudioAfterOpeningMs();
    const secondDelay = randomizedDelayMs(
        'NITRIX_FAST_STATE_SECOND_AUDIO_MIN_MS',
        'NITRIX_FAST_STATE_SECOND_AUDIO_MAX_MS',
        15000,
        20000
    );
    const proofDelay = randomizedDelayMs(
        'NITRIX_FAST_STATE_PROOF_MIN_MS',
        'NITRIX_FAST_STATE_PROOF_MAX_MS',
        25000,
        30000
    );
    const bottleDelay = randomizedDelayMs(
        'NITRIX_FAST_STATE_BOTTLE_MIN_MS',
        'NITRIX_FAST_STATE_BOTTLE_MAX_MS',
        35000,
        40000
    );
    const openingAt = new Date(startedAt.getTime() + openingDelay);
    return [
        { id: 'opening_text', dueAt: openingAt.toISOString(), scheduledAfterMs: openingDelay, status: 'pending', attempts: 0 },
        { id: 'audio_01', dueAt: '', scheduledAfterMs: firstAudioDelay, status: 'pending', attempts: 0 },
        { id: 'audio_02', dueAt: '', scheduledAfterMs: secondDelay, status: 'pending', attempts: 0 },
        {
            id: 'name_intro',
            dueAt: '',
            scheduledAfterMs: nameIntroDelayMs(),
            status: hasKnownName ? 'skipped' : 'pending',
            attempts: 0,
            skipReason: hasKnownName ? 'customer_name_already_known' : ''
        },
        { id: 'proof', dueAt: '', scheduledAfterMs: proofDelay, status: 'pending', attempts: 0, relativeTo: 'audio_02' },
        { id: 'bottle', dueAt: '', scheduledAfterMs: bottleDelay, status: 'pending', attempts: 0 }
    ];
};

const jobReady = (jobs, index, now) => jobs[index].status === 'pending'
    && new Date(jobs[index].dueAt).getTime() <= now.getTime()
    && jobs.slice(0, index).every((item) => ['sent', 'skipped'].includes(item.status));

const nextReadyJob = (flow, now) => {
    const jobs = flow?.jobs || [];
    const index = jobs.findIndex((job, position) => jobReady(jobs, position, now));
    return index >= 0 ? { index, job: jobs[index] } : null;
};

const queueWaitExceeded = (job, now) => {
    const dueAt = toMs(job?.dueAt);
    return Number.isFinite(dueAt) && now.getTime() - dueAt > queueSlaMsForJob(job);
};

const handoffQueueWait = async ({ state, flow, job }) => {
    job.status = 'escalated';
    job.escalatedAt = nowIso();
    job.lastError = 'queue_sla_exceeded';
    flow.status = 'needs_human';
    flow.failureAt = nowIso();
    flow.failureReason = 'queue_sla_exceeded';
    state.human = {
        ...(state.human || {}),
        mode: 'manual',
        assignedName: 'Atendimento Nitrix EC',
        lastManualAt: new Date(),
        lastManualBy: 'nitrix_fast_state_queue_watchdog',
        note: 'Prioridade humana: a fila Nitrix ultrapassou o prazo de atendimento.'
    };
    state.tags = [...new Set([...(state.tags || []), 'NITRIX_EC', 'NITRIX_QUEUE_ALERT', 'AGUARDANDO_ATENDIMENTO'])];
    await updateFlow(state, flow, { lastFunnelStage: 'nitrix_fast_state_queue_human' });
};

const dispatchJob = async ({ state, flow, job }) => {
    const chatId = safeChatId(state);
    if (job.id === 'opening_text') {
        const text = flow.copyPlan?.opening?.text || '';
        if (!text) return { ok: false, error: 'nitrix_opening_text_missing' };
        const sent = await sendPlainText({ state, flow, text, context: 'nitrix_vsl_opening', scheduled: true });
        return sent ? { ok: true, receipt: 'accepted' } : { ok: false, error: 'nitrix_opening_text_not_sent' };
    }
    if (job.id === 'audio_01' || job.id === 'audio_02') {
        const audioName = NITRIX_EC_PRODUCT_PROFILE.entry.audioNames[job.id === 'audio_01' ? 0 : 1];
        const audioPath = await resolveCountryAudio({ country: 'EC', baseName: audioName });
        if (!audioPath) return { ok: false, error: `${job.id}_not_found` };
        const sent = await sendAudio(chatId, audioPath, true, {
            sessionId: flow.sessionId || null,
            country: 'EC',
            outboundContext: 'nitrix_fast_state',
            skipAfterSendPacing: true,
            allowAudioDedupeBypass: bypassAudioDedupeOnlyForConfiguredTest(state)
        });
        if (!sent) return { ok: false, error: `${job.id}_not_sent` };
        await recordOutbound({ chatId, peerPhone: state.phoneDigits, body: `[AUDIO] ${audioName}`, type: 'audio', mediaPath: audioPath, sessionId: flow.sessionId });
        return { ok: true, receipt: 'accepted' };
    }
    if (job.id === 'name_intro') {
        if (knownCustomerFullName(state)) return { ok: true, receipt: 'name_already_known', skipped: true };
        const text = flow.copyPlan?.nameIntro?.text || '';
        if (!text) return { ok: false, error: 'nitrix_name_intro_missing' };
        // Esta e' uma unica identificacao persistida no Fast State. Ela nao
        // deve ser confundida com um pedido de nome de um teste/funil antigo.
        const sent = await sendPlainText({
            state,
            flow,
            text,
            context: 'nitrix_vsl_name_intro',
            scheduled: true,
            antiSpamKey: `nitrix_vsl_name_intro:${flow.generation}`,
            allowHistoryDedupeBypass: true
        });
        return sent ? { ok: true, receipt: 'accepted' } : { ok: false, error: 'nitrix_name_intro_not_sent' };
    }
    if (job.id === 'proof') {
        const item = await getNextItemByPurpose(state.phoneDigits || chatId, NITRIX_EC_PRODUCT_PROFILE.entry.proofPurpose, { candidates: NITRIX_EC_PRODUCT_PROFILE.entry.proofItems, contactStateId: state._id, agentKey: AGENT_KEY, resetWhenExhausted: true });
        const proofKey = String(item || '').split(':')[1];
        const proof = proofKey ? getSalesMedia(proofKey) : null;
        if (!proof) return { ok: false, error: 'nitrix_proof_not_found' };
        const sent = await sendImage(chatId, proof.path, 'Le comparto una experiencia de clientes para que conozca mejor Nitrix.', { sessionId: flow.sessionId || null, country: 'EC', outboundContext: 'nitrix_proof', skipAfterSendPacing: true });
        if (!sent) return { ok: false, error: 'nitrix_proof_not_sent' };
        await markPurposeItemSent({ contactStateId: state._id, agentKey: AGENT_KEY, purpose: NITRIX_EC_PRODUCT_PROFILE.entry.proofPurpose, item });
        await recordOutbound({ chatId, peerPhone: state.phoneDigits, body: `[IMAGEM] ${proofKey}`, type: 'image', mediaPath: proof.path, sessionId: flow.sessionId });
        return { ok: true, receipt: 'accepted' };
    }
    if (job.id === 'bottle') {
        const bottle = await sendBottleOnce({ state, flow, reason: 'entry' });
        if (!bottle.ok) return bottle;
        const confirmationSent = await sendPlainText({
            state,
            flow,
            text: NITRIX_EC_PRODUCT_PROFILE.bottle.confirmationText,
            context: 'nitrix_bottle_confirmation'
        });
        if (!confirmationSent) return { ok: false, error: 'nitrix_bottle_confirmation_not_sent' };
        flow.status = 'waiting_bottle_confirmation';
        return { ok: true, receipt: 'accepted' };
    }
    return { ok: false, error: 'unknown_job' };
};

const jobById = (flow = {}, id = '') => (flow.jobs || []).find((job) => job.id === id) || null;

const releaseJobAfterMs = (job, delayMs) => {
    if (!job || job.status !== 'pending') return;
    job.dueAt = new Date(Date.now() + Math.max(0, Number(delayMs || 0))).toISOString();
    job.releasedAt = nowIso();
};

const releaseFollowingJobs = (flow, completed) => {
    if (completed.id === 'audio_02') {
        // A identificacao e curta e vem apos o audio 2. A prova preserva
        // sua janela medida desde o audio 2, mesmo que a identificacao seja
        // reenviada por falha tecnica.
        releaseJobAfterMs(jobById(flow, 'name_intro'), jobById(flow, 'name_intro')?.scheduledAfterMs);
        releaseJobAfterMs(jobById(flow, 'proof'), jobById(flow, 'proof')?.scheduledAfterMs);
        return;
    }
    if (completed.id === 'name_intro') return;
    const currentIndex = (flow.jobs || []).findIndex((job) => job.id === completed.id);
    const nextJob = currentIndex >= 0 ? flow.jobs[currentIndex + 1] : null;
    releaseJobAfterMs(nextJob, nextJob?.scheduledAfterMs);
};

const processState = async (state, now) => {
    const flow = clone(flowOf(state));
    if (!flow || flow.status !== 'running') return false;
    if (isExplicitHumanHold(state) || (state.lastInboundAt && new Date(state.lastInboundAt) > new Date(flow.startedAt))) {
        await updateFlow(state, cancelPendingJobs(flow, isExplicitHumanHold(state) ? 'human_takeover' : 'customer_reply'), { lastFunnelStage: 'nitrix_fast_state_interrupted' });
        return false;
    }
    const ready = nextReadyJob(flow, now);
    if (!ready) {
        scheduleNextFastStateJob(flow);
        return false;
    }
    const { index, job } = ready;
    if (queueWaitExceeded(job, now)) {
        await handoffQueueWait({ state, flow, job });
        return false;
    }
    const queueSlot = reserveScheduledMediaSlot(now.getTime());
    if (!queueSlot.allowed) {
        scheduleFastStateProcessingAt(new Date(queueSlot.availableAt).toISOString());
        return false;
    }
    job.status = 'sending';
    job.startedAt = nowIso();
    await updateFlow(state, flow, { lastFunnelStage: `nitrix_fast_state_${job.id}_sending` });
    const fresh = await ContactState.findById(state._id);
    if (!fresh || isExplicitHumanHold(fresh) || (fresh.lastInboundAt && new Date(fresh.lastInboundAt) > new Date(flow.startedAt))) return false;
    const freshFlow = clone(flowOf(fresh));
    const result = await dispatchJob({ state: fresh, flow: freshFlow, job: freshFlow.jobs[index] });
    const latest = await ContactState.findById(state._id);
    const latestFlow = clone(flowOf(latest));
    const supersededByInbound = !latest
        || latestFlow?.generation !== freshFlow.generation
        || latestFlow?.status !== 'running'
        || latestFlow?.jobs?.[index]?.status !== 'sending'
        || (latest.lastInboundAt && new Date(latest.lastInboundAt) > new Date(freshFlow.startedAt));
    if (supersededByInbound) {
        console.log(`[NITRIX-FAST-STATE] job ${job.id} nao regravou estado: cliente respondeu ou atendimento assumiu -> ${safeChatId(fresh)}`);
        return false;
    }
    const completed = freshFlow.jobs[index];
    completed.attempts = Number(completed.attempts || 0) + 1;
    if (result.ok) {
        completed.status = result.skipped ? 'skipped' : 'sent';
        completed.sentAt = result.skipped ? '' : nowIso();
        if (result.skipped) completed.skipReason = result.receipt || 'skipped';
        completed.providerReceipt = result.receipt || 'accepted';
        completed.globalQueueGapMs = queueSlot.gapMs;
        releaseFollowingJobs(freshFlow, completed);
        const committed = await commitDispatchedFlowIfCurrent({
            state: latest,
            flow: freshFlow,
            jobIndex: index,
            extra: { lastFunnelStage: freshFlow.status === 'waiting_bottle_confirmation' ? 'nitrix_fast_state_waiting_bottle_confirmation' : `nitrix_fast_state_${completed.id}_sent` }
        });
        if (committed) scheduleNextFastStateJob(freshFlow);
        return committed;
    }
    completed.lastError = result.error || 'send_failed';
    if (completed.attempts >= jobMaxAttempts()) {
        completed.status = 'failed';
        freshFlow.status = 'needs_human';
        freshFlow.failureAt = nowIso();
        freshFlow.failureReason = completed.lastError;
        latest.human = { ...(latest.human || {}), mode: 'manual', assignedName: 'Atendimento Nitrix EC', lastManualAt: new Date(), lastManualBy: 'nitrix_fast_state_failure', note: 'Revisar envio Nitrix: uma etapa automatica falhou apos tentativas controladas.' };
        latest.tags = [...new Set([...(latest.tags || []), 'NITRIX_EC', 'AGUARDANDO_ATENDIMENTO'])];
    } else {
        completed.status = 'pending';
        completed.retryAfterMs = jobRetryMs();
        completed.dueAt = new Date(Date.now() + completed.retryAfterMs).toISOString();
    }
    await commitDispatchedFlowIfCurrent({
        state: latest,
        flow: freshFlow,
        jobIndex: index,
        extra: { lastFunnelStage: freshFlow.status === 'needs_human' ? 'nitrix_fast_state_failed_human' : `nitrix_fast_state_${completed.id}_retry` }
    });
    scheduleNextFastStateJob(freshFlow);
    return false;
};

export const processNitrixFastStateJobs = async ({ limit = 50 } = {}) => {
    if (!enabled()) return { enabled: false, processed: 0 };
    const rolloutMode = nitrixFastStateRolloutMode();
    const configuredTestPhone = testPhone();
    if (rolloutMode === 'qa' && !configuredTestPhone) {
        return { enabled: true, mode: rolloutMode, blocked: 'qa_phone_missing', processed: 0 };
    }
    if (isProcessingFastStateJobs) return { enabled: true, busy: true, processed: 0 };
    isProcessingFastStateJobs = true;
    try {
        const query = {
            assignedAgent: AGENT_KEY,
            [`${memoryPath}.fastState.status`]: 'running',
            [`${memoryPath}.fastState.jobs`]: { $elemMatch: { status: 'pending' } }
        };
        // Ao liberar somente a camada nova, fluxos antigos (sem a marca de
        // camada) jamais voltam a enviar audio por acidente.
        if (nitrixEntryLayerMode() === 'two_audio_only') {
            query[`${memoryPath}.fastState.entryLayer`] = 'two_audio_only';
        }
        if (rolloutMode === 'qa') query.phoneDigits = { $regex: `${configuredTestPhone}$` };
        const states = await ContactState.find(query).sort({ updatedAt: 1 }).limit(Math.max(1, limit));
        const now = new Date();
        // O job vencido mais antigo e' avaliado primeiro. Isso preserva a
        // ordem e evita que entradas novas deixem uma conversa antiga esquecida.
        states.sort((left, right) => {
            const leftReady = nextReadyJob(flowOf(left), now)?.job;
            const rightReady = nextReadyJob(flowOf(right), now)?.job;
            return (toMs(leftReady?.dueAt) || Number.POSITIVE_INFINITY)
                - (toMs(rightReady?.dueAt) || Number.POSITIVE_INFINITY);
        });
        let processed = 0;
        for (const state of states) {
            if (await processState(state, new Date())) processed += 1;
        }
        return { enabled: true, busy: false, processed, scanned: states.length };
    } finally {
        isProcessingFastStateJobs = false;
    }
};

// A VSL /n/ e' um opt-in comercial comprovado. O primeiro acolhimento nao
// depende de uma mensagem adicional do cliente: o estado e persistido antes
// de qualquer envio e toda resposta posterior continua vencendo a cadencia.
export const startNitrixFastStateFromVslEntry = async ({ contactStateId, sessionId = null } = {}) => {
    if (!enabled() || !contactStateId) return { handled: false, reason: 'disabled_or_missing_contact' };
    const state = await ContactState.findById(contactStateId);
    if (!state || !nitrixFastStateAllowsState(state) || isExplicitHumanHold(state)) {
        return { handled: false, reason: 'state_not_allowed' };
    }
    const current = clone(flowOf(state));
    if (current?.startedAt) return { handled: true, started: false, reason: 'flow_already_exists', flowStatus: current.status || null };
    if (!vslNitrixSourceConfirmed(state)) return { handled: false, reason: 'vsl_nitrix_source_not_confirmed' };

    const startedAt = new Date();
    const flow = {
        version: 4,
        generation: crypto.randomBytes(8).toString('hex'),
        status: 'running',
        startedAt: startedAt.toISOString(),
        sessionId: sessionId || state.metadata?.lastSessionId || null,
        copyPlan: entryCopyPlan(state),
        entryLayer: nitrixEntryLayerMode(),
        jobs: buildNitrixEntryJobsForTest(startedAt, { hasKnownName: knownCustomerFullName(state) }),
        bottle: { sentAt: '', reason: '', confirmedAt: '' },
        healthTopics: {},
        entryTrigger: 'vsl_click'
    };
    state.assignedAgent = AGENT_KEY;
    state.human = {
        ...(state.human || {}),
        mode: 'auto',
        pausedUntil: null,
        lastManualAt: startedAt,
        lastManualBy: 'nitrix_fast_state_vsl_entry',
        note: 'Entrada VSL Nitrix confirmada; acolhimento imediato e cadencia persistente ativos.'
    };
    state.tags = [...new Set([...(state.tags || []), 'NITRIX_EC', 'NITRIX_FAST_STATE', 'BOT_VIT_POWER_BLOQUEADO'])];
    await updateFlow(state, flow, { lastFunnelStage: 'nitrix_fast_state_vsl_scheduled' });
    scheduleNextFastStateJob(flow);
    return { handled: true, started: true, generation: flow.generation };
};

export const handleNitrixFastStateInbound = async ({ contactStateId, inboundText, sessionId = null } = {}) => {
    if (!enabled() || !contactStateId) return false;
    const state = await ContactState.findById(contactStateId);
    if (!state || !nitrixFastStateAllowsState(state) || isExplicitHumanHold(state)) return false;
    const current = clone(flowOf(state));
    if (current?.startedAt) {
        if (current.status === 'running') cancelPendingJobs(current, 'customer_reply');
        state.lastInboundAt = new Date();
        await updateFlow(state, current, { lastFunnelStage: 'nitrix_fast_state_customer_reply' });
        await respondToCustomer({ state, flow: current, text: inboundText });
        await updateFlow(state, current, { lastFunnelStage: current.status === 'waiting_bottle_confirmation' ? 'nitrix_fast_state_waiting_bottle_confirmation' : 'nitrix_fast_state_customer_reply' });
        return true;
    }
    // Sem origem VSL Nitrix comprovada, nao iniciamos mensagem, audio ou
    // oferta. O guardiao manual existente continua sendo a protecao.
    if (!vslNitrixSourceConfirmed(state)) return false;

    const startedAt = new Date();
    if (looksLikeName(inboundText)) {
        state.metadata = {
            ...(state.metadata || {}),
            customerDraft: {
                ...((state.metadata || {}).customerDraft || {}),
                name: String(inboundText).trim(),
                updatedAt: nowIso()
            }
        };
    }

    // Pergunta real na primeira mensagem vence o roteiro. Ela recebe a
    // resposta aprovada e nenhuma abertura/audio e' enfileirada depois.
    if (!initialVslGreeting(inboundText)) {
        const responseFlow = {
            version: 4,
            generation: crypto.randomBytes(8).toString('hex'),
            status: 'interrupted',
            startedAt: startedAt.toISOString(),
            sessionId,
            jobs: [],
            bottle: { sentAt: '', reason: '', confirmedAt: '' },
            healthTopics: {},
            interruptReason: 'first_inbound_question',
            interruptedAt: nowIso()
        };
        state.assignedAgent = AGENT_KEY;
        state.human = { ...(state.human || {}), mode: 'auto', lastManualAt: startedAt, lastManualBy: 'nitrix_fast_state_question', note: 'Pergunta inicial da VSL Nitrix respondida antes de qualquer mídia do funil.' };
        state.tags = [...new Set([...(state.tags || []), 'NITRIX_EC', 'NITRIX_FAST_STATE', 'NITRIX_INITIAL_QUESTION'])];
        await updateFlow(state, responseFlow, { lastFunnelStage: 'nitrix_fast_state_first_question' });
        await respondToCustomer({ state, flow: responseFlow, text: inboundText });
        await updateFlow(state, responseFlow, { lastFunnelStage: 'nitrix_fast_state_first_question_answered' });
        return true;
    }

    const flow = {
        version: 4,
        generation: crypto.randomBytes(8).toString('hex'),
        status: 'running',
        startedAt: startedAt.toISOString(),
        sessionId,
        copyPlan: entryCopyPlan(state),
        entryLayer: nitrixEntryLayerMode(),
        jobs: buildNitrixEntryJobsForTest(startedAt, { hasKnownName: knownCustomerFullName(state) }),
        bottle: { sentAt: '', reason: '', confirmedAt: '' },
        healthTopics: {}
    };
    state.assignedAgent = AGENT_KEY;
    state.human = { ...(state.human || {}), mode: 'auto', lastManualAt: startedAt, lastManualBy: 'nitrix_fast_state', note: 'Fast State Nitrix EC ativo, com jobs persistentes e cancelamento imediato por resposta.' };
    state.tags = [...new Set([...(state.tags || []), 'NITRIX_EC', 'NITRIX_FAST_STATE', 'BOT_VIT_POWER_BLOQUEADO'])];
    await updateFlow(state, flow, { lastFunnelStage: 'nitrix_fast_state_scheduled' });
    scheduleNextFastStateJob(flow);
    return true;
};

export const ensureNitrixBottleBeforeFinalConfirmation = async ({ contactStateId, sessionId = null } = {}) => {
    const state = contactStateId ? await ContactState.findById(contactStateId) : null;
    if (!state) return { ok: false, error: 'contact_not_found' };
    const flow = clone(flowOf(state) || { sessionId, bottle: {} });
    flow.sessionId = flow.sessionId || sessionId;
    const result = await sendBottleOnce({ state, flow, reason: 'final_confirmation' });
    await updateFlow(state, flow, { lastFunnelStage: 'nitrix_fast_state_final_confirmation' });
    return result;
};
