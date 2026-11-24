const digits = value => String(value || '').replace(/\D/g, '');

const LINKED_DEVICE_SURFACES = new Set([
    'baileys_dispatcher_inbound',
    'agent_router_inbound',
    'outbound_guard_text'
]);

export const linkedDeviceCanaryRecipientAllowed = ({ phoneOrJid = '', surface = '',
    transport = '', authorityCurrent = false } = {}) => (
    transport === 'baileys_text'
    && authorityCurrent === true
    && LINKED_DEVICE_SURFACES.has(surface)
    && /^593\d{9}$/.test(digits(phoneOrJid))
);

export const linkedDeviceAutoReplyAllowed = ({ identifiers = [], context = null,
    transport = '', authorityCurrent = false } = {}) => {
    const proof = context?.baileysInbound;
    const sender = digits(proof?.senderPhoneDigits);
    return transport === 'baileys_text'
        && authorityCurrent === true
        && context?.path === '/internal/whatsapp/baileys-inbound'
        && context?.method === 'SOCKET'
        && proof?.verified === true
        && /^593\d{9}$/.test(sender)
        && identifiers.some(value => digits(value) === sender);
};
