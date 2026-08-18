import crypto from 'node:crypto';
import {
    loadServientregaEcuadorAgencies,
    normalizeAgencyText,
    resolveServientregaEcuadorAgency
} from './servientregaEcuadorAgencyService.js';

export const CUSTOMER_DATA_RESOLUTION_VERSION = 28;

export const CUSTOMER_DATA_STATUS = Object.freeze({
    VERIFIED: 'VERIFIED',
    HIGH_CONFIDENCE: 'HIGH_CONFIDENCE',
    CANONICAL: 'CANONICAL',
    AUTO_FROM_CITY: 'AUTO_FROM_CITY',
    NEEDS_CONFIRMATION: 'NEEDS_CONFIRMATION',
    SEGMENTATION_REQUIRED: 'SEGMENTATION_REQUIRED',
    CONFLICT: 'CONFLICT',
    INVALID: 'INVALID',
    MISSING: 'MISSING',
    UNVERIFIED_TEXT: 'UNVERIFIED_TEXT',
    NOT_APPLICABLE: 'NOT_APPLICABLE'
});

const NAME_PARTICLES = new Set([
    'da', 'das', 'de', 'del', 'do', 'dos', 'e', 'la', 'las', 'los', 'van', 'von', 'y'
]);
const NAME_BLOCKED_WORDS = new Set([
    'agencia', 'botella', 'botellas', 'calle', 'ciudad', 'cliente', 'direccion',
    'dolares', 'frasco', 'frascos', 'nombre', 'pedido', 'producto', 'provincia',
    'referencia', 'servientrega', 'telefono', 'tratamiento', 'usd', 'whatsapp'
]);
const CONCATENATION_LEXEMES = [
    'alejandro', 'andres', 'arellano', 'carlos', 'cristian', 'fernando', 'gomez',
    'javier', 'jose', 'juan', 'luis', 'maria', 'martinez', 'perez',
    'peralta', 'rodriguez', 'zambrano'
];
const SOURCE_PRIORITY = Object.freeze({
    human_correction: 600,
    customer_confirmation: 500,
    explicit_label: 400,
    structured_form: 350,
    conversation_high_confidence: 250,
    whatsapp_profile: 100,
    username: 80,
    unknown: 0
});
const CITY_ALIASES = new Map([
    ['AMBATTO', 'AMBATO'],
    ['AMVATO', 'AMBATO'],
    ['ANBATO', 'AMBATO'],
    ['CUENKA', 'CUENCA'],
    ['GYE', 'GUAYAQUIL'],
    ['GQUIL', 'GUAYAQUIL'],
    ['KITO', 'QUITO'],
    ['MANTTA', 'MANTA'],
    ['PORTOVIEGO', 'PORTOVIEJO'],
    ['QITO', 'QUITO'],
    ['RIO BAMBA', 'RIOBAMBA'],
    ['STO DOMINGO', 'SANTO DOMINGO']
]);

