import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Message from '../models/Message.js';

export const INBOUND_MEDIA_STATUS = Object.freeze({
    RECEIVED: 'RECEIVED',
    FETCHING: 'FETCHING',
    STORED: 'STORED',
    READY: 'READY',
    FAILED: 'FAILED'
});

const MEDIA_ENDPOINT_PREFIX = '/api/whatsapp/media/';
const DEFAULT_TIMEOUT_MS = 20000;
const DEFAULT_MAX_REDIRECTS = 3;
const TYPE_MAX_BYTES = Object.freeze({
    image: 10 * 1024 * 1024,
    audio: 25 * 1024 * 1024,
    video: 40 * 1024 * 1024,
    document: 20 * 1024 * 1024
});

const cleanMime = (value = '') => String(value || '').split(';')[0].trim().toLowerCase();
const mediaKindFromMime = (mime = '') => {
    const clean = cleanMime(mime);
    if (clean.startsWith('image/')) return 'image';
    if (clean.startsWith('audio/')) return 'audio';
    if (clean.startsWith('video/')) return 'video';
    if (clean === 'application/pdf' || clean.startsWith('application/') || clean.startsWith('text/')) return 'document';
    return '';
};

const normalizedComparableMime = (mime = '') => ({
    'audio/mp3': 'audio/mpeg',
    'audio/opus': 'audio/ogg',
    'audio/x-m4a': 'audio/mp4',
    'audio/x-wav': 'audio/wav',
    'image/jpg': 'image/jpeg'
}[cleanMime(mime)] || cleanMime(mime));

const mimeIsGeneric = (mime = '') => ['', 'application/octet-stream', 'binary/octet-stream'].includes(cleanMime(mime));

const errorCodeForStatus = (status) => {
    if ([401, 403, 404].includes(Number(status))) return `provider_http_${status}`;
    return `provider_http_${Number(status) || 'error'}`;
};

export class InboundMediaError extends Error {
    constructor(code, message = code, statusCode = 422) {
        super(message);
        this.name = 'InboundMediaError';
        this.code = code;
        this.statusCode = statusCode;
    }
}

export const isAllowedInboundMediaUrl = (value = '') => {
    try {
        const parsed = new URL(String(value || ''));
        if (parsed.protocol !== 'https:') return false;
        const host = parsed.hostname.toLowerCase();
        return host === 'f004.backblazeb2.com'
            || host.endsWith('.backblazeb2.com')
            || host.endsWith('.z-api.io')
            || host.endsWith('.z-api.net');
    } catch {
        return false;
    }
};

export const inboundMediaStorageRoot = (env = process.env, cwd = process.cwd()) => {
    const configured = String(env.INBOUND_MEDIA_STORAGE_DIR || '').trim();
    if (configured) return path.resolve(configured);
    const normalizedCwd = path.resolve(cwd);
    if (normalizedCwd === '/opt/vitalismen-automacao' || normalizedCwd.startsWith('/opt/vitalismen-automacao/')) {
        return '/opt/vitalismen-automacao/shared/media/inbound';
    }
    return path.join(normalizedCwd, '.runtime', 'media', 'inbound');
};

export const inboundMediaInternalUrl = (messageId = '') => (
    `${MEDIA_ENDPOINT_PREFIX}${encodeURIComponent(String(messageId || ''))}`
);

const extensionForMime = (mime = '') => ({
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'audio/ogg': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/webm': 'webm',
    'audio/mp4': 'm4a',
    'audio/aac': 'aac',
    'video/webm': 'webm',
    'video/mp4': 'mp4',
    'application/pdf': 'pdf'
}[cleanMime(mime)] || 'bin');

const startsWithBytes = (buffer, bytes = []) => (
    buffer.length >= bytes.length && bytes.every((byte, index) => buffer[index] === byte)
);

