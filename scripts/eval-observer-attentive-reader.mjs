import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analyzeAttentiveReader } from '../src/services/observerAttentiveReaderService.js';

const failures = [];

const check = (label, fn) => {
    try {
        fn();
        console.log(`[OK] ${label}`);
    } catch (error) {
        failures.push({ label, error });
        console.error(`[FAIL] ${label}: ${error.message}`);
    }
};

const analyze = (text, extra = {}) => analyzeAttentiveReader({
    inboundText: text,
    history: [
        { _id: `in_${Date.now()}_${Math.random().toString(16).slice(2)}`, body: text, isFromMe: false, isBot: false, createdAt: new Date() },
        ...(extra.history || [])
    ],
    contactState: extra.contactState || null,
    latestOrder: extra.latestOrder || null
});

check('Preco generico: sugere 1, 3 e 6 sem assumir 1 frasco', () => {
    const item = analyze('Q valor tiene');
    assert.equal(item.category, 'generic_price');
    assert.match(item.suggestedScript, /1 frasco por 39 USD/i);
    assert.match(item.suggestedScript, /3 frascos por 95\.99 USD/i);
    assert.match(item.suggestedScript, /6 frascos por 167\.99 USD/i);
    assert.doesNotMatch(item.nextStep, /1 frasco/i);
    assert.equal(item.recommendedAudio, 'TRATAMENTO_Y_PRECIOS_PROMOCAO');
});

const PROSTATE_FORBIDDEN_TEXT = /(no debo prometer cura|diagn[oó]stico|tratamiento m[eé]dico|profesional de confianza|no es promesa de cura|consultar|consulte|confirme primero|m[eé]dico|farmac[eé]utico)/i;

check('Prostatitis: texto comercial aprovado e Ajuda_Prostata', () => {
    for (const phrase of [
        'Sirbe para la prostatitis',
        'Sirve para prostata',
        'Tengo problema de próstata',
        'Me ayuda para orinar'
    ]) {
        const item = analyze(phrase);
        assert.equal(item.category, 'prostate_question');
        assert.equal(item.recommendedAudio, 'Ajuda_Prostata');
        assert.match(item.suggestedScript, /apoyo natural/i);
        assert.match(item.suggestedScript, /bienestar masculino/i);
        assert.match(item.suggestedScript, /promoción de 1, 3 o 6 frascos/i);
        assert.doesNotMatch(item.suggestedScript, PROSTATE_FORBIDDEN_TEXT);
        assert.ok(item.riskFlags.includes('health_commercial_care'));
    }
});

check('Entrada VSL: nao trata nome Pedro Carbo como cidade/agencia', () => {
    const item = analyze('Hola, acabo de ver el video. Nombre completo: Pedro Carbo. Telefono: 593988303015');
    assert.equal(item.category, 'vsl_entry_lead');
    assert.equal(item.recommendedAudio, 'TRATAMENTO_Y_PRECIOS_PROMOCAO');
    assert.match(item.suggestedScript, /Ya tengo su nombre y teléfono/i);
    assert.match(item.suggestedScript, /3 frascos por 95\.99 USD/i);
    assert.ok(item.riskFlags.includes('do_not_treat_nombre_completo_as_city'));
    assert.doesNotMatch(item.suggestedScript, /sector|agencia|Servientrega/i);
});

check('Entrada VSL: conversationEngine autoriza resposta automatica e audio inicial', () => {
    const engine = readFileSync(new URL('../src/services/conversationEngine.js', import.meta.url), 'utf8');
    assert.match(engine, /ATTENTIVE_READER_AUTO_CATEGORIES[\s\S]*'vsl_entry_lead'/);
    assert.match(engine, /attentiveReaderAudioCategories[\s\S]*'vsl_entry_lead'/);
    assert.match(engine, /if \(item\.category === 'vsl_entry_lead'\)[\s\S]*getGreetingAudioByTime/);
});

check('Atuntaqui: reconhece cidade/provincia e nao pede solo ciudad', () => {
    const item = analyze('Provincia Imbabura ciudad Atuntaqui panamericana');
    assert.notEqual(item.category, 'logistics_missing_city_province');
    assert.doesNotMatch(item.suggestedScript, /solo su ciudad/i);
    assert.match(`${item.suggestedScript} ${item.directAnswer}`, /Atuntaqui|Imbabura/i);
});

check('Ricaurte sozinho: pede cidade/provincia e nao escolhe Rocafuerte', () => {
    const item = analyze('Ricaurte');
    assert.equal(item.category, 'ambiguous_agency_address');
    assert.match(item.suggestedScript, /ciudad y provincia/i);
    assert.doesNotMatch(item.suggestedScript, /Rocafuerte/i);
});

check('Ricaurte Babahoyo: sugere agencia correta sem pedir data', () => {
    const item = analyze('Ricaurte Babahoyo');
    assert.equal(item.category, 'agency_confirm');
    assert.match(item.suggestedScript, /Babahoyo/i);
    assert.match(item.suggestedScript, /Ricaurte/i);
    assert.doesNotMatch(item.suggestedScript, /fecha exacta/i);
});

check('Cidade com muitas agencias: pergunta setor antes de despejar lista', () => {
    const item = analyze('Quito Pichincha');
    assert.equal(item.category, 'agency_refinement_needed');
    assert.match(item.suggestedScript, /Centro, Norte, Sur, Este u Oeste/i);
    assert.ok(item.riskFlags.includes('too_many_agencies'));
});

check('Setor norte: lista opcoes numeradas', () => {
    const item = analyze('Quito Pichincha sector norte');
    assert.equal(item.category, 'agency_options');
    assert.match(item.suggestedScript, /1\)/);
    assert.match(item.suggestedScript, /Quito/i);
});

check('Outras opcoes: continua numeracao no segundo bloco', () => {
    const item = analyze('otras Quito Pichincha', {
        contactState: {
            metadata: {
                perAgentMemory: {
                    vit_power_ec: {
                        agencyOptionsPage: 0
                    }
                }
            }
        }
    });
    assert.equal(item.category, 'agency_options');
    assert.match(item.suggestedScript, /5\)/);
    assert.doesNotMatch(item.suggestedScript, /¿Está correcto\?/i);
});

check('Agendamento com dado logistico: nao pede fecha exacta', () => {
    const item = analyze('Ricaurte Babahoyo', {
        contactState: {
            metadata: {
                lastKnownFunnelStage: 'sdr_scheduled_followup'
            }
        }
    });
    assert.equal(item.category, 'agency_confirm');
    assert.doesNotMatch(item.suggestedScript, /fecha exacta/i);
    assert.match(item.suggestedScript, /Babahoyo/i);
});

check('Cliente frustrado: acolhe antes do proximo passo', () => {
    const item = analyze('Ya dije eso otra vez y nadie responde');
    assert.equal(item.category, 'frustration_care');
    assert.match(item.suggestedScript, /disculpe|entiendo/i);
    assert.ok(item.riskFlags.includes('human_care_needed'));
});

if (failures.length) {
    console.error(`\n${failures.length} falha(s) no Leitor Atento.`);
    process.exit(1);
}

console.log('\nLeitor Atento OK.');
