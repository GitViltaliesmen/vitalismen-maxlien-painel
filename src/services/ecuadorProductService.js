const normalizeText = (value = '') => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const hasNitrixSignal = (value = '') => {
    const text = normalizeText(value);
    return /\b(nitrix|n_i_trix|n\s*i\s*trix|nitric|oxido\s+nitric|nitrico|oxide)\b/.test(text);
};

export const ECUADOR_PRODUCTS = {
    vitPower: {
        key: 'vit_power_ec',
        name: 'Vit Power',
        contentName: 'Vit Power Ecuador',
        contentIds: ['vit_power_ec'],
        dropiName: 'VIT POWERS 1000ML COMUNIDAD',
        dropiAliases: [
            'VIT POWERS 1000ML COMUNIDAD',
            'VIT POWERS 1000 ML X1 COMUNIDAD',
            'VIT POWERS 1000 ML X1 / COMUNIDAD',
            'VIT POWERSS 1000 ML X1 COMUNIDAD',
            'VIT POWERSS 1000 ML X1 / COMUNIDAD'
        ]
    },
    nitrix: {
        key: 'nitrix_ec',
        name: 'Nitrix',
        contentName: 'Nitrix Ecuador',
        contentIds: ['nitrix_ec'],
        dropiName: 'NITRIX',
        dropiAliases: [
            'NITRIX',
            'NITRIX OXIDE',
            'NITRIX OXIDO NITRICO',
            'OXIDO NITRICO',
            'NITRIC OXIDE'
        ]
    }
};

export const resolveEcuadorProductInfo = (...values) => {
    const haystack = values
        .flatMap((value) => {
            if (!value || typeof value !== 'object') return [value];
            return [
                value.productName,
                value.product,
                value.productKey,
                value.contentName,
                value.package?.label,
                value.notes,
                value.entryReason,
                value.tracking?.sourceUrl,
                value.tracking?.utm_campaign,
                value.tracking?.utm_content,
                value.tracking?.utm_source
            ];
        })
        .filter(Boolean)
        .join(' | ');

    return hasNitrixSignal(haystack)
        ? ECUADOR_PRODUCTS.nitrix
        : ECUADOR_PRODUCTS.vitPower;
};

export const ecuadorPackageLabel = (productInfo, quantity) => {
    const product = productInfo?.name || ECUADOR_PRODUCTS.vitPower.name;
    const qty = Number(quantity || 0) || 0;
    if (!qty) return `${product} sem quantidade`;
    return `${product} ${qty} frasco${qty > 1 ? 's' : ''}`;
};

export const ecuadorProductMetadata = (productInfo) => ({
    productKey: productInfo?.key || ECUADOR_PRODUCTS.vitPower.key,
    productName: productInfo?.name || ECUADOR_PRODUCTS.vitPower.name,
    contentName: productInfo?.contentName || ECUADOR_PRODUCTS.vitPower.contentName,
    contentIds: productInfo?.contentIds || ECUADOR_PRODUCTS.vitPower.contentIds
});

