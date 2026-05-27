const enabled = () => String(process.env.WHATSAPP_TEXT_VARIATION_ENABLED || 'true').toLowerCase() === 'true';

const randomItem = (items) => items[Math.floor(Math.random() * items.length)];

const SPINTAX_PATTERN = /\{([^{}]+)\}/g;

const GREETING_VARIANTS = [
    'Hola',
    'Hola, buen dia',
    'Buenos dias',
    'Buenas'
];

export const renderSpintax = (text = '') => String(text || '').replace(SPINTAX_PATTERN, (match, body) => {
    const options = String(body || '')
        .split('|')
        .map((item) => item.trim())
        .filter(Boolean);
    return options.length ? randomItem(options) : match;
});

const varyOpeningGreeting = (text = '') => {
    const source = String(text || '');
    const leading = source.match(/^(\s*)(hola,\s*buen\s+d[ií]a|hola(?:\s*(?:😊|🙌|👋|✅|📦))?|buenas(?:\s+(?:dias|d[ií]as|tardes|noches))?|buen\s+d[ií]a)(\s*[,!.:;]?\s*)/i);
    if (!leading) return source;

    const replacement = randomItem(GREETING_VARIANTS);
    const separator = leading[3] && leading[3].trim() ? leading[3] : ' ';
    return `${leading[1]}${replacement}${separator}${source.slice(leading[0].length)}`;
};

export const varyOutboundText = (text = '') => {
    const rendered = renderSpintax(text);
    if (!enabled()) return rendered;
    return varyOpeningGreeting(rendered);
};
