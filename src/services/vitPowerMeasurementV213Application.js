// Production adapter CANDIDATE: deliberately inactive without sealed authority.
import mongoose from 'mongoose';
import { randomUUID, createHash } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import VslVisit from '../models/VslVisit.js';
import { SCOPE, buildEvent, deliverOnce, mongooseLedger } from './vitPowerMeasurementV213Core.js';
import { createRuntime, eventSchema, metaTransport } from './vitPowerMeasurementV213Runtime.js';

const phoneOf = x => String(x || '').replace(/\D/g, '');
const allowed = phone => /^593[2-79]\d{8}$/.test(phoneOf(phone));
const unwrap = x => x?.toObject ? x.toObject() : x;
const mutationScope = new AsyncLocalStorage();
export function measurementMongoAllowedV213(collection, method, args) {
  if (!authority()) return false;
  const scope = mutationScope.getStore(); if (!scope) return false;
  const name = String(collection || '').toLowerCase(), filter = args?.[0] || {};
  if (name === 'vitpower_measurement_v213' && scope.ledger === true) {
    if (!['insertOne', 'insertMany', 'updateOne'].includes(method)) return false;
    const rows = method === 'insertMany' ? filter : [filter];
    return rows.length > 0 && rows.every(row => typeof row._id === 'string' &&
      row._id.startsWith(SCOPE.dataset + ':vp213-') &&
      (method === 'updateOne' || row.dataset === SCOPE.dataset));
  }
  if (name !== 'vslvisits' || !['insertOne', 'updateOne', 'findOneAndUpdate'].includes(method)) return false;
  if (scope.visitorKey && filter.visitorKey === scope.visitorKey) return true;
  if (scope.visitId && String(filter._id || '') === scope.visitId) return true;
  if (scope.contactClaimV237 === true && filter.country === 'EC' && filter.productKey === SCOPE.product &&
      filter.sourceUrl === SCOPE.url && filter['tracking.measurementVersion'] === 213 &&
      filter['tracking.contactPhoneHashV237'] === scope.contactPhoneHashV237 &&
      /^[a-f0-9]{64}$/.test(scope.contactPhoneHashV237 || '') && /^[a-f0-9]{64}$/.test(filter['tracking.contactEntryHashV237'] || '')) return true;
  return Boolean(scope.reference && filter['tracking.reference'] === scope.reference &&
    filter.country === 'EC' && filter.productKey === SCOPE.product && filter.sourceUrl === SCOPE.url);
}
export function measurementRequestAllowedV213(req) {
  const a = authority();
  return Boolean(a && req.method === 'POST' && String(req.originalUrl || req.url || '').split('?')[0] === '/api/meta-events/vitpower' &&
    a.clientContext(req)?.trustedClientContext === true);
}
export function measurementRateLimitKeyV213(req) {
  if (!measurementRequestAllowedV213(req)) return '';
  const context = authority().clientContext(req);
  return 'vp213:' + createHash('sha256').update(context.ip).digest('hex');
}
function authority() {
  const a = globalThis.__VITALISMEN_EC_MEASUREMENT_V213;
  if (!a || a.kind !== 'SEALED_VITPOWER_MEASUREMENT_V213' || a.dataset !== SCOPE.dataset ||
      typeof a.readPolicy !== 'function' || typeof a.clientContext !== 'function' || typeof a.token !== 'function') return null;
  const policy = a.readPolicy();
  if (!policy?.collectionApproved || !policy?.approved || !policy?.credentialsVerified ||
      policy.dataset !== SCOPE.dataset || !Number.isFinite(Date.parse(policy.activatedAt))) return null;
  return a;
}
function setup() {
  const a = authority(); if (!a) return null;
  const Event = mongoose.models.VitPowerMeasurementV213 || mongoose.model('VitPowerMeasurementV213', eventSchema(mongoose));
  const transport = metaTransport({ tokenProvider: () => a.token() });
  return { a, Event, transport, runtime: createRuntime({ VisitModel: VslVisit, EventModel: Event,
    policyProvider: () => a.readPolicy(), transport }) };
}
export async function captureVitPowerMeasurementV213(req, res) {
  const ctx = setup();
  res.set('Cache-Control', 'no-store');
  if (!ctx) return res.status(503).json({ ok: false, reason: 'measurement_not_activated' });
  // This function must verify the same-origin proxy's signed client context,
  // timestamp, body digest and public host. A public JSON field is never proof.
  const verifiedContext = ctx.a.clientContext(req);
  if (!verifiedContext?.trustedClientContext) return res.status(403).json({ ok: false, reason: 'verified_transport_required' });
  try {
    const result = await mutationScope.run({ visitorKey: 'vp213:' + String(req.body?.visitId || ''), ledger: true },
      () => ctx.runtime.capture(req.body, verifiedContext));
    return res.status(result.ok ? 200 : 400).json(result);
  } catch { return res.status(503).json({ ok: false, reason: 'measurement_temporarily_unavailable' }); }
}

