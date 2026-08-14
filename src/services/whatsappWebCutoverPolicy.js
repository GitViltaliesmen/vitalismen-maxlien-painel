export const OFFICIAL_VSL_WHATSAPP_E164 = '5515991418416';

export const WHATSAPP_WEB_CUTOVER_MODES = Object.freeze({
    HOLD_CURRENT: 'hold_current',
    WEB_TEST: 'web_test',
    WEB_PRIMARY: 'web_primary',
    WEB_ONLY: 'web_only',
    ZAPI_ROLLBACK: 'zapi_rollback'
});

const VALID_MODES = new Set(Object.values(WHATSAPP_WEB_CUTOVER_MODES));
const PRODUCTION_APPROVAL = 'AUTHORIZE_WEB_CUTOVER';
const digitsOnly = (value) => String(value || '').replace(/\D/g, '');

const parseExactPhoneList = (value = '') => [
    ...new Set(
        String(value || '')
            .split(',')
            .map((item) => digitsOnly(item))
            .filter(Boolean)
    )
];

const normalizedCountry = (value = '') => {
    const country = String(value || '').trim().toUpperCase();
    return ['EC', 'CO'].includes(country) ? country : '';
};

const countryFromPhone = (phone = '', countryHint = '') => {
    const hinted = normalizedCountry(countryHint);
    if (hinted) return hinted;
    const digits = digitsOnly(phone);
    if (digits.startsWith('593')) return 'EC';
    if (digits.startsWith('57')) return 'CO';
    return '';
};

export const whatsappWebCutoverPolicy = (env = process.env) => {
    const requestedMode = String(env.WHATSAPP_WEB_CUTOVER_MODE || WHATSAPP_WEB_CUTOVER_MODES.HOLD_CURRENT)
        .trim()
        .toLowerCase();
    const invalidMode = !VALID_MODES.has(requestedMode);
    const productionApproved = String(env.WHATSAPP_WEB_CUTOVER_APPROVAL || '').trim() === PRODUCTION_APPROVAL;
    const webCoEnabled = String(env.WHATSAPP_WEB_CO_ENABLED || '').toLowerCase() === 'true';
    const productionModeRequested = [
        WHATSAPP_WEB_CUTOVER_MODES.WEB_PRIMARY,
        WHATSAPP_WEB_CUTOVER_MODES.WEB_ONLY
    ].includes(requestedMode);
    const webOnlyBlocked = requestedMode === WHATSAPP_WEB_CUTOVER_MODES.WEB_ONLY
        && productionApproved
        && !webCoEnabled;
    const mode = invalidMode || (productionModeRequested && !productionApproved)
        ? WHATSAPP_WEB_CUTOVER_MODES.HOLD_CURRENT
        : (webOnlyBlocked ? WHATSAPP_WEB_CUTOVER_MODES.WEB_PRIMARY : requestedMode);
    const testRecipients = parseExactPhoneList(env.WHATSAPP_WEB_TEST_RECIPIENTS);
    const isTestRecipient = (phone = '') => {
        const normalized = digitsOnly(phone);
        return Boolean(normalized && testRecipients.includes(normalized));
    };
    const countryForPhone = (phone = '', countryHint = '') => countryFromPhone(phone, countryHint);

    const canProcessWebInbound = (phone = '', countryHint = '') => {
        if (mode === WHATSAPP_WEB_CUTOVER_MODES.WEB_TEST) return isTestRecipient(phone);
        if (mode === WHATSAPP_WEB_CUTOVER_MODES.WEB_PRIMARY) return countryForPhone(phone, countryHint) === 'EC';
        if (mode === WHATSAPP_WEB_CUTOVER_MODES.WEB_ONLY) return ['EC', 'CO'].includes(countryForPhone(phone, countryHint));
        return false;
    };

    const canProcessZapiInbound = (phone = '', countryHint = '') => {
        if ([WHATSAPP_WEB_CUTOVER_MODES.HOLD_CURRENT, WHATSAPP_WEB_CUTOVER_MODES.ZAPI_ROLLBACK].includes(mode)) return true;
        if (mode === WHATSAPP_WEB_CUTOVER_MODES.WEB_TEST) return !isTestRecipient(phone);
        if (mode === WHATSAPP_WEB_CUTOVER_MODES.WEB_PRIMARY) return countryForPhone(phone, countryHint) === 'CO';
        return false;
    };

    const shouldUseZapiOutbound = ({ phone = '', country = '', legacyEligible = false } = {}) => {
        if (!legacyEligible) return false;
        if ([WHATSAPP_WEB_CUTOVER_MODES.HOLD_CURRENT, WHATSAPP_WEB_CUTOVER_MODES.ZAPI_ROLLBACK].includes(mode)) return true;
        if (mode === WHATSAPP_WEB_CUTOVER_MODES.WEB_TEST) return !isTestRecipient(phone);
        if (mode === WHATSAPP_WEB_CUTOVER_MODES.WEB_PRIMARY) return countryForPhone(phone, country) === 'CO';
        return false;
    };

    const canAutoFailoverToZapi = (phone = '', countryHint = '') => {
        if ([WHATSAPP_WEB_CUTOVER_MODES.HOLD_CURRENT, WHATSAPP_WEB_CUTOVER_MODES.ZAPI_ROLLBACK].includes(mode)) return true;
        if (mode === WHATSAPP_WEB_CUTOVER_MODES.WEB_TEST) return !isTestRecipient(phone);
        if (mode === WHATSAPP_WEB_CUTOVER_MODES.WEB_PRIMARY) return countryForPhone(phone, countryHint) === 'CO';
        return false;
    };

    return {
        requestedMode,
        mode,
        invalidMode,
        productionApproved,
        productionModeRequested,
        webCoEnabled,
        webOnlyBlocked,
        officialDestination: OFFICIAL_VSL_WHATSAPP_E164,
        testRecipientCount: testRecipients.length,
        isTestRecipient,
        countryForPhone,
        canProcessWebInbound,
        canProcessZapiInbound,
        shouldUseZapiOutbound,
        canAutoFailoverToZapi
    };
};

