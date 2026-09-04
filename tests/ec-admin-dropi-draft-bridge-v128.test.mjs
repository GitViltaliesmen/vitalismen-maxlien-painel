import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import { resolveEcAdminDropiDraftBridgeV128, enrichEcAdminDropiDraftFlagsV128 } from '../src/services/ecAdminDropiDraftBridgeV128Service.js';
import { resolveEcuadorProductInfo, ecuadorPackageLabel } from '../src/services/ecuadorProductService.js';

const sample = (productKey = 'vit_power_ec', quantity = 3, total = 95.99) => ({
    orderId: 'EC-ADMIN-1',
    lead: { id: 1, country: 'EC', phone: '+593999999999', name: 'Cliente Prueba', city: 'Santo Domingo', province: 'Santo Domingo', address: 'Servientrega oficina validada', status: 'confirmado', product_qty: quantity, product_value: total, notes: 'Ficha atendimento' },
    state: {
        phoneDigits: '593999999999', customerDataResolution: { orderDataReady: true, blockedReasons: [] },
        metadata: {
            vslProductKey: 'tex_ultra_ec',
            productRouteLock: { active: true, productKey },
            customerDraft: { country: 'EC', phone: '+593999999999', name: 'Cliente Prueba', city: 'Santo Domingo', province: 'Santo Domingo', address: 'Servientrega oficina validada', status: 'confirmado', productKey, quantity: String(quantity), total: String(total), deliveryMode: 'agency', agencyId: 'EC-SA-TEST', agencyName: 'Oficina validada' }
        }
    }
});

for (const productKey of ['vit_power_ec', 'tex_ultra_ec', 'nitrix_ec']) {
    test(`preserva escolha manual ${productKey}, oferta e origem separada`, () => {
        const input = sample(productKey);
        const before = structuredClone(input);
        const result = resolveEcAdminDropiDraftBridgeV128(input);
        assert.equal(result.product.key, productKey);
        assert.equal(result.orderFields.tracking.productSelectionSource, 'manual_customer_draft');
        assert.equal(result.orderFields.tracking.vslProductKey, 'tex_ultra_ec');
        assert.equal(result.orderFields.customerDataResolution.orderDataReady, true);
        assert.match(result.marker, /total=95\.99$/);
        assert.deepEqual(input, before);
    });
}

test('oferta promocional Tex Ultra conserva centavos e catalogo', () => {
    const result = resolveEcAdminDropiDraftBridgeV128(sample('tex_ultra_ec', 1, 35.99));
    assert.match(result.marker, /priceCatalog=promotional; quantity=1; total=35\.99$/);
});

test('lista recebe produto validado sem gravar ou expor o snapshot interno', () => {
    const input = sample();
    const flags = { 1: { status: 'confirmado', _draftBridgeLead: input.lead } };
    const before = structuredClone(flags);
    const result = enrichEcAdminDropiDraftFlagsV128(flags, [input.state]);
    assert.equal(result[1].productSelection.productKey, 'vit_power_ec');
    assert.equal(result[1].total, 95.99);
    assert.equal('_draftBridgeLead' in result[1], false);
    assert.deepEqual(flags, before);
    input.state.customerDataResolution.orderDataReady = false;
    const invalid = enrichEcAdminDropiDraftFlagsV128(flags, [input.state]);
    assert.equal(invalid[1].productSelection, undefined);
    assert.equal('_draftBridgeLead' in invalid[1], false);
});

test('lista usa o estado mais recente e preserva selecao Dropi existente', () => {
    const input = sample();
    const old = sample('nitrix_ec').state;
    const existing = { productKey: 'tex_ultra_ec' };
    const result = enrichEcAdminDropiDraftFlagsV128({
        1: { _draftBridgeLead: input.lead },
        2: { productSelection: existing, _draftBridgeLead: input.lead }
    }, [input.state, old]);
    assert.equal(result[1].productKey, 'vit_power_ec');
    assert.deepEqual(result[2].productSelection, existing);
    assert.equal('_draftBridgeLead' in result[2], false);
});

