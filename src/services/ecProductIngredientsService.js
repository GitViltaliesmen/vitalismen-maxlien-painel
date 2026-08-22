import crypto from 'node:crypto';
import ContactState from '../models/ContactState.js';
import { sendText } from '../whatsapp/sendText.js';

const FAQ_COOLDOWN_MS = 30 * 60 * 1000;
const FAQ_LOCK_MS = 2 * 60 * 1000;
const PRODUCT_KEYS = new Set(['tex_ultra_ec', 'nitrix_ec', 'vit_power_ec']);
const AUTOMATION_MANUAL_OWNERS = new Set([
    'nitrix_route_guard',
    'tex_ultra_route_guard',
    'tex_ultra_funnel',
    'vsl_ec'
]);

export const EC_PRODUCT_INGREDIENTS = Object.freeze({
    tex_ultra_ec: Object.freeze({
        productName: 'Tex Ultra',
        ingredients: Object.freeze([
            'maca peruana',
            'Tribulus terrestris',
            'catuaba',
            'marapuama',
            'zinc',
            'magnesio'
        ]),
        text: 'Claro, señor. La fórmula de Tex Ultra contiene maca peruana, Tribulus terrestris, catuaba, marapuama, zinc y magnesio.\n\nSi usa medicamentos o tiene alguna condición de salud, consulte a su médico antes de usar cualquier suplemento. ¿Desea que le explique el modo de uso o que continuemos con las opciones disponibles?'
    }),
    nitrix_ec: Object.freeze({
        productName: 'Nitrix Oxide',
        ingredients: Object.freeze([
            'fenogreco (fenugreek)',
            'Tribulus terrestris',
            'ginseng Panax (ginseng rojo coreano)',
            'ashwagandha',
            'Ginkgo biloba',
            'L-arginina'
        ]),
        text: 'Claro, señor. La fórmula de Nitrix Oxide contiene fenogreco (fenugreek), Tribulus terrestris, ginseng Panax (ginseng rojo coreano), ashwagandha, Ginkgo biloba y L-arginina.\n\nSi usa medicamentos o tiene alguna condición de salud, consulte a su médico antes de usar cualquier suplemento. ¿Desea que le explique el modo de uso o que continuemos con la información del producto?'
    }),
    vit_power_ec: Object.freeze({
        productName: 'Vit Power',
        ingredients: Object.freeze([
            'borojó',
            'chontaduro',
            'noni',
            'L-arginina',
            'maca',
            'guaraná',
            'vitaminas'
        ]),
        text: 'Claro, señor. La fórmula de Vit Power contiene borojó, chontaduro, noni, L-arginina, maca, guaraná y vitaminas.\n\nSi usa medicamentos o tiene alguna condición de salud, consulte a su médico antes de usar cualquier suplemento. ¿Desea que le explique el modo de uso o que continuemos con las opciones disponibles?'
    })
});

const normalize = (value = '') => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const isProductIngredientsQuestion = (text = '') => {
    const body = normalize(text);
    if (!body) return false;
    return [
        /\bingredientes?\b/,
        /\bingriendentes?\b/,
        /\bcomposicion\b/,
        /\bformula\b/,
        /\bcomponentes?\b/,
        /\bque\s+(?:tiene|contiene|trae)\b/,
        /\bquais?\s+ingredientes?\b/,
        /\bo\s+que\s+(?:tem|contem)\b/,
        /\b(?:maca|tribulus|catuaba|marapuama|fenogreco|fenugreek|ginseng|ashwagandha|ginkgo|arginina)\b/
    ].some((pattern) => pattern.test(body));
};

export const hasSensitiveHealthContext = (text = '') => {
    const body = normalize(text);
    return /\b(?:diabetes|diabetico|presion|hipertension|corazon|cardiaco|medicamento|medicina|remedio|pastilla|cirugia|rinon|renal|higado|alergia|contraindicacion|embarazo)\b/.test(body);
};

const explicitProductKeys = (text = '') => {
    const body = normalize(text);
    return [
        [/\btex\s*ultra\b/, 'tex_ultra_ec'],
        [/\bnitrix(?:\s+oxide)?\b/, 'nitrix_ec'],
        [/\bvit\s*power\b|\bvitpower\b/, 'vit_power_ec']
    ].filter(([pattern]) => pattern.test(body)).map(([, productKey]) => productKey);
};

export const resolveIngredientsProductKey = ({ text = '', activeProductKey = '' } = {}) => {
    const active = PRODUCT_KEYS.has(activeProductKey) ? activeProductKey : '';
    if (!active) return '';
    const explicit = [...new Set(explicitProductKeys(text))];
    if (explicit.length > 1) return '';
    if (active && explicit.length === 1 && explicit[0] !== active) return '';
    return active;
};

