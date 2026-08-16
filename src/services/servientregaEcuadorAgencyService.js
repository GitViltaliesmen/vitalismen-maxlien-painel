import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AGENCY_FILE = path.join(__dirname, '..', 'data', 'agencia_LISTA.json');

let cachedAgencies = null;

export const normalizeAgencyText = (value) => String(value || '')
    .replace(/\bser\s*entrega\b/gi, 'Servientrega')
    .replace(/\bserentrega\b/gi, 'Servientrega')
    .replace(/\bservi\s+en\s+trega\b/gi, 'Servientrega')
    .replace(/\bcervi\s+en\s+trega\b/gi, 'Servientrega')
    .replace(/\bservi\s+entrega\b/gi, 'Servientrega')
    .replace(/\bcervi\s+entrega\b/gi, 'Servientrega')
    .replace(/\bsanta\s+presca\b/gi, 'Santa Prisca')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[_/.-]+/g, ' ')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const titleCaseAgency = (value) => String(value || '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.length <= 2 ? part : `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');

const tokensFor = (value) => normalizeAgencyText(value)
    .split(/\s+/)
    .filter((token) => token.length >= 3 && ![
        'DEL',
        'LOS',
        'LAS',
        'POR',
        'UNA',
        'CON',
        'SIN',
        'PARA',
        'QUIERO',
        'QUIERA',
        'DESEO',
        'MANDAR',
        'ENVIAR',
        'ENVIE',
        'ENVIA',
        'AGENCIA',
        'SERVIENTREGA',
        'OFICINA',
        'RETIRO',
        'RETIRAR'
    ].includes(token));

const GENERIC_AGENCY_LOCATION_TOKENS = new Set([
    'CENTRO',
    'NORTE',
    'SUR',
    'ESTE',
    'OESTE',
    'NOROESTE',
    'NORESTE',
    'SUROESTE',
    'SURESTE',
    'AGENCIA',
    'OFICINA',
    'SERVIENTREGA',
    'FRENTE',
    'JUNTO',
    'CERCA',
    'REFERENCIA',
    'REF',
    'CALLE',
    'AVENIDA'
]);

const distinctiveAgencyTokens = (tokens = []) => tokens.filter((token) => (
    token.length >= 4 && !GENERIC_AGENCY_LOCATION_TOKENS.has(token)
));

const tokenHits = (tokens = [], target = '') => {
    const normalizedTarget = normalizeAgencyText(target);
    return tokens.filter((token) => normalizedTarget.includes(token));
};

const hasStrongTokenMatch = (tokens = [], target = '') => {
    const hits = tokenHits(distinctiveAgencyTokens(tokens), target);
    return hits.length >= 2 || hits.some((token) => token.length >= 6);
};

const overlapScore = (sourceTokens, targetText, weight = 8) => {
    if (!sourceTokens.length || !targetText) return 0;
    const target = normalizeAgencyText(targetText);
    const hits = sourceTokens.filter((token) => target.includes(token)).length;
    return hits * weight;
};

const agencyCatalogMatchesForInput = (input = '', agencies = []) => {
    const tokens = distinctiveAgencyTokens(tokensFor(input));
    if (!tokens.length) return [];
    return agencies.filter((agency) => {
        const agencyText = `${agency.normalizedName || ''} ${agency.normalizedAddress || ''}`;
        return tokens.some((token) => agencyText.includes(token));
    });
};

const shouldSuppressFuzzyLocationFromAgencyToken = ({
    input = '',
    agencies = [],
    cityCatalog = [],
    provinceCatalog = [],
    explicitCity = '',
    explicitProvince = '',
    city = '',
    province = ''
} = {}) => {
    if (explicitCity || explicitProvince || city || province) return false;
    if (hasExactCatalogLocationPhrase(input, cityCatalog, provinceCatalog)) return false;
    const tokens = distinctiveAgencyTokens(tokensFor(input));
    if (!tokens.length) return false;
    const locationCatalog = [...cityCatalog, ...provinceCatalog];
    const hasExactLocationToken = tokens.some((token) => locationCatalog.some((item) => (
        item.normalized === token || compactAgencyText(item.normalized) === compactAgencyText(token)
    )));
    if (hasExactLocationToken) return false;
    return agencyCatalogMatchesForInput(input, agencies).length > 0;
};

