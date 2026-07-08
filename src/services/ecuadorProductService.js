const normalizeText = (value = '') => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const hasNitrixSignal = (value = '') => {
    const text = normalizeText(value);
    return /\b(nitrix|n_i_trix|n\s*i\s*trix|nitric|oxido\s+nitric|nitrico|oxide)\b/.test(text);
};

const hasVitPowerSignal = (value = '') => {
    const text = normalizeText(value);
    return /\b(vit[\s_-]*power|vit[\s_-]*powers|vitpower|vitpowers)\b/.test(text);
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
        name: 'Nitrix Oxide Ecuador',
        contentName: 'Nitrix Oxide Ecuador WhatsApp',
        contentIds: ['nitrix_oxide_ec'],
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
    const signalTexts = values
        .flatMap((value) => {
            if (!value || typeof value !== 'object') return [value];
            return [
                value.productName,
                value.product,
                value.productKey,
                value.contentName,
                value.contentIds,
                value.package?.label,
                value.notes,
                value.entryReason,
                value.tracking?.productKey,
                value.tracking?.productName,
                value.tracking?.contentName,
                value.tracking?.contentIds,
                value.tracking?.sourceUrl,
                value.tracking?.utm_campaign,
                value.tracking?.utm_content,
                value.tracking?.utm_source
            ];
        })
        .filter(Boolean)
        .map((value) => (Array.isArray(value) ? value.join(' ') : String(value)));
    const haystack = signalTexts.join(' | ');
    const hasExplicitNitrixKey = signalTexts.some((value) => normalizeText(value).includes('nitrix_ec') || normalizeText(value).includes('nitrix_oxide_ec'));
    const hasExplicitVitPowerKey = signalTexts.some((value) => normalizeText(value).includes('vit_power_ec'));

    if (hasExplicitNitrixKey) return ECUADOR_PRODUCTS.nitrix;
    if (hasExplicitVitPowerKey || hasVitPowerSignal(haystack)) return ECUADOR_PRODUCTS.vitPower;
    if (hasNitrixSignal(haystack)) return ECUADOR_PRODUCTS.nitrix;
    return ECUADOR_PRODUCTS.nitrix;
};

export const ecuadorPackageLabel = (productInfo, quantity) => {
    const product = productInfo?.name || ECUADOR_PRODUCTS.nitrix.name;
    const qty = Number(quantity || 0) || 0;
    if (!qty) return `${product} sem quantidade`;
    return `${product} ${qty} frasco${qty > 1 ? 's' : ''}`;
};

export const ecuadorProductMetadata = (productInfo) => ({
    productKey: productInfo?.key || ECUADOR_PRODUCTS.nitrix.key,
    productName: productInfo?.name || ECUADOR_PRODUCTS.nitrix.name,
    contentName: productInfo?.contentName || ECUADOR_PRODUCTS.nitrix.contentName,
    contentIds: productInfo?.contentIds || ECUADOR_PRODUCTS.nitrix.contentIds
});
