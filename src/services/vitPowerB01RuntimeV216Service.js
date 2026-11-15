import { runPersistedB01V216 } from './ecBotCoreRuntimeIntegrationV78Service.js';
import path from 'node:path';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import ContactState from '../models/ContactState.js';
import Message from '../models/Message.js';
import Order from '../models/Order.js';
import OutboundDedupe from '../models/OutboundDedupe.js';
import { sendAudio } from '../whatsapp/sendAudio.js';
import { sendImage } from '../whatsapp/sendImage.js';
import { sendText } from '../whatsapp/sendText.js';
import { principalSdrQaRuntimeReadyV212 } from './principalSdrQaIngressV212Service.js';
import { B01_VERSION, B01_MEDIA, createB01 } from './vitPowerB01CoreV216Service.js';

const ROOT = 'vitPowerB01';
const DURABLE = { writeConcern: { w: 'majority', j: true, wtimeout: 5000 } };
const qa = '5515998038637';
const digits = x => String(x || '').replace(/\D/g, '');
const hash = x => createHash('sha256').update(x).digest('hex');
const stamp = state => `${state.human?.mode || ''}:${state.human?.lastManualAt ? +new Date(state.human.lastManualAt) : ''}:${state.human?.assignedAt ? +new Date(state.human.assignedAt) : ''}:${state.human?.pausedUntil ? +new Date(state.human.pausedUntil) : ''}`;
const readPolicy = () => globalThis.__VITALISMEN_EC_B01_V216?.readPolicy?.() || { enabled: false };
const incoming = phone => ({ peerPhone: phone, sessionId: 'zapi', provider: 'zapi', isFromMe: false });
const activeOrder = phone => Order.exists({ country: 'EC', 'customer.phone': phone, status: { $in: ['confirmed', 'processing', 'shipped', 'returned'] } });

