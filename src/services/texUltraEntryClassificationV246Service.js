// PROJECT=VITALISMEN_EC. Published Tex entry and product-safe Vit Power invites only.
import { currentProductRouteForState } from './vslProductAssignmentService.js';
const normalized = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
export const isPublishedTexUltraEntryV246 = text => typeof text === 'string' && normalized(text) === 'hola quiero el tratamiento tex ultra';
export function suppressVitPowerInviteForTexV246(contact = {}) {
  const route = currentProductRouteForState(contact);
  // Current negotiation/operator choices outrank historical VSL interest.
  if (route.productKey) return route.productKey === 'tex_ultra_ec';
  return [contact.firstInboundText, contact.lastInboundText].some(text => typeof text === 'string' && isPublishedTexUltraEntryV246(text.replace(/\r\n?/g, '\n').split('\n')[0]));
}
