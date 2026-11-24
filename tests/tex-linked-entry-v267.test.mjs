import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { preferTexLinkedEntryV267 } from '../src/services/texUltraLinkedEntryV267Service.js';

const reference = `TX243-${'a'.repeat(64)}`;
const entry = `Hola, quiero el tratamiento Tex Ultra.\nReferencia: ${reference}`;
const state = () => ({
    countryCode: 'EC',
    human: { mode: 'auto' },
    metadata: { productKey: 'tex_ultra_ec', lastSessionId: 'default' }
});
const input = () => ({ text: entry, state: state(), productKey: 'tex_ultra_ec', sourceMessageId: 'SIM_INBOUND_V267', sessionId: 'default', env: { TEX_ULTRA_FUNNEL_ENABLED: 'true' } });

test('TX243 published Tex entry on the linked session proceeds to the existing funnel', () => {
    const args = input();
    const before = structuredClone(args.state);
    assert.equal(preferTexLinkedEntryV267(args), true);
    assert.deepEqual(args.state, before);
});

test('price questions, altered references and other product entries retain their current routes', () => {
    for (const text of [
        '¿Cuánto cuesta Tex Ultra?',
        `${entry}\n¿Cuánto cuesta?`,
        'Hola, quiero el tratamiento Tex Ultra.',
        `Hola, quiero el tratamiento Vit Power.\nReferencia: ${reference}`,
        `Hola, quiero el tratamiento Tex Ultra.\nReferencia: TX243-${'g'.repeat(64)}`
    ]) assert.equal(preferTexLinkedEntryV267({ ...input(), text }), false, text);
});

test('manual mode, other products and unproven inbound identity cannot bypass direct handling', () => {
    const changes = [
        { state: { ...state(), human: { mode: 'manual' } } },
        { state: { ...state(), countryCode: 'BR' } },
        { state: { ...state(), metadata: { ...state().metadata, productKey: 'nitrix_ec' } } },
        { state: { ...state(), metadata: { ...state().metadata, lastSessionId: 'other' } } },
        { state: { ...state(), metadata: { ...state().metadata, productRouteLock: { active: true, productKey: 'vit_power_ec' } } } },
        { productKey: 'nitrix_ec' },
        { sourceMessageId: '' },
        { sessionId: '' },
        { env: { TEX_ULTRA_FUNNEL_ENABLED: 'false' } }
    ];
    for (const change of changes) assert.equal(preferTexLinkedEntryV267({ ...input(), ...change }), false, JSON.stringify(change));
});

test('simulated inbound runs the actual router branch once without external side effects', async () => {
    const source = fs.readFileSync(new URL('../src/services/conversationEngine.js', import.meta.url), 'utf8');
    const start = source.indexOf('        const linkedTexEntryV267 = preferTexLinkedEntryV267(');
    const end = source.indexOf('        const freeflowCapability = ', start);
    assert.ok(start > 0 && end > start, 'Tex routing branch is present');
    const branch = source.slice(start, end);
    const funnelSource = fs.readFileSync(new URL('../src/services/texUltraFunnelService.js', import.meta.url), 'utf8');
    const funnelStart = funnelSource.indexOf('export const handleTexUltraFunnelInbound = async ');
    assert.ok(funnelStart > 0, 'Tex funnel entry is present');
    const calls = [];
    const simulatedState = state();
    const context = vm.createContext({
        preferTexLinkedEntryV267: args => preferTexLinkedEntryV267({ ...args, env: { TEX_ULTRA_FUNNEL_ENABLED: 'true' } }),
        prioritizeFreeflowV219: () => false,
        maybeHandleEcuadorDirectProductInquiry: async () => { calls.push('direct'); return { handled: true }; },
        maybeHandleEcuadorProductIngredients: async () => { calls.push('ingredients'); return { handled: false }; },
        ContactState: { findById: async id => id === 'SIM_STATE' ? simulatedState : null },
        observeTexEntryOwnerV242: async ({ inboundText, sourceMessageId }) => {
            assert.equal(inboundText, entry);
            assert.equal(sourceMessageId, 'SIM_INBOUND_V267');
            calls.push('owner-observed');
        },
        texUltraFunnelEnabled: () => true,
        memoryOf: () => simulatedState.metadata?.perAgentMemory?.tex_ultra_ec || {},
        draftOf: () => ({}),
        digitsOnly: value => String(value || '').replace(/\D/g, ''),
        texUltraVslPayloadData: () => null,
        texUltraSelectedQuantity: () => null,
        interruptTexUltraInitialLayerOnInbound: async () => ({ handled: false, interrupted: false }),
        texUltraInterruptedInboundRoute: () => '',
        startTexUltraInitialLayer: async () => { calls.push('initial-layer'); return { started: true }; },
        AGENT_KEY: 'tex_ultra_ec',
        holdTexUltraForHuman: async () => { throw Error('unexpected human hold'); },
        handleNitrixFastStateInbound: async () => { throw Error('unexpected Nitrix route'); },
        holdNitrixForHuman: async () => { throw Error('unexpected Nitrix hold'); },
        console: { log() {} },
        process: { env: { TEX_ULTRA_FUNNEL_ENABLED: 'true' } },
        TEX_ULTRA_AGENT_KEY: 'tex_ultra_ec',
        NITRIX_AGENT_KEY: 'nitrix_ec'
    });
    vm.runInContext(funnelSource.slice(funnelStart).replace(/^export const /, 'const ') + '\nglobalThis.handleTexUltraFunnelInbound = handleTexUltraFunnelInbound;', context);
    const run = vm.runInContext(`async ({text, contactState, agentProfile}) => {
        const msg = { id: 'SIM_INBOUND_V267', sessionId: 'default', contactStateId: 'SIM_STATE' };
        const chatId = '593990000001@c.us', peerPhone = '593990000001';
        const questionPriorityV219 = false;
        ${branch}
    }`, context);
    await run({ text: entry, contactState: state(), agentProfile: { key: 'tex_ultra_ec' } });
    assert.deepEqual(calls, ['ingredients', 'owner-observed', 'initial-layer']);
    calls.length = 0;
    await run({ text: '¿Cuánto cuesta Tex Ultra?', contactState: state(), agentProfile: { key: 'tex_ultra_ec' } });
    assert.deepEqual(calls, ['direct']);
});