export function createMongoB01Repository({ Contact = ContactState, Messages = Message, Ledger = OutboundDedupe,
  hasOrder = activeOrder, qaReady = principalSdrQaRuntimeReadyV212 } = {}) {
  const getState = id => Contact.findById(id).lean();
  const writeContact = (method, ...args) => Contact[method](...args).setOptions(DURABLE);
  const writeLedger = (method, ...args) => Ledger[method](...args).setOptions(DURABLE);
  const filter = (id, token) => ({ _id: id, [`${ROOT}.version`]: B01_VERSION, [`${ROOT}.lockToken`]: token });
  async function checkState(state, job, p) {
    if (!p.enabled || !state || digits(state.phoneDigits) !== job.phone) return { allowed: false, reason: 'scope_or_policy' };
    if (job.phone === qa && !qaReady({ state, phone: qa, messageId: job.inboundId, now: new Date() })) return { allowed: false, reason: 'qa_window_closed' };
    if (job.origin === 'manual' ? stamp(state) !== job.manualStamp : state.human?.mode === 'manual' || +new Date(state.human?.pausedUntil || 0) > Date.now()) return { allowed: false, reason: 'human_hold' };
    const product = state.metadata?.customerDraft?.productKey;
    if (product && product !== 'vit_power_ec' || state.assignedAgent && state.assignedAgent !== 'vit_power_ec') return { allowed: false, reason: 'product_changed' };
    if (await hasOrder(job.phone)) return { allowed: false, reason: 'active_order' };
    const latest = await Messages.findOne(incoming(job.phone)).sort({ createdAt: -1, timestamp: -1 }).select('_id providerMessageId').lean();
    if (!latest || ![String(latest._id), latest.providerMessageId].includes(job.inboundId)) return { allowed: false, reason: 'new_inbound' };
    return { allowed: true };
  }
  return {
    withScope: (id, work) => runPersistedB01V216({ contactId: id }, work),
    async get(id) { const s = await getState(id); return s?.[ROOT]?.version ? s[ROOT] : null; },
    async eligible(input, p) {
      const state = await getState(input.contactId);
      const checked = await checkState(state, { ...input, manualStamp: stamp(state || {}) }, p);
      if (!checked.allowed) return checked;
      const proof = await Messages.findOne({ ...incoming(input.phone), $or: [{ _id: input.inboundId }, { providerMessageId: input.inboundId }] }).select('body').lean();
      if (!proof || input.origin !== 'manual' && proof.body !== input.text) return { allowed: false, reason: 'inbound_proof_missing' };
      if (input.origin !== 'manual') {
        if (input.phone !== qa && !(+new Date(state.createdAt) >= +new Date(p.activatedAt))) return { allowed: false, reason: 'existing_contact' };
        if (input.phone !== qa && await Messages.countDocuments(incoming(input.phone)) !== 1) return { allowed: false, reason: 'existing_conversation' };
        if (await Messages.exists({ peerPhone: input.phone, sessionId: 'zapi', isFromMe: true })) return { allowed: false, reason: 'presentation_or_reply_exists' };
      }
      if (input.origin === 'manual' && await Messages.exists({ peerPhone: input.phone, sessionId: 'zapi', isFromMe: true,
        mediaUrl: { $in: B01_MEDIA.map(s => s.asset) } })) return { allowed: false, reason: 'existing_media_history' };
      return { allowed: true, manualStamp: stamp(state), name: state.metadata?.customerDraft?.name || '' };
    },
    async start(id, job) {
      const s = await writeContact('findOneAndUpdate', { _id: id, [`${ROOT}.version`]: { $exists: false } }, { $set: { [ROOT]: job } }, { new: true }).lean();
      if (s && job.customerName) await writeContact('updateOne', { _id: id,
        $or: [{ 'metadata.customerDraft.firstName': { $exists: false } }, { 'metadata.customerDraft.firstName': '' }] },
        { $set: { 'metadata.customerDraft.firstName': job.customerName } });
      return s?.[ROOT] || null;
    },
    async interrupt(id, reason) { await writeContact('updateOne', { _id: id, [`${ROOT}.status`]: { $in: ['pending', 'sending'] } }, { $set: { [`${ROOT}.status`]: 'interrupted', [`${ROOT}.reason`]: reason, [`${ROOT}.nextAt`]: null } }); },
    async due(now) { return (await Contact.find({ [`${ROOT}.version`]: B01_VERSION, [`${ROOT}.status`]: 'pending', [`${ROOT}.nextAt`]: { $lte: now } }).select('_id').limit(20).lean()).map(x => x._id); },
    async claim(id, now, token) {
      const s = await writeContact('findOneAndUpdate', { _id: id, [`${ROOT}.version`]: B01_VERSION, [`${ROOT}.status`]: 'pending', [`${ROOT}.nextAt`]: { $lte: now } }, { $set: { [`${ROOT}.status`]: 'sending', [`${ROOT}.lockToken`]: token, [`${ROOT}.lockedUntil`]: new Date(+now + 120000) } }, { new: true }).lean();
      return s?.[ROOT] || null;
    },
    async check(id, job, p) {
      const state = await getState(id);
      if (state?.[ROOT]?.status !== 'sending') return { allowed: false, reason: 'interrupted' };
      return checkState(state, job, p);
    },
    async history(job, step) {
      if (step.kind === 'text') return false;
      const suffix = step.asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$';
      return Boolean(await Messages.exists({ peerPhone: job.phone, sessionId: 'zapi', isFromMe: true, mediaUrl: { $regex: suffix } }));
    },
    async reserve(id, token, cursor, key, now) {
      const state = await getState(id), job = state?.[ROOT];
      if (!job || job.lockToken !== token || job.status !== 'sending') return false;
      try { await Ledger.create([{ key: 'b01-v216:' + key, fingerprint: hash('b01-v216:' + cursor), phoneDigits: job.phone,
        jid: job.chatId, sessionId: 'zapi', kind: job.steps[cursor].kind, label: 'B01 V216 ' + job.steps[cursor].label,
        status: 'reserved', retryAllowed: false, firstReservedAt: now }], DURABLE); }
      catch (e) { if (e.code !== 11000) throw e; await this.stop(id, token, 'ambiguous', 'attempt_already_reserved'); return false; }
      const r = await writeContact('updateOne', { ...filter(id, token), [`${ROOT}.status`]: 'sending', [`${ROOT}.cursor`]: cursor, [`${ROOT}.steps.${cursor}.status`]: 'pending' }, { $set: { [`${ROOT}.steps.${cursor}.status`]: 'attempted', [`${ROOT}.steps.${cursor}.attemptedAt`]: now, [`${ROOT}.steps.${cursor}.ledgerKey`]: 'b01-v216:' + key } });
      return r.matchedCount === 1;
    },
    async accept(id, token, cursor, providerMessageId, now, nextAt) {
      const s = await getState(id), key = s?.[ROOT]?.steps?.[cursor]?.ledgerKey;
      if (key) await writeLedger('updateOne', { key, status: 'reserved' }, { $set: { status: 'sent', sentAt: now, provider: 'zapi', providerMessageId } });
      const values = { [`${ROOT}.steps.${cursor}.status`]: 'accepted', [`${ROOT}.steps.${cursor}.acceptedAt`]: now, [`${ROOT}.steps.${cursor}.providerMessageId`]: providerMessageId };
      const r = await writeContact('updateOne', { ...filter(id, token), [`${ROOT}.status`]: 'sending' }, { $set: { ...values, [`${ROOT}.cursor`]: cursor + 1, [`${ROOT}.status`]: nextAt ? 'pending' : 'done', [`${ROOT}.nextAt`]: nextAt, [`${ROOT}.lockedUntil`]: null } });
      if (!r.matchedCount) await writeContact('updateOne', filter(id, token), { $set: values });
    },
    async stop(id, token, status, reason) {
      const state = await getState(id), job = state?.[ROOT];
      const key = job?.lockToken === token ? job.steps?.[job.cursor]?.ledgerKey : '';
      if (key) await writeLedger('updateOne', { key, status: 'reserved' }, { $set: { status: 'ambiguous', ambiguousAt: new Date(), error: reason, retryAllowed: false } });
      await writeContact('updateOne', { ...filter(id, token), [`${ROOT}.status`]: 'sending' }, { $set: { [`${ROOT}.status`]: status, [`${ROOT}.reason`]: reason, [`${ROOT}.nextAt`]: null } });
    },
    async expire(now) {
      const rows = await Contact.find({ [`${ROOT}.version`]: B01_VERSION, [`${ROOT}.status`]: 'sending', [`${ROOT}.lockedUntil`]: { $lte: now } }).select(`_id ${ROOT}.lockToken`).limit(20).lean();
      for (const s of rows) await this.withScope(s._id, () => this.stop(s._id, s[ROOT].lockToken, 'ambiguous', 'worker_interrupted_requires_review'));
    }
  };
}

