import fs from 'node:fs';
import path from 'node:path';
import { V78_PRODUCTION_ROOT, assertNoSymlinkTraversalV78 } from './mutableRuntimeArtifactV78Service.js';

// Same shared/media and shared/runtime convention as V30/V78. No release-local fallback in production.
const storagePath = (kind, { cwd = process.cwd(), productionRoot = V78_PRODUCTION_ROOT } = {}) => {
    const current = path.resolve(cwd);
    const official = path.resolve(productionRoot);
    const production = current === official || current.startsWith(official + path.sep);
    const allowedRoot = production ? official : current;
    const target = production
        ? path.join(official, 'shared', ...(kind === 'uploads' ? ['media', 'uploads'] : ['runtime', 'remote-media-cache']))
        : path.join(current, '.runtime', ...(kind === 'uploads' ? ['media', 'uploads'] : ['cache', 'remote-media']));
    assertNoSymlinkTraversalV78({ target, allowedRoot });
    return target;
};

export const manualUploadsDirV129 = options => storagePath('uploads', options);
export const remoteMediaCacheDirV129 = options => storagePath('cache', options);

export const manualUploadPathFromUrlV129 = (value = '', options) => {
    if (!String(value).startsWith('/media/uploads/')) return '';
    let name;
    try { name = decodeURIComponent(String(value).slice('/media/uploads/'.length)); } catch { return ''; }
    if (!name || name === '.' || name === '..' || /[\\/\0]/.test(name)) return '';
    const target = path.join(manualUploadsDirV129(options), name);
    assertNoSymlinkTraversalV78({ target, allowedRoot: manualUploadsDirV129(options) });
    return target;
};

export const manualUploadUrlFromPathV129 = (filePath = '', options) => {
    const root = manualUploadsDirV129(options);
    const target = path.resolve(String(filePath));
    return path.dirname(target) === root ? `/media/uploads/${encodeURIComponent(path.basename(target))}` : '';
};

// Legacy cache JSON remains byte-identical: resolve the file by its basename in the external cache.
export const relocatedRemoteCacheFileV129 = (meta, options) => {
    const name = path.basename(String(meta?.filePath || ''));
    if (!/^[a-f0-9]{64}\.[a-z0-9]{2,8}$/.test(name)) return '';
    const root = remoteMediaCacheDirV129(options);
    const target = path.join(root, name);
    assertNoSymlinkTraversalV78({ target, allowedRoot: root });
    return fs.existsSync(target) ? target : '';
};
