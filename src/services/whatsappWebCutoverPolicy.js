export const OFFICIAL_EC_WHATSAPP_E164 = '5515991418416';

export const WHATSAPP_WEB_CUTOVER_MODES = Object.freeze({
    HOLD_CURRENT: 'hold_current',
    WEB_TEST: 'web_test',
    WEB_PRIMARY: 'web_primary',
    ZAPI_ROLLBACK: 'zapi_rollback'
});

const VALID_MODES = new Set(Object.values(WHATSAPP_WEB_CUTOVER_MODES));
const PRODUCTION_APPROVAL = 'AUTHORIZE_EC_WEB_PRIMARY';
const digitsOnly = (value = '') => String(value || '').replace(/\D/g, '');

const parseExactPhoneList = (value = '') => [...new Set(
    String(value || '')
        .split(',')
        .map(digitsOnly)
        .filter(Boolean)
)];

const samePhone = (left = '', right = '') => {
    const a = digitsOnly(left);
    const b = digitsOnly(right);
    return Boolean(a && b && (a === b || a.endsWith(b) || b.endsWith(a)));
};

const connectedOfficialWebSession = (statuses = []) => (
    Array.isArray(statuses)
    && statuses.some((status) => (
        status?.isReady === true
        && String(status?.status || '') === 'connected'
        && samePhone(status?.ownPhoneDigits || status?.sessionId, OFFICIAL_EC_WHATSAPP_E164)
    ))
);

export const whatsappWebCutoverPolicy = (env = process.env) => {
    const requestedMode = String(env.WHATSAPP_WEB_CUTOVER_MODE || WHATSAPP_WEB_CUTOVER_MODES.HOLD_CURRENT)
        .trim()
        .toLowerCase();
    const invalidMode = !VALID_MODES.has(requestedMode);
    const productionApproved = String(env.WHATSAPP_WEB_CUTOVER_APPROVAL || '').trim() === PRODUCTION_APPROVAL;
    const productionModeRequested = requestedMode === WHATSAPP_WEB_CUTOVER_MODES.WEB_PRIMARY;
    const mode = invalidMode || (productionModeRequested && !productionApproved)
        ? WHATSAPP_WEB_CUTOVER_MODES.HOLD_CURRENT
        : requestedMode;
    const testRecipients = parseExactPhoneList(env.WHATSAPP_WEB_TEST_RECIPIENTS);
    const isTestRecipient = (phone = '') => testRecipients.includes(digitsOnly(phone));

    return {
        requestedMode,
        mode,
        invalidMode,
        productionApproved,
        officialDestination: OFFICIAL_EC_WHATSAPP_E164,
        testRecipientCount: testRecipients.length,
        isTestRecipient,
        canProcessWebInbound(phone = '', statuses = []) {
            if (!connectedOfficialWebSession(statuses)) return false;
            if (mode === WHATSAPP_WEB_CUTOVER_MODES.WEB_TEST) return isTestRecipient(phone);
            if (mode === WHATSAPP_WEB_CUTOVER_MODES.WEB_PRIMARY) return digitsOnly(phone).startsWith('593');
            return false;
        },
        canProcessZapiInbound(phone = '', statuses = []) {
            if (mode === WHATSAPP_WEB_CUTOVER_MODES.WEB_TEST) {
                return !connectedOfficialWebSession(statuses) || !isTestRecipient(phone);
            }
            if (mode === WHATSAPP_WEB_CUTOVER_MODES.WEB_PRIMARY) {
                return !connectedOfficialWebSession(statuses) || !digitsOnly(phone).startsWith('593');
            }
            return true;
        }
    };
};

export const assessWhatsAppWebCutoverReadiness = ({ env = process.env, statuses = [], zapiConnected = null } = {}) => {
    const policy = whatsappWebCutoverPolicy(env);
    const connectEnabled = String(env.WHATSAPP_CONNECT_ENABLED || 'true').toLowerCase() !== 'false';
    const officialSessionConnected = connectedOfficialWebSession(statuses);
    const webMode = [WHATSAPP_WEB_CUTOVER_MODES.WEB_TEST, WHATSAPP_WEB_CUTOVER_MODES.WEB_PRIMARY].includes(policy.mode);
    const checks = {
        requestedModeValid: !policy.invalidMode,
        productionApprovalPresent: policy.requestedMode !== WHATSAPP_WEB_CUTOVER_MODES.WEB_PRIMARY || policy.productionApproved,
        whatsappConnectEnabled: !webMode || connectEnabled,
        officialSessionConnected: !webMode || officialSessionConnected,
        testAllowlistPresent: policy.mode !== WHATSAPP_WEB_CUTOVER_MODES.WEB_TEST || policy.testRecipientCount > 0,
        zapiAvailableForRollback: zapiConnected === null || zapiConnected === true
    };
    return {
        requestedMode: policy.requestedMode,
        effectiveMode: policy.mode,
        officialDestination: policy.officialDestination,
        ready: Object.values(checks).every(Boolean),
        connectedOfficialWebSession: officialSessionConnected,
        testRecipientCount: policy.testRecipientCount,
        checks
    };
};
