// PROJECT=VITALISMEN_EC. Verified /tex measurement only; never sends WhatsApp messages.
import { createHmac } from 'node:crypto';
import journal from './texMeasurementJournalV243.cjs';
const { createJournal, hash } = journal;
export const TEX_MEASUREMENT_PIXEL_V243 = '1100892582698669';
const REF = /^TX243-[a-f0-9]{64}$/;
const CODE = /^TX242-[a-f0-9]{64}$/;
const PHONE = /^593[2-79]\d{8}$/;
const digits = x => String(x || '').replace(/\D/g, '');
const ms = x => Number(x) * (Number(x) < 1e12 ? 1000 : 1);
const mac = (key, text) => createHmac('sha256', key).update(text).digest('hex');
const measurementTransport = (input, scope, c) => {
  if (input.provider !== 'baileys' && input.sessionId === 'zapi' && scope?.method === 'POST' && scope.writeContext === true
    && /^\/api\/zapi\/webhook(?:\/(?:received|delivery))?$/.test(scope.path || '')) {
    return { provider: 'zapi', sessionId: 'zapi', ownerPhoneDigits: c.ownerPhone };
  }
  const linked = scope?.baileysInbound;
  if (input.provider === 'baileys' && linked?.verified === true && scope.method === 'SOCKET' && scope.writeContext === true
    && scope.path === '/internal/whatsapp/baileys-inbound'
    && linked.sessionId === input.sessionId && linked.messageId === input.sourceMessageId
    && linked.ownerPhoneDigits === input.ownerPhoneDigits
    && [c.ownerPhone, c.officialPhone].includes(linked.ownerPhoneDigits)) {
    return { provider: 'baileys', sessionId: linked.sessionId, ownerPhoneDigits: linked.ownerPhoneDigits };
  }
  return null;
};
const subjectFor = (c, transport, phone) => mac(c.key,
  `VITALISMEN_EC:tex_ultra_ec:${transport.provider}:${transport.ownerPhoneDigits}:${phone}`);
