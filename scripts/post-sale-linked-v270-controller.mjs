import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

const endpoint = 'http://127.0.0.1:3001/api/shipments/internal/post-sale-v270/cycle';

export const runPostSaleLinkedV270Controller = async ({
    mode,
    secret = process.env.POST_SALE_V270_HMAC_SECRET,
    request = fetch,
    now = Date.now(),
    nonce = crypto.randomBytes(16).toString('hex')
} = {}) => {
    if (!['dry-run', 'run'].includes(mode)) throw new Error('v270_controller_mode_invalid');
    if (String(secret || '').length < 64) throw new Error('v270_controller_secret_missing');
    const body = { issuedAt: now, mode, nonce };
    const signature = crypto.createHmac('sha256', secret)
        .update(`${body.issuedAt}.${body.nonce}.${body.mode}`).digest('hex');
    const response = await request(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-postsale-v270-signature': signature },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000)
    });
    const payload = await response.json();
    if (!response.ok || payload?.ok !== true || payload?.report?.mode !== mode
        || !Number.isSafeInteger(payload.report.physicalOutboundCount)
        || payload.report.physicalOutboundCount < 0
        || payload.report.physicalOutboundCount > 1
        || (mode === 'run' && payload.report.physicalOutboundCount === 1
            && (payload.report.provider !== 'baileys'
                || !String(payload.report.providerMessageId || '').trim()))) {
        throw new Error(`v270_controller_cycle_rejected:${response.status}:${payload?.code || 'invalid_receipt'}`);
    }
    return payload.report;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const mode = process.argv[2];
    runPostSaleLinkedV270Controller({ mode })
        .then(report => process.stdout.write(`${JSON.stringify(report)}\n`))
        .catch(error => { console.error(error.message); process.exitCode = 1; });
}
