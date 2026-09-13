import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { manualUploadsDirV129, manualUploadUrlFromPathV129 } from './manualMediaStorageV129Service.js';

export const PANEL_FUNNEL_MEDIA_UPLOAD_V153_MAX_BYTES = 80 * 1024 * 1024;

const EXTENSION_BY_MIME = Object.freeze({
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/ogg': 'ogg',
    'audio/opus': 'opus',
    'audio/mp4': 'm4a',
    'audio/aac': 'aac',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/webm': 'webm',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/heic': 'heic',
    'image/heif': 'heif',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/webm': 'webm'
});
const MIME_BY_EXTENSION = Object.freeze(Object.entries(EXTENSION_BY_MIME).reduce((map, [mime, extension]) => {
    if (!map[extension]) map[extension] = mime;
    return map;
}, {}));

const clean = (value = '') => String(value || '').trim();
const decodeHeader = (value = '') => {
    try { return decodeURIComponent(clean(value)); } catch { return clean(value); }
};
const safeDisplayName = (value = '') => path.basename(decodeHeader(value)).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 180);

export const classifyPanelFunnelUploadV153 = ({ fileName = '', mime = '' } = {}) => {
    const displayName = safeDisplayName(fileName || 'arquivo');
    const extension = path.extname(displayName).slice(1).toLowerCase();
    const normalizedMime = clean(mime).toLowerCase().split(';')[0];
    const mimeExtension = EXTENSION_BY_MIME[normalizedMime] || '';
    const resolvedExtension = mimeExtension || (MIME_BY_EXTENSION[extension] ? extension : '');
    const resolvedMime = normalizedMime && EXTENSION_BY_MIME[normalizedMime]
        ? normalizedMime
        : (MIME_BY_EXTENSION[resolvedExtension] || '');
    const mediaType = resolvedMime.startsWith('audio/')
        ? 'audio'
        : resolvedMime.startsWith('image/')
            ? 'image'
            : resolvedMime.startsWith('video/')
                ? 'video'
                : '';
    if (!resolvedExtension || !resolvedMime || !mediaType) {
        return Object.freeze({ ok: false, reason: 'unsupported_media_type' });
    }
    if (extension && MIME_BY_EXTENSION[extension] && mimeExtension && extension !== mimeExtension
        && !(extension === 'mpeg' && mimeExtension === 'mp3')) {
        return Object.freeze({ ok: false, reason: 'media_extension_mime_mismatch' });
    }
    return Object.freeze({ ok: true, displayName, extension: resolvedExtension, mime: resolvedMime, mediaType });
};
export const persistPanelFunnelMediaUploadV153 = ({
    bytes,
    fileName = '',
    label = '',
    mime = '',
    storageOptions,
    now = () => Date.now(),
    randomBytes = crypto.randomBytes
} = {}) => {
    if (!Buffer.isBuffer(bytes) || bytes.length === 0) {
        const error = new Error('empty_media_payload');
        error.statusCode = 400;
        throw error;
    }
    if (bytes.length > PANEL_FUNNEL_MEDIA_UPLOAD_V153_MAX_BYTES) {
        const error = new Error('media_payload_too_large');
        error.statusCode = 413;
        throw error;
    }
    const classification = classifyPanelFunnelUploadV153({ fileName, mime });
    if (!classification.ok) {
        const error = new Error(classification.reason);
        error.statusCode = 415;
        throw error;
    }
    const directory = manualUploadsDirV129(storageOptions);
    fs.mkdirSync(directory, { recursive: true, mode: 0o750 });
    const storedName = `${Number(now())}_${randomBytes(8).toString('hex')}.${classification.extension}`;
    const target = path.join(directory, storedName);
    fs.writeFileSync(target, bytes, { flag: 'wx', mode: 0o644 });
    const mediaUrl = manualUploadUrlFromPathV129(target, storageOptions);
    if (!mediaUrl) {
        fs.unlinkSync(target);
        throw new Error('media_url_resolution_failed');
    }
    return Object.freeze({
        ok: true,
        fileName: classification.displayName,
        storedName,
        label: decodeHeader(label).slice(0, 180),
        mime: classification.mime,
        mediaType: classification.mediaType,
        size: bytes.length,
        mediaUrl
    });
};
