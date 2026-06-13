import assert from 'node:assert/strict';
import fs from 'node:fs';
import { __principalSdrContextAudit as rules } from '../src/services/conversationEngine.js';
import {
    VIT_POWER_INITIAL_CTA_MESSAGES,
    isInitialProductInquiry,
    startsWithOfficialInitialCtaMessage
} from '../src/services/initialFunnelTriggers.js';
import {
    findKnownServientregaEcuadorLocation,
    findServientregaEcuadorAgencies,
    loadServientregaEcuadorAgencies
} from '../src/services/servientregaEcuadorAgencyService.js';

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

check('Entrada CTA: frases oficiais nao carregam preco/promocao/frascos/pedido prioritario', () => {
    const blocked = /\b(precio|presio|valor|promo|promocion|promoción|descuento|frasco|frascos|botella|botellas|pedido prioritario|ordenar|orden)\b/i;
    assert.equal(VIT_POWER_INITIAL_CTA_MESSAGES.length, 8);
    for (const text of VIT_POWER_INITIAL_CTA_MESSAGES) {
        assert.equal(blocked.test(text), false, text);
        assert.equal(startsWithOfficialInitialCtaMessage(text), true, text);
        assert.equal(isInitialProductInquiry(text), true, text);
    }
});

check('Entrada CTA: JSON publico e gatilho interno usam a mesma lista sem preco', () => {
    const publicCta = JSON.parse(fs.readFileSync('public/cta-vit-power-messages.json', 'utf8'));
    assert.deepEqual(publicCta.messages, VIT_POWER_INITIAL_CTA_MESSAGES);
});

check('Entrada inicial: motor envia primeiro contato oficial sem preco automatico', () => {
    const engine = fs.readFileSync('src/services/conversationEngine.js', 'utf8');
    assert.match(engine, /includePrice:\s*false,\s*\n\s*includeBottle:\s*true/);
    assert.doesNotMatch(engine, /includePrice:\s*!checkoutOrderData/);
});

check('Sanitizacao: sendText remove marcadores tecnicos antes de enviar ao cliente', () => {
    const sendTextSource = fs.readFileSync('src/whatsapp/sendText.js', 'utf8');
    assert.match(sendTextSource, /CLIENT_VISIBLE_MARKER_LINE_REGEX/);
    assert.match(sendTextSource, /CLIENT_VISIBLE_INLINE_MARKER_REGEX/);
    assert.match(sendTextSource, /const finalText = sanitizeClientVisibleText\(humanizedText\)/);
    assert.match(sendTextSource, /if \(!finalText\)/);
});

check('Deduplicacao: texto e audio usam fingerprint normalizado/semantico estavel', () => {
    const sendTextSource = fs.readFileSync('src/whatsapp/sendText.js', 'utf8');
    assert.match(sendTextSource, /normalizeAntiSpamTextKey/);
    assert.match(sendTextSource, /hasRecentHistoryRepeat/);
    assert.match(sendTextSource, /reserveOutboundOnce/);
});

check('Links sociais organicos: TikTok responde fora do funil comercial', () => {
    const engine = fs.readFileSync('src/services/conversationEngine.js', 'utf8');
    assert.match(engine, /organic_social_link/);
    assert.match(engine, /Lo vi, gracias por compartirlo/);
    assert.match(engine, /&& !isOrganicSocialLink/);
});

const acceptedValueTexts = [
    'Si',
    'Sí',
    'sim',
    'Correto',
    'Correcto',
    'Listo',
    'Está bien',
    'Esta bien',
    'De acuerdo',
    'Ok',
    'Perfecto',
    'Me sirve',
    'Puede enviar',
    'Acepto',
    'Confirmo'
];

check('Etapa valor: aceita confirmacoes naturais para quantidade/preco', () => {
    for (const text of acceptedValueTexts) {
        assert.equal(rules.principalSdrIsValueOfferAcceptance(text), true, text);
    }
});

check('Etapa valor: nao aceita localidade como confirmacao de preco', () => {
    assert.equal(rules.principalSdrIsValueOfferAcceptance('Sigsig'), false);
    assert.equal(rules.principalSdrIsValueOfferAcceptance('Palenque'), false);
});

check('Quantidade: detecta 1, 2, 3 e 6 frascos', () => {
    assert.equal(rules.detectRequestedQuantity('quiero 1 frasco'), 1);
    assert.equal(rules.detectRequestedQuantity('2 frascos'), 2);
    assert.equal(rules.detectRequestedQuantity('quiero tres botellas'), 3);
    assert.equal(rules.detectRequestedQuantity('seis frascos'), 6);
});

check('Si/Sigsig: Si nao vira cidade nem agencia', () => {
    const location = rules.principalSdrLocationFromText('Si');
    assert.equal(location.city, '');
    assert.equal(location.province, '');
    assert.deepEqual(findServientregaEcuadorAgencies({ query: 'Si', limit: 3 }).map((agency) => agency.name), []);
});

