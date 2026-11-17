import { validateTexUltraEntryBlockV242 } from './texUltraEntryBlockV242Service.js';
import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';

const ID = /^[a-f0-9]{64}$/;
const clean = (value, max) => typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max) : '';
const date = value => Number.isFinite(new Date(value).getTime()) ? new Date(value).toISOString() : null;
export const hasExplicitWebDashboardBearerV222 = req => /^Bearer [^\s]{1,8192}$/.test(req?.headers?.authorization || '');

// This reader never initializes, expires, repairs or writes the public chat store.
export function createWebDashboardReaderV222({ directory, now = Date.now } = {}) {
    if (!directory || !path.isAbsolute(directory)) throw new Error('CHAT_STORE_UNAVAILABLE');
    const root = path.resolve(directory);
    async function read(id) {
        if (!ID.test(id || '')) return null;
        let handle;
        try {
            handle = await fs.open(path.join(root, id + '.json'), constants.O_RDONLY | constants.O_NOFOLLOW);
            const stat = await handle.stat();
            if (!stat.isFile() || stat.size > 131072 || stat.size < 2) return null;
            // Bound the read even if a concurrently replaced/growing file changes size.
            const bytes = Buffer.alloc(131073);
            const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
            if (bytesRead > 131072) return null;
            const record = JSON.parse(bytes.subarray(0, bytesRead).toString('utf8'));
            if (record.version !== 220 || !Number.isFinite(record.expiresAt) || record.expiresAt <= now()) return null;
            const history = (Array.isArray(record.history) ? record.history : []).slice(-40)
                .filter(item => item && ['user', 'assistant'].includes(item.role) && typeof item.content === 'string')
                .map(item => ({ role: item.role, content: clean(item.content, item.role === 'user' ? 700 : 2200), at: date(item.at), ...(record.productKey === 'tex_ultra_ec' && item.entryBlock ? { entryBlock: validateTexUltraEntryBlockV242(item.entryBlock) } : {}) }))
                .filter(item => item.content);
            if (!history.length) return null;
            const draft = record.draft && typeof record.draft === 'object' ? record.draft : {};
            const name = clean(draft.name, 80);
            const tex = record.productKey === 'tex_ultra_ec';
            if (record.productKey && !['vit_power_ec', 'tex_ultra_ec'].includes(record.productKey)) return null;
            return { id, ...(tex ? { productKey: 'tex_ultra_ec', productName: 'Tex Ultra Ecuador', sourceOrigin: 'https://plusmen.shop', sourcePath: '/tex', funnelStage: clean(draft.texUltraStage, 40), verifiedWhatsApp: /^593[2-79]\d{8}$/.test(draft.verifiedWhatsApp || '') ? draft.verifiedWhatsApp : null, firstContactChannel: ['web', 'whatsapp'].includes(draft.firstContactChannel) ? draft.firstContactChannel : null } : {}), name: name || null, city: clean(draft.city, 80) || null,
                quantity: (tex ? [1, 2, 3, 6] : [1, 3, 6]).includes(Number(draft.quantity)) ? Number(draft.quantity) : null,
                createdAt: date(record.createdAt), lastAt: history.at(-1).at || date(record.createdAt),
                messageCount: history.length, history };
        } catch (error) {
            if (['ENOENT', 'ELOOP', 'EISDIR'].includes(error.code) || error instanceof SyntaxError) return null;
            throw new Error('CHAT_STORE_UNAVAILABLE');
        } finally { await handle?.close(); }
    }
    return Object.freeze({
        async list() {
            let entries;
            try { entries = await fs.readdir(root, { withFileTypes: true }); }
            catch { throw new Error('CHAT_STORE_UNAVAILABLE'); }
            const records = [];
            const names = entries.filter(e => e.isFile() && /^[a-f0-9]{64}\.json$/.test(e.name)).map(e => e.name).sort().slice(0, 1000);
            for (const name of names) { const row = await read(name.slice(0, -5)); if (row) { const { history, ...summary } = row; records.push(summary); } }
            return records.sort((a, b) => String(b.lastAt).localeCompare(String(a.lastAt)));
        }, read
    });
}

export const createWebDashboardStoreReaderV222 = directory => createWebDashboardReaderV222({ directory: path.join(directory, 'sessions') });

export function productionWebDashboardReaderV222() {
    const capability = globalThis.__VITALISMEN_EC_WEB_CHAT_V220;
    if (process.env.VITALISMEN_EC_WEB_CHAT_V220 !== 'true' || capability?.kind !== 'ANONYMOUS_WEB_V220'
        || capability.storeDirectory !== '/var/lib/vitalismen-web-chat-v220-r2') throw new Error('CHAT_STORE_UNAVAILABLE');
    return createWebDashboardStoreReaderV222(capability.storeDirectory);
}
