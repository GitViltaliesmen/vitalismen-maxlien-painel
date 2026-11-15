// VITALISMEN_EC: scoped implementation candidate. No implicit production activation.
import { createHash, randomBytes } from 'node:crypto';
import { isIP } from 'node:net';

export const SCOPE = Object.freeze({
  dataset: '28298613626504767', origin: 'https://taviazen.shop',
  url: 'https://taviazen.shop/vitpower_2026g', product: 'vit_power_ec', flow: 'vitpower_2026g',
});
export const BROWSER_EVENTS = Object.freeze(['PageView', 'ViewContent', 'CtaClick', 'Contact']);
const text = (x, max = 512) => typeof x === 'string' ? x.trim().slice(0, max) : '';
const hash = x => createHash('sha256').update(x).digest('hex');
const digits = x => String(x || '').replace(/\D/g, '');
const validId = x => /^[a-f0-9-]{32,36}$/i.test(String(x || ''));
const cookie = x => /^fb\.\d\.\d{13}\.[A-Za-z0-9_.-]{1,512}$/.test(String(x || ''));
const reject = reason => ({ ok: false, reason });
const attributionKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  'campaign_id', 'adset_id', 'ad_id', 'placement'];

export function normalizeCapture(body, context) {
  if (context.origin !== SCOPE.origin || context.sourceUrl !== SCOPE.url) return reject('origin_scope');
  if (context.privacyAllowed !== true || body.consent !== true || body.qa === true) return reject('consent_or_qa');
  if (!context.trustedClientContext || !isIP(context.ip || '') || !text(context.userAgent, 1024))
    return reject('verified_client_context_required');
  if (!validId(body.visitId) || !validId(body.visitorId)) return reject('invalid_visitor_identity');
  const now = context.now instanceof Date ? context.now : new Date();
  const tracking = {
    measurementVersion: 213, browserPixelId: SCOPE.dataset, productKey: SCOPE.product,
    funnel: SCOPE.flow, sourceUrl: SCOPE.url, ip: context.ip, userAgent: text(context.userAgent, 1024),
    clientContextSource: 'vitpower_verified_public_transport_v213',
    external_id: body.visitorId, attributionCapturedAt: now,
    marketingConsent: true,
  };
  const clickId = text(body.fbclid);
  if (/^[A-Za-z0-9_.-]{1,512}$/.test(clickId)) tracking.fbclid = clickId;
  if (cookie(body.fbc)) tracking.fbc = body.fbc;
  if (tracking.fbclid && (!tracking.fbc || !tracking.fbc.endsWith('.' + tracking.fbclid)))
    tracking.fbc = `fb.1.${now.getTime()}.${tracking.fbclid}`;
  if (cookie(body.fbp)) tracking.fbp = body.fbp;
  for (const key of attributionKeys) {
    const value = text(body[key], 200);
    if (value) tracking[key] = value;
  }
  return { ok: true, visit: {
    visitorKey: `vp213:${body.visitId}`, visitorId: body.visitorId, externalId: body.visitorId,
    country: 'EC', sourceUrl: SCOPE.url, path: '/vitpower_2026g', productKey: SCOPE.product,
    productName: 'Vit Power Ecuador', funnel: SCOPE.flow, userAgent: tracking.userAgent,
    ipHash: hash(context.ip), firstSeenAt: now, lastSeenAt: now, tracking,
  } };
}

export function userData(visit, phone = '') {
  const t = visit.tracking || {};
  const data = { client_ip_address: t.ip, client_user_agent: t.userAgent,
    external_id: [hash(visit.visitorId)] };
  if (cookie(t.fbp)) data.fbp = t.fbp;
  if (cookie(t.fbc)) data.fbc = t.fbc;
  if (/^593[2-79]\d{8}$/.test(digits(phone))) data.ph = [hash(digits(phone))];
  return data;
}

