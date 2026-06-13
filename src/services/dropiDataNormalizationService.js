import { resolveServientregaEcuadorAgency } from './servientregaEcuadorAgencyService.js';

const PROVINCE_CANONICAL = new Map([
    ['AZUAY', 'Azuay'],
    ['BOLIVAR', 'Bolivar'],
    ['CANAR', 'Canar'],
    ['CARCHI', 'Carchi'],
    ['CHIMBORAZO', 'Chimborazo'],
    ['COTOPAXI', 'Cotopaxi'],
    ['EL ORO', 'El Oro'],
    ['ESMERALDA', 'Esmeraldas'],
    ['ESMERALDAS', 'Esmeraldas'],
    ['GALAPAGOS', 'Galapagos'],
    ['GUAYAS', 'Guayas'],
    ['IMBABURA', 'Imbabura'],
    ['LOJA', 'Loja'],
    ['LOS RIOS', 'Los Rios'],
    ['MANABI', 'Manabi'],
    ['MORONA SANTIAGO', 'Morona Santiago'],
    ['NAPO', 'Napo'],
    ['ORELLANA', 'Orellana'],
    ['PASTAZA', 'Pastaza'],
    ['PICHINCHA', 'Pichincha'],
    ['SANTA ELENA', 'Santa Elena'],
    ['SANTO DOMINGO', 'Santo Domingo de los Tsachilas'],
    ['SANTO DOMINGO DE LOS TSACHILAS', 'Santo Domingo de los Tsachilas'],
    ['SANTO DOMINGO DE LOS TSACHILAS', 'Santo Domingo de los Tsachilas'],
    ['SUCUMBIOS', 'Sucumbios'],
    ['TUNGURAHUA', 'Tungurahua'],
    ['ZAMORA CHINCHIPE', 'Zamora Chinchipe']
]);

const CITY_PROVINCE_HINTS = new Map([
    ['BABAHOYO', 'Los Rios'],
    ['CUENCA', 'Azuay'],
    ['DURAN', 'Guayas'],
    ['ECHEANDIA', 'Bolivar'],
    ['EL GUABO', 'El Oro'],
    ['ESMERALDA', 'Esmeraldas'],
    ['ESMERALDAS', 'Esmeraldas'],
    ['GUANO', 'Chimborazo'],
    ['GUAYAQUIL', 'Guayas'],
    ['LAGO AGRIO', 'Sucumbios'],
    ['LOJA', 'Loja'],
    ['MANTA', 'Manabi'],
    ['MILAGRO', 'Guayas'],
    ['MONTECRISTI', 'Manabi'],
    ['PORTOVELO', 'El Oro'],
    ['PUYO', 'Pastaza'],
    ['QUEVEDO', 'Los Rios'],
    ['QUITO', 'Pichincha'],
    ['RIOVERDE', 'Esmeraldas'],
    ['SUCÙA', 'Morona Santiago'],
    ['SUCUA', 'Morona Santiago'],
    ['VALENCIA', 'Los Rios']
]);

const CITY_CANONICAL = new Map([
    ['ESMERALDA', 'Esmeraldas']
]);

const STOP_WORDS = new Set([
    'SERVIENTREGA', 'AGENCIA', 'OFICINA', 'PUNTO', 'RETIRO', 'RETIRAR', 'PRINCIPAL', 'CENTRO', 'NORTE', 'SUR', 'ESTE', 'OESTE'
]);

