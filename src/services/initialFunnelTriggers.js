export const VIT_POWER_INITIAL_CTA_MESSAGES = [
    'Hola, deseo Vit Power',
    'Hola desejo Vit Power',
    'Hola, quiero Vit Power',
    'Hola, quero Vit Power',
    'Quiero saber del producto',
    'Quero saber do produto',
    'Precio Vit Power',
    'Quiero informacion de Vit Power',
    'Deseo informacion de Vit Power',
    'Quiero conocer Vit Power',
    'Me interesa Vit Power',
    'Quiero comprar Vit Power',
    'Quiero ordenar Vit Power',
    'Hola, quiero el producto',
    'Hola, quiero informacion del producto',
    'Hola, deseo el producto',
    'Quiero saber precio',
    'Quiero saber el precio de Vit Power',
    'Me interesa el tratamiento',
    'Quiero saber del tratamiento',
    'Quero saber do tratamento',
    'Necesito informacion del producto',
    'Quiero la promocion de Vit Power',
    'Me pasas la promo de Vit Power',
    'Quiero la oferta de Vit Power',
    'Hola, vi el video y quiero informacion',
    'Vi el anuncio y quiero Vit Power',
    'Vengo por Vit Power',
    'Quiero empezar con Vit Power',
    'Deseo comprar el producto',
    'Quero comprar o produto',
    'Hola, quiero hacer mi pedido',
    'Hola, quiero ordenar',
    'Quiero mi pedido de Vit Power',
    'Quero meu pedido de Vit Power',
    'Info Vit Power',
    'Mas informacion Vit Power',
    'Como funciona Vit Power',
    'Quiero saber como funciona',
    'Tengo interes en Vit Power',
    'Necesito Vit Power',
    'Hola, quiero saber mas',
    'Me puedes dar informacion del producto?',
    'Quiero recibir informacion por WhatsApp',
    'Quiero hablar con una asesora de Vit Power'
];

export const INITIAL_CTA_MESSAGES_BY_COUNTRY = {
    EC: VIT_POWER_INITIAL_CTA_MESSAGES
};

export const normalizeInitialFunnelText = (text) => String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizedVitPowerMessages = new Set(
    VIT_POWER_INITIAL_CTA_MESSAGES.map(normalizeInitialFunnelText)
);

const levenshteinDistance = (a, b) => {
    const left = String(a || '');
    const right = String(b || '');
    if (left === right) return 0;
    if (!left) return right.length;
    if (!right) return left.length;

    const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
    const current = Array.from({ length: right.length + 1 }, () => 0);

    for (let i = 1; i <= left.length; i += 1) {
        current[0] = i;
        for (let j = 1; j <= right.length; j += 1) {
            const cost = left[i - 1] === right[j - 1] ? 0 : 1;
            current[j] = Math.min(
                current[j - 1] + 1,
                previous[j] + 1,
                previous[j - 1] + cost
            );
        }
        for (let j = 0; j <= right.length; j += 1) previous[j] = current[j];
    }

    return previous[right.length];
};

const tokenSimilarityLimit = (token, target) => {
    const shortest = Math.min(String(token || '').length, String(target || '').length);
    if (shortest <= 3) return 0;
    if (shortest <= 5) return 1;
    return 2;
};

const tokenLooksLike = (token, targets = []) => targets.some((target) => (
    token === target
    || (token.length >= 4 && target.length >= 4 && (token.includes(target) || target.includes(token)))
    || levenshteinDistance(token, target) <= tokenSimilarityLimit(token, target)
));

const anyTokenLooksLike = (tokens, targets) => tokens.some((token) => tokenLooksLike(token, targets));

const INITIAL_PRODUCT_TERMS = [
    'producto',
    'produto',
    'producoto',
    'prodcuto',
    'prodcto',
    'product',
    'prod',
    'tratamiento',
    'tratamento',
    'suplemento',
    'frasco',
    'botella'
];

