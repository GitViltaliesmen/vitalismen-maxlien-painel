(function (root) {
    'use strict';
    const DEFINITIONS = Object.create(null);
    const cleanKey = (value) => String(value || '').trim().toLowerCase();
    const register = (definition = {}) => {
        const productKey = cleanKey(definition.productKey);
        const productName = String(definition.productName || '').trim();
        const version = String(definition.version || '').trim();
        const offers = Array.isArray(definition.offers) ? definition.offers : [];
        const prompts = Array.isArray(definition.prompts) ? definition.prompts : [];
        if (!/^[a-z0-9_-]{3,64}$/.test(productKey)) throw new Error('Invalid quick funnel product key');
        if (!productName || !version || !offers.length) throw new Error(`Incomplete quick funnel: ${productKey}`);
        if (DEFINITIONS[productKey]) throw new Error(`Duplicate quick funnel: ${productKey}`);
        const quantities = new Set();
        const frozenOffers = Object.freeze(offers.map((offer) => {
            const quantity = Number.parseInt(offer?.quantity, 10);
            const price = String(offer?.price || '').trim();
            const text = String(offer?.text || '').trim();
            if (!Number.isInteger(quantity) || quantity < 1 || quantities.has(quantity) || !price || !text) {
                throw new Error(`Invalid quick offer: ${productKey}`);
            }
            quantities.add(quantity);
            return Object.freeze({
                quantity,
                price,
                label: String(offer.label || `${quantity} frasco${quantity === 1 ? '' : 's'}`).trim(),
                buttonLabel: String(offer.buttonLabel || `${quantity} · ${price}`).trim(),
                text
            });
        }));
        const promptIds = new Set();
        const frozenPrompts = Object.freeze(prompts.map((prompt) => {
            const id = cleanKey(prompt?.id);
            const buttonLabel = String(prompt?.buttonLabel || '').trim();
            const text = String(prompt?.text || '').trim();
            if (!/^[a-z0-9_-]{2,64}$/.test(id) || promptIds.has(id) || !buttonLabel || !text) {
                throw new Error(`Invalid quick prompt: ${productKey}`);
            }
            promptIds.add(id);
            return Object.freeze({ id, buttonLabel, text });
        }));
        const frozen = Object.freeze({
            productKey,
            productName,
            version,
            offers: frozenOffers,
            prompts: frozenPrompts
        });
        Object.defineProperty(DEFINITIONS, productKey, { value: frozen, enumerable: true });
        return frozen;
    };
    const definition = (productKey) => DEFINITIONS[cleanKey(productKey)] || null;
    const has = (productKey) => Boolean(definition(productKey));
    root.VitalismenQuickPriceFunnel = Object.freeze({ register, definition, has });
}(globalThis));
