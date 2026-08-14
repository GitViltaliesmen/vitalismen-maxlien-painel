import crypto from 'crypto';
import ContactState from '../models/ContactState.js';
import Message from '../models/Message.js';
import Order from '../models/Order.js';
import {
    findKnownServientregaEcuadorLocation,
    findServientregaEcuadorAgencies,
    resolveServientregaEcuadorAgency
} from './servientregaEcuadorAgencyService.js';

const PRICE_PROMO_TEXT = 'Le confirmo, señor: 1 frasco por 39 USD, 3 frascos por 95.99 USD y 6 frascos por 167.99 USD. ¿Cuál desea reservar?';
const PROSTATE_COMMERCIAL_TEXT = 'Sí, señor, le explico. Vit Power es un apoyo natural para el bienestar masculino y le envío el audio con la orientación completa. ¿Desea que le pase también la promoción de 1, 3 o 6 frascos?';
const AGENCY_REFINEMENT_TEXT = '¿Conoce el nombre, dirección o sector de la agencia? Puede decir Centro, Norte, Sur, Este u Oeste. Si no sabe, le envío las opciones disponibles.';
const CITY_PROVINCE_TEXT = 'Perfecto, señor. Para no cometer error con Servientrega, me confirma ciudad y provincia donde desea retirar?';

const actionables = new Map();

const digitsOnly = (value = '') => String(value || '').replace(/\D/g, '');
const normalize = (value = '') => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const compact = (value = '') => String(value || '').replace(/\s+/g, ' ').trim();

const phoneCandidates = ({ chatId = '', phone = '' } = {}) => {
    const values = [chatId, phone].map(digitsOnly).filter(Boolean);
    const out = new Set();
    for (const value of values) {
        out.add(value);
        if (value.length >= 9) out.add(value.slice(-9));
        if (value.length >= 10) out.add(value.slice(-10));
        if (value.length >= 11) out.add(value.slice(-11));
    }
    return [...out].filter((item) => item.length >= 7);
};

const messageQuery = ({ chatId = '', phone = '' } = {}) => {
    const or = [];
    if (chatId) or.push({ chatId });
    for (const digits of phoneCandidates({ chatId, phone })) {
        const rx = new RegExp(digits);
        or.push({ peerPhone: digits });
        or.push({ chatId: rx });
        or.push({ from: rx });
        or.push({ to: rx });
    }
    return or.length ? { $or: or } : {};
};

const contactQuery = ({ chatId = '', phone = '' } = {}) => {
    const or = [];
    if (chatId) or.push({ chatId });
    for (const digits of phoneCandidates({ chatId, phone })) {
        const rx = new RegExp(digits);
        or.push({ phoneDigits: digits });
        or.push({ chatId: rx });
        or.push({ 'metadata.customerPhoneDigits': digits });
        or.push({ 'metadata.lastSenderPn': rx });
    }
    return or.length ? { $or: or } : {};
};

const latestCustomerMessage = (history = []) => [...history]
    .reverse()
    .find((message) => !message.isFromMe && !message.isBot && compact(message.body));

const latestBotMessage = (history = []) => [...history]
    .reverse()
    .find((message) => message.isFromMe || message.isBot);

const isGenericPriceQuestion = (text = '') => {
    const body = normalize(text);
    if (!/\b(precio|valor|cuanto|cuesta|costo|promocion|promo|q valor)\b/.test(body)) return false;
    return !/\b(1|uno|un|una|3|tres|6|seis)\s*(frasco|frascos|botella|botellas)?\b/.test(body);
};

const isProstateQuestion = (text = '') => /\b(prostata|prostatitis|prostati|urinari|urinario|urinaria|orina|orinar)\b/i.test(normalize(text));
const isPublicVslLeadForm = (text = '') => {
    const body = normalize(text);
    return /acabo de ver el video|vi el video|ver el video/.test(body)
        && /nombre completo/.test(body)
        && /telefono|phone|whatsapp|celular/.test(body);
};
const isLogisticsText = (text = '') => /\b(servientrega|agencia|oficina|retirar|retiro|ricaurte|sector|ciudad|provincia|direccion|panamericana|centro|norte|sur|este|oeste)\b/i.test(normalize(text));
const isFrustrated = (text = '') => /\b(molesto|molesta|enojado|enojada|cansado|cansada|no responde|nadie|demora|tarde|mal|problema|reclamo|ya dije|otra vez)\b/i.test(normalize(text));
const clientDoesNotKnowAgency = (text = '') => /\b(no se|no sé|no sabe|no conozco|no tengo|cualquiera|mas cercana|más cercana)\b/i.test(normalize(text));
const wantsMoreAgencyOptions = (text = '') => /\b(otras|otros|mas|más|siguiente|siguientes|ver mas|ver más)\b/i.test(normalize(text));

