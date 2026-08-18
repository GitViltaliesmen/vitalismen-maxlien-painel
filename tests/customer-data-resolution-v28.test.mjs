import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
    CUSTOMER_DATA_STATUS,
    ecuadorLocationRegistry,
    evaluateOrderDataGate,
    nearestAuthorizedAgencies,
    resolveAuthorizedAgency,
    resolveCustomerDataDraft,
    resolveCustomerName,
    resolveEcuadorLocation
} from '../src/services/customerDataResolutionService.js';
import { texUltraDeliveryData } from '../src/services/texUltraFunnelService.js';

test('V28 preserva Unicode e formata nome internacional sem inventar segmentacao', () => {
    const name = resolveCustomerName({ raw: 'MARÍA-JOSÉ O’NEILL', source: 'explicit_label' });
    assert.equal(name.raw_value, 'MARÍA-JOSÉ O’NEILL');
    assert.equal(name.canonical_value, 'María-José O’Neill');
    assert.equal(name.validation_status, CUSTOMER_DATA_STATUS.HIGH_CONFIDENCE);
});

test('V28 cobre nomes internacionais naturais, compostos e com dois sobrenomes', () => {
    const cases = new Map([
        ['Miguel Arellano Peralta', 'Miguel Arellano Peralta'],
        ['MIGUEL ARELLANO PERALTA', 'Miguel Arellano Peralta'],
        ['miguel arellano peralta', 'Miguel Arellano Peralta'],
        ['José Luis Zambrano', 'José Luis Zambrano'],
        ['MARÍA JOSÉ DE LA CRUZ', 'María José de la Cruz'],
        ['Íñigo Peña', 'Íñigo Peña'],
        ['ANA-MARÍA PÉREZ-GÓMEZ', 'Ana-María Pérez-Gómez'],
        ["D'ANGELO O'NEILL", "D'Angelo O'Neill"],
        ['Juan Carlos Pérez Gómez', 'Juan Carlos Pérez Gómez']
    ]);
    for (const [raw, expected] of cases) {
        const result = resolveCustomerName({ raw, source: 'explicit_label' });
        assert.equal(result.canonical_value, expected, raw);
        assert.equal(result.validation_status, CUSTOMER_DATA_STATUS.HIGH_CONFIDENCE, raw);
    }
});

test('V28 bloqueia nome concatenado e nunca inventa espacos', () => {
    const name = resolveCustomerName({ raw: 'miguelarellanoperalta', source: 'explicit_label' });
    assert.equal(name.raw_value, 'miguelarellanoperalta');
    assert.equal(name.canonical_value, '');
    assert.equal(name.display_value, 'miguelarellanoperalta');
    assert.equal(name.validation_status, CUSTOMER_DATA_STATUS.SEGMENTATION_REQUIRED);
});

test('V28 aceita mononimo plausivel e exige confirmacao para dica de perfil', () => {
    assert.equal(
        resolveCustomerName({ raw: 'Cher', source: 'explicit_label' }).validation_status,
        CUSTOMER_DATA_STATUS.HIGH_CONFIDENCE
    );
    assert.equal(
        resolveCustomerName({ raw: 'Gerdon', source: 'whatsapp_profile' }).validation_status,
        CUSTOMER_DATA_STATUS.NEEDS_CONFIRMATION
    );
    assert.equal(
        resolveCustomerName({ raw: 'Gerdon', source: 'whatsapp_profile', confirmedByCustomer: true }).validation_status,
        CUSTOMER_DATA_STATUS.VERIFIED
    );
});

test('V28 nao aceita como confirmacao a mesma concatenacao suspeita', () => {
    const name = resolveCustomerName({ raw: 'miguelarellanoperalta', source: 'customer_confirmation', confirmedByCustomer: true });
    assert.equal(name.validation_status, CUSTOMER_DATA_STATUS.SEGMENTATION_REQUIRED);
    assert.equal(name.canonical_value, '');
});

test('V28 rejeita numeros, emoji, URL e texto comercial como nome', () => {
    for (const raw of ['Juan123', '🔥', 'https://maxlien.shop', 'Pedido Tex Ultra']) {
        assert.equal(resolveCustomerName({ raw, source: 'explicit_label' }).validation_status, CUSTOMER_DATA_STATUS.INVALID);
    }
});

