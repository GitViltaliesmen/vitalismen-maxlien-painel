await import('./lib/ec-runtime-successor-v97-context.mjs');
const { assertPostSaleHealthEnvelopeV107Manifest } = await import('../src/services/postSaleHealthEnvelopeV107Service.js');

const result = assertPostSaleHealthEnvelopeV107Manifest();
console.log('POST_SALE_HEALTH_ENVELOPE_V107=PASS');
console.log(`MANIFEST_SHA256=${result.manifestSha256}`);
console.log('HEALTH_JSON_FORMAT=SEMANTIC');
console.log('FAILED_PERMIT_ABORT=BOT_CORE_GATED');
console.log('EXTERNAL_EFFECTS=0');
