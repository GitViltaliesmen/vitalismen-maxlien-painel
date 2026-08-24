import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
    authorizedAgencyOrderAddress,
    CUSTOMER_DATA_STATUS,
    operationalHomeAddress,
    resolveCustomerDataDraft
} from '../src/services/customerDataResolutionService.js';
import { resolveServientregaEcuadorAgency } from '../src/services/servientregaEcuadorAgencyService.js';
import {
    texUltraAgencyCandidatesText,
    texUltraAgencySelectionIndex,
    texUltraConfirmationCorrections,
    texUltraConfirmationText,
    texUltraDeliveryData,
    texUltraNextDataCollectionStep,
    texUltraOrderDeliveryData
} from '../src/services/texUltraFunnelService.js';

const baseDraft = {
    country: 'EC',
    name: 'Julio Justo Vergara Coronrdl',
    city: 'Guayaquil',
    province: 'Guayas',
    phone: '+593998476128',
    quantity: 3,
    total: 80.99
};

test('V54 resolve a frase real do Julio no catálogo e não usa a fala como endereço', () => {
    const customerPhrase = 'Puedo retirarlo en la agencia de la Piazza los Ceibos en guayaquil';
    const delivery = texUltraDeliveryData(customerPhrase);
    assert.equal(delivery.deliveryMode, 'agency');
    assert.equal(delivery.address, '');
    assert.equal(delivery.agencyName, customerPhrase);

    const { draft, resolution } = resolveCustomerDataDraft({
        conversationPhone: baseDraft.phone,
        source: 'customer_confirmation',
        confirmedByCustomerFields: ['deliveryMode', 'agency'],
        draft: { ...baseDraft, ...delivery }
    });
    assert.equal(draft.agencyId, 'EC-SA-A61F62FBBFE7E2B0');
    assert.equal(draft.agencyName, 'Guayaquil Piazza Ceibos');
    assert.equal(draft.agencyAddress, 'Av. Del Bombero S/n ( Piazza ) al Lado Del Hospital Del Iess Ceibos');
    assert.equal(draft.address, '');
    assert.equal(draft.reference, '');
    assert.equal(resolution.fields.address.validation_status, CUSTOMER_DATA_STATUS.NOT_APPLICABLE);
    assert.equal(resolution.fields.reference.validation_status, CUSTOMER_DATA_STATUS.NOT_APPLICABLE);
    assert.equal(resolution.orderDataReady, true);
    assert.equal(resolution.qualityScore, 100);
    assert.equal(texUltraNextDataCollectionStep(draft).stage, 'awaiting_confirmation');
});

test('V54 confirmação e pedido de agência usam somente dados canônicos do catálogo', () => {
    const draft = {
        ...baseDraft,
        deliveryMode: 'agency',
        agencyId: 'EC-SA-A61F62FBBFE7E2B0',
        agencyName: 'Guayaquil Piazza Ceibos',
        agencyAddress: 'Av. Del Bombero S/n ( Piazza ) al Lado Del Hospital Del Iess Ceibos',
        address: '',
        reference: ''
    };
    const confirmation = texUltraConfirmationText(draft);
    assert.match(confirmation, /Agencia: Guayaquil Piazza Ceibos/);
    assert.match(confirmation, /Direccion de agencia: Av\. Del Bombero/);
    assert.doesNotMatch(confirmation, /Puedo retirarlo|Referencia:/);

    const operational = texUltraOrderDeliveryData(draft);
    assert.deepEqual(operational.delivery, {
        mode: 'agency',
        agencyId: 'EC-SA-A61F62FBBFE7E2B0',
        agencyName: 'Guayaquil Piazza Ceibos'
    });
    assert.equal(operational.reference, '');
    assert.equal(
        operational.address,
        'Servientrega Guayaquil Piazza Ceibos - Av. Del Bombero S/n ( Piazza ) al Lado Del Hospital Del Iess Ceibos - Guayaquil, Guayas'
    );
    assert.equal(operational.address, authorizedAgencyOrderAddress(draft));
});

