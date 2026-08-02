(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.VitalismenProductFunnel = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    // Este arquivo e somente o motor. Nenhum texto comercial de produto pode
    // ser colocado aqui. Cada produto se registra em product-funnels/*.js.
    const PRODUCTS = Object.create(null);
    const LIBRARY = Object.create(null);
    const DEFINITIONS = Object.create(null);
    const cleanKey = (value) => String(value || '').trim().toLowerCase();
    const deepFreezeTemplate = (template) => Object.freeze({
        ...template,
        stages: Object.freeze([...(Array.isArray(template.stages) ? template.stages : [])])
    });

    const register = (definition = {}) => {
        const productKey = cleanKey(definition.productKey);
        const productName = String(definition.productName || '').trim();
        const funnelVersion = String(definition.funnelVersion || '').trim();
        const templates = Array.isArray(definition.templates) ? definition.templates : [];
        if (!/^[a-z0-9_-]{3,64}$/.test(productKey)) throw new Error('Invalid product funnel key');
        if (!productName || !funnelVersion || !templates.length) throw new Error(`Incomplete funnel definition: ${productKey}`);
        if (DEFINITIONS[productKey]) throw new Error(`Duplicate product funnel: ${productKey}`);
        const ids = new Set();
        const isolatedTemplates = templates.map((template) => {
            const id = String(template?.id || '').trim();
            if (!id.startsWith(`${productKey}:`) || ids.has(id)) throw new Error(`Invalid funnel template id: ${id}`);
            ids.add(id);
            return deepFreezeTemplate({ ...template, id });
        });
        const frozenTemplates = Object.freeze(isolatedTemplates);
        const frozenDefinition = Object.freeze({ productKey, productName, funnelVersion, templates: frozenTemplates });
        Object.defineProperty(PRODUCTS, productKey, { value: productName, enumerable: true });
        Object.defineProperty(LIBRARY, productKey, { value: frozenTemplates, enumerable: true });
        Object.defineProperty(DEFINITIONS, productKey, { value: frozenDefinition, enumerable: true });
        return frozenDefinition;
    };

    const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const safeValue = (value, fallback = '—') => {
        const text = String(value ?? '').trim();
        return text || fallback;
    };
    const contextTokens = (draft = {}) => {
        const name = safeValue(draft.name);
        const shortName = name === '—' ? '' : ` ${name.split(/\s+/)[0]}`;
        const city = safeValue(draft.city, '');
        const province = safeValue(draft.province, '');
        const total = safeValue(draft.total, '');
        const address = safeValue(draft.address, '');
        const reference = safeValue(draft.reference, '');
        return {
            nome: name,
            nome_curto: shortName,
            quantidade: safeValue(draft.quantity),
            valor: total ? `USD ${total}` : '—',
            valor_linha: total ? ` El valor registrado es USD ${total}.` : '',
            entrega: [address, reference].filter(Boolean).join(' — ') || '—',
            cidade_provincia: [city, province].filter(Boolean).join(' / ') || '—'
        };
    };
    const resolve = (template, draft = {}) => {
        const tokens = contextTokens(draft);
        return String(template?.text || '').replace(/\{\{([a-z_]+)\}\}/g, (_, key) => tokens[key] ?? '—');
    };
    const list = ({ productKey, category = 'todos', search = '', stage = '' } = {}) => {
        const source = LIBRARY[cleanKey(productKey)] || [];
        const needle = normalize(search);
        return source
            .filter((item) => category === 'todos' || item.category === category)
            .filter((item) => !needle || normalize(`${item.code} ${item.title} ${item.preview} ${item.text}`).includes(needle))
            .map((item) => ({ ...item, recommended: Boolean(stage && item.stages.includes(stage)) }))
            .sort((a, b) => Number(b.recommended) - Number(a.recommended));
    };
    const productName = (productKey) => PRODUCTS[cleanKey(productKey)] || '';
    const definition = (productKey) => DEFINITIONS[cleanKey(productKey)] || null;
    return Object.freeze({ PRODUCTS, LIBRARY, register, list, resolve, productName, definition });
}));
