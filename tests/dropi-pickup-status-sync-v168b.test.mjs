import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { assertV168bBaselineBootstrapContract } from '../scripts/lib/ec-runtime-successor-v168b-bootstrap-context.mjs';
import {
    authoritativeDropiPickupReleaseV168B,
    pickupReadyVerifiedSourceAllowedV168B,
    preserveDropiPickupReleaseAgainstCarrierV168B,
    shipmentHasAuthoritativeDropiPickupReleaseV168B
} from '../src/services/dropiPickupReleaseV168BService.js';
import { logisticsCommunicationPolicy } from '../src/services/logisticsCommunicationV29.js';
import { mapOrdersApiRowToSyncResult } from '../src/services/droppiEcuadorBrowserService.js';
import { persistDropiStatusProjectionV139 } from '../src/services/ecDropiStatusPostSaleV139Service.js';
import { pickupEventEligibleV147R6R2 } from '../src/services/postSaleUnifiedEventV147R6Service.js';
import {
    POST_SALE_NOTIFICATION_DECISIONS,
    decidePostSaleNotification
} from '../src/services/postSaleNotificationDecisionService.js';
import {
    shipmentStatusDispatchActionForShipment,
    shipmentStatusDispatchCandidateQuery
} from '../src/services/shipmentStatusDispatcherService.js';

const liveDropiPickupShipment = () => ({
    _id: 'shipment-v168b',
    orderId: 'EC-V168B-1',
    client: { phone: '+593999999999' },
    logistics: {
        status: 'READY_FOR_PICKUP',
        canonicalStatus: 'READY_FOR_PICKUP',
        canonicalEvidence: {
            provider: 'dropi',
            source: 'dropi_orders_api',
            rawStatus: 'PARA RETIRO EN AGENCIA SERVIENTREGA'
        },
        trackingNumber: '189999999',
        distributionCompany: 'SERVIENTREGA',
        agencyPickup: true,
        canPickup: true,
        pickupReadyVerified: true,
        pickupReadyVerifiedSource: 'dropi_orders_api'
    },
    raw: {
        manualDropiOrderId: '7123456',
        latestDroppiPayload: {
            status: 'submitted',
            dropiStatus: 'PARA RETIRO EN AGENCIA SERVIENTREGA',
            reconciliationSource: 'dropi_orders_api',
            dropiOrderId: '7123456',
            trackingNumber: '189999999',
            distributionCompany: 'SERVIENTREGA'
        }
    },
    automation: {},
    outcomes: {},
    review: {}
});

test('V168B aceita somente a liberação explícita autenticada da API Dropi', () => {
    const exact = liveDropiPickupShipment();
    assert.equal(shipmentHasAuthoritativeDropiPickupReleaseV168B(exact), true);
    assert.equal(authoritativeDropiPickupReleaseV168B({
        status: 'PARA RETIRO EN AGENCIA SERVIENTREGA',
        source: 'dropi_orders_api',
        dropiOrderId: '7123456',
        trackingNumber: '189999999',
        agencyPickup: true,
        distributionCompany: 'SERVIENTREGA'
    }), true);

    for (const mutation of [
        { source: 'dropi_panel' },
        { status: 'INGRESANDO EN AGENCIA' },
        { trackingNumber: '' },
        { dropiOrderId: '' },
        { agencyPickup: false },
        { distributionCompany: 'OUTRA' }
    ]) {
        const input = {
            status: 'PARA RETIRO EN AGENCIA SERVIENTREGA',
            source: 'dropi_orders_api',
            dropiOrderId: '7123456',
            trackingNumber: '189999999',
            agencyPickup: true,
            distributionCompany: 'SERVIENTREGA',
            ...mutation
        };
        assert.equal(authoritativeDropiPickupReleaseV168B(input), false, JSON.stringify(mutation));
    }
});