const hasSpecificAgencyCue = (text = '', { city = '', province = '', sector = '' } = {}) => {
    const body = normalize(text);
    const cleanedLocation = normalize([city, province, sector].filter(Boolean).join(' '));
    const remainder = cleanedLocation
        ? body.replace(new RegExp(`\\b(${cleanedLocation.split(/\s+/).filter(Boolean).join('|')})\\b`, 'gi'), ' ')
        : body;
    return /\b(ricaurte|capitan|captain|edificio|juan|lorenzo|victor|rendon|panamericana|calle|av|avenida|direccion|dirección|terminal|mall)\b/i.test(remainder);
};

const detectSector = (text = '') => {
    const body = normalize(text);
    const sectors = ['centro', 'norte', 'sur', 'este', 'oeste', 'terminal', 'mall'];
    return sectors.find((sector) => new RegExp(`\\b${sector}\\b`).test(body)) || '';
};

const customerProfileFromState = (state = {}) => {
    const memory = state?.metadata?.perAgentMemory?.vit_power_ec?.conversationState || {};
    const draft = state?.metadata?.customerDraft || {};
    return {
        phone: state?.phoneDigits || draft.phone || memory.phone || '',
        name: draft.name || memory.name || '',
        province: draft.province || memory.province || '',
        city: draft.city || memory.city || '',
        address: draft.address || memory.address || '',
        reference: draft.reference || memory.reference || '',
        agency: draft.agency || memory.agency || '',
        quantity: draft.quantity || memory.quantity || '',
        total: draft.total || memory.total || '',
        stage: state?.metadata?.lastKnownFunnelStage || memory.stage || '',
        lastQuestion: state?.metadata?.perAgentMemory?.vit_power_ec?.lastQuestionSent || memory.last_question_sent || '',
        agencyOptionsPage: Number(state?.metadata?.perAgentMemory?.vit_power_ec?.agencyOptionsPage || memory.agencyOptionsPage || 0) || 0
    };
};

const agencyConfirmationText = (agency) => (
    `Señor, puedo enviar su pedido para retirar en Agencia Servientrega ${agency.name} - ${agency.address} (${agency.city}, ${agency.province}). ¿Está correcto?`
);

const listAgencyOptionsText = (options = [], { page = 0, hasMore = false } = {}) => {
    const start = (Math.max(0, Number(page) || 0) * 4) + 1;
    const lines = ['Le envío las opciones disponibles:'];
    options.slice(0, 4).forEach((agency, index) => {
        lines.push('');
        lines.push(`${start + index}) ${agency.name}`);
        lines.push(agency.address || '');
        lines.push(`${agency.city}, ${agency.province}${agency.sector ? ` - Sector ${agency.sector}` : ''}`);
    });
    if (hasMore) lines.push('', 'Si ninguna le sirve, me dice "otras" y le envío más opciones.');
    return lines.filter((line) => line !== null && line !== undefined).join('\n');
};

const confidenceFromRisks = (risks = [], base = 0.92) => Math.max(0.35, Math.min(0.98, base - (risks.length * 0.08)));

