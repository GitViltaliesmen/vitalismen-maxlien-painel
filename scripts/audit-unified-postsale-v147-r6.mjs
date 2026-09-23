import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { classifyPostSaleContentV147R6, acceptedPostSaleEvidenceV147R6, resolvePostSaleEventV147R6 } from '../src/services/postSaleUnifiedEventV147R6Service.js';
import { resolvePostSaleProductV147R5 } from '../src/services/postSaleProductResolutionV147R5Service.js';
const directory = process.argv[2];
assert.equal(directory, '/var/lib/vitalismen-deploy/evidence/v147-r6-unified-postsale-20260910');
const source = path.join(directory, '6886247-readonly-source.json');
const raw = fs.readFileSync(source);
const fixture = JSON.parse(raw);
const sha = (value) => crypto.createHash('sha256').update(value).digest('hex');
assert.equal(fixture.shipment.orderId, '6886247');
const product = resolvePostSaleProductV147R5({ shipment: fixture.shipment, orders: [fixture.order] });
const rows = [];
for (const message of fixture.messages) {
    const descriptor = classifyPostSaleContentV147R6(message);
    const event = descriptor ? await resolvePostSaleEventV147R6({ shipment: fixture.shipment, stage: descriptor.stage, resolveProductFn: async () => product }) : null;
    const media = message.mediaUrl || '';
    const normalized = media.replace(/^\/opt\/vitalismen-automacao\/releases\/[^/]+\/public(?=\/media\/)/, '');
    const file = normalized.startsWith('/media/templates/EC/') ? path.join(process.cwd(), 'public', normalized) : '';
    rows.push({ MESSAGE_ID: message._id, PROVIDER_MESSAGE_ID: message.providerMessageId || '',
        SENT_AT: message.createdAt || new Date(message.timestamp * 1000).toISOString(),
        SENDER_TYPE: message.senderRole || (message.isBot ? 'bot' : 'unspecified'), HUMAN_OR_AUTOMATION: message.isBot ? 'AUTOMATION' : 'HUMAN',
        TEMPLATE_ID: message.templateId || descriptor?.templateId || '', TEMPLATE_ID_STORED: message.templateId || '',
        BLOCK_ID: message.blockId || '', MEDIA_ID: message.mediaId || '', MEDIA_PATH_OR_HASH: media || sha(message.body || ''),
        MEDIA_SHA256: file && fs.existsSync(file) ? sha(fs.readFileSync(file)) : '',
        PRODUCT: descriptor?.product || (descriptor ? 'NEUTRAL' : ''), ORDER_ID: message.orderId || '',
        RESOLVED_ORDER_ID: event ? fixture.order.orderId : '', SHIPMENT_ID: event?.shipmentId || '',
        CANONICAL_POSTSALE_EVENT: descriptor?.canonicalEvent || 'OTHER', DEDUPE_KEY: event?.dedupeKey || '',
        ACCEPTED_PROVIDER_PROOF: acceptedPostSaleEvidenceV147R6(message),
        ASSOCIATION: message.orderId === fixture.shipment.orderId ? 'EXPLICIT_ORDER_ID' : event ? 'EXACT_TEMPLATE_SAME_RECIPIENT_DELIVERED_TIMELINE' : 'CONTACT_TIMELINE_ONLY',
        ORIGINAL_RECORD_SHA256: sha(JSON.stringify(message)) });
}
const p5 = new Set(rows.filter((row) => row.CANONICAL_POSTSALE_EVENT === 'P5' && row.ACCEPTED_PROVIDER_PROOF).map((row) => row.PROVIDER_MESSAGE_ID));
assert.equal(p5.size, 2);
assert.ok(rows.some((row) => row.PROVIDER_MESSAGE_ID === '3EB057B0346896B8233327' && row.CANONICAL_POSTSALE_EVENT === 'P6'));
assert.ok(rows.some((row) => row.PROVIDER_MESSAGE_ID === '3EB0AAF76AB0EEC6CC265B' && row.CANONICAL_POSTSALE_EVENT === 'P7'));
const receipt = { sourceSha256: sha(raw), readOnlyProduction: true, productionWrites: 0, realMessagesSent: 0,
    canonicalOrder: fixture.order.orderId, dropiOrder: fixture.shipment.orderId, shipment: fixture.shipment._id,
    rows, uniqueP5ProviderCalls: 2, p5DuplicateIncidentCount: 1,
    note: 'Stored identifiers remain distinct from resolved identifiers. Two DB rows for one provider ID are one provider send.' };
fs.writeFileSync(path.join(directory, '6886247-outbound-audit.json'), JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600 });
console.log(JSON.stringify({ AUDIT: 'PASS', records: rows.length, uniqueP5ProviderCalls: 2, duplicateIncidentCount: 1, writes: 0, sends: 0 }));
