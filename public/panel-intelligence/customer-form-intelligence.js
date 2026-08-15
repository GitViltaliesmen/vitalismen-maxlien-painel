(function exposeCustomerFormIntelligence(root, factory) {
    const api = factory(
        root.VitalismenCustomerDataNormalizer,
        root.VitalismenConversationData,
        root.VitalismenAgencyCatalog
    );
    root.VitalismenCustomerFormIntelligence = api;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(
            require('./customer-data-normalizer.js'),
            require('./conversation-data-extractor.js'),
            require('./agency-catalog.js')
        );
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, (
    customerDataNormalizer,
    conversationData,
    agencyCatalog
) => {
    'use strict';

    const NAME_BLOCKED_WORDS = new Set([
        'agencia', 'botella', 'botellas', 'calle', 'canton', 'cedula', 'ci',
        'ciudad', 'cliente', 'direccion', 'dolares', 'frasco', 'frascos',
        'nombre', 'pedido', 'provincia', 'referencia', 'servientrega',
        'telefono', 'tratamiento', 'usd', 'whatsapp'
    ]);

    const normalizeWords = (value) => String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('es-EC')
        .match(/[a-z]+/g) || [];

    const confidentPersonName = (value) => {
        const name = customerDataNormalizer?.formatPersonName
            ? customerDataNormalizer.formatPersonName(value)
            : String(value || '').replace(/\s+/g, ' ').trim();
        if (name.length < 5 || name.length > 70) return '';
        if (!/^[\p{L}][\p{L}\s.'’-]*$/u.test(name)) return '';
        const words = normalizeWords(name);
        if (words.length < 2 || words.length > 7) return '';
        if (words.some((word) => NAME_BLOCKED_WORDS.has(word))) return '';
        return name;
    };

    const extractCustomerData = (messages = []) => {
        const extracted = conversationData?.extract ? conversationData.extract(messages) : {};
        const result = { ...extracted };
        const name = confidentPersonName(result.name);
        if (name) result.name = name;
        else delete result.name;
        return customerDataNormalizer?.normalizeCustomerData
            ? customerDataNormalizer.normalizeCustomerData(result)
            : result;
    };

    const agencySearchableText = (agency = {}) => agencyCatalog.normalize([
        agency.name,
        agency.address,
        agency.sector,
        agency.city,
        agency.province
    ].filter(Boolean).join(' '));

    const selectAutomaticAgency = (rows = [], { query = '' } = {}) => {
        const normalizedQuery = agencyCatalog?.normalize ? agencyCatalog.normalize(query) : '';
        if (normalizedQuery.length < 3) return { matched: false, ambiguous: false, agency: null, reason: 'short_query' };
        const agencies = rows.map((row) => agencyCatalog.formatAgency(row)).filter((agency) => agency.name);
        const exact = agencies.filter((agency) => [agency.name, agency.address, agency.sector]
            .some((value) => agencyCatalog.normalize(value) === normalizedQuery));
        if (exact.length === 1) return { matched: true, ambiguous: false, agency: exact[0], reason: 'unique_exact' };
        if (exact.length > 1) return { matched: false, ambiguous: true, agency: null, reason: 'ambiguous_exact' };

        const tokens = normalizedQuery.split(/\s+/).filter((token) => token.length >= 3);
        const matching = agencies.filter((agency) => {
            const searchable = agencySearchableText(agency);
            return tokens.length > 0 && tokens.every((token) => searchable.includes(token));
        });
        if (matching.length === 1) return { matched: true, ambiguous: false, agency: matching[0], reason: 'unique_reference' };
        if (matching.length > 1) return { matched: false, ambiguous: true, agency: null, reason: 'ambiguous_reference' };
        if (agencies.length === 1) return { matched: true, ambiguous: false, agency: agencies[0], reason: 'single_result' };
        return { matched: false, ambiguous: false, agency: null, reason: 'no_unique_match' };
    };

    const resolveAgencyLocation = (rows = [], { city = '', province = '' } = {}) => (
        agencyCatalog?.resolveLocation
            ? agencyCatalog.resolveLocation(rows, { city, province })
            : { matched: false, ambiguous: false, city: '', province: '', inferredProvince: false }
    );

    const TEX_ULTRA_TOTALS = Object.freeze({
        '1': '35.99',
        '2': '70.00',
        '3': '80.99',
        '6': '147.99'
    });

    const approvedTotal = ({ productKey = '', quantity = '' } = {}) => (
        String(productKey || '').toLocaleLowerCase('es-EC') === 'tex_ultra_ec'
            ? TEX_ULTRA_TOTALS[String(quantity || '').trim()] || ''
            : ''
    );

    return Object.freeze({
        confidentPersonName,
        extractCustomerData,
        selectAutomaticAgency,
        resolveAgencyLocation,
        approvedTotal
    });
});
