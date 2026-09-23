import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    V191_LEDGER_STATES,
    V191_QA_PHONE,
    buildVslIngressLedgerV191,
    hashV191Phone,
    inspectV191LedgerByPhone
} from '../src/services/vslIngressLedgerV191Service.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const t0 = new Date('2026-09-19T04:31:57.892Z');
const now = new Date('2026-09-19T05:00:00.000Z');
const entryBody = 'Hola, quiero el tratamiento Tex Ultra.\nNombre: Cliente Fixture\nCIUDAD: Guayaquil\nPROVINCIA: Guayas';

const inbound = (overrides = {}) => ({
    _id: 'inbound-1',
    chatId: '593986001564@c.us',
    peerPhone: '593986001564',
    from: '593986001564@c.us',
    to: '5531971862958@c.us',
    body: entryBody,
    type: 'chat',
    timestamp: Math.floor(t0.getTime() / 1000),
    sessionId: 'zapi',
    isFromMe: false,
    isBot: false,
    provider: 'zapi',
    providerMessageId: 'zapi-inbound-1',
    deliveryStatus: 'received',
    createdAt: t0,
    updatedAt: t0,
    ...overrides
});
const outbound = (overrides = {}) => ({
    _id: 'outbound-1',
    chatId: '593986001564@c.us',
    peerPhone: '593986001564',
    from: 'bot',
    to: '593986001564@c.us',
    body: 'Resposta sanitizada de fixture',
    type: 'chat',
    sessionId: 'zapi',
    isFromMe: true,
    isBot: true,
    senderRole: 'bot',
    provider: 'zapi',
    providerMessageId: 'zapi-outbound-1',
    providerStatus: 'read',
    deliveryStatus: 'read',
    ack: 3,
    deliveredAt: new Date('2026-09-19T04:32:08.419Z'),
    readAt: new Date('2026-09-19T04:35:06.631Z'),
    createdAt: new Date('2026-09-19T04:32:03.203Z'),
    updatedAt: new Date('2026-09-19T04:35:06.631Z'),
    ...overrides
});

const contactState = (overrides = {}) => ({
    _id: 'state-1',
    chatId: '593986001564@c.us',
    phoneDigits: '593986001564',
    human: { mode: 'auto' },
    conversationBucket: { value: 'attendance' },
    metadata: {
        vslVariant: 'protocolo_g',
        vslProductKey: 'tex_ultra_ec'
    },
    ...overrides
});

const visit = (overrides = {}) => ({
    _id: '68cce5f59f45ad71b257abcd',
    visitorKey: 'EC:fixture',
    visitorId: 'fixture-visitor',
    externalId: 'fixture-external',
    customerPhone: '',
    country: 'EC',
    productKey: 'tex_ultra_ec',
    funnel: 'PROTOCOLO_G',
    lastWhatsappMessage: entryBody,
    lastEntryMessage: entryBody,
    vslEntryMessage: entryBody,
    clickCount: 1,
    lastClickAt: new Date('2026-09-19T04:33:11.621Z'),
    lastSeenAt: new Date('2026-09-19T04:33:11.621Z'),
    attributionClaimedAt: null,
    ...overrides
});

const build = (overrides = {}) => buildVslIngressLedgerV191({
    messages: [inbound(), outbound()],
    queueMessages: [],
    visits: [],
    contactStates: [contactState()],
    now,
    windowStart: new Date('2026-09-19T04:00:00.000Z'),
    slaSeconds: 120,
    queueStaleSeconds: 120,
    includeQa: false,
    ...overrides
});

test('1. inbound seguido de isFromMe posterior produz FIRST_OUTBOUND', () => {
    const result = build({ messages: [inbound(), outbound({ providerMessageId: '', providerStatus: '', deliveryStatus: '', ack: 0, deliveredAt: null, readAt: null })] });
    assert.equal(result.ledger[0].classification, 'FIRST_OUTBOUND');
    assert.equal(result.ledger[0].firstOutboundAt, '2026-09-19T04:32:03.203Z');
});

test('2. providerMessageId explícito comprova PROVIDER_ACCEPTED', () => {
    const result = build({ messages: [inbound(), outbound({ providerStatus: '', deliveryStatus: '', ack: 0, deliveredAt: null, readAt: null })] });
    assert.equal(result.ledger[0].classification, 'PROVIDER_ACCEPTED');
    assert.equal(result.summary.PROVIDER_ACCEPTED, 1);
});

test('3. ACK 2 ou deliveredAt comprova DELIVERED', () => {
    const result = build({ messages: [inbound(), outbound({ deliveryStatus: 'delivered', providerStatus: 'delivered', ack: 2, readAt: null })] });
    assert.equal(result.ledger[0].classification, 'DELIVERED');
    assert.equal(result.summary.DELIVERED, 1);
});

