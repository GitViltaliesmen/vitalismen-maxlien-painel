import { createHash } from 'node:crypto';
import { SCOPE, normalizeCapture, buildEvent, deliverOnce, mongooseLedger, newReference, readReference } from './vitPowerMeasurementV213Core.js';

const plain = x => x?.toObject ? x.toObject() : x;
const digest = x => createHash('sha256').update(x).digest('hex');
const phoneOf = x => String(x || '').replace(/\D/g, '');
const customerAllowed = x => /^593[2-79]\d{8}$/.test(phoneOf(x));

// Dependencies are the existing application's models/transport. Policy must come
// from the sealed operational adapter, never from a request body or URL parameter.
export function createRuntime({ VisitModel, EventModel, policyProvider, transport, now = () => new Date() }) {
  const ledger = mongooseLedger(EventModel);
  async function policy() {
    const p = await policyProvider();
    if (p?.collectionApproved !== true || p?.dataset !== SCOPE.dataset || !Number.isFinite(Date.parse(p.activatedAt)))
      return null;
    return { ...p, now: now() };
  }
  async function emit(input, visit, p) {
    return deliverOnce(buildEvent(input, plain(visit), p), { ledger, transport, now: now() });
  }
  return {
    async capture(body, verifiedContext) {
      const p = await policy();
      if (!p) return { ok: false, reason: 'measurement_not_activated' };
      const capture = normalizeCapture(body, { ...verifiedContext, now: now() });
      if (!capture.ok) return capture;
      const events = Array.isArray(body.events) ? body.events : [];
      if (events.length > 4 || events.some(e => !['PageView', 'ViewContent', 'CtaClick', 'Contact'].includes(e.name)))
        return { ok: false, reason: 'browser_conversion_injection_rejected' };
      const candidate = capture.visit;
      let row;
      try {
        row = plain(await VisitModel.findOneAndUpdate(
          { visitorKey: candidate.visitorKey },
          { $setOnInsert: { ...candidate, tracking: { ...candidate.tracking, reference: newReference() } } },
          { upsert: true, new: true }).lean());
      } catch (error) {
        if (error?.code !== 11000) throw error;
        row = await VisitModel.findOne({ visitorKey: candidate.visitorKey }).lean();
      }
      if (row.visitorId !== candidate.visitorId || row.tracking?.measurementVersion !== 213)
        return { ok: false, reason: 'visit_identity_conflict' };
      const clicked = events.some(e => e.name === 'CtaClick');
      const safeTracking = Object.fromEntries(Object.entries(candidate.tracking).map(([k, v]) => [`tracking.${k}`, v]));
      const update = { $set: { ...safeTracking, lastSeenAt: now(),
        ...(clicked ? { lastClickAt: now(), clickCount: 1,
          vslEntryMessage: `${body.entryMessage || ''}\nVisita: ${row.tracking.reference}`.trim().slice(0, 800) } : {}) } };
      // Persist cookies that became available after the asynchronous Pixel load.
      await VisitModel.updateOne({ visitorKey: row.visitorKey, visitorId: row.visitorId }, update);
      row.tracking = { ...row.tracking, ...candidate.tracking };
      const results = [];
      for (const event of events) {
        if (!['PageView', 'ViewContent', 'CtaClick', 'Contact'].includes(event.name))
          return { ok: false, reason: 'browser_conversion_injection_rejected' };
        const result = await emit({ name: event.name, eventId: event.id, at: now(), variant: body.variant }, row, p);
        results.push({ name: event.name, ok: result.ok, accepted: result.accepted === true,
          duplicate: result.duplicateOrLocked === true, reason: result.reason });
      }
      return { ok: true, reference: row.tracking.reference, results };
    },
    async claim({ phone, message, inboundAt, providerVerified }) {
      if (!providerVerified || !customerAllowed(phone)) return { ok: false, reason: 'verified_ec_inbound_required' };
      const reference = readReference(message);
      if (!reference) return { ok: false, reason: 'no_vitpower_reference' };
      const p = await policy(); if (!p) return { ok: false, reason: 'measurement_not_activated' };
      const at = new Date(inboundAt);
      if (!Number.isFinite(at.getTime()) || Math.abs(at.getTime() - now().getTime()) > 120000)
        return { ok: false, reason: 'stale_inbound' };
      const phoneDigits = phoneOf(phone);
      const visit = plain(await VisitModel.findOneAndUpdate({
        country: 'EC', sourceUrl: SCOPE.url, productKey: SCOPE.product,
        'tracking.measurementVersion': 213, 'tracking.reference': reference,
        lastClickAt: { $gte: new Date(Math.max(Date.parse(p.activatedAt), at.getTime() - 86400000)), $lte: at },
        clickCount: { $gt: 0 },
        $or: [{ customerPhone: '' }, { customerPhone: { $exists: false } }, { customerPhone: phoneDigits }],
      }, { $set: { customerPhone: phoneDigits, attributionClaimedAt: now(),
        attributionClaimSource: 'verified_zapi_reference_v213', attributionClaimInboundAt: at,
        attributionClaimPhoneHash: digest(phoneDigits), attributionClaimMessageHash: digest(message) } },
      { new: true }).lean());
      if (!visit) return { ok: false, reason: 'reference_unavailable_or_claimed' };
      return { ok: true, claimed: true, visitId: String(visit._id), visitorKey: visit.visitorKey,
        visitorId: visit.visitorId, productKey: SCOPE.product, sourceUrl: SCOPE.url,
        tracking: { ...visit.tracking, attributionVisitorKey: visit.visitorKey,
          attributionCorrelationStatus: 'CLAIMED', attributionSource: 'verified_zapi_reference_v213' } };
    },
    async orderSaved(order, previousStatus) {
      const p = await policy(); if (!p) return { ok: false, reason: 'measurement_not_activated' };
      order = plain(order);
      if (!customerAllowed(order?.customer?.phone) || order?.country !== 'EC')
        return { ok: false, reason: 'ec_customer_required' };
      // A product switch for this order must not inherit the original VSL product.
      if (order.tracking?.productKey !== SCOPE.product || order.tracking?.measurementVersion !== 213)
        return { ok: false, reason: 'order_not_vitpower_v213' };
      const visit = await VisitModel.findOne({ visitorKey: order.tracking.attributionVisitorKey,
        country: 'EC', sourceUrl: SCOPE.url, productKey: SCOPE.product,
        customerPhone: phoneOf(order.customer.phone), attributionClaimedAt: { $ne: null },
        'tracking.measurementVersion': 213 }).lean();
      if (!visit) return { ok: false, reason: 'claimed_visit_required' };
      const snapshot = { ...order, productKey: order.tracking.productKey,
        quantity: order.package?.quantity, persisted: Boolean(order._id) };
      const name = order.status === 'confirmed' ? 'Purchase' : 'InitiateCheckout';
      if (name === 'InitiateCheckout' && !['draft', 'pending', '__new__'].includes(previousStatus))
        return { ok: false, reason: 'status_reversal_is_not_checkout' };
      if (name === 'InitiateCheckout' && !visit.tracking?.currentDraftCycle && ['draft', 'pending'].includes(order.status)) {
        await VisitModel.updateOne({ visitorKey: visit.visitorKey, 'tracking.currentDraftCycle': { $exists: false } }, {
          $set: { 'tracking.currentDraftCycle': order.orderId, 'tracking.currentDraftCycleAt': order.createdAt },
        });
        const savedCycle = await VisitModel.findOne({ visitorKey: visit.visitorKey }).lean();
        visit.tracking = savedCycle.tracking;
      }
      if (name === 'InitiateCheckout' && visit.tracking?.currentDraftCycle) {
        snapshot.orderId = visit.tracking.currentDraftCycle;
        snapshot.createdAt = visit.tracking.currentDraftCycleAt;
      }
      const result = await emit({ name, order: snapshot, previousStatus,
        at: name === 'Purchase' ? order.confirmedAt : now() }, visit, p);
      if (name === 'Purchase' && ['draft', 'pending', '__new__'].includes(previousStatus)) {
        // Business lifecycle closes on confirmation even if Meta is unavailable.
        // Do not let an uncertain Meta response merge the next repurchase cycle.
        await VisitModel.updateOne({ visitorKey: visit.visitorKey,
          'tracking.currentDraftCycle': visit.tracking?.currentDraftCycle || { $exists: false } }, {
          $set: { 'tracking.lastPurchaseAt': now(), 'tracking.lastPurchaseOrderId': order.orderId },
          $unset: { 'tracking.currentDraftCycle': '', 'tracking.currentDraftCycleAt': '' },
        });
      }
      return result;
    },
  };
}