test('V168B preserva o status bruto autenticado ao normalizar a linha da API Dropi', () => {
    const mapped = mapOrdersApiRowToSyncResult({
        id: 7123456,
        name: 'Cliente',
        surname: 'Teste',
        phone: '593999999999',
        dir: 'SERVIENTREGA AGENCIA CENTRAL',
        city: 'QUITO',
        state: 'PICHINCHA',
        status: 'PARA RETIRO EN AGENCIA SERVIENTREGA',
        sticker: '189999999',
        distribution_company: { name: 'SERVIENTREGA' }
    }, {
        client: {},
        logistics: {},
        raw: {}
    });

    assert.equal(mapped.source, 'orders_api_v2');
    assert.equal(mapped.status, 'READY_FOR_PICKUP');
    assert.equal(mapped.rawStatus, 'PARA RETIRO EN AGENCIA SERVIENTREGA');
    assert.equal(authoritativeDropiPickupReleaseV168B({
        status: mapped.rawStatus,
        source: 'dropi_orders_api',
        dropiOrderId: mapped.dropiOrderId,
        trackingNumber: mapped.trackingNumber,
        agencyPickup: mapped.agencyPickup,
        distributionCompany: mapped.distributionCompany
    }), true);
});

test('V168B bloqueia aviso canônico quando o histórico humano já comunicou a retirada', async () => {
    const shipment = liveDropiPickupShipment();
    const manualNotice = {
        _id: 'manual-pickup-notice',
        isFromMe: true,
        isBot: false,
        senderRole: 'human',
        peerPhone: shipment.client.phone,
        body: `*PEDIDO* PARA RETIRO EN AGENCIA SERVIENTREGA GUIA ${shipment.logistics.trackingNumber}`,
        providerMessageId: 'manual-provider-id',
        ack: 2,
        createdAt: new Date()
    };
    const messageModel = {
        find() {
            return {
                sort() { return this; },
                limit() { return this; },
                async lean() { return [manualNotice]; }
            };
        }
    };

    const decision = await decidePostSaleNotification({
        shipment,
        kind: 'ready_for_pickup',
        acquireLock: false,
        messageModel
    });

    assert.equal(decision.decision, POST_SALE_NOTIFICATION_DECISIONS.ALREADY_NOTIFIED_MANUALLY);
    assert.equal(decision.reason, 'matching_human_message_history');
});

test('V168B preserva release Dropi contra atraso de trânsito, mas nunca contra estado terminal', () => {
    const shipment = liveDropiPickupShipment();
    assert.equal(preserveDropiPickupReleaseAgainstCarrierV168B({
        shipment,
        carrierCanonicalStatus: 'ENTERING_AGENCY'
    }), true);
    assert.equal(preserveDropiPickupReleaseAgainstCarrierV168B({
        shipment,
        carrierCanonicalStatus: 'IN_TRANSIT'
    }), true);
    for (const terminal of ['DELIVERED', 'RETURNED', 'EXCEPTION', 'NOT_PICKED_UP', 'RETURNING']) {
        assert.equal(preserveDropiPickupReleaseAgainstCarrierV168B({
            shipment,
            carrierCanonicalStatus: terminal
        }), false, terminal);
    }
});

test('V168B libera painel e pós-venda somente para fontes verificadas', () => {
    const shipment = liveDropiPickupShipment();
    assert.equal(pickupReadyVerifiedSourceAllowedV168B('carrier_tracking'), true);
    assert.equal(pickupReadyVerifiedSourceAllowedV168B('dropi_orders_api'), true);
    assert.equal(pickupReadyVerifiedSourceAllowedV168B('dropi_explicit_pickup_release'), false);
    assert.equal(logisticsCommunicationPolicy(shipment).allowPickupLanguage, true);
    assert.equal(pickupEventEligibleV147R6R2(shipment, 'READY_FOR_PICKUP'), true);
    assert.equal(shipmentStatusDispatchActionForShipment(shipment), 'ready_for_pickup');

    shipment.logistics.pickupReadyVerifiedSource = 'dropi_panel';
    assert.equal(logisticsCommunicationPolicy(shipment).allowPickupLanguage, false);
    assert.equal(pickupEventEligibleV147R6R2(shipment, 'READY_FOR_PICKUP'), false);
});

