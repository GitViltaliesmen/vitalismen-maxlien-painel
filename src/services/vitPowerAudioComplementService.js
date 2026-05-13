import crypto from 'crypto';
import ContactState from '../models/ContactState.js';
import Message from '../models/Message.js';
import { resolveCountryAudio } from './audioTemplateService.js';
import { getSalesMedia } from './salesMediaCatalog.js';
import { sendAudio } from '../whatsapp/sendAudio.js';
import { sendImage } from '../whatsapp/sendImage.js';
import { sendVideo } from '../whatsapp/sendVideo.js';
import { sendText } from '../whatsapp/sendText.js';

const COMPLEMENT_COOLDOWN_MS = 30 * 60 * 1000;

const normalize = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const hashKey = (value) => crypto.createHash('sha1').update(String(value || '')).digest('hex');

const RULES = [
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
        audios: ['INFORMACOES_PESSOAIS_NAIS', 'INFORMACOES_PESSOAIS_ANA']
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
            /cu[aá]nto.*(demora|tarda).*(llegar|llega|entrega|env[ií]o|pedido|producto)/i,
            /cuando.*(llega|llegar|entregan|entrega|env[ií]an|envio|pedido|producto)/i,
            /tiempo.*(llegar|llega|entrega|env[ií]o|pedido)/i,
            /cuantos dias|cu[aá]ntos d[ií]as|en cuantos dias|en cu[aá]ntos d[ií]as/i,
            /quanto.*(demora|tarda).*(chegar|entrega|envio|pedido|produto)/i,
            /quando.*(chega|chegar|entrega|enviam|envia|pedido|produto)/i,
            /tempo.*(chegar|entrega|envio|pedido)/i
        ],
        text: '',
        audios: ['TEMPO_DEMORA_PRODUTO_CHEGAR']
    },
    {
        key: 'result_time',
        patterns: [
            /cuando.*(resultado|efecto|funciona)/i,
            /cuanto.*(tarda|demora).*resultado/i,
            /tiempo.*resultado/i,
            /resultado|resultados|efecto/i
        ],
        text: 'Le envio un audio corto sobre el tiempo de resultado esperado y como tomarlo con constancia.',
        audios: ['TEMPO_RESULTADO_VIT_POWER']
    },
    {
        key: 'how_to_use',
        patterns: [
            /como.*(toma|tomar|usa|usar)/i,
            /dosis|cuantas veces|modo de uso|se toma/i
        ],
        text: 'Perfecto, le envio el audio de uso para que lo tome correctamente.',
        audios: ['COMO_SE_TOMA_VIT_POWER']
    },
    {
        key: 'price_table',
        patterns: [
            /precio|precios|valor|cuanto cuesta|cu[aá]nto cuesta|promocion|promo|tratamiento/i
        ],
        text: 'Le paso la promocion oficial de hoy: 1 frasco $39, 3 frascos $95.99 y 6 frascos $167.99.',
        audios: ['TRATAMENTO_Y_PRECIOS_PROMOCAO_1_3_6']
    },
    {
        key: 'product_works',
        patterns: [
            /funciona|sirve|es bueno|que tan bueno/i,
            /capsula|capsulas|liquido|liquido.*sangre|sangre|corriente sanguinea/i,
            /duda|no se|no estoy seguro/i
        ],
        text: 'Claro, le envio una explicacion corta y un testimonio real para que tenga mas seguridad.',
        audios: ['FUNCIONA_VIT_POWER', 'DEPOIMENTO_AUDIO_PRODUTO']
    }
];

const ruleMatches = (rule, text) => {
    const body = normalize(text);
    return rule.patterns.some((pattern) => pattern.test(body));
};

const getComplementMemory = (state, agentKey) => {
    const agentMemory = (((state?.metadata || {}).perAgentMemory || {})[agentKey] || {});
    return {
        agentMemory,
        complements: agentMemory.audioComplements || {}
    };
};

const shouldSkipByMemory = ({ state, agentKey, ruleKey }) => {
    const { complements } = getComplementMemory(state, agentKey);
    const item = complements[ruleKey] || {};
    if (!item.lastSentAt) return false;
    const lastSentAt = new Date(item.lastSentAt).getTime();
    return Number.isFinite(lastSentAt) && Date.now() - lastSentAt < COMPLEMENT_COOLDOWN_MS;
};

const saveComplementMemory = async ({ contactStateId, agentKey, rule, text }) => {
    if (!contactStateId) return;
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
                [`metadata.perAgentMemory.${agentKey}.lastFunnelStage`]: `complement_${rule.key}`
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
    const state = contactState || (contactStateId ? await ContactState.findById(contactStateId).lean() : null);
    const rule = RULES.find((candidate) => ruleMatches(candidate, text));
    if (!rule) return { handled: false };
    if (shouldSkipByMemory({ state, agentKey: agentProfile.key, ruleKey: rule.key })) {
        return { handled: true, skipped: 'cooldown', ruleKey: rule.key };
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

    let audioSent = false;
    for (const baseName of rule.audios || []) {
        const audioPath = await resolveCountryAudio({ country: countryCode, baseName });
        if (!audioPath) {
            console.warn(`[AUDIO-COMPLEMENT] audio nao encontrado: ${countryCode}/${baseName}`);
            continue;
        }
        const sent = await sendAudio(chatId, audioPath, true, { sessionId });
        audioSent = audioSent || sent;
    }

    if (!textSent && !imageSent && !audioSent) return { handled: false, ruleKey: rule.key };

    await saveComplementMemory({
        contactStateId,
        agentKey: agentProfile.key,
        rule,
        text
    });
    await registerOutboundMessage({
        chatId,
        peerPhone,
        body: [
            rule.text || '',
            ...(rule.images || []).map((image) => `[IMAGEM] ${image}`),
            ...(rule.audios || []).map((audio) => `[AUDIO] ${audio}`)
        ].filter(Boolean).join('\n')
    });

    return {
        handled: true,
        ruleKey: rule.key,
        textSent,
        imageSent,
        audioSent
    };
};