async function sendStep(job, step, key) {
  const options = { provider: 'zapi', sessionId: 'zapi', recipientDigits: job.phone, country: 'EC',
    sendMode: job.origin === 'manual' ? 'manual_panel' : '', returnDetails: true,
    allowAudioDedupeBypass: false, dedupeValue: 'b01-v216:' + key, outboundContext: 'vitpower_b01_v216', humanize: false };
  if (step.kind === 'text') return sendText(job.chatId, step.text, null, options);
  const file = path.resolve('public', '.' + step.asset);
  if (!file.startsWith(path.resolve('public') + path.sep) || !fs.existsSync(file)) throw new Error('b01_asset_missing');
  return step.kind === 'audio' ? sendAudio(job.chatId, file, true, options) : sendImage(job.chatId, file, '', options);
}
const repository = createMongoB01Repository();
const runtime = createB01({ repo: repository, send: sendStep, policy: readPolicy });
export const handleVitPowerB01InboundV216 = input => runtime.start(input);
export const processVitPowerB01V216 = () => runtime.tick();
export const getVitPowerB01V216 = id => repository.get(id);
const interruptByPhoneV216 = phone => ContactState.updateOne({
  phoneDigits: digits(phone), [ROOT + '.version']: B01_VERSION, [ROOT + '.status']: { $in: ['pending', 'sending'] }
}, { $set: { [ROOT + '.status']: 'interrupted', [ROOT + '.reason']: 'manual_send', [ROOT + '.nextAt']: null } });

let workerStartedV216 = false;
export function startVitPowerB01V216() {
  if (workerStartedV216 || !readPolicy().enabled) return false;
  workerStartedV216 = true;
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try { await runtime.tick(); }
    catch { console.warn('[B01-V216] bounded_worker_requires_review'); }
    finally { busy = false; }
  };
  setInterval(tick, 1000).unref();
  setTimeout(tick, 250).unref();
  return true;
}

export async function interruptVitPowerB01V216(phone) {
  const state = await ContactState.findOne({ phoneDigits: digits(phone), 'vitPowerB01.status': { $in: ['pending', 'sending'] } }).select('_id').lean();
  if (state && readPolicy().enabled) return runPersistedB01V216({ contactId: state._id }, () => interruptByPhoneV216(phone));
}