const buildActionable = ({
    category,
    reason,
    text,
    directAnswer,
    nextStep,
    recommendedAudio = '',
    riskFlags = [],
    doNotAskAgain = [],
    missingData = [],
    sourceMessage = null,
    confidence = null,
    priority = 'normal',
    context = {}
}) => {
    const hash = crypto.createHash('sha1')
        .update([category, sourceMessage?._id || '', text].join('|'))
        .digest('hex')
        .slice(0, 12);
    const now = new Date().toISOString();
    const item = {
        _id: `attentive_${hash}`,
        type: 'strategy',
        category,
        priority,
        status: 'open',
        title: 'Leitor Atento',
        subtitle: reason,
        body: `${reason}. Próximo passo: ${nextStep}`,
        suggestedScript: text,
        directAnswer,
        nextStep,
        recommendedAudio,
        riskFlags,
        confidence: confidence ?? confidenceFromRisks(riskFlags),
        doNotAskAgain,
        missingData,
        sourceMessageId: sourceMessage?._id || '',
        relatedMessageIds: sourceMessage?._id ? [sourceMessage._id] : [],
        createdAt: now,
        updatedAt: now,
        context: {
            customerQuestion: sourceMessage?.body || '',
            audioCandidates: recommendedAudio ? [recommendedAudio] : [],
            mediaCandidates: [],
            ...context
        }
    };
    actionables.set(item._id, item);
    return item;
};

