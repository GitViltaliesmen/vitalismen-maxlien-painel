import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../src/config/db.js';
import Message from '../src/models/Message.js';
import ContactState from '../src/models/ContactState.js';
import Order from '../src/models/Order.js';
import Shipment from '../src/models/Shipment.js';

const digitsOnly = (value = '') => String(value || '').replace(/\D/g, '');
const normalize = (value = '') => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const since = new Date(process.env.FAILOVER_SINCE || '2026-05-23T00:00:00.000Z');
const downSessionId = digitsOnly(process.env.FAILOVER_DOWN_SESSION_ID || '553183002800');
const connectedSessions = String(process.env.FAILOVER_CONNECTED_SESSIONS || '553171862958,5515991418416')
    .split(',')
    .map((item) => digitsOnly(item))
    .filter(Boolean);
const maxPerSession = Math.max(1, Number.parseInt(process.env.FAILOVER_MAX_PER_SESSION || '2', 10) || 2);

const argvPhones = process.argv.slice(2)
    .flatMap((item) => String(item || '').split(','))
    .map((item) => digitsOnly(item))
    .filter(Boolean);

const tailRegex = (phone) => {
    const tail = digitsOnly(phone).slice(-10);
    return new RegExp(`${tail}(?:\\D|$)`);
};

const phoneQuery = (phone) => {
    const digits = digitsOnly(phone);
    const tail = digits.slice(-10);
    const regex = tailRegex(digits);
    return {
        $or: [
            { peerPhone: { $regex: `${tail}$` } },
            { chatId: { $regex: regex } },
            { from: { $regex: regex } },
            { to: { $regex: regex } }
        ]
    };
};

const stateQuery = (phone) => {
    const tail = digitsOnly(phone).slice(-10);
    const regex = tailRegex(phone);
    return {
        $or: [
            { phoneDigits: { $regex: `${tail}$` } },
            { chatId: { $regex: regex } }
        ]
    };
};

const inferCase = ({ text = '', order = null, shipment = null }) => {
    const body = normalize(text);
    if (/(guia|rastreo|tracking|codigo|para cuando|cuando llega|demora|tarda|pedido.*llega)/.test(body)) {
        return {
            intent: 'guia_tiempo_entrega',
            audio: 'TEMPO_DEMORA_PRODUTO_CHEGAR',
            text: 'Enviaremos su guia en breve. El pedido normalmente demora de 2 a 5 dias habiles para llegar, pero puede llegar antes.'
        };
    }
    if (/(como|cuando|dosis|tomar|toma|uso|usar|indicaciones)/.test(body)) {
        return {
            intent: 'como_tomar',
            audio: 'COMO_SE_TOMA_VIT_POWER',
            text: 'Le envio ahora las indicaciones de uso para que lo tome correctamente.'
        };
    }
    if (/(no.*efecto|sin efecto|no.*funcion|no.*sirv|resultado|consumi)/.test(body)) {
        return {
            intent: 'no_hizo_efecto',
            audio: 'TEMPO_RESULTADO_VIT_POWER',
            text: 'Le envio una explicacion corta sobre el tiempo de resultado; depende de cada organismo y de la constancia.'
        };
    }
    if (/(presion|hipertension|hipertenso|diabet|contraindic|medicament|operad|corazon|higado|rinon|riñon)/.test(body)) {
        return {
            intent: 'seguridad_contraindicacion',
            audio: '100_NATURAL_SEM_CONTRA_INDICACAO',
            text: 'Le explico con cuidado la parte natural y de seguridad del producto.'
        };
    }
    if (/(no se.*trata|que producto|q producto|de que se trata|origen|informacion|info|duda)/.test(body)) {
        return {
            intent: 'producto_origen',
            audio: 'DUVIDAS',
            text: 'Le explico cortito de que se trata Vit Power y seguimos por aqui.'
        };
    }
    if (/(precio|valor|cuanto cuesta|promocion|promo)/.test(body)) {
        return {
            intent: 'precio',
            audio: 'TRATAMENTO_Y_PRECIOS_PROMOCAO',
            text: 'Le paso la promocion oficial: 1 frasco $39, 3 frascos $95.99 y 6 frascos $167.99.'
        };
    }
    if (/(quiero|deseo|mand|envi|pedido|producto|comprar|confirm)/.test(body)) {
        return {
            intent: 'pedido',
            audio: '',
            text: order
                ? `Ya tengo su pedido registrado${shipment?.logistics?.trackingNumber ? ` con guia ${shipment.logistics.trackingNumber}` : ''}. Seguimos por aqui para darle continuidad.`
                : 'Perfecto, seguimos con su pedido por aqui. Me confirma cuantos frascos desea: 1, 3 o 6?'
        };
    }
    return {
        intent: 'revisar_manual',
        audio: '',
        text: 'Tengo su historial aqui y sigo revisando para darle continuidad sin repetir todo.'
    };
};

const conciseSummary = ({ order = null, shipment = null, lastInbound = null }) => {
    const parts = [];
    if (order?.customer?.name) parts.push(`cliente ${order.customer.name}`);
    if (order?.status) parts.push(`pedido ${order.status}`);
    if (order?.package?.quantity) parts.push(`${order.package.quantity} frasco(s)`);
    if (order?.total) parts.push(`valor $${order.total}`);
    if (order?.customer?.city || order?.customer?.province) {
        parts.push([order.customer.city, order.customer.province].filter(Boolean).join(', '));
    }
    if (shipment?.logistics?.trackingNumber) parts.push(`guia ${shipment.logistics.trackingNumber}`);
    if (shipment?.logistics?.status) parts.push(`logistica ${shipment.logistics.status}`);
    if (lastInbound?.body) parts.push(`ultimo mensaje: "${String(lastInbound.body).slice(0, 90)}"`);
    return parts.join(' | ') || 'historial localizado no CRM';
};

