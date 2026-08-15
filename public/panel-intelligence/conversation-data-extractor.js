(function (root, factory) {
    const normalizer = root.VitalismenCustomerDataNormalizer
        || (typeof module === 'object' && module.exports ? require('./customer-data-normalizer.js') : null);
    const api = factory(normalizer);
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.VitalismenConversationData = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (customerDataNormalizer) {
    'use strict';

    const normalize = (value) => String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim()
        .toLowerCase();
    const digits = (value) => String(value || '').replace(/\D/g, '');
    const body = (message = {}) => {
        const value = message.body || message.text || message.caption || message.content;
        return typeof value === 'string' ? value.trim() : '';
    };
    const outgoing = (message = {}) => (
        message.isFromMe === true
        || message.fromMe === true
        || message.direction === 'outbound'
        || message.direction === 'outgoing'
        || message.sender === 'bot'
    );
    const quantity = (value) => ({
        uno: '1',
        una: '1',
        un: '1',
        dos: '2',
        tres: '3',
        seis: '6'
    })[normalize(value)] || digits(value);
    const productKey = (value) => {
        const text = normalize(value);
        if (/\btex ultra\b/.test(text)) return 'tex_ultra_ec';
        if (/\bnitrix\b|\boxido nitrico\b/.test(text)) return 'nitrix_ec';
        if (/\bvit power\b|\bvitpower\b/.test(text)) return 'vit_power_ec';
        return '';
    };

    const extract = (messages = []) => {
        const lines = messages
            .filter((message) => !outgoing(message))
            .flatMap((message) => body(message).split(/\r?\n/))
            .map((line) => line.replace(/\s+/g, ' ').trim())
            .filter(Boolean)
            .slice(-160);
        const result = {};

        for (let index = lines.length - 1; index >= 0; index -= 1) {
            const line = lines[index];
            const name = line.match(/(?:mi+\s+nombre(?:\s+es)?|me\s+llamo|nombre(?:\s+completo)?)\s*[:,-]?\s*([\p{L}][\p{L}\s.'-]{2,60}?)(?=\s+(?:c[eé]dula|ci\b|tel[eé]fono|direcci[oó]n|ciudad|provincia|servientrega)\b|[,;]|$)/iu);
            const city = line.match(/(?:ciudad|cant[oó]n)\s*[:,-]?\s*([\p{L}\s.'-]{2,45})$/iu);
            const province = line.match(/provincia\s*[:,-]?\s*([\p{L}\s.'-]{2,45})$/iu);
            const reference = line.match(/(?:referencia|punto\s+de\s+referencia)\s*[:,-]?\s*(.{3,100}?)(?=\s+(?:ciudad|cant[oó]n|provincia)\s*(?:\/|:)|$)/iu);
            const agency = line.match(/(servientrega\s+.{3,100}?)(?=\s+(?:direcci[oó]n|ciudad|cant[oó]n|provincia|referencia)\b|$)/iu);
            const address = line.match(/(?:direcci[oó]n|domicilio|agencia|calle|avenida|avda\.?)\s*[:,-]?\s*(.{5,150})$/iu);
            const amount = line.match(/(?:usd|\$|d[oó]lares?)\s*([0-9]{1,4}(?:[.,][0-9]{1,2})?)/iu)
                || line.match(/([0-9]{1,4}(?:[.,][0-9]{1,2})?)\s*(?:usd|d[oó]lares?)/iu);
            const qty = line.match(/\b(1|2|3|6|uno|una|un|dos|tres|seis)\s*(?:frascos?|botellas?|unidades?)\b/iu);

            if (!result.name && name) result.name = name[1].trim();
            if (!result.city && city) result.city = city[1].trim();
            if (!result.province && province) result.province = province[1].trim();
            if (!result.reference && reference) result.reference = reference[1].trim();
            if (!result.address && agency) result.address = agency[1].trim();
            if (!result.address && address) result.address = address[1].trim();
            if (!result.quantity && qty) result.quantity = quantity(qty[1]);
            if (!result.total && amount) result.total = amount[1].replace(',', '.');
            if (!result.productKey) result.productKey = productKey(line);
        }

        const text = lines.join('\n');
        if (!result.city || !result.province) {
            const location = text.match(/(?:ciudad|cant[oó]n)\s*(?:\/\s*provincia)?\s*[:,-]?\s*([\p{L}\s.'-]{2,45})\s*[,/]\s*([\p{L}\s.'-]{2,45})(?=$|\n|[,;])/imu);
            if (location) {
                if (!result.city) result.city = location[1].trim();
                if (!result.province) result.province = location[2].trim();
            }
        }
        if (!result.address) {
            const delivery = text.match(/(servientrega\s+.{4,130}?)(?=\s+(?:ciudad|cant[oó]n|provincia|referencia)\b|\n|$)/iu);
            if (delivery) result.address = delivery[1].trim();
        }
        return customerDataNormalizer?.normalizeCustomerData
            ? customerDataNormalizer.normalizeCustomerData(result)
            : result;
    };

    return Object.freeze({ extract, productKey });
}));
