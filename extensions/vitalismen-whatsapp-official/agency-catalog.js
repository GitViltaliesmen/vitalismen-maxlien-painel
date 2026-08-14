(function exposeAgencyCatalog(root, factory) {
    const normalizer = root.VitalismenCustomerDataNormalizer
        || (typeof module !== 'undefined' && module.exports ? require('./customer-data-normalizer.js') : null);
    const api = factory(normalizer);
    root.VitalismenAgencyCatalog = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, (customerDataNormalizer) => {
    'use strict';

    let catalogPromise = null;

    const normalize = (value) => String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[_/.-]+/g, ' ')
        .replace(/[^A-Z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const titleCase = (value) => customerDataNormalizer?.formatLocationName
        ? customerDataNormalizer.formatLocationName(value)
        : String(value || '')
            .replace(/_/g, ' ')
            .toLowerCase()
            .split(/\s+/)
            .filter(Boolean)
            .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
            .join(' ');

    const formatAgency = (row = {}) => ({
        name: titleCase(row.name || row.nome),
        address: String(row.address || row.endereco || '').trim(),
        city: titleCase(row.city || row.ciudad),
        province: titleCase(row.province || row.provincia),
        sector: titleCase(row.sector)
    });

    const includesLocation = (candidate, requested) => (
        !requested
        || (Boolean(candidate) && (
            candidate === requested
        || candidate.includes(requested)
        || requested.includes(candidate)
        ))
    );

    const queryScore = (agency, query) => {
        if (!query) return 0;
        const name = normalize(agency.name);
        const address = normalize(agency.address);
        const sector = normalize(agency.sector);
        const city = normalize(agency.city);
        const province = normalize(agency.province);
        const searchable = `${name} ${address} ${sector} ${city} ${province}`;
        const tokens = query.split(/\s+/).filter((token) => token.length >= 3);
        let score = tokens.filter((token) => searchable.includes(token)).length * 10;
        if (name.includes(query)) score += 50;
        if (address.includes(query)) score += 40;
        if (sector.includes(query)) score += 20;
        if (city === query) score += 100;
        if (province === query) score += 30;
        return score;
    };

    const search = (rows = [], {
        city = '',
        province = '',
        query = '',
        limit = 100
    } = {}) => {
        const normalizedCity = normalize(city);
        const normalizedProvince = normalize(province);
        const normalizedQuery = normalize(query);
        const formatted = rows.map(formatAgency).filter((agency) => agency.name);

        let candidates = formatted;
        if (normalizedCity) {
            const exactCityMatches = candidates.filter((agency) => (
                normalize(agency.city) === normalizedCity
            ));
            const partialCityMatches = candidates.filter((agency) => (
                includesLocation(normalize(agency.city), normalizedCity)
            ));
            if (exactCityMatches.length) candidates = exactCityMatches;
            else if (partialCityMatches.length) candidates = partialCityMatches;
            else return [];
        }
        if (normalizedProvince) {
            const exactProvinceMatches = candidates.filter((agency) => (
                normalize(agency.province) === normalizedProvince
            ));
            const partialProvinceMatches = candidates.filter((agency) => (
                includesLocation(normalize(agency.province), normalizedProvince)
            ));
            if (exactProvinceMatches.length) candidates = exactProvinceMatches;
            else if (partialProvinceMatches.length) candidates = partialProvinceMatches;
            else return [];
        }

        const scored = candidates.map((agency) => ({
            agency,
            score: queryScore(agency, normalizedQuery)
        }));
        const scopedByLocation = Boolean(normalizedCity || normalizedProvince);
        const relevant = normalizedQuery && !scopedByLocation
            ? scored.filter((item) => item.score > 0)
            : scored;
        const max = Math.min(Math.max(Number(limit) || 100, 1), 500);

        return relevant
            .sort((a, b) => b.score - a.score || a.agency.name.localeCompare(b.agency.name))
            .slice(0, max)
            .map((item) => item.agency);
    };

    const resolveLocation = (rows = [], { city = '', province = '' } = {}) => {
        const normalizedCity = normalize(city);
        const normalizedProvince = normalize(province);
        const formatted = rows.map(formatAgency).filter((agency) => agency.city || agency.province);
        if (!normalizedCity && !normalizedProvince) {
            return { matched: false, ambiguous: false, city: '', province: '', inferredProvince: false };
        }

        let candidates = formatted;
        if (normalizedCity) {
            const exact = candidates.filter((agency) => normalize(agency.city) === normalizedCity);
            const parentheticalAlias = candidates.filter((agency) => (
                normalize(String(agency.city || '').replace(/\s*\([^)]*\)\s*$/u, '')) === normalizedCity
            ));
            candidates = exact.length ? exact : parentheticalAlias;
            if (!candidates.length) {
                return {
                    matched: false,
                    ambiguous: false,
                    city: titleCase(city),
                    province: titleCase(province),
                    inferredProvince: false
                };
            }
        }
        if (normalizedProvince) {
            const exact = candidates.filter((agency) => normalize(agency.province) === normalizedProvince);
            candidates = exact;
            if (!candidates.length) {
                return {
                    matched: false,
                    ambiguous: false,
                    city: titleCase(city),
                    province: titleCase(province),
                    inferredProvince: false
                };
            }
        }

        const locations = new Map();
        candidates.forEach((agency) => {
            const key = `${normalize(agency.city)}|${normalize(agency.province)}`;
            if (!locations.has(key)) locations.set(key, agency);
        });
        if (normalizedCity && locations.size !== 1) {
            return {
                matched: false,
                ambiguous: locations.size > 1,
                city: titleCase(city),
                province: titleCase(province),
                inferredProvince: false
            };
        }

        const provinces = new Map();
        candidates.forEach((agency) => {
            const key = normalize(agency.province);
            if (key && !provinces.has(key)) provinces.set(key, agency.province);
        });
        if (!normalizedCity && normalizedProvince && provinces.size !== 1) {
            return {
                matched: false,
                ambiguous: provinces.size > 1,
                city: '',
                province: titleCase(province),
                inferredProvince: false
            };
        }

        const selected = normalizedCity ? [...locations.values()][0] : candidates[0];
        return {
            matched: Boolean(selected),
            ambiguous: false,
            city: normalizedCity ? selected?.city || titleCase(city) : '',
            province: normalizedProvince
                ? [...provinces.values()][0] || selected?.province || titleCase(province)
                : selected?.province || titleCase(province),
            inferredProvince: Boolean(normalizedCity && !normalizedProvince && selected?.province)
        };
    };

    const load = async (url) => {
        if (!catalogPromise) {
            catalogPromise = fetch(url, { cache: 'no-store' }).then(async (response) => {
                if (!response.ok) throw new Error(`Catálogo de agências indisponível (${response.status})`);
                const rows = await response.json();
                if (!Array.isArray(rows)) throw new Error('Catálogo de agências inválido');
                return rows;
            }).catch((error) => {
                catalogPromise = null;
                throw error;
            });
        }
        return catalogPromise;
    };

    const searchFromUrl = async (url, criteria = {}) => search(
        await load(url),
        criteria
    );
    const resolveLocationFromUrl = async (url, criteria = {}) => resolveLocation(
        await load(url),
        criteria
    );

    return Object.freeze({
        normalize,
        formatAgency,
        resolveLocation,
        search,
        load,
        searchFromUrl,
        resolveLocationFromUrl
    });
});