export function texMeasurementReferenceV243(text) {
  return typeof text === 'string' ? text.replace(/\r\n/g, '\n').trim().match(/^Hola, quiero el tratamiento Tex Ultra\.\nReferencia: (TX243-[a-f0-9]{64})$/)?.[1] || '' : '';
}
export function createTexMeasurementV243({ capability, context, findInbound, now = Date.now, post, journalFactory = createJournal } = {}) {
  let store, storeDirectory;
  const cap = () => { const value = capability?.(); return value?.isCurrent?.() === true ? value : null; };
  function ledger(c) {
    if (store && storeDirectory !== c.directory) throw Error('tex_measurement_directory_changed');
    storeDirectory = c.directory; return store ||= journalFactory({ directory: c.directory, now });
  }
  async function sendOnce(c, kind, key, proof) {
    const j = ledger(c);
    return j.lock(kind + ':' + key, async () => {
      const old = await j.read(kind, key);
      if (old?.attemptedAt) return { ...old.receipt, duplicate: true, blocked: old.receipt?.ok !== true, error: old.receipt?.ok ? undefined : 'tex_measurement_outcome_not_repeated' };
      // Durable intent precedes transport. A crash/unknown result never causes automatic replay.
      const record = { version: 243, attemptedAt: now(), sentAt: null, proof, receipt: { ok: false, blocked: true, error: 'tex_measurement_outcome_unknown' } };
      await j.write(kind, key, record);
      let receipt;
      try { receipt = await post(proof, c); } catch { receipt = { ok: false, blocked: true, error: 'tex_measurement_outcome_unknown' }; }
      record.receipt = receipt; if (receipt?.ok === true) record.sentAt = now();
      await j.write(kind, key, record); return receipt;
    });
  }
  return Object.freeze({
    async bindCode(result, reference) {
      const c = cap(); if (!c || !REF.test(reference || '') || !result?.verificationUrl || result.verified) return result;
      const url = new URL(result.verificationUrl);
      if (url.origin !== 'https://wa.me' || url.pathname !== '/' + c.officialPhone) return result;
      const code = url.searchParams.get('text')?.match(/\nConfirmar chat: (TX242-[a-f0-9]{64})$/)?.[1];
      if (!CODE.test(code || '') || !Number.isFinite(result.expiresAt)) return result;
      const j = ledger(c);
      await j.lock('code:' + hash(code), async () => {
        const previous = await j.read('codes', hash(code));
        if (!previous) await j.write('codes', hash(code), { version: 243, reference, expiresAt: result.expiresAt });
      });
      return result;
    },
    async observe(input) {
      const c = cap(); if (!c || input.recovered === true) return null;
      const scope = await context();
      const transport = measurementTransport(input, scope, c);
      if (!transport) return null;
      const phone = digits(input.state?.phoneDigits);
      if (!PHONE.test(phone) || input.state?.metadata?.testOnly === true || typeof input.sourceMessageId !== 'string' || !input.sourceMessageId || input.sourceMessageId.length > 250 || typeof input.inboundText !== 'string' || !Number.isFinite(Date.parse(c.activatedAt))) return null;
      let reference = texMeasurementReferenceV243(input.inboundText), channel = 'whatsapp';
      if (!reference) {
        const code = input.inboundText.replace(/\r\n/g, '\n').trim().match(/^Hola, quiero el tratamiento Tex Ultra\.\nConfirmar chat: (TX242-[a-f0-9]{64})$/)?.[1];
        if (!code) return null;
        const row = await ledger(c).read('codes', hash(code));
        if (!row || row.expiresAt <= now()) return null;
        // V242, not possession of the code, proves the phone originally entered in the chat.
        const linked = await c.confirmedCode?.(code, phone);
        if (linked !== true) return null;
        reference = row.reference; channel = 'web';
      }
      if (!REF.test(reference)) return null;
      const message = await findInbound({ _id: input.sourceMessageId, provider: transport.provider, sessionId: transport.sessionId, ownerPhoneDigits: transport.ownerPhoneDigits, isFromMe: false, peerPhone: phone });
      const at = ms(message?.timestamp);
      if (!message || message.body !== input.inboundText || !Number.isFinite(at) || at < Date.parse(c.activatedAt) || at > now() + 60000 || now() - at > 86400000) return null;
      const subject = subjectFor(c, transport, phone), j = ledger(c);
      const proof = { version: 243, kind: 'Lead', reference, subject, inboundId: hash(String(input.sourceMessageId)), occurredAt: at, channel };
      const receipt = await sendOnce(c, 'leads', subject, proof);
      // Only this new metadata path is written. Existing VSL origin/name/order/history stay intact.
      const marker = { version: 243, reference, subject, confirmedAt: at, channel, pixelId: TEX_MEASUREMENT_PIXEL_V243,
        provider: transport.provider, ownerPhoneDigits: transport.ownerPhoneDigits };
      if (receipt?.verified === true) {
        const previous = await j.read('subjects', subject);
        if (!previous) await j.write('subjects', subject, marker);
        const first = previous || marker;
        await input.state.updateOne({ $set: { 'metadata.texMeasurementV243': first } });
        input.state.metadata = { ...input.state.metadata, texMeasurementV243: first };
      }
      return receipt;
    },
    async bindOrder(order, state) {
      const c = cap(), marker = state?.metadata?.texMeasurementV243;
      if (!c || !marker || marker.version !== 243 || marker.pixelId !== TEX_MEASUREMENT_PIXEL_V243 || !REF.test(marker.reference)) return false;
      if (order?.country !== 'EC' || order?.tracking?.productKey !== 'tex_ultra_ec' || !PHONE.test(digits(order.customer?.phone))) return false;
      if (order.tracking?.metaPurchaseSentAt || order.tracking?.measurementVersion === 148) return false;
      const entry = +new Date(order.entryAt || order.createdAt || 0);
      if (!entry || entry < marker.confirmedAt || digits(order.customer.phone) !== digits(state.phoneDigits)) return false;
      const transport = { provider: marker.provider || 'zapi', ownerPhoneDigits: marker.ownerPhoneDigits || c.ownerPhone };
      if (!['zapi', 'baileys'].includes(transport.provider) || ![c.ownerPhone, c.officialPhone].includes(transport.ownerPhoneDigits)) return false;
      const subject = subjectFor(c, transport, digits(order.customer.phone));
      const saved = await ledger(c).read('subjects', subject);
      if (!saved || saved.reference !== marker.reference || saved.subject !== marker.subject) return false;
      order.tracking = { ...(order.tracking?.toObject?.() || order.tracking || {}), measurementVersion: 243,
        browserPixelId: TEX_MEASUREMENT_PIXEL_V243, sourceUrl: 'https://plusmen.shop/tex',
        attributionSource: 'tex_verified_first_touch_v243', attributionVisitorKey: saved.reference,
        attributionMatchedAt: new Date(saved.confirmedAt),
        attributionConfidence: transport.provider === 'baileys' ? 'official_baileys_exact_message' : 'official_zapi_exact_message',
        measurementTransport: transport.provider, measurementOwnerPhoneDigits: transport.ownerPhoneDigits,
        attributionCorrelationStatus: 'CLAIMED', attributionCorrelationReason: 'TX243_VERIFIED_OFFICIAL_INBOUND' };
      return true;
    },
    async purchase(order, options = {}) {
      if (order?.tracking?.measurementVersion !== 243 || order?.tracking?.attributionSource !== 'tex_verified_first_touch_v243') return null;
      if (order.tracking.productKey !== 'tex_ultra_ec') return null;
      const c = cap(); if (!c) return { ok: false, blocked: true, error: 'tex_measurement_unavailable' };
      const phone = digits(order.customer?.phone), reference = order.tracking.attributionVisitorKey;
      const quantity = Number(order.package?.quantity), value = Number(order.total), confirmedAt = +new Date(order.confirmedAt || 0), entryAt = +new Date(order.entryAt || 0);
      if (order.country !== 'EC' || order.tracking.productKey !== 'tex_ultra_ec' || order.currency !== 'USD' || !PHONE.test(phone) || !REF.test(reference || '')
        || !['confirmed', 'processing', 'shipped', 'delivered'].includes(order.status) || ![1,2,3,6].includes(quantity) || !(value > 0) || !Number.isFinite(value)
        || !order.orderId || !confirmedAt || confirmedAt < Date.parse(c.activatedAt) || confirmedAt > now() + 60000 || now() - confirmedAt > 604800000) return { ok: false, blocked: true, error: 'tex_measurement_purchase_not_qualified' };
      const transport = { provider: order.tracking.measurementTransport || 'zapi',
        ownerPhoneDigits: order.tracking.measurementOwnerPhoneDigits || c.ownerPhone };
      if (!['zapi', 'baileys'].includes(transport.provider) || ![c.ownerPhone, c.officialPhone].includes(transport.ownerPhoneDigits)) return { ok: false, blocked: true, error: 'tex_measurement_transport_invalid' };
      const subject = subjectFor(c, transport, phone), saved = await ledger(c).read('subjects', subject);
      if (!saved || saved.reference !== reference || entryAt < saved.confirmedAt) return { ok: false, blocked: true, error: 'tex_measurement_purchase_origin_not_proven' };
      const orderKey = mac(c.key, 'tex_ultra_ec:order:' + String(order.orderId));
      const proof = { version: 243, kind: 'Purchase', reference, subject, orderKey, occurredAt: confirmedAt, quantity, value, currency: 'USD' };
      if (options.dryRun) return { ok: true, dryRun: true, datasetId: TEX_MEASUREMENT_PIXEL_V243, eventId: 'tex243_purchase_' + orderKey, proof };
      return sendOnce(c, 'purchases', orderKey, proof);
    }
  });
}
const runtime = createTexMeasurementV243({
  capability: () => globalThis.__VITALISMEN_EC_TEX_MEASUREMENT_V243,
  context: async () => (await import('./ecBotCoreRuntimeIntegrationV78Service.js')).currentEcBotCoreRuntimeContextV78(),
  findInbound: async selector => (await import('../models/Message.js')).default.findOne(selector).select({ _id: 1, timestamp: 1, body: 1 }).lean(),
  post: async (proof, c) => {
    const body = JSON.stringify(proof), timestamp = String(Date.now());
    const response = await fetch('https://plusmen.shop/api/private/tex-measurement-proof', { method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-tex-timestamp': timestamp, 'x-tex-signature': mac(c.key, timestamp + '.' + body) },
      body, redirect: 'error', signal: AbortSignal.timeout(12000) });
    const result = await response.json();
    if (!response.ok || result.datasetId !== TEX_MEASUREMENT_PIXEL_V243) return { ok: false, blocked: true, error: 'tex_measurement_origin_rejected' };
    return result;
  }
});
export async function bindTexMeasurementCodeV243(result, reference) { try { return await runtime.bindCode(result, reference); } catch { return result; } }
export async function observeTexMeasurementV243(input) { try { return await runtime.observe(input); } catch { return null; } }
export async function bindTexMeasurementOrderV243(order, state) { try { return await runtime.bindOrder(order, state); } catch { return false; } }
export const sendTexMeasurementPurchaseV243 = (order, options) => runtime.purchase(order, options);
