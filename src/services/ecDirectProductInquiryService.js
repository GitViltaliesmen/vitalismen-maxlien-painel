import crypto from 'node:crypto';
import ContactState from '../models/ContactState.js';
import Message from '../models/Message.js';
import { sendText } from '../whatsapp/sendText.js';
import {
    getEcuadorOffer,
    getEcuadorProductInfoByKey
} from './ecuadorProductService.js';
import { isOperatorProductRouteLock } from './vslProductAssignmentService.js';

const DIRECT_MEMORY_PATH = 'metadata.ecDirectProductInquiry';
const DIRECT_LOCK_MS = 2 * 60 * 1000;
const DIRECT_CONTEXT_MS = 30 * 24 * 60 * 60 * 1000;
const VSL_ATTRIBUTION_MS = 72 * 60 * 60 * 1000;
const PRODUCT_KEYS = Object.freeze(['tex_ultra_ec', 'nitrix_ec', 'vit_power_ec']);

const PRODUCT_TAGS = Object.freeze({
    tex_ultra_ec: 'TEX_ULTRA_EC',
    nitrix_ec: 'NITRIX_EC',
    vit_power_ec: 'VIT_POWER_EC'
});

const normalize = (value = '') => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s$.,-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const validDateMs = (value) => {
    const timestamp = new Date(value || '').getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
};

export const directEcuadorProductKeys = (text = '') => {
    const body = normalize(text);
    if (!body) return [];
    return PRODUCT_KEYS.filter((productKey) => ({
        tex_ultra_ec: /\btex\s*ultra\b|\btexultra\b/,
        nitrix_ec: /\bnitrix(?:\s+oxide)?\b|\boxido\s+nitrico\b|\bnitric\s+oxide\b/,
        vit_power_ec: /\bvit\s*power\b|\bvitpower\b|\bvi\s*power\b|\bvipower\b/
    })[productKey].test(body));
};

export const isDirectPriceQuestion = (text = '') => {
    const body = normalize(text);
    return /\b(precio|precios|valor|valores|costo|costos|cuanto|cuesta|cuestan|vale|valen)\b/.test(body);
};

export const isDirectPriceObjection = (text = '') => {
    const body = normalize(text);
    return [
        /\b(mas|muy)\s+(barato|economico)\b/,
        /\b(precio|valor|costo)\s+(alto|caro|elevado|diferente)\b/,
        /\b(esta|es|me\s+parece)\s+(caro|costoso)\b/,
        /\b(caro|costoso|rebaja|descuento)\b/,
        /\b(?:vi|visto|encontre|encontrado|ofrecieron)\b.*\b(mas\s+barato|otro\s+precio|precio\s+diferente|menos)\b/,
        /\b(mais\s+barato|preco\s+alto|muito\s+caro|desconto|promocao|outro\s+preco)\b/
    ].some((pattern) => pattern.test(body));
};

const memoryForState = (state = {}) => state?.metadata?.ecDirectProductInquiry || {};

const hasRecentDirectContext = (state = {}, nowMs = Date.now()) => {
    const memory = memoryForState(state);
    return PRODUCT_KEYS.includes(String(memory.activeProductKey || ''))
        && nowMs - validDateMs(memory.requestedAt || memory.updatedAt) <= DIRECT_CONTEXT_MS;
};

export const shouldRouteDirectProductInbound = ({ text = '', state = null } = {}) => {
    const explicitKeys = directEcuadorProductKeys(text);
    if (explicitKeys.length) return true;
    return hasRecentDirectContext(state)
        && (isDirectPriceQuestion(text) || isDirectPriceObjection(text));
};

const isCurrentAuthoritativeVslRequest = ({ state = {}, productKey = '', nowMs = Date.now() } = {}) => {
    const metadata = state?.metadata || {};
    if (String(metadata.vslProductKey || '') !== productKey) return false;
    if (metadata.vslEntryPanelLead !== true && metadata.publicVslLeadEntry !== true) return false;
    const source = String(metadata.vslProductSource || metadata.productSource || '').trim().toLowerCase();
    if (['zapi_explicit_product_text', 'zapi_direct_product_text', 'client_direct_product_request'].includes(source)) {
        return false;
    }
    const attributionAt = validDateMs(
        metadata.vslEntryPanelLeadAt
        || metadata.metaAttributionBridge?.claimedAt
        || metadata.vslInboundAt
    );
    return Boolean(attributionAt && nowMs - attributionAt <= VSL_ATTRIBUTION_MS);
};

