import ContactState from '../models/ContactState.js';
import { warmupAgent } from './agents/warmupAgent.js';
import { vitalismenAgent } from './agents/vitalismenAgent.js';
import { vitPowerAgent } from './agents/vitPowerAgent.js';
import { superfullAgent } from './agents/superfullAgent.js';
import { fallbackAgent } from './agents/fallbackAgent.js';

const WARMUP_BAIT = 'hola, estoy un poco aburrida. ¿podemos conversar un ratito?';

const normalizeText = (text) => String(text || '').trim().toLowerCase();

const hasAnyMatch = (text, patterns) => patterns.some((pattern) => pattern.test(text));

const inferCountryCode = (chatId) => {
    const digits = String(chatId || '').replace(/\D/g, '');
    if (digits.startsWith('593')) return 'EC';
    if (digits.startsWith('57')) return 'CO';
    return 'INTL';
};

const detectSignals = (body) => {
    const normalizedBody = normalizeText(body);
    return {
        normalizedBody,
        wantsConsultation: hasAnyMatch(normalizedBody, [/\bconsulta\b/i, /\bdoctora\b/i, /\bdoctor\b/i, /\bprotocolo\b/i, /\bagendar\b/i]),
        showsPurchaseIntent: hasAnyMatch(normalizedBody, [/\bquiero\b/i, /\bcomprar\b/i, /\bllevar\b/i, /\bme interesa\b/i, /\bdeseo\b/i]),
        asksPrice: hasAnyMatch(normalizedBody, [/\bprecio\b/i, /\bvalor\b/i, /\bpromo\b/i, /\bpromoc/i, /\bcu[aá]nto\b/i, /\bcuanto\b/i]),
        asksProductQuestion: hasAnyMatch(normalizedBody, [/\bfunciona\b/i, /\bdiabet/i, /\bpresi/i, /\bhiperten/i, /\bcirug/i]),
        requestsQuantity: hasAnyMatch(normalizedBody, [/\b1 frasco\b/i, /\b2 frascos\b/i, /\b3 frascos\b/i, /\b6 frascos\b/i, /\bun frasco\b/i, /\bdos frascos\b/i, /\btres frascos\b/i, /\bseis frascos\b/i]),
        mentionsProducts: hasAnyMatch(normalizedBody, [/\bvit power\b/i, /\bsuperfull\b/i, /\btratamiento\b/i, /\bclinica\b/i]),
        explicitWarmupExit: hasAnyMatch(normalizedBody, [/\bpasame\b/i, /\btransfiere\b/i, /\btransferir\b/i, /\bquiero consulta\b/i, /\bquiero precio\b/i, /\bquiero saber el precio\b/i])
    };
};

const ensureTag = (state, tag) => {
    if (!tag) return;
    if (!state.tags.includes(tag)) {
        state.tags.push(tag);
    }
};

const chooseAssignedAgent = ({ state, body, countryCode, isFirstInbound = false }) => {
    const signals = detectSignals(body);
    const currentAgent = state.assignedAgent || 'fallback';

    if (signals.normalizedBody === WARMUP_BAIT) {
        return { assignedAgent: 'warmup', reason: 'warmup_bait_first_touch' };
    }

    if (signals.wantsConsultation) {
        return { assignedAgent: 'vitalismen', reason: 'consultation_intent' };
    }

    if (currentAgent === 'warmup') {
        if (
            signals.wantsConsultation
            || signals.explicitWarmupExit
            || signals.requestsQuantity
            || signals.mentionsProducts
            || (signals.asksPrice && signals.showsPurchaseIntent)
        ) {
            if (countryCode === 'EC') return { assignedAgent: 'vit_power_ec', reason: 'warmup_upgrade_country_offer' };
            if (countryCode === 'CO') return { assignedAgent: 'superfull_co', reason: 'warmup_upgrade_country_offer' };
            return { assignedAgent: 'vitalismen', reason: 'warmup_upgrade_consultation' };
        }
        return { assignedAgent: 'warmup', reason: 'warmup_sticky' };
    }

    if (state.tags.includes('VITALISMEN')) {
        return { assignedAgent: 'vitalismen', reason: 'vitalismen_tag_sticky' };
    }

    if (state.tags.includes('WARMUP')) {
        return { assignedAgent: 'warmup', reason: 'warmup_tag_sticky' };
    }

    if (currentAgent === 'vitalismen') {
        return { assignedAgent: 'vitalismen', reason: 'vitalismen_sticky' };
    }

    if (countryCode === 'EC') return { assignedAgent: 'vit_power_ec', reason: 'country_ec' };
    if (countryCode === 'CO') return { assignedAgent: 'superfull_co', reason: 'country_co' };
    return { assignedAgent: 'fallback', reason: 'generic_fallback' };
};