let currentBatch = 1;

const resetBatchIfNeeded = (counters) => {
    if (!connectedSessions.length) return;
    const lowestCount = Math.min(...connectedSessions.map((sessionId) => counters.get(sessionId) || 0));
    if (lowestCount < maxPerSession) return;
    for (const sessionId of connectedSessions) counters.set(sessionId, 0);
    currentBatch += 1;
};

const chooseSession = ({ preferred = '', counters }) => {
    resetBatchIfNeeded(counters);
    const cleanPreferred = digitsOnly(preferred);
    if (connectedSessions.includes(cleanPreferred) && counters.get(cleanPreferred) < maxPerSession) {
        counters.set(cleanPreferred, counters.get(cleanPreferred) + 1);
        return { sessionId: cleanPreferred, batch: currentBatch };
    }
    const available = connectedSessions
        .map((sessionId) => ({ sessionId, count: counters.get(sessionId) || 0 }))
        .sort((a, b) => a.count - b.count);
    const selected = available[0]?.sessionId || connectedSessions[0] || '';
    if (selected) counters.set(selected, (counters.get(selected) || 0) + 1);
    return { sessionId: selected, batch: currentBatch };
};

const discoverPhonesFromDownSession = async () => {
    const rows = await Message.find({
        createdAt: { $gte: since },
        isFromMe: false,
        isBot: false,
        $or: [
            { sessionId: downSessionId },
            { ownerPhoneDigits: downSessionId }
        ]
    }).sort({ createdAt: 1 }).lean();
    return [...new Set(rows.map((item) => digitsOnly(item.peerPhone || item.chatId)).filter((item) => item.length >= 10))];
};

await connectDB();

const phones = argvPhones.length ? [...new Set(argvPhones)] : await discoverPhonesFromDownSession();
const counters = new Map(connectedSessions.map((sessionId) => [sessionId, 0]));
const plan = [];

for (const phone of phones) {
    const [state, messages, order, shipment] = await Promise.all([
        ContactState.findOne(stateQuery(phone)).sort({ updatedAt: -1 }).lean(),
        Message.find(phoneQuery(phone)).sort({ createdAt: -1, timestamp: -1 }).limit(16).lean(),
        Order.findOne({ country: 'EC', 'customer.phone': { $regex: digitsOnly(phone).slice(-10) } }).sort({ updatedAt: -1, createdAt: -1 }).lean(),
        Shipment.findOne({ country: 'EC', 'client.phone': { $regex: digitsOnly(phone).slice(-10) } }).sort({ updatedAt: -1, createdAt: -1 }).lean()
    ]);
    const chronological = [...messages].reverse();
    const lastInbound = messages.find((item) => !item.isFromMe && !item.isBot) || null;
    const lastOutbound = messages.find((item) => item.isFromMe || item.isBot) || null;
    const casePlan = inferCase({ text: lastInbound?.body || state?.lastInboundText || '', order, shipment });
    const assignment = chooseSession({
        preferred: state?.metadata?.senderWallet?.assignedSessionId || state?.metadata?.lastSessionId || '',
        counters
    });
    const assignedSession = assignment.sessionId;
    const suffix = assignedSession ? assignedSession.slice(-4) : '----';
    const needsReply = !lastOutbound || (lastInbound && new Date(lastInbound.createdAt) > new Date(lastOutbound.createdAt));
    const summary = conciseSummary({ order, shipment, lastInbound });
    plan.push({
        phone,
        needsReply,
        batch: assignment.batch,
        assignedSession,
        handoffText: `Señor, le escribe Ana López por este numero final ${suffix}. El otro numero esta temporalmente fuera de servicio, pero ya tengo su historial aqui y seguimos sin repetir todo.`,
        summaryText: `Resumen: ${summary}`,
        productPhoto: 'vit_power_bottle',
        nextText: casePlan.text,
        nextAudio: casePlan.audio,
        intent: casePlan.intent,
        lastInboundAt: lastInbound?.createdAt || state?.lastInboundAt || null,
        lastOutboundAt: lastOutbound?.createdAt || state?.lastOutboundAt || null,
        orderId: order?.orderId || '',
        orderStatus: order?.status || '',
        shipmentStatus: shipment?.logistics?.status || '',
        trackingNumber: shipment?.logistics?.trackingNumber || '',
        recentHistory: chronological.slice(-6).map((item) => ({
            at: item.createdAt,
            role: item.isFromMe || item.isBot ? 'bot' : 'cliente',
            body: String(item.body || '').slice(0, 180)
        }))
    });
}

const report = {
    mode: 'dry_run_only',
    since: since.toISOString(),
    downSessionId,
    connectedSessions,
    safePeriodRecommendation: '30 minutos apos status scanning/not_ready/logout e 2 ciclos de reconexao falhos; para queda prevista de 3 dias, o repasse pode ser planejado agora em lotes pequenos.',
    batchRule: `maximo ${maxPerSession} clientes por numero conectado por lote, alternando sessoes e aguardando intervalo operacional antes do proximo lote`,
    totals: {
        phones: plan.length,
        needsReply: plan.filter((item) => item.needsReply).length,
        bySession: Object.fromEntries(connectedSessions.map((sessionId) => [sessionId, plan.filter((item) => item.assignedSession === sessionId).length]))
    },
    plan
};

console.log(JSON.stringify(report, null, 2));
await mongoose.disconnect();
