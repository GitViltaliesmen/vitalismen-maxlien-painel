import crypto from 'node:crypto';
import fs from 'node:fs';

const used = new Map();
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const SECRET_FILE = '/var/lib/vitalismen-deploy/ec-postsale-v270-r1/hmac.secret';

export const loadPostSaleV270Secret = () => {
    if (process.getuid?.() === 0 && fs.existsSync(SECRET_FILE)) {
        const stat = fs.lstatSync(SECRET_FILE);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.uid !== 0 || stat.gid !== 0
            || stat.nlink !== 1 || (stat.mode & 0o777) !== 0o400) {
            throw new Error('v270_secret_permissions_invalid');
        }
        return fs.readFileSync(SECRET_FILE, 'utf8').trim();
    }
    if (globalThis.__VITALISMEN_SEALED_SUCCESSOR_CONTEXT) {
        throw new Error('v270_secret_file_missing');
    }
    return process.env.POST_SALE_V270_HMAC_SECRET || '';
};

export const authorizePostSaleLinkedV270 = (req, now = Date.now(), secretOverride) => {
    const body = req.body || {};
    const keys = Object.keys(body).sort();
    if (keys.join(',') !== 'issuedAt,mode,nonce') return false;
    if (!['dry-run', 'run'].includes(body.mode) || !/^[a-f0-9]{32}$/.test(body.nonce || '')) return false;
    if (!Number.isSafeInteger(body.issuedAt) || Math.abs(now - body.issuedAt) > 30_000) return false;
    if (!LOOPBACK.has(req.socket?.remoteAddress) || req.headers?.['x-forwarded-for']
        || req.headers?.['cf-connecting-ip']) return false;
    const secret = secretOverride === undefined ? loadPostSaleV270Secret() : secretOverride;
    const commit = process.env.POST_SALE_V270_COMMIT || '';
    if (secret.length < 64 || !/^[a-f0-9]{40}$/.test(commit)
        || globalThis.__VITALISMEN_SEALED_SUCCESSOR_CONTEXT?.commit !== commit) return false;
    const supplied = String(req.headers?.['x-postsale-v270-signature'] || '');
    if (!/^[a-f0-9]{64}$/.test(supplied)) return false;
    const expected = crypto.createHmac('sha256', secret)
        .update(`${body.issuedAt}.${body.nonce}.${body.mode}`).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(supplied, 'hex'), Buffer.from(expected, 'hex'))) return false;
    for (const [nonce, timestamp] of used) if (now - timestamp > 60_000) used.delete(nonce);
    if (used.has(body.nonce)) return false;
    used.set(body.nonce, now);
    return true;
};
