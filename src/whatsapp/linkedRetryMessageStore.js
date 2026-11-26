import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { proto } from '@whiskeysockets/baileys';

const MAX_BYTES = 1024 * 1024;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const fileName = (id) => `${crypto.createHash('sha256').update(String(id)).digest('hex')}.pb`;

export const saveLinkedRetryMessage = async (authDir, response) => {
    const id = String(response?.key?.id || '').trim();
    if (!id || !response?.key?.fromMe || !response?.message) return false;
    const payload = Buffer.from(proto.Message.encode(response.message).finish());
    if (!payload.length || payload.length > MAX_BYTES) return false;
    const dir = path.join(authDir, 'outbound-retry');
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
    if (process.platform !== 'win32') await fs.chmod(dir, 0o700);
    const file = path.join(dir, fileName(id));
    const temp = path.join(dir, `${fileName(id)}.${crypto.randomBytes(8).toString('hex')}.tmp`);
    try {
        await fs.writeFile(temp, payload, { flag: 'wx', mode: 0o600 });
        await fs.rename(temp, file);
        return true;
    } catch (error) {
        await fs.unlink(temp).catch(() => {});
        throw error;
    }
};

export const loadLinkedRetryMessage = async (authDir, key) => {
    const id = String(key?.id || '').trim();
    if (!id) return undefined;
    const file = path.join(authDir, 'outbound-retry', fileName(id));
    try {
        const stat = await fs.stat(file);
        if (!stat.isFile() || stat.size < 1 || stat.size > MAX_BYTES || Date.now() - stat.mtimeMs > MAX_AGE_MS) return undefined;
        return proto.Message.decode(await fs.readFile(file));
    } catch (error) {
        if (error.code === 'ENOENT') return undefined;
        throw error;
    }
};

export const pruneLinkedRetryMessages = async (authDir) => {
    const dir = path.join(authDir, 'outbound-retry');
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch((error) => {
        if (error.code === 'ENOENT') return [];
        throw error;
    });
    const files = [];
    for (const entry of entries) {
        if (!entry.isFile() || !/^[a-f0-9]{64}\.pb$/.test(entry.name)) continue;
        const file = path.join(dir, entry.name);
        const stat = await fs.stat(file).catch(() => null);
        if (stat) files.push({ file, mtimeMs: stat.mtimeMs });
    }
    files.sort((a, b) => b.mtimeMs - a.mtimeMs);
    for (const [index, item] of files.entries()) {
        if (index >= 1000 || Date.now() - item.mtimeMs > MAX_AGE_MS) await fs.unlink(item.file).catch(() => {});
    }
};
