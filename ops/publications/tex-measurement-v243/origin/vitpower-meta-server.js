'use strict';

const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const crypto = require('node:crypto');
const net = require('node:net');

const EVENTS = new Set(['PageView', 'ViewContent', 'InitiateCheckout']);
const PAGES = new Set(['/tex', '/tex/', '/bienestar', '/bienestar/', '/vitpower', '/vitpower/', '/vitpoers', '/vitpoers/']);
const ATTRIBUTION = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_id',
  'utm_content', 'utm_term', 'fbclid', 'campaign_id', 'adset_id', 'ad_id', 'placement'];
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const clean = (value, max = 256) => typeof value === 'string' ? value.trim().slice(0, max) : '';

function fail(message) {
  const error = new Error(message);
  error.status = 400;
  throw error;
}

function sourceUrl(value, config) {
  let url;
  try { url = new URL(value); } catch { return fail('invalid_source_url'); }
  if (!config.origins.includes(url.origin) || !PAGES.has(url.pathname) || url.username || url.password) {
    return fail('invalid_source_url');
  }
  const safe = new URL(url.origin + url.pathname);
  ATTRIBUTION.forEach(key => {
    const value = clean(url.searchParams.get(key), 256);
    if (value) safe.searchParams.set(key, value);
  });
  return safe;
}

function clientIp(req) {
  const headers = req.headers || {};
  const candidates = [headers['cf-connecting-ip'], headers['x-real-ip'],
    String(headers['x-forwarded-for'] || '').split(',')[0], req.socket?.remoteAddress];
  for (const candidate of candidates) {
    const value = clean(candidate).replace(/^::ffff:/, '');
    if (net.isIP(value)) return value;
  }
  return '';
}

function buildEvent(req, config, now = Date.now()) {
  const body = req.body || {};
  if (body.pixel_id !== config.pixel_id) fail('pixel_changed_reload_page');
  if (!EVENTS.has(body.event_name)) fail('invalid_event_name');
  if (!/^vp_[a-zA-Z0-9_-]{20,100}$/.test(body.event_id || '')) fail('invalid_event_id');
  const time = body.event_time;
  if (!Number.isInteger(time) || time < Math.floor((now - MAX_AGE) / 1000) || time > Math.floor(now / 1000) + 60) {
    fail('invalid_event_time');
  }
  const url = sourceUrl(body.event_source_url, config);
  const ua = clean(req.headers?.['user-agent'], 1024);
  if (!ua) fail('missing_user_agent');
  const user = { client_user_agent: ua };
  const ip = clientIp(req);
  if (ip) user.client_ip_address = ip;

  const cookies = req.cookies || {};
  for (const key of ['fbp', 'fbc']) {
    const value = clean(body[key] || cookies['_' + key], 512);
    if (/^fb\.\d{1,2}\.\d{10,16}\.[A-Za-z0-9_.-]{1,400}$/.test(value)) user[key] = value;
  }
  const external = clean(body.external_id || cookies.ext_id, 128);
  if (/^[A-Za-z0-9_-]{16,128}$/.test(external)) user.external_id = [hash(external)];

  // Only explicitly consented visitor data, never the business's WhatsApp number.
  if (body.matching_consent === true && body.matching && typeof body.matching === 'object') {
    const fields = { email: 'em', phone: 'ph', first_name: 'fn', last_name: 'ln',
      city: 'ct', state: 'st', postal_code: 'zp', country: 'country' };
    for (const [input, output] of Object.entries(fields)) {
      let value = clean(body.matching[input], 256).toLowerCase();
      if (input === 'phone') {
        // Require the visitor's international number; do not guess a country code.
        if (!/^\+\d[\d\s().-]{6,24}$/.test(value)) continue;
        value = value.replace(/\D/g, '');
        if (!/^\d{7,15}$/.test(value)) continue;
      } else if (input === 'email') {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) continue;
      } else {
        value = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
        if (input === 'country' && !/^[a-z]{2}$/.test(value)) continue;
      }
      if (value) user[output] = [hash(value)];
    }
  }
  if (body.matching_consent === true && body.matching_hashes && typeof body.matching_hashes === 'object') {
    for (const field of ['em', 'ph', 'fn', 'ln', 'ct', 'st', 'zp', 'country']) {
      const value = body.matching_hashes[field];
      if (typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)) user[field] = [value];
    }
  }
  const country = clean(req.headers?.['cf-ipcountry']).toLowerCase();
  if (!user.country && /^[a-z]{2}$/.test(country) && country !== 'xx') user.country = [hash(country)];
  const custom = {};
  for (const key of ATTRIBUTION) {
    const value = url.searchParams.get(key);
    if (value && key !== 'fbclid') custom[key] = value;
  }
  if (body.event_name !== 'PageView') {
    const plusmenTex = /^(www\.)?plusmen\.shop$/.test(url.hostname) && /^\/tex\/?$/.test(url.pathname);
    Object.assign(custom, { content_ids: [plusmenTex ? 'tex_ultra_ec' : 'vitpower'], content_type: 'product',
      content_name: plusmenTex ? 'Tex Ultra Ecuador' : 'VitPower', num_items: 1 });
  }
  return { event_name: body.event_name, event_id: body.event_id, event_time: time,
    action_source: 'website', event_source_url: url.href, user_data: user, custom_data: custom };
}

async function atomicWrite(file, record, exclusive = false) {
  const temporary = file + '.' + crypto.randomUUID() + '.tmp';
  try {
    const handle = await fsp.open(temporary, 'wx', 0o600);
    try {
      await handle.writeFile(JSON.stringify(record));
      await handle.sync();
    } finally { await handle.close(); }
    if (exclusive) await fsp.link(temporary, file);
    else await fsp.rename(temporary, file);
    const directory = await fsp.open(path.dirname(file), 'r');
    try { await directory.sync(); } finally { await directory.close(); }
  } finally { await fsp.unlink(temporary).catch(() => {}); }
}