test('V28 respeita hierarquia de fonte e lock humano', () => {
    const explicit = resolveCustomerName({ raw: 'Ana María Pérez', source: 'explicit_label' });
    const ignoredProfile = resolveCustomerName({ raw: 'Anita', source: 'whatsapp_profile', previous: explicit });
    assert.equal(ignoredProfile.canonical_value, 'Ana María Pérez');
    assert.equal(ignoredProfile.ignored_candidate.raw_value, 'Anita');

    const human = resolveCustomerName({ raw: 'Ana M. Pérez', source: 'structured_form', previous: explicit, correctedByHuman: true });
    const ignoredCustomer = resolveCustomerName({ raw: 'Ana Pérez', source: 'structured_form', previous: human, confirmedByCustomer: true });
    assert.equal(human.locked, true);
    assert.equal(ignoredCustomer.canonical_value, 'Ana M. Pérez');
    assert.equal(ignoredCustomer.ignored_candidate.raw_value, 'Ana Pérez');
});

test('V28 fixa correcao separada confirmada pelo cliente e bloqueia inferencia posterior', () => {
    const suspicious = resolveCustomerName({ raw: 'miguelarellanoperalta', source: 'explicit_label' });
    const corrected = resolveCustomerName({
        raw: 'Miguel Arellano Peralta',
        source: 'customer_confirmation',
        previous: suspicious,
        confirmedByCustomer: true
    });
    const laterProfile = resolveCustomerName({ raw: 'Miguelito', source: 'whatsapp_profile', previous: corrected });
    assert.equal(corrected.validation_status, CUSTOMER_DATA_STATUS.VERIFIED);
    assert.equal(corrected.confirmed_by_customer, true);
    assert.equal(corrected.locked, true);
    assert.equal(laterProfile.canonical_value, 'Miguel Arellano Peralta');
});

test('V28 canoniza cidade, corrige typo unico e deriva provincia', () => {
    const exact = resolveEcuadorLocation({ cityRaw: 'AMBATO' });
    assert.equal(exact.city.canonical_value, 'Ambato');
    assert.equal(exact.province.canonical_value, 'Tungurahua');
    assert.equal(exact.province.validation_status, CUSTOMER_DATA_STATUS.AUTO_FROM_CITY);

    const typo = resolveEcuadorLocation({ cityRaw: 'Ambatto' });
    assert.equal(typo.city.canonical_value, 'Ambato');
    assert.equal(typo.city.validation_status, CUSTOMER_DATA_STATUS.CANONICAL);

    const matchingProvidedProvince = resolveEcuadorLocation({ cityRaw: 'Ambato', provinceRaw: 'Tungurahua' });
    assert.equal(matchingProvidedProvince.province.canonical_value, 'Tungurahua');
    assert.equal(matchingProvidedProvince.province.validation_status, CUSTOMER_DATA_STATUS.AUTO_FROM_CITY);
    assert.ok(matchingProvidedProvince.province.evidence.includes('province_confirmed_from_unique_city'));
});

test('V28 detecta conflito cidade/provincia e correcao humana nao burla registro', () => {
    const conflict = resolveEcuadorLocation({ cityRaw: 'Ambato', provinceRaw: 'Guayas' });
    assert.equal(conflict.conflict, true);
    assert.equal(conflict.city.validation_status, CUSTOMER_DATA_STATUS.CONFLICT);
    assert.equal(conflict.province.validation_status, CUSTOMER_DATA_STATUS.CONFLICT);

    const invalid = resolveEcuadorLocation({
        cityRaw: 'Cidade Inventada',
        provinceRaw: 'Tungurahua',
        correctedByHumanFields: ['city', 'province']
    });
    assert.equal(invalid.city.validation_status, CUSTOMER_DATA_STATUS.INVALID);
    assert.equal(invalid.city.canonical_value, '');
});

test('V28 permite nova correcao explicita do cliente sem romper lock humano', () => {
    const first = resolveEcuadorLocation({
        cityRaw: 'Ambato',
        source: 'customer_confirmation',
        confirmedByCustomerFields: ['city']
    });
    const corrected = resolveEcuadorLocation({
        cityRaw: 'Guayaquil',
        source: 'customer_confirmation',
        previousCity: first.city,
        previousProvince: first.province,
        confirmedByCustomerFields: ['city']
    });
    assert.equal(first.city.locked, true);
    assert.equal(corrected.city.canonical_value, 'Guayaquil');
    assert.equal(corrected.province.canonical_value, 'Guayas');
});

