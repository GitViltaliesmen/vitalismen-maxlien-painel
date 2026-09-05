import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { searchPanelCustomersGlobally } from '../src/services/panelGlobalCustomerSearchService.js';
import {
    shipmentStatusDispatchActionForShipment,
    shipmentStatusDispatchCandidateQuery
} from '../src/services/shipmentStatusDispatcherService.js';
import { postSaleTransactionalAllowsManualHumanMode } from '../src/services/postSaleNotificationDecisionService.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const chain = (records = []) => ({
    sort() { return this; },
    limit() { return this; },
    lean() { return Promise.resolve(records); },
    then(resolve, reject) { return Promise.resolve(records).then(resolve, reject); }
});

const modelWith = (records = []) => ({ find: () => chain(records) });

test('busca digitada ignora apenas o filtro de fila e conserva a validação de identidade', () => {
    const source = fs.readFileSync(path.join(root, 'public/qr.html'), 'utf8');
    assert.match(source, /const warmupIsolationDecision = searchActive\s*\? undefined/);
    assert.match(source, /if \(!searchActive && warmupIsolationDecision === false\) return false/);
    assert.match(source, /return chatMatchesSearch\(chat, search\)/);
    assert.match(source, /visibleOperationalChats\(\{ search \}\)/);
});

test('busca histórica mostra guia e retirada já notificadas', async () => {
    const phone = '593989615041';
    const sentAt = new Date('2026-09-04T20:00:00Z');
    const order = {
        orderId: 'EC-V131-SEARCH',
        country: 'EC',
        status: 'shipped',
        updatedAt: sentAt,
        customer: { name: 'Teodulfo Ruiz', phone },
        package: { quantity: 1 },
        total: 35.99,
        currency: 'USD'
    };
    const shipment = {
        _id: 'shipment-v131',
        orderId: order.orderId,
        country: 'EC',
        updatedAt: sentAt,
        client: { name: order.customer.name, phone },
        logistics: {
            status: 'READY_FOR_PICKUP',
            trackingNumber: '189600871',
            agencyPickup: true,
            pickupReadyVerified: true
        },
        automation: {
            submittedToDroppiAt: sentAt,
            guiaNotifiedAt: sentAt,
            readyForPickupNotifiedAt: sentAt
        },
        review: { manualOnly: false },
        outcomes: {}
    };
    const models = {
        ContactState: modelWith([]),
        Order: modelWith([order]),
        Shipment: modelWith([shipment]),
        Message: modelWith([])
    };
    const result = await searchPanelCustomersGlobally({ query: '15041', models });
    assert.equal(result.count, 1);
    assert.equal(result.results[0].shipment.guiaNotifiedAt, sentAt);
    assert.deepEqual(
        result.results[0].shipmentNoticeStages.map((item) => item.label),
        ['Guia avisada', 'Agencia avisada']
    );
});

test('pedido Dropi recente e ainda pendente entra na reconciliação antes do aviso', () => {
    const now = new Date('2026-09-05T12:00:00Z');
    const query = shipmentStatusDispatchCandidateQuery(['guide'], now);
    const reconciliationBranch = query.$and[0].$or.find((branch) => (
        branch['automation.submittedToDroppiAt']?.$exists === true
    ));
    assert.ok(reconciliationBranch);
    assert.equal(reconciliationBranch['automation.guiaNotifiedAt'], null);
    assert.deepEqual(reconciliationBranch['logistics.status'].$in, ['CREATED', 'created', 'PENDIENTE', 'EN_PROCESAMIENTO']);
    assert.equal(reconciliationBranch.$or.length, 3);
    assert.equal(reconciliationBranch.createdAt.$gte.toISOString(), '2026-08-29T12:00:00.000Z');
});

test('pedido já em rota prioriza o aviso atual de trânsito sobre guia atrasada', () => {
    assert.equal(shipmentStatusDispatchActionForShipment({
        logistics: { status: 'EN_RUTA', trackingNumber: '189600831' },
        automation: { guiaNotifiedAt: null, inTransitNotifiedAt: null }
    }), 'in_transit');
});

test('modo humano só é liberado para o executor transacional V116 protegido', () => {
    assert.equal(postSaleTransactionalAllowsManualHumanMode({
        VITALISMEN_EC_POSTSALE_TRANSACTIONAL_OPERATIONAL: 'true',
        POST_SALE_TRANSACTIONAL_AT_MOST_ONCE_V116_ENABLED: 'true'
    }), true);
    assert.equal(postSaleTransactionalAllowsManualHumanMode({
        VITALISMEN_EC_POSTSALE_TRANSACTIONAL_OPERATIONAL: 'true',
        POST_SALE_TRANSACTIONAL_AT_MOST_ONCE_V116_ENABLED: 'false'
    }), false);
    assert.equal(postSaleTransactionalAllowsManualHumanMode({
        VITALISMEN_EC_POSTSALE_TRANSACTIONAL_OPERATIONAL: 'false',
        POST_SALE_TRANSACTIONAL_AT_MOST_ONCE_V116_ENABLED: 'true'
    }), false);
});
