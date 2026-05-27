import Message from '../models/Message.js';
import ContactState from '../models/ContactState.js';
import ObservationReport from '../models/ObservationReport.js';

const digitsOnly = (value) => String(value || '').replace(/\D/g, '');
const normalizeText = (value) => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const clip = (value, max = 500) => {
    const text = String(value || '').trim();
    if (text.length <= max) return text;
    return `${text.slice(0, max - 3)}...`;
};

const containsAny = (text, patterns) => patterns.some((pattern) => pattern.test(text));

const signalGroups = {
    buyLater: [
        /fin de mes/, /fin del mes/, /final de mes/, /proximo mes/, /quincena/,
        /primera semana/, /segunda semana/, /yo le aviso/, /yo te aviso/,
        /le aviso despues/, /manana conversamos/, /mas tarde/, /aun no/,
        /estoy chiro/, /ahorita estoy chiro/, /no tengo plata/, /no tengo dinero/,
        /aun no me pagan/, /cuando tenga (el )?(dinero|plata)/
    ],
    cancel: [
        /no me mande/, /no me manden/, /no envie/, /no despache/,
        /ya no quiero/, /no voy a comprar/, /cancelar/, /cancele/, /anular/
    ],
    trust: [
        /estafa/, /estafador/, /estafadores/, /puro bla bla/, /confianza/,
        /seguro/, /garantia/, /devuelve el dinero/, /contra quien me voy/,
        /si no me sirve/
    ],
    medical: [
        /presion/, /diabetes/, /corazon/, /infarto/, /cirugia/, /operado/,
        /medicamento/, /medicina/, /contraindicacion/, /prostata/,
        /hipertension/, /pastillas/
    ],
    discretion: [
        /discreto/, /nadie sepa/, /embalaje/, /empaque/, /caja/,
        /nombre del producto/, /factura/, /verg[u]?enza/
    ],
    price: [
        /precio/, /cuanto cuesta/, /valor/, /caro/, /rebaja/, /descuento/
    ],
    logistics: [
        /cuando llega/, /cuanto demora/, /agencia/, /servientrega/,
        /domicilio/, /direccion/, /retirar/, /guia/
    ],
    question: [
        /\?$/, /^(como|cuanto|cuando|donde|por que|que|cual)\b/,
        /\b(funciona|sirve|garantia|seguro|precio|llega|toma)\b/
    ]
};

const copyByCategory = {
    buy_later: {
        why: 'O cliente nao esta fechando agora. Se o bot insistir em pedido, aumenta resistencia e parece pressao.',
        reply: 'Claro, le entiendo. Guarde mi numero como Ana Lopez - Vit Power. Me escribe cuando ya tenga fecha o cuando le paguen y le ayudo con calma.',
        audio: '',
        proof: '',
        status: 'comprar_depois',
        action: 'mark_buy_later'
    },
    cancel: {
        why: 'O cliente pediu para nao enviar ou cancelar. Continuar insistindo pode gerar reclamacao e pedido falso.',
        reply: 'Listo, no le envio nada. Dejo pausado por aqui. Si mas adelante desea retomarlo, me escribe y le ayudo.',
        audio: '',
        proof: '',
        status: 'cancelado',
        action: 'pause_or_cancel'
    },
    trust: {
        why: 'Medo de golpe precisa ser respondido antes de pedir dados. Pular isso quebra confianca.',
        reply: 'Le entiendo, senor. Por eso trabajamos con retiro seguro y orientacion clara antes de confirmar. Le muestro una prueba y si le da confianza seguimos.',
        audio: 'ENVIO_AGENCIA_100_SEGURO',
        proof: 'prova_social_rotativa',
        status: '',
        action: 'answer_objection_first'
    },
    medical: {
        why: 'Duvida medica exige acolhimento e linguagem responsavel antes do fechamento.',
        reply: 'Gracias por avisarme. Es importante cuidarse. Le explico de forma simple: el producto es natural, pero si usted usa medicina fuerte ou tem condicion delicada, lo ideal es revisar con calma antes de confirmar.',
        audio: '100_NATURAL_SEM_CONTRA_INDICACAO',
        proof: '',
        status: '',
        action: 'answer_objection_first'
    },
    discretion: {
        why: 'Vergonha e sigilo sao gatilhos fortes nesse publico. O bot deve tranquilizar antes de pedir dados.',
        reply: 'Quedese tranquilo, se maneja con discrecion. La idea es que usted reciba orientacion y entrega sin exponer nada personal.',
        audio: 'INFORMACOES_PESSOAIS_NAIS',
        proof: '',
        status: '',
        action: 'answer_objection_first'
    },
    unanswered: {
        why: 'Pergunta do cliente pode ter ficado sem resposta util. Isso cria abandono por falta de clareza.',
        reply: 'Responder diretamente a pergunta em uma frase curta e so depois conduzir para o proximo passo.',
        audio: '',
        proof: '',
        status: '',
        action: 'review_copy'
    },
    long_bot: {
        why: 'Mensagem longa demais pode parecer robo e reduzir leitura no WhatsApp.',
        reply: 'Dividir em resposta curta, audio humano e uma pergunta simples no final.',
        audio: '',
        proof: '',
        status: '',
        action: 'shorten_copy'
    }
};

