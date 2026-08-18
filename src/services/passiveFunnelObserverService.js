import fs from 'fs/promises';
import path from 'path';
import Message from '../models/Message.js';
import ContactState from '../models/ContactState.js';

const digitsOnly = (value) => String(value || '').replace(/\D/g, '');

const normalizeText = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const parseList = (value = '') => String(value || '')
    .split(',')
    .map((item) => digitsOnly(item))
    .filter(Boolean);

const reportPath = () => path.resolve(
    process.cwd(),
    process.env.PASSIVE_FUNNEL_OBSERVER_REPORT_PATH || 'runtime/passive-funnel-observer-latest.json'
);

const perfectReportPath = () => path.resolve(
    process.cwd(),
    process.env.PERFECT_FUNNEL_OBSERVER_REPORT_PATH || 'runtime/perfect-funnel-observer-latest.json'
);

const perfectSpreadsheetDir = () => path.resolve(
    process.cwd(),
    process.env.PERFECT_FUNNEL_OBSERVER_SPREADSHEET_DIR || 'runtime/observer-spreadsheets'
);

const matchesCountry = (phoneDigits, country = 'EC') => {
    const digits = digitsOnly(phoneDigits);
    if (!digits) return false;
    if (String(country || 'EC').toUpperCase() !== 'EC') return true;
    if (digits.startsWith('593')) return true;
    const testPhones = [
        process.env.WHATSAPP_PRIORITY_TEST_PHONES,
        process.env.PASSIVE_FUNNEL_OBSERVER_EXTRA_PHONES,
        '5515998038637'
    ].flatMap(parseList);
    return testPhones.some((phone) => digits === phone || digits.endsWith(phone.slice(-8)));
};

const phoneFromMessage = (message) => {
    const candidates = [message.peerPhone, message.chatId, message.from, message.to]
        .map(digitsOnly)
        .filter(Boolean);
    const preferred = candidates.find((digits) => digits.startsWith('593'))
        || candidates.find((digits) => digits.length >= 10)
        || candidates[0]
        || '';
    return preferred;
};

const isClientMessage = (message) => !message.isFromMe
    && !message.isBot
    && !/zapi_watchdog/i.test(String(message.provider || ''))
    && !/vsl_entry|panel_prefill/i.test(`${message.provider || ''} ${message.providerStatus || ''}`)
    && !/^ALERTA: o WhatsApp conectado/i.test(String(message.body || ''));

const isAgentMessage = (message) => Boolean(message.isFromMe || message.isBot);

const isWarmupOrSafeManualContact = (state = null) => {
    const note = normalizeText(`${state?.human?.note || ''} ${state?.metadata?.manualNote || ''}`);
    const reason = normalizeText(`${state?.metadata?.automationPausedReason || ''} ${state?.metadata?.manualCloseCommand || ''}`);
    return /#aquece|aquecimento|warmup|lista de aquecimento/.test(`${note} ${reason}`);
};

const hasWarmupMarkerMessage = (messages = []) => messages.some((message) => {
    const body = normalizeText(message.body || '');
    return /aquecimento liberado|#aquece|lista de aquecimento|warmup/.test(body);
});

const messageAt = (message) => {
    if (message.createdAt) return new Date(message.createdAt);
    if (message.timestamp) {
        const timestamp = Number(message.timestamp);
        return new Date(timestamp > 100000000000 ? timestamp : timestamp * 1000);
    }
    return new Date(0);
};

const secondsBetween = (older, newer) => Math.max(0, Math.round((messageAt(newer).getTime() - messageAt(older).getTime()) / 1000));

const inboundIntent = (text) => {
    const normalized = normalizeText(text);
    if (!normalized) return '';
    const groups = [
        ['preco', /\b(precio|precios|cuanto cuesta|cuanto vale|valor|promocion|promosion|quiero comprar|quiero pedir|me interesa|cuanto esta|cual es el precio)\b/],
        ['produto', /\b(que producto|que es eso|nombre del producto|para que sirve|pa que sirve|que hace|en que ayuda|beneficios|mas informacion|no conozco|que son capsulas|qu[eé] son c[aá]psulas|son capsulas|son c[aá]psulas|es capsula|es c[aá]psula|son pastillas|es pastilla|pastillas o jarabe|capsulas o jarabe|c[aá]psulas o jarabe|liquido o capsula|l[ií]quido o c[aá]psula|es liquido|es l[ií]quido|es jarabe|jarabe liquido|jarabe l[ií]quido)\b/],
        ['saude', /\b(hipertenso|presion alta|diabetico|diabetes|azucar|medicamentos|pastillas|corazon|hace dano|contraindicaciones)\b/],
        ['funciona', /\b(funciona|si funciona|de verdad funciona|esto sirve|sirve para mi|es bueno|da resultado|es real|pruebas|testimonios)\b/],
        ['resultado_uso', /\b(cuanto tiempo|hace efecto|como se usa|como se toma|dosis|veces al dia|despues de comer)\b/],
        ['volume_firmeza', /\b(crecimiento|sirve para crecer|hace crecer|agrandar|engrandar|mas grande|mas grueso|mas largo|engrosamiento|alargamiento|firme|firmeza|duro|dura|verga dura|bien fuerte|ereccion|erecci[oó]n|erecion|ereccion fuerte|erecci[oó]n fuerte|erecion fuerte|flacido|fl[aá]cido|blando|se baja|no se levanta|palo parado|como palo|volumen|pesado|encuentro sexual|culiar|culear|follar|tener relaciones|relaciones sexuales)\b/],
        ['logistica', /\b(donde retiro|agencia|servientrega|entrega|cuanto demora|cuando llega|casa|ciudad|provincia)\b/],
        ['quantidade', /\b(quiero 1|quiero 3|quiero 6|1 frasco|3 frascos|6 frascos|2 frascos|dos botellas|me rebaja|descuento)\b/],
        ['social_ligacao', /\b(llamame|llamar|videollamada|eres casada|tienes esposo|donde vives|cuantos anos|mandame foto)\b/]
    ];
    return groups.find(([, pattern]) => pattern.test(normalized))?.[0] || '';
};