export const analyzeAttentiveReader = ({
    inboundText = '',
    history = [],
    contactState = null,
    latestOrder = null
} = {}) => {
    const sourceMessage = latestCustomerMessage(history) || { body: inboundText, _id: `inline_${Date.now()}` };
    const text = compact(inboundText || sourceMessage.body || '');
    const profile = customerProfileFromState(contactState || {});
    const lastBot = latestBotMessage(history);
    const riskFlags = [];
    const doNotAskAgain = [];
    const missingData = [];
    const currentStage = profile.stage || latestOrder?.conversationMemory?.funnelStage || '';
    const knownLocation = findKnownServientregaEcuadorLocation({
        text,
        city: profile.city,
        province: profile.province
    });

    if (!text) {
        return buildActionable({
            category: 'low_context',
            reason: 'sem mensagem recente do cliente',
            text: 'Sigo con usted, señor. ¿Su duda es sobre precio, producto o entrega?',
            directAnswer: 'Sigo con usted.',
            nextStep: 'pedir direção da dúvida',
            riskFlags: ['low_confidence'],
            missingData: ['customer_question'],
            sourceMessage,
            confidence: 0.45
        });
    }

    if (isProstateQuestion(text)) {
        return buildActionable({
            category: 'prostate_question',
            reason: 'cliente perguntou sobre próstata/prostatitis',
            text: PROSTATE_COMMERCIAL_TEXT,
            directAnswer: 'Vit Power es un apoyo natural para el bienestar masculino.',
            nextStep: 'enviar áudio aprovado e conduzir para promoção',
            recommendedAudio: 'Ajuda_Prostata',
            riskFlags: ['health_commercial_care'],
            sourceMessage,
            confidence: 0.93
        });
    }

    if (isFrustrated(text)) {
        return buildActionable({
            category: 'frustration_care',
            reason: 'cliente mostrou incômodo ou frustração',
            text: 'Le entiendo, señor, y disculpe la molestia. Sigo con usted para resolverlo paso a paso. ¿Me confirma si su duda es sobre entrega, agencia o precio?',
            directAnswer: 'Le entiendo y disculpe la molestia.',
            nextStep: 'acolher e pedir apenas a área do problema',
            riskFlags: ['human_care_needed'],
            sourceMessage,
            confidence: 0.84
        });
    }

    if (isGenericPriceQuestion(text)) {
        if (/\b1\s*frasco|un frasco|una botella|1 botella\b/i.test(normalize(lastBot?.body || ''))) {
            riskFlags.push('avoid_repeating_one_bottle_offer');
        }
        return buildActionable({
            category: 'generic_price',
            reason: 'cliente perguntou preço sem escolher quantidade',
            text: PRICE_PROMO_TEXT,
            directAnswer: '1 frasco por 39 USD, 3 frascos por 95.99 USD y 6 frascos por 167.99 USD.',
            nextStep: 'perguntar qual opção deseja reservar',
            recommendedAudio: 'TRATAMENTO_Y_PRECIOS_PROMOCAO',
            riskFlags,
            doNotAskAgain: ['quantidade como 1 frasco sem pedido explícito'],
            sourceMessage,
            confidence: 0.96
        });
    }

    if (isPublicVslLeadForm(text)) {
        return buildActionable({
            category: 'vsl_entry_lead',
            reason: 'cliente entrou pela VSL e enviou nome/telefone; não tratar nome como cidade/agência',
            text: `Perfecto, señor. Ya tengo su nombre y teléfono. Le confirmo la promoción: ${PRICE_PROMO_TEXT.replace(/^Le confirmo, señor:\s*/i, '')}`,
            directAnswer: 'Ya tengo su nombre y teléfono.',
            nextStep: 'apresentar promoção e perguntar quantidade',
            recommendedAudio: 'TRATAMENTO_Y_PRECIOS_PROMOCAO',
            riskFlags: ['do_not_treat_nombre_completo_as_city'],
            doNotAskAgain: ['agência antes de quantidade', 'setor por causa do nome do cliente'],
            sourceMessage,
            confidence: 0.97
        });
    }

    if (isLogisticsText(text) || knownLocation.city || knownLocation.province || /sdr_scheduled_followup|scheduled|fecha/i.test(currentStage)) {
        const location = knownLocation;
        const city = location.city || profile.city || '';
        const province = location.province || profile.province || '';
        const sector = detectSector(text);
        const hasSpecificCue = hasSpecificAgencyCue(text, { city, province, sector });
        const queryForCity = [city, province].filter(Boolean).join(' ');
        const scopedOptions = city && province
            ? findServientregaEcuadorAgencies({
                city,
                province,
                query: queryForCity,
                limit: 12
            })
            : [];
        const resolved = resolveServientregaEcuadorAgency({
            city,
            province,
            text,
            address: profile.address,
            agencyName: profile.agency,
            limit: 8
        });

        if (/^ricaurte$/i.test(normalize(text))) {
            return buildActionable({
                category: 'ambiguous_agency_address',
                reason: 'Ricaurte sozinho é ambíguo e não deve virar Rocafuerte',
                text: CITY_PROVINCE_TEXT,
                directAnswer: 'Ricaurte aparece em endereços diferentes.',
                nextStep: 'pedir cidade e província antes de escolher agência',
                riskFlags: ['ambiguous_location', 'do_not_guess_agency'],
                missingData: ['city', 'province'],
                sourceMessage,
                confidence: 0.94
            });
        }

        if (!city || !province) {
            return buildActionable({
                category: 'logistics_missing_city_province',
                reason: 'cliente falou logística/agência, mas falta cidade/província segura',
                text: CITY_PROVINCE_TEXT,
                directAnswer: 'Para Servientrega preciso ciudad y provincia.',
                nextStep: 'pedir cidade e província',
                riskFlags: ['logistics_before_date'],
                missingData: [!city ? 'city' : '', !province ? 'province' : ''].filter(Boolean),
                sourceMessage,
                confidence: 0.86
            });
        }

        const query = sector || (clientDoesNotKnowAgency(text) || wantsMoreAgencyOptions(text) ? '' : text);
        const options = findServientregaEcuadorAgencies({
            city,
            province,
            query: query || [city, province].join(' '),
            limit: 12
        });
        const filteredOptions = sector
            ? options.filter((agency) => normalize(agency.sector).includes(normalize(sector)))
            : options;
        const finalOptions = filteredOptions.length ? filteredOptions : options;
        const requestedMoreOptions = wantsMoreAgencyOptions(text);
        const optionPage = requestedMoreOptions ? Math.max(1, profile.agencyOptionsPage + 1) : 0;
        const optionOffset = optionPage * 4;
        const visibleOptions = finalOptions.slice(optionOffset, optionOffset + 4);
        const hasMoreOptions = finalOptions.length > optionOffset + 4;

        if (sector && finalOptions.length > 1) {
            return buildActionable({
                category: 'agency_options',
                reason: `cliente informou setor ${sector}`,
                text: listAgencyOptionsText(visibleOptions.length ? visibleOptions : finalOptions.slice(0, 4), { page: visibleOptions.length ? optionPage : 0, hasMore: visibleOptions.length ? hasMoreOptions : finalOptions.length > 4 }),
                directAnswer: `Estas son opciones del sector ${sector}.`,
                nextStep: 'listar até 4 agências numeradas',
                recommendedAudio: 'ENVIO_AGENCIA_100_SEGURO',
                riskFlags: finalOptions.length > 4 ? ['has_more_agencies'] : [],
                sourceMessage,
                confidence: 0.89,
                context: {
                    agencyOptionsPage: visibleOptions.length ? optionPage : 0,
                    agencyOptionsCount: finalOptions.length
                }
            });
        }

        if (scopedOptions.length > 4 && !sector && !hasSpecificCue && !clientDoesNotKnowAgency(text) && !wantsMoreAgencyOptions(text)) {
            return buildActionable({
                category: 'agency_refinement_needed',
                reason: 'cidade/província têm muitas agências',
                text: AGENCY_REFINEMENT_TEXT,
                directAnswer: `En ${city}, ${province} hay varias agencias.`,
                nextStep: 'perguntar setor/nome/localização antes de listar',
                riskFlags: ['too_many_agencies', 'do_not_dump_options'],
                missingData: ['agency_sector_or_name'],
                sourceMessage,
                confidence: 0.9
            });
        }

        if (!requestedMoreOptions && resolved.confident && resolved.best) {
            return buildActionable({
                category: 'agency_confirm',
                reason: 'cidade/província/agência ficaram claras',
                text: agencyConfirmationText(resolved.best),
                directAnswer: `Posso enviar para ${resolved.best.name}.`,
                nextStep: 'confirmar se agência está correta',
                recommendedAudio: 'ENVIO_AGENCIA_100_SEGURO',
                riskFlags: ['logistics_before_date'],
                doNotAskAgain: ['fecha exacta antes de resolver Servientrega'],
                sourceMessage,
                confidence: 0.93
            });
        }

        if (finalOptions.length > 4 && !sector && !clientDoesNotKnowAgency(text) && !requestedMoreOptions) {
            return buildActionable({
                category: 'agency_refinement_needed',
                reason: 'cidade/província têm muitas agências',
                text: AGENCY_REFINEMENT_TEXT,
                directAnswer: `En ${city}, ${province} hay varias agencias.`,
                nextStep: 'perguntar setor/nome/localização antes de listar',
                riskFlags: ['too_many_agencies', 'do_not_dump_options'],
                missingData: ['agency_sector_or_name'],
                sourceMessage,
                confidence: 0.9
            });
        }

        if (finalOptions.length === 1) {
            return buildActionable({
                category: 'agency_confirm',
                reason: 'há uma agência segura para cidade/província',
                text: agencyConfirmationText(finalOptions[0]),
                directAnswer: `Posso enviar para ${finalOptions[0].name}.`,
                nextStep: 'confirmar agência',
                recommendedAudio: 'ENVIO_AGENCIA_100_SEGURO',
                sourceMessage,
                confidence: 0.91
            });
        }

        if (finalOptions.length > 1) {
            return buildActionable({
                category: 'agency_options',
                reason: sector ? `cliente informou setor ${sector}` : 'cliente pediu opções de agência',
                text: listAgencyOptionsText(visibleOptions.length ? visibleOptions : finalOptions.slice(0, 4), { page: visibleOptions.length ? optionPage : 0, hasMore: visibleOptions.length ? hasMoreOptions : finalOptions.length > 4 }),
                directAnswer: sector ? `Estas son opciones del sector ${sector}.` : 'Estas son las opciones disponibles.',
                nextStep: 'listar até 4 agências numeradas',
                recommendedAudio: 'ENVIO_AGENCIA_100_SEGURO',
                riskFlags: finalOptions.length > 4 ? ['has_more_agencies'] : [],
                sourceMessage,
                confidence: 0.88,
                context: {
                    agencyOptionsPage: visibleOptions.length ? optionPage : 0,
                    agencyOptionsCount: finalOptions.length
                }
            });
        }

        return buildActionable({
            category: 'logistics_missing_city_province',
            reason: 'não encontrei agência segura para os dados informados',
            text: CITY_PROVINCE_TEXT,
            directAnswer: 'Preciso confirmar ciudad y provincia para Servientrega.',
            nextStep: 'pedir cidade e província',
            riskFlags: ['agency_not_found'],
            missingData: ['city', 'province'],
            sourceMessage,
            confidence: 0.72
        });
    }

    if (profile.city) doNotAskAgain.push('city');
    if (profile.province) doNotAskAgain.push('province');
    if (profile.quantity) doNotAskAgain.push('quantity');

    return buildActionable({
        category: 'attentive_general',
        reason: 'cliente fez mensagem geral; responder primeiro e avançar um micro-passo',
        text: 'Le entiendo, señor. Para ayudarle sin error, me confirma si su duda es sobre precio, producto, entrega o su pedido?',
        directAnswer: 'Le entiendo.',
        nextStep: 'classificar dúvida sem reiniciar funil',
        riskFlags: doNotAskAgain.length ? ['check_saved_data_before_asking'] : [],
        doNotAskAgain,
        sourceMessage,
        confidence: doNotAskAgain.length ? 0.78 : 0.7
    });
};

