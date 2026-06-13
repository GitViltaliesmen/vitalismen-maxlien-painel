import crypto from 'crypto';
import ContactState from '../models/ContactState.js';
import Message from '../models/Message.js';
import { resolveCountryAudio } from './audioTemplateService.js';
import { getSalesMedia } from './salesMediaCatalog.js';
import { getNextAudioByPurpose, markAudioPurposeSent } from './funnelPurposeMemoryService.js';
import { isInitialProductInquiry } from './initialFunnelTriggers.js';
import { sendAudio } from '../whatsapp/sendAudio.js';
import { sendImage } from '../whatsapp/sendImage.js';
import { sendVideo } from '../whatsapp/sendVideo.js';
import { sendText } from '../whatsapp/sendText.js';

const COMPLEMENT_COOLDOWN_MS = 30 * 60 * 1000;
const DELIVERY_TIME_TEXT = 'Señor, enviaremos su guia en breve. Normalmente el pedido demora de 2 a 5 dias habiles para llegar, dependiendo de la ciudad y de la ruta de Servientrega, pero puede llegar antes. Apenas tengamos la guia, se la enviamos por aqui.';
const PRODUCT_ORIGIN_TEXT = 'Claro, señor. Le explico cortito: Vit Power es un producto de apoyo natural para hombres y nuestra atencion en Ecuador es del equipo de la doctora Maria Fernandes. Le envio el audio de orientacion y seguimos por aqui.';
const PRODUCT_GUARANTEE_TEXT = 'Si, señor. El producto es garantizado y tiene 60 dias de garantia. El pago es contra entrega cuando aplica, y le acompaño por aqui hasta que reciba su pedido.';
const DOCTOR_IDENTITY_TEXT = 'La doctora es la doctora Maria Fernandes. Nosotros atendemos como equipo de orientacion de Vit Power para Ecuador y yo le ayudo por aqui con la informacion, el pedido y el seguimiento.';
const PRODUCT_INGREDIENTS_TEXT = 'Claro, señor. Vit Power tiene borojó, chontaduro, noni, L-arginina, maca, guaraná y vitaminas.\n\nEs una formula natural de apoyo para hombres. Si usted tiene presion alta, diabetes, problema del corazon o usa medicamentos, confirme primero con su medico antes de usar cualquier suplemento.\n\n¿Le paso las opciones?';

const normalize = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const isQuantitySelection = (value = '') => {
    const body = normalize(value)
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\btre\b(?=\s*(botella|botellas|frasco|frascos|mes|meses|tratamiento|tratamientos|producto|productos)\b)/g, 'tres')
        .replace(/\s+/g, ' ')
        .trim();
    if (!body) return false;
    const hasQuantity = /\b(1|2|3|6|uno|un|una|dos|tres|seis)\b/.test(body);
    if (!hasQuantity) return false;
    const hasProductUnit = /\b(frasco|frascos|botella|botellas|tratamiento|tratamientos|producto|productos)\b/.test(body);
    const hasOrderVerb = /\b(quiero|deseo|deme|mandeme|envieme|envie|envia|enviar|llevar|separar|reservar|por favor)\b/.test(body);
    return hasProductUnit || hasOrderVerb || body.split(/\s+/).length <= 3;
};

const hashKey = (value) => crypto.createHash('sha1').update(String(value || '')).digest('hex');

