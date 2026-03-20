import { openaiService } from './openaiService.js';
import Message from '../models/Message.js';
import Order from '../models/Order.js';
import ContactState from '../models/ContactState.js';
import { enrichOutboundPlan, executePreparedOutboundPlan } from './outboundComposer.js';
import { AGENT_PROFILES } from './agentProfiles.js';

const resolveRealChatId = (msg) => {
    const candidates = [msg.from, msg.to].filter(Boolean);
    const validId = candidates.find(c => String(c).endsWith('@s.whatsapp.net') || String(c).endsWith('@c.us'));
    return validId || msg.from || msg.to || null;
};

const inferCustomerCountry = (chatId) => {
    const digits = String(chatId || '').replace(/\D/g, '');
    if (digits.startsWith('593')) {
        return {
            country: 'Ecuador',
            countryCode: 'EC',
            phonePrefix: '593',
            product: 'Vit Power',
            priceTable: '1 frasco por 39.99 USD, 2 frascos por 69.99 USD, 3 frascos por 95.99 USD, 6 frascos por 167.99 USD'
        };
    }

    if (digits.startsWith('57')) {
        return {
            country: 'Colombia',
            countryCode: 'CO',
            phonePrefix: '57',
            product: 'Superfull',
            priceTable: '1 frasco por 149.000 COP, 2 frascos por 240.000 COP, 3 frascos por 290.000 COP, 6 frascos por 510.000 COP'
        };
    }

    return {
        country: 'Internacional',
        countryCode: 'INTL',
        phonePrefix: digits.slice(0, 4) || null,
        product: null,
        priceTable: null
    };
};

const hasBotIntroducedItself = async (chatId) => {
    const introRegex = /soy ana lopes/i;
    const introMessage = await Message.findOne({
        chatId,
        isBot: true,
        body: { $regex: introRegex }
    }).sort({ createdAt: -1 });
    return !!introMessage;
};

const buildCustomerMemory = async ({ chatId, customerContext }) => {
    const digits = String(chatId || '').replace(/\D/g, '');
    const phoneTail = digits.length >= 10 ? digits.slice(-10) : digits;

    const [recentMessages, latestOrder] = await Promise.all([
        Message.find({ chatId }).sort({ createdAt: -1 }).limit(12).lean(),
        phoneTail
            ? Order.findOne({
                ...(customerContext.countryCode && ['CO', 'EC'].includes(customerContext.countryCode)
                    ? { country: customerContext.countryCode }
                    : {}),
                'customer.phone': { $regex: phoneTail }
            }).sort({ updatedAt: -1, createdAt: -1 }).lean()
            : null
    ]);

    const history = recentMessages
        .reverse()
        .map((item) => ({
            role: item.isBot ? 'assistant' : 'user',
            content: item.body || ''
        }))
        .filter((item) => item.content.trim())
        .slice(-10);

    const customerProfile = latestOrder ? {
        orderId: latestOrder.orderId || null,
        status: latestOrder.status || null,
        name: latestOrder.customer?.name || null,
        phone: latestOrder.customer?.phone || null,
        city: latestOrder.customer?.city || null,
        province: latestOrder.customer?.province || null,
        address: latestOrder.customer?.address || null,
        productLabel: latestOrder.package?.label || null,
        packageQuantity: latestOrder.package?.quantity || null,
        total: latestOrder.total || null,
        currency: latestOrder.currency || null,
        notes: latestOrder.notes || null,
        conversationMemory: latestOrder.conversationMemory || null
    } : null;

    return { history, customerProfile };
};

const inferIntent = (text) => {
    const body = String(text || '').toLowerCase();
    if (!body.trim()) return 'unknown';
    if (/(precio|valor|cu[aá]nto|cuanto|cost[aá]|promo)/i.test(body)) return 'price_check';
    if (/(quiero|me interesa|deseo|llevar|comprar)/i.test(body)) return 'purchase_intent';
    if (/(consulta|doctora|doctor|protocolo|acompa[nñ]amiento)/i.test(body)) return 'consultation_interest';
    if (/(env[ií]o|entrega|direcci[oó]n|ciudad)/i.test(body)) return 'shipping_info';
    if (/(diabet|presi[oó]n|hiperten|cirug)/i.test(body)) return 'contraindication_question';
    return 'general_question';
};

