import assert from 'node:assert/strict';
import test from 'node:test';
import {
    classifyEcConversationSnapshot,
    conversationBucketPanelView
} from '../src/services/ecConversationBucketService.js';
import {
    isPendingVslPrelead,
    mergeClaimedVslPreleadIntoContactState,
    projectVslPreleadPanelChat
} from '../src/services/vslPreleadPanelService.js';
import { evaluateTrafficReadinessV171 } from '../src/services/trafficReadinessV171Service.js';
import { selectUniqueVslAttributionCandidate } from '../src/services/metaAttributionBridgeService.js';
import fs from 'node:fs';
import vm from 'node:vm';

await import('../public/panel-intelligence/ec-engagement-priority-v43.js');
const engagementPriority = globalThis.VitalismenEngagementPriorityV43;
const qaPhone = '5515998038637';

test('QA 8637 legado engagement é projetado e reclassificado como attendance', () => {
    const state = { phoneDigits: qaPhone, conversationBucket: { value: 'engagement', manualSelectedAt: new Date() }, metadata: { warmup: { allowed: true } } };
    const classification = classifyEcConversationSnapshot({ state, messages: [], orders: [], shipments: [], now: new Date() });
    assert.equal(classification.bucket, 'attendance');
    assert.deepEqual(classification.reasons, ['qa_8637_attendance_only']);
    assert.equal(conversationBucketPanelView(state).value, 'attendance');
});

test('QA 8637 aparece em Novas quando possui unread e permanece attendance após refresh/restart', () => {
    const chat = { phoneDigits: qaPhone, unreadCount: 1, conversationBucket: { value: 'engagement' } };
    const resolve = (value) => conversationBucketPanelView(value).value;
    assert.equal(engagementPriority.isNewMessagesChat(chat, { resolveConversationBucket: resolve }), true);
    const restarted = JSON.parse(JSON.stringify(chat));
    assert.equal(conversationBucketPanelView(restarted).value, 'attendance');
    assert.equal(engagementPriority.isNewMessagesChat(restarted, { resolveConversationBucket: resolve }), true);
});

test('outro contato legítimo de aquecimento continua engagement', () => {
    const state = { phoneDigits: '593991112233', conversationBucket: { value: 'engagement', manualSelectedAt: new Date() }, metadata: { warmup: { allowed: true } } };
    assert.equal(conversationBucketPanelView(state).value, 'engagement');
});

test('prelead Tex Ultra não inventa telefone e permanece disponível para correlação', () => {
    const visit = { _id: 'visit-1', visitorKey: 'vk-1', country: 'EC', productKey: 'tex_ultra_ec', productName: 'Tex Ultra Ecuador', clickCount: 1, lastClickAt: new Date(), customerPhone: '', path: '/protocolo-g' };
    assert.equal(isPendingVslPrelead(visit), true);
    const chat = projectVslPreleadPanelChat(visit);
    assert.equal(chat.phone, '');
    assert.equal(chat.vslPrelead, true);
    assert.equal(chat.conversationBucket.value, 'attendance');
    assert.match(chat.name, /VSL · TEX ULTRA/);
});

test('V176 oculta somente prelead anônimo da fila operacional sem apagar telemetria', () => {
    const panel = fs.readFileSync('public/qr.html', 'utf8');
    const start = panel.indexOf('        const isUncontactableVslPrelead =');
    const end = panel.indexOf('        const chatConversationBucket =', start);
    assert.ok(start > 0 && end > start);
    const sandbox = {
        module: { exports: {} },
        chats: [
            { id: 'vsl-prelead:12345678901', vslPrelead: true, phone: '', customerDraft: { phone: '' }, country: 'EC' },
            { id: 'vsl-prelead:linked', vslPrelead: true, phone: '', customerDraft: { phone: '+593990001111' }, country: 'EC' },
            { id: '593990002222@c.us', vslPrelead: false, phone: '+593990002222', country: 'EC' }
        ]
    };
    vm.runInNewContext(`
        const state = { chats, remoteChatSearch: { results: [] }, zapiDevice: {} };
        const window = {};
        const digitsOnlyText = value => String(value || '').replace(/\\D/g, '');
        const selectedOperationalCountry = () => 'EC';
        const dedupeChatsForPanel = value => value;
        const panelChatsIncludingRemoteSearch = () => state.chats;
        const chatMatchesSearch = () => true;
        const isBrazilBlockedRecord = () => false;
        const isBrazilAllowedTestRecord = () => false;
        const isBrazilTestRecord = () => false;
        ${panel.slice(start, end)}
        module.exports = { isUncontactableVslPrelead, visibleOperationalChats };
    `, sandbox);
    assert.equal(sandbox.module.exports.isUncontactableVslPrelead(sandbox.chats[0]), true);
    assert.equal(sandbox.module.exports.isUncontactableVslPrelead(sandbox.chats[1]), false);
    assert.deepEqual(
        sandbox.module.exports.visibleOperationalChats().map((chat) => chat.id),
        ['vsl-prelead:linked', '593990002222@c.us']
    );
    assert.equal(sandbox.chats.length, 3);
});

