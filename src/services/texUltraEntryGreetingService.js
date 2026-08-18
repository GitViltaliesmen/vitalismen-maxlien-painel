const ECUADOR_TIMEZONE = 'America/Guayaquil';

const normalizeDisplayName = (value = '') => String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);

const unusableName = (value = '') => {
    const normalized = normalizeDisplayName(value);
    if (!normalized) return true;
    if (/^\+?[\d\s().-]{7,}$/.test(normalized)) return true;
    return /^(cliente|customer|entrada vsl|desconocido|desconocida|unknown|null|undefined)$/i.test(normalized);
};

export const texUltraCustomerName = (...candidates) => {
    const match = candidates.map(normalizeDisplayName).find((value) => !unusableName(value));
    return match || '';
};

export const texUltraGreetingPeriod = (
    date = new Date(),
    timezone = ECUADOR_TIMEZONE
) => {
    const safeDate = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(safeDate.getTime())) return 'morning';
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone || ECUADOR_TIMEZONE,
        hour: '2-digit',
        hourCycle: 'h23'
    }).formatToParts(safeDate);
    const hour = Number(parts.find((part) => part.type === 'hour')?.value || 0);
    if (hour >= 5 && hour <= 11) return 'morning';
    if (hour >= 12 && hour <= 17) return 'afternoon';
    return 'night';
};

export const texUltraGreetingSalutation = (date = new Date(), timezone = ECUADOR_TIMEZONE) => ({
    morning: 'buenos días',
    afternoon: 'buenas tardes',
    night: 'buenas noches'
}[texUltraGreetingPeriod(date, timezone)]);

export const buildTexUltraEntryGreeting = ({
    name = '',
    date = new Date(),
    timezone = ECUADOR_TIMEZONE
} = {}) => {
    const customerName = texUltraCustomerName(name);
    const salutation = texUltraGreetingSalutation(date, timezone);
    const opening = customerName
        ? `Hola, ${customerName}, ${salutation}.`
        : `Hola, ${salutation}.`;
    return `${opening} Soy Ana López, asistente de la Dra. María Fernandes. Vi su mensaje y será un gusto atenderle personalmente. Estoy aquí para ayudarle. ¿En qué puedo ayudarle?`;
};

export const TEX_ULTRA_ENTRY_TIMEZONE = ECUADOR_TIMEZONE;