export const detectInboundMediaSignature = (buffer, declaredMime = '') => {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        throw new InboundMediaError('empty_media', 'Provider returned an empty media file');
    }
    if (startsWithBytes(buffer, [0xff, 0xd8, 0xff])) return { mime: 'image/jpeg', codec: 'jpeg' };
    if (startsWithBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: 'image/png', codec: 'png' };
    if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
        return { mime: 'image/webp', codec: 'webp' };
    }
    if (buffer.subarray(0, 6).toString('ascii') === 'GIF87a' || buffer.subarray(0, 6).toString('ascii') === 'GIF89a') {
        return { mime: 'image/gif', codec: 'gif' };
    }
    if (buffer.subarray(0, 4).toString('ascii') === 'OggS') {
        const header = buffer.subarray(0, Math.min(buffer.length, 65536));
        if (header.includes(Buffer.from('OpusHead'))) return { mime: 'audio/ogg', codec: 'opus' };
        if (header.includes(Buffer.from('vorbis'))) return { mime: 'audio/ogg', codec: 'vorbis' };
        throw new InboundMediaError('unsupported_audio_codec', 'Ogg container has no supported Opus/Vorbis stream');
    }
    if (buffer.subarray(0, 3).toString('ascii') === 'ID3' || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)) {
        return { mime: 'audio/mpeg', codec: 'mp3' };
    }
    if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WAVE') {
        return { mime: 'audio/wav', codec: 'pcm' };
    }
    if (startsWithBytes(buffer, [0x1a, 0x45, 0xdf, 0xa3])) {
        const declaredKind = mediaKindFromMime(declaredMime);
        return declaredKind === 'video'
            ? { mime: 'video/webm', codec: 'webm' }
            : { mime: 'audio/webm', codec: 'webm' };
    }
    if (buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
        const declaredKind = mediaKindFromMime(declaredMime);
        return declaredKind === 'video'
            ? { mime: 'video/mp4', codec: 'mp4' }
            : { mime: 'audio/mp4', codec: 'mp4a' };
    }
    if (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] === 0xf1 || buffer[1] === 0xf9)) {
        return { mime: 'audio/aac', codec: 'aac' };
    }
    if (buffer.subarray(0, 5).toString('ascii') === '%PDF-') return { mime: 'application/pdf', codec: 'pdf' };
    throw new InboundMediaError('invalid_media_signature', 'Media signature is not supported');
};

const validateMediaContract = ({ detected, declaredMime = '', expectedType = '' }) => {
    const detectedKind = mediaKindFromMime(detected.mime);
    const declaredKind = mediaKindFromMime(declaredMime);
    const expectedKind = String(expectedType || '').toLowerCase() === 'ptt' ? 'audio' : String(expectedType || '').toLowerCase();
    if (expectedKind && ['image', 'audio', 'video', 'document'].includes(expectedKind) && expectedKind !== detectedKind) {
        throw new InboundMediaError('media_type_mismatch', `Expected ${expectedKind}, detected ${detectedKind || 'unknown'}`);
    }
    if (declaredKind && declaredKind !== detectedKind) {
        throw new InboundMediaError('mime_mismatch', `Declared ${cleanMime(declaredMime)}, detected ${detected.mime}`);
    }
    if (!mimeIsGeneric(declaredMime) && normalizedComparableMime(declaredMime) !== normalizedComparableMime(detected.mime)) {
        throw new InboundMediaError('mime_mismatch', `Declared ${cleanMime(declaredMime)}, detected ${detected.mime}`);
    }
};

const readResponseBuffer = async (response, maxBytes) => {
    const declaredLength = Number.parseInt(String(response.headers?.get?.('content-length') || ''), 10);
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
        throw new InboundMediaError('media_too_large', `Media is larger than ${maxBytes} bytes`, 413);
    }
    const chunks = [];
    let total = 0;
    if (!response.body) throw new InboundMediaError('empty_media', 'Provider returned no response body');
    for await (const chunk of response.body) {
        const value = Buffer.from(chunk);
        total += value.length;
        if (total > maxBytes) throw new InboundMediaError('media_too_large', `Media is larger than ${maxBytes} bytes`, 413);
        chunks.push(value);
    }
    return Buffer.concat(chunks, total);
};

