import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const sandbox = {};
sandbox.globalThis = sandbox;
for (const file of ['panel-warmup-isolation-v118.js', 'ec-engagement-priority-v43.js']) {
    vm.runInNewContext(fs.readFileSync(`public/panel-intelligence/${file}`, 'utf8'), sandbox);
}
const policy = sandbox.VitalismenPanelWarmupIsolationV118;
const priority = sandbox.VitalismenEngagementPriorityV43;
const page = fs.readFileSync('public/qr.html', 'utf8');
const renderSource = page.slice(page.indexOf('        const renderChats = () => {'), page.indexOf('        const renderChats = () => {') + 21000);
const filterSource = renderSource.slice(renderSource.indexOf('const warmupIsolationDecision'), renderSource.indexOf('            }).sort('));
const passesPanelFilter = (chat, { searchActive = false, bucket = 'attendance', filter = 'all' } = {}) => {
    const context = {
        chat, searchActive, state: { conversationBucketFilter: bucket, chatFilter: filter }, search: searchActive ? 'fixture' : '',
        window: sandbox, chatConversationBucket: c => c.conversationBucket.value,
        applyOperationalBucketFilter: !searchActive && filter !== 'unread',
        isNewMessagesChatForPanel: c => priority.isNewMessagesChat(c),
        chatMatchesSearch: () => true, isFavoriteChat: () => true, hasVisibleLabels: () => true
    };
    return vm.runInNewContext(`(()=>{${filterSource}})()`, context);
};
const chat = (id, value) => ({ id, conversationBucket: { value }, unreadCount: 1, messages: ['history'] });

test('A/B: Aquecimento tem contador proprio e nunca entra em Atendimento/Novas, inclusive busca', () => {
    const a = chat('A', 'engagement');
    const b = chat('B', 'attendance');
    for (const searchActive of [false, true]) {
        assert.equal(passesPanelFilter(a, { searchActive }), false);
        assert.equal(passesPanelFilter(a, { searchActive, filter: 'unread' }), false);
        assert.equal(passesPanelFilter(b, { searchActive }), true);
        assert.equal(passesPanelFilter(b, { searchActive, filter: 'unread' }), true);
        assert.equal(passesPanelFilter(a, { searchActive, bucket: 'engagement' }), true);
    }
    assert.equal(priority.bucketUnreadCounts([a, b]).engagement, 1);
    assert.equal(policy.commercialChats([a, b]).length, 1);
    assert.equal(priority.isNewMessagesChat(a), false);
    const history = b.messages;
    b.conversationBucket.value = 'engagement';
    assert.equal(policy.commercialChats([a, b]).length, 0);
    assert.equal(priority.bucketUnreadCounts([a, b]).engagement, 2);
    assert.equal(passesPanelFilter(b), false);
    assert.equal(b.messages, history);
});

test('busca global continua encontrando pedidos comerciais, com Novas limitado aos pendentes', () => {
    const order = chat('order', 'orders');
    assert.equal(passesPanelFilter(order, { searchActive: true }), true);
    order.unreadCount = 0;
    assert.equal(passesPanelFilter(order, { searchActive: true, filter: 'unread' }), false);
});

test('coluna de contatos nao renderiza texto da entrada VSL', () => {
    const list = renderSource.match(/return `\s*<button class="chat-item[\s\S]*?<\/button>\s*`;/)?.[0];
    assert.ok(list, 'template real da lista deve ser encontrado');
    assert.doesNotMatch(list, /vslEntryPhraseForPanel\(chat\)|vslEntryMessage|lastMessage\??\.body/);
});

test('API agrega entradas e contatos ativos comerciais sem somar Aquecimento', async () => {
    const [{ default: routes }, { default: ContactState }, { default: Order }, { default: VslVisit }] = await Promise.all([
        import('../src/routes/whatsapp.js'), import('../src/models/ContactState.js'),
        import('../src/models/Order.js'), import('../src/models/VslVisit.js')
    ]);
    const now = new Date();
    const contacts = ['attendance', 'engagement'].map((value, i) => ({
        phoneDigits: `59399999999${i}`, chatId: `59399999999${i}@c.us`,
        conversationBucket: { value }, firstInboundAt: now, lastInboundAt: now, metadata: {}
    }));
    const original = [ContactState.find, Order.find, VslVisit.countDocuments];
    ContactState.find = () => ({ lean: async () => contacts });
    Order.find = () => ({ lean: async () => [] });
    VslVisit.countDocuments = async () => 0;
    try {
        const response = { status() { return this; }, json(body) { this.body = body; return this; } };
        const handler = routes.stack.find(s => s.route?.path === '/dashboard-metrics').route.stack.at(-1).handle;
        await handler({ query: { country: 'EC', sessionId: 'zapi' } }, response);
        assert.equal(response.body.totalClients, 2);
        assert.equal(response.body.commercialTotalClients, 1);
        for (const period of ['today', 'week', 'month']) {
            assert.equal(response.body[period].entered, 1);
            assert.equal(response.body[period].active, 1);
        }
    } finally {
        [ContactState.find, Order.find, VslVisit.countDocuments] = original;
    }
});