const inferFunnelStage = (text, customerContext, agentProfile) => {
    const body = String(text || '').toLowerCase();
    if (agentProfile?.key === 'warmup') return 'warmup_conversation';
    if (/(nombre|direccion|direcci[oó]n|ciudad|provincia|barrio|departamento|referencia)/i.test(body)) return 'collecting_customer_data';
    if (/(1 frasco|2 frascos|3 frascos|6 frascos|un frasco|dos frascos|tres frascos|seis frascos)/i.test(body)) return 'package_selection';
    if (/(precio|valor|promo|promoci[oó]n)/i.test(body)) return 'offer_presented';
    if (agentProfile?.key === 'vitalismen' || customerContext.countryCode === 'INTL') return 'consultation_offer';
    return 'qualification';
};

const inferLastObjection = (text) => {
    const body = String(text || '').toLowerCase();
    if (/(diabet)/i.test(body)) return 'diabetes';
    if (/(presi[oó]n|hiperten)/i.test(body)) return 'hypertension';
    if (/(cirug)/i.test(body)) return 'post_surgery';
    if (/(contraindica)/i.test(body)) return 'contraindications';
    if (/(confianza|funciona|verdad|real)/i.test(body)) return 'trust';
    if (/(caro|costoso|mucho)/i.test(body)) return 'price_resistance';
    return null;
};

const buildConversationSummary = ({ customerContext, intent, funnelStage, lastObjection, latestOrder, agentProfile }) => {
    const parts = [
        agentProfile?.key ? `agente=${agentProfile.key}` : null,
        customerContext.country ? `pais=${customerContext.country}` : null,
        customerContext.product ? `producto=${customerContext.product}` : null,
        intent ? `intencion=${intent}` : null,
        funnelStage ? `etapa=${funnelStage}` : null,
        lastObjection ? `objecion=${lastObjection}` : null,
        latestOrder?.customer?.name ? `nombre=${latestOrder.customer.name}` : null,
        latestOrder?.customer?.city ? `ciudad=${latestOrder.customer.city}` : null
    ].filter(Boolean);

    return parts.join(' | ');
};

const shouldForceAudio = ({ intent, lastObjection, agentProfile }) => {
    if (agentProfile?.key === 'warmup') return false;
    return [
        'price_check',
        'purchase_intent',
        'consultation_interest',
        'contraindication_question'
    ].includes(intent) || !!lastObjection;
};

const shouldForceImage = ({ intent, lastObjection, customerContext, agentProfile }) => {
    return null;
};

const shouldUseTextOnly = ({ replyText, intent, funnelStage }) => {
    const body = String(replyText || '').toLowerCase();
    if (funnelStage === 'collecting_customer_data') return true;
    if (intent === 'shipping_info') return true;
    if (/(nombre completo|direccion completa|direcci[oó]n completa|punto de referencia|ciudad|departamento|barrio|provincia)/i.test(body)) return true;
    if (/(te envio|te envío|te mando|confirmo tu pedido|confirmo el pedido|esta de acuerdo|est[aá] de acuerdo)/i.test(body)) return true;
    if (/(3 frascos|6 frascos|2 frascos|1 frasco).*(39\.99|69\.99|95\.99|167\.99|149\.000|240\.000|290\.000|510\.000)/i.test(body)) return true;
    return false;
};

const shouldUseAudioOnly = ({ intent, funnelStage, replyText, agentProfile }) => {
    if (shouldUseTextOnly({ replyText, intent, funnelStage })) return false;
    if (agentProfile?.outputStrategy === 'audio_only_preferred') return true;
    return true;
};

const determineResponseMode = ({ replyText, intent, funnelStage, agentProfile, isShortGreeting = false }) => {
    if (isShortGreeting) return 'text_only';
    if (agentProfile?.key === 'warmup') return 'text_only';
    if (shouldUseTextOnly({ replyText, intent, funnelStage })) return 'text_only';
    if (agentProfile?.outputStrategy === 'mixed_consultation' && intent === 'consultation_interest') return 'mixed';
    if (shouldUseAudioOnly({ intent, funnelStage, replyText, agentProfile })) return 'audio_only';
    return 'mixed';
};

