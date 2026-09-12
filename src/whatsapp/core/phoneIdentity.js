const digits = (value) => String(value || '').replace(/\D/g, '');

export const isBrazilNinthDigitVariant = (canonical, providerBound) => {
    const current = digits(canonical);
    const bound = digits(providerBound);
    return current.length === 13
        && bound.length === 12
        && current.startsWith('55')
        && bound.startsWith('55')
        && current.slice(0, 4) === bound.slice(0, 4)
        && current[4] === '9'
        && `${current.slice(0, 4)}${current.slice(5)}` === bound;
};

export const provePhoneIdentityEquivalence = ({ canonicalPhone, providerBoundPhone, evidence = {} }) => {
    const canonical = digits(canonicalPhone);
    const providerBound = digits(providerBoundPhone);
    const numericMatch = canonical === providerBound || isBrazilNinthDigitVariant(canonical, providerBound);
    const evidencePass = evidence.providerDeviceObserved === true
        && evidence.canonicalRoutingObserved === true
        && Number(evidence.contactStateObservedCanonical || 0) > 0
        && Number(evidence.contactStateObservedProviderBound || 0) > 0
        && String(evidence.messageProvider || '').toUpperCase() === 'ZAPI';
    return Object.freeze({
        canonicalPhone: canonical,
        providerBoundPhone: providerBound,
        equivalent: numericMatch && evidencePass,
        status: numericMatch && evidencePass ? 'PROVEN' : 'UNPROVEN',
        method: canonical === providerBound ? 'EXACT' : (numericMatch ? 'BR_NINTH_DIGIT_WITH_OPERATIONAL_EVIDENCE' : 'NONE')
    });
};
