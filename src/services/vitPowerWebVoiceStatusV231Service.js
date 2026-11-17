import { isGiraOrder } from './gira21x/contract.mjs';
// PROJECT=VITALISMEN_EC. Voice and exact, authorized order reads only.
import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
export const ANA_LOPEZ_VOICE_V231 = 'qHkrJuifPpn95wK3rm2A';
export const ANA_WELCOME_V231 = '¡Hola! Soy Ana Lopez, del equipo Vitalismen Ecuador. ¿Qué te gustaría saber sobre Vit Power?';
const sha = value => createHash('sha256').update(value).digest('hex');
const denied = () => { throw Error('order_access_unavailable'); };
const exactOrder = (row, orderId, phone) => row && row.country === 'EC' && row.orderId === orderId
  && String(row.phone || '').replace(/\D/g, '') === phone && row.productKey === 'vit_power_ec'
  && /^EC-[A-Z0-9-]{3,76}$/.test(row.orderId) && !isGiraOrder(row);

export function createWebVoiceV231({ apiKey, fetchImpl = globalThis.fetch, now = Date.now } = {}) {
  const cache = new Map(), running = new Map(), limits = new Map();
  let active = 0;
  return async function speak({ sessionId, record, requestId }) {
    if (!/^[a-f0-9]{64}$/.test(sessionId || '') || !record || record.expiresAt <= now()) throw Error('session_expired');
    const saved = record.requests?.[requestId];
    const text = requestId === 'welcome_ana_lopez_v231' ? ANA_WELCOME_V231
      : saved?.status === 'done' && saved.response?.ok === true ? saved.response.reply : '';
    if (!text || text.length > 2200) throw Error('voice_reply_not_owned');
    if (!apiKey) throw Error('voice_unavailable');
    for (const [key, row] of cache) if (row.expiresAt <= now()) cache.delete(key);
    for (const [key, row] of limits) if (row.until <= now()) limits.delete(key);
    const digest = sha(ANA_LOPEZ_VOICE_V231 + '\0' + text);
    if (cache.has(digest)) return cache.get(digest).audio;
    const scope = sessionId + ':' + digest;
    if (running.has(scope)) return running.get(scope);
    const limit = limits.get(sessionId) || { count: 0, until: now() + 600000 };
    if (limit.count >= 6 || active >= 2 || limits.size >= 3000) throw Error('voice_busy');
    limit.count++; limits.set(sessionId, limit);
    const task = (async () => {
      active++;
      try {
        const response = await fetchImpl('https://api.elevenlabs.io/v1/text-to-speech/' + ANA_LOPEZ_VOICE_V231 + '?output_format=mp3_44100_128', {
          method: 'POST', redirect: 'error', signal: AbortSignal.timeout(25000),
          headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
          body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2', language_code: 'es' })
        });
        if (!response.ok || !String(response.headers.get('content-type')).startsWith('audio/')) throw Error('voice_unavailable');
        if (Number(response.headers.get('content-length') || 0) > 2097152) throw Error('voice_unavailable');
        const chunks = []; let size = 0;
        for await (const chunk of response.body) { size += chunk.length; if (size > 2097152) { await response.body.cancel?.().catch(() => {}); throw Error('voice_unavailable'); } chunks.push(Buffer.from(chunk)); }
        const audio = Buffer.concat(chunks);
        if (audio.length < 100) throw Error('voice_unavailable');
        if (cache.size >= 20) cache.delete(cache.keys().next().value);
        cache.set(digest, { audio, expiresAt: now() + 1200000 });
        return audio;
      } finally { active--; }
    })();
    running.set(scope, task);
    try { return await task; } finally { running.delete(scope); }
  };
}