test('V168B persiste a prova da API Dropi no shipment, pedido e projeção do painel', async () => {
    const shipment = liveDropiPickupShipment();
    shipment.events = [];
    shipment.save = async () => shipment;
    const order = {
        orderId: shipment.orderId,
        country: 'EC',
        status: 'shipped',
        customer: { phone: shipment.client.phone },
        reviewQueue: {},
        async save() { return this; }
    };
    const state = {
        metadata: { customerDraft: { orderId: shipment.orderId, status: 'pedido_enviado' } },
        markModified() {},
        async save() { return this; }
    };
    const result = await persistDropiStatusProjectionV139({
        shipment,
        orderModel: { async findOne() { return order; } },
        contactStateModel: {
            findOne() { return { async sort() { return state; } }; }
        },
        syncPanel: () => ({ ok: true, lead_id: 163 })
    });

    assert.equal(result.ok, true);
    assert.equal(shipment.logistics.canonicalStatus, 'READY_FOR_PICKUP');
    assert.equal(shipment.logistics.canonicalEvidence.source, 'dropi_orders_api');
    assert.equal(shipment.logistics.canonicalEvidence.provider, 'dropi');
    assert.equal(shipment.logistics.pickupReadyVerified, true);
    assert.equal(shipment.logistics.pickupReadyVerifiedSource, 'dropi_orders_api');
    assert.equal(order.shippingStatus, 'READY_FOR_PICKUP');
    assert.equal(order.shippingCanonicalStatus, 'READY_FOR_PICKUP');
    assert.equal(state.metadata.logistics.canPickup, true);
    assert.equal(state.metadata.logistics.panelLabel, 'Disponível para retirada');
});

test('V168B inclui ambas as provas na seleção e sincroniza antes do preflight mutável', () => {
    const query = JSON.stringify(shipmentStatusDispatchCandidateQuery(['ready_for_pickup']));
    assert.match(query, /carrier_tracking/);
    assert.match(query, /dropi_orders_api/);

    const source = fs.readFileSync(
        new URL('../src/services/shipmentStatusDispatcherService.js', import.meta.url),
        'utf8'
    );
    const mutablePath = source.slice(source.indexOf('let shipmentForSend = lockedShipment'));
    const refreshIndex = mutablePath.indexOf('await refreshShipmentBeforeDispatch(');
    const preflightIndex = mutablePath.indexOf('const priorDecision = await decideDispatchNotificationV147R6');
    assert.ok(refreshIndex >= 0);
    assert.ok(preflightIndex > refreshIndex);
});

test('V168B bootstrap aceita somente hashes exatos e rejeita wildcard', () => {
    const context = globalThis.__VITALISMEN_V168B_BASELINE_BOOTSTRAP_CONTEXT;
    assert.equal(context?.loaded, true);
    const manifest = JSON.parse(fs.readFileSync(
        new URL('../docs/freeze/ec-runtime-guard-baseline-bootstrap-v168b-20260916.json', import.meta.url),
        'utf8'
    ));
    const historicalHashes = new Map(
        Object.entries(manifest.protectedFiles).map(([file, sha256]) => [file, new Set([sha256])])
    );
    const valid = {
        manifest: structuredClone(manifest),
        currentHashes: { ...manifest.protectedFiles },
        historicalHashes
    };
    assert.doesNotThrow(() => assertV168bBaselineBootstrapContract(valid));

    const wildcard = structuredClone(manifest);
    wildcard.authorizedOverrideFiles[0] = 'src/services/*.js';
    assert.throws(() => assertV168bBaselineBootstrapContract({
        ...valid,
        manifest: wildcard
    }));

    const changed = { ...manifest.protectedFiles, [manifest.authorizedOverrideFiles[0]]: '0'.repeat(64) };
    assert.throws(() => assertV168bBaselineBootstrapContract({
        ...valid,
        currentHashes: changed
    }));
});
