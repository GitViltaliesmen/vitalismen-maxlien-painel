import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Message from '../src/models/Message.js';
import ContactState from '../src/models/ContactState.js';
import Order from '../src/models/Order.js';

dotenv.config();

const repoRoot = process.cwd();
const today = new Date().toISOString().slice(0, 10);

const args = process.argv.slice(2);
const argValue = (name, fallback = '') => {
    const prefix = `--${name}=`;
    const found = args.find((arg) => arg.startsWith(prefix));
    return found ? found.slice(prefix.length) : fallback;
};

const waitMinutes = Math.max(1, Number.parseInt(argValue('minutes', process.env.UNANSWERED_REVIEW_MINUTES || '2'), 10) || 2);
const hotMinutes = Math.max(1, Number.parseInt(argValue('hot-minutes', process.env.UNANSWERED_REVIEW_HOT_MINUTES || '2'), 10) || 2);
const limit = Math.max(1, Number.parseInt(argValue('limit', process.env.UNANSWERED_REVIEW_LIMIT || '46'), 10) || 46);
const outDir = path.resolve(argValue('out-dir', 'docs'));
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/vitalismen_automacao';
const firstResponseSlaSeconds = Math.max(10, Number.parseInt(argValue('first-response-sla-seconds', process.env.WHATSAPP_FIRST_RESPONSE_ALERT_AFTER_SECONDS || '119'), 10) || 119);

const digitsOnly = (value = '') => String(value || '').replace(/\D/g, '');
const normalize = (value = '') => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const messageTime = (message = {}) => {
    if (message.createdAt) return new Date(message.createdAt);
    if (message.timestamp) return new Date(Number(message.timestamp) * 1000);
    return new Date(0);
};

const firstPhoneTail = (...values) => {
    const digits = values.map(digitsOnly).find((item) => item.length >= 8) || '';
    return digits.length >= 10 ? digits.slice(-10) : digits;
};

const compactText = (value = '', max = 220) => String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