export function createWebOrderAccessV231({ directory, lookup, now = Date.now } = {}) {
  if (!path.isAbsolute(directory || '') || typeof lookup !== 'function') throw Error('order_access_configuration');
  const busy = new Set();
  async function initialize() { await fs.mkdir(directory, { recursive: true, mode: 0o700 }); }
  async function load(file) {
    let handle;
    try { handle = await fs.open(file, constants.O_RDONLY | constants.O_NOFOLLOW); const stat = await handle.stat(); if (!stat.isFile() || stat.size > 8192) return denied(); const buffer = Buffer.alloc(8193); const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0); if (bytesRead > 8192) return denied(); return JSON.parse(buffer.subarray(0, bytesRead).toString('utf8')); }
    finally { await handle?.close(); }
  }
  async function readId({ id, sessionId }) {
    const file = path.join(directory, id + '.json');
      if (busy.has(id)) throw Error('order_access_busy');
      busy.add(id);
      try {
        const record = await load(file);
        if (record.version !== 231 || record.expiresAt <= now() || record.sessionId && record.sessionId !== sessionId) return denied();
        const row = await lookup(record.orderId, record.phone);
        if (!exactOrder(row, record.orderId, record.phone)) return denied();
        if (!record.sessionId) {
          record.sessionId = sessionId;
          const temporary = file + '.' + randomBytes(8).toString('hex') + '.tmp';
          try { await fs.writeFile(temporary, JSON.stringify(record), { mode: 0o600, flag: 'wx' }); await fs.rename(temporary, file); }
          finally { await fs.unlink(temporary).catch(() => {}); }
        }
        const labels = { draft: 'En preparación de datos', pending: 'Pendiente de confirmación', confirmed: 'Pedido confirmado', processing: 'En preparación', shipped: 'Enviado', delivered: 'Entregado', cancelled: 'Cancelado', canceled: 'Cancelado', returned: 'Devuelto' };
        const logistics = { PENDIENTE: 'Pendiente de despacho', EN_TRANSITO: 'En tránsito', ENVIADO: 'Enviado', ENTREGADO: 'Entregado', DELIVERED: 'Entregado', DEVUELTO: 'Devuelto', EN_AGENCIA: 'En agencia' };
        const shipping = String(row.shippingStatus || '').toUpperCase().replace(/[ -]+/g, '_');
        const updatedAt = Number.isFinite(new Date(row.updatedAt).getTime()) ? new Date(row.updatedAt).toISOString() : null;
        const reply = 'Estado registrado de tu pedido: ' + (labels[row.status] || 'En revisión por el equipo') + '.'
          + (logistics[shipping] ? '\nLogística: ' + logistics[shipping] + '.' : '')
          + (updatedAt ? '\nÚltima actualización registrada: ' + new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Guayaquil' }).format(new Date(updatedAt)) + ' (Ecuador).' : '')
          + '\nEs el último estado guardado por el sistema; no confirma una nueva consulta al transportista.';
        return { ok: true, reply, status: labels[row.status] ? row.status : 'unknown', updatedAt, source: 'official_ec_order_record', readOnly: true };
      } catch (error) { if (error.message === 'order_access_busy') throw error; return denied(); }
      finally { busy.delete(id); }
  }
  return Object.freeze({
    async issue({ orderId, phone, administrator }) {
      if (!/^[A-Z0-9][A-Z0-9-]{5,79}$/.test(orderId || '') || !/^593[2-79]\d{8}$/.test(phone || '') || !administrator) return denied();
      const row = await lookup(orderId, phone);
      if (!exactOrder(row, orderId, phone)) return denied();
      await initialize();
      const names = await fs.readdir(directory); let count = 0;
      for (const name of names) if (/^[a-f0-9]{64}\.json$/.test(name)) {
        const file = path.join(directory, name), old = await load(file);
        if (old.expiresAt <= now()) await fs.unlink(file); else count++;
      }
      if (count >= 200) throw Error('order_access_capacity');
      const token = randomBytes(32).toString('hex'), expiresAt = now() + 86400000;
      const record = { version: 231, orderId, phone, administrator: String(administrator).slice(0, 100), createdAt: now(), expiresAt, sessionId: null };
      const file = path.join(directory, sha(token) + '.json');
      const handle = await fs.open(file, 'wx', 0o600);
      try { await handle.writeFile(JSON.stringify(record)); await handle.sync(); } finally { await handle.close(); }
      return { token, expiresAt, delivery: 'verified_customer_only', automaticSend: false };
    },
    async read({ token, sessionId }) {
      if (!/^[a-f0-9]{64}$/.test(token || '') || !/^[a-f0-9]{64}$/.test(sessionId || '')) return denied();
      return readId({ id: sha(token), sessionId });
    },
    async readSession({ sessionId }) {
      if (!/^[a-f0-9]{64}$/.test(sessionId || '')) return denied();
      let selected;
      try {
        const names = await fs.readdir(directory);
        if (names.length > 500) return denied();
        for (const name of names) if (/^[a-f0-9]{64}\.json$/.test(name)) {
          const row = await load(path.join(directory, name));
          if (row.version === 231 && row.sessionId === sessionId && row.expiresAt > now() && (!selected || row.createdAt > selected.createdAt))
            selected = { id: name.slice(0,-5), createdAt: row.createdAt };
        }
      } catch { return denied(); }
      if (!selected) return denied();
      return readId({ id: selected.id, sessionId });
    }
  });
}