test('V28 separa ambiguidade fuzzy de cidade inexistente', () => {
    const ambiguous = resolveEcuadorLocation({ cityRaw: 'El Guao' });
    assert.equal(ambiguous.city.validation_status, CUSTOMER_DATA_STATUS.NEEDS_CONFIRMATION);
    assert.equal(ambiguous.city.candidates.length, 2);
    const unknown = resolveEcuadorLocation({ cityRaw: 'Ciudad Inexistente' });
    assert.equal(unknown.city.validation_status, CUSTOMER_DATA_STATUS.INVALID);
    assert.equal(unknown.city.canonical_value, '');
});

test('V28 usa somente registro EC deterministico de localidades e agencias', () => {
    const registry = ecuadorLocationRegistry();
    assert.equal(registry.country, 'EC');
    assert.ok(registry.cities.length >= 200);
    assert.equal(registry.provinces.length, 24);

    const agency = resolveAuthorizedAgency({
        deliveryMode: 'agency',
        city: 'Ambato',
        province: 'Tungurahua',
        agencyRaw: 'AMBATO_CASTILLO'
    });
    assert.equal(agency.validation_status, CUSTOMER_DATA_STATUS.VERIFIED);
    assert.match(agency.agency_id, /^EC-SA-[A-F0-9]{16}$/);
    assert.equal(agency.city, 'Ambato');

    const wrongCity = resolveAuthorizedAgency({
        deliveryMode: 'agency',
        city: 'Quito',
        province: 'Pichincha',
        agencyRaw: 'AMBATO_CASTILLO',
        correctedByHuman: true
    });
    assert.notEqual(wrongCity.validation_status, CUSTOMER_DATA_STATUS.VERIFIED);
    assert.equal(wrongCity.locked, false);

    const unavailable = resolveAuthorizedAgency({
        deliveryMode: 'agency',
        city: 'Ambato',
        province: 'Tungurahua',
        agencyRaw: 'AGENCIA QUE NO EXISTE 999'
    });
    assert.notEqual(unavailable.validation_status, CUSTOMER_DATA_STATUS.VERIFIED);
});

test('V28 declara indisponibilidade honesta quando registro autorizado nao tem coordenadas', () => {
    assert.deepEqual(nearestAuthorizedAgencies({}), {
        available: false,
        reason: 'coordinates_missing',
        agencies: []
    });
    assert.equal(nearestAuthorizedAgencies({ lat: -1.25, lng: -78.62 }).reason, 'authorized_registry_coordinates_unavailable');
});

test('V28 preserva raw de endereco/referencia e libera domicilio completo', () => {
    const { draft, resolution } = resolveCustomerDataDraft({
        conversationPhone: '0998038637',
        source: 'structured_form',
        draft: {
            country: 'EC',
            name: 'Juan Pérez',
            city: 'Ambatto',
            deliveryMode: 'domicilio',
            address: '  Av. Cevallos  123  ',
            reference: 'Frente al parque'
        },
        correctedByHumanFields: ['address', 'reference']
    });
    assert.equal(draft.address_raw, 'Av. Cevallos  123');
    assert.equal(draft.address, 'Av. Cevallos 123');
    assert.equal(draft.reference_raw, 'Frente al parque');
    assert.equal(resolution.fields.reference.place_candidate, '');
    assert.equal(resolution.fields.reference.reference_lat, null);
    assert.equal(resolution.fields.address.locked, true);
    assert.equal(resolution.fields.reference.locked, true);
    assert.equal(resolution.orderDataReady, true);
    assert.equal(resolution.qualityScore, 100);
});

test('V28 gate impede pedido com segmentacao, conflito ou entrega incompleta', () => {
    const segmented = resolveCustomerDataDraft({
        conversationPhone: '0998038637',
        source: 'explicit_label',
        draft: { country: 'EC', name: 'miguelarellanoperalta', city: 'Ambato' }
    }).resolution;
    assert.equal(segmented.orderDataReady, false);
    assert.ok(segmented.blockedReasons.includes('NAME_SEGMENTATION_REQUIRED'));
    assert.ok(segmented.blockedReasons.includes('DELIVERY_MODE_REQUIRED'));

    const gate = evaluateOrderDataGate({ fields: segmented.fields, deliveryMode: 'agency' });
    assert.ok(gate.blockedReasons.includes('AUTHORIZED_AGENCY_REQUIRED'));
});