const uniqueNormalizedValues = (agencies, key) => [...new Map(agencies
    .map((agency) => [agency[`normalized${key}`], agency[key.toLowerCase()]])
    .filter(([normalized]) => normalized)
).entries()].map(([normalized, value]) => ({ normalized, value }));

const CITY_ALIAS_MAP = new Map(Object.entries({
    GYE: 'GUAYAQUIL',
    GQUIL: 'GUAYAQUIL',
    GQUAYAQUIL: 'GUAYAQUIL',
    GUAYAKIL: 'GUAYAQUIL',
    GUAYAQIL: 'GUAYAQUIL',
    GUAYAQUI: 'GUAYAQUIL',
    GUAYAQUILL: 'GUAYAQUIL',
    KITO: 'QUITO',
    QITO: 'QUITO',
    QUITO: 'QUITO',
    QUIYO: 'QUITO',
    'QUITO NORTE': 'QUITO',
    'QUITO SUR': 'QUITO',
    'RIO BAMBA': 'RIOBAMBA',
    RIOBAMBA: 'RIOBAMBA',
    'STO DOMINGO': 'SANTO DOMINGO',
    'SANTO DOMIGO': 'SANTO DOMINGO',
    'SANTO DOMING': 'SANTO DOMINGO',
    MCHALA: 'MACHALA',
    MACHLA: 'MACHALA',
    MACHALLA: 'MACHALA',
    PORTOVIEGO: 'PORTOVIEJO',
    'PORTO VIEJO': 'PORTOVIEJO',
    PALETINA: 'PALESTINA',
    PALESINA: 'PALESTINA',
    PALESTNA: 'PALESTINA',
    PALESTIN: 'PALESTINA',
    PALENDA: 'PALANDA',
    LIBERDAD: 'LA LIBERTAD',
    'LA LIBERDAD': 'LA LIBERTAD',
    LIBERTAD: 'LA LIBERTAD',
    CUENKA: 'CUENCA',
    KUENCA: 'CUENCA',
    KENCA: 'CUENCA',
    MANTTA: 'MANTA',
    AMVATO: 'AMBATO',
    ANBATO: 'AMBATO',
    IBARA: 'IBARRA',
    QUEBEDO: 'QUEVEDO',
    QUEVED: 'QUEVEDO',
    LATACUNGA: 'LATACUNGA',
    'LATACUNGA CENTRO': 'LATACUNGA',
    MILARGO: 'MILAGRO',
    BABAOYO: 'BABAHOYO',
    BABAHOYO: 'BABAHOYO'
}));

const compactAgencyText = (value = '') => normalizeAgencyText(value).replace(/\s+/g, '');

const hasExactCatalogLocationPhrase = (input = '', cityCatalog = [], provinceCatalog = []) => {
    const normalized = normalizeAgencyText(input);
    const compact = compactAgencyText(normalized);
    if (!normalized || !compact) return false;
    return [...cityCatalog, ...provinceCatalog].some((item) => (
        item.normalized === normalized
        || compactAgencyText(item.normalized) === compact
    ));
};

const exactCatalogMatch = (input = '', catalog = []) => {
    const normalized = normalizeAgencyText(input);
    const compact = compactAgencyText(normalized);
    if (!normalized || !compact) return null;
    return catalog.find((item) => (
        item.normalized === normalized
        || compactAgencyText(item.normalized) === compact
    )) || null;
};

const CATALOG_MATCH_STOPWORDS = new Set([
    'QUIERO',
    'QUIERA',
    'QUISIERA',
    'DESEO',
    'NECESITO',
    'PEDIDO',
    'PEDIR',
    'COMPRAR',
    'COMPRA',
    'PRODUCTO',
    'VIT',
    'POWER',
    'POWET',
    'AGENCIA',
    'OFICINA',
    'SERVIENTREGA',
    'RETIRO',
    'RETIRAR',
    'ENVIAR',
    'ENVIO',
    'ENVIE',
    'MANDE',
    'ESA',
    'ESE',
    'ESO',
    'ESTA',
    'ESTE',
    'AQUI',
    'AHI',
    'ALLI'
]);

