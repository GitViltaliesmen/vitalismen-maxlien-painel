// PROJECT=VITALISMEN_EC. A persisted official inbound proves ownership; no OTP sender.
import { createTexUltraLinkedEntryV242, texLinkCodeFromMessageV242, texExistingEntryV242, texLinkedContactHoldV242 } from './texUltraLinkedEntryV242Service.js';
const digits = value => String(value || '').replace(/\D/g, '');

export function createTexUltraLinkedRuntimeV242({ capability, context, findInbound, now = Date.now, contactHold = async () => false } = {}) {
  let store;
  function current() { const cap = capability(); return cap?.isCurrent?.() === true ? cap : null; }
  function linkedStore() {
    const cap = capability(); if (!cap || !(cap.isCurrent?.() === true || cap.isStoreCurrent?.() === true)) throw Error('tex_link_unavailable');
    return store ||= createTexUltraLinkedEntryV242({ directory: cap.directory, officialPhone: cap.officialPhone,
      allowQa: phone => cap.allowQa?.(phone) === true, now, currentContactHold: phone => current() ? contactHold(phone) : Promise.resolve(false) });
  }
  async function proof({ state, sourceMessageId, sessionId, recovered = false }) {
    const cap = current(); if (!cap) return null;
    const scope = await context();
    if (!cap || recovered || sessionId !== 'zapi' || !sourceMessageId || typeof sourceMessageId !== 'string' || sourceMessageId.length > 250
      || scope?.method !== 'POST' || scope?.writeContext !== true || !/^\/api\/zapi\/webhook(?:\/(?:received|delivery))?$/.test(scope.path || '')) return null;
    const phone = digits(state.phoneDigits);
    if (!/^593[2-79]\d{8}$/.test(phone) && !(phone === '5515998038637' && cap.allowQa?.(phone) === true)) return null;
    const row = await findInbound({ _id: sourceMessageId, provider: 'zapi', sessionId: 'zapi', ownerPhoneDigits: cap.ownerPhone,
      isFromMe: false, peerPhone: phone });
    const at = Number(row?.timestamp) * (Number(row?.timestamp) < 1e12 ? 1000 : 1);
    if (!row || !Number.isFinite(at) || at < Date.parse(cap.activatedAt) || at > now() + 300000) return null;
    return phone;
  }
  return Object.freeze({ store: linkedStore,
    async confirmation(input) {
      const code = texLinkCodeFromMessageV242(input.inboundText);
      if (!code) return { handled: typeof input.inboundText === 'string' && /^Hola, quiero el tratamiento Tex Ultra\.\r?\nConfirmar chat:/.test(input.inboundText), confirmed: false };
      const phone = await proof(input);
      if (!phone) return { handled: true, confirmed: false };
      const result = await linkedStore().confirmFromOfficialInbound({ code, phone, inboundId: input.sourceMessageId, verifiedInbound: true,
        existingEntry: texExistingEntryV242(input.state) || input.state.metadata?.productKey === 'tex_ultra_ec'
          && Boolean(input.state.firstInboundText) && !/^Hola, quiero el tratamiento Tex Ultra\.\r?\nConfirmar chat:/.test(input.state.firstInboundText),
        blocked: texLinkedContactHoldV242(input.state, now()) });
      return { handled: true, ...result };
    },
    async observe(input) {
      const phone = await proof(input); if (!phone) return null;
      return linkedStore().observeWhatsapp({ phone, existingEntry: texExistingEntryV242(input.state),
        blocked: texLinkedContactHoldV242(input.state, now()), verifiedInbound: true });
    }
  });
}

const runtime = createTexUltraLinkedRuntimeV242({
  capability: () => globalThis.__VITALISMEN_EC_TEX_LINKED_ENTRY_V242,
  context: async () => (await import('./ecBotCoreRuntimeIntegrationV78Service.js')).currentEcBotCoreRuntimeContextV78(),
  findInbound: async selector => (await import('../models/Message.js')).default.findOne(selector).select({ _id: 1, timestamp: 1 }).lean(),
  contactHold: async phone => {
    const Contact = (await import('../models/ContactState.js')).default;
    const states = await Contact.find({ phoneDigits: phone, countryCode: 'EC', 'metadata.lastSessionId': 'zapi' })
      .select({ human: 1, tags: 1, blockedAutomatically: 1, 'metadata.optOut': 1, 'metadata.doNotContact': 1, 'metadata.operatorNoAutoResend': 1 })
      .sort({ updatedAt: -1 }).limit(12).lean();
    return !states.length || states.some(state => texLinkedContactHoldV242(state));
  }
});
export const texLinkedStoreV242 = () => runtime.store();
export const handleTexLinkConfirmationV242 = input => runtime.confirmation(input);
export async function applyTexLinkedOwnerV242(state, journey) {
  const linked = { journeyId: journey.id, firstChannel: journey.firstChannel };
  const fields = { 'metadata.texUltraLinkedEntryV242': linked };
  if (journey.firstChannel === 'web') fields['metadata.perAgentMemory.tex_ultra_ec.linkedWebEntryV242'] = { firstChannel: 'web', journeyId: journey.id };
  await state.updateOne({ $set: fields });
  const stagePath = 'metadata.perAgentMemory.tex_ultra_ec.stage';
  if (journey.firstChannel === 'web' && !state.metadata?.perAgentMemory?.tex_ultra_ec?.stage) {
    await state.constructor.updateOne({ _id: state._id, $or: [{ [stagePath]: { $exists: false } }, { [stagePath]: '' }, { [stagePath]: null }] }, { $set: { [stagePath]: 'awaiting_quantity' } });
  }
  state.metadata = { ...(state.metadata || {}), texUltraLinkedEntryV242: linked };
  if (journey.firstChannel === 'web') {
    const memories = state.metadata.perAgentMemory || {}, memory = memories.tex_ultra_ec || {};
    state.metadata.perAgentMemory = { ...memories, tex_ultra_ec: { ...memory,
      ...(!memory.stage ? { stage: 'awaiting_quantity' } : {}), linkedWebEntryV242: { firstChannel: 'web', journeyId: journey.id } } };
  }
}
export async function observeTexEntryOwnerV242(input) {
  if (!globalThis.__VITALISMEN_EC_TEX_LINKED_ENTRY_V242?.isCurrent?.()) return null;
  const journey = await runtime.observe(input);
  // An unverified/QA/legacy call cannot create a link; its existing guarded funnel remains untouched.
  if (!journey) return null;
  await applyTexLinkedOwnerV242(input.state, journey);
  return journey;
}
