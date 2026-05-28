import Message from '../models/Message.js';
import ContactState from '../models/ContactState.js';
import ObservationReport from '../models/ObservationReport.js';
import Order from '../models/Order.js';
import Shipment from '../models/Shipment.js';

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

const finding = ({ priority = 'important', category, chatId, phone, customerText = '', botText = '', occurredAt = null }) => {
    const copy = copyByCategory[category] || copyByCategory.unanswered;
    return {
        priority,
        category,
        chatId,
        phone,
        occurredAt,
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

const localHour = (date) => {
    const value = date ? new Date(date) : new Date();
    return Number(new Intl.DateTimeFormat('en-US', {
        timeZone: process.env.OBSERVATION_TIMEZONE || 'America/Guayaquil',
        hour: '2-digit',
        hour12: false
    }).format(value).replace(/\D/g, '')) || 0;
};

const emptyHourlyBuckets = () => Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${String(hour).padStart(2, '0')}:00`,
    leads: 0,
    inboundMessages: 0,
    botMessages: 0,
    confirmedOrders: 0,
    deliveredOrPicked: 0,
    buyLaterSignals: 0,
    trustSignals: 0,
    medicalSignals: 0,
    score: 0
}));

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
                findings.push(finding({ priority: 'critical', category: 'cancel', chatId, phone, customerText: text, botText: getMessageText(lastBot), occurredAt: message.createdAt }));
            } else if (containsAny(normalized, signalGroups.buyLater)) {
                findings.push(finding({ priority: 'critical', category: 'buy_later', chatId, phone, customerText: text, botText: getMessageText(lastBot), occurredAt: message.createdAt }));
            } else if (containsAny(normalized, signalGroups.trust)) {
                findings.push(finding({ priority: 'critical', category: 'trust', chatId, phone, customerText: text, botText: getMessageText(lastBot), occurredAt: message.createdAt }));
            } else if (containsAny(normalized, signalGroups.medical)) {
                findings.push(finding({ priority: 'important', category: 'medical', chatId, phone, customerText: text, botText: getMessageText(lastBot), occurredAt: message.createdAt }));
            } else if (containsAny(normalized, signalGroups.discretion)) {
                findings.push(finding({ priority: 'important', category: 'discretion', chatId, phone, customerText: text, botText: getMessageText(lastBot), occurredAt: message.createdAt }));
            } else if (containsAny(normalized, signalGroups.question)) {
                const nextBot = messages.find((candidate) => (candidate.timestamp || 0) > (message.timestamp || 0) && (candidate.isBot || candidate.from === 'bot'));
                if (!nextBot) {
                    findings.push(finding({ priority: 'important', category: 'unanswered', chatId, phone, customerText: text, occurredAt: message.createdAt }));
                }
            }
            lastInbound = message;
        }

        if (isBot) {
            if (text.length > 650) {
                findings.push(finding({ priority: 'improvement', category: 'long_bot', chatId, phone, customerText: getMessageText(lastInbound), botText: text, occurredAt: message.createdAt }));
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

const buildHourlyInsights = ({ messages, orders, findings, shipments }) => {
    const buckets = emptyHourlyBuckets();

    for (const message of messages) {
        const bucket = buckets[localHour(message.createdAt || (message.timestamp ? message.timestamp * 1000 : null))];
        if (!bucket) continue;
        if (!message.isFromMe && message.from !== 'bot') {
            bucket.inboundMessages += 1;
        } else if (message.isBot || message.from === 'bot') {
            bucket.botMessages += 1;
        }
    }

    const seenLeadPhones = new Set();
    for (const message of messages) {
        if (message.isFromMe || message.from === 'bot') continue;
        const phone = digitsOnly(message.peerPhone || message.chatId || message.from);
        if (!phone) continue;
        const hour = localHour(message.createdAt || (message.timestamp ? message.timestamp * 1000 : null));
        const key = `${phone}:${hour}`;
        if (seenLeadPhones.has(key)) continue;
        seenLeadPhones.add(key);
        buckets[hour].leads += 1;
    }

    for (const order of orders) {
        const bucket = buckets[localHour(order.createdAt)];
        if (!bucket) continue;
        if (['confirmed', 'processing', 'shipped', 'delivered'].includes(String(order.status || ''))) {
            bucket.confirmedOrders += 1;
        }
    }

    for (const shipment of shipments) {
        const date = shipment.automation?.deliveredConfirmedAt || shipment.proof?.pickupProofReceivedAt || shipment.updatedAt;
        const bucket = buckets[localHour(date)];
        if (!bucket) continue;
        if (shipment.outcomes?.delivered || shipment.outcomes?.pickedUp) bucket.deliveredOrPicked += 1;
    }

    for (const item of findings) {
        const hour = localHour(item.occurredAt || new Date());
        const bucket = buckets[hour];
        if (!bucket) continue;
        if (item.category === 'buy_later') bucket.buyLaterSignals += 1;
        if (item.category === 'trust') bucket.trustSignals += 1;
        if (item.category === 'medical') bucket.medicalSignals += 1;
    }

    for (const bucket of buckets) {
        bucket.score = (bucket.confirmedOrders * 6) + (bucket.deliveredOrPicked * 4) + (bucket.leads * 2) + bucket.inboundMessages - bucket.buyLaterSignals;
    }

    const hotHours = buckets
        .filter((bucket) => bucket.leads || bucket.confirmedOrders || bucket.deliveredOrPicked || bucket.inboundMessages)
        .sort((a, b) => b.score - a.score)
        .slice(0, 6)
        .map((bucket) => ({
            hour: bucket.hour,
            label: bucket.label,
            score: bucket.score,
            reason: `${bucket.confirmedOrders} confirmados, ${bucket.deliveredOrPicked} retirados/entregues, ${bucket.leads} leads, ${bucket.inboundMessages} mensagens`
        }));

    return {
        salesByHour: buckets.map(({ hour, label, leads, confirmedOrders, deliveredOrPicked, score }) => ({ hour, label, leads, confirmedOrders, deliveredOrPicked, score })),
        messageByHour: buckets.map(({ hour, label, inboundMessages, botMessages, buyLaterSignals, trustSignals, medicalSignals }) => ({ hour, label, inboundMessages, botMessages, buyLaterSignals, trustSignals, medicalSignals })),
        hotHours
    };
};

const buildBonusInsights = (shipments) => {
    const eligibleShipments = shipments.filter((shipment) => (
        shipment.outcomes?.delivered
        || shipment.outcomes?.pickedUp
        || shipment.proof?.pickupProofReceivedAt
        || shipment.automation?.deliveredConfirmedAt
        || String(shipment.review?.reviewStatus || '').includes('pickup_confirmed')
    ));
    const sent = eligibleShipments.filter((shipment) => shipment.automation?.bonusNotifiedAt);
    const missing = eligibleShipments.filter((shipment) => !shipment.automation?.bonusNotifiedAt);
    const withBonusDelivered = shipments.filter((shipment) => shipment.automation?.bonusNotifiedAt && (shipment.outcomes?.delivered || shipment.outcomes?.pickedUp)).length;
    const withoutBonusEligible = shipments.filter((shipment) => !shipment.automation?.bonusNotifiedAt);
    const withoutBonusDelivered = withoutBonusEligible.filter((shipment) => shipment.outcomes?.delivered || shipment.outcomes?.pickedUp).length;
    const withBonusBase = shipments.filter((shipment) => shipment.automation?.bonusNotifiedAt).length;
    const withoutBonusBase = withoutBonusEligible.length;
    const pickupRateWithBonus = withBonusBase ? Math.round((withBonusDelivered / withBonusBase) * 1000) / 10 : 0;
    const pickupRateWithoutBonus = withoutBonusBase ? Math.round((withoutBonusDelivered / withoutBonusBase) * 1000) / 10 : 0;

    return {
        eligible: eligibleShipments.length,
        sent: sent.length,
        missing: missing.length,
        deliveredOrPickedWithBonus: withBonusDelivered,
        deliveredOrPickedWithoutBonus: withoutBonusDelivered,
        pickupRateWithBonus,
        pickupRateWithoutBonus,
        missingShipments: missing.slice(0, 20).map((shipment) => ({
            orderId: shipment.orderId,
            name: shipment.client?.name || '',
            phone: shipment.client?.phone || '',
            city: shipment.client?.city || '',
            status: shipment.logistics?.status || '',
            pickedUp: Boolean(shipment.outcomes?.pickedUp),
            delivered: Boolean(shipment.outcomes?.delivered),
            pickupProofReceivedAt: shipment.proof?.pickupProofReceivedAt || null,
            deliveredConfirmedAt: shipment.automation?.deliveredConfirmedAt || null
        })),
        note: 'Metricas de efeito sao correlacionais: comparam retirada/entrega em pedidos com bonus enviado versus sem bonus enviado.'
    };
};

const recoveryStrategyForState = (state) => {
    const text = normalizeText([
        state.lastInboundText,
        state.metadata?.lastProcessedInboundText,
        state.metadata?.customerDraft?.notes
    ].filter(Boolean).join(' '));
    const stage = String(state.metadata?.perAgentMemory?.vit_power_ec?.lastFunnelStage || state.metadata?.customerDraft?.status || '');
    const hoursCold = state.lastInboundAt ? Math.round((Date.now() - new Date(state.lastInboundAt).getTime()) / 36e5) : 0;
    const orderStatus = normalizeText(state.metadata?.orderStatus || state.metadata?.customerDraft?.status || '');

    if (containsAny(text, signalGroups.cancel)) {
        return null;
    }
    if (
        /pedido|guia|llega|llegue|agencia|retirar|retiro|bonus|bono|ya (lo )?compre|ya comence|comprobante/.test(text)
        || /confirmado|pedido_confirmado|order_closed|entregado|pedido_enviado|delivered/.test(orderStatus)
        || /order_closed|post_sale|shipment|pickup|delivered/.test(stage)
    ) {
        return {
            strategy: 'post_sale_support',
            label: 'Suporte pos-venda, nao promocao',
            reason: 'Cliente parece estar em pos-venda ou suporte. Nao oferecer promocao; conferir guia, bonus, retirada ou status antes.'
        };
    }
    if (containsAny(text, signalGroups.trust) || containsAny(text, signalGroups.medical)) {
        return {
            strategy: 'trust_recovery',
            label: 'Prova + audio humano antes de oferta',
            reason: 'Cliente esfriou com duvida de confianca/saude. Oferta antes da objecao pode piorar.'
        };
    }
    if (containsAny(text, signalGroups.buyLater)) {
        return {
            strategy: 'buy_later_bonus',
            label: 'Bonus reservado + data combinada',
            reason: 'Cliente adiou. Melhor recuperar com bonus reservado e pergunta de data, nao desconto imediato.'
        };
    }
    if (/price|precio|valor|caro|descuento|rebaja/.test(text) || hoursCold >= 12) {
        return {
            strategy: 'flash_promo',
            label: 'Promocao relampago discreta',
            reason: 'Lead frio/morno sem fechamento. Usar oferta curta, com limite real e sem parecer desespero.'
        };
    }
    if (/package_selection|awaiting|confirmed|draft|atendendo/.test(stage)) {
        return {
            strategy: 'soft_reminder',
            label: 'Lembrete curto + proximo passo',
            reason: 'Lead interrompeu no meio do fluxo. Recuperar com pergunta simples e sem nova explicacao longa.'
        };
    }
    return {
        strategy: 'human_review',
        label: 'Revisao humana',
        reason: 'Sinal pouco claro. Melhor humano revisar antes de qualquer oferta.'
    };
};

const buildRecoveryInsights = ({ states, orders }) => {
    const confirmedPhones = new Set(orders
        .filter((order) => ['confirmed', 'processing', 'shipped', 'delivered'].includes(String(order.status || '')))
        .map((order) => digitsOnly(order.customer?.phone))
        .filter(Boolean));
    const minAgeHours = Number(process.env.OBSERVATION_RECOVERY_MIN_AGE_HOURS || 2);
    const maxAgeHours = Number(process.env.OBSERVATION_RECOVERY_MAX_AGE_HOURS || 72);
    const rawCandidates = [];
    const strategyCounts = {};

    for (const state of states) {
        const phone = digitsOnly(state.phoneDigits || state.chatId);
        if (!phone || confirmedPhones.has(phone)) continue;
        if (!state.lastInboundAt) continue;
        const hoursCold = Math.round((Date.now() - new Date(state.lastInboundAt).getTime()) / 36e5);
        if (hoursCold < minAgeHours || hoursCold > maxAgeHours) continue;
        const recommendation = recoveryStrategyForState(state);
        if (!recommendation) continue;
        strategyCounts[recommendation.strategy] = (strategyCounts[recommendation.strategy] || 0) + 1;
        rawCandidates.push({
            chatId: state.chatId,
            phone,
            lastInboundAt: state.lastInboundAt,
            hoursCold,
            lastText: clip(state.lastInboundText || state.metadata?.lastProcessedInboundText || '', 220),
            strategy: recommendation.strategy,
            label: recommendation.label,
            reason: recommendation.reason
        });
    }
    const candidates = rawCandidates
        .sort((a, b) => {
            const supportWeight = (item) => item.strategy === 'post_sale_support' ? 0 : 1;
            return supportWeight(b) - supportWeight(a) || b.hoursCold - a.hoursCold;
        })
        .slice(0, 30);

    return {
        candidates,
        strategyCounts: candidates.reduce((acc, item) => {
            acc[item.strategy] = (acc[item.strategy] || 0) + 1;
            return acc;
        }, {}),
        note: 'Estrategia inspirada em funis de alta conversao: primeiro remover a objecao, depois recuperar com lembrete, bonus reservado ou oferta relampago. Nada e enviado automaticamente.'
    };
};

const buildKitInsights = (orders) => {
    const confirmed = orders.filter((order) => ['confirmed', 'processing', 'shipped', 'delivered'].includes(String(order.status || '')));
    const totalUnits = confirmed.reduce((sum, order) => sum + (Number(order.package?.quantity || order.package?.id || 1) || 1), 0);
    const totalTicket = confirmed.reduce((sum, order) => sum + (Number(order.total || 0) || 0), 0);
    const distributionMap = new Map();
    for (const order of confirmed) {
        const units = Number(order.package?.quantity || order.package?.id || 1) || 1;
        distributionMap.set(units, (distributionMap.get(units) || 0) + 1);
    }
    const upgradeCandidates = confirmed
        .filter((order) => (Number(order.package?.quantity || order.package?.id || 1) || 1) === 1)
        .slice(0, 25)
        .map((order) => ({
            orderId: order.orderId,
            name: order.customer?.name || '',
            phone: order.customer?.phone || '',
            city: order.customer?.city || '',
            total: order.total || 0,
            suggestedKit: '3 frascos',
            reason: 'Cliente comprou 1 unidade. Pode receber argumento de tratamento completo/maior economia em recompra ou antes do envio, se ainda fizer sentido.'
        }));

    return {
        avgUnits: confirmed.length ? Math.round((totalUnits / confirmed.length) * 10) / 10 : 0,
        avgTicket: confirmed.length ? Math.round((totalTicket / confirmed.length) * 100) / 100 : 0,
        distribution: Array.from(distributionMap.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([units, count]) => ({ units, count })),
        upgradeCandidates,
        note: 'Aumentar kit medio deve priorizar valor percebido: tratamento completo, economia por frasco, bonus de retirada e menos risco de faltar produto. Evitar desconto cedo demais.'
    };
};

const classifyStage = (state, messages = []) => {
    const memory = state.metadata?.perAgentMemory?.vit_power_ec || {};
    const draft = state.metadata?.customerDraft || {};
    const joined = normalizeText(messages.map((message) => getMessageText(message)).join(' '));
    const rawStage = normalizeText([
        memory.lastFunnelStage,
        memory.principalSdrStage,
        memory.conversationState?.stage,
        draft.status,
        state.metadata?.orderStatus
    ].filter(Boolean).join(' '));
    if (/dropi|pedido_enviado|shipped|submitted/.test(rawStage)) return 'dropi_envio';
    if (/delivered|entregado|pickup|retirada|returned/.test(rawStage) || /guia|retirar|agencia|bonus/.test(joined)) return 'retirada_posvenda';
    if (/confirm|order_closed|pedido_confirmado/.test(rawStage) || /confirmo|correcto|listo|si esta/.test(joined)) return 'confirmacao';
    if (/agencia|servientrega|domicilio|direccion|ciudad|provincia/.test(joined)) return 'cidade_agencia_endereco';
    if (/nombre|nome|cedula|telefono/.test(joined)) return 'dados_nome';
    if (/precio|valor|cuanto|frasco|promocion|paquete/.test(joined)) return 'preco_kit';
    if (/funciona|sirve|garantia|estafa|presion|diabetes/.test(joined)) return 'objecao_confianca';
    return 'inicio_interesse';
};

const objectionForText = (text) => {
    const normalized = normalizeText(text);
    if (containsAny(normalized, signalGroups.trust)) return 'medo_golpe_confianca';
    if (containsAny(normalized, signalGroups.medical)) return 'duvida_medica';
    if (containsAny(normalized, signalGroups.price)) return 'preco';
    if (containsAny(normalized, signalGroups.discretion)) return 'vergonha_discricao';
    if (containsAny(normalized, signalGroups.logistics)) return 'entrega_agencia';
    if (containsAny(normalized, signalGroups.buyLater)) return 'falta_dinheiro_comprar_depois';
    if (containsAny(normalized, signalGroups.cancel)) return 'cancelamento';
    return 'sem_objecao_clara';
};

const leadTemperature = ({ state, messages, orders }) => {
    const phone = digitsOnly(state.phoneDigits || state.chatId);
    const hasOrder = orders.some((order) => digitsOnly(order.customer?.phone).endsWith(phone.slice(-9)) && ['confirmed', 'processing', 'shipped', 'delivered'].includes(String(order.status || '')));
    const joined = normalizeText(messages.map((message) => getMessageText(message)).join(' '));
    if (hasOrder || /precio|valor|cuanto|frasco|agencia|direccion|ciudad|provincia|confirmo|listo|servientrega|funciona/.test(joined)) return 'quente';
    if (/quiero|informacion|producto|vit power|promocion|como/.test(joined)) return 'morno';
    return 'frio';
};

const nextActionFor = ({ temperature, objection, stage }) => {
    if (objection === 'cancelamento') return 'parar_conversa';
    if (objection === 'falta_dinheiro_comprar_depois') return 'marcar_comprar_depois';
    if (objection === 'medo_golpe_confianca') return 'mandar_prova_social_audio_seguro';
    if (objection === 'duvida_medica') return 'audio_humano_resposta_medica_responsavel';
    if (objection === 'preco') return temperature === 'quente' ? 'ancorar_3_frascos_e_economia' : 'explicar_valor_sem_desconto_cedo';
    if (stage === 'cidade_agencia_endereco') return 'pedir_apenas_dado_faltante';
    if (stage === 'confirmacao') return 'confirmar_dados_e_levar_para_leads';
    if (stage === 'retirada_posvenda') return 'suporte_posvenda_sem_promocao';
    if (temperature === 'frio') return 'recuperacao_curta_ou_humano';
    return 'seguir_funil_curto';
};

const falseOrderRiskScore = ({ state, messages }) => {
    const joined = normalizeText(messages.map((message) => getMessageText(message)).join(' '));
    let score = 0;
    const reasons = [];
    if (containsAny(joined, signalGroups.buyLater)) { score += 30; reasons.push('comprar depois/sem dinheiro'); }
    if (/talvez|despues|luego|no se|vere|avis/.test(joined)) { score += 20; reasons.push('resposta vaga'); }
    if (!/nombre|ciudad|provincia|direccion|agencia|servientrega/.test(joined)) { score += 20; reasons.push('dados incompletos'); }
    if (/no envie|no mande|cancel/.test(joined)) { score += 40; reasons.push('sinal de cancelamento'); }
    if (/apur|rapido|ya ya|urgente/.test(joined) && !/direccion|agencia/.test(joined)) { score += 10; reasons.push('pressa sem dados'); }
    if (state.human?.mode === 'manual') { score += 5; reasons.push('humano assumiu'); }
    return { score: Math.min(score, 100), reasons };
};

const pickupScore = ({ shipment }) => {
    let score = 0;
    const reasons = [];
    if (shipment.automation?.guiaNotifiedAt) { score += 15; reasons.push('guia avisada'); }
    if (shipment.automation?.readyForPickupNotifiedAt) { score += 25; reasons.push('agencia avisada'); }
    if (shipment.automation?.pickupProofRequestedAt) { score += 20; reasons.push('comprovante pedido'); }
    if (shipment.proof?.pickupProofReceivedAt) { score += 30; reasons.push('comprovante recebido'); }
    if (shipment.automation?.bonusNotifiedAt) { score += 10; reasons.push('bonus enviado'); }
    if (shipment.outcomes?.returned) { score -= 50; reasons.push('devolvido'); }
    return { score: Math.max(0, Math.min(score, 100)), reasons };
};

const isColdBotReply = (botText, previousCustomerText = '') => {
    const text = normalizeText(botText);
    const customer = normalizeText(previousCustomerText);
    if (!text) return false;
    if (botText.length > 650) return true;
    if (/entiendo|claro|tranquilo|gracias por avisar|le explico/.test(text)) return false;
    return containsAny(customer, [...signalGroups.trust, ...signalGroups.medical, ...signalGroups.discretion]) && !/seguro|natural|confianza|discreto|cuid/.test(text);
};

const buildCommercialIntelligence = ({ grouped, stateByChat, recoveryStates, orders, shipments }) => {
    const stageMap = new Map();
    const temperatures = [];
    const dominantObjections = [];
    const nextBestActions = [];
    const falseOrderRisk = [];
    const coldBotReplies = [];
    const winningPhrases = [];
    const abCounters = {
        shortBotThenInbound: 0,
        longBotThenInbound: 0,
        audioMentionedThenInbound: 0,
        proofMentionedThenInbound: 0,
        bonusMentionedThenInbound: 0
    };

    for (const [chatId, messages] of grouped.entries()) {
        const state = stateByChat.get(chatId) || recoveryStates.find((item) => item.chatId === chatId) || {};
        const phone = digitsOnly(state.phoneDigits || chatId);
        const stage = classifyStage(state, messages);
        const temp = leadTemperature({ state, messages, orders });
        const customerText = messages.filter((m) => !m.isFromMe && m.from !== 'bot').map((m) => getMessageText(m)).join(' ');
        const objection = objectionForText(customerText);
        const nextAction = nextActionFor({ temperature: temp, objection, stage });
        const risk = falseOrderRiskScore({ state, messages });
        const entry = stageMap.get(stage) || { stage, count: 0, cold: 0, warm: 0, hot: 0, topAction: nextAction };
        entry.count += 1;
        if (temp === 'frio') entry.cold += 1;
        if (temp === 'morno') entry.warm += 1;
        if (temp === 'quente') entry.hot += 1;
        stageMap.set(stage, entry);
        temperatures.push({ chatId, phone, temperature: temp, stage, objection, nextAction });
        dominantObjections.push({ chatId, phone, objection, stage, temperature: temp });
        nextBestActions.push({ chatId, phone, action: nextAction, stage, objection, temperature: temp });
        if (risk.score >= 50) falseOrderRisk.push({ chatId, phone, score: risk.score, reasons: risk.reasons, stage });

        let lastInbound = '';
        for (const message of messages) {
            const body = getMessageText(message);
            if (!body) continue;
            const isBot = message.isBot || message.from === 'bot';
            if (isBot) {
                if (isColdBotReply(body, lastInbound)) {
                    coldBotReplies.push({ chatId, phone, botText: clip(body, 240), customerText: clip(lastInbound, 180), stage });
                }
                const nextInbound = messages.find((candidate) => (candidate.timestamp || 0) > (message.timestamp || 0) && !candidate.isFromMe && candidate.from !== 'bot');
                if (nextInbound) {
                    if (body.length <= 240) abCounters.shortBotThenInbound += 1;
                    if (body.length > 650) abCounters.longBotThenInbound += 1;
                    if (/\[AUDIO\]|audio|ogg|mp3/i.test(body)) abCounters.audioMentionedThenInbound += 1;
                    if (/prova|prueba|testimonio|depoimento|social/i.test(body)) abCounters.proofMentionedThenInbound += 1;
                    if (/bonus|regalo|sorpresa/i.test(body)) abCounters.bonusMentionedThenInbound += 1;
                }
            } else {
                lastInbound = body;
            }
        }
    }

    for (const order of orders.filter((o) => ['confirmed', 'processing', 'shipped', 'delivered'].includes(String(o.status || ''))).slice(0, 40)) {
        const phone = digitsOnly(order.customer?.phone);
        const relatedMessages = Array.from(grouped.values()).find((list) => list.some((m) => digitsOnly(m.peerPhone || m.chatId).endsWith(phone.slice(-9)))) || [];
        const lastBot = [...relatedMessages].reverse().find((m) => m.isBot || m.from === 'bot');
        if (lastBot) {
            winningPhrases.push({
                orderId: order.orderId,
                phone,
                phrase: clip(getMessageText(lastBot), 260),
                result: order.status,
                ticket: order.total || 0
            });
        }
    }

    const pickupScores = shipments
        .map((shipment) => ({ orderId: shipment.orderId, phone: shipment.client?.phone || '', status: shipment.logistics?.status || '', ...pickupScore({ shipment }) }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 40);

    const objectionCounts = dominantObjections.reduce((acc, item) => {
        acc[item.objection] = (acc[item.objection] || 0) + 1;
        return acc;
    }, {});
    const actionCounts = nextBestActions.reduce((acc, item) => {
        acc[item.action] = (acc[item.action] || 0) + 1;
        return acc;
    }, {});

    return {
        lossMap: {
            stages: Array.from(stageMap.values()).sort((a, b) => b.count - a.count),
            note: 'Mapa mostra onde as conversas estao parando. Maior volume em uma etapa indica vazamento ou fila de atencao.'
        },
        leadIntelligence: {
            temperatures: temperatures.slice(0, 80),
            dominantObjections: Object.entries(objectionCounts).map(([objection, count]) => ({ objection, count })).sort((a, b) => b.count - a.count),
            nextBestActions: Object.entries(actionCounts).map(([action, count]) => ({ action, count })).sort((a, b) => b.count - a.count),
            falseOrderRisk: falseOrderRisk.sort((a, b) => b.score - a.score).slice(0, 40),
            pickupScores,
            coldBotReplies: coldBotReplies.slice(0, 40),
            winningPhrases,
            abSignals: Object.entries(abCounters).map(([signal, count]) => ({ signal, count })),
            dailyOperator: {
                topLossStage: Array.from(stageMap.values()).sort((a, b) => b.count - a.count)[0] || null,
                topObjection: Object.entries(objectionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '',
                topAction: Object.entries(actionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '',
                needsHuman: nextBestActions.filter((item) => /humano|human|medica|prova|suporte/.test(item.action)).length,
                falseOrderRisk: falseOrderRisk.length,
                coldBotReplies: coldBotReplies.length
            },
            note: 'Inteligencia comercial em modo observacao. Serve para decidir ajustes, nao para executar contato automaticamente.'
        }
    };
};

const messageMediaType = (message) => {
    const type = normalizeText(message.type || '');
    const body = String(message.body || '');
    const mediaUrl = normalizeText(message.mediaUrl || message.mediaPreviewUrl || '');
    if (/audio|ptt/.test(type) || /\.(mp3|ogg|opus|wav|m4a)$/i.test(mediaUrl) || /\[audio\]|\[enviar_audio_gravado|audio/i.test(body)) return 'audio';
    if (/image|sticker/.test(type) || /\.(jpg|jpeg|png|webp|gif)$/i.test(mediaUrl)) return 'imagem';
    if (/video/.test(type) || /\.(mp4|mov|webm)$/i.test(mediaUrl) || /video/i.test(body)) return 'video';
    if (/document/.test(type) || /\.(pdf|doc|docx)$/i.test(mediaUrl)) return 'documento';
    return 'texto';
};

const samePhone = (left, right) => {
    const a = digitsOnly(left);
    const b = digitsOnly(right);
    if (!a || !b) return false;
    return a === b || a.endsWith(b.slice(-9)) || b.endsWith(a.slice(-9));
};

const buildMediaPerformanceInsights = ({ grouped, orders, historicalOrders }) => {
    const byType = new Map();
    const confirmedOrders = orders.filter((order) => ['confirmed', 'processing', 'shipped', 'delivered'].includes(String(order.status || '')));
    const historicalByPhone = new Map();
    for (const order of historicalOrders) {
        const phone = digitsOnly(order.customer?.phone);
        if (!phone) continue;
        if (!historicalByPhone.has(phone.slice(-9))) historicalByPhone.set(phone.slice(-9), []);
        historicalByPhone.get(phone.slice(-9)).push(order);
    }

    for (const [chatId, messages] of grouped.entries()) {
        const sorted = [...messages].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
        for (const message of sorted) {
            const isBot = message.isBot || message.from === 'bot' || message.isFromMe;
            if (!isBot) continue;
            const kind = messageMediaType(message);
            const bucket = byType.get(kind) || {
                type: kind,
                sent: 0,
                interactions: 0,
                sales: 0,
                repurchases: 0,
                interactionRate: 0,
                salesRate: 0,
                repurchaseRate: 0,
                examples: []
            };
            bucket.sent += 1;
            const sentAt = new Date(message.createdAt || (message.timestamp ? message.timestamp * 1000 : Date.now()));
            const nextInbound = sorted.find((candidate) => (
                !candidate.isFromMe
                && candidate.from !== 'bot'
                && new Date(candidate.createdAt || (candidate.timestamp ? candidate.timestamp * 1000 : 0)) > sentAt
                && new Date(candidate.createdAt || (candidate.timestamp ? candidate.timestamp * 1000 : 0)) - sentAt <= 24 * 60 * 60 * 1000
            ));
            if (nextInbound) bucket.interactions += 1;
            const phone = digitsOnly(message.peerPhone || chatId);
            const sale = confirmedOrders.find((order) => (
                samePhone(order.customer?.phone, phone)
                && new Date(order.createdAt || 0) >= sentAt
                && new Date(order.createdAt || 0) - sentAt <= 72 * 60 * 60 * 1000
            ));
            if (sale) {
                bucket.sales += 1;
                const history = historicalByPhone.get(digitsOnly(sale.customer?.phone).slice(-9)) || [];
                if (history.filter((order) => new Date(order.createdAt || 0) < new Date(sale.createdAt || 0)).length > 0) {
                    bucket.repurchases += 1;
                }
            }
            if (bucket.examples.length < 5 && getMessageText(message)) {
                bucket.examples.push(clip(getMessageText(message), 160));
            }
            byType.set(kind, bucket);
        }
    }

    const rows = Array.from(byType.values()).map((row) => ({
        ...row,
        interactionRate: row.sent ? Math.round((row.interactions / row.sent) * 1000) / 10 : 0,
        salesRate: row.sent ? Math.round((row.sales / row.sent) * 1000) / 10 : 0,
        repurchaseRate: row.sent ? Math.round((row.repurchases / row.sent) * 1000) / 10 : 0
    })).sort((a, b) => b.interactionRate - a.interactionRate || b.salesRate - a.salesRate);

    return {
        byType: rows,
        topInteraction: [...rows].sort((a, b) => b.interactionRate - a.interactionRate).slice(0, 5),
        topSales: [...rows].sort((a, b) => b.salesRate - a.salesRate).slice(0, 5),
        topRepurchase: [...rows].sort((a, b) => b.repurchaseRate - a.repurchaseRate).slice(0, 5),
        note: 'Analise observacional por tipo de mensagem. Interacao = cliente respondeu em ate 24h. Venda = pedido confirmado em ate 72h apos a mensagem. Recompra = venda com compra anterior detectada para o telefone.'
    };
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
    const [orders, shipments, historicalOrders] = await Promise.all([
        Order.find({
            createdAt: { $gte: from, $lte: to },
            ...(country && country !== 'ALL' ? { country } : {})
        }).lean(),
        Shipment.find({
            updatedAt: { $gte: from, $lte: to },
            ...(country && country !== 'ALL' ? { country } : {})
        }).lean(),
        Order.find({
            ...(country && country !== 'ALL' ? { country } : {}),
            status: { $in: ['confirmed', 'processing', 'shipped', 'delivered'] }
        }).sort({ createdAt: -1 }).limit(5000).lean()
    ]);

    const grouped = groupMessagesByChat(messages);
    const states = await ContactState.find({
        chatId: { $in: Array.from(grouped.keys()) }
    }, { chatId: 1, phoneDigits: 1, countryCode: 1 }).lean();
    const recoveryStates = await ContactState.find({
        ...(country && country !== 'ALL' ? { countryCode: country } : {}),
        lastInboundAt: { $gte: new Date(Date.now() - 72 * 60 * 60 * 1000) }
    }).limit(500).lean();
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
        unansweredSignals: limitedFindings.filter((item) => item.category === 'unanswered').length,
        confirmedOrders: orders.filter((order) => ['confirmed', 'processing', 'shipped', 'delivered'].includes(String(order.status || ''))).length
    };
    const insights = {
        ...buildHourlyInsights({ messages, orders, findings: limitedFindings, shipments }),
        bonus: buildBonusInsights(shipments),
        recovery: buildRecoveryInsights({ states: recoveryStates, orders }),
        kit: buildKitInsights(orders),
        ...buildCommercialIntelligence({ grouped, stateByChat, recoveryStates, orders, shipments }),
        media: buildMediaPerformanceInsights({ grouped, orders, historicalOrders })
    };
    summary.bonusEligible = insights.bonus.eligible;
    summary.bonusSent = insights.bonus.sent;
    summary.bonusMissing = insights.bonus.missing;
    summary.bonusPickupRateWithBonus = insights.bonus.pickupRateWithBonus;
    summary.bonusPickupRateWithoutBonus = insights.bonus.pickupRateWithoutBonus;
    summary.recoveryCandidates = insights.recovery.candidates.length;
    summary.flashPromoCandidates = insights.recovery.strategyCounts.flash_promo || 0;
    summary.bonusRecoveryCandidates = insights.recovery.strategyCounts.buy_later_bonus || 0;
    summary.avgKitUnits = insights.kit.avgUnits;
    summary.avgTicket = insights.kit.avgTicket;
    summary.kitUpgradeCandidates = insights.kit.upgradeCandidates.length;
    summary.hotLeads = insights.leadIntelligence.temperatures.filter((item) => item.temperature === 'quente').length;
    summary.warmLeads = insights.leadIntelligence.temperatures.filter((item) => item.temperature === 'morno').length;
    summary.coldLeads = insights.leadIntelligence.temperatures.filter((item) => item.temperature === 'frio').length;
    summary.falseOrderRisk = insights.leadIntelligence.falseOrderRisk.length;
    summary.pickupHighScore = insights.leadIntelligence.pickupScores.filter((item) => item.score >= 60).length;
    summary.coldBotReplies = insights.leadIntelligence.coldBotReplies.length;
    summary.winningPhrases = insights.leadIntelligence.winningPhrases.length;

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
        insights,
        findings: limitedFindings,
        recommendations: [
            ...buildRecommendations(summary),
            ...(insights.hotHours?.length ? [`Horario mais quente detectado: ${insights.hotHours[0].label} (${insights.hotHours[0].reason}).`] : []),
            ...(insights.bonus.missing ? [`Existem ${insights.bonus.missing} pedido(s) elegiveis sem bonus registrado. Revisar lista no modulo Observacao.`] : ['Nenhum cliente elegivel sem bonus detectado na janela analisada.']),
            ...(insights.recovery.candidates.length ? [`Existem ${insights.recovery.candidates.length} lead(s) frios para recuperacao: ${Object.entries(insights.recovery.strategyCounts).map(([key, value]) => `${key}=${value}`).join(', ')}.`] : []),
            ...(insights.kit.upgradeCandidates.length ? [`Kit medio atual: ${insights.kit.avgUnits} unidade(s), ticket medio USD ${insights.kit.avgTicket}. Ha ${insights.kit.upgradeCandidates.length} candidato(s) para estrategia de 3 frascos.`] : []),
            ...(insights.lossMap.stages?.[0] ? [`Maior vazamento por etapa: ${insights.lossMap.stages[0].stage} (${insights.lossMap.stages[0].count} conversa(s)).`] : []),
            ...(insights.leadIntelligence.dailyOperator?.topAction ? [`Proxima melhor acao mais frequente: ${insights.leadIntelligence.dailyOperator.topAction}.`] : [])
        ],
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