export function buildEvent({ name, eventId, at, variant, order, previousStatus }, visit, policy) {
  if (!policy.approved || policy.dataset !== SCOPE.dataset || !policy.credentialsVerified)
    return reject('activation_or_credential_required');
  const activated = new Date(policy.activatedAt).getTime(), occurred = new Date(at).getTime();
  const now = new Date(policy.now || new Date()).getTime();
  if (![activated, occurred, now].every(Number.isFinite) || occurred < activated || occurred > now + 60000 ||
      occurred < now - 7 * 86400000) return reject('event_outside_activation');
  const t = visit?.tracking || {};
  if (visit?.country !== 'EC' || visit?.productKey !== SCOPE.product || visit?.sourceUrl !== SCOPE.url ||
      t.measurementVersion !== 213 || t.browserPixelId !== SCOPE.dataset || t.marketingConsent !== true ||
      !isIP(t.ip || '') || !text(t.userAgent)) return reject('persisted_visit_required');
  const custom = { content_ids: [SCOPE.product], content_type: 'product', flow_id: SCOPE.flow };
  if (BROWSER_EVENTS.includes(name)) {
    const prefix = { PageView: 'page', ViewContent: 'content', CtaClick: 'cta', Contact: 'contact' }[name];
    if (!new RegExp(`^vp213-${prefix}-[a-f0-9-]{32,36}$`, 'i').test(eventId || ''))
      return reject('invalid_browser_event_id');
    // The browser cannot supply arbitrary IDs to manufacture Meta conversions.
    if (eventId !== `vp213-${prefix}-${visit.visitorKey.slice(6)}`) return reject('event_visit_mismatch');
    custom.page_variant = ['mobile_vsl', 'desktop'].includes(variant) ? variant : 'unknown';
  } else if (name === 'InitiateCheckout' || name === 'Purchase') {
    const phone = digits(order?.customer?.phone);
    if (!/^593[2-79]\d{8}$/.test(phone) || digits(visit.customerPhone) !== phone || !visit.attributionClaimedAt)
      return reject('claimed_ec_customer_required');
    if (order?.country !== 'EC' || order?.currency !== 'USD' || order?.productKey !== SCOPE.product ||
        !/^[A-Za-z0-9_-]{4,160}$/.test(order?.orderId || '') || ![1, 2, 3, 6].includes(order?.quantity) ||
        typeof order?.total !== 'number' || !Number.isFinite(order.total) || order.total <= 0 ||
        new Date(order.createdAt).getTime() < activated || !Number.isFinite(new Date(order.createdAt).getTime()) ||
        order.persisted !== true) return reject('persisted_scoped_order_required');
    if (name === 'InitiateCheckout' && !['draft', 'pending'].includes(order.status))
      return reject('checkout_before_confirmation_required');
    if (name === 'Purchase' && (order.status !== 'confirmed' || !['draft', 'pending', '__new__'].includes(previousStatus)))
      return reject('confirmation_transition_required');
    eventId = 'vp213-' + hash([SCOPE.flow, name, order.orderId].join('|'));
    Object.assign(custom, { value: order.total, currency: 'USD', num_items: order.quantity, order_id: order.orderId });
  } else return reject('unsupported_event');
  return { ok: true, dataset: SCOPE.dataset, event: {
    event_name: name, event_id: eventId, event_time: Math.floor(occurred / 1000),
    action_source: 'website', event_source_url: SCOPE.url,
    user_data: userData(visit, order?.customer?.phone), custom_data: custom,
  } };
}

export function newReference() { return 'VP-' + randomBytes(18).toString('hex').toUpperCase(); }
export function readReference(message) {
  const matches = [...String(message || '').matchAll(/(?:^|\n)Visita: (VP-[A-F0-9]{36})(?=\s|$)/g)];
  return matches.length === 1 ? matches[0][1] : '';
}

// Repository adapter MUST implement an atomic, persisted reservation on a unique key.
// Uncertain acceptance is terminal until reconciliation. No automatic replay.
export async function deliverOnce(built, { ledger, transport, now = new Date() }) {
  if (!built?.ok) return built;
  const event = built.event;
  const reservation = await ledger.reserve({ id: `${built.dataset}:${event.event_id}`, dataset: built.dataset,
    eventName: event.event_name, eventId: event.event_id, occurredAt: new Date(event.event_time * 1000),
    payloadHash: hash(JSON.stringify(event)), now });
  if (!reservation.acquired) return { ok: true, duplicateOrLocked: true, eventId: event.event_id };
  let reply;
  try { reply = await transport(built); }
  catch { await ledger.finish(reservation, { state: 'uncertain', reason: 'transport_outcome_unknown', now });
    return { ok: false, uncertain: true, eventId: event.event_id }; }
  const accepted = reply?.http >= 200 && reply.http < 300 && reply?.events_received === 1;
  await ledger.finish(reservation, { state: accepted ? 'accepted' : 'uncertain',
    reason: accepted ? 'meta_acceptance_proven' : 'meta_acceptance_not_proven', now });
  return { ok: accepted, accepted, uncertain: !accepted, eventId: event.event_id };
}

export function mongooseLedger(Model) {
  return {
    async reserve(row) {
      const leaseToken = randomBytes(24).toString('hex');
      try {
        await Model.create({ _id: row.id, dataset: row.dataset, eventName: row.eventName,
          eventId: row.eventId, occurredAt: row.occurredAt, payloadHash: row.payloadHash, state: 'sending', leaseToken,
          lockUntil: new Date(row.now.getTime() + 60000), sentAt: null });
        return { acquired: true, id: row.id, leaseToken };
      } catch (error) { if (error?.code === 11000) return { acquired: false, id: row.id }; throw error; }
    },
    async finish(lease, outcome) {
      const set = { state: outcome.state, reason: outcome.reason, resolvedAt: outcome.now, lockUntil: null };
      if (outcome.state === 'accepted') set.sentAt = outcome.now;
      const result = await Model.updateOne({ _id: lease.id, state: 'sending', leaseToken: lease.leaseToken }, { $set: set });
      if (result.matchedCount !== 1) throw new Error('measurement_lease_lost');
    },
  };
}