export const loadObserverActionables = async ({ chatId = '', phone = '', limit = 12 } = {}) => {
    const [history, contactState, latestOrder] = await Promise.all([
        Message.find(messageQuery({ chatId, phone }))
            .sort({ createdAt: -1, timestamp: -1 })
            .limit(30)
            .lean(),
        ContactState.findOne(contactQuery({ chatId, phone }))
            .sort({ updatedAt: -1 })
            .lean(),
        Order.findOne({ 'customer.phone': { $regex: digitsOnly(phone || chatId).slice(-9) || digitsOnly(phone || chatId) } })
            .sort({ updatedAt: -1, createdAt: -1 })
            .lean()
            .catch(() => null)
    ]);
    const chronological = [...history].reverse();
    const item = analyzeAttentiveReader({
        history: chronological,
        contactState,
        latestOrder
    });
    return {
        actionables: [item].slice(0, Math.max(1, Number(limit) || 12)),
        summary: {
            generatedAt: new Date().toISOString(),
            mode: 'panel_only',
            automationChanged: false
        }
    };
};

export const getObserverActionable = (id) => actionables.get(String(id || '')) || null;

export const markObserverActionable = ({ id, status, feedback = null } = {}) => {
    const item = getObserverActionable(id);
    if (!item) return null;
    const next = {
        ...item,
        status,
        feedback,
        updatedAt: new Date().toISOString()
    };
    actionables.set(next._id, next);
    return next;
};