export function eventSchema(mongoose) {
  return new mongoose.Schema({
    _id: String, dataset: { type: String, enum: [SCOPE.dataset], required: true },
    eventName: { type: String, enum: ['PageView', 'ViewContent', 'CtaClick', 'Contact', 'InitiateCheckout', 'Purchase'] },
    eventId: String, occurredAt: Date, payloadHash: String,
    state: { type: String, enum: ['sending', 'accepted', 'uncertain'], required: true },
    leaseToken: String, lockUntil: Date, sentAt: Date, resolvedAt: Date, reason: String,
  }, { timestamps: true, collection: 'vitpower_measurement_v213', strict: 'throw' });
}

export function metaTransport({ tokenProvider, fetchImpl = fetch }) {
  return async built => {
    if (!built.ok || built.dataset !== SCOPE.dataset) throw new Error('dataset_scope_rejected');
    const token = await tokenProvider();
    if (!token || typeof token !== 'string') throw new Error('scoped_token_missing');
    // Credentials in the Authorization header, never in a URL or error log.
    const response = await fetchImpl(`https://graph.facebook.com/v22.0/${SCOPE.dataset}/events`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [built.event] }), signal: AbortSignal.timeout(12000),
    });
    let body; try { body = await response.json(); } catch { body = {}; }
    return { http: response.status, events_received: body.events_received,
      errorCode: body.error?.code, errorSubcode: body.error?.error_subcode };
  };
}
