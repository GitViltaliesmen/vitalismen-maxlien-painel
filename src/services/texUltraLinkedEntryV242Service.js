// PROJECT=VITALISMEN_EC. One verified identity and one entry owner; never sends messages.
import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
const hash = value => createHash('sha256').update(value).digest('hex');
const SESSION = /^[a-f0-9]{64}$/;
const CODE = /^TX242-([a-f0-9]{64})$/;
export const TEX_LINK_PREFIX_V242 = 'Hola, quiero el tratamiento Tex Ultra.\nConfirmar chat: ';
export function texLinkCodeFromMessageV242(text) {
  if (typeof text !== 'string') return null;
  return text.replace(/\r\n/g, '\n').trim().match(/^Hola, quiero el tratamiento Tex Ultra\.\nConfirmar chat: (TX242-[a-f0-9]{64})$/)?.[1] || null;
}
export function texLinkedContactHoldV242(state = {}, now = Date.now()) {
  const m = state.metadata || {}, h = state.human || {};
  if (m.optOut === true || m.doNotContact === true || m.operatorNoAutoResend === true || state.blockedAutomatically
    || (state.tags || []).some(t => /^(?:stop|opt.?out|no.?contact|bloqueado|do.?not.?contact|manual:no_auto_resend)$/i.test(t))) return true;
  return h.mode === 'manual' && !['vsl_ec', 'tex_ultra_funnel', 'tex_ultra_vsl_entry_auto'].includes(h.lastManualBy || '')
    && (!h.pausedUntil || +new Date(h.pausedUntil) > now);
}
export function texExistingEntryV242(state = {}) {
  const memory = state.metadata?.perAgentMemory?.tex_ultra_ec || {};
  return Boolean(memory.initialLayerCadence || memory.presentationSentAt || memory.universalIntroSentAt || memory.bottleSentAt || memory.proofSentAt);
}