const INTENT_RULES = {
    preco: {
        requiredAudio: ['TRATAMENTO_Y_PRECIOS_PROMOCAO'],
        mustMention: /\b(39|95|167|frasco|frascos|botella|botellas|precio|valor)\b/i,
        technique: 'Preco claro + pergunta de quantidade.'
    },
    saude: {
        requiredAudio: ['100_NATURAL_SEM_CONTRA_INDICACAO'],
        mustMention: /\[AUDIO\]\s*100_NATURAL_SEM_CONTRA_INDICACAO|natural/i,
        technique: 'Audio gravado de saude primeiro, sem texto improvisado.'
    },
    funciona: {
        requiredAudio: ['FUNCIONA_VIT_POWER', 'FUNCIONA_TRATAMENTO_COMPLETO_100_NATURAL', 'DEPOIMENTO_AUDIO_PRODUTO'],
        mustMention: /\[AUDIO\]\s*(FUNCIONA_VIT_POWER|FUNCIONA_TRATAMENTO_COMPLETO_100_NATURAL|DEPOIMENTO_AUDIO_PRODUTO)|funciona|testimonio|prueba/i,
        technique: 'Prova + audio gravado + avanco leve.'
    },
    produto: {
        requiredAudio: ['DUVIDAS', 'PRODUDO_LIQUIDO_X_CAPSULA_MELHOR'],
        mustMention: /\[AUDIO\]\s*(DUVIDAS|PRODUDO_LIQUIDO_X_CAPSULA_MELHOR)|vit power|frasco|producto|jarabe|liquido/i,
        technique: 'Responder o que e antes de vender.'
    },
    resultado_uso: {
        requiredAudio: ['TEMPO_RESULTADO_VIT_POWER', 'COMO_SE_TOMA_VIT_POWER'],
        mustMention: /\[AUDIO\]\s*(TEMPO_RESULTADO_VIT_POWER|COMO_SE_TOMA_VIT_POWER)|toma|tomar|resultado|tiempo/i,
        technique: 'Orientacao objetiva de uso/tempo com audio.'
    },
    volume_firmeza: {
        requiredAudio: ['AUMENTA_ENGROSSA_VOLUME_GRANDE_VERGA_DURA'],
        mustMention: /\[AUDIO\]\s*AUMENTA_ENGROSSA_VOLUME_GRANDE_VERGA_DURA|firmeza|volumen|grueso|grande|duro/i,
        technique: 'Audio de volume/firmeza + linguagem de venda aprovada.'
    },
    logistica: {
        requiredAudio: ['ENDERECO_CIDADE_PROVINCIA_AGENCIA', 'PERGUNTA_AGENCIA_DOMICILIO', 'ESCOLHA_UMA_AGENCIA_ACIMA'],
        mustMention: /\[AUDIO\]\s*(ENDERECO_CIDADE_PROVINCIA_AGENCIA|PERGUNTA_AGENCIA_DOMICILIO|ESCOLHA_UMA_AGENCIA_ACIMA)|ciudad|provincia|agencia|servientrega|domicilio/i,
        technique: 'Coletar cidade/provincia antes de agencia.'
    },
    quantidade: {
        requiredAudio: ['1_BOTELLA_POR_39', '3_BOTELLAS_POR_95_E_99', '6_BOTELLAS_POR_167_E_99', 'TRATAMENTO_Y_PRECIOS_PROMOCAO'],
        mustMention: /\[AUDIO\]\s*(1_BOTELLA_POR_39|3_BOTELLAS_POR_95_E_99|6_BOTELLAS_POR_167_E_99|TRATAMENTO_Y_PRECIOS_PROMOCAO)|1|3|6|frasco|frascos|botella|botellas/i,
        technique: 'Confirmar kit e conduzir para dados.'
    },
    social_ligacao: {
        requiredAudio: ['INFORMACOES_PESSOAIS_NAIS', 'CLIENTES_QUE_LIGAM', 'QUANDO_CLIENTE_INSISTE_EM_LIGAR'],
        mustMention: /\[AUDIO\]\s*(INFORMACOES_PESSOAIS_NAIS|CLIENTES_QUE_LIGAM|QUANDO_CLIENTE_INSISTE_EM_LIGAR)|chat|pedido|vit power/i,
        technique: 'Responder educado e voltar ao produto.'
    }
};

const severityRank = { high: 3, medium: 2, low: 1, info: 0 };