async function inboundProof({ phone, sourceMessageId, message }) {
  const Model = mongoose.models.Message;
  if (!Model || !allowed(phone) || !sourceMessageId) return false;
  const saved = await Model.findOne({ _id: sourceMessageId, provider: 'zapi', isFromMe: false,
    peerPhone: phoneOf(phone), sessionId: 'zapi', ownerPhoneDigits: '5531971862958' }).select('body').lean();
  return Boolean(saved && (message === undefined || saved.body === message));
}
export async function claimVitPowerReferenceV213(args) {
  const referenceEntry = /\nVisita: VP-[A-F0-9]{36}(?:\s|$)/.test(args.message || '');
  if (!referenceEntry && !String(args.message || '').startsWith('Hola, vengo del video.\nQuiero conocer la oferta disponible de Vit Power.')) return null;
  const ctx = setup(); if (!ctx || !allowed(args.phone)) return { ok: false, reason: 'scoped_measurement_unavailable' };
  const providerVerified = await inboundProof(args);
  if (!referenceEntry) return mutationScope.run({ contactClaimV237: true,
    contactPhoneHashV237: createHash('sha256').update(phoneOf(args.phone)).digest('hex'), ledger: false },
    () => ctx.runtime.claimContactV237({ ...args, providerVerified }));
  const reference = (args.message.match(/\nVisita: (VP-[A-F0-9]{36})(?:\s|$)/) || [])[1];
  return mutationScope.run({ reference, phone: phoneOf(args.phone), ledger: false },
    () => ctx.runtime.claim({ ...args, providerVerified }));
}

export async function observeVitPowerPendingV213({ contactStateId, agentKey }) {
  if (agentKey !== SCOPE.product || !setup()) return;
  const state = await mongoose.models.ContactState.findById(contactStateId).lean();
  const phone = state?.phoneDigits, sourceMessageId = state?.metadata?.processingLock?.messageId;
  if (!allowed(phone) || !sourceMessageId) return;
  return observeVitPowerDraftV213({ phone, sourceMessageId, contactStateId, pending: true });
}
export async function observeVitPowerDraftV213({ phone, sourceMessageId, contactStateId, pending = false }) {
  const ctx = setup();
  if (!ctx || !await inboundProof({ phone, sourceMessageId })) return;
  const State = mongoose.models.ContactState;
  const state = await State.findOne({ _id: contactStateId, phoneDigits: phoneOf(phone) }).lean();
  const draft = pending ? state?.metadata?.perAgentMemory?.vit_power_ec?.pendingCheckoutOrder : state?.metadata?.customerDraft;
  const quantity = Number(draft?.quantity), total = Number(draft?.total);
  if (state?.metadata?.productKey !== SCOPE.product || (!pending && draft?.productKey !== SCOPE.product) ||
      (pending && draft?.productKey && draft.productKey !== SCOPE.product) ||
      ![1, 2, 3, 6].includes(quantity) || !Number.isFinite(total) || total <= 0) return;
  let visit = await VslVisit.findOne({ country: 'EC', productKey: SCOPE.product, sourceUrl: SCOPE.url,
    customerPhone: phoneOf(phone), 'tracking.measurementVersion': 213,
    attributionClaimedAt: { $ne: null } }).sort({ attributionClaimedAt: -1 }).lean();
  if (!visit) return;
  return mutationScope.run({ visitorKey: visit.visitorKey, visitId: String(visit._id), ledger: true }, async () => {
  if (!visit.tracking.currentDraftCycle && visit.tracking.lastDraftMessageId === String(sourceMessageId)) return;
  if (!visit.tracking.currentDraftCycle) {
    await VslVisit.updateOne({ _id: visit._id, 'tracking.currentDraftCycle': { $exists: false } }, {
      $set: { 'tracking.currentDraftCycle': 'VP213-DRAFT-' + randomUUID(), 'tracking.currentDraftCycleAt': new Date() },
    });
    visit = await VslVisit.findById(visit._id).lean();
  }
  await VslVisit.updateOne({ _id: visit._id }, { $set: { 'tracking.lastDraftMessageId': String(sourceMessageId) } });
  const order = { orderId: visit.tracking.currentDraftCycle, createdAt: visit.tracking.currentDraftCycleAt,
    customer: { phone: phoneOf(phone) }, country: 'EC', productKey: SCOPE.product, currency: 'USD',
    quantity, total, status: 'draft', persisted: true };
  const built = buildEvent({ name: 'InitiateCheckout', order, at: visit.tracking.currentDraftCycleAt }, visit, ctx.a.readPolicy());
  return deliverOnce(built, { ledger: mongooseLedger(ctx.Event), transport: ctx.transport });
  });
}

