import test from 'node:test';
import assert from 'node:assert/strict';
import {
    normalizeCustomerImageData,
    readEcuadorCustomerImage
} from '../src/services/customerImageDataReaderService.js';

test('normaliza cidade e provincia da imagem somente pelo catalogo oficial', () => {
    const result = normalizeCustomerImageData({
        imageKind: 'google_maps',
        address: 'Calle 10 de Agosto 123',
        reference: 'Frente al parque',
        city: 'CIVO Portoviejo',
        province: 'EM MANAVI',
        confidence: 'high'
    });
    assert.equal(result.city, 'Portoviejo');
    assert.equal(result.province, 'Manabi');
    assert.equal(result.locationMatched, true);
});
test('nao aplica local desconhecido como se fosse cidade valida', () => {
    const result = normalizeCustomerImageData({
        city: 'Lugar Inventado',
        province: 'Provincia Inventada',
        confidence: 'medium'
    });
    assert.equal(result.city, '');
    assert.equal(result.province, '');
    assert.equal(result.locationMatched, false);
});

test('usa imagem base64 e saida estruturada sem armazenar a resposta', async () => {
    let request = null;
    const client = {
        responses: {
            create: async (payload) => {
                request = payload;
                return {
                    output_text: JSON.stringify({
                        imageKind: 'google_maps',
                        name: '',
                        address: 'Av. América 118',
                        reference: 'Reales Tamarindos',
                        city: 'Portoviejo',
                        province: 'Manabi',
                        evidence: 'Av. América 118, Portoviejo',
                        confidence: 'high'
                    })
                };
            }
        }
    };
    const result = await readEcuadorCustomerImage({
        imageDataUrl: `data:image/png;base64,${Buffer.from('test-image').toString('base64')}`,
        client
    });
    assert.equal(request.store, false);
    assert.equal(request.input[0].content[1].type, 'input_image');
    assert.equal(request.text.format.type, 'json_schema');
    assert.equal(result.city, 'Portoviejo');
    assert.equal(result.province, 'Manabi');
});
