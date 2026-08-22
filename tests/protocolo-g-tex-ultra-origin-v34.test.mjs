import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
    explicitEcVslProductContextFromText,
    protocoloGTexUltraContextFromText
} from '../src/routes/zapi.js';
import { publicEcVslProductFromBody } from '../src/routes/whatsapp.js';
import {
    operatorProductRouteLock,
    vslProductAssignmentPolicy
} from '../src/services/vslProductAssignmentService.js';

const protocoloGPayload = [
    'Hola, quiero el tratamiento.',
    'Nombre: Cliente Protocolo',
    'CIUDAD: Quito',
    'PROVINCIA: Pichincha'
].join('\n');

test('payload rotulado do Protocolo G identifica Tex Ultra sem depender do produto global', () => {
    const previous = process.env.VITALISMEN_ACTIVE_VSL_PRODUCT;
    process.env.VITALISMEN_ACTIVE_VSL_PRODUCT = 'vit_power_ec';
    try {
        const context = explicitEcVslProductContextFromText(protocoloGPayload);
        assert.equal(context?.productKey, 'tex_ultra_ec');
        assert.equal(context?.productSource, 'zapi_protocolo_g_tex_ultra_payload');
        assert.equal(context?.vslVariant, 'protocolo_g');
    } finally {
        if (previous === undefined) delete process.env.VITALISMEN_ACTIVE_VSL_PRODUCT;
        else process.env.VITALISMEN_ACTIVE_VSL_PRODUCT = previous;
    }
});

test('mensagem nova e explícita do Protocolo G também identifica Tex Ultra', () => {
    const context = protocoloGTexUltraContextFromText(protocoloGPayload.replace(
        'Hola, quiero el tratamiento.',
        'Hola, quiero el tratamiento Tex Ultra.'
    ));
    assert.equal(context?.productKey, 'tex_ultra_ec');
});

test('assinatura Protocolo G é estrita e não captura a VSL Vit Power', () => {
    const vitPowerPayload = protocoloGPayload.replace(
        'Hola, quiero el tratamiento.',
        'Hola, quiero el tratamiento Vit Power.'
    );
    assert.equal(protocoloGTexUltraContextFromText(vitPowerPayload), null);
    assert.equal(explicitEcVslProductContextFromText(vitPowerPayload)?.productKey, 'vit_power_ec');
    assert.equal(protocoloGTexUltraContextFromText('Hola, quiero el tratamiento.\nDIRECCION: Calle 1'), null);
});

test('endpoint público resolve /protocolo-g como Tex mesmo com chave legada do pixel', () => {
    const protocolo = publicEcVslProductFromBody({
        path: '/protocolo-g',
        productKey: 'vit_power_ec',
        event_source_url: 'https://vilaliemen.shop/protocolo-g'
    });
    assert.equal(protocolo.productKey, 'tex_ultra_ec');
    assert.equal(protocolo.source, 'ec_protocolo_g_tex_ultra_vsl');
    assert.equal(publicEcVslProductFromBody({ path: '/m/' }).productKey, 'vit_power_ec');
    assert.equal(publicEcVslProductFromBody({ path: '/n/' }).productKey, 'tex_ultra_ec');
    assert.equal(publicEcVslProductFromBody({ productKey: 'nitrix_ec' }).productKey, 'nitrix_ec');
});

test('troca manual da negociação fica soberana sem apagar a origem da VSL', () => {
    const manualLock = operatorProductRouteLock({
        productKey: 'nitrix_ec',
        productName: 'Nitrix Oxide Ecuador',
        selectedBy: 'operador',
        selectedAt: '2026-08-22T01:00:00.000Z'
    });
    const state = {
        assignedAgent: 'nitrix_ec',
        metadata: {
            productKey: 'nitrix_ec',
            vslProductKey: 'tex_ultra_ec',
            productRouteLock: manualLock,
            customerDraft: { productKey: 'nitrix_ec' }
        }
    };
    const policy = vslProductAssignmentPolicy({ state, incomingProductKey: 'tex_ultra_ec' });
    assert.equal(policy.preserveOperatorSelection, true);
    assert.equal(policy.currentProductKey, 'nitrix_ec');
    assert.equal(state.metadata.vslProductKey, 'tex_ultra_ec');
});

test('entrada nova da VSL aplica o produto de origem diretamente na ficha', () => {
    const policy = vslProductAssignmentPolicy({ state: {}, incomingProductKey: 'tex_ultra_ec' });
    assert.equal(policy.preserveOperatorSelection, false);
    assert.equal(policy.currentProductKey, 'tex_ultra_ec');
});

test('seleção estruturada anterior à V34 também é preservada quando há operador humano', () => {
    const state = {
        assignedAgent: 'vit_power_ec',
        human: {
            lastManualBy: 'Administrador Maxlien',
            lastManualAt: '2026-08-18T12:00:00.000Z'
        },
        metadata: {
            productKey: 'nitrix_ec',
            customerDraft: {
                productKey: 'nitrix_ec',
                productName: 'Nitrix Oxide Ecuador',
                updatedAt: '2026-08-18T12:00:00.000Z'
            }
        }
    };
    const policy = vslProductAssignmentPolicy({ state, incomingProductKey: 'tex_ultra_ec' });
    assert.equal(policy.preserveOperatorSelection, true);
    assert.equal(policy.currentProductKey, 'nitrix_ec');
    assert.equal(policy.operatorLock.source, 'reconciled_panel_customer_product_selection_v34');
});

test('seletor multiproduto e trava de qualidade dos dados permanecem no painel', () => {
    const panel = fs.readFileSync(new URL('../public/qr.html', import.meta.url), 'utf8');
    assert.match(panel, /<select id="customerProductInput">/);
    assert.match(panel, /<option value="tex_ultra_ec">Tex Ultra Ecuador<\/option>/);
    assert.match(panel, /<option value="nitrix_ec">Nitrix Oxide Ecuador<\/option>/);
    assert.match(panel, /<option value="vit_power_ec">Vit Power Ecuador<\/option>/);
    assert.match(panel, /id="customerDataQuality"/);
    assert.match(panel, /Pedido bloqueado até validação segura/);
});
