import { createHash, createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
export const BRIDGE_VERSION = 1;
export const bridgeHash = text => createHash('sha256').update(text).digest('hex');
export const bridgeId = (kind, value) => `g21bridge_${kind}_${bridgeHash(value).slice(0, 28)}`;
export const technicalId = value => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,128}$/.test(value);
const principals = new WeakSet();
export const isVitalismenPrincipal = value => !!value && principals.has(value);
const fail = code => { throw Object.assign(new Error(code), { status: 401 }); };
const canonical = ({ method, path, timestamp, nonce, body }) => [String(method).toUpperCase(), path, String(timestamp), nonce, bridgeHash(body)].join('\n');
export function signVitalismenRequest({ secret, keyId, method, path, body = '', now = Date.now(), nonce = randomUUID() }) {
 if (typeof secret !== 'string' || secret.length < 32 || !technicalId(keyId) || !technicalId(nonce) || !path.startsWith('/api/integrations/vitalismen/')) fail('BRIDGE_CONFIGURATION_INVALID');
 const timestamp = String(Math.floor(now / 1000));
 return { 'x-g21-key-id': keyId, 'x-g21-timestamp': timestamp, 'x-g21-request-id': nonce,
  'x-g21-signature': createHmac('sha256', secret).update(canonical({ method, path, timestamp, nonce, body })).digest('hex'), 'content-type': 'application/json' };
}
export async function verifyVitalismenRequest(request, { secret, keyId, now = Date.now() }) {
 const url = new URL(request.url), body = await boundedBridgeBody(request);
 const kid = request.headers.get('x-g21-key-id'), timestamp = request.headers.get('x-g21-timestamp'), nonce = request.headers.get('x-g21-request-id'), signature = request.headers.get('x-g21-signature');
 if (typeof secret !== 'string' || secret.length < 32 || kid !== keyId || !technicalId(kid) || !technicalId(nonce)
  || !/^\d{10}$/.test(timestamp ?? '') || Math.abs(now - Number(timestamp) * 1000) > 300000 || !/^[a-f0-9]{64}$/.test(signature ?? '')) fail('BRIDGE_AUTHENTICATION_REQUIRED');
 const expected = createHmac('sha256', secret).update(canonical({ method: request.method, path: url.pathname + url.search, timestamp, nonce, body })).digest();
 if (!timingSafeEqual(expected, Buffer.from(signature, 'hex'))) fail('BRIDGE_SIGNATURE_INVALID');
 const principal = Object.freeze({ kind: 'VITALISMEN_S2S', subject: 'service:vitalismen-ec', keyId: kid, nonce, bodyHash: bridgeHash(body) });
 principals.add(principal); return { principal, body };
}
export async function boundedBridgeBody(request) {
 if (Number(request.headers.get('content-length') || 0) > 32768) throw Object.assign(Error('BRIDGE_BODY_TOO_LARGE'), { status: 413 });
 if (request.method === 'GET') return '';
 if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw Object.assign(Error('BRIDGE_JSON_REQUIRED'), { status: 415 });
 const reader = request.body?.getReader(); if (!reader) throw Object.assign(Error('BRIDGE_BODY_REQUIRED'), { status: 400 });
 const chunks = []; let length = 0;
 try { for (;;) { const part = await reader.read(); if (part.done) break; length += part.value.byteLength; if (length > 32768) { await reader.cancel(); throw Object.assign(Error('BRIDGE_BODY_TOO_LARGE'), { status: 413 }); } chunks.push(part.value); } }
 finally { reader.releaseLock(); }
 const bytes = new Uint8Array(length); let offset = 0; for (const part of chunks) { bytes.set(part, offset); offset += part.byteLength; }
 return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}