export const downloadInboundMedia = async ({
    url,
    declaredMime = '',
    expectedType = '',
    fetchImpl = globalThis.fetch,
    allowUrl = isAllowedInboundMediaUrl,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxRedirects = DEFAULT_MAX_REDIRECTS,
    maxBytes = TYPE_MAX_BYTES[String(expectedType || '').toLowerCase()] || 25 * 1024 * 1024
} = {}) => {
    if (typeof fetchImpl !== 'function') throw new InboundMediaError('media_fetch_unavailable', 'Fetch implementation is unavailable', 500);
    let currentUrl = String(url || '').trim();
    if (!allowUrl(currentUrl)) throw new InboundMediaError('provider_url_not_allowed', 'Provider media URL is not allowlisted', 400);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.max(1000, Number(timeoutMs) || DEFAULT_TIMEOUT_MS));
    timeout.unref?.();
    try {
        for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
            let response;
            try {
                response = await fetchImpl(currentUrl, {
                    method: 'GET',
                    redirect: 'manual',
                    signal: controller.signal,
                    headers: { 'User-Agent': 'VitalismenInboundMedia/1.0', Accept: '*/*' }
                });
            } catch (error) {
                if (error?.name === 'AbortError') throw new InboundMediaError('provider_download_timeout', 'Provider media download timed out', 504);
                throw new InboundMediaError('provider_download_failed', error?.message || 'Provider media download failed', 502);
            }
            if ([301, 302, 303, 307, 308].includes(response.status)) {
                const location = response.headers.get('location');
                if (!location) throw new InboundMediaError('provider_redirect_without_location', 'Provider redirect has no location', 502);
                if (redirectCount >= maxRedirects) throw new InboundMediaError('provider_redirect_limit', 'Provider redirect limit exceeded', 502);
                currentUrl = new URL(location, currentUrl).toString();
                if (!allowUrl(currentUrl)) throw new InboundMediaError('provider_redirect_not_allowed', 'Provider redirected outside the allowlist', 400);
                continue;
            }
            if (!response.ok) {
                throw new InboundMediaError(errorCodeForStatus(response.status), `Provider returned HTTP ${response.status}`, response.status);
            }
            const responseMime = cleanMime(response.headers.get('content-type'));
            const effectiveDeclaredMime = cleanMime(declaredMime) || responseMime;
            const buffer = await readResponseBuffer(response, maxBytes);
            const detected = detectInboundMediaSignature(buffer, effectiveDeclaredMime);
            validateMediaContract({ detected, declaredMime: effectiveDeclaredMime, expectedType });
            if (!mimeIsGeneric(responseMime) && normalizedComparableMime(responseMime) !== normalizedComparableMime(detected.mime)) {
                throw new InboundMediaError('response_mime_mismatch', `Response ${responseMime}, detected ${detected.mime}`);
            }
            return {
                buffer,
                storedMime: detected.mime,
                codec: detected.codec,
                size: buffer.length,
                sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
                finalProviderUrl: currentUrl
            };
        }
        throw new InboundMediaError('provider_redirect_limit', 'Provider redirect limit exceeded', 502);
    } finally {
        clearTimeout(timeout);
    }
};

const safeStoragePath = (candidate = '', root = inboundMediaStorageRoot()) => {
    const resolvedRoot = path.resolve(root);
    const resolvedCandidate = path.resolve(String(candidate || ''));
    return resolvedCandidate.startsWith(`${resolvedRoot}${path.sep}`) ? resolvedCandidate : '';
};

export const isStoredInboundMediaPath = (candidate = '', root = inboundMediaStorageRoot()) => Boolean(
    safeStoragePath(candidate, root)
);