test('4. ACK 3/readAt comprova READ e preserva os níveis anteriores', () => {
    const result = build();
    assert.equal(result.ledger[0].classification, 'READ');
    assert.equal(result.summary.PROVIDER_ACCEPTED, 1);
    assert.equal(result.summary.DELIVERED, 1);
    assert.equal(result.summary.READ, 1);
});

test('5. callback fora de ordem não regride READ para DELIVERED', () => {
    const result = build({ messages: [inbound(), outbound({ deliveryStatus: 'delivered', providerStatus: 'delivered', ack: 3 })] });
    assert.equal(result.ledger[0].classification, 'READ');
});

test('6. inbound persistido sem outbound após 120s é somente NO_OUTBOUND_AFTER_SLA', () => {
    const result = build({ messages: [inbound()], now: new Date('2026-09-19T04:35:00.000Z') });
    assert.equal(result.ledger[0].classification, 'NO_OUTBOUND_AFTER_SLA');
    assert.equal(result.summary.ORPHAN_INBOUND_AFTER_120S, 1);
    assert.equal(result.summary.FIRST_OUTBOUND_FOUND, 0);
});

test('7. QA é excluído por padrão', () => {
    const qaInbound = inbound({
        _id: 'qa-in',
        chatId: `${V191_QA_PHONE}@c.us`,
        peerPhone: V191_QA_PHONE,
        from: `${V191_QA_PHONE}@c.us`,
        providerMessageId: 'qa-provider-in'
    });
    const result = build({ messages: [qaInbound] });
    assert.equal(result.summary.TOTAL_INBOUNDS, 0);
});

test('8. QA é incluído somente com includeQa', () => {
    const qaInbound = inbound({
        _id: 'qa-in',
        chatId: `${V191_QA_PHONE}@c.us`,
        peerPhone: V191_QA_PHONE,
        from: `${V191_QA_PHONE}@c.us`,
        providerMessageId: 'qa-provider-in'
    });
    const result = build({ messages: [qaInbound], includeQa: true });
    assert.equal(result.summary.TOTAL_INBOUNDS, 1);
    assert.equal(result.summary.REAL_PROTOCOLO_G_ENTRIES_EX_QA, 0);
});

test('9. telefone completo não aparece na projeção pública', () => {
    const serialized = JSON.stringify(build());
    assert.equal(serialized.includes('593986001564'), false);
    assert.equal(build().ledger[0].phoneLast4, '1564');
    assert.equal(build().ledger[0].phoneHash, hashV191Phone('593986001564'));
});

test('10. texto integral não aparece; somente messageType e messageBodyHash', () => {
    const result = build();
    const serialized = JSON.stringify(result);
    assert.equal(serialized.includes(entryBody), false);
    assert.equal(result.ledger[0].messageType, 'chat');
    assert.match(result.ledger[0].messageBodyHash, /^[a-f0-9]{64}$/);
});

test('11. vslVisitId persistido produz VSL_LINKED sem correlação nova', () => {
    const linkedVisit = visit({ customerPhone: '593986001564', attributionClaimedAt: t0 });
    const linkedState = contactState({
        metadata: {
            vslVisitId: linkedVisit._id,
            vslVariant: 'protocolo_g',
            vslProductKey: 'tex_ultra_ec'
        }
    });
    const result = build({ visits: [linkedVisit], contactStates: [linkedState] });
    assert.equal(result.ledger[0].vslLinked, true);
    assert.match(result.ledger[0].vslVisitIdHash, /^[a-f0-9]{64}$/);
    assert.equal(result.summary.VSL_LINKED, 1);
});

test('12. bridge tardio sem vínculo vira somente LATE_ATTRIBUTION_CANDIDATE', () => {
    const result = build({ visits: [visit()] });
    assert.equal(result.ledger[0].vslLinked, false);
    assert.equal(result.ledger[0].lateAttributionCandidate, true);
    assert.equal(result.summary.LATE_ATTRIBUTION_CANDIDATES, 1);
});

test('13. watchdog failed após first outbound vira candidato de falso positivo', () => {
    const state = contactState({
        metadata: {
            vslVariant: 'protocolo_g',
            vslProductKey: 'tex_ultra_ec',
            vslFirstResponseWatchdogStatus: 'failed',
            vslFirstResponseWatchdogReason: 'no_outbound_after_reprocess'
        }
    });
    const result = build({ contactStates: [state] });
    assert.equal(result.ledger[0].watchdogFalsePositiveCandidate, true);
    assert.equal(result.summary.WATCHDOG_FALSE_POSITIVE_CANDIDATES, 1);
});