const updateOrderConversationMemory = async ({ chatId, customerContext, text, agentProfile }) => {
    const digits = String(chatId || '').replace(/\D/g, '');
    const phoneTail = digits.length >= 10 ? digits.slice(-10) : digits;
    if (!phoneTail) return null;

    const latestOrder = await Order.findOne({
        ...(customerContext.countryCode && ['CO', 'EC'].includes(customerContext.countryCode)
            ? { country: customerContext.countryCode }
            : {}),
        'customer.phone': { $regex: phoneTail }
    }).sort({ updatedAt: -1, createdAt: -1 });

    if (!latestOrder) return null;

    const intent = inferIntent(text);
    const funnelStage = inferFunnelStage(text, customerContext, agentProfile);
    const detectedObjection = inferLastObjection(text);
    const currentObjection = detectedObjection || latestOrder.conversationMemory?.lastObjection || null;

    latestOrder.conversationMemory = {
        currentIntent: intent,
        funnelStage,
        lastObjection: currentObjection,
        activeAgent: agentProfile?.key || 'fallback',
        lastCustomerMessageAt: new Date(),
        lastBotMessageAt: latestOrder.conversationMemory?.lastBotMessageAt || null,
        lastSummary: buildConversationSummary({
            customerContext,
            intent,
            funnelStage,
            lastObjection: currentObjection,
            latestOrder,
            agentProfile
        })
    };

    await latestOrder.save();
    latestOrder.$locals = {
        inferredIntent: intent,
        inferredFunnelStage: funnelStage,
        inferredObjection: currentObjection
    };

    return latestOrder;
};

const getGreetingReply = ({ agentProfile, alreadyIntroduced }) => {
    const greeting = agentProfile?.greeting || AGENT_PROFILES.fallback.greeting;
    return alreadyIntroduced ? greeting.introduced : greeting.firstTouch;
};