const existingReadyMedia = async ({ messageId, messageModel, storageRoot }) => {
    const existing = await messageModel.findById(messageId)
        .select('+storedMediaPath +mediaFetchLockToken +mediaFetchLockExpiresAt')
        .lean()
        .catch(() => null);
    const storedPath = safeStoragePath(existing?.storedMediaPath, storageRoot);
    if (existing?.mediaStorageStatus === INBOUND_MEDIA_STATUS.READY && storedPath && fs.existsSync(storedPath)) {
        return {
            status: INBOUND_MEDIA_STATUS.READY,
            cached: true,
            mediaUrl: existing.mediaUrl || inboundMediaInternalUrl(messageId),
            storedMime: existing.storedMime || '',
            size: existing.mediaSize || 0,
            sha256: existing.mediaSha256 || ''
        };
    }
    if (existing?.mediaStorageStatus === INBOUND_MEDIA_STATUS.READY) {
        await messageModel.updateOne({ _id: messageId }, {
            $set: {
                mediaStorageStatus: INBOUND_MEDIA_STATUS.FAILED,
                mediaDownloadError: 'stored_file_missing'
            }
        });
    }
    return null;
};

export const captureInboundMedia = async ({
    messageId,
    providerUrl,
    providerMediaId = '',
    originalMime = '',
    expectedType = '',
    receivedAt = new Date(),
    messageModel = Message,
    storageRoot = inboundMediaStorageRoot(),
    fetchImpl = globalThis.fetch,
    allowUrl = isAllowedInboundMediaUrl,
    timeoutMs = Number(process.env.INBOUND_MEDIA_FETCH_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)
} = {}) => {
    const cleanMessageId = String(messageId || '').trim();
    const internalUrl = inboundMediaInternalUrl(cleanMessageId);
    if (!cleanMessageId) throw new InboundMediaError('message_id_required', 'Message ID is required', 400);
    if (!providerUrl) {
        await messageModel.updateOne({ _id: cleanMessageId }, {
            $set: {
                mediaStorageStatus: INBOUND_MEDIA_STATUS.FAILED,
                mediaDownloadError: 'missing_provider_media_url',
                mediaUrl: '',
                mediaPreviewUrl: ''
            }
        });
        return { status: INBOUND_MEDIA_STATUS.FAILED, error: 'missing_provider_media_url' };
    }

    const ready = await existingReadyMedia({ messageId: cleanMessageId, messageModel, storageRoot });
    if (ready) return ready;

    const now = new Date();
    const lockToken = crypto.randomUUID();
    const lockExpiresAt = new Date(now.getTime() + Math.max(30000, Number(timeoutMs) + 10000));
    const claimed = await messageModel.findOneAndUpdate(
        {
            _id: cleanMessageId,
            $or: [
                { mediaStorageStatus: { $exists: false } },
                { mediaStorageStatus: { $nin: [INBOUND_MEDIA_STATUS.FETCHING, INBOUND_MEDIA_STATUS.READY] } },
                { mediaFetchLockExpiresAt: { $lte: now } }
            ]
        },
        {
            $set: {
                providerMediaId,
                originalMime: cleanMime(originalMime),
                mediaReceivedAt: receivedAt,
                mediaStorageStatus: INBOUND_MEDIA_STATUS.FETCHING,
                mediaDownloadError: '',
                mediaFetchLockToken: lockToken,
                mediaFetchLockExpiresAt: lockExpiresAt,
                mediaUrl: internalUrl,
                mediaPreviewUrl: internalUrl
            }
        },
        { new: true }
    ).select('+storedMediaPath +mediaFetchLockToken').lean().catch(() => null);

    if (!claimed || claimed.mediaFetchLockToken !== lockToken) {
        return { status: claimed?.mediaStorageStatus || INBOUND_MEDIA_STATUS.FETCHING, cached: false, inProgress: true };
    }

    try {
        const downloaded = await downloadInboundMedia({
            url: providerUrl,
            declaredMime: originalMime,
            expectedType,
            fetchImpl,
            allowUrl,
            timeoutMs
        });
        const date = receivedAt instanceof Date ? receivedAt : new Date(receivedAt || Date.now());
        const safeDate = Number.isFinite(date.getTime()) ? date : new Date();
        const key = crypto.createHash('sha256').update(cleanMessageId).digest('hex');
        const targetDir = path.join(
            path.resolve(storageRoot),
            String(safeDate.getUTCFullYear()),
            String(safeDate.getUTCMonth() + 1).padStart(2, '0'),
            String(safeDate.getUTCDate()).padStart(2, '0')
        );
        await fs.promises.mkdir(targetDir, { recursive: true, mode: 0o750 });
        const targetPath = path.join(targetDir, `${key}.${extensionForMime(downloaded.storedMime)}`);
        const tempPath = path.join(targetDir, `.${key}.${lockToken}.tmp`);
        await fs.promises.writeFile(tempPath, downloaded.buffer, { flag: 'wx', mode: 0o640 });
        await fs.promises.rename(tempPath, targetPath);
        await messageModel.updateOne(
            { _id: cleanMessageId, mediaFetchLockToken: lockToken },
            {
                $set: {
                    mediaStorageStatus: INBOUND_MEDIA_STATUS.STORED,
                    storedMediaPath: targetPath,
                    storedMime: downloaded.storedMime,
                    mediaCodec: downloaded.codec,
                    mediaSize: downloaded.size,
                    mediaSha256: downloaded.sha256,
                    mediaStoredAt: new Date(),
                    mediaDownloadError: ''
                }
            }
        );
        const stat = await fs.promises.stat(targetPath);
        if (!stat.isFile() || stat.size !== downloaded.size || stat.size <= 0) {
            throw new InboundMediaError('stored_file_verification_failed', 'Stored media verification failed', 500);
        }
        const readyAt = new Date();
        await messageModel.updateOne(
            { _id: cleanMessageId, mediaFetchLockToken: lockToken },
            {
                $set: {
                    mediaStorageStatus: INBOUND_MEDIA_STATUS.READY,
                    mediaReadyAt: readyAt,
                    mediaUrl: internalUrl,
                    mediaPreviewUrl: internalUrl,
                    mediaDownloadError: ''
                },
                $unset: {
                    mediaFetchLockToken: '',
                    mediaFetchLockExpiresAt: ''
                }
            }
        );
        return {
            status: INBOUND_MEDIA_STATUS.READY,
            cached: false,
            mediaUrl: internalUrl,
            storedMime: downloaded.storedMime,
            codec: downloaded.codec,
            size: downloaded.size,
            sha256: downloaded.sha256,
            readyAt
        };
    } catch (error) {
        const code = String(error?.code || 'provider_download_failed').slice(0, 120);
        await messageModel.updateOne(
            { _id: cleanMessageId, mediaFetchLockToken: lockToken },
            {
                $set: {
                    mediaStorageStatus: INBOUND_MEDIA_STATUS.FAILED,
                    mediaDownloadError: code,
                    mediaFailedAt: new Date(),
                    mediaUrl: internalUrl,
                    mediaPreviewUrl: internalUrl
                },
                $unset: {
                    mediaFetchLockToken: '',
                    mediaFetchLockExpiresAt: ''
                }
            }
        );
        return { status: INBOUND_MEDIA_STATUS.FAILED, error: code };
    }
};

export const loadStoredInboundMedia = async ({ filePath, maxBytes = 40 * 1024 * 1024, storageRoot = inboundMediaStorageRoot() } = {}) => {
    const safePath = safeStoragePath(filePath, storageRoot);
    if (!safePath) throw new InboundMediaError('stored_path_not_allowed', 'Stored media path is outside the authorized root', 403);
    const stat = await fs.promises.stat(safePath).catch(() => null);
    if (!stat?.isFile()) throw new InboundMediaError('stored_file_missing', 'Stored media file is missing', 404);
    if (stat.size <= 0) throw new InboundMediaError('empty_media', 'Stored media file is empty', 422);
    if (stat.size > maxBytes) throw new InboundMediaError('media_too_large', 'Stored media exceeds the read limit', 413);
    return { filePath: safePath, stat };
};
