import test from 'node:test';
import assert from 'node:assert/strict';
import {
    normalizeVslAttributionMessage,
    selectUniqueVslAttributionCandidate
} from '../src/services/metaAttributionBridgeService.js';
import {
    hasMetaAdAttribution,
    orderHasMetaAttribution
} from '../src/services/metaAttributionService.js';
import { buildPurchaseEventPayloadForOrder } from '../src/services/metaConversionsService.js';
import { explicitEcVslProductContextFromText } from '../src/routes/zapi.js';

const inboundAt = new Date('2026-08-14T03:00:00.000Z');

const attributedVisit = (overrides = {}) => ({
    _id: 'visit-a',
    lastClickAt: new Date('2026-08-14T02:59:20.000Z'),
    lastWhatsappMessage: 'Hola, deseo recibir mas informacion sobre el producto.',
    tracking: {
        fbc: 'fb.1.1.click',
        utm_campaign: 'campaign-a'
    },
    ...overrides
});

test('normaliza a mensagem sem depender de acentos ou pontuacao', () => {
    assert.equal(
        normalizeVslAttributionMessage('  Holá, DESEO recibir más información!  '),
        'hola deseo recibir mas informacion'
    );
});

test('seleciona somente visita unica, exata, recente e com identificador de anuncio', () => {
    const result = selectUniqueVslAttributionCandidate({
        visits: [attributedVisit()],
        message: 'Hola, deseo recibir mas informacion sobre el producto.',
        inboundAt
    });
    assert.equal(result.ok, true);
    assert.equal(result.candidate._id, 'visit-a');
});

test('recusa correlacao ambigua em vez de atribuir venda ao anuncio errado', () => {
    const result = selectUniqueVslAttributionCandidate({
        visits: [
            attributedVisit(),
            attributedVisit({ _id: 'visit-b', lastClickAt: new Date('2026-08-14T02:59:35.000Z') })
        ],
        message: 'Hola, deseo recibir mas informacion sobre el producto.',
        inboundAt
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'ambiguous_exact_visit');
    assert.equal(result.candidates.length, 2);
});

test('sourceUrl isolada nao bloqueia o enriquecimento de atribuicao', () => {
    assert.equal(hasMetaAdAttribution({ sourceUrl: 'https://ec.maxlien.shop/tex-ultra/' }), false);
    assert.equal(orderHasMetaAttribution({ tracking: { sourceUrl: 'https://ec.maxlien.shop/tex-ultra/' } }), false);
    assert.equal(hasMetaAdAttribution({ fbc: 'fb.1.1.click' }), true);
    assert.equal(hasMetaAdAttribution({ utm_content: 'creative-a' }), true);
});

test('as duas frases A/B ativas identificam Tex Ultra na entrada', () => {
    const variantA = explicitEcVslProductContextFromText('Hola, quiero saber mas sobre Tex Ultra.');
    const variantB = explicitEcVslProductContextFromText('Hola, deseo recibir mas informacion sobre el producto.');
    assert.equal(variantA?.productKey, 'tex_ultra_ec');
    assert.equal(variantA?.vslVariant, 'a');
    assert.equal(variantB?.productKey, 'tex_ultra_ec');
    assert.equal(variantB?.vslVariant, 'b');
});

test('payload seco de Purchase preserva valor, USD, event_id e identificadores Meta', () => {
    const built = buildPurchaseEventPayloadForOrder({
        orderId: 'EC-TEST-ATTRIBUTION-DRY',
        country: 'EC',
        status: 'confirmed',
        total: 35.99,
        currency: 'USD',
        source: 'whatsapp',
        customer: {
            name: 'Cliente Teste',
            phone: '+593999999999',
            city: 'Quito',
            province: 'Pichincha'
        },
        package: { id: 1, quantity: 1, label: 'Tex Ultra Ecuador 1 frasco' },
        tracking: {
            productKey: 'tex_ultra_ec',
            productName: 'Tex Ultra Ecuador',
            contentName: 'Tex Ultra Ecuador WhatsApp',
            contentIds: ['tex_ultra_ec'],
            sourceUrl: 'https://ec.maxlien.shop/n/?utm_content=creative-test',
            fbc: 'fb.1.1.click-test',
            fbp: 'fb.1.1.browser-test',
            fbclid: 'click-test',
            utm_campaign: 'campaign-test',
            utm_content: 'creative-test',
            ext_id: 'visitor-test'
        }
    }, { eventTime: 1786676400 });

    assert.equal(built.ok, true);
    const event = built.payload.data[0];
    assert.equal(event.event_name, 'Purchase');
    assert.equal(event.event_id, 'EC-TEST-ATTRIBUTION-DRY');
    assert.equal(event.event_time, 1786676400);
    assert.equal(event.action_source, 'website');
    assert.equal(event.custom_data.value, 35.99);
    assert.equal(event.custom_data.currency, 'USD');
    assert.equal(event.user_data.fbc, 'fb.1.1.click-test');
    assert.equal(event.user_data.fbp, 'fb.1.1.browser-test');
    assert.equal(Array.isArray(event.user_data.ph), true);
    assert.equal(event.user_data.ph[0].length, 64);
});
