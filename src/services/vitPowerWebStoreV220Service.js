// Dedicated bounded anonymous web sessions. Never reads/writes commercial MongoDB.
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
const hash = x => createHash('sha256').update(x).digest('hex');
const DAY = 86400000, TTL = 7 * DAY;
export function createVitPowerWebStoreV220({ directory, now = () => Date.now(), maxSessions = 1000, maxBytes = 16 * 1024 * 1024, dailyTurns = 200, minFreeBytes = 250 * 1024 * 1024 }) {
  if (!path.isAbsolute(directory)) throw Error('web_store_absolute_path_required');
  const sessions = path.join(directory, 'sessions');
  const inFlight = new Set();
  async function initialize() { await fs.mkdir(sessions, { recursive: true, mode: 0o700 }); await fs.chmod(directory, 0o700); await fs.chmod(sessions, 0o700); }
  async function atomic(file, value) {
    if (path.dirname(file) === sessions && Buffer.byteLength(JSON.stringify(value)) > 128 * 1024) throw Error('web_store_capacity');
    const tmp = file + '.' + randomBytes(8).toString('hex') + '.tmp';
    try { const h = await fs.open(tmp, 'wx', 0o600); try { await h.writeFile(JSON.stringify(value)); await h.sync(); } finally { await h.close(); } await fs.rename(tmp, file); }
    finally { await fs.unlink(tmp).catch(() => {}); }
  }
  async function load(file) { try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return null; throw Error('web_store_unreadable'); } }
  function filename(token) { if (!/^[a-f0-9]{64}$/.test(token || '')) return null; return path.join(sessions, hash(token) + '.json'); }
  async function capacity() {
    let count = 0, bytes = 0;
    for (const name of await fs.readdir(sessions)) {
      if (!/^[a-f0-9]{64}\.json$/.test(name)) continue;
      const file = path.join(sessions, name), record = await load(file);
      if (record && record.expiresAt <= now()) { await fs.unlink(file); continue; }
      count++; bytes += (await fs.stat(file)).size;
    }
    const disk = minFreeBytes > 0 ? await fs.statfs(directory) : null;
    if (disk && Number(disk.bavail) * Number(disk.bsize) < minFreeBytes || count >= maxSessions || bytes >= maxBytes) throw Error('web_store_capacity');
  }
  let admissionTail = Promise.resolve();
  const product = context => context?.productKey === 'tex_ultra_ec' ? 'tex_ultra_ec' : 'vit_power_ec';
  const owned = (record, context) => (record?.productKey || 'vit_power_ec') === product(context);
  async function open(token, context) {
    await initialize(); const file = filename(token), value = file ? await load(file) : null;
    if (value && value.expiresAt > now() && value.version === 220 && owned(value, context)) return { token, value, fresh: false };
    const task = admissionTail.then(async () => {
    await capacity(); token = randomBytes(32).toString('hex');
    const created = { version: 220, createdAt: now(), expiresAt: now() + TTL, history: [], draft: {}, requests: {}, turnCount: 0 };
    if (product(context) === 'tex_ultra_ec') Object.assign(created, { productKey: 'tex_ultra_ec', productName: 'Tex Ultra Ecuador', sourceOrigin: 'https://plusmen.shop', sourcePath: '/tex' });
    await atomic(filename(token), created); return { token, value: created, fresh: true };
    });
    admissionTail = task.catch(() => {}); return task;
  }
  async function quota() {
    const file = path.join(directory, 'quota.json'), day = new Date(now()).toISOString().slice(0, 10);
    const record = await load(file); const q = record?.day === day ? record : { day, turns: 0 };
    if (q.turns >= dailyTurns) throw Error('web_chat_daily_limit');
    q.turns++; await atomic(file, q);
  }
  // One PM2 application owns this store. The process mutex also protects quota reservations.
  let quotaTail = Promise.resolve();
  function reserveQuota() { const task = quotaTail.then(quota); quotaTail = task.catch(() => {}); return task; }
  return Object.freeze({ open, async transact(token, requestId, message, run, context) {
    if (!/^[a-zA-Z0-9_-]{12,80}$/.test(requestId || '')) throw Error('web_chat_request_id');
    const file = filename(token); if (!file) throw Error('web_chat_session_required');
    if (inFlight.has(file)) throw Error('web_chat_session_busy');
    inFlight.add(file);
    try {
      const record = await load(file); if (!record || record.expiresAt <= now() || !owned(record, context)) throw Error('web_chat_session_expired');
      const previous = record.requests[requestId], digest = hash(message);
      if (previous) {
        if (previous.digest !== digest) throw Error('web_chat_request_id_conflict');
        if (previous.status !== 'done') throw Error('web_chat_previous_outcome_uncertain');
        return { ...previous.response, duplicate: true };
      }
      if (record.turnCount >= 20) throw Error('web_chat_session_limit');
      await reserveQuota();
      record.requests[requestId] = { digest, status: 'processing', at: now() }; record.turnCount++;
      await atomic(file, record);
      try {
        const response = await run({ history: record.history, draft: record.draft });
        if (typeof response.reply !== 'string' || response.reply.length > 2200) throw Error('web_chat_response_invalid');
        const at = new Date(now()).toISOString();
        record.history = [...record.history, { role: 'user', content: response.redactedInput ? 'Consulta privada: contenido no almacenado.' : message, at }, { role: 'assistant', content: response.reply, at }].slice(-40);
        record.draft = response.draft || record.draft;
        const result = { ok: true, reply: response.reply, handoff: response.handoff === true, redactedInput: response.redactedInput === true, at, modelUsed: response.modelUsed === true };
        record.requests[requestId] = { digest, status: 'done', at: now(), response: result };
        await atomic(file, record); return result;
      } catch (error) {
        record.requests[requestId] = { digest, status: 'failed', at: now() };
        await atomic(file, record); throw error;
      }
    } finally { inFlight.delete(file); }
  }, async clear(token, context) {
    const file = filename(token); if (!file) return;
    if (inFlight.has(file)) throw Error('web_chat_session_busy');
    const record = await load(file); if (record && !owned(record, context)) throw Error('web_chat_session_expired');
    await fs.unlink(file).catch(e => { if (e.code !== 'ENOENT') throw e; });
  } });
}