export const buildConversationFunnelBlueprint = async ({ chatId = '', phone = '' } = {}) => {
    const history = await Message.find(messageQuery({ chatId, phone }))
        .sort({ createdAt: 1, timestamp: 1 })
        .limit(80)
        .lean();
    const customerMessages = history.filter((message) => !message.isFromMe && !message.isBot);
    const humanMessages = history.filter((message) => message.isFromMe || message.isBot);
    return {
        summary: {
            totalMessages: history.length,
            customerMessages: customerMessages.length,
            humanMessages: humanMessages.length,
            customerProfile: customerMessages.length ? 'conversa ativa' : 'sem historico',
            leaks: []
        },
        steps: [
            { order: 1, label: 'Ler última mensagem', strategy: 'responder pergunta direta primeiro', perfectScript: 'Responder a dúvida do cliente na primeira frase.' },
            { order: 2, label: 'Validar memória', strategy: 'não pedir dado já salvo', perfectScript: 'Conferir cidade, província, quantidade e agência antes de perguntar.' },
            { order: 3, label: 'Micro-passo', strategy: 'uma pergunta por vez', perfectScript: 'Conduzir para o próximo dado faltante sem atropelar.' }
        ]
    };
};

export const scoreObserverAttendance = async ({ chatId = '', phone = '' } = {}) => {
    const { actionables: [item] } = await loadObserverActionables({ chatId, phone, limit: 1 });
    const missing = [];
    if ((item.riskFlags || []).includes('low_confidence')) {
        missing.push({ label: 'Confiança baixa', fix: 'Operador deve revisar antes de responder.' });
    }
    if ((item.riskFlags || []).includes('too_many_agencies')) {
        missing.push({ label: 'Muitas agências', fix: 'Perguntar setor antes de listar.' });
    }
    const score10 = missing.length ? 8 : 10;
    return {
        score10,
        percent: score10 * 10,
        label: score10 >= 10 ? 'Atendimento atento' : 'Revisar antes de enviar',
        missing,
        summary: {
            humanMessages: 0,
            audioCount: item.recommendedAudio ? 1 : 0
        }
    };
};

export const scoreObserverAudio = ({ mediaUrl = '', label = '' } = {}) => ({
    mediaUrl,
    label,
    grade: 'A',
    scores: { total: 92 },
    verdict: 'Audio aprovado como apoio quando a intenção detectada combinar com a etapa.',
    stage: 'observador',
    strengths: ['audio gravado', 'apoio ao atendimento humano'],
    improvements: ['usar apenas quando não repetir resposta anterior']
});