test('V54 empate genérico de Plaza las Ceibas não vira agência automática', () => {
    const resolution = resolveServientregaEcuadorAgency({
        city: 'Guayaquil',
        province: 'Guayas',
        agencyName: 'Plaza las Ceibas',
        text: 'Plaza las Ceibas',
        limit: 3
    });
    assert.equal(resolution.confident, false);
    assert.equal(resolution.suggestions.length, 3);

    const customer = resolveCustomerDataDraft({
        conversationPhone: baseDraft.phone,
        source: 'customer_confirmation',
        confirmedByCustomerFields: ['deliveryMode', 'agency'],
        draft: { ...baseDraft, deliveryMode: 'agency', agencyName: 'Plaza las Ceibas' }
    });
    assert.equal(customer.draft.agencyId, '');
    assert.equal(customer.resolution.orderDataReady, false);
    assert.equal(customer.resolution.fields.agency.validation_status, CUSTOMER_DATA_STATUS.NEEDS_CONFIRMATION);
    assert.equal(customer.resolution.fields.agency.confidence, 45);
    assert.ok(customer.resolution.blockedReasons.includes('AUTHORIZED_AGENCY_REQUIRED'));
    assert.match(texUltraAgencyCandidatesText(customer.resolution.fields.agency.candidates), /^Encontré estas agencias autorizadas/m);
});

test('V54 seleção de agência usa apenas letras A, B ou C', () => {
    assert.equal(texUltraAgencySelectionIndex('A'), 0);
    assert.equal(texUltraAgencySelectionIndex('opción b'), 1);
    assert.equal(texUltraAgencySelectionIndex('c'), 2);
    assert.equal(texUltraAgencySelectionIndex('1'), -1);
    assert.equal(texUltraAgencySelectionIndex('sí'), -1);
});

test('V54 separa modalidade domiciliar de endereço operacional', () => {
    assert.equal(operationalHomeAddress('La entrega a domicilio'), '');
    assert.equal(texUltraDeliveryData('La entrega a domicilio').address, '');
    assert.equal(
        texUltraNextDataCollectionStep({ ...baseDraft, deliveryMode: 'home', address: '' }).stage,
        'awaiting_address'
    );

    const delivery = texUltraDeliveryData('Domicilio en Av. Cevallos 123');
    assert.equal(delivery.address, 'Av. Cevallos 123');
    assert.equal(
        texUltraNextDataCollectionStep({ ...baseDraft, ...delivery, reference: '' }).stage,
        'awaiting_reference'
    );
    const incomplete = resolveCustomerDataDraft({
        conversationPhone: baseDraft.phone,
        source: 'customer_confirmation',
        confirmedByCustomerFields: ['deliveryMode'],
        draft: { ...baseDraft, deliveryMode: 'home', address: 'La entrega a domicilio' }
    });
    assert.equal(incomplete.resolution.orderDataReady, false);
    assert.ok(incomplete.resolution.blockedReasons.includes('HOME_ADDRESS_REQUIRED'));
});

test('V54 reconhece correções rotuladas sem confundir conversa livre', () => {
    assert.deepEqual(
        texUltraConfirmationCorrections('Ciudad: Guayaquil\nAgencia: Piazza Ceibos\nCantidad: 3'),
        { city: 'Guayaquil', agencyName: 'Piazza Ceibos', quantity: '3' }
    );
    assert.deepEqual(
        texUltraConfirmationCorrections('Perdón, nombre es Rafael Zambrano'),
        { name: 'Rafael Zambrano' }
    );
    assert.deepEqual(texUltraConfirmationCorrections('Quiero saber cuándo llega'), {});
});

test('V54 reparo histórico exige alvo, confirmação e backup sem transporte externo', () => {
    const source = fs.readFileSync(new URL('../scripts/repair-tex-ultra-agency-order-v54.mjs', import.meta.url), 'utf8');
    assert.match(source, /--order-id EC exato é obrigatório/);
    assert.match(source, /TEX_ULTRA_AGENCY_ORDER_V54_CONTROLLED_REPAIR/);
    assert.match(source, /informe --backup=\/caminho\/absoluto\.json/);
    assert.match(source, /tracking\.productKey.*tex_ultra_ec/s);
    assert.match(source, /noWhatsappSend: true/);
    assert.match(source, /noMetaResend: true/);
    assert.match(source, /noDropiSubmit: true/);
    assert.doesNotMatch(source, /sendPurchaseEventForOrder|sendText\(|sendAudio\(|sendImage\(|submit.*Dropi/i);
});
