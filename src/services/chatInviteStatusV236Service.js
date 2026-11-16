import { inviteKeyV232 } from './customerInvitesV232Service.js';
export const CHAT_LINK_V236 = /https:\/\/taviazen\.shop\/vitpower_2026g(?:[#?\s]|$)/i;
export async function readChatInviteStatusV236(phone, { contacts, messages, ledger }) {
    if (!/^593[2-79]\d{8}$/.test(phone || '')) return null;
    if (!await contacts.exists({ phoneDigits: phone, countryCode: 'EC', 'metadata.testOnly': { $ne: true } })) return null;
    if (!await messages.exists({ peerPhone: phone, provider: 'zapi', sessionId: 'zapi', ownerPhoneDigits: '5531971862958', isFromMe: false })) return null;
    const sent = !!await messages.exists({ peerPhone: phone, isFromMe: true, body: CHAT_LINK_V236 });
    const entry = await ledger.findById(inviteKeyV232(phone, 'CHAT_ACCESS')).select('state').lean();
    return { version: 236, readOnly: true, invited: sent || entry?.state === 'sent', pending: !!entry && entry.state !== 'sent', siteIdentityLinked: false };
}
export async function productionChatInviteStatusV236(phone) {
    const [{ default: contacts }, { default: messages }, { default: ledger }] = await Promise.all([
        import('../models/ContactState.js'), import('../models/Message.js'), import('../models/CustomerInviteDispatchV232.js')
    ]);
    return readChatInviteStatusV236(phone, { contacts, messages, ledger });
}