test('sem ficha e produto explicitamente configurado mantem o caminho existente', () => {
    assert.equal(resolveEcAdminDropiDraftBridgeV128({ lead: {} }), null);
    const input = sample();
    input.lead.notes = '[DROPI_PRODUCT] key=nitrix_ec; name=Nitrix; priceCatalog=normal; quantity=3; total=95.99';
    input.state.metadata.customerDraft.status = 'pendente';
    assert.equal(resolveEcAdminDropiDraftBridgeV128(input), null);
});

for (const [name, change, code] of [
    ['outro telefone da ficha', x => { x.state.metadata.customerDraft.phone = '+593988888888'; }, 'phone_mismatch'],
    ['outro contato', x => { x.state.phoneDigits = '593988888888'; }, 'phone_mismatch'],
    ['telefone brasileiro', x => { x.lead.phone = '+5515998038637'; }, 'phone_mismatch'],
    ['outro pais', x => { x.state.metadata.customerDraft.country = 'BR'; }, 'confirmation_required'],
    ['status sem confirmacao', x => { x.state.metadata.customerDraft.status = 'pendente'; }, 'confirmation_required'],
    ['produto desconhecido', x => { x.state.metadata.customerDraft.productKey = 'unknown'; }, 'product_conflict'],
    ['produto diferente da selecao bloqueada', x => { x.state.metadata.productRouteLock.productKey = 'nitrix_ec'; }, 'product_conflict'],
    ['preco divergente', x => { x.state.metadata.customerDraft.total = '80.99'; }, 'offer_mismatch'],
    ['quantidade divergente', x => { x.state.metadata.customerDraft.quantity = '6'; }, 'offer_mismatch'],
    ['oferta invalida', x => { x.lead.product_value = 0.01; }, 'offer_mismatch'],
    ['dados incompletos', x => { x.state.customerDataResolution.orderDataReady = false; }, 'data_required'],
    ['dados bloqueados', x => { x.state.customerDataResolution.blockedReasons = ['identity']; }, 'data_required'],
    ['endereco divergente', x => { x.state.metadata.customerDraft.address = 'Outra agencia'; }, 'destination_mismatch'],
    ['agencia ausente', x => { x.state.metadata.customerDraft.agencyId = ''; }, 'delivery_required'],
    ['ciclo vinculado', x => { x.state.metadata.customerDraft.orderId = 'EC-RECOMPRA-2'; }, 'existing_cycle'],
    ['recompra antiga', x => { x.state.metadata.customerDraft.previousOrderId = 'EC-DROPI-1'; }, 'existing_cycle']
]) {
    test(`recusa ${name} antes de criar pedido`, () => {
        const input = sample(); change(input);
        assert.throws(() => resolveEcAdminDropiDraftBridgeV128(input), error => error.status === 409 && error.code.endsWith(code));
    });
}

test('ponte real de Leads Clientes grava produto, validacao e entrega na autorizacao', async () => {
    const source = fs.readFileSync(new URL('../src/routes/shipments.js', import.meta.url), 'utf8');
    const body = source.split('const createOperationalOrderFromAdminLead = async (requestedOrderId, lead) => {')[1].split('\nconst findCurrentOrderForAdminLead')[0];
    let saved = 0;
    class Order { constructor(fields) { Object.assign(this, fields); } async save() { saved++; } }
    const input = sample();
    const context = vm.createContext({
        Order, resolveEcAdminDropiDraftBridgeV128, resolveEcuadorProductInfo,
        findContactStateForAdminLead: async () => input.state,
        getAdminLeadIdFromOrderId: () => 1,
        normalizePackageQuantity: Number, parseMoney: Number,
        packageLabel: (quantity, product) => ecuadorPackageLabel(product, quantity)
    });
    const create = vm.runInContext(`async (requestedOrderId, lead) => {${body}`, context);
    const result = await create(input.orderId, input.lead);
    assert.equal(saved, 1);
    assert.equal(result.tracking.productKey, 'vit_power_ec');
    assert.equal(result.total, 95.99);
    assert.equal(result.delivery.agencyId, 'EC-SA-TEST');
    assert.equal(result.customerDataResolution.orderDataReady, true);
    assert.equal(resolveEcuadorProductInfo(result).key, 'vit_power_ec');
    input.state.customerDataResolution.orderDataReady = false;
    await assert.rejects(() => create(input.orderId, input.lead), /Complete e valide/);
    assert.equal(saved, 1);
});
