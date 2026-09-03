await import('./lib/ec-runtime-successor-v97-context.mjs');
const { assertDropiManualTransportV104 } = await import('../src/services/dropiManualTransportV104Service.js');

const result = assertDropiManualTransportV104();
console.log('DROPI_MANUAL_TRANSPORT_V104=PASS');
console.log(`MANIFEST_SHA256=${result.manifestSha256}`);
console.log('MANUAL_CREATE_ONLY=YES');
console.log('AUTOMATIC_RETRY=NO');
console.log('AUTHORITATIVE_LOOKUP=YES');
console.log('POST_SALE_ACTIVATED=NO');
