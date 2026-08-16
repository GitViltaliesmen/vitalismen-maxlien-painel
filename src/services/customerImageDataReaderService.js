import OpenAI from 'openai';
import { findKnownServientregaEcuadorLocation } from './servientregaEcuadorAgencyService.js';

const IMAGE_DATA_URL_PATTERN = /^data:image\/(jpeg|png|webp|gif);base64,([a-z0-9+/=]+)$/i;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const cleanField = (value, limit) => String(value || '')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);

const outputSchema = Object.freeze({
    type: 'object',
    additionalProperties: false,
    properties: {
        imageKind: {
            type: 'string',
            enum: ['google_maps', 'address_document', 'conversation_screenshot', 'other']
        },
        name: { type: 'string' },
        address: { type: 'string' },
        reference: { type: 'string' },
        city: { type: 'string' },
        province: { type: 'string' },
        evidence: { type: 'string' },
        confidence: { type: 'string', enum: ['none', 'low', 'medium', 'high'] }
    },
    required: [
        'imageKind',
        'name',
        'address',
        'reference',
        'city',
        'province',
        'evidence',
        'confidence'
    ]
});

const prompt = `Leia somente dados de entrega que estejam VISÍVEIS nesta imagem enviada por um cliente do Equador.
A imagem pode ser um print do Google Maps, uma conversa ou um comprovante de endereço.
Regras obrigatórias:
- Não invente, não complete e não deduza texto que não esteja visível.
- Nome: apenas nome de pessoa explicitamente identificado como cliente, destinatário ou titular.
- Endereço: rua/avenida, número, bairro/setor e demais partes logísticas visíveis, sem repetir cidade ou província.
- Referência: estabelecimento, ponto de referência, agência Servientrega, pin ou rótulo do Google Maps visível.
- Cidade e província: copie como aparecem. Se não estiverem visíveis, devolva string vazia.
- Não extraia telefone, documento, coordenadas, links ou dados de pagamento.
- Evidence: trecho curto do texto visível que sustenta os campos.
- Confidence deve ser none quando não houver dado de entrega, low quando estiver ilegível, medium quando parcialmente claro e high quando estiver claro.
Devolva exclusivamente o objeto estruturado solicitado.`;

const validateImageDataUrl = (imageDataUrl = '') => {
    const match = String(imageDataUrl || '').match(IMAGE_DATA_URL_PATTERN);
    if (!match) throw new Error('customer_image_invalid_format');
    const bytes = Buffer.from(match[2], 'base64');
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new Error('customer_image_invalid_size');
    return imageDataUrl;
};
const canonicalLocation = ({ city = '', province = '' } = {}) => {
    if (!city && !province) return { city: '', province: '' };
    const location = findKnownServientregaEcuadorLocation({
        city,
        province,
        text: `CIUDAD: ${city}\nPROVINCIA: ${province}`
    });
    const firstAgency = location.agencies?.[0] || {};
    return {
        city: city && location.cityMatched ? firstAgency.city || cleanField(location.city, 70) : '',
        province: location.provinceMatched ? firstAgency.province || cleanField(location.province, 70) : ''
    };
};

export const normalizeCustomerImageData = (value = {}) => {
    const city = cleanField(value.city, 70);
    const province = cleanField(value.province, 70);
    const location = canonicalLocation({ city, province });
    const confidence = ['none', 'low', 'medium', 'high'].includes(value.confidence)
        ? value.confidence
        : 'none';
    const imageKind = ['google_maps', 'address_document', 'conversation_screenshot', 'other'].includes(value.imageKind)
        ? value.imageKind
        : 'other';
    return {
        imageKind,
        name: cleanField(value.name, 70),
        address: cleanField(value.address, 180),
        reference: cleanField(value.reference, 140),
        city: location.city,
        province: location.province,
        evidence: cleanField(value.evidence, 280),
        confidence,
        locationMatched: Boolean(location.city || location.province)
    };
};

export const readEcuadorCustomerImage = async ({
    imageDataUrl,
    client = null,
    model = process.env.OPENAI_CUSTOMER_IMAGE_READER_MODEL || 'gpt-4o-mini'
} = {}) => {
    validateImageDataUrl(imageDataUrl);
    if (!client && !process.env.OPENAI_API_KEY) throw new Error('customer_image_reader_not_configured');
    const openai = client || new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.responses.create({
        model,
        store: false,
        input: [{
            role: 'user',
            content: [
                { type: 'input_text', text: prompt },
                { type: 'input_image', image_url: imageDataUrl, detail: 'high' }
            ]
        }],
        text: {
            format: {
                type: 'json_schema',
                name: 'ecuador_customer_image_data',
                description: 'Dados de entrega visíveis em uma imagem enviada pelo cliente.',
                strict: true,
                schema: outputSchema
            }
        },
        max_output_tokens: 450
    }, {
        timeout: 45000,
        maxRetries: 1
    });
    const raw = JSON.parse(String(response.output_text || '{}'));
    return {
        ...normalizeCustomerImageData(raw),
        model
    };
};