let production;
export function productionWebOrderAccessV231() {
  if (!production) production = createWebOrderAccessV231({ directory: '/var/lib/vitalismen-web-chat-v220-r2/order-access-v231', lookup: async (orderId, phone) => {
    const { default: Order } = await import('../models/Order.js');
    const row = await Order.findOne({ country: 'EC', orderId, 'customer.phone': { $in: [phone, '+' + phone] } })
      .select('country orderId customer.phone status tracking productKey integration source shippingStatus updatedAt').lean();
    if (!row) return null;
    return { ...row, country: row.country, orderId: row.orderId, phone: row.customer?.phone, productKey: row.tracking?.productKey || row.productKey,
      status: row.status, shippingStatus: row.shippingStatus, updatedAt: row.updatedAt };
  } });
  return production;
}

// A browser is authorized only by a private link delivered to the registered WhatsApp.
export function createVerifiedOrderInviteV238({ resolve, issue }) {
  return async function invite(phone) {
    if (!/^593[2-79]\d{8}$/.test(phone || '')) return denied();
    const row = await resolve(phone);
    if (!row?.verified || !exactOrder(row, row.orderId, phone)) return denied();
    const grant = await issue({ orderId: row.orderId, phone, administrator: 'verified_official_whatsapp_v238' });
    if (!/^[a-f0-9]{64}$/.test(grant?.token || '')) return denied();
    const link = 'https://taviazen.shop/vitpower_2026g/assets/acesso-pedido.html#pedido=' + grant.token;
    return { version: 238, recipient: phone, expiresAt: grant.expiresAt,
      message: 'Hola. Soy Ana Lopez, del equipo Vitalismen Ecuador. 💬\nConsulta tu pedido de forma segura, sin escribir códigos:\n' + link
        + '\nToca el enlace y el chat abrirá tu estado registrado. El acceso es privado, vale por 24 horas y queda vinculado a tu navegador. No compartas este enlace.' };
  };
}
export async function productionVerifiedOrderInviteV238(phone) {
  const [{ default: Contact }, { default: Message }, { default: Order }] = await Promise.all([
    import('../models/ContactState.js'), import('../models/Message.js'), import('../models/Order.js')
  ]);
  return createVerifiedOrderInviteV238({
    resolve: async number => {
      if (!await Contact.exists({ phoneDigits: number, countryCode: 'EC', 'metadata.testOnly': { $ne: true } }) ||
          !await Message.exists({ peerPhone: number, ownerPhoneDigits: '5531971862958', provider: 'zapi', sessionId: 'zapi', isFromMe: false })) return null;
      const row = await Order.findOne({ country: 'EC', 'customer.phone': { $in: [number, '+' + number] },
        $or: [{ 'tracking.productKey': 'vit_power_ec' }, { productKey: 'vit_power_ec', 'tracking.productKey': { $exists: false } }] })
        .sort({ createdAt: -1 }).select('country orderId customer.phone productKey tracking integration source').lean();
      return row ? { ...row, verified: true, country: row.country, orderId: row.orderId, phone: row.customer.phone,
        productKey: row.tracking?.productKey || row.productKey } : null;
    }, issue: args => productionWebOrderAccessV231().issue(args)
  })(phone);
}
