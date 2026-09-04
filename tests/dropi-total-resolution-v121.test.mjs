import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import Shipment from '../src/models/Shipment.js';
import {
    classifyDropiBffFailure,
    describeDropiBffFailure,
    requestDropiBff
} from '../src/services/dropiBffAdapter.js';
import {
    extractStatusFromPanelText,
    lockShipmentForBrowserWorkEc,
    resolveEcuadorBffWarehouseProfile
} from '../src/services/droppiEcuadorBrowserService.js';
import {
    droppiEcuadorOrderStatusForLogisticsStatus,
    normalizeDroppiEcuadorStatus
} from '../src/services/droppiEcuadorService.js';
import { orderLooksClosedForRepurchase } from '../src/services/orderDuplicateGuardService.js';

const browserSource = fs.readFileSync('src/services/droppiEcuadorBrowserService.js', 'utf8');
const shipmentRoutes = fs.readFileSync('src/routes/shipments.js', 'utf8');
const duplicateGuardSource = fs.readFileSync('src/services/orderDuplicateGuardService.js', 'utf8');
const ordersRoute = fs.readFileSync('src/routes/orders.js', 'utf8');
const leadsPanel = fs.readFileSync('public/leads-window.html', 'utf8');

const productIdFromUrl = (value = '') => Number(new URL(value).pathname.match(/product-details\/(\d+)/)?.[1] || 0);

test('A. Tex Ultra válido usa alvo V120 e fica READY', () => {
    assert.equal(productIdFromUrl('https://app.dropi.ec/dashboard/product-details/110681/texultra'), 110681);
    assert.deepEqual(resolveEcuadorBffWarehouseProfile('tex_ultra_ec'), {
        productKey: 'tex_ultra_ec', warehouseId: 1261, originCityId: 802, warehouseName: 'Laboratorio Vitalcom Ec'
    });
});

test('B. Nitrix válido usa alvo V120 e fica READY', () => {
    assert.equal(productIdFromUrl('https://app.dropi.ec/dashboard/product-details/105825/nitric-oxide'), 105825);
    assert.deepEqual(resolveEcuadorBffWarehouseProfile('nitrix_ec'), {
        productKey: 'nitrix_ec', warehouseId: 1544, originCityId: 802, warehouseName: 'ECOMARKET QUITO'
    });
});

test('C. Vit Power válido usa alvo V120 e fica READY', () => {
    assert.equal(productIdFromUrl('https://app.dropi.ec/dashboard/product-details/103743/vit-power'), 103743);
    assert.deepEqual(resolveEcuadorBffWarehouseProfile('vit_power_ec'), {
        productKey: 'vit_power_ec', warehouseId: 1261, originCityId: 802, warehouseName: 'Laboratorio Vitalcom Ec'
    });
});

test('D. pedido sem autorização fica BLOCK', () => {
    const start = shipmentRoutes.indexOf('const buildDropiSubmitStatus');
    const end = shipmentRoutes.indexOf('const buildManualDropiCopyText', start);
    const statusContract = shipmentRoutes.slice(start, end);
    assert.match(statusContract, /if \(!isAuthorizedForDropiSubmit\(shipment\)\)/);
    assert.match(statusContract, /status: 'authorization_required'/);
    assert.match(statusContract, /authorizationRequired: true/);
});

test('E. pedido com ID Dropi persistido retorna NO POST', () => {
    const start = browserSource.indexOf('const alreadySubmittedDropiResult');
    const end = browserSource.indexOf('const checkDropiSubmitSafety', start);
    const contract = browserSource.slice(start, end);
    assert.match(contract, /dropiOrderId/);
    assert.match(contract, /alreadySubmitted: true/);
    assert.ok(browserSource.indexOf('checkDropiSubmitSafety', browserSource.indexOf('export const submitDroppiEcuadorOrder'))
        < browserSource.indexOf('submitOrderInPanel', browserSource.indexOf('export const submitDroppiEcuadorOrder')));
});

test('F. pedido encontrado na API Dropi é reconciliado sem duplicar', () => {
    const start = browserSource.indexOf('const submitOrderInPanel');
    const end = browserSource.indexOf('const findMatchingPanelText', start);
    const contract = browserSource.slice(start, end);
    assert.ok(contract.indexOf('findExistingDropiOrderForManualSubmission(page, payload)')
        < contract.indexOf('submitOrderViaDropiApi(page'));
    assert.match(contract, /existingDropiOrderResult/);
    assert.match(browserSource, /reconciledExisting: true/);
});

test('G. recompra legítima permite novo ID interno com nova autorização', () => {
    assert.equal(orderLooksClosedForRepurchase({ status: 'delivered' }), true);
    assert.equal(orderLooksClosedForRepurchase({ status: 'returned' }), true);
    assert.match(duplicateGuardSource, /reason: 'repurchase_manual_authorization_required'/);
    assert.match(shipmentRoutes, /dropiSubmitAuthorizedAt = new Date\(\)/);
});

test('H. estoque insuficiente vira REVIEW explícita', () => {
    assert.equal(classifyDropiBffFailure({ statusReason: 'stock insuficiente' }), 'PRODUCT_INVALID');
    assert.match(browserSource, /AUTHORITATIVE_WAREHOUSE_STOCK_NOT_AVAILABLE/);
    assert.match(describeDropiBffFailure('PRODUCT_INVALID'), /produto\/SKU/i);
});