test('V28 nao deixa extracao fraca apagar telefone ou entrega bloqueados', () => {
    const first = resolveCustomerDataDraft({
        conversationPhone: '0998038637',
        draft: {
            country: 'EC',
            phone: '0998038637',
            name: 'Juan Pérez',
            city: 'Ambato',
            deliveryMode: 'home',
            address: 'Calle 1'
        },
        source: 'customer_confirmation',
        confirmedByCustomerFields: ['deliveryMode']
    });
    const later = resolveCustomerDataDraft({
        draft: {
            country: 'EC',
            phone: 'numero invalido',
            name: 'Juan Pérez',
            city: 'Ambato',
            deliveryMode: 'agency',
            agencyName: 'inventada'
        },
        previousResolution: first.resolution,
        source: 'whatsapp_profile'
    });
    assert.equal(later.resolution.fields.phone.canonical_value, '+593998038637');
    assert.equal(later.resolution.fields.delivery_mode.canonical_value, 'home');
    assert.equal(later.resolution.fields.delivery_mode.ignored_candidate.canonical_value, 'agency');
});

test('V28 limpa agencia ativa quando a entrega e corrigida explicitamente para domicilio', () => {
    const agencyDraft = resolveCustomerDataDraft({
        conversationPhone: '0998038637',
        source: 'customer_confirmation',
        confirmedByCustomerFields: ['deliveryMode', 'agency'],
        draft: {
            country: 'EC',
            name: 'Juan Pérez',
            city: 'Ambato',
            deliveryMode: 'agency',
            agencyName: 'AMBATO_CASTILLO'
        }
    });
    const homeDraft = resolveCustomerDataDraft({
        conversationPhone: '0998038637',
        previousResolution: agencyDraft.resolution,
        correctedByHumanFields: ['deliveryMode', 'address'],
        draft: {
            ...agencyDraft.draft,
            deliveryMode: 'home',
            address: 'Av. Cevallos 123'
        }
    });
    assert.equal(agencyDraft.resolution.fields.agency.locked, true);
    assert.equal(homeDraft.resolution.fields.agency.validation_status, CUSTOMER_DATA_STATUS.NOT_APPLICABLE);
    assert.equal(homeDraft.draft.agencyId, '');
    assert.equal(homeDraft.draft.agencyName, '');
    assert.equal(homeDraft.resolution.orderDataReady, true);
});

test('V28 bloqueia pais fora do escopo EC sem reescrever raw como Ecuador', () => {
    const { draft, resolution } = resolveCustomerDataDraft({
        conversationPhone: '0998038637',
        draft: { country: 'CO', name: 'Juan Pérez', city: 'Ambato', deliveryMode: 'home', address: 'Calle 1' }
    });
    assert.equal(draft.country, 'CO');
    assert.equal(resolution.fields.country.raw_value, 'CO');
    assert.equal(resolution.fields.country.canonical_value, '');
    assert.ok(resolution.blockedReasons.includes('COUNTRY_NOT_EC'));
});

test('V28 classifica modalidade de entrega sem inventar agencia', () => {
    assert.equal(texUltraDeliveryData('Retiro en agencia Servientrega Ambato Castillo').deliveryMode, 'agency');
    assert.equal(texUltraDeliveryData('Domicilio en Av. Cevallos 123').deliveryMode, 'home');
    assert.equal(texUltraDeliveryData('Castillo').deliveryMode, '');
});

test('V28 pergunta uma vez pelo nome concatenado antes de iniciar a cadencia Tex Ultra', () => {
    const source = fs.readFileSync(new URL('../src/services/texUltraFunnelService.js', import.meta.url), 'utf8');
    const segmentationGate = source.indexOf("CUSTOMER_DATA_STATUS.SEGMENTATION_REQUIRED");
    const initialCadence = source.indexOf('startTexUltraInitialLayer({ state })');
    assert.ok(segmentationGate > 0 && initialCadence > segmentationGate);
    assert.match(source, /if \(!memory\.nameSegmentationQuestionSentAt\)/);
    assert.match(source, /¿me confirma por favor su nombre completo, con nombres y apellidos separados\?/);
    assert.match(source, /stage: 'awaiting_name_resolution'/);
});