export const normalizeDropiTextKey = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_/.-]+/g, ' ')
    .replace(/[^A-Z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

export const cleanDropiText = (value) => String(value || '')
    .replace(/\[\s*SER\s*4\s*VIENTREGA\s*\]/gi, 'Servientrega')
    .replace(/\[\s*SER4VIENTREGA\s*\]/gi, 'Servientrega')
    .replace(/\bSER\s*4\s*VIENTREGA\b/gi, 'Servientrega')
    .replace(/\bSER4VIENTREGA\b/gi, 'Servientrega')
    .replace(/\bser\s*entrega\b/gi, 'Servientrega')
    .replace(/\bserentrega\b/gi, 'Servientrega')
    .replace(/\bservi\s+en\s+trega\b/gi, 'Servientrega')
    .replace(/\bcervi\s+en\s+trega\b/gi, 'Servientrega')
    .replace(/\bservi\s+entrega\b/gi, 'Servientrega')
    .replace(/\bcervi\s+entrega\b/gi, 'Servientrega')
    .replace(/\bsanta\s+presca\b/gi, 'Santa Prisca')
    .replace(/[_]+/g, ' ')
    .replace(/[\t\n\r]+/g, ' - ')
    .replace(/\s*-\s*/g, ' - ')
    .replace(/\s+/g, ' ')
    .replace(/(?:\s*-\s*){2,}/g, ' - ')
    .trim();

const titleCase = (value) => String(value || '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.length <= 2 ? part : `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');

export const normalizeEcuadorPhoneForStorage = (value) => {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) return '';
    const local = digits.startsWith('593') ? digits.slice(3) : digits;
    if (/^9\d{8}$/.test(local)) return `+593${local}`;
    return digits.startsWith('593') ? `+${digits}` : digits;
};

export const normalizeEcuadorLocalPhoneForDropi = (value) => {
    const digits = String(value || '').replace(/\D/g, '');
    if (digits.startsWith('593') && digits.length > 9) return digits.slice(3);
    return digits;
};

const canonicalProvince = (value) => {
    const key = normalizeDropiTextKey(value);
    return PROVINCE_CANONICAL.get(key) || cleanDropiText(value);
};

const inferProvinceFromCity = (city) => CITY_PROVINCE_HINTS.get(normalizeDropiTextKey(city)) || '';

const canonicalCity = (city) => CITY_CANONICAL.get(normalizeDropiTextKey(city)) || titleCase(city);

export const normalizeEcuadorLocationForDropi = ({ city = '', province = '' } = {}) => {
    let nextCity = cleanDropiText(city);
    let nextProvince = cleanDropiText(province);
    const cityAsProvince = PROVINCE_CANONICAL.get(normalizeDropiTextKey(nextCity));
    const provinceAsCityProvince = inferProvinceFromCity(nextProvince);

    if (cityAsProvince && provinceAsCityProvince) {
        [nextCity, nextProvince] = [nextProvince, cityAsProvince];
    }

    nextProvince = canonicalProvince(nextProvince) || inferProvinceFromCity(nextCity) || nextProvince;
    nextCity = canonicalCity(nextCity);
    return {
        city: nextCity,
        province: nextProvince,
        normalized: true
    };
};

const looksLikeServientregaAgency = (value) => /servientrega|agencia|concesion|retiro|retirar|oficina/i.test(
    String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
);

const agencyNameFromAddress = (address) => {
    const tokens = normalizeDropiTextKey(address)
        .split(/\s+/)
        .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
    return tokens.slice(0, 4).join(' ');
};

export const normalizeEcuadorAddressForDropi = ({ address = '', city = '', province = '' } = {}) => {
    const cleanedAddress = cleanDropiText(address);
    const agencyPickup = looksLikeServientregaAgency(cleanedAddress);
    if (!agencyPickup) {
        return {
            address: cleanedAddress,
            agencyPickup: false,
            agencyName: '',
            agencyValidated: false,
            normalizedBy: 'plain_address'
        };
    }

    const lookup = resolveServientregaEcuadorAgency({
        city,
        province,
        address: cleanedAddress,
        agencyName: agencyNameFromAddress(cleanedAddress),
        text: cleanedAddress,
        limit: 3
    });
    const agency = lookup.best || null;
    if (agency && (lookup.confident || agency.score >= 60)) {
        return {
            address: `Servientrega ${agency.name} - ${agency.address} - ${agency.city}, ${agency.province}`,
            agencyPickup: true,
            agencyName: agency.name,
            agencyValidated: true,
            normalizedBy: 'servientrega_agency_catalog',
            agencyScore: agency.score
        };
    }

    return {
        address: cleanedAddress.replace(/^servientrega\s+/i, 'Servientrega '),
        agencyPickup: true,
        agencyName: agencyNameFromAddress(cleanedAddress),
        agencyValidated: false,
        normalizedBy: 'servientrega_cleaned_unmatched',
        agencyScore: agency?.score || 0
    };
};

export const normalizeEcuadorOrderFieldsForDropi = ({ name = '', phone = '', address = '', city = '', province = '', quantity = 1, total = 0 } = {}) => {
    const location = normalizeEcuadorLocationForDropi({ city, province });
    const addressResult = normalizeEcuadorAddressForDropi({
        address,
        city: location.city,
        province: location.province
    });
    const parsedQuantity = Math.max(1, Number.parseInt(String(quantity || 1), 10) || 1);
    const parsedTotal = Number.parseFloat(String(total || 0)) || 0;
    return {
        name: cleanDropiText(name),
        phone: normalizeEcuadorPhoneForStorage(phone),
        address: addressResult.address,
        city: location.city,
        province: location.province,
        quantity: parsedQuantity,
        total: parsedTotal,
        agencyPickup: addressResult.agencyPickup,
        agencyName: addressResult.agencyName,
        agencyValidated: addressResult.agencyValidated,
        normalizedBy: addressResult.normalizedBy,
        diagnostics: {
            original: { name, phone, address, city, province, quantity, total },
            agencyScore: addressResult.agencyScore || 0
        }
    };
};
