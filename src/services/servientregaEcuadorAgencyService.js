import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AGENCY_FILE = path.join(__dirname, '..', 'data', 'agencia_LISTA.json');

let cachedAgencies = null;

export const normalizeAgencyText = (value) => String(value || '')
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

const overlapScore = (sourceTokens, targetText, weight = 8) => {
    if (!sourceTokens.length || !targetText) return 0;
    const target = normalizeAgencyText(targetText);
    const hits = sourceTokens.filter((token) => target.includes(token)).length;
    return hits * weight;
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

export const findServientregaEcuadorAgencies = ({
    city = '',
    province = '',
    query = '',
    limit = 3
} = {}) => {
    const agencies = loadServientregaEcuadorAgencies();
    const normalizedCity = normalizeAgencyText(city);
    const normalizedProvince = normalizeAgencyText(province);
    const normalizedQuery = normalizeAgencyText(query);
    const queryTokens = tokensFor(query);

    const scored = agencies.map((agency) => {
        let score = 0;
        const cityMatched = Boolean(normalizedCity && (
            agency.normalizedCity === normalizedCity
            || agency.normalizedCity.includes(normalizedCity)
            || normalizedCity.includes(agency.normalizedCity)
        ));
        const provinceMatched = Boolean(normalizedProvince && (
            agency.normalizedProvince === normalizedProvince
            || agency.normalizedProvince.includes(normalizedProvince)
            || normalizedProvince.includes(agency.normalizedProvince)
        ));
        const queryNameMatched = Boolean(normalizedQuery && (
            agency.normalizedName.includes(normalizedQuery)
            || normalizedQuery.includes(agency.normalizedName)
        ));
        const queryAddressMatched = Boolean(normalizedQuery && (
            agency.normalizedAddress.includes(normalizedQuery)
            || normalizedQuery.includes(agency.normalizedAddress)
        ));
        const queryCityMatched = Boolean(normalizedQuery && agency.normalizedCity && (
            agency.normalizedCity.includes(normalizedQuery)
            || normalizedQuery.includes(agency.normalizedCity)
        ));
        const queryProvinceMatched = Boolean(normalizedQuery && agency.normalizedProvince && (
            agency.normalizedProvince.includes(normalizedQuery)
            || normalizedQuery.includes(agency.normalizedProvince)
        ));
        const querySectorMatched = Boolean(normalizedQuery && agency.normalizedSector && (
            agency.normalizedSector.includes(normalizedQuery)
            || normalizedQuery.includes(agency.normalizedSector)
        ));

        if (cityMatched) score += 45;
        if (provinceMatched) score += 30;
        if (normalizedQuery) {
            if (queryNameMatched) score += 45;
            if (queryAddressMatched) score += 35;
            if (queryCityMatched) score += 42;
            if (queryProvinceMatched) score += 22;
            if (querySectorMatched) score += 12;
            score += overlapScore(queryTokens, `${agency.normalizedName} ${agency.normalizedAddress} ${agency.normalizedSector} ${agency.normalizedCity} ${agency.normalizedProvince}`, 9);
        }

        return {
            agency,
            score,
            cityMatched,
            provinceMatched,
            queryNameMatched,
            queryAddressMatched,
            queryCityMatched,
            queryProvinceMatched,
            querySectorMatched
        };
    })
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score || a.agency.name.localeCompare(b.agency.name));

    return scored.slice(0, limit).map((item) => ({
        ...formatServientregaAgency(item.agency),
        score: item.score,
        cityMatched: item.cityMatched,
        provinceMatched: item.provinceMatched,
        queryNameMatched: item.queryNameMatched,
        queryAddressMatched: item.queryAddressMatched,
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
    const hasSpecificMatch = Boolean(best && (
        best.queryNameMatched
        || best.queryAddressMatched
        || (best.querySectorMatched && (best.cityMatched || best.queryCityMatched || best.provinceMatched || best.queryProvinceMatched))
    ));
    const confident = Boolean(best && (
        (hasSpecificMatch && best.score >= 75)
        || (suggestions.length === 1 && best.score >= 60 && (best.cityMatched || best.queryCityMatched || best.provinceMatched || best.queryProvinceMatched))
    ));

    return {
        best,
        confident,
        suggestions
    };
};