const isConnectedSession = (status = {}) => status?.isReady === true && String(status?.status || '') === 'connected';

export const assessWhatsAppWebCutoverReadiness = ({ env = process.env, statuses = [], zapiConnected = null } = {}) => {
    const policy = whatsappWebCutoverPolicy(env);
    const whatsappConnectEnabled = String(env.WHATSAPP_CONNECT_ENABLED || 'true').toLowerCase() !== 'false';
    const connectedSessions = statuses.filter(isConnectedSession);
    const officialSessionConnected = connectedSessions.some((status) => (
        digitsOnly(status?.ownPhoneDigits) === OFFICIAL_VSL_WHATSAPP_E164
    ));
    const webRequired = [
        WHATSAPP_WEB_CUTOVER_MODES.WEB_TEST,
        WHATSAPP_WEB_CUTOVER_MODES.WEB_PRIMARY,
        WHATSAPP_WEB_CUTOVER_MODES.WEB_ONLY
    ].includes(policy.mode);
    const testAllowlistRequired = policy.mode === WHATSAPP_WEB_CUTOVER_MODES.WEB_TEST;
    const productionApprovalRequired = [
        WHATSAPP_WEB_CUTOVER_MODES.WEB_PRIMARY,
        WHATSAPP_WEB_CUTOVER_MODES.WEB_ONLY
    ].includes(policy.requestedMode);
    const zapiRollbackRequired = policy.mode !== WHATSAPP_WEB_CUTOVER_MODES.WEB_ONLY;
    const checks = {
        requestedModeValid: !policy.invalidMode,
        productionApprovalPresent: !productionApprovalRequired || policy.productionApproved,
        colombiaWebMigrationApproved: policy.requestedMode !== WHATSAPP_WEB_CUTOVER_MODES.WEB_ONLY || policy.webCoEnabled,
        whatsappConnectEnabled: !webRequired || whatsappConnectEnabled,
        officialSessionConnected: !webRequired || officialSessionConnected,
        testAllowlistPresent: !testAllowlistRequired || policy.testRecipientCount > 0,
        zapiAvailableForRollback: !zapiRollbackRequired || zapiConnected === null || zapiConnected === true
    };
    return {
        requestedMode: policy.requestedMode,
        effectiveMode: policy.mode,
        officialDestination: policy.officialDestination,
        ready: Object.values(checks).every(Boolean),
        connectedSessionCount: connectedSessions.length,
        testRecipientCount: policy.testRecipientCount,
        checks
    };
};