const normalizeComparableText = (text) => String(text || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const avoidRepeatedReply = ({ replyText, history, agentProfile }) => {
    const comparableReply = normalizeComparableText(replyText);
    if (!comparableReply) return replyText;

    const recentAssistantMessages = (history || [])
        .filter((item) => item.role === 'assistant')
        .slice(-4)
        .map((item) => normalizeComparableText(item.content));

    if (!recentAssistantMessages.includes(comparableReply)) {
        return replyText;
    }

    const suffixByAgent = {
        warmup: ' Te leo 👀',
        vitalismen: ' Si quieres, te guio con el siguiente paso.',
        vit_power_ec: ' Si quieres, te explico la promocion de hoy.',
        superfull_co: ' Si quieres, te explico la promocion disponible.',
        fallback: ' Si quieres, te oriento mejor segun tu caso.'
    };

    const suffix = suffixByAgent[agentProfile?.key] || suffixByAgent.fallback;
    return `${String(replyText || '').trim()}${suffix}`;
};

const updateContactStateAgentMemory = async ({
    contactStateId,
    agentProfile,
    inboundText,
    outboundText,
    inferredIntent,
    inferredFunnelStage,
    inferredObjection
}) => {
    if (!contactStateId) return;

    const state = await ContactState.findById(contactStateId);
    if (!state) return;

    state.lastOutboundAt = new Date();
    state.metadata = {
        ...(state.metadata || {}),
        lastKnownIntent: inferredIntent,
        lastKnownFunnelStage: inferredFunnelStage,
        lastKnownObjection: inferredObjection,
        perAgentMemory: {
            ...((state.metadata || {}).perAgentMemory || {}),
            [agentProfile.key]: {
                ...(((state.metadata || {}).perAgentMemory || {})[agentProfile.key] || {}),
                lastInboundAt: state.lastInboundAt || new Date(),
                lastInboundText: inboundText,
                lastOutboundAt: new Date(),
                lastOutboundText: outboundText,
                lastIntent: inferredIntent,
                lastFunnelStage: inferredFunnelStage,
                lastObjection: inferredObjection
            }
        }
    };

    await state.save();
};

export const handleAgentConversation = async (msg, agentProfile = AGENT_PROFILES.fallback) => {
    try {
        console.log(`[LOG_HANDLER_ENTER] 🚀 Processando mensagem... agente=${agentProfile.key}`);

        const text = msg.body || '';
        const jid = msg.from;

        if (!text.trim()) return;
        if (jid === 'status@broadcast' || jid.includes('@g.us') || msg.fromMe) {
            console.log('[LOG_FILTER] ❌ Mensagem ignorada (Status/Grupo/Própria)');
            return;
        }

        const chatId = resolveRealChatId(msg);
        const customerContext = inferCustomerCountry(chatId);
        const alreadyIntroduced = await hasBotIntroducedItself(chatId);
        const memoryOrder = await updateOrderConversationMemory({ chatId, customerContext, text, agentProfile });
        const customerMemory = await buildCustomerMemory({ chatId, customerContext });
        console.log(`[BOT] ✅ Trabalhando no Chat: ${chatId} | agente=${agentProfile.key}`);

        try {
            await Message.create({
                _id: msg.id || `in_${Date.now()}`,
                chatId,
                peerPhone: chatId.replace(/\D/g, ''),
                from: jid,
                to: 'bot',
                body: text,
                type: 'chat',
                isFromMe: false,
                isBot: false,
                timestamp: Math.floor(Date.now() / 1000)
            });
        } catch (dbErr) {
            if (dbErr.code !== 11000) console.error('[DB-ERROR] Erro ao salvar:', dbErr.message);
        }

        let replyText = null;
        const pureBody = text.trim().toLowerCase();
        const shortGreetings = ['oi', 'olá', 'ola', 'hola', 'opa', 'bom dia', 'boa tarde', 'boa noite'];
        const isShortGreeting = pureBody.length <= 4 || shortGreetings.includes(pureBody);

        if (isShortGreeting) {
            replyText = getGreetingReply({ agentProfile, alreadyIntroduced });
        } else {
            console.log(`[AI-START] 🤖 Consultando OpenAI... agente=${agentProfile.key}`);
            const aiResult = await openaiService.generateResponse(text, {
                ...customerContext,
                alreadyIntroduced,
                history: customerMemory.history,
                customerProfile: customerMemory.customerProfile,
                conversationMemory: memoryOrder?.conversationMemory || customerMemory.customerProfile?.conversationMemory || null,
                agentKey: agentProfile.key,
                agentMode: agentProfile.mode,
                agentPrompt: agentProfile.promptAddOn || '',
                agentSystemPrompt: agentProfile.systemPrompt || ''
            });
            replyText = avoidRepeatedReply({
                replyText: aiResult.text,
                history: customerMemory.history,
                agentProfile
            });
        }

        if (!replyText) return;
        replyText = avoidRepeatedReply({
            replyText,
            history: customerMemory.history,
            agentProfile
        });

        const inferredIntent = memoryOrder?.$locals?.inferredIntent || inferIntent(text);
        const inferredFunnelStage = memoryOrder?.$locals?.inferredFunnelStage || inferFunnelStage(text, customerContext, agentProfile);
        const inferredObjection = memoryOrder?.$locals?.inferredObjection || inferLastObjection(text);
        const responseMode = determineResponseMode({
            replyText,
            intent: inferredIntent,
            funnelStage: inferredFunnelStage,
            agentProfile,
            isShortGreeting
        });
        const preparedPlan = enrichOutboundPlan({
            rawText: replyText,
            forceAudioText: shouldForceAudio({
                intent: inferredIntent,
                lastObjection: inferredObjection,
                agentProfile
            }) ? replyText : null,
            forceImageKey: shouldForceImage({
                intent: inferredIntent,
                lastObjection: inferredObjection,
                customerContext,
                agentProfile
            }),
            mode: responseMode
        });
        const outbound = await executePreparedOutboundPlan({ jid: chatId, plan: preparedPlan });

        if (!outbound.delivered) return;

        console.log(`[OUTBOUND-OK] ✅ Resposta enviada para ${chatId} | agente=${agentProfile.key}`);
        try {
            await Message.create({
                _id: `out_${Date.now()}`,
                chatId,
                peerPhone: chatId.replace(/\D/g, ''),
                from: 'bot',
                to: chatId,
                body: outbound.cleanText || replyText,
                isFromMe: true,
                isBot: true,
                timestamp: Math.floor(Date.now() / 1000)
            });
        } catch (e) { }

        if (memoryOrder) {
            memoryOrder.conversationMemory = {
                ...(memoryOrder.conversationMemory || {}),
                activeAgent: agentProfile.key,
                lastBotMessageAt: new Date()
            };
            await memoryOrder.save();
        }

        await updateContactStateAgentMemory({
            contactStateId: msg.contactStateId,
            agentProfile,
            inboundText: text,
            outboundText: outbound.cleanText || replyText,
            inferredIntent,
            inferredFunnelStage,
            inferredObjection
        });
    } catch (error) {
        console.error('[BOT-FATAL-ERROR] ❌ Erro geral:', error);
    }
};
