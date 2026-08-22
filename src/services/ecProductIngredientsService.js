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

export const EC_ALL_PRODUCTS_INGREDIENTS_TEXT = [
    'Claro. Estos son los ingredientes de cada uno de nuestros productos:',
    '',
    '🔵 *Tex Ultra*',
    'Contiene maca peruana, Tribulus terrestris, catuaba, marapuama, zinc y magnesio.',
    '',
    '🟠 *Nitrix Oxide*',
    'Contiene fenogreco (fenugreek), Tribulus terrestris, ginseng Panax —también conocido como ginseng rojo coreano—, ashwagandha, Ginkgo biloba y L-arginina.',
    '',
    '🟢 *Vit Power*',
    'Contiene borojó, chontaduro, noni, L-arginina, maca, guaraná y vitaminas.',
    '',
    'Cada producto tiene una fórmula diferente; por eso, los ingredientes de un producto no deben confundirse con los de los demás.',
    '',
    'Si usa medicamentos o tiene alguna condición de salud, consulte a su médico antes de utilizar cualquier suplemento.',
    '',
    '¿Sobre cuál de los tres productos desea recibir más información: Tex Ultra, Nitrix Oxide o Vit Power?'
].join('\n');

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
        /\bque\s+(?:tiene|contiene|trae|tienen|contienen|traen)\b/,
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

export const isAllProductsIngredientsQuestion = (text = '') => {
    const body = normalize(text);
    if (!body) return false;
    const explicit = [...new Set(explicitProductKeys(text))];
    const mentionsPluralProducts = /\b(?:productos|produtos)\b/.test(body);
    const asksAll = /\b(?:todos|todas|diversos|varios|diferentes)\b/.test(body)
        || /\b(?:los|os)\s+(?:tres|3)\b/.test(body);
    const pluralProductScope = /\b(?:los|estos|nuestros|os|dos|estes|nossos)\s+(?:productos|produtos)\b/.test(body);
    const asksComparison = /\b(?:diferencia|diferencias|diferenca|diferencas|compara(?:r|cion|cao)?|compare)\b/.test(body);
    const hasAllProductScope = explicit.length >= 2
        || (mentionsPluralProducts && (asksAll || pluralProductScope));

    return (isProductIngredientsQuestion(text) && hasAllProductScope)
        || (asksComparison && (explicit.length >= 2 || (mentionsPluralProducts && asksAll)));
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
    const asksAllProducts = isAllProductsIngredientsQuestion(text);
    if ((!isProductIngredientsQuestion(text) && !asksAllProducts) || hasSensitiveHealthContext(text)) return null;
    if (asksAllProducts) {
        if (!PRODUCT_KEYS.has(activeProductKey)) return null;
        return {
            productKey: activeProductKey,
            productName: 'Tex Ultra, Nitrix Oxide y Vit Power',
            scope: 'all_products',
            memoryField: 'productIngredientsFaqAllProducts',
            text: EC_ALL_PRODUCTS_INGREDIENTS_TEXT
        };
    }
    const productKey = resolveIngredientsProductKey({ text, activeProductKey });
    const profile = EC_PRODUCT_INGREDIENTS[productKey];
    if (!profile) return null;
    return {
        productKey,
        ...profile,
        scope: 'single_product',
        memoryField: 'productIngredientsFaq'
    };
};

const memoryOf = (state = {}, productKey = '', memoryField = 'productIngredientsFaq') => (
    state?.metadata?.perAgentMemory?.[productKey]?.[memoryField] || {}
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

    const memory = memoryOf(contactState, reply.productKey, reply.memoryField);
    if (recentEnough(memory.lastSentAt, FAQ_COOLDOWN_MS)) {
        return { handled: true, skipped: 'cooldown', productKey: reply.productKey };
    }

    const now = new Date();
    const memoryPath = `metadata.perAgentMemory.${reply.productKey}.${reply.memoryField}`;
    const lockPath = `${memoryPath}.lockedUntil`;
    const lockMessagePath = `${memoryPath}.lockSourceMessageId`;
    const antiSpamScope = reply.scope === 'all_products' ? 'all_products' : reply.productKey;
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
            outboundContext: `product_ingredients_faq:${antiSpamScope}`,
            antiSpamKey: `product_ingredients_faq:${antiSpamScope}`
        });
    } catch (error) {
        console.error(`[PRODUCT-INGREDIENTS-FAQ] falha de transporte -> ${chatId}: ${error.message}`);
    }
    if (!sent) {
        await ContactState.updateOne(
            { _id: contactStateId },
            {
                $set: {
                    [`${memoryPath}.failedAt`]: new Date()
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
                [`${memoryPath}.lastSentAt`]: new Date(),
                [`${memoryPath}.productKey`]: reply.productKey,
                [`${memoryPath}.scope`]: reply.scope,
                [`${memoryPath}.textHash`]: hashText(reply.text),
                [`${memoryPath}.sourceMessageId`]: String(sourceMessageId || '')
            },
            $unset: {
                [lockPath]: '',
                [lockMessagePath]: '',
                [`${memoryPath}.failedAt`]: ''
            }
        }
    );

    return {
        handled: true,
        productKey: reply.productKey,
        scope: reply.scope,
        textSent: true
    };
};