const INITIAL_INTEREST_TERMS = [
    'hola',
    'ola',
    'buenas',
    'quiero',
    'kiero',
    'qiero',
    'qro',
    'quero',
    'deseo',
    'desejo',
    'necesito',
    'informacion',
    'informasion',
    'informacao',
    'info',
    'saber',
    'precio',
    'presio',
    'preco',
    'valor',
    'promo',
    'promocion',
    'comprar',
    'conprar',
    'ordenar',
    'pedido',
    'asesora',
    'asesoria',
    'funciona',
    'sirve',
    'detalles'
];

const SIMPLE_GREETING_TERMS = [
    'hola',
    'ola',
    'holaa',
    'olaa',
    'buenas',
    'buenos dias',
    'buen dia',
    'buenas tardes',
    'buenas noches',
    'bom dia',
    'boa tarde',
    'boa noite',
    'saludos'
];

const INITIAL_VIT_POWER_TERMS = [
    'vitpower',
    'vit',
    'power',
    'bitpower',
    'bit',
    'pawer',
    'powe'
];

const firstMeaningfulLine = (text) => String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) || '';

export const startsWithOfficialInitialCtaMessage = (text) => {
    const firstLine = normalizeInitialFunnelText(firstMeaningfulLine(text));
    return Boolean(firstLine && normalizedVitPowerMessages.has(firstLine));
};

export const isSimpleGreeting = (text) => {
    const firstLine = normalizeInitialFunnelText(firstMeaningfulLine(text));
    if (!firstLine) return false;
    if (SIMPLE_GREETING_TERMS.includes(firstLine)) return true;
    const tokens = firstLine.split(' ').filter(Boolean);
    return tokens.length <= 3 && anyTokenLooksLike(tokens, SIMPLE_GREETING_TERMS);
};

export const mentionsVitPower = (text) => {
    const body = normalizeInitialFunnelText(text);
    const tokens = body.split(' ').filter(Boolean);
    return /\b(vit\s*power|vitpower|bit\s*power|bitpower|vit\s*pawer|vit\s*powe)\b/i.test(body)
        || body.replace(/\s+/g, '').includes('vitpower')
        || (anyTokenLooksLike(tokens, ['vit', 'bit']) && anyTokenLooksLike(tokens, ['power', 'pawer', 'powe']))
        || anyTokenLooksLike(tokens, INITIAL_VIT_POWER_TERMS.filter((term) => term.length > 5));
};

export const looksLikeOrderDataMessage = (text) => {
    const body = normalizeInitialFunnelText(text);
    const fields = [
        /\bnombre\b|\bnome\b|\bcliente\b/i,
        /\btelefono\b|\btelefone\b|\bcelular\b|\bwhatsapp\b/i,
        /\bprovincia\b|\bdepartamento\b|\bregion\b/i,
        /\bciudad\b|\bcidade\b/i,
        /\bdireccion\b|\bendereco\b|\bdirecao\b/i,
        /\bcantidad\b|\bquantidade\b|\bfrasco\b/i,
        /\btotal\b|\bvalor\b|\bprecio\b|\bpreco\b/i
    ];
    return fields.filter((pattern) => pattern.test(body)).length >= 3;
};

export const isInitialProductInquiry = (text) => {
    const body = normalizeInitialFunnelText(text);
    if (!body) return false;
    if (isSimpleGreeting(text)) return true;
    if (startsWithOfficialInitialCtaMessage(text)) return true;
    if (looksLikeOrderDataMessage(text)) return false;
    if (normalizedVitPowerMessages.has(body)) return true;

    const tokens = body.split(' ').filter(Boolean);
    const mentionsProduct = mentionsVitPower(body)
        || /\b(prod[a-z]*|tratamiento|tratamento|suplemento|frasco|botella)\b/i.test(body)
        || anyTokenLooksLike(tokens, INITIAL_PRODUCT_TERMS);
    const asksOrShowsInterest = /\b(hola|ola|buenas|quiero|quero|deseo|desejo|desea|necesito|interesa|interesado|informacion|informacao|info|saber|precio|preco|valor|promo|promocion|comprar|ordenar|pedido|asesora|asesoria|funciona|sirve|detalles)\b/i.test(body)
        || anyTokenLooksLike(tokens, INITIAL_INTEREST_TERMS);

    if (mentionsVitPower(body) && body.split(' ').length <= 5) return true;
    return mentionsProduct && asksOrShowsInterest;
};
