(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.VitalismenOrderCatalog = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const CURRENT_PRODUCT_KEY = 'tex_ultra_ec';
    const CURRENT_PRODUCT_NAME = 'Tex Ultra Ecuador';
    const KITS = Object.freeze([
        Object.freeze({ quantity: '1', duration: '1 mês', price: 35.99, priceText: '35.99', offerPrice: '35,99', color: 'green' }),
        Object.freeze({ quantity: '2', duration: '2 meses', price: 70, priceText: '70.00', offerPrice: '70,00', color: 'yellow' }),
        Object.freeze({ quantity: '3', duration: '3 meses', price: 80.99, priceText: '80.99', offerPrice: '80,99', color: 'orange' }),
        Object.freeze({ quantity: '6', duration: '6 meses', price: 147.99, priceText: '147.99', offerPrice: '147,99', color: 'red', featured: true })
    ]);

    const REQUIRED_CONFIRMED_FIELDS = Object.freeze([
        Object.freeze({ key: 'name', label: 'nome completo' }),
        Object.freeze({ key: 'phone', label: 'telefone' }),
        Object.freeze({ key: 'address', label: 'endereço ou agência' }),
        Object.freeze({ key: 'city', label: 'cidade' }),
        Object.freeze({ key: 'province', label: 'província' }),
        Object.freeze({ key: 'productKey', label: 'produto' }),
        Object.freeze({ key: 'quantity', label: 'quantidade' }),
        Object.freeze({ key: 'total', label: 'valor' })
    ]);

    const normalizeMoney = (value) => {
        const normalized = String(value ?? '')
            .trim()
            .replace(/\s+/g, '')
            .replace(',', '.');
        const parsed = Number.parseFloat(normalized);
        return Number.isFinite(parsed) ? parsed : 0;
    };

    const kitForQuantity = (quantity) => KITS.find((kit) => kit.quantity === String(quantity || '').trim()) || null;

    const expectedPrice = (productKey, quantity) => (
        productKey === CURRENT_PRODUCT_KEY ? kitForQuantity(quantity)?.priceText || '' : ''
    );

    const isExpectedPrice = (productKey, quantity, total) => {
        if (productKey !== CURRENT_PRODUCT_KEY) return normalizeMoney(total) > 0;
        const kit = kitForQuantity(quantity);
        return Boolean(kit && Math.abs(normalizeMoney(total) - kit.price) < 0.001);
    };

    const missingConfirmedFields = (draft = {}) => REQUIRED_CONFIRMED_FIELDS
        .filter(({ key }) => !String(draft[key] ?? '').trim())
        .map(({ label }) => label);

    const validateForSave = (draft = {}) => {
        const issues = [];
        if (draft.productKey === CURRENT_PRODUCT_KEY && !kitForQuantity(draft.quantity)) {
            issues.push('selecione um kit Tex Ultra de 1, 2, 3 ou 6 frascos');
        }
        if (draft.productKey === CURRENT_PRODUCT_KEY && draft.quantity && !isExpectedPrice(draft.productKey, draft.quantity, draft.total)) {
            issues.push('o valor do kit Tex Ultra não corresponde à tabela aprovada');
        }
        if (String(draft.status || '') === 'confirmado') {
            issues.push(...missingConfirmedFields(draft).map((field) => `preencha ${field}`));
            if (!isExpectedPrice(draft.productKey, draft.quantity, draft.total)) {
                issues.push('confira quantidade e valor antes de confirmar');
            }
        }
        return Object.freeze({
            ok: issues.length === 0,
            issues: Object.freeze([...new Set(issues)])
        });
    };

    const offerText = () => [
        '📦 *Hoy tenemos kits promocionales disponibles con precios especiales*:',
        '🟢 1 mes por solo $35,99',
        '🟡 2 meses por $70,00',
        '🟠 3 meses por $80,99',
        '🔴 6 meses (tratamiento completo) por $147,99',
        '',
        '¿Cuántos frascos desea?'
    ].join('\n');

    return Object.freeze({
        CURRENT_PRODUCT_KEY,
        CURRENT_PRODUCT_NAME,
        KITS,
        REQUIRED_CONFIRMED_FIELDS,
        normalizeMoney,
        kitForQuantity,
        expectedPrice,
        isExpectedPrice,
        missingConfirmedFields,
        validateForSave,
        offerText
    });
}));
