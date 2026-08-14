(function exposeAgencyCatalog(root, factory) {
    const api = factory();
    root.VitalismenAgencyCatalog = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
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

    const titleCase = (value) => String(value || '')
        .replace(/_/g, ' ')
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part.length <= 2
            ? part
            : `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
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

    return Object.freeze({
        normalize,
        formatAgency,
        search,
        load,
        searchFromUrl
    });
});