const nowIso = (value = null) => {
    const date = value ? new Date(value) : new Date();
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};
const rawText = (value = '') => String(value ?? '').replace(/\u0000/g, '').trim();
const cleanSpaces = (value = '') => rawText(value).replace(/\u00a0/g, ' ').replace(/\s+/gu, ' ').trim();
const normalizedKey = (value = '') => cleanSpaces(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-EC');
const compactKey = (value = '') => normalizedKey(value).replace(/[^a-z]/g, '');
const sourcePriority = (source = '') => SOURCE_PRIORITY[String(source || '').trim()] ?? SOURCE_PRIORITY.unknown;
const digitsOnly = (value = '') => String(value || '').replace(/\D/g, '');
const fieldSnapshot = (field = {}) => ({
    raw_value: field.raw_value || '',
    canonical_value: field.canonical_value || '',
    display_value: field.display_value || '',
    source: field.source || '',
    source_message_id: field.source_message_id || '',
    extracted_at: field.extracted_at || '',
    confidence: Number(field.confidence || 0),
    validation_status: field.validation_status || CUSTOMER_DATA_STATUS.MISSING,
    confirmed_by_customer: field.confirmed_by_customer === true,
    corrected_by_human: field.corrected_by_human === true,
    locked: field.locked === true
});
const sameFieldValue = (left = {}, right = {}) => (
    rawText(left.raw_value) === rawText(right.raw_value)
    && rawText(left.canonical_value) === rawText(right.canonical_value)
    && String(left.validation_status || '') === String(right.validation_status || '')
);
const withHistory = (next = {}, previous = null) => {
    const previousHistory = Array.isArray(previous?.history) ? previous.history : [];
    if (!previous || sameFieldValue(next, previous)) return { ...next, history: previousHistory.slice(-9) };
    return { ...next, history: [...previousHistory, fieldSnapshot(previous)].slice(-10) };
};
const lockedPreviousWins = ({ previous = null, correctedByHuman = false, confirmedByCustomer = false, source = '' } = {}) => (
    previous?.locked === true
    && !correctedByHuman
    && !(
        confirmedByCustomer
        && sourcePriority('customer_confirmation') >= sourcePriority(previous.source || source)
    )
);
const strongerPreviousSourceWins = ({ previous = null, raw = '', correctedByHuman = false, confirmedByCustomer = false, source = '' } = {}) => {
    if (!previous?.canonical_value || correctedByHuman || confirmedByCustomer) return false;
    if (!rawText(raw)) return true;
    return sourcePriority(previous.source) > sourcePriority(source);
};
const baseField = ({
    raw = '',
    canonical = '',
    display = canonical,
    source = 'unknown',
    sourceMessageId = '',
    extractedAt = null,
    confidence = 0,
    status = CUSTOMER_DATA_STATUS.MISSING,
    confirmedByCustomer = false,
    correctedByHuman = false,
    locked = false,
    evidence = [],
    candidates = [],
    metadata = {}
} = {}) => ({
    raw_value: rawText(raw),
    canonical_value: rawText(canonical),
    display_value: rawText(display),
    source,
    source_message_id: rawText(sourceMessageId),
    extracted_at: nowIso(extractedAt),
    confidence: Math.max(0, Math.min(100, Math.round(Number(confidence || 0)))),
    validation_status: status,
    confirmed_by_customer: confirmedByCustomer === true,
    corrected_by_human: correctedByHuman === true,
    locked: locked === true,
    evidence: [...new Set(evidence.filter(Boolean))],
    candidates,
    ...metadata
});

const titleCaseToken = (token = '') => String(token || '')
    .toLocaleLowerCase('es-EC')
    .split(/([-’'])/u)
    .map((part) => /^[-’']$/u.test(part)
        ? part
        : part.replace(/\p{L}/u, (letter) => letter.toLocaleUpperCase('es-EC')))
    .join('');

export const formatInternationalPersonName = (value = '') => {
    const clean = cleanSpaces(value);
    if (!clean) return '';
    const letters = clean.replace(/[^\p{L}]/gu, '');
    const shouldNormalizeCase = letters === letters.toLocaleUpperCase('es-EC')
        || letters === letters.toLocaleLowerCase('es-EC');
    if (!shouldNormalizeCase) return clean;
    return clean.split(' ').map((token, index) => {
        const key = normalizedKey(token).replace(/[^a-z]/g, '');
        return index > 0 && NAME_PARTICLES.has(key)
            ? token.toLocaleLowerCase('es-EC')
            : titleCaseToken(token);
    }).join(' ');
};

const segmentationEvidence = (value = '', source = '') => {
    const compact = compactKey(value);
    const evidence = [];
    if (!compact || /\s/u.test(cleanSpaces(value))) return evidence;
    if (compact.length >= 16) evidence.push('long_without_separator');
    if (['whatsapp_profile', 'username'].includes(source)) evidence.push('profile_or_username_source');
    const lexemeHits = CONCATENATION_LEXEMES.filter((item) => compact.includes(item));
    if (lexemeHits.length >= 2) evidence.push('multiple_name_lexemes_without_separator');
    return evidence;
};

export const resolveCustomerName = ({
    raw = '',
    source = 'unknown',
    sourceMessageId = '',
    previous = null,
    confirmedByCustomer = false,
    correctedByHuman = false,
    extractedAt = null
} = {}) => {
    if (lockedPreviousWins({ previous, correctedByHuman, confirmedByCustomer, source })) {
        return { ...previous, ignored_candidate: fieldSnapshot(baseField({ raw, source, sourceMessageId, extractedAt })) };
    }
    if (strongerPreviousSourceWins({ previous, raw, correctedByHuman, confirmedByCustomer, source })) {
        return { ...previous, ignored_candidate: fieldSnapshot(baseField({ raw, source, sourceMessageId, extractedAt })) };
    }
    const original = rawText(raw);
    if (!original) return withHistory(baseField({ raw: original, source, sourceMessageId, extractedAt }), previous);
    const normalized = cleanSpaces(original);
    const words = normalized.split(/\s+/u).filter(Boolean);
    const normalizedWords = words.map((word) => normalizedKey(word).replace(/[^a-z]/g, '')).filter(Boolean);
    const containsInvalidCharacters = !/^[\p{L}][\p{L}\s.'’-]*$/u.test(normalized);
    const containsNumber = /\p{N}/u.test(normalized);
    const looksLikeUrlOrEmail = /(?:https?:\/\/|www\.|@|\.[a-z]{2,}\b)/i.test(normalized);
    const containsCommercialText = normalizedWords.some((word) => NAME_BLOCKED_WORDS.has(word));
    const repeatedAbnormally = /(\p{L})\1{4,}/iu.test(normalized);
    const evidence = [];
    if (containsNumber) evidence.push('contains_number');
    if (looksLikeUrlOrEmail) evidence.push('url_or_email');
    if (containsCommercialText) evidence.push('commercial_or_form_text');
    if (repeatedAbnormally) evidence.push('abnormal_repetition');
    if (containsInvalidCharacters) evidence.push('incompatible_symbol');
    if (evidence.length) {
        return withHistory(baseField({
            raw: original,
            source,
            sourceMessageId,
            extractedAt,
            confidence: 0,
            status: CUSTOMER_DATA_STATUS.INVALID,
            confirmedByCustomer,
            correctedByHuman,
            locked: correctedByHuman,
            evidence
        }), previous);
    }

    const segmentation = segmentationEvidence(normalized, source);
    if (words.length === 1 && !correctedByHuman && segmentation.length >= 2) {
        return withHistory(baseField({
            raw: original,
            display: original,
            source,
            sourceMessageId,
            extractedAt,
            confidence: 25,
            status: CUSTOMER_DATA_STATUS.SEGMENTATION_REQUIRED,
            confirmedByCustomer,
            evidence: segmentation
        }), previous);
    }
    if (words.length === 1 && !confirmedByCustomer && !correctedByHuman && ['whatsapp_profile', 'username'].includes(source)) {
        return withHistory(baseField({
            raw: original,
            display: original,
            source,
            sourceMessageId,
            extractedAt,
            confidence: 30,
            status: CUSTOMER_DATA_STATUS.NEEDS_CONFIRMATION,
            evidence: ['single_token_profile_hint_only']
        }), previous);
    }

    const display = formatInternationalPersonName(normalized);
    const status = correctedByHuman || confirmedByCustomer
        ? CUSTOMER_DATA_STATUS.VERIFIED
        : CUSTOMER_DATA_STATUS.HIGH_CONFIDENCE;
    const confidence = correctedByHuman ? 100 : confirmedByCustomer ? 98 : source === 'explicit_label' ? 92 : source === 'structured_form' ? 88 : 80;
    return withHistory(baseField({
        raw: original,
        canonical: display,
        display,
        source: correctedByHuman ? 'human_correction' : confirmedByCustomer ? 'customer_confirmation' : source,
        sourceMessageId,
        extractedAt,
        confidence,
        status,
        confirmedByCustomer,
        correctedByHuman,
        locked: correctedByHuman || confirmedByCustomer,
        evidence: [words.length === 1 ? 'confirmed_or_plausible_mononym' : 'structurally_plausible_person_name'],
        metadata: {
            normalized_value: display,
            name_parts: words.length > 1 ? words : [],
            source_priority: sourcePriority(correctedByHuman ? 'human_correction' : confirmedByCustomer ? 'customer_confirmation' : source)
        }
    }), previous);
};

const levenshtein = (left = '', right = '') => {
    const a = String(left || '');
    const b = String(right || '');
    if (!a) return b.length;
    if (!b) return a.length;
    const matrix = Array.from({ length: a.length + 1 }, (_, row) => [row]);
    for (let column = 1; column <= b.length; column += 1) matrix[0][column] = column;
    for (let row = 1; row <= a.length; row += 1) {
        for (let column = 1; column <= b.length; column += 1) {
            matrix[row][column] = Math.min(
                matrix[row - 1][column] + 1,
                matrix[row][column - 1] + 1,
                matrix[row - 1][column - 1] + (a[row - 1] === b[column - 1] ? 0 : 1)
            );
        }
    }
    return matrix[a.length][b.length];
};
const similarity = (left = '', right = '') => {
    const longest = Math.max(left.length, right.length);
    return longest ? 1 - (levenshtein(left, right) / longest) : 1;
};
const titleLocation = (value = '') => cleanSpaces(value).toLocaleLowerCase('es-EC')
    .split(' ')
    .map((part) => titleCaseToken(part))
    .join(' ');
const registryId = (...parts) => `EC-${parts.map((part) => normalizeAgencyText(part).replace(/\s+/g, '-')).filter(Boolean).join('-')}`;

let locationRegistryCache = null;
export const ecuadorLocationRegistry = () => {
    if (locationRegistryCache) return locationRegistryCache;
    const agencies = loadServientregaEcuadorAgencies();
    const cities = new Map();
    const provinces = new Map();
    for (const agency of agencies) {
        const cityKey = normalizeAgencyText(agency.city);
        const provinceKey = normalizeAgencyText(agency.province);
        if (provinceKey && !provinces.has(provinceKey)) provinces.set(provinceKey, {
            id: registryId(agency.province),
            country: 'EC',
            province: titleLocation(agency.province),
            normalized: provinceKey
        });
        if (!cityKey) continue;
        const composite = `${provinceKey}:${cityKey}`;
        if (!cities.has(composite)) cities.set(composite, {
            id: registryId(agency.province, agency.city),
            country: 'EC',
            province: titleLocation(agency.province),
            city: titleLocation(agency.city),
            normalizedCity: cityKey,
            normalizedProvince: provinceKey
        });
    }
    locationRegistryCache = {
        country: 'EC',
        source: 'src/data/agencia_LISTA.json',
        cities: [...cities.values()],
        provinces: [...provinces.values()]
    };
    return locationRegistryCache;
};

const cleanLocationInput = (value = '') => normalizeAgencyText(value)
    .replace(/\b(?:CIUDAD|CIDADE|CITY|CANTON|PROVINCIA|PROV)\b/g, ' ')
    .replace(/\b(?:ECUADOR|EC)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const uniqueLocationCandidate = ({ raw = '', rows = [], key = 'normalized', aliases = null, threshold = 0.84 } = {}) => {
    const input = cleanLocationInput(raw);
    if (!input) return { status: CUSTOMER_DATA_STATUS.MISSING, candidate: null, candidates: [], score: 0 };
    const alias = aliases?.get(input) || input;
    const exact = rows.filter((row) => row[key] === alias);
    if (exact.length === 1) return { status: CUSTOMER_DATA_STATUS.CANONICAL, candidate: exact[0], candidates: exact, score: input === alias ? 1 : 0.96 };
    if (exact.length > 1) return { status: CUSTOMER_DATA_STATUS.NEEDS_CONFIRMATION, candidate: null, candidates: exact, score: 1 };
    const ranked = rows.map((row) => ({ row, score: similarity(alias, row[key]) }))
        .filter((item) => item.score >= threshold)
        .sort((left, right) => right.score - left.score || left.row[key].localeCompare(right.row[key]));
    const top = ranked[0];
    const second = ranked[1];
    if (top && (!second || top.score - second.score >= 0.08)) {
        return { status: CUSTOMER_DATA_STATUS.CANONICAL, candidate: top.row, candidates: ranked.slice(0, 3).map((item) => item.row), score: top.score };
    }
    return {
        status: ranked.length ? CUSTOMER_DATA_STATUS.NEEDS_CONFIRMATION : CUSTOMER_DATA_STATUS.INVALID,
        candidate: null,
        candidates: ranked.slice(0, 3).map((item) => item.row),
        score: top?.score || 0
    };
};

export const resolveEcuadorLocation = ({
    cityRaw = '',
    provinceRaw = '',
    source = 'unknown',
    sourceMessageId = '',
    extractedAt = null,
    previousCity = null,
    previousProvince = null,
    correctedByHumanFields = [],
    confirmedByCustomerFields = []
} = {}) => {
    const registry = ecuadorLocationRegistry();
    const corrected = new Set(correctedByHumanFields);
    const confirmed = new Set(confirmedByCustomerFields);
    const provinceMatch = uniqueLocationCandidate({ raw: provinceRaw, rows: registry.provinces, key: 'normalized', threshold: 0.86 });
    const globalCityMatch = uniqueLocationCandidate({ raw: cityRaw, rows: registry.cities, key: 'normalizedCity', aliases: CITY_ALIASES, threshold: 0.84 });
    const provinceCityMatch = provinceMatch.candidate && !globalCityMatch.candidate
        ? uniqueLocationCandidate({
            raw: cityRaw,
            rows: registry.cities.filter((row) => row.normalizedProvince === provinceMatch.candidate.normalized),
            key: 'normalizedCity',
            aliases: CITY_ALIASES,
            threshold: 0.84
        })
        : null;
    const cityMatch = provinceCityMatch?.candidate ? provinceCityMatch : globalCityMatch;
    const canonicalCity = cityMatch.candidate;
    const cityProvince = canonicalCity?.province || '';
    const suppliedProvince = provinceMatch.candidate?.province || '';
    const conflict = Boolean(cityProvince && suppliedProvince && normalizeAgencyText(cityProvince) !== normalizeAgencyText(suppliedProvince));

    const makeLocationField = ({ field, raw, match, fallback = '', autoFromCity = false, previous = null }) => {
        const correctedByHuman = corrected.has(field);
        const confirmedByCustomer = confirmed.has(field);
        if (lockedPreviousWins({ previous, correctedByHuman, confirmedByCustomer, source })) return previous;
        const candidateValue = match?.candidate?.[field] || fallback;
        const status = conflict
            ? CUSTOMER_DATA_STATUS.CONFLICT
            : autoFromCity && candidateValue
                ? CUSTOMER_DATA_STATUS.AUTO_FROM_CITY
                : match?.status || CUSTOMER_DATA_STATUS.MISSING;
        const registryValidated = [CUSTOMER_DATA_STATUS.CANONICAL, CUSTOMER_DATA_STATUS.AUTO_FROM_CITY].includes(status);
        const confidence = correctedByHuman ? 100
            : confirmedByCustomer ? 98
                : status === CUSTOMER_DATA_STATUS.CANONICAL ? Math.round((match?.score || 0) * 100)
                    : status === CUSTOMER_DATA_STATUS.AUTO_FROM_CITY ? 97
                        : status === CUSTOMER_DATA_STATUS.CONFLICT ? 0 : Math.round((match?.score || 0) * 100);
        return withHistory(baseField({
            raw,
            canonical: conflict ? '' : candidateValue,
            display: conflict ? raw : candidateValue,
            source: correctedByHuman ? 'human_correction' : confirmedByCustomer ? 'customer_confirmation' : (autoFromCity ? 'ec_location_registry_city' : source),
            sourceMessageId,
            extractedAt,
            confidence,
            status: (correctedByHuman || confirmedByCustomer) && registryValidated ? CUSTOMER_DATA_STATUS.VERIFIED : status,
            confirmedByCustomer,
            correctedByHuman,
            locked: (correctedByHuman || confirmedByCustomer) && registryValidated,
            evidence: [
                ...(match?.candidate ? [match.score === 1 ? 'registry_exact' : 'registry_unique_fuzzy'] : []),
                ...(autoFromCity ? [rawText(raw) ? 'province_confirmed_from_unique_city' : 'province_derived_from_unique_city'] : []),
                ...(conflict ? ['city_province_registry_conflict'] : [])
            ],
            candidates: (match?.candidates || []).map((item) => ({ id: item.id, city: item.city || '', province: item.province || '' })),
            metadata: { registry_id: match?.candidate?.id || (autoFromCity ? canonicalCity?.id || '' : '') }
        }), previous);
    };

    const city = makeLocationField({ field: 'city', raw: cityRaw, match: cityMatch, previous: previousCity });
    const provinceBackedByCity = Boolean(
        cityProvince
        && !conflict
        && (!provinceRaw || normalizeAgencyText(suppliedProvince) === normalizeAgencyText(cityProvince))
    );
    const province = makeLocationField({
        field: 'province',
        raw: provinceRaw,
        match: provinceMatch,
        fallback: !provinceRaw && cityProvince ? cityProvince : '',
        autoFromCity: provinceBackedByCity,
        previous: previousProvince
    });
    return { city, province, conflict };
};

export const normalizeE164EcuadorPhone = (value = '') => {
    let digits = digitsOnly(value);
    if (/^09\d{8}$/.test(digits)) digits = `593${digits.slice(1)}`;
    if (/^9\d{8}$/.test(digits)) digits = `593${digits}`;
    return /^5939\d{8}$/.test(digits) ? `+${digits}` : '';
};

const resolvePhoneField = ({ raw = '', conversationPhone = '', previous = null, sourceMessageId = '', extractedAt = null } = {}) => {
    const primary = normalizeE164EcuadorPhone(conversationPhone);
    const textual = normalizeE164EcuadorPhone(raw);
    const canonical = primary || textual;
    if (previous?.locked && (!canonical || previous.canonical_value !== canonical)) {
        return { ...previous, ignored_candidate: fieldSnapshot(baseField({ raw, canonical, source: primary ? 'whatsapp_conversation' : 'structured_form', sourceMessageId, extractedAt })) };
    }
    return withHistory(baseField({
        raw,
        canonical,
        display: canonical || raw,
        source: primary ? 'whatsapp_conversation' : textual ? 'structured_form' : 'unknown',
        sourceMessageId,
        extractedAt,
        confidence: primary ? 100 : textual ? 90 : 0,
        status: canonical ? CUSTOMER_DATA_STATUS.VERIFIED : CUSTOMER_DATA_STATUS.INVALID,
        locked: Boolean(primary),
        evidence: primary ? ['conversation_phone_is_primary'] : textual ? ['valid_ec_e164'] : ['invalid_ec_phone']
    }), previous);
};

const textField = ({ raw = '', source = 'unknown', sourceMessageId = '', extractedAt = null, previous = null, correctedByHuman = false, confirmedByCustomer = false, required = false, metadata = {} } = {}) => {
    if (lockedPreviousWins({ previous, correctedByHuman, confirmedByCustomer, source })) return previous;
    const original = rawText(raw);
    const canonical = cleanSpaces(original);
    return withHistory(baseField({
        raw: original,
        canonical,
        display: canonical,
        source: correctedByHuman ? 'human_correction' : confirmedByCustomer ? 'customer_confirmation' : source,
        sourceMessageId,
        extractedAt,
        confidence: correctedByHuman ? 100 : confirmedByCustomer ? 98 : canonical ? 75 : 0,
        status: correctedByHuman || confirmedByCustomer
            ? CUSTOMER_DATA_STATUS.VERIFIED
            : canonical ? CUSTOMER_DATA_STATUS.UNVERIFIED_TEXT : required ? CUSTOMER_DATA_STATUS.MISSING : CUSTOMER_DATA_STATUS.NOT_APPLICABLE,
        confirmedByCustomer,
        correctedByHuman,
        locked: (correctedByHuman || confirmedByCustomer) && Boolean(canonical),
        evidence: canonical ? ['raw_text_preserved_without_external_geocoder'] : [],
        metadata
    }), previous);
};

const normalizeDeliveryMode = (value = '') => {
    const normalized = normalizedKey(value).replace(/[^a-z]/g, '');
    if (/^(?:agency|agencia|retiro|servientrega)$/.test(normalized)) return 'agency';
    if (/^(?:home|domicilio|casa|direccion)$/.test(normalized)) return 'home';
    return '';
};

const agencyIdentifier = (agency = {}) => {
    const stable = [agency.province, agency.city, agency.name, agency.address].map(normalizeAgencyText).join('|');
    return `EC-SA-${crypto.createHash('sha256').update(stable).digest('hex').slice(0, 16).toUpperCase()}`;
};

export const resolveAuthorizedAgency = ({
    agencyRaw = '',
    addressRaw = '',
    deliveryMode = '',
    city = '',
    province = '',
    source = 'unknown',
    sourceMessageId = '',
    extractedAt = null,
    previous = null,
    correctedByHuman = false,
    confirmedByCustomer = false
} = {}) => {
    const mode = normalizeDeliveryMode(deliveryMode);
    if (mode !== 'agency') return withHistory(baseField({
        raw: agencyRaw,
        source,
        sourceMessageId,
        extractedAt,
        status: mode === 'home' ? CUSTOMER_DATA_STATUS.NOT_APPLICABLE : CUSTOMER_DATA_STATUS.MISSING
    }), previous);
    if (lockedPreviousWins({ previous, correctedByHuman, confirmedByCustomer, source })) return previous;
    const resolution = resolveServientregaEcuadorAgency({
        city,
        province,
        agencyName: agencyRaw,
        address: addressRaw,
        text: agencyRaw,
        limit: 3
    });
    const best = resolution.best;
    const sameCity = !city || normalizeAgencyText(best?.city) === normalizeAgencyText(city);
    const sameProvince = !province || normalizeAgencyText(best?.province) === normalizeAgencyText(province);
    const valid = Boolean(resolution.confident && best && sameCity && sameProvince);
    const conflict = Boolean(best && (!sameCity || !sameProvince));
    const status = conflict
        ? CUSTOMER_DATA_STATUS.CONFLICT
        : valid ? CUSTOMER_DATA_STATUS.VERIFIED
            : resolution.suggestions.length ? CUSTOMER_DATA_STATUS.NEEDS_CONFIRMATION : CUSTOMER_DATA_STATUS.INVALID;
    return withHistory(baseField({
        raw: agencyRaw || addressRaw,
        canonical: valid ? best.name : '',
        display: valid ? best.name : agencyRaw || addressRaw,
        source: correctedByHuman ? 'human_correction' : confirmedByCustomer ? 'customer_confirmation' : 'servientrega_authorized_registry',
        sourceMessageId,
        extractedAt,
        confidence: correctedByHuman ? 100 : confirmedByCustomer ? 98 : valid ? 95 : conflict ? 0 : 45,
        status,
        confirmedByCustomer,
        correctedByHuman,
        locked: (correctedByHuman || confirmedByCustomer) && valid,
        evidence: [
            ...(valid ? ['unique_authorized_registry_agency'] : []),
            ...(conflict ? ['agency_location_conflict'] : []),
            ...(!best ? ['no_authorized_agency_found'] : [])
        ],
        candidates: resolution.suggestions.map((agency) => ({
            agency_id: agencyIdentifier(agency),
            name: agency.name,
            city: agency.city,
            province: agency.province,
            address: agency.address,
            active: true,
            source: 'src/data/agencia_LISTA.json'
        })),
        metadata: valid ? {
            agency_id: agencyIdentifier(best),
            name: best.name,
            country: 'EC',
            province: best.province,
            city: best.city,
            address: best.address,
            lat: null,
            lng: null,
            active: true,
            source_registry: 'src/data/agencia_LISTA.json',
            last_verified_at: ''
        } : {}
    }), previous);
};

export const nearestAuthorizedAgencies = ({ lat = null, lng = null, limit = 3 } = {}) => {
    const hasCoordinates = lat !== null && lat !== '' && lng !== null && lng !== ''
        && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
    if (!hasCoordinates) return { available: false, reason: 'coordinates_missing', agencies: [] };
    const withCoordinates = loadServientregaEcuadorAgencies().filter((agency) => Number.isFinite(Number(agency.lat)) && Number.isFinite(Number(agency.lng)));
    if (!withCoordinates.length) return { available: false, reason: 'authorized_registry_coordinates_unavailable', agencies: [] };
    const toRadians = (degrees) => Number(degrees) * (Math.PI / 180);
    const distanceKm = (agency) => {
        const earthRadiusKm = 6371;
        const latitudeDelta = toRadians(Number(agency.lat) - Number(lat));
        const longitudeDelta = toRadians(Number(agency.lng) - Number(lng));
        const originLatitude = toRadians(lat);
        const agencyLatitude = toRadians(agency.lat);
        const haversine = Math.sin(latitudeDelta / 2) ** 2
            + Math.cos(originLatitude) * Math.cos(agencyLatitude) * Math.sin(longitudeDelta / 2) ** 2;
        return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
    };
    const agencies = withCoordinates
        .map((agency) => ({ ...agency, distanceKm: Number(distanceKm(agency).toFixed(3)) }))
        .sort((left, right) => left.distanceKm - right.distanceKm)
        .slice(0, Math.max(1, Number(limit || 3)));
    return { available: true, reason: 'ok', agencies };
};

const acceptedNameStatus = (status = '') => [CUSTOMER_DATA_STATUS.VERIFIED, CUSTOMER_DATA_STATUS.HIGH_CONFIDENCE].includes(status);
const acceptedLocationStatus = (status = '') => [CUSTOMER_DATA_STATUS.VERIFIED, CUSTOMER_DATA_STATUS.CANONICAL, CUSTOMER_DATA_STATUS.AUTO_FROM_CITY].includes(status);

export const evaluateOrderDataGate = ({ fields = {}, deliveryMode = '' } = {}) => {
    const mode = normalizeDeliveryMode(deliveryMode || fields.delivery_mode?.canonical_value);
    const reasons = [];
    if (!acceptedNameStatus(fields.name?.validation_status)) reasons.push(fields.name?.validation_status === CUSTOMER_DATA_STATUS.SEGMENTATION_REQUIRED ? 'NAME_SEGMENTATION_REQUIRED' : 'NAME_NOT_RESOLVED');
    if (fields.phone?.validation_status !== CUSTOMER_DATA_STATUS.VERIFIED) reasons.push('PHONE_NOT_VERIFIED');
    if (fields.country?.canonical_value !== 'EC') reasons.push('COUNTRY_NOT_EC');
    if (!acceptedLocationStatus(fields.city?.validation_status)) reasons.push('CITY_NOT_CANONICAL');
    if (!acceptedLocationStatus(fields.province?.validation_status)) reasons.push('PROVINCE_NOT_RESOLVED');
    if ([fields.city?.validation_status, fields.province?.validation_status].includes(CUSTOMER_DATA_STATUS.CONFLICT)) reasons.push('LOCATION_CONFLICT');
    if (!mode) reasons.push('DELIVERY_MODE_REQUIRED');
    if (mode === 'home' && !fields.address?.canonical_value) reasons.push('HOME_ADDRESS_REQUIRED');
    if (mode === 'agency' && fields.agency?.validation_status !== CUSTOMER_DATA_STATUS.VERIFIED) reasons.push(fields.agency?.validation_status === CUSTOMER_DATA_STATUS.CONFLICT ? 'AGENCY_LOCATION_CONFLICT' : 'AUTHORIZED_AGENCY_REQUIRED');
    return { orderDataReady: reasons.length === 0, blockedReasons: [...new Set(reasons)], deliveryMode: mode };
};

const qualityScore = ({ fields = {}, gate = {} } = {}) => {
    const weighted = [
        ['name', 20, acceptedNameStatus(fields.name?.validation_status)],
        ['phone', 15, fields.phone?.validation_status === CUSTOMER_DATA_STATUS.VERIFIED],
        ['country', 5, fields.country?.canonical_value === 'EC'],
        ['city', 15, acceptedLocationStatus(fields.city?.validation_status)],
        ['province', 10, acceptedLocationStatus(fields.province?.validation_status)],
        ['delivery_mode', 10, Boolean(gate.deliveryMode)],
        ['address', 10, gate.deliveryMode === 'agency' || Boolean(fields.address?.canonical_value)],
        ['reference', 5, Boolean(fields.reference?.canonical_value)],
        ['agency', 10, gate.deliveryMode !== 'agency' || fields.agency?.validation_status === CUSTOMER_DATA_STATUS.VERIFIED]
    ];
    return weighted.reduce((sum, [, weight, valid]) => sum + (valid ? weight : 0), 0);
};

export const resolveCustomerDataDraft = ({
    draft = {},
    previousResolution = null,
    conversationPhone = '',
    source = 'structured_form',
    sourceMessageId = '',
    extractedAt = null,
    confirmedByCustomerFields = [],
    correctedByHumanFields = []
} = {}) => {
    const previousFields = previousResolution?.fields || {};
    const corrected = new Set(correctedByHumanFields);
    const confirmed = new Set(confirmedByCustomerFields);
    const name = resolveCustomerName({
        raw: draft.name_raw || draft.name || '',
        source,
        sourceMessageId,
        previous: previousFields.name,
        confirmedByCustomer: confirmed.has('name'),
        correctedByHuman: corrected.has('name'),
        extractedAt
    });
    const location = resolveEcuadorLocation({
        cityRaw: draft.city_raw || draft.city || '',
        provinceRaw: draft.province_raw || draft.province || '',
        source,
        sourceMessageId,
        extractedAt,
        previousCity: previousFields.city,
        previousProvince: previousFields.province,
        correctedByHumanFields,
        confirmedByCustomerFields
    });
    const phone = resolvePhoneField({
        raw: draft.phone_raw || draft.phone || '',
        conversationPhone,
        previous: previousFields.phone,
        sourceMessageId,
        extractedAt
    });
    const countryRaw = rawText(draft.country || 'EC');
    const countryNormalized = normalizedKey(countryRaw).replace(/[^a-z]/g, '');
    const isEcuador = ['ec', 'ecuador'].includes(countryNormalized);
    const country = withHistory(baseField({
        raw: countryRaw,
        canonical: isEcuador ? 'EC' : '',
        display: isEcuador ? 'Ecuador' : countryRaw,
        source: 'project_country_scope',
        sourceMessageId,
        extractedAt,
        confidence: isEcuador ? 100 : 0,
        status: isEcuador ? CUSTOMER_DATA_STATUS.VERIFIED : CUSTOMER_DATA_STATUS.CONFLICT,
        locked: true,
        evidence: [isEcuador ? 'ecuador_only_operation' : 'country_outside_ec_operation']
    }), previousFields.country);
    const deliveryModeValue = normalizeDeliveryMode(draft.deliveryMode || draft.delivery_mode || previousFields.delivery_mode?.canonical_value || '');
    const deliveryCandidate = baseField({
        raw: draft.deliveryMode || draft.delivery_mode || '',
        canonical: deliveryModeValue,
        display: deliveryModeValue === 'agency' ? 'Agencia Servientrega' : deliveryModeValue === 'home' ? 'Domicilio' : '',
        source: corrected.has('deliveryMode') ? 'human_correction' : confirmed.has('deliveryMode') ? 'customer_confirmation' : source,
        sourceMessageId,
        extractedAt,
        confidence: deliveryModeValue ? (corrected.has('deliveryMode') ? 100 : confirmed.has('deliveryMode') ? 98 : 90) : 0,
        status: deliveryModeValue ? (corrected.has('deliveryMode') || confirmed.has('deliveryMode') ? CUSTOMER_DATA_STATUS.VERIFIED : CUSTOMER_DATA_STATUS.HIGH_CONFIDENCE) : CUSTOMER_DATA_STATUS.MISSING,
        confirmedByCustomer: confirmed.has('deliveryMode'),
        correctedByHuman: corrected.has('deliveryMode'),
        locked: corrected.has('deliveryMode') || confirmed.has('deliveryMode')
    });
    const deliveryMode = lockedPreviousWins({
        previous: previousFields.delivery_mode,
        correctedByHuman: corrected.has('deliveryMode'),
        confirmedByCustomer: confirmed.has('deliveryMode'),
        source
    })
        ? { ...previousFields.delivery_mode, ignored_candidate: fieldSnapshot(deliveryCandidate) }
        : withHistory(deliveryCandidate, previousFields.delivery_mode);
    const resolvedDeliveryModeValue = deliveryMode.canonical_value || '';
    const address = textField({
        raw: draft.address_raw || draft.address || '',
        source,
        sourceMessageId,
        extractedAt,
        previous: previousFields.address,
        correctedByHuman: corrected.has('address'),
        confirmedByCustomer: confirmed.has('address'),
        required: resolvedDeliveryModeValue === 'home',
        metadata: {
            normalized_value: cleanSpaces(draft.address_raw || draft.address || ''),
            lat: null,
            lng: null,
            external_validation_pending: Boolean(draft.address_raw || draft.address)
        }
    });
    const reference = textField({
        raw: draft.reference_raw || draft.reference || '',
        source,
        sourceMessageId,
        extractedAt,
        previous: previousFields.reference,
        correctedByHuman: corrected.has('reference'),
        confirmedByCustomer: confirmed.has('reference'),
        metadata: {
            normalized_value: cleanSpaces(draft.reference_raw || draft.reference || ''),
            place_candidate: '',
            reference_lat: null,
            reference_lng: null
        }
    });
    const agency = resolveAuthorizedAgency({
        agencyRaw: draft.agencyName || draft.agency || (resolvedDeliveryModeValue === 'agency' ? draft.address || '' : ''),
        addressRaw: draft.address || '',
        deliveryMode: resolvedDeliveryModeValue,
        city: location.city.canonical_value,
        province: location.province.canonical_value,
        source,
        sourceMessageId,
        extractedAt,
        previous: previousFields.agency,
        correctedByHuman: corrected.has('agency'),
        confirmedByCustomer: confirmed.has('agency')
    });
    const fields = { name, phone, country, city: location.city, province: location.province, delivery_mode: deliveryMode, address, reference, agency };
    const conflicts = [
        ...(location.conflict ? [{ code: 'LOCATION_CONFLICT', fields: ['city', 'province'] }] : []),
        ...(agency.validation_status === CUSTOMER_DATA_STATUS.CONFLICT ? [{ code: 'AGENCY_LOCATION_CONFLICT', fields: ['agency', 'city', 'province'] }] : []),
        ...(name.validation_status === CUSTOMER_DATA_STATUS.CONFLICT ? [{ code: 'NAME_CONFLICT', fields: ['name'] }] : [])
    ];
    const gate = evaluateOrderDataGate({ fields, deliveryMode: resolvedDeliveryModeValue });
    const score = qualityScore({ fields, gate });
    const resolution = {
        version: CUSTOMER_DATA_RESOLUTION_VERSION,
        country: isEcuador ? 'EC' : '',
        fields,
        conflicts,
        qualityScore: score,
        orderDataReady: gate.orderDataReady,
        blockedReasons: gate.blockedReasons,
        nextRequiredField: gate.blockedReasons[0] || '',
        evaluatedAt: nowIso(extractedAt),
        externalGeoAdapter: {
            enabled: String(process.env.CUSTOMER_GEO_RESOLVER_ENABLED || 'false').toLowerCase() === 'true',
            used: false,
            required: false
        }
    };
    const resolvedDraft = {
        ...draft,
        name_raw: name.raw_value,
        name: name.canonical_value || name.display_value || name.raw_value,
        phone_raw: phone.raw_value,
        phone: phone.canonical_value || phone.display_value,
        country: isEcuador ? 'EC' : countryRaw,
        city_raw: location.city.raw_value,
        city: location.city.canonical_value || location.city.display_value || location.city.raw_value,
        province_raw: location.province.raw_value,
        province: location.province.canonical_value || location.province.display_value || location.province.raw_value,
        address_raw: address.raw_value,
        address: address.canonical_value || address.display_value,
        reference_raw: reference.raw_value,
        reference: reference.canonical_value || reference.display_value,
        deliveryMode: gate.deliveryMode,
        agencyId: gate.deliveryMode === 'agency' && agency.validation_status === CUSTOMER_DATA_STATUS.VERIFIED ? agency.agency_id || '' : '',
        agencyName: gate.deliveryMode === 'agency' ? agency.canonical_value || draft.agencyName || '' : '',
        dataQuality: {
            version: CUSTOMER_DATA_RESOLUTION_VERSION,
            score,
            orderDataReady: gate.orderDataReady,
            blockedReasons: gate.blockedReasons,
            statuses: Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, field.validation_status]))
        }
    };
    return { draft: resolvedDraft, resolution };
};

export const customerDataResolutionError = (resolution = {}) => {
    const error = new Error(`Dados do cliente ainda nao estao prontos: ${(resolution.blockedReasons || []).join(', ') || 'CUSTOMER_DATA_NOT_READY'}`);
    error.code = 'customer_data_not_ready';
    error.status = 422;
    error.reasons = resolution.blockedReasons || ['CUSTOMER_DATA_NOT_READY'];
    error.resolution = resolution;
    return error;
};

export const assertCustomerOrderDataReady = (resolution = {}) => {
    if (resolution?.orderDataReady === true) return true;
    throw customerDataResolutionError(resolution);
};