test('correlação exata única aceita tracking canônico sem exigir Z-API e falha fechada em ambiguidade', () => {
    const now = new Date();
    const base = { country: 'EC', visitorKey: 'vk', productKey: 'tex_ultra_ec', lastClickAt: now, lastWhatsappMessage: 'Hola Tex Ultra', tracking: {} };
    assert.equal(selectUniqueVslAttributionCandidate({ visits: [base], message: 'Hola Tex Ultra', inboundAt: now }).ok, true);
    const ambiguous = selectUniqueVslAttributionCandidate({ visits: [base, { ...base, visitorKey: 'vk2' }], message: 'Hola Tex Ultra', inboundAt: now });
    assert.equal(ambiguous.ok, false);
    assert.equal(ambiguous.reason, 'ambiguous_exact_visit');
});

test('claim canônico consolida origem e produto sem criar telefone falso', () => {
    const state = { metadata: {}, tags: [], productHistory: [], markModified() {} };
    const changed = mergeClaimedVslPreleadIntoContactState({ state, claim: { ok: true, claimed: true, visitId: 'visit-1', visitorId: 'external-1', productKey: 'tex_ultra_ec', productName: 'Tex Ultra Ecuador', tracking: { funnel: 'PROTOCOLO_G' } } });
    assert.equal(changed, true);
    assert.equal(state.metadata.vslVisitId, 'visit-1');
    assert.equal(state.metadata.vslProductKey, 'tex_ultra_ec');
    assert.equal(state.metadata.customerDraft.phone, undefined);
});

test('QA 8637 correlaciona o prelead EC mesmo com telefone brasileiro, sem ampliar a exceção', () => {
    const zapiRoute = fs.readFileSync('src/routes/zapi.js', 'utf8');
    const router = fs.readFileSync('src/services/agentRouter.js', 'utf8');
    assert.match(zapiRoute, /country:\s*authorizedTestRecipient\s*\?\s*'EC'\s*:\s*inferredCountry/);
    assert.match(router, /countryCode === OFFICIAL_COUNTRY \|\| priorityBotTestPhone/);
    assert.doesNotMatch(zapiRoute, /country:\s*'EC',\s*\n\s*phone,\s*\n\s*message:\s*normalizedBody/);
});

test('TRAFFIC_READY falha em strict read-only e passa apenas com runtime, VSL, painel e auth', () => {
    const strict = evaluateTrafficReadinessV171({ health: { status: 'online', automationSafety: { mode: 'SAFE_OBSERVATION_ONLY', policy: 'STRICT_READ_ONLY', strictReadOnly: true, operationalMutationsEnabled: false, mutatingSchedulers: 0, dropiApplyAllowed: false, dropiSyncMode: 'REPORT_ONLY' } }, vslEntry: { accepted: true, ignored: true, reason: 'strict_read_only' }, panelPass: true, authPass: true });
    assert.equal(strict.ready, false);
    const ready = evaluateTrafficReadinessV171({ health: { status: 'online', automationSafety: { mode: 'EC_BOT_CORE_OPERATIONAL', policy: 'EC_BOT_CORE_OPERATIONAL', strictReadOnly: false, botCoreOperational: true, coreMutationRoutesEnabled: true, operationalMutationsEnabled: false, mutatingRoutesEnabled: false, mutatingSchedulers: 0, dropiApplyAllowed: false, dropiSyncMode: 'REPORT_ONLY' } }, vslEntry: { accepted: true, ignored: false }, panelPass: true, authPass: true });
    assert.equal(ready.ready, true);
});
