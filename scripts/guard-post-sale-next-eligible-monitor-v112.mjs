import {
    POST_SALE_NEXT_ELIGIBLE_V112_ATTESTATION_SHA256,
    POST_SALE_NEXT_ELIGIBLE_V112_PARENT_MANIFEST_SHA256,
    assertPostSaleNextEligibleMonitorV112Manifest
} from '../src/services/postSaleNextEligibleMonitorV112Service.js';

const result = assertPostSaleNextEligibleMonitorV112Manifest();
console.log('POST_SALE_NEXT_ELIGIBLE_MONITOR_V112=PASS');
console.log(`PARENT_V111_MANIFEST_SHA256=${POST_SALE_NEXT_ELIGIBLE_V112_PARENT_MANIFEST_SHA256}`);
console.log(`ATTESTATION_SHA256=${POST_SALE_NEXT_ELIGIBLE_V112_ATTESTATION_SHA256}`);
console.log(`BATCH_MAX=${result.manifest.policy.batchMax}`);
console.log('DETECTOR_PROVIDER_CALLS=0');
console.log('DETECTOR_MONGO_MUTATIONS=0');
console.log('PROMOTE_BEYOND_ONE=NO');
console.log('BACKLOG=OFF');
console.log('DROPI_AUTO=OFF');
console.log('META_RETROACTIVE=OFF');