const RULES = [
    {
        key: 'product_guarantee_60_days',
        purpose: 'garantia',
        patterns: [
            /garant[ií]a|garantizado|garantizada|tiene garantia|tiene garant[ií]a|hay garantia|hay garant[ií]a/i,
            /si no funciona.*(devuelven|devolucion|garantia)|devolucion|devoluci[oó]n/i
        ],
        text: PRODUCT_GUARANTEE_TEXT
    },
    {
        key: 'doctor_maria_fernandes_identity',
        purpose: 'autoridad',
        patterns: [
            /quien\s+es\s+(la\s+)?doctora|qui[eé]n\s+es\s+(la\s+)?doctora/i,
            /doctora\s+maria|doctora\s+fernandes|maria\s+fernandes|dra\.?\s+maria|dra\.?\s+fernandes/i,
            /doutora\s+maria|doutora\s+fernandes/i
        ],
        text: DOCTOR_IDENTITY_TEXT
    },
    {
        key: 'product_origin_info',
        purpose: 'duvidas_produto',
        patterns: [
            /no\s+se\s+(de\s+)?q(ue)?\s+se\s+trata/i,
            /no\s+se\s+(de\s+)?que\s+se\s+trata/i,
            /de\s+qu[eé]\s+se\s+trata/i,
            /q(ue)?\s+producto\s+es|qu[eé]\s+producto\s+es/i,
            /que\s+es\s+vit\s*power|qu[eé]\s+es\s+vit\s*power/i,
            /origen\s+del\s+producto|de\s+d[oó]nde\s+es\s+el\s+producto|de\s+donde\s+sale\s+el\s+producto/i,
            /de\s+d[oó]nde\s+viene|de\s+donde\s+viene|de\s+donde\s+viene\s+el\s+producto/i,
            /d[oó]nde\s+lo\s+hacen|donde\s+lo\s+hacen|qui[eé]n\s+lo\s+fabrica|quien\s+lo\s+fabrica|laboratorio/i
        ],
        text: PRODUCT_ORIGIN_TEXT,
        audioPrimary: true,
        audios: ['DUVIDAS']
    },
    {
        key: 'qualification_needs',
        purpose: 'qualificacao',
        patterns: [
            /quiero saber del producto|informacion del producto|informacion|info/i,
            /tengo duda|tengo una duda|dudas|pregunta/i,
            /me explica|expl[ií]queme|quiero entender/i
        ],
        text: '',
        audios: ['CONHECER_NECESSIDADES_CLIENTES', 'DUVIDAS']
    },
    {
        key: 'call_insistence',
        patterns: [
            /te llamo|la llamo|puedo llamarla|puedo llamar/i,
            /ll[aá]meme|llamame|me llama|me puede llamar/i,
            /conteste|contesta|atienda|ati[eé]ndame|atiendame/i,
            /quiero hablar por llamada|por llamada|videollamada/i
        ],
        text: '',
        audios: ['QUANDO_CLIENTE_INSISTE_EM_LIGAR', 'QUANDO_CLIENTE_LIGA_01']
    },
    {
        key: 'personal_questions_boundary',
        patterns: [
            /de donde eres|de d[oó]nde eres|donde vives|d[oó]nde vives/i,
            /eres casada|estas casada|est[aá]s casada|tienes esposo|tienes marido/i,
            /cuantos anos tienes|cu[aá]ntos a[nñ]os tienes|que edad tienes|qu[eé] edad tienes/i,
            /mand(a|e).*foto|env(i|í)a.*foto|quiero verte|como eres/i,
            /tu casa|tu direccion|tu direcci[oó]n|donde queda tu casa/i,
            /medellin|medell[ií]n/i
        ],
        text: 'Le cuento algo cortito 😊 Soy Ana, asesora del equipo de la doctora Maria Fernandes. Soy casada y cuido mi privacidad, por eso no entro en muchos detalles personales. Si seguimos por aqui, le ayudo con gusto con Vit Power y su pedido.',
        audios: ['INFORMACOES_PESSOAIS_NAIS', 'INFORMACOES_PESSOAS_NAIS']
    },
    {
        key: 'cannot_pickup_agency',
        patterns: [
            /no puedo (retirar|ir|acercarme|recoger)/i,
            /no tengo tiempo.*(agencia|servientrega)/i,
            /no puedo.*agencia/i,
            /domicilio mejor/i
        ],
        text: 'Le entiendo. Le dejo una explicacion corta para que vea la mejor opcion sin complicarse.',
        audios: ['QUANDO_DIZER_NAO_PODE_RETIRAR_PRODUTO']
    },
    {
        key: 'trust_scam',
        patterns: [
            /estafa|golpe|fraude|engan|mentira/i,
            /seguro|confiable|confianza|real|verdad/i,
            /miedo|temor|desconf/i
        ],
        text: '',
        images: ['prova_social_video_boquet', 'social_03', 'social_04'],
        audios: ['ENVIO_AGENCIA_100_SEGURO']
    },
    {
        key: 'prostate_question',
        patterns: [
            /prostata|prostatic|orina|urinari|levanto.*ban/i
        ],
        text: 'Le explico con cuidado. Si tiene una condicion medica fuerte, siempre es bueno consultar tambien con su profesional de confianza.',
        audios: ['Ajuda_Prostata']
    },
    {
        key: 'delivery_time',
        patterns: [
            /gu[ií]a.*(no|nunca|cu[aá]ndo|cuando|manda|mandado|mandaron|envi[aá]|enviado|envian|env[ií]an)/i,
            /(no|nunca).*(manda|mandado|mandaron|envi[aá]|enviado|envian|env[ií]an).*gu[ií]a/i,
            /numero\s+de\s+gu[ií]a|n[uú]mero\s+de\s+gu[ií]a|codigo\s+de\s+gu[ií]a|c[oó]digo\s+de\s+gu[ií]a/i,
            /rastreo|tracking/i,
            /cu[aá]nto.*(demora|tarda).*(llegar|llega|entrega|env[ií]o|pedido|producto)/i,
            /cuando.*(llega|llegar|entregan|entrega|env[ií]an|envio|pedido|producto)/i,
            /cuando\s+yeg[ao]n?|cuando\s+lleg[ao]n?/i,
            /(yega|yegan|llega|llegan).*(llaman|yaman|avisan|avisar)/i,
            /para\s+cu[aá]ndo|para\s+cuando/i,
            /tiempo.*(llegar|llega|entrega|env[ií]o|pedido)/i,
            /cuantos dias|cu[aá]ntos d[ií]as|en cuantos dias|en cu[aá]ntos d[ií]as/i,
            /quanto.*(demora|tarda).*(chegar|entrega|envio|pedido|produto)/i,
            /quando.*(chega|chegar|entrega|enviam|envia|pedido|produto)/i,
            /tempo.*(chegar|entrega|envio|pedido)/i
        ],
        text: DELIVERY_TIME_TEXT,
        audioPrimary: true,
        requireTextAndAudio: true,
        audios: ['TEMPO_DEMORA_PRODUTO_CHEGAR']
    },
    {
        key: 'result_time',
        patterns: [
            /no\s+me\s+hizo\s+efecto|no\s+hizo\s+efecto|no\s+me\s+ha\s+hecho\s+efecto/i,
            /no\s+me\s+funcion[oó]|no\s+funcion[oó]|no\s+me\s+sirvi[oó]|no\s+sirvi[oó]/i,
            /(ya\s+)?(consum[ií]|tome|tom[eé]|use|us[eé]).*(no\s+me\s+hizo\s+efecto|sin\s+efecto|no\s+funcion[oó])/i,
            /cuando.*(resultado|efecto|funciona)/i,
            /cuanto.*(tarda|demora).*resultado/i,
            /tiempo.*resultado/i,
            /resultado|resultados|efecto/i,
            /es\s+temporal|temporal/i,
            /por\s+cuanto\s+tiempo|por\s+cu[aá]nto\s+tiempo/i,
            /cuanto\s+tiempo\s+(debo|tengo|hay\s+que).*(tomar|usar)|cu[aá]nto\s+tiempo\s+(debo|tengo|hay\s+que).*(tomar|usar)/i
        ],
        text: 'Le explico cortito: el resultado depende de la constancia y de cada organismo. No es una promesa de cura; es un apoyo natural y se usa siguiendo la orientacion del tratamiento.',
        audios: ['TEMPO_RESULTADO_VIT_POWER']
    },
    {
        key: 'how_to_use',
        patterns: [
            /como.*(toma|tomar|usa|usar)/i,
            /c[oó]mo\s*se\s*toma|como\s*setoma|setoma/i,
            /dosis|cuantas veces|modo de uso|se toma/i
        ],
        text: 'Perfecto. La orientacion de uso va en el audio para que lo tome correctamente. Si usted usa medicamentos o tiene condicion medica, tambien confirme con su profesional de confianza.',
        audios: ['COMO_SE_TOMA_VIT_POWER']
    },
    {
        key: 'medical_condition_safety',
        patterns: [
            /diabetes|diabetico|diab[eé]tico|azucar|az[uú]car|glucosa|insulina|metformina/i,
            /presion|presi[oó]n|tension|tensi[oó]n|hipertension|hipertensi[oó]n|hipertenso|hispertenso|presion alta|presi[oó]n alta|presion baja|presi[oó]n baja/i,
            /corazon|coraz[oó]n|cardiaco|card[ií]aco|infarto|derrame|colesterol|trigliceridos|triglic[eé]ridos/i,
            /medicamento|medicacion|medicaci[oó]n|medicina|remedio|pastilla|tratamiento m[eé]dico|anticoagulante|aspirina|losartan|enalapril/i,
            /cirugia|cirug[ií]a|cirujia|operado|operada|operacion|operaci[oó]n|postoperatorio|me operaron/i,
            /ri[nñ]on|ri[nñ]ones|renal|higado|h[ií]gado|hepatico|hep[aá]tico/i,
            /alergia|al[eé]rgico|alergico|me hace da[nñ]o|me puede hacer mal|efecto secundario|efectos secundarios/i,
            /contraindicacion|contraindicaci[oó]n|contraindicaciones|contra indicado|contraindicado/i,
            /puedo tomar.*(si|con)|lo puedo tomar.*(si|con)|puedo usar.*(si|con)|lo puedo usar.*(si|con)/i
        ],
        text: 'Le entiendo, señor. Le envio un audio corto sobre la formula natural de Vit Power.\n\nSi tiene diabetes, presion alta, problema del corazon, higado o riñon, si fue operado o si usa medicamentos, confirme primero con su medico o farmaceutico de confianza antes de usar cualquier suplemento.',
        audios: ['100_NATURAL_SEM_CONTRA_INDICACAO']
    },
    {
        key: 'product_ingredients_composition',
        purpose: 'ingredientes',
        patterns: [
            /ingrediente|ingredientes|composicion|composici[oó]n|formula|f[oó]rmula|componentes?/i,
            /que\s+(tiene|contiene|trae)\s+(el\s+)?(producto|vit\s*power|tratamiento|frasco)/i,
            /(producto|vit\s*power|tratamiento|frasco).*(tiene|contiene|trae)/i,
            /boroj[oó]|chontaduro|noni|arginina|l[\s-]?arginina|maca|guarana|guaran[aá]|vitamina|vitaminas/i,
            /es\s+natural|quimico|qu[ií]mico|tiene\s+cafeina|tiene\s+cafe[ií]na/i
        ],
        text: PRODUCT_INGREDIENTS_TEXT
    },
    {
        key: 'price_table',
        purpose: 'oferta',
        patterns: [
            /precio|precios|valor|cuanto cuesta|cu[aá]nto cuesta|promocion|promo|tratamiento/i
        ],
        text: 'Le paso la promocion oficial de hoy: 1 frasco $39, 3 frascos $95.99 y 6 frascos $167.99.',
        audios: ['TRATAMENTO_Y_PRECIOS_PROMOCAO']
    },
    {
        key: 'product_works',
        purpose: 'prova',
        blockedStages: [
            'awaiting_delivery_mode',
            'awaiting_agency_details',
            'awaiting_agency_selection',
            'awaiting_agency_selection_interrupt',
            'awaiting_customer_name',
            'awaiting_agency_confirmation',
            'sdr_awaiting_delivery_mode',
            'sdr_awaiting_agency_query',
            'sdr_awaiting_agency_selection',
            'sdr_awaiting_home_address',
            'order_closed'
        ],
        patterns: [
            /funciona|funcione|de verdad funciona|realmente funciona/i,
            /sirve para mi|me sirve|servira para mi|servir[aá] para mi|esto sirve|eso sirve|de verdad sirve/i,
            /es bueno|es buena|que tan bueno|qu[eé] tan bueno|que tal es|qu[eé] tal es|q tal es/i,
            /es efectivo|efectivo|vale la pena|si vale|s[ií] vale|sera bueno|ser[aá] bueno/i,
            /me ayuda|ayuda de verdad|sera que me ayuda|ser[aá] que me ayuda/i,
            /tiene prueba|hay prueba|prueba real|testimonio|testimonios|experiencia|experiencias|casos reales/i,
            /a otros les funciono|a otros les funciona|le ha funcionado a otros|personas que lo usaron/i,
            /para mi edad|para hombres mayores|energia|confianza|intimidad|potencia/i,
            /capsula|capsulas|liquido|liquido.*sangre|sangre|corriente sanguinea/i,
            /tengo duda.*(producto|vit power|tratamiento)|no se si comprar|no estoy seguro.*(producto|vit power|tratamiento)/i
        ],
        text: 'Si, señor. Le explico con cuidado: Vit Power es un apoyo natural y muchos clientes lo buscan para sentirse con mas energia y confianza. El resultado depende de cada organismo y de usarlo con constancia. Le envio una prueba corta para que tenga mas seguridad.',
        audios: ['FUNCIONA_VIT_POWER', 'DEPOIMENTO_AUDIO_PRODUTO']
    }
];

