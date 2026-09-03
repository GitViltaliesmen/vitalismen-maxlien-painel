await import('./lib/ec-runtime-successor-v97-context.mjs');
const { assertPostSaleContainmentHealthV109Manifest } = await import('../src/services/postSaleContainmentHealthV109Service.js');

const result = assertPostSaleContainmentHealthV109Manifest();
console.log('POST_SALE_CONTAINMENT_HEALTH_V109=PASS');
console.log(`MANIFEST_SHA256=${result.manifestSha256}`);
console.log('HEALTH_RETRIES=30');
console.log('ARCHIVE_AFTER_HEALTH=REQUIRED');
console.log('EXTERNAL_EFFECTS=0');
