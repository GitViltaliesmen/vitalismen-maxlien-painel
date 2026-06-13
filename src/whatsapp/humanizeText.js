const EMOJI_OPENERS = ['😊', '🙏', '✅', '👌', '🙂', '📍', '📝', '💛'];
const HUMAN_PREFIXES = [
    'Perfecto',
    'Claro',
    'Listo',
    'Le entiendo',
    'Sigo con usted',
    'Muy bien',
    'Con gusto',
    'Para dejarlo sin error'
];

const RECENT_BY_JID = new Map();

const normalize = (value = '') => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const hashNumber = (value = '') => {
    let hash = 0;
    for (const char of String(value || '')) {
        hash = ((hash << 5) - hash) + char.charCodeAt(0);
        hash |= 0;
    }
    return Math.abs(hash);
};

const startsWithEmoji = (text = '') => /^\p{Extended_Pictographic}/u.test(String(text || '').trim());

const shouldSkipHumanization = (text = '') => {
    const value = String(text || '').trim();
    if (!value) return true;
    if (startsWithEmoji(value)) return true;
    if (/^\[(AUDIO|IMAGEM|IMAGE|VIDEO|MEDIA|ENVIAR_AUDIO_GRAVADO|GERAR_AUDIO)/i.test(value)) return true;
    if (/^https?:\/\//i.test(value) || value.startsWith('/media/')) return true;
    if (value.length < 8) return true;
    return false;
};

const chooseVariant = ({ jid = '', text = '', offset = 0, variants = [] }) => {
    if (!variants.length) return '';
    const seed = `${jid}:${text}:${Math.floor(Date.now() / (7 * 60 * 1000))}:${offset}`;
    return variants[hashNumber(seed) % variants.length];
};

const sentenceAlreadyHasNaturalOpening = (text = '') => {
    const normalized = normalize(text).slice(0, 80);
    return /^(perfecto|claro|listo|le entiendo|sigo con usted|muy bien|con gusto|gracias|buenas|hola)\b/.test(normalized);
};

const rememberAndIsRepeated = ({ jid = '', comparable = '' }) => {
    if (!jid || !comparable) return false;
    const recent = RECENT_BY_JID.get(jid) || [];
    const repeated = recent.includes(comparable);
    RECENT_BY_JID.set(jid, [comparable, ...recent.filter((item) => item !== comparable)].slice(0, 8));
    return repeated;
};

export const humanizeWhatsAppText = (text = '', { jid = '' } = {}) => {
    const original = String(text || '').trim();
    if (shouldSkipHumanization(original)) return original;

    const comparable = normalize(original);
    const repeated = rememberAndIsRepeated({ jid, comparable });
    const emoji = chooseVariant({ jid, text: original, offset: repeated ? 3 : 0, variants: EMOJI_OPENERS });

    if (sentenceAlreadyHasNaturalOpening(original)) {
        return `${emoji} ${original}`;
    }

    const prefix = chooseVariant({
        jid,
        text: original,
        offset: repeated ? 5 : 1,
        variants: HUMAN_PREFIXES
    });

    return `${emoji} ${prefix}, ${original.charAt(0).toLowerCase()}${original.slice(1)}`;
};