const ruleMatches = (rule, text) => {
    const body = normalize(text);
    return rule.patterns.some((pattern) => pattern.test(body));
};

const currentFunnelStage = (state, agentKey) => {
    const agentMemory = (((state?.metadata || {}).perAgentMemory || {})[agentKey] || {});
    return String(
        agentMemory.pendingCheckoutOrder?.stage
        || agentMemory.pendingCheckoutOrder?.funnelStage
        || agentMemory.principalSdrStage
        || agentMemory.lastFunnelStage
        || ''
    );
};

const isBlockedByStage = ({ rule, state, agentKey }) => {
    const blockedStages = rule.blockedStages || [];
    if (!blockedStages.length) return false;
    return blockedStages.includes(currentFunnelStage(state, agentKey));
};

const getComplementMemory = (state, agentKey) => {
    const agentMemory = (((state?.metadata || {}).perAgentMemory || {})[agentKey] || {});
    return {
        agentMemory,
        complements: agentMemory.audioComplements || {}
    };
};

const hasInitialFunnelStarted = (agentMemory = {}) => Boolean(
    agentMemory.greeting_audio_sent
    || agentMemory.greeting_sent_at
    || agentMemory.initialProductPresentationSentAt
    || agentMemory.initialProductPresentationCompletedAt
    || agentMemory.initialProductPresentationPriceSentAt
    || (Array.isArray(agentMemory.initialProductPresentationSteps) && agentMemory.initialProductPresentationSteps.length > 0)
);