async function sendToMeta(event, config) {
  const payload = { data: [event] };
  if (config.test_event_code) payload.test_event_code = config.test_event_code;
  try {
    const response = await fetch(`https://graph.facebook.com/${config.graph_version}/${config.pixel_id}/events`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + config.access_token },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(10000)
    });
    const data = await response.json().catch(() => ({}));
    const accepted = response.ok && Number(data.events_received) > 0;
    return { accepted, retryable: !accepted && (response.status === 429 || response.status >= 500 || data.error?.is_transient === true),
      status: response.status, code: data.error?.code, subcode: data.error?.error_subcode,
      events_received: Number(data.events_received) || 0, fbtrace_id: clean(data.fbtrace_id || data.error?.fbtrace_id) };
  } catch {
    return { accepted: false, retryable: true, status: 0, code: 'network_error' };
  }
}

function createVitpowerMeta(options = {}) {
  const root = options.root || __dirname;
  const config = options.config || JSON.parse(fs.readFileSync(path.join(root, 'private', 'meta', 'vitpower-config.json'), 'utf8'));
  if (!/^\d{5,25}$/.test(config.pixel_id || '') || !config.access_token || !/^v\d+\.0$/.test(config.graph_version || '') ||
      !Array.isArray(config.origins) || !config.origins.length) throw new Error('invalid_vitpower_meta_config');
  const directory = options.directory || path.join(root, 'private', 'meta', 'vitpower-outbox-' + config.pixel_id);
  const logger = options.logger || { info() {}, warn() {}, error() {} };
  const send = options.send || (event => sendToMeta(event, config));
  const now = options.now || Date.now;
  let timer;
  let running = false;

  async function enqueue(req) {
    const origin = clean(req.headers?.origin);
    if (!config.origins.includes(origin) || req.headers?.['sec-fetch-site'] === 'cross-site') {
      const error = new Error('invalid_origin'); error.status = 403; throw error;
    }
    const event = buildEvent(req, config, now());
    await fsp.mkdir(directory, { recursive: true, mode: 0o700 });
    const key = hash(config.pixel_id + ':' + event.event_name + ':' + event.event_id);
    const file = path.join(directory, key + '.json');
    const record = { state: 'pending', created_at: now(), next_attempt: now(), attempts: 0,
      event_name: event.event_name, event_id: event.event_id, event };
    try {
      await atomicWrite(file, record, true);
      return { duplicate: false };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      return { duplicate: true };
    }
  }

  async function drain() {
    if (running) return;
    running = true;
    try {
      await fsp.mkdir(directory, { recursive: true, mode: 0o700 });
      const entries = await fsp.readdir(directory);
      for (const name of entries.filter(file => /^[a-f0-9]{64}\.json\.[a-f0-9-]+\.tmp$/.test(file))) {
        const file = path.join(directory, name);
        if (now() - (await fsp.stat(file)).mtimeMs > MAX_AGE) await fsp.unlink(file);
      }
      const files = entries.filter(file => /^[a-f0-9]{64}\.json$/.test(file));
      let sent = 0;
      for (const name of files) {
        const file = path.join(directory, name);
        let record;
        try { record = JSON.parse(await fsp.readFile(file, 'utf8')); } catch { continue; }
        if (now() - record.created_at >= MAX_AGE) {
          if (record.state === 'pending') logger.warn({ msg: 'vitpower_meta_expired', event_id: record.event_id, event_name: record.event_name });
          await fsp.unlink(file);
          continue;
        }
        if (record.state !== 'pending' || record.next_attempt > now() || sent >= 25) continue;
        sent++;
        let result;
        try { result = await send(record.event); } catch { result = { accepted: false, retryable: true, status: 0 }; }
        record.attempts++;
        record.result = result;
        if (result.accepted) {
          record.state = 'sent';
          record.sent_at = now();
          delete record.event;
          logger.info({ msg: 'vitpower_meta_accepted', event_id: record.event_id, event_name: record.event_name, ...result });
        } else if (result.retryable) {
          record.next_attempt = now() + Math.min(60 * 60 * 1000, 5000 * 2 ** Math.min(record.attempts, 10));
          logger.warn({ msg: 'vitpower_meta_retry', event_id: record.event_id, event_name: record.event_name, attempt: record.attempts, ...result });
        } else {
          record.state = 'failed';
          delete record.event;
          logger.error({ msg: 'vitpower_meta_rejected', event_id: record.event_id, event_name: record.event_name, ...result });
        }
        await atomicWrite(file, record);
      }
    } catch (error) {
      logger.error({ msg: 'vitpower_meta_outbox_error', code: error.code || 'outbox_error' });
    } finally { running = false; }
  }

  async function handler(req, res) {
    res.set('Cache-Control', 'no-store');
    try {
      const result = await enqueue(req);
      res.status(202).json({ ok: true, queued: true, ...result, event_id: req.body.event_id });
      setImmediate(drain);
    } catch (error) {
      res.status(error.status || 503).json({ ok: false, reason: error.status ? error.message : 'queue_unavailable' });
    }
  }

  function start() {
    if (timer) return;
    timer = setInterval(drain, 10000);
    timer.unref();
    void drain();
    logger.info({ msg: 'vitpower_meta_ready', pixel_id: config.pixel_id, graph_version: config.graph_version });
  }
  function stop() { clearInterval(timer); timer = null; }
  return { handler, enqueue, drain, start, stop };
}

module.exports = { createVitpowerMeta, buildEvent, sendToMeta };
