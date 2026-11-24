const digits = value => String(value || '').replace(/\D/g, '');

export const linkedDeviceOrderWriteAllowed = ({ context = null, collection = '', method = '' } = {}) => {
    const proof = context?.baileysInbound;
    return context?.profile === 'EC_BOT_CORE_OPERATIONAL'
        && context?.writeContext === true
        && context?.method === 'SOCKET'
        && context?.path === '/internal/whatsapp/baileys-inbound'
        && proof?.verified === true
        && typeof proof.messageId === 'string' && proof.messageId.length > 0
        && typeof proof.sessionId === 'string' && proof.sessionId.length > 0
        && ['5531971862958', '553171862958'].includes(digits(proof.ownerPhoneDigits))
        && /^593\d{9}$/.test(digits(proof.senderPhoneDigits))
        && String(collection).toLowerCase() === 'orders'
        && ['insertOne', 'updateOne'].includes(String(method));
};