const shouldSkipByMemory = ({ state, agentKey, ruleKey }) => {
    const { complements } = getComplementMemory(state, agentKey);
    const item = complements[ruleKey] || {};
    if (!item.lastSentAt) return false;
    const lastSentAt = new Date(item.lastSentAt).getTime();
    return Number.isFinite(lastSentAt) && Date.now() - lastSentAt < COMPLEMENT_COOLDOWN_MS;
};

const saveComplementMemory = async ({ contactStateId, agentKey, rule, text, state = null }) => {
    if (!contactStateId) return;
    const agentMemory = (((state?.metadata || {}).perAgentMemory || {})[agentKey] || {});
    const previousFunnelStage = agentMemory.lastFunnelStage || '';
    const previousConversationStage = agentMemory.conversationState?.stage || '';
    await ContactState.updateOne(
        { _id: contactStateId },
        {
            $set: {
                [`metadata.perAgentMemory.${agentKey}.audioComplements.${rule.key}`]: {
                    lastSentAt: new Date(),
                    textHash: hashKey(text),
                    audios: rule.audios || [],
                    images: rule.images || []
                },
                [`metadata.perAgentMemory.${agentKey}.lastComplementKey`]: rule.key,
                [`metadata.perAgentMemory.${agentKey}.lastComplementAt`]: new Date(),
                [`metadata.perAgentMemory.${agentKey}.lastInterruptKey`]: rule.key,
                [`metadata.perAgentMemory.${agentKey}.lastInterruptAnsweredAt`]: new Date(),
                [`metadata.perAgentMemory.${agentKey}.resumeFunnelStageAfterInterrupt`]: previousFunnelStage,
                [`metadata.perAgentMemory.${agentKey}.resumeConversationStageAfterInterrupt`]: previousConversationStage
            }
        }
    );
};