const formatUsd = (value) => Number(value || 0).toFixed(2);

const offerLines = (productKey, priceCatalog) => [1, 2, 3, 6]
    .map((quantity) => getEcuadorOffer({ productKey, priceCatalog, quantity }))
    .filter(Boolean)
    .map((offer) => `• ${offer.quantity} ${offer.quantity === 1 ? 'frasco' : 'frascos'}: USD ${formatUsd(offer.total)}`);

const PRODUCT_INFORMATION = Object.freeze({
    vit_power_ec: 'Vit Power Ecuador es una fórmula líquida de apoyo natural para el bienestar masculino. Contiene borojó, chontaduro, noni, L-arginina, maca, guaraná y vitaminas. La entrega en Ecuador se coordina por Servientrega y el pago es contra entrega. ¿Desea conocer el modo de uso o los valores normales?',
    nitrix_ec: 'Nitrix Oxide Ecuador se presenta en cápsulas y es una fórmula de apoyo natural para el bienestar masculino. Contiene fenogreco, Tribulus terrestris, ginseng Panax, ashwagandha, Ginkgo biloba y L-arginina. La entrega en Ecuador se coordina por Servientrega y el pago es contra entrega. ¿Desea conocer el modo de uso o los valores normales?',
    tex_ultra_ec: 'Tex Ultra Ecuador se presenta en cápsulas y contiene maca peruana, Tribulus terrestris, catuaba, marapuama, zinc y magnesio. La entrega en Ecuador se coordina por Servientrega y el pago es contra entrega. ¿Desea conocer el modo de uso o los valores normales?'
});

export const buildDirectProductReply = ({
    text = '',
    productKey = '',
    ambiguousProductKeys = []
} = {}) => {
    if (ambiguousProductKeys.length > 1) {
        const names = ambiguousProductKeys
            .map((key) => getEcuadorProductInfoByKey(key)?.name)
            .filter(Boolean);
        return {
            responseKind: 'product_choice',
            priceCatalog: '',
            text: `Para no mezclar productos ni valores, ¿cuál desea consultar primero: ${names.join(' o ')}?`
        };
    }

    const product = getEcuadorProductInfoByKey(productKey);
    if (!product) return null;
    if (isDirectPriceObjection(text)) {
        return {
            responseKind: 'promotional_price',
            priceCatalog: 'promotional',
            text: [
                `Le entiendo. Como nos indicó que busca un precio más bajo, puedo habilitarle estos valores promocionales de ${product.name}:`,
                '',
                ...offerLines(productKey, 'promotional'),
                '',
                '¿Cuántos frascos desea?'
            ].join('\n')
        };
    }
    if (isDirectPriceQuestion(text)) {
        return {
            responseKind: 'normal_price',
            priceCatalog: 'normal',
            text: [
                `Estos son los valores normales de ${product.name}:`,
                '',
                ...offerLines(productKey, 'normal'),
                '',
                '¿Cuántos frascos desea?'
            ].join('\n')
        };
    }
    return {
        responseKind: 'product_information',
        priceCatalog: 'normal',
        text: PRODUCT_INFORMATION[productKey]
    };
};

const recentOutboundHistoryHasText = async ({ chatId = '', phoneDigits = '', text = '' } = {}) => {
    if (!text || Message?.db?.readyState !== 1) return false;
    const phone = String(phoneDigits || '').replace(/\D/g, '');
    const tail = phone.length >= 9 ? phone.slice(-9) : '';
    const identityClauses = [
        chatId ? { chatId } : null,
        chatId ? { to: chatId } : null,
        phone ? { peerPhone: phone } : null,
        tail ? { peerPhone: { $regex: `${tail}$` } } : null
    ].filter(Boolean);
    if (!identityClauses.length) return false;
    const found = await Message.exists({
        $and: [
            { $or: identityClauses },
            { $or: [{ isFromMe: true }, { isBot: true }, { from: 'bot' }] },
            { body: text }
        ]
    }).catch(() => null);
    return Boolean(found);
};

