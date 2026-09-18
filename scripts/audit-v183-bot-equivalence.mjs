import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import {
    findServientregaEcuadorAgencies,
    resolveServientregaEcuadorAgency
} from '../src/services/servientregaEcuadorAgencyService.js';
import { __principalSdrContextAudit } from '../src/services/conversationEngine.js';
import { analyzeAttentiveReader } from '../src/services/observerAttentiveReaderService.js';

const EXPECTED = {
    service: {
        city_only: 'd920502b365524dabb05ffdc5977f7611ede7c347bc25ca1cbbc3e48d1e2dced',
        province_only: '84f2f90b3ee4fd8b6d51ea478e5d7df879a78f97de5c8da3ce0ed04474246458',
        agency_name: 'ce5444753cb5fea78f06428da278cfb15e1fc7d091f653eb68bd89efd194eaca',
        address_cross_city: '7c057ff8df3b2007dc990ac514a38a99321377b0ecef52a38e0b5d351780e1ca',
        natural_cross_city: '3208a583645290751617ca11226d807ac19e12a1063d1ae1ef0249808eb7aa97',
        ambiguous: '77cbe37afd19af728ca2be27e1c0aa2a22e7d25687155d04c15d326b7f649d11',
        city_typo: 'd920502b365524dabb05ffdc5977f7611ede7c347bc25ca1cbbc3e48d1e2dced',
        query_city_only: '0af88385dc082f0c7df0e1fa0721646add92dcd24966f2a13ee92049b4db88a3',
        query_province_only: 'ee8d73ef55b08953fdb8b5f5a903dfc6e5851562e922a706cbb3287d25c84c22',
        resolve_cross_city_name: '8d29de35a983db9ac65ceddda4d8091c69f9c08993a0dbe52f730e5ca1994d4d',
        resolve_natural: '8d29de35a983db9ac65ceddda4d8091c69f9c08993a0dbe52f730e5ca1994d4d',
        resolve_typo: 'f6638720e4468445943dee2006ac9fccee9b16d8067ee02e90996149091dbef3'
    },
    conversation: {
        city_province_empty: '2f5ef37bd7c67ef43c7de83135ca152e67c7d9e9d63e4138f65db568bb74c31b',
        city_province_ambiguous: '59b2b0b06b322da71d7d2ec9a69bf3a008a86d0be16280afc2e458ad21865c14',
        city_province_cross: '2a1d3a15650c547ef4e9e8aff4d54e051b582deb2d8bce8cbd9aa2c275348de4',
        city_only: '75f890d0f5f16169ac04b012498cd15bb971a9e73320be9ce94300d0f54ad468',
        province_only: 'c71fa181ddab252dfc8a1adb94245c7a71c03723ea18ffe896c64c03890705f9',
        typo_city: '2f5ef37bd7c67ef43c7de83135ca152e67c7d9e9d63e4138f65db568bb74c31b'
    },
    observer: {
        unknown_agency: '2e27042c5c90689f19fe5dd545118ac2c99f08caf4efd7d5e6ad0987bd83d730',
        ambiguous_principal: '33e32cbe57395887b95015b272f7f6c8fa1cc33a48bf397eda8fe1df9ffd310d',
        cross_city: '33e32cbe57395887b95015b272f7f6c8fa1cc33a48bf397eda8fe1df9ffd310d',
        typo: '33e32cbe57395887b95015b272f7f6c8fa1cc33a48bf397eda8fe1df9ffd310d',
        province_only: 'e332d4840a025e878e5294c6ac8e5d74bbd71b4975d8f8756765cebad5434510'
    }
};

const hash = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const normalizeAgency = (agency) => ({
    name: agency.name,
    city: agency.city,
    province: agency.province,
    address: agency.address,
    matchKind: agency.matchKind,
    matchField: agency.matchField,
    confident: agency.confident
});
const normalizeResolution = (resolution) => ({
    best: resolution.best ? normalizeAgency(resolution.best) : null,
    confident: resolution.confident,
    suggestions: resolution.suggestions.map(normalizeAgency)
});

const findCases = {
    city_only: { city: 'Huaquillas', limit: 10 },
    province_only: { province: 'El Oro', limit: 10 },
    agency_name: { city: 'Huaquillas', province: 'El Oro', query: 'Huaquillas Principal', limit: 10 },
    address_cross_city: { city: 'Huaquillas', province: 'El Oro', query: 'Arenillas Principal', limit: 10 },
    natural_cross_city: { city: 'Huaquillas', province: 'El Oro', query: 'Quiero retirar en la agencia de Arenillas', limit: 10 },
    ambiguous: { city: 'Huaquillas', province: 'El Oro', query: 'Principal', limit: 10 },
    city_typo: { city: 'Huaquilla', province: 'El Oro', limit: 10 },
    query_city_only: { query: 'Huaquillas', limit: 10 },
    query_province_only: { query: 'El Oro', limit: 10 }
};
const service = {};
for (const [name, input] of Object.entries(findCases)) {
    const defaultResult = findServientregaEcuadorAgencies(input).map(normalizeAgency);
    const explicitFalse = findServientregaEcuadorAgencies({ ...input, strictCityScope: false }).map(normalizeAgency);
    assert.deepEqual(explicitFalse, defaultResult, `strict_false_diff:${name}`);
    service[name] = defaultResult;
}
service.resolve_cross_city_name = normalizeResolution(resolveServientregaEcuadorAgency({
    city: 'Huaquillas', province: 'El Oro', agencyName: 'Arenillas Principal', limit: 10
}));
service.resolve_natural = normalizeResolution(resolveServientregaEcuadorAgency({
    city: 'Huaquillas', province: 'El Oro', text: 'Quiero retirar en Arenillas Principal', limit: 10
}));
service.resolve_typo = normalizeResolution(resolveServientregaEcuadorAgency({
    city: 'Huaquilla', province: 'El Oro', text: 'Agencia principal', limit: 10
}));