const classifyUnanswered = ({ message, contactState, latestOrder }) => {
    const body = normalize(message.body || '');
    const stage = normalize(
        contactState?.metadata?.lastKnownFunnelStage
        || contactState?.metadata?.perAgentMemory?.vit_power_ec?.lastFunnelStage
        || contactState?.metadata?.perAgentMemory?.vit_power_ec?.principalSdrStage
        || ''
    );
    const type = String(message.type || '').toLowerCase();
    const raw = String(message.body || '').trim();
    const hasText = Boolean(raw);
    const awaitingName = /\b(awaiting_customer_name|sdr_awaiting_name|name)\b/i.test(stage);

    if (/\b(videollamada|video llamada|podemos conversar|conversar un ratito|aburrid[ao]?|mi amor|bb|beb[eé]|hermosa|hermoso|bonita|cari[nñ]o|hola amor|como estas hermosa|c[oó]mo est[aá] hermosa)\b/i.test(body)) {
        return {
            problem: 'fora_do_funil_social_ou_spam',
            severity: 'baixa',
            solution: 'Nao tratar como dado do pedido. Responder apenas se fizer sentido operacional, redirecionando para Vit Power, ou deixar para humano se for numero fora de campanha.',
            suggestedReply: 'Hola. Este canal es para atención de Vit Power. Si necesita información del producto, precio, agencia o pedido, escríbame por aquí.'
        };
    }

    if (
        /\b(vi|vengo|llegue|llegué|termine|terminé|acabo de ver)\b.*\b(video|dra|doctora|presentacion|presentación)\b/i.test(body)
        && !/\b(precio|presio|valor|promo|promocion|promoción|frasco|frascos|botella|botellas|jarabe)\b/i.test(body)
    ) {
        return {
            problem: 'entrada_vsl_sem_preco',
            severity: 'media',
            solution: 'Iniciar entrada oficial sem preco: saudacao por horario, prova social e imagem do produto. Se mencionar promo/frasco, responder por intencao de preco/quantidade depois da entrada.',
            suggestedReply: 'Hola, señor. Ya vi que viene del video. Le atiendo por aquí con Vit Power y le muestro la información paso a paso.'
        };
    }

    if ((type === 'audio' || type === 'ptt') && !hasText) {
        return {
            problem: 'audio_sem_transcricao',
            severity: 'alta',
            solution: 'Responder acusando recebimento e pedir que o cliente escreva em uma frase se a duvida e sobre preco, como tomar, agencia ou pedido.',
            suggestedReply: '👍 Recibi su audio, señor. Para ayudarle sin error, escríbame en una frase si su duda es sobre precio, cómo tomar, agencia o pedido.'
        };
    }

    if (['image', 'video', 'document', 'sticker'].includes(type) && !hasText) {
        return {
            problem: 'midia_sem_legenda',
            severity: 'media',
            solution: 'Responder sinal curto, pedir contexto e nao reiniciar o funil antes de entender a intencao.',
            suggestedReply: '👍 Vi lo que me envió, señor. Para ayudarle sin error, escríbame si es sobre precio, agencia, pedido o cómo tomar.'
        };
    }

    if (/^https?:\/\/\S+$/i.test(raw) || /\bhttps?:\/\/|www\./i.test(raw)) {
        if (/\btiktok\.com\/\S+|\bvt\.tiktok\.com\/\S+|\bfacebook\.com\/\S+|\binstagram\.com\/\S+/i.test(raw)) {
            return {
                problem: 'link_social_organico',
                severity: 'baixa',
                solution: 'Responder fora do plano de vendas com joinha/recebido, sem puxar oferta, para manter conversa organica e humana.',
                suggestedReply: '👍 Lo vi, gracias por compartirlo.'
            };
        }
        return {
            problem: 'link_sem_contexto',
            severity: 'media',
            solution: 'Acusar que viu o link e pedir o objetivo do cliente; se for comprovante/guia, encaminhar para pos-venda.',
            suggestedReply: '👍 Ya vi el enlace, señor. Me escribe por favor si es sobre su pedido, agencia, precio o una duda del producto?'
        };
    }

    if (/\b(precio|presio|valor|cuanto|cuanto cuesta|promo|promocion|promoción)\b/i.test(body)) {
        return {
            problem: 'pergunta_preco_promocao',
            severity: 'alta',
            solution: 'Responder direto com preco oficial 1/3/6, enviar audio de tratamento/precos se ainda nao foi enviado e fechar perguntando quantidade.',
            suggestedReply: 'Le confirmo, señor: 1 botella por 39 USD, 3 botellas por 95.99 USD y 6 botellas por 167.99 USD. ¿Cuál desea reservar?'
        };
    }

    if (/\b(1|3|6|un|uno|una|tres|seis)\b.*\b(frasco|frascos|botella|botellas)\b|\b(quiero|deseo|deme|mande|envie|envíe)\b.*\b(1|3|6|un|uno|una|tres|seis)\b/i.test(body)) {
        return {
            problem: 'quantidade_escolhida_sem_continuacao',
            severity: 'alta',
            solution: 'Confirmar quantidade e valor oficial, gravar etapa de confirmacao de valor e depois perguntar agencia Servientrega.',
            suggestedReply: 'Perfecto, señor. Le separo esa cantidad con el valor oficial. ¿Está bien para usted continuar con el envío por agencia Servientrega?'
        };
    }

    if (/\b(agencia|servientrega|servi entrega|serentrega|retiro|retirar|oficina|urdesa|central|ciudad|provincia|mall|fortin|fortín)\b/i.test(body)) {
        return {
            problem: 'intencao_agencia_logistica',
            severity: 'alta',
            solution: 'Usar agencia_LISTA; se houver cidade/setor como Urdesa central, buscar e sugerir a agencia oficial. Se faltar cidade/provincia, pedir esses dados.',
            suggestedReply: 'Perfecto. Para no equivocarme con Servientrega, me confirma ciudad y provincia o el sector de la agencia donde desea retirar?'
        };
    }

    if (/\b(domicilio|casa|direccion|dirección|barrio|sector|referencia|calle|avenida|av)\b/i.test(body)) {
        return {
            problem: 'dados_domicilio_ou_endereco',
            severity: 'media',
            solution: 'Extrair cidade/provincia/endereco/referencia, atualizar rascunho e pedir somente o dado faltante.',
            suggestedReply: 'Gracias, señor. Para dejar la entrega sin error, me confirma ciudad, provincia, dirección completa y un punto de referencia?'
        };
    }

    if (/\b(que se trata|de que se trata|sobre que|sobre de|informacion|información|producto|jarabe)\b/i.test(body)) {
        return {
            problem: 'duvida_produto_geral',
            severity: 'media',
            solution: 'Responder o que e Vit Power em texto curto, sem inventar cura, e voltar para preco/quantidade se o cliente demonstrar compra.',
            suggestedReply: 'Vit Power es un producto natural en jarabe para apoyo masculino. Le puedo explicar precio, cómo tomar o envío por agencia. ¿Qué desea saber primero?'
        };
    }

    if (/\b(nombre|apellido|me llamo|mi nombre|soy)\b/i.test(body) || (awaitingName && raw.split(/\s+/).length >= 2 && raw.length <= 80 && !/\d/.test(raw))) {
        return {
            problem: 'nome_ou_dado_cliente',
            severity: 'media',
            solution: 'Salvar nome se a etapa pede nome; se nao, retomar a etapa pendente sem repetir o funil inicial.',
            suggestedReply: 'Perfecto, ya tengo su nombre. Ahora seguimos con el dato que falta para dejar el pedido sin error.'
        };
    }

    if (/\b(si|sí|ok|correcto|listo|de acuerdo|confirmo|confirmado|proceda|mande nomas|envie nomas)\b/i.test(body)) {
        return {
            problem: 'confirmacao_sem_acao',
            severity: 'alta',
            solution: stage.includes('final') || stage.includes('confirmation')
                ? 'Finalizar pedido na etapa correta; se a etapa nao for final, retomar pergunta pendente para evitar fechamento errado.'
                : 'Interpretar como confirmacao contextual e continuar para a proxima pergunta pendente.',
            suggestedReply: 'Listo, señor. Continuamos con el siguiente paso para dejar su pedido bien registrado.'
        };
    }

    if (/\b(guia|rastreo|tracking|pedido|cuando llega|llego|retiro|retirar|ya esta)\b/i.test(body) || latestOrder) {
        return {
            problem: 'pos_venda_ou_logistica',
            severity: 'alta',
            solution: 'Responder sobre guia/retirada/estado do pedido sem reabrir venda; se nao houver guia, informar que avisara quando liberar.',
            suggestedReply: 'Con gusto, señor. Reviso su pedido y le aviso por aquí sobre la guía o la retirada sin abrir un pedido nuevo.'
        };
    }

    if (/\b(como se toma|como tomar|dosis|uso|cuantas veces|ayunas|despues de comer)\b/i.test(body)) {
        return {
            problem: 'duvida_como_tomar',
            severity: 'media',
            solution: 'Responder com audio COMO_SE_TOMA_VIT_POWER/TEMPO_RESULTADO e nao reiniciar funil comercial.',
            suggestedReply: 'Claro, señor. Le envío la orientación de uso de Vit Power y cualquier duda me escribe por aquí.'
        };
    }

    if (/\b(hola|buenas|buenos dias|buenas tardes|buenas noches)\b/i.test(body)) {
        return {
            problem: 'saudacao_ou_entrada_curta',
            severity: 'media',
            solution: 'Se for cliente novo, iniciar entrada oficial sem preço; se ja recebeu apresentacao, perguntar qual ajuda precisa.',
            suggestedReply: 'Hola, señor. Estoy por aquí para ayudarle con Vit Power. ¿Su duda es sobre precio, cómo tomar, agencia o pedido?'
        };
    }

    return {
        problem: 'intencao_nao_classificada',
        severity: 'media',
        solution: 'Enviar fallback seguro, registrar para revisao humana e acrescentar novo padrao se aparecer repetido.',
        suggestedReply: 'Recibí su mensaje, señor. Para ayudarle sin error, me escribe en una frase si su duda es sobre precio, cómo tomar, agencia o pedido?'
    };
};

