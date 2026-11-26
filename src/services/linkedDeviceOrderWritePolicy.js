import { ecChannelOwnerDecision } from '../whatsapp/ecPrimaryChannelBinding.js';

const digits = value => String(value || '').replace(/\D/g, '');

export const linkedDeviceOrderWriteAllowed = ({ context = null, collection = '', method = '', binding } = {}) => {
    const proof = context?.baileysInbound;
    let ownerAllowed = false;
    try {
        const decision = ecChannelOwnerDecision({ sessionId: proof?.sessionId,
            ownerPhoneDigits: proof?.ownerPhoneDigits,
            peerPhoneDigits: proof?.senderPhoneDigits, binding });
        ownerAllowed = decision.allowed === true
            && ['active_channel', 'legacy_owner_policy'].includes(decision.reason);
    } catch { return false; }
    return context?.profile === 'EC_BOT_CORE_OPERATIONAL'
        && context?.writeContext === true
        && context?.method === 'SOCKET'
        && context?.path === '/internal/whatsapp/baileys-inbound'
        && proof?.verified === true
        && typeof proof.messageId === 'string' && proof.messageId.length > 0
        && typeof proof.sessionId === 'string' && proof.sessionId.length > 0
        && ownerAllowed
        && /^593\d{9}$/.test(digits(proof.senderPhoneDigits))
        && String(collection).toLowerCase() === 'orders'
        && ['insertOne', 'updateOne'].includes(String(method));
};