const productContextUpdate = ({ state = {}, productKey = '', productName = '', priceCatalog = '' } = {}) => {
    const operatorLock = isOperatorProductRouteLock(state);
    const preserveOperatorSelection = Boolean(operatorLock?.productKey && operatorLock.productKey !== productKey);
    const operatorProductPreserved = Boolean(operatorLock);
    if (preserveOperatorSelection) return { preserveOperatorSelection, operatorProductPreserved, set: {}, push: null };
    const now = new Date();
    const draft = state?.metadata?.customerDraft || {};
    return {
        preserveOperatorSelection,
        set: {
            assignedAgent: productKey,
            'metadata.productKey': productKey,
            'metadata.productName': productName,
            'metadata.productSource': 'client_direct_product_request',
            ...(!operatorLock ? { 'metadata.productRouteLock': {
                active: true,
                productKey,
                productName,
                lockedAt: now.toISOString(),
                source: 'client_direct_product_request',
                reason: 'client_explicitly_requested_product'
            } } : {}),
            'metadata.customerDraft': {
                ...draft,
                product: productName,
                productKey,
                productName,
                negotiationProductKey: productKey,
                negotiationProductName: productName,
                negotiationProductSource: 'client_direct_product_request',
                ...(priceCatalog ? { priceCatalog } : {}),
                updatedAt: now.toISOString()
            }
        },
        operatorProductPreserved,
        push: {
            agentHistory: {
                $each: [{
                    agent: productKey,
                    reason: 'client_direct_product_request',
                    at: now
                }],
                $slice: -12
            }
        }
    };
};

const hashText = (value = '') => crypto.createHash('sha256').update(String(value || '')).digest('hex');