const conversationCases = {
    city_province_empty: [{ city: 'Huaquillas', province: 'El Oro' }, ''],
    city_province_ambiguous: [{ city: 'Huaquillas', province: 'El Oro' }, 'Principal'],
    city_province_cross: [{ city: 'Huaquillas', province: 'El Oro' }, 'Arenillas'],
    city_only: [{ city: 'Huaquillas' }, ''],
    province_only: [{ province: 'El Oro' }, ''],
    typo_city: [{ city: 'Huaquilla', province: 'El Oro' }, '']
};
const conversation = {};
for (const [name, [order, text]] of Object.entries(conversationCases)) {
    const result = __principalSdrContextAudit.principalSdrAgencyOptionsPageForOrder(order, text, 0);
    conversation[name] = {
        page: result.page,
        hasMore: result.hasMore,
        options: result.options.map(normalizeAgency)
    };
}

const contactState = (city, province) => ({
    phoneDigits: '593999999999',
    metadata: {
        customerDraft: { city, province },
        perAgentMemory: { vit_power_ec: { conversationState: { city, province } } }
    }
});
const observerCases = {
    unknown_agency: ['No sé cuál agencia, quiero retirar por Servientrega', contactState('Huaquillas', 'El Oro')],
    ambiguous_principal: ['Quiero la agencia Principal', contactState('Huaquillas', 'El Oro')],
    cross_city: ['Quiero retirar en la agencia de Arenillas', contactState('Huaquillas', 'El Oro')],
    typo: ['Quiero agencia en Huaquilla, El Oro', contactState('Huaquilla', 'El Oro')],
    province_only: ['Quiero agencia en El Oro', contactState('', 'El Oro')]
};
const normalizeObserver = (item) => ({
    category: item?.category || '',
    priority: item?.priority || '',
    subtitle: item?.subtitle || '',
    body: item?.body || '',
    suggestedScript: item?.suggestedScript || '',
    directAnswer: item?.directAnswer || '',
    nextStep: item?.nextStep || '',
    recommendedAudio: item?.recommendedAudio || '',
    riskFlags: item?.riskFlags || [],
    confidence: item?.confidence ?? null,
    doNotAskAgain: item?.doNotAskAgain || [],
    missingData: item?.missingData || [],
    context: {
        audioCandidates: item?.context?.audioCandidates || [],
        mediaCandidates: item?.context?.mediaCandidates || [],
        agencyOptionsPage: item?.context?.agencyOptionsPage ?? null,
        agencyOptionsCount: item?.context?.agencyOptionsCount ?? null
    }
});
const observer = {};
for (const [name, [text, state]] of Object.entries(observerCases)) {
    observer[name] = normalizeObserver(analyzeAttentiveReader({
        inboundText: text,
        history: [{ _id: name, body: text, isFromMe: false, isBot: false }],
        contactState: state
    }));
}

const differences = (actual, expected) => Object.entries(actual)
    .filter(([name, value]) => hash(value) !== expected[name])
    .map(([name]) => name);

const serviceDiff = differences(service, EXPECTED.service);
const conversationDiff = differences(conversation, EXPECTED.conversation);
const observerDiff = differences(observer, EXPECTED.observer);
const total = serviceDiff.length + conversationDiff.length + observerDiff.length;

assert.deepEqual(serviceDiff, [], `service_diff:${serviceDiff.join(',')}`);
assert.deepEqual(conversationDiff, [], `conversation_diff:${conversationDiff.join(',')}`);
assert.deepEqual(observerDiff, [], `observer_diff:${observerDiff.join(',')}`);
assert.equal(Object.keys(service).length + Object.keys(conversation).length + Object.keys(observer).length, 23);

console.log(`BOT_AGENCY_BEHAVIOR_DIFF=${total}_OF_23`);
console.log(`CONVERSATION_ENGINE_DIFF=${conversationDiff.length}`);
console.log(`OBSERVER_DIFF=${observerDiff.length}`);
console.log(`BOT_ROUTING_DIFF=${observerDiff.length}`);
console.log(`BOT_OUTBOUND_AGENCY_OPTIONS_DIFF=${conversationDiff.length}`);
console.log('SERVICE_DEFAULT_BEHAVIOR_PRESERVED=YES');
