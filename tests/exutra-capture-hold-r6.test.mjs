import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

// Evaluate the real, dependency-free guard and CAS operation. No app startup,
// database connection, provider call or Meta request is possible in this VM.
const source = fs.readFileSync(new URL('../src/routes/zapi.js', import.meta.url), 'utf8');
const start = source.indexOf('export const canReleaseExutraCaptureHold =');
const end = source.indexOf('\nconst normalizeVslText =', start);
assert.ok(start > 0 && end > start);
const context = vm.createContext({ URL, Date, ContactState: {}, Message: {} });
vm.runInContext(source.slice(start, end).replaceAll('export const ', 'var '), context);
const { canReleaseExutraCaptureHold, releaseExutraCaptureHold } = context;
const now = new Date('2026-10-01T01:26:39Z');
const fixture = () => ({
    state: { _id: 'fixture', chatId: 'fixture-chat', phoneDigits: 'fixture-phone', countryCode: 'EC',
        createdAt: new Date('2026-10-01T01:26:35Z'), updatedAt: now,
        firstInboundAt: new Date('2026-10-01T01:26:35Z'),
        human: { mode: 'manual', lastManualBy: 'zapi', assignedName: 'Captura Z-API',
            lastManualAt: new Date('2026-10-01T01:26:35Z') },
        metadata: { zapiCapturedAt: new Date('2026-10-01T01:26:35Z'),
            vslVisitId: 'visit-fixture', vslVariant: 'exutra', vslProductKey: 'tex_ultra_ec',
            metaAttributionBridge: { source: 'zapi_exact_message_unique_120s' } } },
    attribution: { ok: true, claimed: true, confidence: 'exact_message_unique_120s',
        visitId: 'visit-fixture', sourceUrl: 'https://maxlien.shop/exutra?utm_source=fb',
        productKey: 'tex_ultra_ec' }, now, hasHumanOutbound: false
});

test('EXUTRA válida e captura recente libera; consultas não têm efeito externo', () => {
    assert.equal(canReleaseExutraCaptureHold(fixture()), true);
    assert.equal(canReleaseExutraCaptureHold({ ...fixture(), hasHumanOutbound: true }), false);
    assert.equal(canReleaseExutraCaptureHold({ ...fixture(), hasHumanOutbound: undefined }), false);
});

for (const [name, mutate] of [
    ['humano assumiu', f => { f.state.human.lastManualBy = 'panel'; }],
    ['humano atribuído', f => { f.state.human.assignedTo = 'operator'; }],
    ['hold com pausa', f => { f.state.human.pausedUntil = new Date('2026-10-02'); }],
    ['outbound anterior', f => { f.state.lastOutboundAt = now; }],
    ['produto selecionado pelo humano', f => { f.state.metadata.productRouteLock = { active: true }; }],
    ['contato antigo', f => { f.state.createdAt = new Date('2026-09-01'); }],
    ['captura antiga', f => { f.state.human.lastManualAt = new Date('2026-09-30'); }],
    ['timestamp futuro', f => { f.state.createdAt = new Date('2026-10-02'); }],
    ['sem timestamp', f => { delete f.state.firstInboundAt; }],
    ['outro funil /n/', f => { f.attribution.sourceUrl = 'https://ec.maxlien.shop/n/'; }],
    ['Protocolo G', f => { f.state.metadata.vslVariant = 'protocolo_g'; }],
    ['outro produto', f => { f.attribution.productKey = 'vit_power_ec'; }],
    ['origem forjada', f => { f.attribution.sourceUrl = 'https://maxlien.shop.evil/exutra'; }],
    ['origem ausente', f => { delete f.attribution.sourceUrl; }],
    ['atribuição ambígua', f => { f.attribution.confidence = 'ambiguous'; }],
    ['claim não persistido', f => { f.attribution.claimed = false; }],
    ['visit diferente', f => { f.state.metadata.vslVisitId = 'other'; }],
]) test(`${name} permanece bloqueado`, () => {
    const f = fixture(); mutate(f); assert.equal(canReleaseExutraCaptureHold(f), false);
});

test('outbound humano bloqueia antes da atualização; erro de consulta não libera', async () => {
    let writes = 0;
    const StateModel = { findOneAndUpdate() { writes++; } };
    assert.equal(await releaseExutraCaptureHold({ ...fixture(), StateModel,
        MessageModel: { exists: async () => ({ _id: 'human-outbound' }) } }), null);
    assert.equal(writes, 0);
    await assert.rejects(releaseExutraCaptureHold({ ...fixture(), StateModel,
        MessageModel: { exists: async () => { throw Error('read_failed'); } } }));
    assert.equal(writes, 0);
});

test('retry concorrente promove uma vez; takeover concorrente vence o CAS', async () => {
    const f = fixture(); let currentVersion = f.state.updatedAt; let promotions = 0;
    const StateModel = { async findOneAndUpdate(filter, update) {
        assert.equal(filter['human.lastManualBy'], 'zapi');
        assert.equal(update.$set['human.lastManualBy'], 'tex_ultra_vsl_entry_ready');
        if (currentVersion !== filter.updatedAt) return null;
        currentVersion = new Date(now.getTime() + 1); promotions++;
        return { human: { mode: 'auto' } };
    } };
    const input = { ...f, StateModel, MessageModel: { exists: async () => null } };
    const results = await Promise.all([releaseExutraCaptureHold(input), releaseExutraCaptureHold(input)]);
    assert.equal(results.filter(Boolean).length, 1); assert.equal(promotions, 1);
    assert.equal(await releaseExutraCaptureHold(input), null);
});
