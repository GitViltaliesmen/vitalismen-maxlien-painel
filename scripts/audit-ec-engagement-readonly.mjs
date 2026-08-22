import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../src/config/db.js';
import ContactState from '../src/models/ContactState.js';
import Message from '../src/models/Message.js';
import Order from '../src/models/Order.js';
import Shipment from '../src/models/Shipment.js';
import {
    auditEcConversationContact,
    classifyEcConversationSnapshot,
    conversationBucketPanelView,
    findEcContactState
} from '../src/services/ecConversationBucketService.js';
import { ecEngagementReplyPolicy } from '../src/services/ecEngagementReplyService.js';

const digitsOnly = (value = '') => String(value || '').replace(/\D/g, '');
const tail = (value = '') => {
    const digits = digitsOnly(value);
    return digits.length >= 9 ? digits.slice(-9) : digits;
};
const maskPhone = (value = '') => {
    const digits = digitsOnly(value);
    return digits ? `***${digits.slice(-4)}` : '';
};
const argValue = (name) => {
    const index = process.argv.indexOf(name);
    return index >= 0 ? String(process.argv[index + 1] || '') : '';
};

await connectDB();

try {
    const phone = digitsOnly(argValue('--phone'));
    const populationMode = process.argv.includes('--population');
    if (phone) {
        const state = await findEcContactState({ phone });
        if (!state) throw new Error(`Contato nao encontrado: ${phone}`);
        const classification = await auditEcConversationContact(state);
        console.log(JSON.stringify({
            mode: 'READ_ONLY',
            generatedAt: new Date().toISOString(),
            contact: {
                phone: state.phoneDigits || phone,
                chatId: state.chatId || '',
                name: state.metadata?.customerDraft?.name || state.metadata?.profileName || '',
                orderId: state.metadata?.customerDraft?.orderId || '',
                currentBucket: conversationBucketPanelView(state)
            },
            classification,
            policy: ecEngagementReplyPolicy()
        }, null, 2));
    } else if (populationMode) {
        const [states, messages, orders, shipments] = await Promise.all([
            ContactState.find({ countryCode: 'EC' }).lean(),
            Message.find({}).select('_id chatId peerPhone from to body type hasMedia timestamp isFromMe senderRole providerMessageId createdAt').lean(),
            Order.find({ country: 'EC' }).lean(),
            Shipment.find({ country: 'EC' }).lean()
        ]);
        const stateByTail = new Map(states.map((state) => [tail(state.phoneDigits || state.chatId), state]).filter(([key]) => key));
        const messagesByTail = new Map();
        for (const message of messages) {
            const key = tail(message.peerPhone || message.chatId || message.from || message.to);
            if (!stateByTail.has(key)) continue;
            const list = messagesByTail.get(key) || [];
            list.push(message);
            messagesByTail.set(key, list);
        }
        const ordersByTail = new Map();
        for (const order of orders) {
            const key = tail(order.customer?.phone);
            if (!key) continue;
            const list = ordersByTail.get(key) || [];
            list.push(order);
            ordersByTail.set(key, list);
        }
        const shipmentsByTail = new Map();
        for (const shipment of shipments) {
            const key = tail(shipment.client?.phone);
            if (!key) continue;
            const list = shipmentsByTail.get(key) || [];
            list.push(shipment);
            shipmentsByTail.set(key, list);
        }
        const results = [...stateByTail.entries()].map(([key, state]) => ({
            key,
            name: state.metadata?.customerDraft?.name || state.metadata?.profileName || '',
            classification: classifyEcConversationSnapshot({
                state,
                messages: messagesByTail.get(key) || [],
                orders: ordersByTail.get(key) || [],
                shipments: shipmentsByTail.get(key) || [],
                now: new Date()
            })
        }));
        const counts = { attendance: 0, engagement: 0, orders: 0, review: 0 };
        results.forEach(({ classification }) => { counts[classification.bucket] += 1; });
        const safeCandidates = results
            .filter(({ classification }) => classification.bucket === 'engagement')
            .sort((left, right) => right.classification.score - left.classification.score)
            .slice(0, 50)
            .map(({ key, name, classification }) => ({
                phone: maskPhone(key),
                name,
                score: classification.score,
                confidence: classification.confidence,
                reasons: classification.reasons,
                metrics: classification.metrics
            }));
        console.log(JSON.stringify({
            mode: 'READ_ONLY',
            generatedAt: new Date().toISOString(),
            population: results.length,
            counts,
            safeCandidateCount: results.filter(({ classification }) => classification.bucket === 'engagement').length,
            safeCandidates,
            policy: ecEngagementReplyPolicy()
        }, null, 2));
    } else {
        console.log('Uso: npm run audit:ec-engagement -- --phone 593... | --population');
    }
} finally {
    await mongoose.disconnect();
}