check('Si/Sigsig: Sigsig continua encontrando cidade e agencia real', () => {
    const location = findKnownServientregaEcuadorLocation({ text: 'Sigsig' });
    assert.equal(location.city, 'SIGSIG');
    assert.equal(location.province, 'AZUAY');
    const agencies = findServientregaEcuadorAgencies({ query: 'Sigsig', limit: 1 });
    assert.match(agencies[0]?.name || '', /Sigsig/i);
});

check('Entrega agencia: Si aceita envio por agencia, mas sem dados de localidade', () => {
    assert.equal(rules.isAgencyDeliveryConsent('Si'), true);
    assert.equal(rules.hasAgencyIndicationData('Si'), false);
    const merged = rules.principalSdrMergeLocationAndAgencyDetails({ quantity: 2, total: 70 }, 'Si');
    assert.equal(merged.city || '', '');
    assert.equal(merged.province || '', '');
});

check('Correcao de agencia: No, es Palenque nao vira nome do cliente', () => {
    assert.equal(rules.principalSdrLooksLikeLocationCorrection('No, es Palenque'), true);
    assert.equal(rules.looksLikeCustomerFullName('No, es Palenque'), false);
    const merged = rules.principalSdrMergeIncoming({ quantity: 2, total: 70 }, 'No, es Palenque');
    assert.equal(merged.name || '', '');
});

check('Correcao de agencia: Palenque localiza Palenque/Los Rios', () => {
    const location = rules.principalSdrLocationFromText('No, es Palenque');
    assert.equal(rules.normalizeForDecision(location.city), 'palenque');
    assert.equal(rules.normalizeForDecision(location.province), 'los rios');
    const agencies = findServientregaEcuadorAgencies({ query: 'Palenque', limit: 1 });
    assert.match(agencies[0]?.name || '', /Palenque/i);
});

check('Typo aceito: Palenda corrige para Palanda sem virar Palenque', () => {
    const location = findKnownServientregaEcuadorLocation({ text: 'Palenda' });
    assert.equal(location.city, 'PALANDA');
    assert.equal(location.province, 'ZAMORA');
    const agencies = findServientregaEcuadorAgencies({ query: 'Palenda', limit: 1 });
    assert.match(agencies[0]?.name || '', /Palanda/i);
    assert.doesNotMatch(agencies[0]?.name || '', /Palenque/i);
});

check('Cidade real: Paltas nao pode cair para agencias de Loja capital', () => {
    const order = {
        quantity: 6,
        total: 167.99,
        city: 'Loja',
        province: 'Loja',
        agencyOptions: [{ name: 'Loja Av. Manuel Carrion Pinzano', city: 'Loja', province: 'Loja' }],
        agencyOptionsPage: 0
    };
    const merged = rules.principalSdrMergeLocationAndAgencyDetails(order, 'Ciudad paltas, loja');
    assert.equal(merged.city, 'Paltas');
    assert.equal(merged.province, 'Loja');
    assert.equal(merged.agencyName, 'Paltas Domingo Celi');
    const page = rules.principalSdrAgencyOptionsPageForOrder(merged, '', 0);
    assert.equal(page.options.length, 1);
    assert.equal(page.options[0].name, 'Paltas Domingo Celi');
    assert.equal(page.options[0].city, 'Paltas');
    assert.equal(page.options[0].province, 'Loja');
});

check('Agencia natural: quero nao vira cidade Quero e La liberdad vira La Libertad', () => {
    const noCity = findKnownServientregaEcuadorLocation({ text: 'Quiero pedido en agencia' });
    assert.equal(noCity.city || '', '');
    assert.equal(noCity.province || '', '');
    const location = findKnownServientregaEcuadorLocation({ text: 'Quiero vit powet en la agencia de servientrega La liberdad' });
    assert.equal(location.city, 'LA LIBERTAD');
    assert.equal(location.province, 'SANTA ELENA');
    const correction = findKnownServientregaEcuadorLocation({ text: 'No, es ESA. Es en la liberdad' });
    assert.equal(correction.city, 'LA LIBERTAD');
    assert.equal(correction.province, 'SANTA ELENA');
    const agencies = findServientregaEcuadorAgencies({ query: 'No, es ESA. Es en la liberdad', limit: 3 });
    assert.ok(agencies.length >= 1);
    assert.ok(agencies.every((agency) => agency.city.toUpperCase() === 'LA LIBERTAD'));
});

check('Catalogo Servientrega: todas as cidades da agencia_LISTA localizam a propria cidade', () => {
    const agencies = loadServientregaEcuadorAgencies();
    const uniqueCityProvince = [...new Map(agencies.map((agency) => [
        `${agency.normalizedCity}|${agency.normalizedProvince}`,
        agency
    ])).values()];
    assert.ok(uniqueCityProvince.length > 200, 'catalogo deveria ter mais de 200 cidades/provincias');
    for (const city of uniqueCityProvince) {
        const direct = findServientregaEcuadorAgencies({ query: city.city, limit: 5 });
        assert.ok(
            direct.some((agency) => agency.city.toUpperCase() === city.city.toUpperCase()
                && agency.province.toUpperCase() === city.province.toUpperCase()),
            `busca direta falhou para ${city.city}/${city.province}`
        );
        const naturalText = `ciudad ${city.city}, provincia ${city.province}`;
        const known = findKnownServientregaEcuadorLocation({ text: naturalText });
        assert.equal(known.city.toUpperCase(), city.city.toUpperCase(), `cidade natural falhou para ${naturalText}`);
        assert.equal(known.province.toUpperCase(), city.province.toUpperCase(), `provincia natural falhou para ${naturalText}`);
        const natural = findServientregaEcuadorAgencies({ query: naturalText, limit: 5 });
        assert.ok(
            natural.some((agency) => agency.city.toUpperCase() === city.city.toUpperCase()
                && agency.province.toUpperCase() === city.province.toUpperCase()),
            `busca natural falhou para ${naturalText}`
        );
    }
});

