// PROJECT=VITALISMEN_EC. Exact published Tex entry and requested greeting only.
import { isPublishedTexUltraEntryV246 } from './texUltraEntryClassificationV246Service.js';

export function texEntryV249Current() {
    try { return globalThis.__VITALISMEN_EC_TEX_ENTRY_V249?.isCurrent?.() === true; }
    catch (_) { return false; }
}

export function preferTexPublishedEntryV249({ text = '', state = {}, sourceMessageId = '', env = process.env } = {}) {
    if (!texEntryV249Current() || env.TEX_ULTRA_FUNNEL_ENABLED !== 'true'
        || typeof sourceMessageId !== 'string' || !sourceMessageId
        || typeof text !== 'string' || /[?¿]/.test(text) || !isPublishedTexUltraEntryV246(text)
        || state.countryCode !== 'EC' || state.human?.mode === 'manual') return false;
    const metadata = state.metadata || {};
    const lock = metadata.productRouteLock;
    if (lock?.active === true && lock.productKey && lock.productKey !== 'tex_ultra_ec') return false;
    const current = metadata.customerDraft?.negotiationProductKey || metadata.customerDraft?.productKey || metadata.productKey || metadata.vslProductKey;
    return current === 'tex_ultra_ec' && metadata.lastSessionId === 'zapi';
}

export function texGreetingFirstNameV249(value = '') {
    if (typeof value !== 'string') return '';
    const clean = value.normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
    if (clean.length > 80) return '';
    const first = clean.split(' ')[0];
    if (!first || first.length < 2 || first.length > 30 || !/^[\p{L}\p{M}]+(?:['’\-][\p{L}\p{M}]+)*$/u.test(first)) return '';
    const normalized = first.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (['cliente','customer','entrada','desconocido','desconocida','unknown','null','undefined','hola','precio','stop','ano','anos','nombre'].includes(normalized)) return '';
    return first;
}

export function buildTexGreetingV249({ name = '', salutation = '' } = {}) {
    const allowed = ['buenos días', 'buenas tardes', 'buenas noches'];
    if (!allowed.includes(salutation)) throw Error('tex_greeting_period_required');
    const first = texGreetingFirstNameV249(name);
    const period = salutation.charAt(0).toUpperCase() + salutation.slice(1);
    return `¡Hola! ¡${period}${first ? ', ' + first : ''}! Soy Ana Lopez, del equipo de la Dra. María Fernandes. Gracias por tu interés en Tex Ultra. Estoy aquí para ayudarte y aclarar tus dudas. Te comparto una breve presentación y seguimos conversando.`;
}

export function isProcessedTexEntryDuplicateV249({ text = '', state = {}, messageId = '', phone = '', storedMessage = null } = {}) {
    const session = state.metadata?.lastSessionId;
    if (!['zapi', '5531971862958'].includes(session)) return false;
    const officialInboundState = { ...state, metadata: { ...state.metadata, lastSessionId: 'zapi' } };
    if (!preferTexPublishedEntryV249({text,state:officialInboundState,sourceMessageId:messageId})
        || state.phoneDigits !== phone || !/^593[2-79]\d{8}$/.test(phone)
        || !Array.isArray(state.metadata?.processedInboundMessageIds)
        || !state.metadata.processedInboundMessageIds.includes(messageId)) return false;
    return storedMessage?._id === messageId && storedMessage.peerPhone === phone
        && storedMessage.sessionId === 'zapi' && storedMessage.provider === 'zapi'
        && storedMessage.ownerPhoneDigits === '5531971862958'
        && storedMessage.isFromMe === false && storedMessage.body === text
        && storedMessage.providerMessageId === messageId;
}