const appendAgentHistory = ({ state, assignedAgent, reason }) => {
    const lastEntry = state.agentHistory[state.agentHistory.length - 1];
    if (lastEntry?.agent === assignedAgent) return;
    state.agentHistory.push({
        agent: assignedAgent,
        reason,
        at: new Date()
    });
    state.agentHistory = state.agentHistory.slice(-12);
};

const updateTagsAndMetadata = ({ state, assignedAgent, countryCode, body, reason, signals }) => {
    if (assignedAgent === 'warmup') ensureTag(state, 'WARMUP');
    if (assignedAgent === 'vitalismen') ensureTag(state, 'VITALISMEN');
    if (assignedAgent !== 'warmup' && (signals.showsPurchaseIntent || signals.asksPrice || signals.requestsQuantity)) {
        ensureTag(state, 'COMMERCIAL_READY');
    }

    state.countryCode = countryCode;
    state.assignedAgent = assignedAgent;
    appendAgentHistory({ state, assignedAgent, reason });
    state.metadata = {
        ...(state.metadata || {}),
        lastRouterDecisionAt: new Date(),
        lastRouterDecisionText: body,
        lastRouterDecisionAgent: assignedAgent,
        lastRouterDecisionReason: reason,
        lastDetectedSignals: {
            wantsConsultation: signals.wantsConsultation,
            showsPurchaseIntent: signals.showsPurchaseIntent,
            asksPrice: signals.asksPrice,
            asksProductQuestion: signals.asksProductQuestion,
            requestsQuantity: signals.requestsQuantity,
            mentionsProducts: signals.mentionsProducts,
            explicitWarmupExit: signals.explicitWarmupExit
        },
        perAgentMemory: {
            ...((state.metadata || {}).perAgentMemory || {}),
            [assignedAgent]: {
                lastInboundAt: new Date(),
                lastInboundText: body,
                lastReason: reason
            }
        }
    };
};

const dispatchToAgent = async ({ assignedAgent, payload }) => {
    console.log(`[ROUTER] agente selecionado -> ${assignedAgent} | chat=${payload.from}`);
    const agentMap = {
        warmup: warmupAgent,
        vitalismen: vitalismenAgent,
        vit_power_ec: vitPowerAgent,
        superfull_co: superfullAgent,
        fallback: fallbackAgent
    };
    const targetAgent = agentMap[assignedAgent] || fallbackAgent;
    await targetAgent.handleIncomingMessage({
        ...payload,
        agent: assignedAgent
    });
};

export const routeIncomingMessage = async (payload) => {
    const chatId = payload.from;
    const body = String(payload.body || '');
    const countryCode = inferCountryCode(chatId);

    let state = await ContactState.findOne({ chatId });
    if (!state) {
        state = new ContactState({
            chatId,
            phoneDigits: String(chatId || '').replace(/\D/g, ''),
            countryCode
        });
    }

    const isFirstInbound = !state.firstInboundText;

    if (isFirstInbound) {
        state.firstInboundText = body;
        state.firstInboundAt = new Date();
    }

    state.lastInboundText = body;
    state.lastInboundAt = new Date();

    const decision = chooseAssignedAgent({ state, body, countryCode, isFirstInbound });
    updateTagsAndMetadata({
        state,
        assignedAgent: decision.assignedAgent,
        countryCode,
        body,
        reason: decision.reason,
        signals: detectSignals(body)
    });
    await state.save();

    await dispatchToAgent({
        assignedAgent: decision.assignedAgent,
        payload: {
            ...payload,
            contactStateId: state._id.toString(),
            agentDecisionReason: decision.reason
        }
    });
};
