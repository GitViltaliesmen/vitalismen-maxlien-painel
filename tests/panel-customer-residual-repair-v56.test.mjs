import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { resolveCustomerDataDraft } from '../src/services/customerDataResolutionService.js';
import { materializePanelAgencyAddress } from '../src/services/panelCustomerFormPersistenceService.js';

const repairSource = fs.readFileSync('scripts/repair-panel-customer-residual-v56.mjs', 'utf8');
const resolvedAgency = (draft) => {
    const result = resolveCustomerDataDraft({
        draft,
        conversationPhone: draft.phone,
        source: 'human_correction',
        correctedByHumanFields: ['name', 'phone', 'city', 'province', 'deliveryMode', 'agency', 'quantity', 'total']
    });
    return { ...result, draft: materializePanelAgencyAddress(result) };
};

test('V56 materializa exatamente os quatro enderecos residuais autorizados', () => {
    const targets = [
        ['Guayaquil', 'Guayas', 'Guayaquil Los Almendros', 'EC-SA-F9D9090453293FF9', 'Servientrega Guayaquil Los Almendros - Cdla. Los Almendros mz o Solar 34 - Frente a Deprati Sur - Guayaquil, Guayas'],
        ['Duran', 'Guayas', 'Duran Panorama Av. Principal', 'EC-SA-89242AA72A017177', 'Servientrega Duran Panorama Av. Principal - Cdla Panorama mz g sl 12 - Diagonal Upc - Duran, Guayas'],
        ['Puyo', 'Pastaza', 'Puyo Principal', 'EC-SA-74C0445652FEDAD9', 'Servientrega Puyo Principal - 9 de Octubre S/n y Lucindo Ortega - Puyo, Pastaza'],
        ['San Camilo', 'Los Rios', 'San Camilo Mexico', 'EC-SA-7E527F5859F3E600', 'Servientrega San Camilo Mexico - Mexico 111 y Juan Montalvo - San Camilo, Los Rios']
    ];
    for (const [city, province, agencyName, agencyId, address] of targets) {
        const result = resolvedAgency({
            country: 'EC', name: 'Juan Perez', phone: '+593992012327',
            city, province, deliveryMode: 'agency', agencyName, quantity: 1, total: 35.99
        });
        assert.equal(result.resolution.orderDataReady, true);
        assert.equal(result.draft.agencyId, agencyId);
        assert.equal(result.draft.address, address);
    }
});

test('V56 separa Segundo 5201 com agencia canonica e sem pedido atual', () => {
    const result = resolvedAgency({
        country: 'EC', name: 'Segundo Bermeo', phone: '+593994885201',
        city: 'Guayaquil', province: 'Guayas', deliveryMode: 'agency',
        agencyName: 'Guayaquil Km 7.5 Via Daule', quantity: 3, total: 80.99
    });
    assert.equal(result.resolution.orderDataReady, true);
    assert.equal(result.draft.phone, '+593994885201');
    assert.equal(result.draft.agencyId, 'EC-SA-0E7EA5EF5C0629C0');
    assert.equal(
        result.draft.address,
        'Servientrega Guayaquil km 7.5 Via Daule - Via Daule km 7.5 S/n av Juan Tanca Marengo 1 mz 11 sl 8 Junto a Industrias Toni - Guayaquil, Guayas'
    );
    assert.match(repairSource, /orderId: '', sourceOrderId: '', previousOrderId: '', currentNegotiationOrderId: ''/);
});

test('V56 conserva Charly 6060 incompleto e impede fechamento com dados de Segundo', () => {
    const result = resolveCustomerDataDraft({
        draft: { country: 'EC', name: 'Charly', phone: '+593991886060' },
        conversationPhone: '+593991886060',
        source: 'human_correction',
        correctedByHumanFields: ['name', 'phone']
    });
    assert.equal(result.draft.name, 'Charly');
    assert.equal(result.draft.phone, '+593991886060');
    assert.equal(result.resolution.orderDataReady, false);
    assert.deepEqual(result.resolution.blockedReasons, [
        'CITY_NOT_CANONICAL', 'PROVINCE_NOT_RESOLVED', 'DELIVERY_MODE_REQUIRED'
    ]);
    assert.equal(result.resolution.qualityScore, 50);
});

test('V56 e um reparo exato sem transporte, Meta, Dropi ou mutacao do pedido enviado', () => {
    for (const id of ['EC-MT6FF9N1-AFWE', 'EC-MT6FJHIS-YRQQ', 'EC-MT6H0NR2-SBM5', 'EC-MT6KIOUM-EGZK']) {
        assert.match(repairSource, new RegExp(id));
    }
    assert.match(repairSource, /EC-MSWR401B-KNHS/);
    assert.match(repairSource, /stableJson\(historicalAfter\) !== historicalBefore/);
    assert.match(repairSource, /PANEL_CUSTOMER_RESIDUAL_V56_CONTROLLED_REPAIR/);
    assert.doesNotMatch(repairSource, /sendPurchaseEventForOrder|sendText\(|sendAudio\(|sendImage\(|sendZapi|submit.*Dropi/i);
});
