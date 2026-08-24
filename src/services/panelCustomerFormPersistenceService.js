import {
    authorizedAgencyOrderAddress,
    CUSTOMER_DATA_STATUS
} from './customerDataResolutionService.js';

const digitsOnly = (value = '') => String(value || '').replace(/\D/g, '');

export const panelConversationPhone = ({ state = {}, requestPhone = '' } = {}) => {
    const chatId = String(state.chatId || '');
    const chatDigits = digitsOnly(chatId);
    const candidates = [
        state.metadata?.lastSenderPn,
        state.phoneDigits,
        !chatId.endsWith('@lid') ? chatDigits : '',
        requestPhone
    ];
    const digits = candidates.map(digitsOnly).find((value) => value.length >= 9) || '';
    return digits ? `+${digits}` : '';
};

export const protectPanelCustomerPhone = ({ inputPhone = '', state = {}, requestPhone = '' } = {}) => {
    const stablePhone = panelConversationPhone({ state, requestPhone });
    const typedDigits = digitsOnly(inputPhone);
    const stableDigits = digitsOnly(stablePhone);
    if (!stableDigits) {
        return Object.freeze({ phone: String(inputPhone || '').trim(), mismatch: false, restored: false });
    }
    if (!typedDigits) return Object.freeze({ phone: stablePhone, mismatch: false, restored: true });
    const length = Math.min(9, typedDigits.length, stableDigits.length);
    const equivalent = typedDigits.slice(-length) === stableDigits.slice(-length);
    return Object.freeze({
        phone: stablePhone,
        mismatch: !equivalent,
        restored: String(inputPhone || '').trim() !== stablePhone
    });
};

export const materializePanelAgencyAddress = ({ draft = {}, resolution = {} } = {}) => {
    if (String(draft.deliveryMode || '') !== 'agency') return { ...draft };
    const agency = resolution?.fields?.agency || {};
    if (
        agency.validation_status !== CUSTOMER_DATA_STATUS.VERIFIED
        || !agency.agency_id
        || !agency.name
        || !agency.address
    ) return { ...draft };
    const address = authorizedAgencyOrderAddress({
        agencyName: agency.name,
        agencyAddress: agency.address,
        city: draft.city || agency.city || '',
        province: draft.province || agency.province || ''
    });
    return {
        ...draft,
        address,
        address_raw: '',
        reference: '',
        reference_raw: '',
        agencyId: agency.agency_id,
        agencyName: agency.name,
        agencyAddress: agency.address
    };
};