const uniqueIssues = (issues) => {
    const seen = new Set();
    return issues
        .sort((a, b) => (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0))
        .filter((issue) => {
            const key = `${issue.kind}:${issue.phone}:${issue.evidence || ''}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
};

const makeIssue = ({
    kind,
    severity = 'medium',
    phone = '',
    chatId = '',
    title,
    detail,
    evidence = '',
    detectedAt = new Date(),
    recommendedAction = 'Conferir conversa no painel e agir manualmente se necessario.'
}) => ({
    id: `${kind}_${digitsOnly(phone || chatId).slice(-12) || 'semfone'}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    kind,
    severity,
    phone: digitsOnly(phone || chatId),
    chatId,
    title,
    detail,
    evidence,
    detectedAt: new Date(detectedAt).toISOString(),
    recommendedAction,
    passive: true,
    readOnly: true
});

const csvEscape = (value) => {
    const raw = String(value ?? '');
    if (!/[",\n\r]/.test(raw)) return raw;
    return `"${raw.replace(/"/g, '""')}"`;
};

const buildCsv = (rows = [], headers = []) => [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(','))
].join('\n');

const writeCsvReport = async ({ kind, rows, headers, generatedAt }) => {
    const dir = perfectSpreadsheetDir();
    await fs.mkdir(dir, { recursive: true });
    const filename = `${kind}.csv`;
    const target = path.join(dir, filename);
    await fs.writeFile(target, buildCsv(rows, headers));
    return {
        kind,
        path: target,
        url: `/api/observation/perfect-funnel-spreadsheet/${kind}?generatedAt=${encodeURIComponent(generatedAt)}`
    };
};

const writeMarkdownReport = async ({ filename, content }) => {
    const dir = perfectSpreadsheetDir();
    await fs.mkdir(dir, { recursive: true });
    const target = path.join(dir, filename);
    await fs.writeFile(target, content);
    return {
        kind: filename.replace(/\.md$/i, ''),
        path: target,
        url: `/api/observation/perfect-funnel-file/${encodeURIComponent(filename)}`
    };
};

const productionPriority = ({ failures = 0, examples = 0, intent = '' }) => {
    const priority = failures * 10 - examples * 2 + (['preco', 'quantidade', 'saude', 'volume_firmeza'].includes(intent) ? 8 : 0);
    if (priority >= 40) return 'alta';
    if (priority >= 18) return 'media';
    return 'baixa';
};

const productionDraftForIntent = ({ intent, failures = [], idea = null }) => {
    const samples = failures.map((item) => item.customerText).filter(Boolean).slice(0, 3);
    const bestReply = idea?.bestReplyText || '';
    const base = {
        intent,
        priority: productionPriority({ failures: failures.length, examples: Number(idea?.examples || 0), intent }),
        failures: failures.length,
        goodExamples: Number(idea?.examples || 0),
        technique: idea?.technique || INTENT_RULES[intent]?.technique || 'Responder a pergunta primeiro e avancar com uma pergunta curta.',
        customerExamples: samples.join(' | '),
        bestCurrentReply: bestReply,
        approvalStatus: 'aguarda_aprovacao',
        implementationRule: 'Nao implantar automaticamente. Revisar, gravar/provar, testar em numero controlado e congelar.'
    };
    const drafts = {
        preco: {
            title: 'Preco / promocao',
            audioScriptEs: 'Senor, le explico claro. Hoy tenemos opciones promocionales de 1, 3 y 6 frascos. El tratamiento mas elegido es el de 3 frascos porque sale mas economico y ayuda a mantener constancia. Le separo 1, 3 o 6 frascos?',
            textScriptEs: 'Hoy tenemos 1 frasco por $39,99, 3 frascos por $95,99 y 6 frascos por $167,99. Cual desea separar: 1, 3 o 6 frascos?',
            imagePromptPt: 'Imagem limpa do frasco Vit Power com tabela discreta de 1, 3 e 6 frascos, visual de farmacia premium, fundo claro, sem promessas medicas, foco em promocao e retirada segura.'
        },
        saude: {
            title: 'Saude / contraindicacao',
            audioScriptEs: 'Senor, le envio la orientacion de la doctora Maria Fernandes sobre composicion natural y uso correcto de Vit Power. Escuche este audio corto y despues le ayudo a escoger el tratamiento adecuado.',
            textScriptEs: 'Le envio la orientacion de la doctora Maria Fernandes sobre Vit Power natural y seguimos paso a paso.',
            imagePromptPt: 'Imagem educativa premium com frasco Vit Power, selo visual 100% natural, linguagem de orientacao, fundo limpo, sem prometer cura.'
        },
        funciona: {
            title: 'Funciona / prova',
            audioScriptEs: 'Si, senor. Vit Power es buscado por hombres que quieren mas confianza, firmeza y mejor desempeno. Le envio una prueba corta y despues me dice si desea empezar con 1, 3 o 6 frascos.',
            textScriptEs: 'Si funciona como apoyo para confianza, firmeza y desempeno. Le envio una prueba y seguimos con la opcion que prefiera.',
            imagePromptPt: 'Prova social discreta estilo WhatsApp, cliente satisfeito, frasco Vit Power visivel, sem exageros, visual realista e confiavel.'
        },
        produto: {
            title: 'Produto / beneficios',
            audioScriptEs: 'Vit Power es un jarabe liquido para hombres que buscan mas energia, firmeza, confianza y mejor desempeno. Le envio el frasco para que lo vea y le explico las opciones.',
            textScriptEs: 'Vit Power es un jarabe liquido para energia, firmeza, confianza y desempeno. Le envio el frasco oficial.',
            imagePromptPt: 'Foto realista premium do frasco Vit Power em destaque, fundo claro, textura de produto original, sem pessoas, pronto para WhatsApp.'
        },
        resultado_uso: {
            title: 'Tempo / como usar',
            audioScriptEs: 'Se toma de forma sencilla, con constancia. Le explico el tiempo de uso y como seguir el tratamiento para aprovecharlo mejor.',
            textScriptEs: 'Se usa con constancia durante el tratamiento. Le envio el audio de uso y tiempo de resultado.',
            imagePromptPt: 'Infografico simples de uso do Vit Power: frasco, rotina diaria, constancia, visual limpo para WhatsApp.'
        },
        volume_firmeza: {
            title: 'Crescimento / firmeza / volume',
            audioScriptEs: 'Si, senor. VIPower esta enfocado justamente en ayudar al hombre con mas firmeza, fuerza, volumen, confianza y mejor desempeno en la intimidad. Le envio este audio y le ayudo a elegir el tratamiento.',
            textScriptEs: 'Si, senor. VIPower ayuda con firmeza, fuerza, volumen, confianza y mejor desempeno. Le envio el audio.',
            imagePromptPt: 'Imagem masculina premium sem nudez, foco em confianca e energia, frasco Vit Power em primeiro plano, estilo discreto e adulto.'
        },
        logistica: {
            title: 'Entrega / agencia',
            audioScriptEs: 'Perfecto, senor. Para ubicar la agencia Servientrega correcta, envieme ciudad y provincia. Con eso le doy las opciones disponibles.',
            textScriptEs: 'Perfecto. Envieme ciudad y provincia para buscar la agencia Servientrega correcta.',
            imagePromptPt: 'Imagem simples de entrega segura por agencia Servientrega, frasco em embalagem discreta, visual de retirada segura.'
        },
        quantidade: {
            title: 'Quantidade escolhida',
            audioScriptEs: 'Perfecto, le separo ese kit. Para generar el envio discreto por Servientrega, confirmeme su nombre completo, ciudad y provincia.',
            textScriptEs: 'Perfecto, le separo ese kit. Confirmeme nombre completo, ciudad y provincia.',
            imagePromptPt: 'Imagem de kits Vit Power 1, 3 e 6 frascos, destaque para kit escolhido, visual limpo e promocional.'
        },
        social_ligacao: {
            title: 'Social / ligacao',
            audioScriptEs: 'Trabajo ayudando a los clientes con sus pedidos de VIPower. Le puedo atender por aqui con mensaje o audio. Para orientarle mejor, busca informacion o desea ver el precio?',
            textScriptEs: 'Le atiendo por aqui con mensaje o audio. Busca informacion o desea ver el precio?',
            imagePromptPt: 'Avatar profissional de atendente Ana López, visual humano, simpatico, consultivo, fundo neutro.'
        }
    };
    return {
        ...base,
        ...(drafts[intent] || {
            title: intent || 'Geral',
            audioScriptEs: 'Le leo, senor. Primero respondo su duda y despues seguimos paso a paso con su pedido.',
            textScriptEs: 'Le leo. Primero respondo su duda y seguimos paso a paso.',
            imagePromptPt: 'Imagem simples e confiavel do produto Vit Power para apoio no atendimento via WhatsApp.'
        })
    };
};

const buildProductionPlan = ({ failures = [], ideas = [], generatedAt = new Date().toISOString(), summary = {} }) => {
    const failuresByIntent = new Map();
    for (const failure of failures) {
        const intent = failure.intent || 'geral';
        const bucket = failuresByIntent.get(intent) || [];
        bucket.push(failure);
        failuresByIntent.set(intent, bucket);
    }
    const ideaByIntent = new Map(ideas.map((idea) => [idea.intent, idea]));
    const intents = [...new Set([...failuresByIntent.keys(), ...ideaByIntent.keys()])];
    const items = intents.map((intent) => productionDraftForIntent({
        intent,
        failures: failuresByIntent.get(intent) || [],
        idea: ideaByIntent.get(intent) || null
    })).sort((a, b) => {
        const rank = { alta: 3, media: 2, baixa: 1 };
        return (rank[b.priority] || 0) - (rank[a.priority] || 0) || b.failures - a.failures;
    });
    const markdown = [
        '# Plano De Producao - Observador Perfeito EC',
        '',
        `Gerado em: ${generatedAt}`,
        '',
        '## Garantia',
        '',
        'Este plano e somente leitura. Nada foi implantado no funil. Cada item precisa de aprovacao, teste e congelamento.',
        '',
        '## Resumo',
        '',
        `- Score observado: ${summary.perfectScore ?? ''}/100`,
        `- Falhas: ${summary.failures ?? 0}`,
        `- Sacadas: ${summary.ideas ?? 0}`,
        `- Uso de audio aprovado: ${summary.approvedAudioUsagePct ?? 0}%`,
        '',
        '## Prioridades De Producao',
        '',
        ...items.flatMap((item, index) => [
            `### ${index + 1}. ${item.title} (${item.intent}) - prioridade ${item.priority}`,
            '',
            `Falhas observadas: ${item.failures}`,
            `Boas referencias: ${item.goodExamples}`,
            `Tecnica: ${item.technique}`,
            '',
            '**Texto para gravar audio (ES):**',
            '',
            item.audioScriptEs,
            '',
            '**Texto curto para WhatsApp (ES):**',
            '',
            item.textScriptEs,
            '',
            '**Prompt de imagem (PT):**',
            '',
            item.imagePromptPt,
            '',
            item.customerExamples ? `Exemplos de cliente: ${item.customerExamples}` : '',
            '',
            '---',
            ''
        ])
    ].join('\n');
    return { items, markdown };
};

const outboundSignalText = (message = {}) => [
    message.body,
    message.transcriptionText,
    message.mediaUrl,
    message.type ? `[TYPE] ${message.type}` : ''
].filter(Boolean).join('\n');

const hasAudioForIntent = (replyText = '', rule = {}) => {
    const normalized = normalizeText(replyText);
    return (rule.requiredAudio || []).some((audio) => normalized.includes(normalizeText(audio)));
};

const responseCoversIntent = ({ intent, replyText }) => {
    if (!intent) return true;
    const rule = INTENT_RULES[intent];
    if (!rule) return true;
    return rule.mustMention.test(replyText || '') || hasAudioForIntent(replyText, rule);
};

const customerAdvancedAfterReply = ({ phoneMessages, reply }) => {
    if (!reply) return false;
    const replyAt = messageAt(reply).getTime();
    const nextInbound = phoneMessages.find((message) => isClientMessage(message) && messageAt(message).getTime() > replyAt);
    if (!nextInbound) return false;
    const text = normalizeText(`${nextInbound.body || ''} ${nextInbound.transcriptionText || ''}`);
    return /\b(si|correcto|confirmo|quiero|listo|ok|okay|agencia|servientrega|nombre|telefono|ciudad|provincia|direccion|1|3|6)\b/.test(text);
};

const makePerfectFinding = ({
    kind,
    severity = 'medium',
    phone = '',
    chatId = '',
    intent = '',
    stage = '',
    customerText = '',
    replyText = '',
    title = '',
    detail = '',
    recommendation = '',
    detectedAt = new Date()
}) => ({
    id: `${kind}_${digitsOnly(phone || chatId).slice(-12) || 'semfone'}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    kind,
    severity,
    phone: digitsOnly(phone || chatId),
    chatId,
    intent,
    stage,
    customerText: String(customerText || '').slice(0, 500),
    replyText: String(replyText || '').slice(0, 500),
    title,
    detail,
    recommendation,
    detectedAt: new Date(detectedAt).toISOString(),
    passive: true,
    readOnly: true
});

export const scanPassiveFunnelObserver = async ({
    country = 'EC',
    lookbackMinutes = Number(process.env.PASSIVE_FUNNEL_OBSERVER_LOOKBACK_MINUTES || 45),
    limit = Number(process.env.PASSIVE_FUNNEL_OBSERVER_LIMIT || 240)
} = {}) => {
    const safeLookback = Math.max(5, Math.min(Number(lookbackMinutes) || 45, 24 * 60));
    const safeLimit = Math.max(30, Math.min(Number(limit) || 240, 1000));
    const now = new Date();
    const since = new Date(now.getTime() - safeLookback * 60 * 1000);

    const messages = await Message.find({ createdAt: { $gte: since } })
        .sort({ createdAt: 1 })
        .limit(safeLimit)
        .lean();

    const relevantMessages = messages.filter((message) => matchesCountry(phoneFromMessage(message), country));
    const byPhone = new Map();
    for (const message of relevantMessages) {
        const phone = phoneFromMessage(message);
        if (!phone) continue;
        const bucket = byPhone.get(phone) || [];
        bucket.push(message);
        byPhone.set(phone, bucket);
    }

    const phoneDigits = [...byPhone.keys()].map(digitsOnly).filter(Boolean);
    const statePhoneClauses = phoneDigits.flatMap((phone) => [
        { phoneDigits: phone },
        { chatId: `${phone}@c.us` },
        { chatId: `${phone}@s.whatsapp.net` },
        { 'metadata.customerPhoneDigits': phone }
    ]);
    const states = await ContactState.find({
        countryCode: String(country || 'EC').toUpperCase(),
        $or: [
            { updatedAt: { $gte: since } },
            ...statePhoneClauses
        ]
    })
        .sort({ updatedAt: -1 })
        .limit(300)
        .select('chatId phoneDigits human metadata lastInboundAt lastOutboundAt updatedAt')
        .lean();

    const stateByPhone = new Map();
    for (const state of states) {
        const phone = digitsOnly(state.phoneDigits || state.chatId);
        if (!phone) continue;
        stateByPhone.set(phone, state);
    }

    const issues = [];
    const responseTimes = [];
    let pendingWithoutResponse = 0;

    for (const [phone, phoneMessages] of byPhone.entries()) {
        const state = stateByPhone.get(digitsOnly(phone)) || stateByPhone.get(phone);
        if (isWarmupOrSafeManualContact(state) || hasWarmupMarkerMessage(phoneMessages)) continue;

        const inbound = phoneMessages.filter(isClientMessage);
        const outbound = phoneMessages.filter(isAgentMessage);
        const failedOutbound = outbound.filter((message) => {
            const statusText = normalizeText(`${message.deliveryStatus || ''} ${message.providerStatus || ''} ${message.sendError || ''}`);
            return /failed|falha|erro|sem confirmacao|undelivered/.test(statusText);
        });

        for (const failed of failedOutbound.slice(-3)) {
            issues.push(makeIssue({
                kind: 'send_failed',
                severity: 'high',
                phone,
                chatId: failed.chatId,
                title: 'Falha de envio detectada',
                detail: 'Existe mensagem do painel marcada como falha, sem confirmacao ou erro de envio.',
                evidence: String(failed.body || failed.mediaUrl || failed._id || '').slice(0, 180),
                detectedAt: messageAt(failed),
                recommendedAction: 'Abrir o cliente no painel, reenviar manualmente se necessario e verificar Z-API/numero conectado.'
            }));
        }

        for (const alert of phoneMessages.filter((message) => /^ALERTA: o WhatsApp conectado/i.test(String(message.body || '')))) {
            issues.push(makeIssue({
                kind: 'zapi_panel_alert',
                severity: 'medium',
                phone,
                chatId: alert.chatId,
                title: 'Alerta de espelho Z-API apareceu na conversa',
                detail: 'O painel registrou alerta de interacao nova sem conteudo entregue pela Z-API.',
                evidence: String(alert.body || '').slice(0, 220),
                detectedAt: messageAt(alert),
                recommendedAction: 'Conferir se foi falso positivo. Se houver mensagem real no celular que nao apareceu no painel, pedir repeticao e revisar webhook.'
            }));
        }

        const latestInbound = inbound.at(-1);
        if (!latestInbound) continue;

        const nextOutbound = outbound.find((message) => messageAt(message).getTime() > messageAt(latestInbound).getTime());
        const ageSeconds = Math.round((now.getTime() - messageAt(latestInbound).getTime()) / 1000);
        const intent = inboundIntent(`${latestInbound.body || ''} ${latestInbound.transcriptionText || ''}`);
        const stateLastOutboundAt = state?.lastOutboundAt
            || state?.metadata?.perAgentMemory?.vit_power_ec?.lastOutboundAt
            || state?.metadata?.lastCheckoutOrderDataAt;
        const stateRespondedAfterInbound = stateLastOutboundAt
            && new Date(stateLastOutboundAt).getTime() >= messageAt(latestInbound).getTime();
        const isPanelPrefill = /vsl_entry|panel_prefill/i.test(`${latestInbound.provider || ''} ${latestInbound.providerStatus || ''}`);
        const hasNearbyPreviousOutbound = isPanelPrefill && outbound.some((message) => {
            const diff = Math.abs(messageAt(latestInbound).getTime() - messageAt(message).getTime());
            return diff <= 2 * 60 * 1000;
        });

        if (nextOutbound || stateRespondedAfterInbound || hasNearbyPreviousOutbound) {
            if (!nextOutbound) continue;
            const responseSeconds = secondsBetween(latestInbound, nextOutbound);
            responseTimes.push(responseSeconds);
            if (responseSeconds > 120) {
                issues.push(makeIssue({
                    kind: 'slow_response',
                    severity: responseSeconds > 240 ? 'high' : 'medium',
                    phone,
                    chatId: latestInbound.chatId,
                    title: 'Resposta lenta apos cliente',
                    detail: `Cliente aguardou aproximadamente ${responseSeconds}s ate a proxima resposta do painel.`,
                    evidence: String(latestInbound.body || latestInbound.transcriptionText || latestInbound._id || '').slice(0, 180),
                    detectedAt: messageAt(latestInbound),
                    recommendedAction: 'Verificar fila humanizada, estado do cliente e se ha pausa manual indevida.'
                }));
            }
        } else if (ageSeconds > 75) {
            pendingWithoutResponse += 1;
            issues.push(makeIssue({
                kind: intent ? 'question_unanswered' : 'inbound_without_response',
                severity: ageSeconds > 180 ? 'high' : 'medium',
                phone,
                chatId: latestInbound.chatId,
                title: intent ? `Pergunta de ${intent} sem resposta` : 'Cliente sem resposta do painel',
                detail: `Ultima mensagem do cliente esta ha ${ageSeconds}s sem resposta registrada depois dela.`,
                evidence: String(latestInbound.body || latestInbound.transcriptionText || latestInbound._id || '').slice(0, 180),
                detectedAt: messageAt(latestInbound),
                recommendedAction: 'Abrir o cliente no painel. Se estiver em manual por engano, liberar para auto; se for atendimento real, responder manualmente.'
            }));
        }
    }

    for (const state of states) {
        const phone = state.phoneDigits || state.chatId;
        if (!matchesCountry(phone, country)) continue;
        if (isWarmupOrSafeManualContact(state)) continue;
        const phoneKey = digitsOnly(phone);
        const phoneMessages = byPhone.get(phoneKey) || [];
        if (hasWarmupMarkerMessage(phoneMessages)) continue;
        const inbound = phoneMessages.filter(isClientMessage);
        const latestInbound = inbound.at(-1);
        if (!latestInbound) continue;
        const outbound = phoneMessages.filter(isAgentMessage);
        const nextOutbound = outbound.find((message) => messageAt(message).getTime() > messageAt(latestInbound).getTime());
        const stateLastOutboundAt = state?.lastOutboundAt
            || state?.metadata?.perAgentMemory?.vit_power_ec?.lastOutboundAt
            || state?.metadata?.lastCheckoutOrderDataAt;
        const stateRespondedAfterInbound = stateLastOutboundAt
            && new Date(stateLastOutboundAt).getTime() >= messageAt(latestInbound).getTime();
        if (nextOutbound || stateRespondedAfterInbound) continue;
        const lastManualBy = String(state.human?.lastManualBy || '').toLowerCase();
        const note = String(state.human?.note || '').toLowerCase();
        const suspiciousManual = state.human?.mode === 'manual'
            && /(vsl|watchdog|reconciliacao|reconcile|auto)/i.test(`${lastManualBy} ${note}`);
        if (suspiciousManual) {
            issues.push(makeIssue({
                kind: 'auto_hold_risk',
                severity: 'high',
                phone,
                chatId: state.chatId,
                title: 'Risco de lead preso em manual automatico',
                detail: 'Contato recente esta em modo manual por origem automatica, o que pode impedir o bot de responder.',
                evidence: `lastManualBy=${state.human?.lastManualBy || ''}; note=${state.human?.note || ''}`,
                detectedAt: state.updatedAt,
                recommendedAction: 'Confirmar se houve atendimento humano real. Se nao houve, voltar o cliente para auto.'
            }));
        }
    }

    const finalIssues = uniqueIssues(issues).slice(0, 80);
    const avgResponse = responseTimes.length
        ? Math.round(responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length)
        : null;
    const maxResponse = responseTimes.length ? Math.max(...responseTimes) : null;

    return {
        ok: true,
        mode: 'passive_read_only',
        generatedAt: now.toISOString(),
        country: String(country || 'EC').toUpperCase(),
        lookbackMinutes: safeLookback,
        readOnlyGuarantee: 'Nao envia mensagem, nao altera contato, nao cria pedido, nao envia Dropi.',
        summary: {
            scannedMessages: relevantMessages.length,
            scannedPhones: byPhone.size,
            issues: finalIssues.length,
            high: finalIssues.filter((item) => item.severity === 'high').length,
            medium: finalIssues.filter((item) => item.severity === 'medium').length,
            low: finalIssues.filter((item) => item.severity === 'low').length,
            pendingWithoutResponse,
            avgFirstResponseSec: avgResponse,
            maxFirstResponseSec: maxResponse
        },
        items: finalIssues
    };
};

export const scanPerfectFunnelObserver = async ({
    country = 'EC',
    lookbackHours = Number(process.env.PERFECT_FUNNEL_OBSERVER_LOOKBACK_HOURS || 24),
    limit = Number(process.env.PERFECT_FUNNEL_OBSERVER_LIMIT || 600)
} = {}) => {
    const safeLookback = Math.max(1, Math.min(Number(lookbackHours) || 24, 14 * 24));
    const safeLimit = Math.max(60, Math.min(Number(limit) || 600, 3000));
    const now = new Date();
    const since = new Date(now.getTime() - safeLookback * 60 * 60 * 1000);

    const messages = await Message.find({ createdAt: { $gte: since } })
        .sort({ createdAt: 1 })
        .limit(safeLimit)
        .lean();
    const relevantMessages = messages.filter((message) => matchesCountry(phoneFromMessage(message), country));
    const byPhone = new Map();
    for (const message of relevantMessages) {
        const phone = phoneFromMessage(message);
        if (!phone) continue;
        const bucket = byPhone.get(phone) || [];
        bucket.push(message);
        byPhone.set(phone, bucket);
    }

    const phones = [...byPhone.keys()].map(digitsOnly).filter(Boolean);
    const states = await ContactState.find({
        countryCode: String(country || 'EC').toUpperCase(),
        $or: phones.flatMap((phone) => [
            { phoneDigits: phone },
            { chatId: `${phone}@c.us` },
            { chatId: `${phone}@s.whatsapp.net` },
            { 'metadata.customerPhoneDigits': phone }
        ])
    })
        .select('chatId phoneDigits human metadata lastInboundAt lastOutboundAt updatedAt')
        .lean();
    const stateByPhone = new Map(states.map((state) => [digitsOnly(state.phoneDigits || state.chatId), state]));

    const failures = [];
    const wins = [];
    const attendances = [];
    const ideasByKey = new Map();
    const responseTimes = [];
    let evaluatedTurns = 0;
    let answeredTurns = 0;
    let audioExpectedTurns = 0;
    let audioUsedTurns = 0;

    for (const [phone, phoneMessages] of byPhone.entries()) {
        const state = stateByPhone.get(digitsOnly(phone));
        const memory = state?.metadata?.perAgentMemory?.vit_power_ec || {};
        const stage = String(memory.principalSdrStage || memory.lastFunnelStage || memory.conversationState?.stage || '');
        const inboundMessages = phoneMessages.filter(isClientMessage);
        const outboundMessages = phoneMessages.filter(isAgentMessage);

        for (const inbound of inboundMessages) {
            const customerText = `${inbound.body || ''} ${inbound.transcriptionText || ''}`.trim();
            if (!customerText || /^\[(sticker|reaction)\]$/i.test(customerText)) continue;
            const intent = inboundIntent(customerText);
            if (!intent) continue;
            evaluatedTurns += 1;
            const inboundAt = messageAt(inbound).getTime();
            const reply = outboundMessages.find((message) => messageAt(message).getTime() > inboundAt);
            const replyText = outboundSignalText(reply || {});
            const rule = INTENT_RULES[intent] || {};
            if (rule.requiredAudio?.length) audioExpectedTurns += 1;
            if (hasAudioForIntent(replyText, rule)) audioUsedTurns += 1;

            if (!reply) {
                failures.push(makePerfectFinding({
                    kind: 'sem_resposta_para_intencao',
                    severity: 'high',
                    phone,
                    chatId: inbound.chatId,
                    intent,
                    stage,
                    customerText,
                    title: `Cliente perguntou ${intent} e nao houve resposta posterior`,
                    detail: 'O observador nao encontrou mensagem do painel/bot depois da pergunta.',
                    recommendation: 'Responder manualmente e revisar se o estado estava preso em manual ou se faltou gatilho.',
                    detectedAt: messageAt(inbound)
                }));
                continue;
            }

            const responseSec = secondsBetween(inbound, reply);
            responseTimes.push(responseSec);
            const covered = responseCoversIntent({ intent, replyText });
            const usedAudio = hasAudioForIntent(replyText, rule);
            const advanced = customerAdvancedAfterReply({ phoneMessages, reply });
            const attendanceScore = Math.max(0, Math.min(100,
                100
                - (responseSec > 120 ? 20 : responseSec > 60 ? 10 : 0)
                - (!covered ? 35 : 0)
                - (rule.requiredAudio?.length && !usedAudio ? 20 : 0)
                + (advanced ? 8 : 0)
            ));

            attendances.push({
                phone,
                chatId: inbound.chatId,
                intent,
                stage,
                responseSec,
                score: attendanceScore,
                usedAudio: usedAudio ? 'sim' : 'nao',
                advanced: advanced ? 'sim' : 'nao',
                customerText: String(customerText).slice(0, 220),
                replyText: String(replyText).slice(0, 220),
                at: messageAt(inbound).toISOString()
            });

            if (covered) answeredTurns += 1;

            if (!covered) {
                failures.push(makePerfectFinding({
                    kind: 'resposta_nao_cobriu_intencao',
                    severity: 'high',
                    phone,
                    chatId: inbound.chatId,
                    intent,
                    stage,
                    customerText,
                    replyText,
                    title: `Resposta possivelmente nao respondeu ${intent}`,
                    detail: 'O cliente fez uma pergunta classificada, mas a resposta nao trouxe o audio/texto esperado para essa intencao.',
                    recommendation: `Usar regra aprovada: ${rule.technique || 'responder a pergunta antes de avancar.'}`,
                    detectedAt: messageAt(inbound)
                }));
            }

            if (rule.requiredAudio?.length && !usedAudio) {
                failures.push(makePerfectFinding({
                    kind: 'audio_aprovado_nao_usado',
                    severity: 'medium',
                    phone,
                    chatId: inbound.chatId,
                    intent,
                    stage,
                    customerText,
                    replyText,
                    title: `Audio aprovado nao apareceu em ${intent}`,
                    detail: `Esperado um destes: ${(rule.requiredAudio || []).join(', ')}.`,
                    recommendation: 'Revisar mapa de audios/gatilho antes de alterar o funil.',
                    detectedAt: messageAt(reply)
                }));
            }

            if (responseSec > 120) {
                failures.push(makePerfectFinding({
                    kind: 'resposta_lenta',
                    severity: responseSec > 240 ? 'high' : 'medium',
                    phone,
                    chatId: inbound.chatId,
                    intent,
                    stage,
                    customerText,
                    replyText,
                    title: `Resposta lenta: ${responseSec}s`,
                    detail: 'Tempo acima do alvo comercial para atendimento vivo.',
                    recommendation: 'Verificar fila, pacing, webhook e pausa manual.',
                    detectedAt: messageAt(reply)
                }));
            }

            if (covered && (usedAudio || !rule.requiredAudio?.length) && responseSec <= 120) {
                const technique = rule.technique || 'Resposta direta com avanco.';
                wins.push(makePerfectFinding({
                    kind: 'boa_resposta',
                    severity: 'info',
                    phone,
                    chatId: inbound.chatId,
                    intent,
                    stage,
                    customerText,
                    replyText,
                    title: `Boa resposta para ${intent}`,
                    detail: advanced ? 'Cliente respondeu/avancou depois da resposta.' : 'Resposta cobriu a intencao dentro do tempo alvo.',
                    recommendation: technique,
                    detectedAt: messageAt(reply)
                }));
                const key = `${intent}:${technique}`;
                const previous = ideasByKey.get(key) || {
                    intent,
                    technique,
                    examples: 0,
                    bestCustomerText: '',
                    bestReplyText: '',
                    recommendation: `Manter como padrao aprovado para ${intent}: ${technique}`
                };
                previous.examples += 1;
                if (!previous.bestReplyText || attendanceScore > Number(previous.score || 0)) {
                    previous.score = attendanceScore;
                    previous.bestCustomerText = String(customerText).slice(0, 300);
                    previous.bestReplyText = String(replyText).slice(0, 300);
                }
                ideasByKey.set(key, previous);
            }
        }
    }

    const avgResponse = responseTimes.length
        ? Math.round(responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length)
        : null;
    const avgScore = attendances.length
        ? Math.round(attendances.reduce((sum, item) => sum + Number(item.score || 0), 0) / attendances.length)
        : null;
    const coveragePct = evaluatedTurns ? Math.round((answeredTurns / evaluatedTurns) * 100) : 100;
    const audioPct = audioExpectedTurns ? Math.round((audioUsedTurns / audioExpectedTurns) * 100) : 100;
    const perfectScore = Math.max(0, Math.min(100, Math.round(
        (avgScore ?? 100) * 0.45
        + coveragePct * 0.35
        + audioPct * 0.20
    )));
    const ideas = [...ideasByKey.values()]
        .sort((a, b) => (b.examples - a.examples) || (Number(b.score || 0) - Number(a.score || 0)))
        .slice(0, 30);

    const generatedAt = now.toISOString();
    const failureRows = failures.slice(0, 200).map((item) => ({
        data: item.detectedAt,
        telefone: item.phone,
        etapa: item.stage,
        intencao: item.intent,
        severidade: item.severity,
        falha: item.title,
        cliente: item.customerText,
        resposta: item.replyText,
        recomendacao: item.recommendation
    }));
    const attendanceRows = attendances.slice(-500).map((item) => ({
        data: item.at,
        telefone: item.phone,
        etapa: item.stage,
        intencao: item.intent,
        nota: item.score,
        tempo_resposta_seg: item.responseSec,
        audio_usado: item.usedAudio,
        avancou: item.advanced,
        cliente: item.customerText,
        resposta: item.replyText
    }));
    const ideaRows = ideas.map((item) => ({
        intencao: item.intent,
        tecnica: item.technique,
        exemplos: item.examples,
        nota: item.score || '',
        cliente_exemplo: item.bestCustomerText,
        resposta_exemplo: item.bestReplyText,
        recomendacao: item.recommendation
    }));
    const summaryForProduction = {
        perfectScore,
        failures: failures.length,
        ideas: ideas.length,
        approvedAudioUsagePct: audioPct
    };
    const productionPlan = buildProductionPlan({
        failures,
        ideas,
        generatedAt,
        summary: summaryForProduction
    });
    const productionRows = productionPlan.items.map((item) => ({
        prioridade: item.priority,
        intencao: item.intent,
        titulo: item.title,
        falhas: item.failures,
        bons_exemplos: item.goodExamples,
        tecnica: item.technique,
        texto_audio_es: item.audioScriptEs,
        texto_whatsapp_es: item.textScriptEs,
        prompt_imagem_pt: item.imagePromptPt,
        exemplos_cliente: item.customerExamples,
        status: item.approvalStatus,
        regra_implantacao: item.implementationRule
    }));
    const spreadsheets = await Promise.all([
        writeCsvReport({ kind: 'falhas', rows: failureRows, headers: ['data', 'telefone', 'etapa', 'intencao', 'severidade', 'falha', 'cliente', 'resposta', 'recomendacao'], generatedAt }),
        writeCsvReport({ kind: 'atendimentos', rows: attendanceRows, headers: ['data', 'telefone', 'etapa', 'intencao', 'nota', 'tempo_resposta_seg', 'audio_usado', 'avancou', 'cliente', 'resposta'], generatedAt }),
        writeCsvReport({ kind: 'sacadas', rows: ideaRows, headers: ['intencao', 'tecnica', 'exemplos', 'nota', 'cliente_exemplo', 'resposta_exemplo', 'recomendacao'], generatedAt }),
        writeCsvReport({ kind: 'producao', rows: productionRows, headers: ['prioridade', 'intencao', 'titulo', 'falhas', 'bons_exemplos', 'tecnica', 'texto_audio_es', 'texto_whatsapp_es', 'prompt_imagem_pt', 'exemplos_cliente', 'status', 'regra_implantacao'], generatedAt }),
        writeMarkdownReport({ filename: 'plano-producao-funil-perfeito.md', content: productionPlan.markdown })
    ]);

    return {
        ok: true,
        mode: 'perfect_observer_passive_read_only',
        generatedAt,
        country: String(country || 'EC').toUpperCase(),
        lookbackHours: safeLookback,
        readOnlyGuarantee: 'Nao envia mensagem, nao altera contato, nao muda prompt, nao cria pedido, nao envia Dropi.',
        summary: {
            perfectScore,
            scannedMessages: relevantMessages.length,
            scannedPhones: byPhone.size,
            evaluatedTurns,
            failures: failures.length,
            wins: wins.length,
            ideas: ideas.length,
            avgResponseSec: avgResponse,
            avgAttendanceScore: avgScore,
            intentCoveragePct: coveragePct,
            approvedAudioUsagePct: audioPct
        },
        failures: failures.slice(0, 100),
        wins: wins.slice(0, 100),
        ideas,
        productionPlan: productionPlan.items,
        attendances: attendances.slice(-200),
        spreadsheets
    };
};

export const writePassiveFunnelObserverReport = async (report) => {
    const target = reportPath();
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, JSON.stringify(report, null, 2));
    return target;
};

export const readPassiveFunnelObserverReport = async () => {
    try {
        const content = await fs.readFile(reportPath(), 'utf8');
        return JSON.parse(content);
    } catch (_error) {
        return null;
    }
};

export const writePerfectFunnelObserverReport = async (report) => {
    const target = perfectReportPath();
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, JSON.stringify(report, null, 2));
    return target;
};

export const readPerfectFunnelObserverReport = async () => {
    try {
        const content = await fs.readFile(perfectReportPath(), 'utf8');
        return JSON.parse(content);
    } catch (_error) {
        return null;
    }
};

export const readPerfectFunnelSpreadsheet = async (kind = '') => {
    const safeKind = String(kind || '').toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!['falhas', 'atendimentos', 'sacadas', 'producao'].includes(safeKind)) return null;
    const target = path.join(perfectSpreadsheetDir(), `${safeKind}.csv`);
    try {
        return await fs.readFile(target, 'utf8');
    } catch (_error) {
        return null;
    }
};

export const readPerfectFunnelFile = async (filename = '') => {
    const safeName = String(filename || '').replace(/[^a-z0-9_.-]/gi, '');
    if (!['plano-producao-funil-perfeito.md'].includes(safeName)) return null;
    try {
        return await fs.readFile(path.join(perfectSpreadsheetDir(), safeName), 'utf8');
    } catch (_error) {
        return null;
    }
};

export const processPassiveFunnelObserver = async () => {
    const report = await scanPassiveFunnelObserver();
    const target = await writePassiveFunnelObserverReport(report);
    if (String(process.env.PERFECT_FUNNEL_OBSERVER_ENABLED || 'true').toLowerCase() !== 'false') {
        scanPerfectFunnelObserver()
            .then((perfectReport) => writePerfectFunnelObserverReport(perfectReport)
                .then((perfectTarget) => {
                    const perfectSummary = perfectReport.summary || {};
                    console.log(`[PERFECT_FUNNEL_OBSERVER] score=${perfectSummary.perfectScore}; failures=${perfectSummary.failures}; wins=${perfectSummary.wins}; report=${perfectTarget}`);
                }))
            .catch((error) => {
                console.warn('[PERFECT_FUNNEL_OBSERVER] falha passiva:', error?.message || error);
            });
    }
    const summary = report.summary || {};
    if (summary.high || summary.medium) {
        console.warn(`[PASSIVE_FUNNEL_OBSERVER] issues=${summary.issues}; high=${summary.high}; medium=${summary.medium}; phones=${summary.scannedPhones}; report=${target}`);
    } else {
        console.log(`[PASSIVE_FUNNEL_OBSERVER] ok; phones=${summary.scannedPhones}; messages=${summary.scannedMessages}; report=${target}`);
    }
    return report;
};