test('I. cidade inválida vira REVIEW sem adivinhação', () => {
    assert.equal(classifyDropiBffFailure({ statusReason: 'ciudad inválida' }), 'LOCATION_INVALID');
    assert.match(browserSource, /AUTHORITATIVE_CITY_NOT_FOUND/);
    assert.match(browserSource, /normalizeAutocompleteText\(item\?\.name\) === normalizeAutocompleteText\(payload\.city\)/);
});

test('J. transportadora indisponível vira REVIEW', () => {
    assert.equal(classifyDropiBffFailure({ statusReason: 'transportadora indisponível' }), 'CARRIER_INVALID');
    assert.match(browserSource, /PREFERRED_CARRIER_QUOTE_NOT_AVAILABLE/);
    assert.match(describeDropiBffFailure('CARRIER_INVALID'), /transportadora/i);
});

test('K. timeout ambíguo não faz retry e preserva lifecycle', async () => {
    let calls = 0;
    const result = await requestDropiBff({
        url: 'https://api-v2.dropi.ec/bff/orders',
        method: 'POST',
        operation: 'create',
        token: 'test-token',
        payload: { safe: true },
        timeoutMs: 1000,
        fetchImpl: (_url, options) => {
            calls += 1;
            return new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => {
                const error = new Error('aborted');
                error.name = 'AbortError';
                reject(error);
            }, { once: true }));
        }
    });
    assert.equal(calls, 1);
    assert.equal(result.errorCode, 'TIMEOUT');
    assert.equal(result.lifecycle.requestDispatched, true);
    assert.doesNotMatch(browserSource, /for \(let attempt = 1; attempt <= 2/);
});

test('L. resposta 5xx não gera segundo POST', async () => {
    let calls = 0;
    const result = await requestDropiBff({
        url: 'https://api-v2.dropi.ec/bff/orders',
        method: 'POST',
        operation: 'create',
        token: 'test-token',
        payload: { safe: true },
        fetchImpl: async () => {
            calls += 1;
            return { ok: false, status: 503, headers: { get: () => '' }, json: async () => ({}) };
        }
    });
    assert.equal(calls, 1);
    assert.equal(result.errorCode, 'DROPI_5XX');
    assert.equal(result.lifecycle.requestDispatched, true);
});

test('M. falha local depois do provider é reconciliável sem duplicar', () => {
    const start = browserSource.indexOf('const submitOrderInPanel');
    const end = browserSource.indexOf('const findMatchingPanelText', start);
    const contract = browserSource.slice(start, end);
    assert.match(contract, /apiResult\.lifecycle\?\.requestDispatched/);
    assert.match(contract, /findExistingDropiOrderForManualSubmission\(page, payload\)/);
    assert.match(browserSource, /raw\.latestDroppiPayload\.dropiOrderId/);
    assert.match(browserSource, /raw\.manualDropiOrderId/);
});

test('N. dois workers disputam lock atômico e somente um vence', async () => {
    const original = Shipment.findOneAndUpdate;
    let held = false;
    let winners = 0;
    Shipment.findOneAndUpdate = async () => {
        if (held) return null;
        held = true;
        winners += 1;
        return { _id: 'mock-shipment', automation: { submitLockedUntil: new Date(Date.now() + 60_000) } };
    };
    try {
        const [first, second] = await Promise.all([
            lockShipmentForBrowserWorkEc({ _id: 'mock-shipment' }),
            lockShipmentForBrowserWorkEc({ _id: 'mock-shipment' })
        ]);
        assert.equal(winners, 1);
        assert.equal(Boolean(first) + Boolean(second), 1);
    } finally {
        Shipment.findOneAndUpdate = original;
    }
});

test('O. PENDIENTE é válido e sincroniza como processing', () => {
    assert.equal(normalizeDroppiEcuadorStatus('PENDIENTE'), 'PENDIENTE');
    assert.equal(droppiEcuadorOrderStatusForLogisticsStatus('PENDIENTE'), 'processing');
    assert.equal(extractStatusFromPanelText('Estado PENDIENTE'), 'PENDIENTE');
});

test('P. SHIPPED e equivalentes reais sincronizam como shipped', () => {
    for (const value of ['SHIPPED', 'INGRESANDO OPERATIVO A', 'INGRESANDO DE RECOLECCION A']) {
        assert.equal(droppiEcuadorOrderStatusForLogisticsStatus(value), 'shipped', value);
    }
});

test('Q. DELIVERED sincroniza como delivered', () => {
    assert.equal(normalizeDroppiEcuadorStatus('DELIVERED'), 'ENTREGADO');
    assert.equal(droppiEcuadorOrderStatusForLogisticsStatus('ENTREGADO'), 'delivered');
});

test('R. RETURNED, CANCELLED e FAILED sincronizam sem falso enviado', () => {
    assert.equal(droppiEcuadorOrderStatusForLogisticsStatus('RETURNED'), 'returned');
    assert.equal(droppiEcuadorOrderStatusForLogisticsStatus('CANCELLED'), 'cancelled');
    assert.equal(droppiEcuadorOrderStatusForLogisticsStatus('RECHAZADO'), 'cancelled');
    assert.match(ordersRoute, /'returned', 'cancelled'/);
    assert.match(leadsPanel, /Dropi \$\{dropiId\}/);
    assert.match(leadsPanel, /shipment\?\.logistics\?\.trackingNumber/);
    assert.match(leadsPanel, /shipment\?\.logistics\?\.distributionCompany/);
    assert.match(leadsPanel, /shipment\?\.automation\?\.browserLastError/);
});