const fetchContext = async (lastMessage) => {
    const chatId = lastMessage.chatId;
    const phoneTail = firstPhoneTail(lastMessage.peerPhone, lastMessage.from, lastMessage.chatId);
    const stateQuery = phoneTail
        ? {
            $or: [
                { chatId },
                { phoneDigits: { $regex: `${phoneTail}$` } },
                { 'metadata.customerPhoneDigits': { $regex: `${phoneTail}$` } },
                { 'metadata.lastSenderPn': { $regex: phoneTail } }
            ]
        }
        : { chatId };
    const [contactState, latestOrder, recentMessages] = await Promise.all([
        ContactState.findOne(stateQuery).sort({ updatedAt: -1 }).lean().catch(() => null),
        phoneTail
            ? Order.findOne({ country: 'EC', 'customer.phone': { $regex: `${phoneTail}$` } }).sort({ updatedAt: -1 }).lean().catch(() => null)
            : null,
        Message.find({ chatId }).sort({ createdAt: -1, timestamp: -1 }).limit(8).lean().catch(() => [])
    ]);
    return { contactState, latestOrder, recentMessages: recentMessages.reverse() };
};

const main = async () => {
    await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000
    });
    const now = Date.now();
    const cutoff = new Date(now - waitMinutes * 60 * 1000);
    const hotCutoff = new Date(now - hotMinutes * 60 * 1000);

    const lastByChat = await Message.aggregate([
        {
            $match: {
                chatId: { $nin: [null, '', 'status@broadcast'], $not: /@g\.us$/ },
                createdAt: { $lte: cutoff }
            }
        },
        { $sort: { createdAt: -1, timestamp: -1 } },
        { $group: { _id: '$chatId', lastMessage: { $first: '$$ROOT' } } },
        {
            $match: {
                'lastMessage.isFromMe': false,
                'lastMessage.isBot': false,
                'lastMessage.from': { $not: /^bot$/i }
            }
        },
        { $sort: { 'lastMessage.createdAt': 1 } },
        { $limit: limit }
    ]);

    const items = [];
    for (const row of lastByChat) {
        const lastMessage = row.lastMessage;
        const context = await fetchContext(lastMessage);
        const classification = classifyUnanswered({
            message: lastMessage,
            contactState: context.contactState,
            latestOrder: context.latestOrder
        });
        const waitedMinutes = Math.round((now - messageTime(lastMessage).getTime()) / 60000);
        const hot = messageTime(lastMessage) <= hotCutoff && classification.severity === 'alta';
        items.push({
            chatId: lastMessage.chatId,
            phoneTail: firstPhoneTail(lastMessage.peerPhone, lastMessage.from, lastMessage.chatId),
            lastInboundAt: messageTime(lastMessage).toISOString(),
            waitedMinutes,
            hot,
            lastText: compactText(lastMessage.body || `[${lastMessage.type || 'sem_texto'}]`),
            lastType: lastMessage.type || 'chat',
            stage: context.contactState?.metadata?.lastKnownFunnelStage
                || context.contactState?.metadata?.perAgentMemory?.vit_power_ec?.lastFunnelStage
                || context.contactState?.metadata?.perAgentMemory?.vit_power_ec?.principalSdrStage
                || '',
            latestOrderStatus: context.latestOrder?.status || '',
            latestOrderId: context.latestOrder?.orderId || '',
            recentContext: context.recentMessages.map((message) => ({
                role: message.isFromMe || message.isBot || message.from === 'bot' ? 'bot/humano' : 'cliente',
                at: messageTime(message).toISOString(),
                text: compactText(message.body || `[${message.type || 'sem_texto'}]`, 160)
            })),
            ...classification
        });
    }

    const report = {
        generatedAt: new Date(now).toISOString(),
        rule: {
            officialUnansweredAfterMinutes: waitMinutes,
            hotAlertAfterMinutes: hotMinutes,
            firstResponseSlaSeconds,
            note: 'Primeira resposta operacional deve chegar entre 10s e 1m59s; 2min ja e atraso operacional. 5/10min ficam para auditoria tardia/abandono.',
            limit
        },
        total: items.length,
        items
    };

    const jsonPath = path.join(outDir, `REVISAO_BOT_AGUARDANDO_RESPOSTA_${today}.json`);
    const mdPath = path.join(outDir, `REVISAO_BOT_AGUARDANDO_RESPOSTA_${today}.md`);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

    const lines = [
        `# Revisao Bot Aguardando Resposta - ${today}`,
        '',
        `Gerado em: ${report.generatedAt}`,
        `Criterio operacional: ultima mensagem do cliente sem resposta ha mais de ${waitMinutes} minutos.`,
        `Alerta quente: casos comerciais/logisticos de alta severidade ha mais de ${hotMinutes} minutos.`,
        `SLA primeira resposta: entre 10s e ${firstResponseSlaSeconds}s; acima disso ja deve ser tratado como atraso.`,
        `Limite analisado: ${limit}. Encontrados: ${items.length}.`,
        '',
        '## Itens',
        ''
    ];

    items.forEach((item, index) => {
        lines.push(`### ${index + 1}. ${item.phoneTail || item.chatId} - ${item.problem}${item.hot ? ' - ALERTA QUENTE' : ''}`);
        lines.push('');
        lines.push(`- Espera: ${item.waitedMinutes} min`);
        lines.push(`- Etapa: ${item.stage || 'nao identificada'}`);
        lines.push(`- Pedido: ${item.latestOrderId || 'sem pedido'} ${item.latestOrderStatus ? `(${item.latestOrderStatus})` : ''}`);
        lines.push(`- Ultima mensagem: "${item.lastText}"`);
        lines.push(`- Solucao: ${item.solution}`);
        lines.push(`- Resposta sugerida: ${item.suggestedReply}`);
        lines.push('');
    });

    fs.writeFileSync(mdPath, lines.join('\n'));
    console.log(`[UNANSWERED-REVIEW] OK total=${items.length}`);
    console.log(`[UNANSWERED-REVIEW] markdown=${mdPath}`);
    console.log(`[UNANSWERED-REVIEW] json=${jsonPath}`);
    await mongoose.disconnect();
};

main().catch(async (error) => {
    console.error(`[UNANSWERED-REVIEW] erro: ${error.message}`);
    await mongoose.disconnect().catch(() => null);
    process.exit(1);
});