const finding = ({ priority = 'important', category, chatId, phone, customerText = '', botText = '' }) => {
    const copy = copyByCategory[category] || copyByCategory.unanswered;
    return {
        priority,
        category,
        chatId,
        phone,
        customerText: clip(customerText),
        botText: clip(botText),
        whyItMatters: copy.why,
        suggestedReply: copy.reply,
        suggestedAudio: copy.audio,
        suggestedProof: copy.proof,
        recommendedStatus: copy.status,
        recommendedAction: copy.action
    };
};

const groupMessagesByChat = (messages) => {
    const grouped = new Map();
    for (const message of messages) {
        const chatId = message.chatId || message.from || message.to || '';
        if (!chatId) continue;
        if (!grouped.has(chatId)) grouped.set(chatId, []);
        grouped.get(chatId).push(message);
    }
    for (const list of grouped.values()) {
        list.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    }
    return grouped;
};

const getMessageText = (message) => String(message?.body || '').trim();

const analyzeConversation = ({ chatId, messages, phone }) => {
    const findings = [];
    let lastInbound = null;
    let lastBot = null;

    for (const message of messages) {
        const text = getMessageText(message);
        if (!text) continue;
        const normalized = normalizeText(text);
        const isInbound = !message.isFromMe && message.from !== 'bot';
        const isBot = message.isBot || message.from === 'bot';

        if (isInbound) {
            if (containsAny(normalized, signalGroups.cancel)) {
                findings.push(finding({ priority: 'critical', category: 'cancel', chatId, phone, customerText: text, botText: getMessageText(lastBot) }));
            } else if (containsAny(normalized, signalGroups.buyLater)) {
                findings.push(finding({ priority: 'critical', category: 'buy_later', chatId, phone, customerText: text, botText: getMessageText(lastBot) }));
            } else if (containsAny(normalized, signalGroups.trust)) {
                findings.push(finding({ priority: 'critical', category: 'trust', chatId, phone, customerText: text, botText: getMessageText(lastBot) }));
            } else if (containsAny(normalized, signalGroups.medical)) {
                findings.push(finding({ priority: 'important', category: 'medical', chatId, phone, customerText: text, botText: getMessageText(lastBot) }));
            } else if (containsAny(normalized, signalGroups.discretion)) {
                findings.push(finding({ priority: 'important', category: 'discretion', chatId, phone, customerText: text, botText: getMessageText(lastBot) }));
            } else if (containsAny(normalized, signalGroups.question)) {
                const nextBot = messages.find((candidate) => (candidate.timestamp || 0) > (message.timestamp || 0) && (candidate.isBot || candidate.from === 'bot'));
                if (!nextBot) {
                    findings.push(finding({ priority: 'important', category: 'unanswered', chatId, phone, customerText: text }));
                }
            }
            lastInbound = message;
        }

        if (isBot) {
            if (text.length > 650) {
                findings.push(finding({ priority: 'improvement', category: 'long_bot', chatId, phone, customerText: getMessageText(lastInbound), botText: text }));
            }
            lastBot = message;
        }
    }

    return findings;
};

