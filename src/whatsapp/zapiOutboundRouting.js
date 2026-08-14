import { zapiConfig } from '../services/zapiClient.js';

const digitsOnly = (value) => String(value || '').replace(/\D/g, '');

const parsePhoneList = (...values) => [
    ...new Set(
        values
            .flatMap((value) => String(value || '').split(','))
            .map((item) => digitsOnly(item))
            .filter(Boolean)
    )
];

const isSamePhone = (left, right) => {
    const a = digitsOnly(left);
    const b = digitsOnly(right);
    if (!a || !b) return false;
    return a === b || a.startsWith(b) || b.startsWith(a);
};

const looksLikeZapiRoutedPhone = (value = '') => /^593\d{8,13}$/.test(digitsOnly(value));

const zapiOperationalTestRecipients = () => parsePhoneList(
    process.env.WHATSAPP_TEST_ALLOWED_RECIPIENTS,
    process.env.WHATSAPP_PANEL_OPERATIONAL_NUMBERS,
    process.env.WHATSAPP_PRIORITY_TEST_PHONES,
    process.env.WHATSAPP_INBOUND_TEST_ONLY_RECIPIENTS
);

const isZapiOperationalTestRecipient = (phone = '') => {
    const digits = digitsOnly(phone);
    return Boolean(digits && zapiOperationalTestRecipients().some((allowed) => isSamePhone(digits, allowed)));
};

export const shouldUseZapiForOutbound = ({ targetJid, recipientDigits = '', options = {} } = {}) => {
    if (!zapiConfig().enabled) return false;
    const phone = digitsOnly(recipientDigits) || digitsOnly(targetJid);
    if (!looksLikeZapiRoutedPhone(phone) && !isZapiOperationalTestRecipient(phone)) return false;
    const country = String(options.country || '').toUpperCase();
    return options.provider === 'zapi'
        || options.sessionId === 'zapi'
        || options.sendMode === 'manual_panel'
        || country === 'EC';
};

export const zapiPhoneForOutbound = ({ targetJid, recipientDigits = '' } = {}) => (
    digitsOnly(recipientDigits) || digitsOnly(targetJid)
);