const cleanExplicitLocationPart = (value = '') => normalizeAgencyText(value)
    .replace(/\b(PROVINCIA|PROV|CIUDAD|CIDADE|CITY|CANTON|CANTON)\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

const extractExplicitLocationParts = (text = '') => {
    const normalized = normalizeAgencyText(text);
    if (!normalized) return { city: '', province: '' };
    const cityMatch = normalized.match(/\b(?:CIUDAD|CIDADE|CITY|CANTON)\s+(.+?)(?=\s+\b(?:PROVINCIA|PROV)\b|$)/i);
    const provinceMatch = normalized.match(/\b(?:PROVINCIA|PROV)\s+(.+?)(?=\s+\b(?:CIUDAD|CIDADE|CITY|CANTON)\b|$)/i);
    return {
        city: cleanExplicitLocationPart(cityMatch?.[1] || ''),
        province: cleanExplicitLocationPart(provinceMatch?.[1] || '')
    };
};

const expandCatalogInputVariants = (input = '') => {
    const normalized = normalizeAgencyText(input);
    if (!normalized) return [];
    const variants = new Set([normalized]);
    const compact = compactAgencyText(normalized);
    if (compact) variants.add(compact);

    if (CITY_ALIAS_MAP.has(normalized)) variants.add(CITY_ALIAS_MAP.get(normalized));
    if (CITY_ALIAS_MAP.has(compact)) variants.add(CITY_ALIAS_MAP.get(compact));

    for (const [alias, canonical] of CITY_ALIAS_MAP.entries()) {
        if (normalized.includes(alias) || compact.includes(alias.replace(/\s+/g, ''))) {
            variants.add(canonical);
        }
    }

    return [...variants].filter((item) => item.length >= 3);
};

const levenshteinDistance = (a = '', b = '') => {
    const source = String(a || '');
    const target = String(b || '');
    if (!source) return target.length;
    if (!target) return source.length;
    const rows = Array.from({ length: source.length + 1 }, (_, index) => [index]);
    for (let column = 1; column <= target.length; column += 1) rows[0][column] = column;
    for (let row = 1; row <= source.length; row += 1) {
        for (let column = 1; column <= target.length; column += 1) {
            const cost = source[row - 1] === target[column - 1] ? 0 : 1;
            rows[row][column] = Math.min(
                rows[row - 1][column] + 1,
                rows[row][column - 1] + 1,
                rows[row - 1][column - 1] + cost
            );
        }
    }
    return rows[source.length][target.length];
};

const bestCatalogMatch = (input = '', catalog = []) => {
    const normalizedInput = normalizeAgencyText(input);
    const inputVariants = expandCatalogInputVariants(normalizedInput);
    if (!inputVariants.length) return null;
    const meaningfulVariants = inputVariants.filter((variant) => compactAgencyText(variant).length >= 3);
    const tokens = [...new Set(inputVariants.flatMap((variant) => normalizeAgencyText(variant)
        .split(/\s+/)
        .filter((token) => token.length >= 3 && !CATALOG_MATCH_STOPWORDS.has(token))))];
    if (!meaningfulVariants.length && !tokens.length) return null;

    const primaryVariants = [normalizedInput, compactAgencyText(normalizedInput)].filter(Boolean);
    const primaryExact = catalog.find((item) => primaryVariants.includes(item.normalized) || primaryVariants.includes(compactAgencyText(item.normalized)));
    if (primaryExact) return { ...primaryExact, score: 100 };

    const exact = catalog.find((item) => inputVariants.includes(item.normalized) || inputVariants.includes(compactAgencyText(item.normalized)));
    if (exact) return { ...exact, score: 100 };

    const contained = catalog
        .filter((item) => item.normalized.length >= 4 && meaningfulVariants.some((variant) => (
            variant.includes(item.normalized)
            || item.normalized.includes(variant)
            || compactAgencyText(variant).includes(compactAgencyText(item.normalized))
            || compactAgencyText(item.normalized).includes(compactAgencyText(variant))
            || tokens.includes(item.normalized)
        )))
        .sort((a, b) => b.normalized.length - a.normalized.length)[0];
    if (contained) return { ...contained, score: 90 };

    const fuzzy = catalog
        .map((item) => {
            const itemCompact = compactAgencyText(item.normalized);
            const distances = [
                ...tokens.map((token) => levenshteinDistance(token, item.normalized)),
                ...meaningfulVariants.flatMap((variant) => ([
                    levenshteinDistance(variant, item.normalized),
                    levenshteinDistance(compactAgencyText(variant), itemCompact)
                ]))
            ];
            const distance = Math.min(...distances);
            const threshold = item.normalized.length <= 5 ? 2 : (item.normalized.length <= 9 ? 2 : 3);
            return { ...item, distance, threshold };
        })
        .filter((item) => item.distance <= item.threshold)
        .sort((a, b) => a.distance - b.distance || b.normalized.length - a.normalized.length)[0];
    return fuzzy ? { ...fuzzy, score: 75 - fuzzy.distance } : null;
};

export const loadServientregaEcuadorAgencies = () => {
    if (cachedAgencies) return cachedAgencies;
    const raw = fs.readFileSync(AGENCY_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    cachedAgencies = parsed.map((agency) => ({
        name: String(agency.nome || '').trim(),
        province: String(agency.provincia || '').trim(),
        city: String(agency.ciudad || '').trim(),
        sector: String(agency.sector || '').trim(),
        address: String(agency.endereco || '').trim(),
        weekdayHours: String(agency.horario_semana || '').trim(),
        weekendHours: String(agency.horario_fds || '').trim(),
        normalizedName: normalizeAgencyText(agency.nome),
        normalizedProvince: normalizeAgencyText(agency.provincia),
        normalizedCity: normalizeAgencyText(agency.ciudad),
        normalizedSector: normalizeAgencyText(agency.sector),
        normalizedAddress: normalizeAgencyText(agency.endereco)
    }));
    return cachedAgencies;
};

export const formatServientregaAgency = (agency = {}) => ({
    name: titleCaseAgency(agency.name || agency.nome || ''),
    province: titleCaseAgency(agency.province || agency.provincia || ''),
    city: titleCaseAgency(agency.city || agency.ciudad || ''),
    sector: titleCaseAgency(agency.sector || ''),
    address: titleCaseAgency(agency.address || agency.endereco || ''),
    weekdayHours: agency.weekdayHours || agency.horario_semana || '',
    weekendHours: agency.weekendHours || agency.horario_fds || ''
});

export const formatAgencyOptionLine = (agency = {}, index = null) => {
    const formatted = formatServientregaAgency(agency);
    const prefix = index ? `${index}. ` : '';
    return `${prefix}Agencia Servientrega ${formatted.name} - ${formatted.address} (${formatted.city}, ${formatted.province})`;
};

export const findKnownServientregaEcuadorLocation = ({
    city = '',
    province = '',
    text = ''
} = {}) => {
    const agencies = loadServientregaEcuadorAgencies();
    const cityCatalog = uniqueNormalizedValues(agencies, 'City');
    const provinceCatalog = uniqueNormalizedValues(agencies, 'Province');
    const explicit = extractExplicitLocationParts(text);
    const cityInput = explicit.city || city || text;
    const provinceInput = explicit.province || province || text;
    const suppressFuzzyLocation = shouldSuppressFuzzyLocationFromAgencyToken({
        input: text,
        agencies,
        cityCatalog,
        provinceCatalog,
        explicitCity: explicit.city,
        explicitProvince: explicit.province,
        city,
        province
    });
    const exactCityMatch = exactCatalogMatch(cityInput, cityCatalog);
    const exactProvinceMatch = exactCatalogMatch(provinceInput, provinceCatalog);
    const shouldFuzzyProvince = Boolean(explicit.province || province || !exactCityMatch || exactProvinceMatch);
    const cityMatch = suppressFuzzyLocation ? null : (exactCityMatch || bestCatalogMatch(cityInput, cityCatalog));
    const provinceMatch = suppressFuzzyLocation
        ? null
        : (exactProvinceMatch || (shouldFuzzyProvince ? bestCatalogMatch(provinceInput, provinceCatalog) : null));

    const matchingAgencies = (cityMatch || provinceMatch)
        ? agencies.filter((agency) => (
            (!cityMatch || agency.normalizedCity === cityMatch.normalized)
            && (!provinceMatch || agency.normalizedProvince === provinceMatch.normalized)
        ))
        : [];
    const uniqueProvinceForCity = cityMatch
        ? [...new Set(agencies
            .filter((agency) => agency.normalizedCity === cityMatch.normalized)
            .map((agency) => agency.province)
            .filter(Boolean))]
        : [];

    return {
        city: cityMatch?.value || '',
        province: provinceMatch?.value || (uniqueProvinceForCity.length === 1 ? uniqueProvinceForCity[0] : ''),
        cityMatched: Boolean(cityMatch),
        provinceMatched: Boolean(provinceMatch || uniqueProvinceForCity.length === 1),
        agencies: matchingAgencies.map(formatServientregaAgency)
    };
};

export const findServientregaEcuadorAgencies = ({
    city = '',
    province = '',
    query = '',
    limit = 3
} = {}) => {
    const agencies = loadServientregaEcuadorAgencies();
    const knownLocation = findKnownServientregaEcuadorLocation({ city, province, text: query });
    const normalizedCity = normalizeAgencyText(knownLocation.city || city);
    const normalizedProvince = normalizeAgencyText(knownLocation.province || province);
    const normalizedQuery = normalizeAgencyText(query);
    const queryIsSpecific = normalizedQuery.length >= 4;
    const queryTokens = tokensFor(query);
    const hasScopedLocation = Boolean(normalizedCity || normalizedProvince);

    let scored = agencies.map((agency) => {
        let score = 0;
        const cityExactMatched = Boolean(normalizedCity && agency.normalizedCity === normalizedCity);
        const cityMatched = Boolean(cityExactMatched || (normalizedCity && (
            agency.normalizedCity.includes(normalizedCity)
            || normalizedCity.includes(agency.normalizedCity)
        )));
        const provinceExactMatched = Boolean(normalizedProvince && agency.normalizedProvince === normalizedProvince);
        const provinceMatched = Boolean(provinceExactMatched || (normalizedProvince && (
            agency.normalizedProvince.includes(normalizedProvince)
            || normalizedProvince.includes(agency.normalizedProvince)
        )));
        const queryNameMatched = Boolean(queryIsSpecific && (
            agency.normalizedName.includes(normalizedQuery)
            || normalizedQuery.includes(agency.normalizedName)
        ));
        const queryAddressMatched = Boolean(queryIsSpecific && (
            agency.normalizedAddress.includes(normalizedQuery)
            || normalizedQuery.includes(agency.normalizedAddress)
        ));
        const queryCityExactMatched = Boolean(normalizedQuery && agency.normalizedCity === normalizedQuery);
        const queryCityMatched = Boolean(queryCityExactMatched || (queryIsSpecific && agency.normalizedCity && (
            agency.normalizedCity.includes(normalizedQuery)
            || normalizedQuery.includes(agency.normalizedCity)
        )));
        const queryProvinceExactMatched = Boolean(normalizedQuery && agency.normalizedProvince === normalizedQuery);
        const queryProvinceMatched = Boolean(queryProvinceExactMatched || (queryIsSpecific && agency.normalizedProvince && (
            agency.normalizedProvince.includes(normalizedQuery)
            || normalizedQuery.includes(agency.normalizedProvince)
        )));
        const querySectorMatched = Boolean(queryIsSpecific && agency.normalizedSector && (
            agency.normalizedSector.includes(normalizedQuery)
            || normalizedQuery.includes(agency.normalizedSector)
        ));
        const queryNameTokenMatched = Boolean(queryTokens.length && hasStrongTokenMatch(queryTokens, agency.normalizedName));
        const queryAddressTokenMatched = Boolean(queryTokens.length && hasStrongTokenMatch(queryTokens, agency.normalizedAddress));

        if (cityExactMatched) score += 950;
        else if (cityMatched) score += 700;
        if (provinceExactMatched) score += 50;
        else if (provinceMatched) score += 30;
        if (normalizedQuery) {
            if (queryNameMatched) score += 45;
            if (queryAddressMatched) score += 35;
            if (queryCityExactMatched) score += 900;
            else if (queryCityMatched) score += 650;
            if (queryProvinceExactMatched) score += 35;
            else if (queryProvinceMatched) score += 22;
            if (querySectorMatched) score += 12;
            if (queryNameTokenMatched) score += 35;
            if (queryAddressTokenMatched) score += 45;
            score += overlapScore(queryTokens, `${agency.normalizedName} ${agency.normalizedAddress} ${agency.normalizedSector} ${agency.normalizedCity} ${agency.normalizedProvince}`, 9);
        }

        return {
            agency,
            score,
            cityExactMatched,
            provinceExactMatched,
            cityMatched,
            provinceMatched,
            queryNameMatched,
            queryAddressMatched,
            queryNameTokenMatched,
            queryAddressTokenMatched,
            queryCityMatched,
            queryProvinceMatched,
            querySectorMatched
        };
    })
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score || a.agency.name.localeCompare(b.agency.name));

    if (!hasScopedLocation && normalizedQuery) {
        scored = scored.filter((item) => item.score >= 80 && (item.queryNameMatched || item.queryAddressMatched));
    }

    const exactScoped = scored.filter((item) => (
        (!normalizedCity || item.cityExactMatched)
        && (!normalizedProvince || item.provinceExactMatched)
    ));
    const finalScored = exactScoped.length ? exactScoped : scored;

    return finalScored.slice(0, limit).map((item) => ({
        ...formatServientregaAgency(item.agency),
        score: item.score,
        cityMatched: item.cityMatched,
        provinceMatched: item.provinceMatched,
        queryNameMatched: item.queryNameMatched,
        queryAddressMatched: item.queryAddressMatched,
        queryNameTokenMatched: item.queryNameTokenMatched,
        queryAddressTokenMatched: item.queryAddressTokenMatched,
        queryCityMatched: item.queryCityMatched,
        queryProvinceMatched: item.queryProvinceMatched,
        querySectorMatched: item.querySectorMatched
    }));
};

export const resolveServientregaEcuadorAgency = ({
    city = '',
    province = '',
    agencyName = '',
    address = '',
    text = '',
    limit = 3
} = {}) => {
    const query = [agencyName, address, text]
        .filter(Boolean)
        .join(' ');
    const suggestions = findServientregaEcuadorAgencies({
        city,
        province,
        query,
        limit
    });
    const best = suggestions[0] || null;
    const hasScopedLocation = Boolean(normalizeAgencyText(city) || normalizeAgencyText(province));
    const hasMultipleUnscopedMatches = Boolean(!hasScopedLocation && suggestions.length > 1);
    const hasSpecificMatch = Boolean(best && (
        best.queryNameTokenMatched
        || best.queryAddressTokenMatched
        || (
            (best.queryNameMatched || best.queryAddressMatched)
            && !GENERIC_AGENCY_LOCATION_TOKENS.has(normalizeAgencyText(query))
        )
    ));
    const confident = Boolean(best && !hasMultipleUnscopedMatches && (
        (hasSpecificMatch && best.score >= 75)
        || (suggestions.length === 1 && best.score >= 60 && (best.cityMatched || best.queryCityMatched || best.provinceMatched || best.queryProvinceMatched))
    ));

    return {
        best,
        confident,
        suggestions
    };
};