const buildRecommendations = (summary) => {
    const recommendations = [];
    if (summary.trustSignals) {
        recommendations.push('Quando aparecer medo de golpe, estafa, garantia ou devolucao, responder a objecao antes de pedir dados e usar prova social rotativa.');
    }
    if (summary.medicalSignals) {
        recommendations.push('Duvidas sobre pressao, diabetes, coracao, cirurgia ou remedio devem receber resposta curta e responsavel antes do fechamento.');
    }
    if (summary.buyLaterSignals) {
        recommendations.push('Sinais de fim do mes, sem dinheiro ou "yo le aviso" devem virar comprar_depois com data/follow-up quando possivel.');
    }
    if (summary.unansweredSignals) {
        recommendations.push('Revisar perguntas sem resposta para criar blocos curtos de resposta direta no funil.');
    }
    if (!recommendations.length) {
        recommendations.push('Nenhuma falha critica detectada na janela. Continuar observando conversas novas.');
    }
    return recommendations;
};

export const generateObservationReport = async ({
    country = 'EC',
    hours = Number(process.env.OBSERVATION_LOOKBACK_HOURS || 24),
    limit = Number(process.env.OBSERVATION_MESSAGE_LIMIT || 800),
    mode = 'manual',
    generatedBy = 'operator'
} = {}) => {
    const to = new Date();
    const from = new Date(Date.now() - Math.max(1, hours) * 60 * 60 * 1000);

    const messages = await Message.find({
        createdAt: { $gte: from, $lte: to },
        body: { $exists: true, $ne: '' }
    })
        .sort({ timestamp: 1, createdAt: 1 })
        .limit(Math.max(50, Math.min(limit, 3000)))
        .lean();

    const grouped = groupMessagesByChat(messages);
    const states = await ContactState.find({
        chatId: { $in: Array.from(grouped.keys()) }
    }, { chatId: 1, phoneDigits: 1, countryCode: 1 }).lean();
    const stateByChat = new Map(states.map((state) => [state.chatId, state]));

    const allFindings = [];
    for (const [chatId, list] of grouped.entries()) {
        const state = stateByChat.get(chatId);
        if (country && country !== 'ALL' && state?.countryCode && state.countryCode !== country) continue;
        const phone = digitsOnly(state?.phoneDigits || chatId);
        allFindings.push(...analyzeConversation({ chatId, messages: list, phone }));
    }

    const limitedFindings = allFindings.slice(0, Number(process.env.OBSERVATION_MAX_FINDINGS || 80));
    const summary = {
        critical: limitedFindings.filter((item) => item.priority === 'critical').length,
        important: limitedFindings.filter((item) => item.priority === 'important').length,
        improvements: limitedFindings.filter((item) => item.priority === 'improvement').length,
        buyLaterSignals: limitedFindings.filter((item) => item.category === 'buy_later').length,
        trustSignals: limitedFindings.filter((item) => item.category === 'trust').length,
        medicalSignals: limitedFindings.filter((item) => item.category === 'medical').length,
        unansweredSignals: limitedFindings.filter((item) => item.category === 'unanswered').length
    };

    const report = await ObservationReport.create({
        title: `Observacao funil Vit Power ${country} - ${to.toISOString().slice(0, 16).replace('T', ' ')}`,
        mode,
        status: 'completed',
        country,
        source: {
            from,
            to,
            limit,
            conversations: grouped.size,
            messages: messages.length
        },
        summary,
        findings: limitedFindings,
        recommendations: buildRecommendations(summary),
        generatedBy
    });

    return report.toObject();
};

export const listObservationReports = async ({ limit = 20, country = 'EC' } = {}) => ObservationReport.find({
    ...(country && country !== 'ALL' ? { country } : {})
})
    .sort({ createdAt: -1 })
    .limit(Math.max(1, Math.min(Number(limit) || 20, 100)))
    .lean();

export const getObservationReport = async (id) => ObservationReport.findById(id).lean();