export const productIngredientsReply = ({ text = '', activeProductKey = '' } = {}) => {
    if (!isProductIngredientsQuestion(text) || hasSensitiveHealthContext(text)) return null;
    const productKey = resolveIngredientsProductKey({ text, activeProductKey });
    const profile = EC_PRODUCT_INGREDIENTS[productKey];
    if (!profile) return null;
    return { productKey, ...profile };
};

const memoryOf = (state = {}, productKey = '') => (
    state?.metadata?.perAgentMemory?.[productKey]?.productIngredientsFaq || {}
);

const blockedByHumanOperator = (state = {}) => {
    if (state?.human?.mode !== 'manual') return false;
    return !AUTOMATION_MANUAL_OWNERS.has(String(state?.human?.lastManualBy || ''));
};

const recentEnough = (value, intervalMs, nowMs = Date.now()) => {
    const timestamp = new Date(value || '').getTime();
    return Number.isFinite(timestamp) && nowMs - timestamp < intervalMs;
};

const hashText = (value = '') => crypto.createHash('sha256').update(String(value || '')).digest('hex');

export const maybeHandleEcuadorProductIngredients = async ({
    text = '',
    chatId = '',
    contactStateId = '',
    contactState = null,
    activeProductKey = '',
    sourceMessageId = '',
    sessionId = null
} = {}) => {
    if (!contactStateId || !contactState || !chatId) return { handled: false };
    if (blockedByHumanOperator(contactState)) return { handled: false, skipped: 'human_operator_active' };

    const reply = productIngredientsReply({ text, activeProductKey });
    if (!reply) return { handled: false };

    const memory = memoryOf(contactState, reply.productKey);
    if (recentEnough(memory.lastSentAt, FAQ_COOLDOWN_MS)) {
        return { handled: true, skipped: 'cooldown', productKey: reply.productKey };
    }

    const now = new Date();
    const lockPath = `metadata.perAgentMemory.${reply.productKey}.productIngredientsFaq.lockedUntil`;
    const lockMessagePath = `metadata.perAgentMemory.${reply.productKey}.productIngredientsFaq.lockSourceMessageId`;
    const claim = await ContactState.updateOne(
        {
            _id: contactStateId,
            $or: [
                { [lockPath]: { $exists: false } },
                { [lockPath]: null },
                { [lockPath]: { $lte: now } }
            ]
        },
        {
            $set: {
                [lockPath]: new Date(now.getTime() + FAQ_LOCK_MS),
                [lockMessagePath]: String(sourceMessageId || '')
            }
        }
    );
    if (claim.modifiedCount !== 1) {
        return { handled: true, skipped: 'persistent_lock', productKey: reply.productKey };
    }

    let sent = false;
    try {
        sent = await sendText(chatId, reply.text, null, {
            sessionId,
            sendMode: 'product_ingredients_faq',
            allowExistingDropiOrder: true,
            outboundContext: `product_ingredients_faq:${reply.productKey}`,
            antiSpamKey: `product_ingredients_faq:${reply.productKey}`
        });
    } catch (error) {
        console.error(`[PRODUCT-INGREDIENTS-FAQ] falha de transporte -> ${chatId}: ${error.message}`);
    }
    if (!sent) {
        await ContactState.updateOne(
            { _id: contactStateId },
            {
                $set: {
                    [`metadata.perAgentMemory.${reply.productKey}.productIngredientsFaq.failedAt`]: new Date()
                },
                $unset: {
                    [lockPath]: '',
                    [lockMessagePath]: ''
                }
            }
        ).catch(() => null);
        return { handled: false, productKey: reply.productKey, reason: 'send_failed' };
    }

    await ContactState.updateOne(
        { _id: contactStateId },
        {
            $set: {
                [`metadata.perAgentMemory.${reply.productKey}.productIngredientsFaq.lastSentAt`]: new Date(),
                [`metadata.perAgentMemory.${reply.productKey}.productIngredientsFaq.productKey`]: reply.productKey,
                [`metadata.perAgentMemory.${reply.productKey}.productIngredientsFaq.textHash`]: hashText(reply.text),
                [`metadata.perAgentMemory.${reply.productKey}.productIngredientsFaq.sourceMessageId`]: String(sourceMessageId || '')
            },
            $unset: {
                [lockPath]: '',
                [lockMessagePath]: '',
                [`metadata.perAgentMemory.${reply.productKey}.productIngredientsFaq.failedAt`]: ''
            }
        }
    );

    return {
        handled: true,
        productKey: reply.productKey,
        textSent: true
    };
};