test('14. clique sem inbound confirmado não é chamado BOT_DROPPED_LEAD', () => {
    const clickOnly = visit({
        _id: '68cce5f59f45ad71b2570000',
        lastWhatsappMessage: 'mensagem sem inbound correspondente',
        lastEntryMessage: 'mensagem sem inbound correspondente',
        vslEntryMessage: 'mensagem sem inbound correspondente',
        lastClickAt: new Date('2026-09-19T04:45:00.000Z')
    });
    const result = build({ visits: [clickOnly] });
    assert.equal(result.summary.CLICK_WITHOUT_CONFIRMED_INBOUND, 1);
    assert.equal(JSON.stringify(result).includes('BOT_DROPPED_LEAD'), false);
});

test('15. runtime V191 não contém chamadas Mongo mutantes', () => {
    const files = [
        path.join(repoRoot, 'src/services/vslIngressLedgerV191Service.js'),
        path.join(repoRoot, 'scripts/audit-vsl-ingress-ledger-v191.mjs')
    ];
    const forbidden = /\.(?:save|create|insertOne|insertMany|updateOne|updateMany|findOneAndUpdate|replaceOne|bulkWrite|deleteOne|deleteMany)\s*\(/;
    for (const file of files) assert.doesNotMatch(fs.readFileSync(file, 'utf8'), forbidden, file);
});

test('16. runtime V191 não importa outbound, roteador, Meta ou Dropi', () => {
    const files = [
        path.join(repoRoot, 'src/services/vslIngressLedgerV191Service.js'),
        path.join(repoRoot, 'scripts/audit-vsl-ingress-ledger-v191.mjs')
    ];
    const source = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
    assert.doesNotMatch(source, /from\s+['"][^'"]*(?:zapiClient|agentRouter|metaCapi|dropi|droppi)[^'"]*['"]/i);
    assert.doesNotMatch(source, /\b(?:sendMessage|sendText|sendAudio|routeIncomingMessage|sendPurchase)\s*\(/);
});

test('17. caso Kleber fixture resulta READ e 5311ms sem vínculo escrito', () => {
    const result = build({
        visits: [visit()],
        contactStates: [contactState({
            metadata: {
                vslVariant: 'protocolo_g',
                vslProductKey: 'tex_ultra_ec',
                vslFirstResponseWatchdogStatus: 'failed'
            }
        })]
    });
    const inspected = inspectV191LedgerByPhone(result, '593986001564');
    assert.equal(inspected.phoneLast4, '1564');
    assert.equal(inspected.classification, 'READ');
    assert.equal(inspected.firstReplyLatencyMs, 5311);
    assert.equal(inspected.deliveredAt, '2026-09-19T04:32:08.419Z');
    assert.equal(inspected.readAt, '2026-09-19T04:35:06.631Z');
    assert.equal(inspected.vslLinked, false);
    assert.equal(inspected.lateAttributionCandidate, true);
});

test('18. fila stale, outbound falho, rota observada e identidade ambígua são auditáveis', () => {
    const ambiguous = inbound({
        _id: 'ambiguous',
        providerMessageId: '',
        body: 'outra mensagem',
        createdAt: new Date('2026-09-19T04:40:00.000Z'),
        queueClaimedAt: new Date('2026-09-19T04:40:01.000Z')
    });
    const stale = inbound({
        _id: 'stale',
        providerMessageId: 'stale-in',
        body: 'fila stale',
        createdAt: new Date('2026-09-19T04:40:00.000Z'),
        queueStatus: 'PENDING'
    });
    const failed = outbound({
        _id: 'failed-out',
        chatId: '593999999999@c.us',
        peerPhone: '593999999999',
        to: '593999999999@c.us',
        deliveryStatus: 'failed',
        providerStatus: 'failed',
        ack: -1,
        createdAt: new Date('2026-09-19T04:50:00.000Z'),
        deliveredAt: null,
        readAt: null
    });
    const result = build({ messages: [ambiguous, failed], queueMessages: [stale] });
    assert.equal(result.ledger[0].classification, 'AMBIGUOUS');
    assert.equal(result.ledger[0].routeAttemptObservedAt, '2026-09-19T04:40:01.000Z');
    assert.equal(result.summary.AMBIGUOUS, 1);
    assert.equal(result.summary.STALE_PENDING_QUEUE, 1);
    assert.equal(result.summary.FAILED_ZAPI_OUTBOUND, 1);
    assert.deepEqual(V191_LEDGER_STATES, [
        'RECEIVED', 'PERSISTED', 'ROUTE_OBSERVED', 'FIRST_OUTBOUND',
        'PROVIDER_ACCEPTED', 'DELIVERED', 'READ', 'NO_OUTBOUND_AFTER_SLA', 'AMBIGUOUS'
    ]);
});