const orderTrackingKeys = ['measurementVersion', 'browserPixelId', 'productKey', 'productName', 'funnel',
  'sourceUrl', 'ip', 'userAgent', 'clientContextSource', 'fbclid', 'fbc', 'fbp', 'external_id',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'campaign_id', 'adset_id', 'ad_id', 'placement'];
async function prepareOrder(doc) {
  const ctx = setup(); if (!ctx || doc.country !== 'EC' || !allowed(doc.customer?.phone)) return;
  const p = ctx.a.readPolicy();
  if (new Date(doc.createdAt || Date.now()).getTime() < Date.parse(p.activatedAt)) return;
  if (doc.tracking?.productKey && doc.tracking.productKey !== SCOPE.product) return;
  const State = mongoose.models.ContactState;
  const state = await State.findOne({ phoneDigits: phoneOf(doc.customer.phone) }).sort({ updatedAt: -1 }).lean();
  if (state?.metadata?.productKey !== SCOPE.product) return;
  const visitorKey = state?.metadata?.tracking?.attributionVisitorKey;
  if (!visitorKey?.startsWith('vp213:')) return;
  const visit = await VslVisit.findOne({ visitorKey, country: 'EC', sourceUrl: SCOPE.url,
    productKey: SCOPE.product, customerPhone: phoneOf(doc.customer.phone), attributionClaimedAt: { $ne: null },
    'tracking.measurementVersion': 213 }).lean();
  if (!visit) return;
  const tracking = doc.tracking?.toObject ? doc.tracking.toObject() : { ...(doc.tracking || {}) };
  // Existing order attribution is immutable; a new repurchase gets its own order ID.
  if (tracking.attributionVisitorKey && tracking.attributionVisitorKey !== visit.visitorKey) return;
  for (const key of orderTrackingKeys) if (visit.tracking[key] !== undefined && tracking[key] === undefined)
    tracking[key] = visit.tracking[key];
  Object.assign(tracking, { attributionVisitorKey: visit.visitorKey,
    attributionCorrelationStatus: 'CLAIMED', attributionSource: 'verified_zapi_reference_v213' });
  doc.tracking = tracking;
}
function quietFailure() { console.warn('[VITPOWER-MEASUREMENT-V213] non_blocking_observation_failed'); }
export function installVitPowerOrderHooksV213(schema) {
  schema.pre('save', async function () {
    if (!authority()) return;
    try {
      const previous = this.isNew ? null : await this.constructor.findOne({ _id: this._id, country: 'EC' }).select('status').lean();
      this.$locals.vp213PreviousStatus = this.isNew ? '__new__' : previous?.status;
      await prepareOrder(this);
    } catch { quietFailure(); }
  });
  schema.post('save', async function (doc) {
    try { const ctx = setup(); if (ctx) await mutationScope.run({ visitorKey: doc.tracking?.attributionVisitorKey, ledger: true },
      () => ctx.runtime.orderSaved(unwrap(doc), doc.$locals.vp213PreviousStatus)); }
    catch { quietFailure(); }
  });
  for (const operation of ['findOneAndUpdate', 'updateOne']) {
    schema.pre(operation, async function () {
      if (!authority()) return;
      try {
        this.vp213Before = await this.model.findOne({ $and: [this.getQuery(), { country: 'EC',
          'tracking.measurementVersion': 213, 'tracking.productKey': SCOPE.product }] }).select('_id status').lean();
      } catch { quietFailure(); }
    });
    schema.post(operation, async function () {
      if (!this.vp213Before) return;
      try {
        const doc = await this.model.findOne({ _id: this.vp213Before._id, country: 'EC' }).lean();
        const ctx = setup(); if (ctx && doc) await mutationScope.run({ visitorKey: doc.tracking?.attributionVisitorKey, ledger: true },
          () => ctx.runtime.orderSaved(doc, this.vp213Before.status));
      } catch { quietFailure(); }
    });
  }
}

