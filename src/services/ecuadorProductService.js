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

const hasTexUltraSignal = (value = '') => {
    const text = normalizeText(value);
    return /\b(tex[\s_-]*ultra|texultra)\b/.test(text);
};

const extractEcuadorProductSignalTexts = (values = []) => values
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

export const ECUADOR_PRODUCTS = {
    vitPower: {
        key: 'vit_power_ec',
        name: 'Vit Power',
        contentName: 'Vit Power Ecuador',
        contentIds: ['vit_power_ec'],
        dropiName: 'VIT POWERS 1000ML COMUNIDAD',
        dropiUrl: 'https://app.dropi.ec/dashboard/product-details/103743/vit-powerss-1000-ml-x1-comunidad',
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
    },
    texUltra: {
        key: 'tex_ultra_ec',
        name: 'Tex Ultra Ecuador',
        contentName: 'Tex Ultra Ecuador WhatsApp',
        contentIds: ['tex_ultra_ec'],
        defaultPriceCatalog: 'promotional',
        dropiName: 'TEXULTRA 120 CAP ENERGIA',
        dropiUrl: 'https://app.dropi.ec/dashboard/product-details/110681/texultra-120-cap-energia',
        dropiAliases: [
            'TEXULTRA 120 CAP ENERGIA',
            'TEX ULTRA 120 CAP ENERGIA',
            'TEX ULTRA'
        ]
    }
};

export const ECUADOR_PRICE_CATALOGS = Object.freeze({
    normal: Object.freeze({
        1: 39.99,
        2: 70.00,
        3: 95.99,
        6: 167.99
    }),
    promotional: Object.freeze({
        1: 35.99,
        2: 70.00,
        3: 80.99,
        6: 147.99
    })
});

export const getEcuadorProductInfoByKey = (productKey = '') => (
    Object.values(ECUADOR_PRODUCTS).find((product) => product.key === String(productKey || '').trim()) || null
);

export const normalizeEcuadorPriceCatalog = (value = '') => {
    const normalized = normalizeText(value).replace(/[^a-z0-9]+/g, '_');
    if (['promotional', 'promocional', 'promo', 'recovery', 'recuperacao'].includes(normalized)) {
        return 'promotional';
    }
    if (['normal', 'original', 'regular'].includes(normalized)) return 'normal';
    return '';
};

export const getEcuadorOffer = ({
    productKey = '',
    priceCatalog = 'normal',
    quantity = 0
} = {}) => {
    const product = getEcuadorProductInfoByKey(productKey);
    const catalogKey = normalizeEcuadorPriceCatalog(priceCatalog);
    const normalizedQuantity = Number.parseInt(String(quantity || ''), 10);
    const total = ECUADOR_PRICE_CATALOGS[catalogKey]?.[normalizedQuantity];
    if (!product || !Number.isFinite(total)) return null;
    return Object.freeze({
        productKey: product.key,
        productName: product.name,
        priceCatalog: catalogKey,
        quantity: normalizedQuantity,
        total,
        unitPrice: total / normalizedQuantity
    });
};

export const findEcuadorOfferByTotal = ({
    productKey = '',
    quantity = 0,
    total = 0
} = {}) => {
    const numericTotal = Number(total || 0);
    return ['normal', 'promotional']
        .map((priceCatalog) => getEcuadorOffer({ productKey, priceCatalog, quantity }))
        .find((offer) => offer && Math.abs(offer.total - numericTotal) < 0.005) || null;
};

export const listEcuadorDropiProducts = () => Object.values(ECUADOR_PRODUCTS).map((product) => ({
    key: product.key,
    name: product.name,
    dropiName: product.dropiName,
    dropiUrl: product.dropiUrl || '',
    prices: ECUADOR_PRICE_CATALOGS
}));

export const detectExplicitEcuadorProductKey = (...values) => {
    const signalTexts = extractEcuadorProductSignalTexts(values);
    const haystack = signalTexts.join(' | ');
    const markerKey = haystack.match(/\[DROPI_PRODUCT\]\s*key=([^;\s|]+)/i)?.[1] || '';
    const markerProduct = getEcuadorProductInfoByKey(markerKey);
    if (markerProduct) return markerProduct.key;
    const structuredKeys = values.flatMap((value) => {
        if (!value || typeof value !== 'object') return [];
        return [value.productKey, value.tracking?.productKey].filter(Boolean);
    });
    for (const structuredKey of structuredKeys) {
        const structuredProduct = getEcuadorProductInfoByKey(structuredKey);
        if (structuredProduct) return structuredProduct.key;
    }
    const hasExplicitNitrixKey = signalTexts.some((value) => normalizeText(value).includes('nitrix_ec') || normalizeText(value).includes('nitrix_oxide_ec'));
    const hasExplicitVitPowerKey = signalTexts.some((value) => normalizeText(value).includes('vit_power_ec'));
    const hasExplicitTexUltraKey = signalTexts.some((value) => normalizeText(value).includes('tex_ultra_ec'));

    if (hasExplicitTexUltraKey || hasTexUltraSignal(haystack)) return ECUADOR_PRODUCTS.texUltra.key;
    if (hasExplicitNitrixKey) return ECUADOR_PRODUCTS.nitrix.key;
    if (hasExplicitVitPowerKey || hasVitPowerSignal(haystack)) return ECUADOR_PRODUCTS.vitPower.key;
    if (hasNitrixSignal(haystack)) return ECUADOR_PRODUCTS.nitrix.key;
    return '';
};

export const resolveEcuadorProductInfo = (...values) => {
    const productKey = detectExplicitEcuadorProductKey(...values);
    if (!productKey) return ECUADOR_PRODUCTS.nitrix;
    return getEcuadorProductInfoByKey(productKey) || ECUADOR_PRODUCTS.nitrix;
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