const registerOutboundMessage = async ({ chatId, peerPhone, body }) => {
    try {
        await Message.create({
            _id: `out_${Date.now()}_audio_complement`,
            chatId,
            peerPhone,
            from: 'bot',
            to: chatId,
            body,
            isFromMe: true,
            isBot: true,
            timestamp: Math.floor(Date.now() / 1000)
        });
    } catch (error) {
        if (error.code !== 11000) {
            console.warn('[AUDIO-COMPLEMENT] falha ao registrar mensagem:', error.message);
        }
    }
};

export const maybeHandleVitPowerAudioComplement = async ({
    text,
    chatId,
    peerPhone,
    contactStateId,
    contactState = null,
    agentProfile,
    sessionId = null,
    countryCode = 'EC'
}) => {
    if (String(process.env.VIT_POWER_AUDIO_COMPLEMENTS_ENABLED || 'true').toLowerCase() !== 'true') {
        return { handled: false };
    }
    if (agentProfile?.key !== 'vit_power_ec') return { handled: false };
    if (isQuantitySelection(text)) return { handled: false, skipped: 'quantity_selection' };
    const state = contactState || (contactStateId ? await ContactState.findById(contactStateId).lean() : null);
    const { agentMemory } = getComplementMemory(state, agentProfile.key);
    if (isInitialProductInquiry(text) && !hasInitialFunnelStarted(agentMemory)) {
        return { handled: false, skipped: 'initial_funnel_must_start_first' };
    }
    const rule = RULES.find((candidate) => ruleMatches(candidate, text));
    if (!rule) return { handled: false };
    if (isBlockedByStage({ rule, state, agentKey: agentProfile.key })) {
        return { handled: false, skipped: 'blocked_stage', ruleKey: rule.key };
    }
    if (shouldSkipByMemory({ state, agentKey: agentProfile.key, ruleKey: rule.key })) {
        return { handled: true, skipped: 'cooldown', ruleKey: rule.key };
    }

    let audioSent = false;
    const sentAudios = [];
    const candidateAudios = rule.audios || [];
    const purpose = rule.purpose || rule.key;
    const selectedAudio = candidateAudios.length
        ? await getNextAudioByPurpose(peerPhone || chatId, purpose, {
            candidates: candidateAudios,
            contactStateId,
            state,
            agentKey: agentProfile.key
        })
        : null;
    const sendSelectedAudio = async () => {
        if (!selectedAudio || audioSent) return;
        const baseName = selectedAudio;
        const audioPath = await resolveCountryAudio({ country: countryCode, baseName });
        if (!audioPath) {
            console.warn(`[AUDIO-COMPLEMENT] audio nao encontrado: ${countryCode}/${baseName}`);
            return;
        }
        const sent = await sendAudio(chatId, audioPath, true, { sessionId });
        audioSent = audioSent || sent;
        if (sent) {
            sentAudios.push(baseName);
            await markAudioPurposeSent({
                contactStateId,
                agentKey: agentProfile.key,
                purpose,
                baseName
            });
        }
    };

    if (rule.audioPrimary) {
        await sendSelectedAudio();
    }

    const textSent = rule.text
        ? await sendText(chatId, rule.text, null, { sessionId })
        : false;

    let imageSent = false;
    for (const imageKey of rule.images || []) {
        const media = getSalesMedia(imageKey);
        if (!media) continue;
        const sent = media.type === 'video'
            ? await sendVideo(chatId, media.path, media.caption || '', {
                sessionId,
                viewOnce: Boolean(media.viewOnce)
            })
            : await sendImage(chatId, media.path, media.caption || '', { sessionId });
        imageSent = imageSent || sent;
    }

    if (!rule.audioPrimary) {
        await sendSelectedAudio();
    }

    if (rule.requireTextAndAudio && (!textSent || !audioSent)) {
        console.warn(`[AUDIO-COMPLEMENT] regra ${rule.key} exige audio + texto | audio=${audioSent} | texto=${textSent} | chat=${chatId}`);
    }

    if (!textSent && !imageSent && !audioSent) return { handled: false, ruleKey: rule.key };

    await saveComplementMemory({
        contactStateId,
        agentKey: agentProfile.key,
        rule,
        text,
        state
    });
    await registerOutboundMessage({
        chatId,
        peerPhone,
        body: [
            rule.text || '',
            ...(rule.images || []).map((image) => `[IMAGEM] ${image}`),
            ...sentAudios.map((audio) => `[AUDIO] ${audio}`)
        ].filter(Boolean).join('\n')
    });

    return {
        handled: true,
        ruleKey: rule.key,
        resumeFunnelStage: (((state?.metadata || {}).perAgentMemory || {})[agentProfile.key] || {}).lastFunnelStage || '',
        resumeConversationStage: (((state?.metadata || {}).perAgentMemory || {})[agentProfile.key] || {}).conversationState?.stage || '',
        textSent,
        imageSent,
        audioSent
    };
};