export const maybeHandleEcuadorDirectProductInquiry = async ({
    text = '',
    chatId = '',
    phoneDigits = '',
    contactStateId = '',
    contactState = null,
    sourceMessageId = '',
    sessionId = null
} = {}) => {
    if (!contactStateId || !contactState || !chatId) return { handled: false };

    const explicitKeys = directEcuadorProductKeys(text);
    const memory = memoryForState(contactState);
    const rememberedProductKey = hasRecentDirectContext(contactState)
        ? String(memory.activeProductKey || '')
        : '';
    if (!explicitKeys.length && !rememberedProductKey) return { handled: false };
    if (!explicitKeys.length && !isDirectPriceQuestion(text) && !isDirectPriceObjection(text)) {
        return { handled: false };
    }
    const productKey = explicitKeys.length === 1
        ? explicitKeys[0]
        : explicitKeys.length > 1
            ? ''
            : rememberedProductKey;
    if (
        explicitKeys.length === 1
        && isCurrentAuthoritativeVslRequest({ state: contactState, productKey })
    ) {
        return { handled: false, skipped: 'authoritative_vsl_flow' };
    }

    const reply = buildDirectProductReply({
        text,
        productKey,
        ambiguousProductKeys: explicitKeys
    });
    if (!reply?.text) return { handled: false };

    const effectiveProductKey = productKey || 'multiple_products';
    const product = getEcuadorProductInfoByKey(productKey);
    const responsePath = `${DIRECT_MEMORY_PATH}.responses.${effectiveProductKey}.${reply.responseKind}`;
    const existingResponse = memory?.responses?.[effectiveProductKey]?.[reply.responseKind] || {};
    if (existingResponse.sentAt) {
        return {
            handled: true,
            skipped: 'persistent_sent',
            productKey,
            responseKind: reply.responseKind
        };
    }

    const now = new Date();
    const lockPath = `${DIRECT_MEMORY_PATH}.lockUntil`;
    const sentPath = `${responsePath}.sentAt`;
    const claim = await ContactState.updateOne(
        {
            _id: contactStateId,
            $and: [
                {
                    $or: [
                        { [lockPath]: { $exists: false } },
                        { [lockPath]: null },
                        { [lockPath]: { $lte: now } }
                    ]
                },
                {
                    $or: [
                        { [sentPath]: { $exists: false } },
                        { [sentPath]: null }
                    ]
                }
            ]
        },
        {
            $set: {
                [lockPath]: new Date(now.getTime() + DIRECT_LOCK_MS),
                [`${DIRECT_MEMORY_PATH}.lockSourceMessageId`]: String(sourceMessageId || '')
            }
        }
    );
    if (claim.modifiedCount !== 1) {
        const latestState = await ContactState.findById(contactStateId).lean().catch(() => null);
        const latestResponse = latestState?.metadata?.ecDirectProductInquiry
            ?.responses?.[effectiveProductKey]?.[reply.responseKind] || {};
        if (latestResponse.sentAt) {
            return { handled: true, skipped: 'persistent_sent', productKey, responseKind: reply.responseKind };
        }
        return { handled: true, skipped: 'persistent_lock', productKey, responseKind: reply.responseKind };
    }

    const context = product
        ? productContextUpdate({
            state: contactState,
            productKey,
            productName: product.name,
            priceCatalog: reply.priceCatalog
        })
        : { preserveOperatorSelection: false, operatorProductPreserved: false, set: {}, push: null };
    const contextSet = {
        ...context.set,
        [`${DIRECT_MEMORY_PATH}.activeProductKey`]: productKey || '',
        [`${DIRECT_MEMORY_PATH}.activeProductName`]: product?.name || '',
        [`${DIRECT_MEMORY_PATH}.requestedAt`]: now,
        [`${DIRECT_MEMORY_PATH}.updatedAt`]: now,
        [`${DIRECT_MEMORY_PATH}.sourceMessageId`]: String(sourceMessageId || ''),
        [`${DIRECT_MEMORY_PATH}.vslProductKeyAtRequest`]: String(contactState?.metadata?.vslProductKey || ''),
        [`${DIRECT_MEMORY_PATH}.operatorProductPreserved`]: context.operatorProductPreserved,
        ...(reply.priceCatalog ? { [`${DIRECT_MEMORY_PATH}.priceCatalog`]: reply.priceCatalog } : {})
    };
    const contextUpdate = {
        $set: contextSet,
        ...(product ? { $addToSet: { tags: { $each: ['DIRECT_PRODUCT_INQUIRY', PRODUCT_TAGS[productKey]] } } } : {}),
        ...(context.push ? { $push: context.push } : {})
    };
    await ContactState.updateOne({ _id: contactStateId }, contextUpdate);

    const historyMatch = await recentOutboundHistoryHasText({
        chatId,
        phoneDigits: phoneDigits || contactState?.phoneDigits,
        text: reply.text
    });
    if (historyMatch) {
        await ContactState.updateOne(
            { _id: contactStateId },
            {
                $set: {
                    [`${responsePath}.sentAt`]: now,
                    [`${responsePath}.historyMatchedAt`]: now,
                    [`${responsePath}.textHash`]: hashText(reply.text)
                },
                $unset: {
                    [lockPath]: '',
                    [`${DIRECT_MEMORY_PATH}.lockSourceMessageId`]: ''
                }
            }
        );
        return { handled: true, skipped: 'message_history', productKey, responseKind: reply.responseKind };
    }

    let sent = false;
    try {
        sent = await sendText(chatId, reply.text, null, {
            sessionId,
            recipientDigits: phoneDigits || contactState?.phoneDigits || '',
            humanize: false,
            sendMode: 'ec_direct_product_inquiry',
            allowExistingDropiOrder: true,
            outboundContext: `ec_direct_product_inquiry:${effectiveProductKey}:${reply.responseKind}`,
            antiSpamKey: `ec_direct_product_inquiry:${effectiveProductKey}:${reply.responseKind}`,
            dedupeValue: `ec_direct_product_inquiry:${effectiveProductKey}:${reply.responseKind}`
        });
    } catch (error) {
        console.error(`[EC-DIRECT-PRODUCT] falha de transporte -> ${chatId}: ${error.message}`);
    }

    if (!sent) {
        await ContactState.updateOne(
            { _id: contactStateId },
            {
                $set: {
                    [`${responsePath}.failedAt`]: new Date(),
                    [`${responsePath}.textHash`]: hashText(reply.text)
                },
                $unset: {
                    [lockPath]: '',
                    [`${DIRECT_MEMORY_PATH}.lockSourceMessageId`]: ''
                }
            }
        ).catch(() => null);
        return { handled: true, skipped: 'send_failed', productKey, responseKind: reply.responseKind };
    }

    await ContactState.updateOne(
        { _id: contactStateId },
        {
            $set: {
                [`${responsePath}.sentAt`]: new Date(),
                [`${responsePath}.sourceMessageId`]: String(sourceMessageId || ''),
                [`${responsePath}.textHash`]: hashText(reply.text),
                ...(reply.responseKind === 'promotional_price' ? {
                    [`${DIRECT_MEMORY_PATH}.promotionUnlockedAt`]: new Date(),
                    [`${DIRECT_MEMORY_PATH}.promotionUnlockReason`]: 'explicit_price_objection'
                } : {})
            },
            $unset: {
                [lockPath]: '',
                [`${DIRECT_MEMORY_PATH}.lockSourceMessageId`]: '',
                [`${responsePath}.failedAt`]: ''
            }
        }
    );

    return {
        handled: true,
        productKey,
        responseKind: reply.responseKind,
        priceCatalog: reply.priceCatalog,
        operatorProductPreserved: context.operatorProductPreserved,
        textSent: true
    };
};
