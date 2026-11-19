// PROJECT=VITALISMEN_EC. A private Tex chat invitation requires a persisted official WhatsApp inbound.
import { suppressVitPowerInviteForTexV246 } from './texUltraEntryClassificationV246Service.js';
export function texPostLeadPolicyV251() {
  const cap = globalThis.__VITALISMEN_EC_TEX_POSTLEAD_V251;
  try {
    const cutoff = cap?.activatedAt?.();
    return cap?.isCurrent?.() === true && Number.isFinite(cutoff) ? { enabled: true, required: cap.required === true, cutoff } : { enabled: false, required: cap?.required === true };
  } catch { return { enabled: false, required: cap?.required === true }; }
}
export function texPostLeadEligibleV251(contact, now = Date.now(), policy = texPostLeadPolicyV251()) {
  const created = +new Date(contact?.createdAt || NaN), inbound = +new Date(contact?.lastInboundAt || NaN);
  return policy.enabled && contact?.officialInboundVerified === true && contact.countryCode === 'EC'
    && /^593[2-79]\d{8}$/.test(contact.phoneDigits || '') && !contact.metadata?.testOnly
    && Number.isFinite(created) && created >= policy.cutoff && created <= now
    && Number.isFinite(inbound) && inbound >= policy.cutoff && inbound <= now
    && now - Math.max(inbound, +new Date(contact.lastOutboundAt || 0)) >= 600000
    && suppressVitPowerInviteForTexV246(contact);
}
export function buildTexPostLeadInviteV251({ name, url }) {
  const parsed = new URL(url);
  if (parsed.origin !== 'https://plusmen.shop' || parsed.pathname !== '/tex' || parsed.search || !/^#chat=[a-f0-9]{64}$/.test(parsed.hash)) throw Error('tex_link_invitation_invalid');
  const first = String(name || '').replace(/[\r\n\u0000-\u001f]/g, ' ').trim().split(/\s+/)[0].slice(0, 30);
  return 'Hola' + (first ? ', ' + first : '') + '. Ya recibimos tu mensaje por WhatsApp. 💬\n'
    + 'Si prefieres continuar por el chat de Tex Ultra, abre tu invitación personal:\n' + parsed.href
    + '\nSeguimos con tu atención sin repetir la presentación. Este acceso no confirma una compra.\n'
    + 'Si no deseas recibir estas invitaciones, responde STOP.';
}