export function createTexUltraLinkedEntryV242({ directory, now = Date.now, minFreeBytes = 250 * 1024 * 1024,
  maxRecords = 10000, officialPhone, allowQa = () => false, currentContactHold = async () => false } = {}) {
  if (!path.isAbsolute(directory || '') || !/^\d{10,15}$/.test(officialPhone || '')) throw Error('tex_link_configuration');
  const dirs = ['pending', 'codes', 'links', 'journeys', 'locks', 'limits'];
  const file = (kind, id) => path.join(directory, kind, id + '.json');
  const phoneId = phone => hash('VITALISMEN_EC:tex_ultra_ec:zapi:' + officialPhone + ':' + phone);
  const validPhone = value => /^593[2-79]\d{8}$/.test(value || '') || value === '5515998038637' && allowQa(value) === true;
  const expired = value => !value || !Number.isFinite(value.expiresAt) || value.expiresAt <= now();
  async function initialize() {
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    for (const dir of dirs) await fs.mkdir(path.join(directory, dir), { mode: 0o700 }).catch(e => { if (e.code !== 'EEXIST') throw e; });
  }
  async function read(target) {
    let handle;
    try {
      handle = await fs.open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
      const stat = await handle.stat(); if (!stat.isFile() || stat.size > 16384) throw Error('tex_link_record_invalid');
      const bytes = Buffer.alloc(16385), result = await handle.read(bytes, 0, bytes.length, 0);
      if (result.bytesRead > 16384) throw Error('tex_link_record_invalid');
      return JSON.parse(bytes.subarray(0, result.bytesRead).toString());
    } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    finally { await handle?.close(); }
  }
  async function write(target, value) {
    const bytes = JSON.stringify(value); if (Buffer.byteLength(bytes) > 16384) throw Error('tex_link_record_invalid');
    const tmp = target + '.' + randomBytes(8).toString('hex'); let handle;
    try { handle = await fs.open(tmp, 'wx', 0o600); await handle.writeFile(bytes); await handle.sync(); await handle.close(); handle = null; await fs.rename(tmp, target); }
    finally { await handle?.close(); await fs.unlink(tmp).catch(() => {}); }
  }
  async function lock(key, work) {
    await initialize(); const target = file('locks', hash(key)), token = randomBytes(16).toString('hex'); let handle;
    try { handle = await fs.open(target, 'wx', 0o600); }
    catch (error) { if (error.code === 'EEXIST') throw Error('tex_link_busy'); throw error; }
    try { await handle.writeFile(JSON.stringify({ token, startedAt: now() })); await handle.sync(); return await work(); }
    finally { await handle.close(); const saved = await read(target); if (saved?.token === token) await fs.unlink(target); }
  }
  async function capacity(kind) {
    let names = await fs.readdir(path.join(directory, kind));
    if (names.length >= maxRecords && kind !== 'journeys') {
      for (const name of names) {
        if (!/^[a-f0-9]{64}\.json$/.test(name)) continue;
        const target = path.join(directory, kind, name), value = await read(target);
        if (expired(value)) await fs.unlink(target);
      }
      names = await fs.readdir(path.join(directory, kind));
    }
    const count = names.length;
    if (count >= maxRecords) throw Error('tex_link_capacity');
    if (minFreeBytes > 0) { const disk = await fs.statfs(directory); if (Number(disk.bavail) * Number(disk.bsize) < minFreeBytes) throw Error('tex_link_capacity'); }
  }
  async function reserveJourney(phone, channel, { existingEntry = false, blocked = false } = {}) {
    const id = phoneId(phone);
    return lock('phone:' + id, async () => {
      let journey = await read(file('journeys', id));
      if (!journey) journey = await lock('admission', async () => {
        await capacity('journeys');
        const value = { version: 242, productKey: 'tex_ultra_ec', id, firstChannel: existingEntry ? 'whatsapp' : channel,
          firstContactAt: now(), entryAttempted: existingEntry || channel === 'whatsapp', blocked: Boolean(blocked) };
        await write(file('journeys', id), value); return value;
      });
      if (blocked && !journey.blocked) { journey = { ...journey, blocked: true }; await write(file('journeys', id), journey); }
      return journey;
    });
  }
  async function identity(sessionId) {
    if (!SESSION.test(sessionId || '')) throw Error('tex_link_session_required');
    await initialize(); const link = await read(file('links', sessionId));
    if (expired(link) || link.sessionId !== sessionId || !validPhone(link.phone)) return null;
    const journey = await read(file('journeys', phoneId(link.phone)));
    if (!journey || journey.id !== link.journeyId || journey.productKey !== 'tex_ultra_ec') throw Error('tex_link_record_invalid');
    const liveHold = await Promise.resolve().then(() => currentContactHold(link.phone)).catch(() => true);
    return { ...link, firstChannel: journey.firstChannel, entryAttempted: journey.entryAttempted, blocked: journey.blocked || liveHold === true };
  }
  return Object.freeze({ identity,
    async issue({ sessionId, requestId, phone, firstName }) {
      if (!SESSION.test(sessionId || '') || !/^[a-zA-Z0-9_-]{12,80}$/.test(requestId || '')) throw Error('tex_link_request_invalid');
      if (!validPhone(phone) || typeof firstName !== 'string' || !firstName || firstName.length > 30) throw Error('tex_link_input_invalid');
      return lock('session:' + sessionId, async () => {
        const linked = await identity(sessionId);
        if (linked) { if (linked.phone !== phone) throw Error('tex_link_already_verified'); return { ok: true, verified: true }; }
        const pending = await read(file('pending', sessionId));
        if (!expired(pending) && pending.phone === phone && pending.firstName === firstName) return pending.public;
        await lock('admission', async () => {
          await capacity('pending'); await capacity('codes'); await capacity('limits');
          const day = new Date(now()).toISOString().slice(0, 10), id = phoneId(phone), previous = await read(file('limits', id));
          const limit = previous?.day === day ? previous : { day, count: 0 };
          if (limit.count >= 3) throw Error('tex_link_limit');
          await write(file('limits', id), { day, count: limit.count + 1, expiresAt: now() + 86400000 });
        });
        const code = 'TX242-' + randomBytes(32).toString('hex'), expiresAt = now() + 600000;
        const message = TEX_LINK_PREFIX_V242 + code;
        const response = { ok: true, verified: false, verificationUrl: 'https://wa.me/' + officialPhone + '?text=' + encodeURIComponent(message), expiresAt };
        await write(file('codes', hash(code)), { sessionId, expiresAt });
        await write(file('pending', sessionId), { sessionId, requestId, phone, firstName, codeHash: hash(code), expiresAt, public: response });
        return response;
      });
    },
    async confirmFromOfficialInbound({ code, phone, existingEntry = false, blocked = false, inboundId, verifiedInbound }) {
      if (!CODE.test(code || '') || !validPhone(phone) || !inboundId || verifiedInbound !== true) return { confirmed: false };
      await initialize(); const index = await read(file('codes', hash(code)));
      if (expired(index) || !SESSION.test(index.sessionId || '')) return { confirmed: false };
      return lock('session:' + index.sessionId, async () => {
        const pending = await read(file('pending', index.sessionId));
        if (expired(pending) || pending.codeHash !== hash(code) || pending.phone !== phone) return { confirmed: false };
        const already = await identity(index.sessionId);
        if (already) return { confirmed: true, duplicate: true, firstChannel: already.firstChannel };
        const journey = await reserveJourney(phone, 'web', { existingEntry, blocked });
        await lock('admission', async () => { await capacity('links'); await write(file('links', index.sessionId), {
          version: 242, sessionId: index.sessionId, journeyId: journey.id, phone, firstName: pending.firstName,
          verifiedAt: now(), expiresAt: now() + 604800000, verifiedBy: 'official_zapi_inbound', inboundId
        }); });
        return { confirmed: true, firstChannel: journey.firstChannel };
      });
    },
    async observeWhatsapp({ phone, existingEntry = false, blocked = false, verifiedInbound }) {
      if (!validPhone(phone) || verifiedInbound !== true) return null;
      return reserveJourney(phone, 'whatsapp', { existingEntry, blocked });
    },
    async claimWebEntry(sessionId, requestId) {
      const link = await identity(sessionId); if (!link) throw Error('tex_link_verification_required');
      return lock('phone:' + link.journeyId, async () => {
        const journey = await read(file('journeys', link.journeyId));
        if (link.blocked || journey.blocked || journey.firstChannel !== 'web' || journey.entryAttempted) return { allowed: false, identity: link };
        await write(file('journeys', link.journeyId), { ...journey, entryAttempted: true, entryAttemptedAt: now(), webRequestId: requestId });
        return { allowed: true, identity: link };
      });
    }
  });
}