check('Agencia oficial: ao confirmar agencia, dados oficiais sobrescrevem frase do cliente', () => {
    const agency = findServientregaEcuadorAgencies({ query: 'Palenda', limit: 1 })[0];
    const order = rules.principalSdrApplyOfficialAgency({
        name: '',
        city: 'es en Palenda',
        province: 'no',
        address: 'No, es en Palenda',
        reference: 'No, es en Palenda',
        quantity: 2,
        total: 70
    }, agency);
    assert.equal(order.agencyName, 'Palanda 13 de Abril');
    assert.equal(order.agency, 'Palanda 13 de Abril');
    assert.equal(order.city, 'Palanda');
    assert.equal(order.province, 'Zamora');
    assert.equal(order.address, '13 de Abril sn y Alonso de Mercadillo Diagonal a Ban Ecuador');
    assert.equal(order.agencyAddress, '13 de Abril sn y Alonso de Mercadillo Diagonal a Ban Ecuador');
    assert.equal(order.reference, 'Sur');
    assert.equal(order.agencyValidated, true);
});

check('Agencia oficial: Urdesa central encontra agencia real em agencia_LISTA', () => {
    const agencies = findServientregaEcuadorAgencies({ query: 'Urdesa central', limit: 3 });
    assert.ok(agencies.length >= 1);
    assert.equal(agencies[0].name, 'Guayaquil Urdesa Ficus Esquina');
    assert.equal(agencies[0].city, 'Guayaquil');
    assert.equal(agencies[0].province, 'Guayas');
    assert.match(agencies[0].address, /Urdesa Central/i);
});

check('Nome: frase de localizacao apos agencia nao vira nome', () => {
    assert.equal(rules.looksLikeCustomerFullName('Yo quiero en Palenda'), false);
    assert.equal(rules.principalSdrLooksLikeAgencyOrLocationAnswer('Yo quiero en Palenda'), true);
});

check('Selecao agencia: A e opcion A selecionam a primeira agencia', () => {
    const options = findServientregaEcuadorAgencies({ query: 'La Libertad', limit: 3 });
    assert.ok(options.length >= 3);
    assert.equal(rules.selectAgencyOptionFromText('A', options)?.name, options[0].name);
    assert.equal(rules.selectAgencyOptionFromText('opcion a', options)?.name, options[0].name);
    assert.equal(rules.selectAgencyOptionFromText('opção a', options)?.name, options[0].name);
    assert.equal(rules.selectAgencyOptionFromText('Envieme a opção: A', options)?.name, options[0].name);
    assert.equal(rules.selectAgencyOptionFromText('envíeme la opción B', options)?.name, options[1].name);
    assert.equal(rules.selectAgencyOptionFromText('mandeme la C', options)?.name, options[2].name);
    assert.equal(rules.selectAgencyOptionFromText('quiero opción A', options)?.name, options[0].name);
    assert.equal(rules.selectAgencyOptionFromText('letra a', options)?.name, options[0].name);
    assert.equal(rules.selectAgencyOptionFromText('la primera', options)?.name, options[0].name);
    assert.equal(rules.selectAgencyOptionFromText('1', options)?.name, options[0].name);
    assert.equal(rules.selectAgencyOptionFromText('B', options)?.name, options[1].name);
    assert.equal(rules.selectAgencyOptionFromText('C', options)?.name, options[2].name);
});

check('Agencia unica: confirmacoes naturais aceitam a unica opcao', () => {
    const options = findServientregaEcuadorAgencies({ query: 'Palenque', limit: 1 });
    for (const text of ['Si', 'Correcto', 'Correto', 'Listo', 'Esta bien', 'De acuerdo']) {
        assert.equal(rules.selectAgencyOptionFromText(text, options)?.name, options[0].name, text);
    }
});

check('Nome: nome real passa, confirmacao e correcao nao passam', () => {
    assert.equal(rules.looksLikeCustomerFullName('Gerson Lourenço'), true);
    assert.equal(rules.looksLikeCustomerFullName('Correcto'), false);
    assert.equal(rules.looksLikeCustomerFullName('No, es Palenque'), false);
    assert.equal(rules.looksLikeCustomerFullName('Yo quiero en Palenda'), false);
});

if (failures.length) {
    console.error(`\n[CONTEXT-AUDIT] ${failures.length} falha(s).`);
    process.exit(1);
}

console.log('\n[CONTEXT-AUDIT] OK: matriz de contexto do funil passou.');