export async function scopedPurchaseReceiptV237(order) {
  const ctx = setup();
  if (!ctx || order?.country !== 'EC' || !allowed(order.customer?.phone) || order.tracking?.productKey !== SCOPE.product) return null;
  const state = await mongoose.models.ContactState.findOne({ phoneDigits: phoneOf(order.customer.phone) }).lean();
  const fromSite = order.tracking?.sourceUrl === SCOPE.url || state?.metadata?.vslSourceUrl === SCOPE.url ||
    state?.metadata?.vslProductKey === SCOPE.product && String(state?.metadata?.vslEntryMessage || '').startsWith('Hola, vengo del video.\nQuiero conocer la oferta disponible de Vit Power.');
  if (!fromSite) return null;
  const eventId = 'vp213-' + createHash('sha256').update([SCOPE.flow, 'Purchase', order.orderId].join('|')).digest('hex');
  const row = await ctx.Event.findOne({ _id: SCOPE.dataset + ':' + eventId }).select('state').lean();
  return row?.state === 'accepted'
    ? { ok: true, eventId, datasetId: SCOPE.dataset, datasetRoute: 'vitpower_site_v237', response: { events_received: 1 }, alreadyAccepted: true }
    : { ok: false, blocked: true, eventId, datasetId: SCOPE.dataset, datasetRoute: 'vitpower_site_v237',
        error: row ? 'scoped_purchase_acceptance_unproven' : 'scoped_purchase_attribution_or_confirmation_pending' };
}
export async function observePersistedContactV237(contactStateId) {
  const ctx = setup(); if (!ctx) return;
  const state = await mongoose.models.ContactState.findById(contactStateId).lean();
  const draft = state?.metadata?.customerDraft, pending = state?.metadata?.perAgentMemory?.vit_power_ec?.pendingCheckoutOrder;
  if (!allowed(state?.phoneDigits) || state?.metadata?.productKey !== SCOPE.product) return;
  if (!['', 'novo', 'new', 'atendendo', 'attending', 'em_atendimento', 'draft', 'pending'].includes(String(draft?.status || '').toLowerCase())) return;
  const orderId = draft?.orderId;
  if (orderId && mongoose.models.Order) {
    const saved = await mongoose.models.Order.findOne({ orderId, country: 'EC', 'customer.phone': { $in: [state.phoneDigits, '+' + state.phoneDigits] } }).select('status').lean();
    if (saved && !['draft', 'pending'].includes(saved.status)) return;
  }
  const message = await mongoose.models.Message.findOne({ provider: 'zapi', sessionId: 'zapi', isFromMe: false,
    peerPhone: state.phoneDigits, ownerPhoneDigits: '5531971862958', createdAt: { $gte: new Date(ctx.a.readPolicy().activatedAt) } }).sort({ createdAt: -1 }).select('_id').lean();
  if (!message) return;
  const hasDraft = [1,2,3,6].includes(Number(draft?.quantity)) && Number(draft?.total) > 0;
  if (!hasDraft && !([1,2,3,6].includes(Number(pending?.quantity)) && Number(pending?.total) > 0)) return;
  return observeVitPowerDraftV213({ phone: state.phoneDigits, sourceMessageId: String(message._id), contactStateId: state._id, pending: !hasDraft });
}
export function installVitPowerContactHooksV237(schema) {
  schema.post('save', async function(doc) { try { await observePersistedContactV237(doc._id); } catch { quietFailure(); } });
  for (const operation of ['findOneAndUpdate', 'updateOne']) {
    schema.pre(operation, async function() {
      if (!authority()) return;
      try { this.vp237Before = await this.model.findOne(this.getQuery()).select('_id').lean(); } catch { quietFailure(); }
    });
    schema.post(operation, async function() {
      if (!this.vp237Before) return;
      try { await observePersistedContactV237(this.vp237Before._id); } catch { quietFailure(); }
    });
  }
}
