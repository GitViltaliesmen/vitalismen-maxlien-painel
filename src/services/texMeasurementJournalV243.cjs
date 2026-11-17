'use strict';
// PROJECT=VITALISMEN_EC. Durable measurement ledger; no customer-message sender.
const fs = require('node:fs/promises');
const { constants } = require('node:fs');
const path = require('node:path');
const { createHash, randomBytes } = require('node:crypto');
const hash = value => createHash('sha256').update(value).digest('hex');
function createJournal({ directory, now = Date.now, maxRecords = 20000, minFreeBytes = 256 * 1024 * 1024 }) {
  if (!path.isAbsolute(directory || '')) throw Error('tex_measurement_directory');
  const file = (kind, key) => {
    if (!/^[a-z_]{1,24}$/.test(kind) || !/^[a-f0-9]{64}$/.test(key)) throw Error('tex_measurement_key');
    return path.join(directory, kind, key + '.json');
  };
  async function prepare(kind) {
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    const stat = await fs.lstat(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o077)) throw Error('tex_measurement_directory');
    await fs.mkdir(path.join(directory, kind), { mode: 0o700 }).catch(e => { if (e.code !== 'EEXIST') throw e; });
    const child = await fs.lstat(path.join(directory, kind));
    if (!child.isDirectory() || child.isSymbolicLink() || (child.mode & 0o077)) throw Error('tex_measurement_directory');
  }
  async function read(kind, key) {
    let handle;
    try {
      handle = await fs.open(file(kind, key), constants.O_RDONLY | constants.O_NOFOLLOW);
      const s = await handle.stat();
      if (!s.isFile() || s.size > 32768 || (s.mode & 0o077)) throw Error('tex_measurement_record');
      const b = Buffer.alloc(32769), r = await handle.read(b, 0, b.length, 0);
      if (r.bytesRead > 32768) throw Error('tex_measurement_record');
      return JSON.parse(b.subarray(0, r.bytesRead).toString());
    } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
    finally { await handle?.close(); }
  }
  async function write(kind, key, value) {
    const target = file(kind, key); await prepare(kind);
    const text = JSON.stringify(value); if (Buffer.byteLength(text) > 32768) throw Error('tex_measurement_record');
    if (!await read(kind, key)) {
      if ((await fs.readdir(path.join(directory, kind))).length >= maxRecords) throw Error('tex_measurement_capacity');
      if (minFreeBytes > 0) { const s = await fs.statfs(directory); if (Number(s.bavail) * Number(s.bsize) < minFreeBytes) throw Error('tex_measurement_capacity'); }
    }
    const tmp = target + '.' + randomBytes(12).toString('hex'); let h;
    try {
      h = await fs.open(tmp, 'wx', 0o600); await h.writeFile(text); await h.sync(); await h.close(); h = null;
      await fs.rename(tmp, target);
      const d = await fs.open(path.dirname(target), 'r'); try { await d.sync(); } finally { await d.close(); }
    } finally { await h?.close(); await fs.unlink(tmp).catch(() => {}); }
  }
  async function lock(key, work) {
    await prepare('locks'); const target = file('locks', hash(key)); let h;
    try { h = await fs.open(target, 'wx', 0o600); }
    catch (e) { if (e.code === 'EEXIST') throw Error('tex_measurement_busy'); throw e; }
    const token = randomBytes(16).toString('hex');
    try { await h.writeFile(JSON.stringify({ version: 243, token, lockedAt: now() })); await h.sync(); return await work(); }
    finally {
      await h.close(); const current = await read('locks', hash(key));
      if (current?.token === token) await fs.unlink(target);
    }
  }
  return Object.freeze({ read, write, lock });
}
module.exports = { createJournal, hash };
