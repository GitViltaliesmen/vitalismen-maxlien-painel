import { assertPostSaleEligibleBatchV108Manifest } from './postSaleEligibleBatchV108Service.js';

const result = assertPostSaleEligibleBatchV108Manifest();
if (!result.ready) throw new Error('[POST-SALE-BATCH-V108] runtime_guard_blocked');

globalThis.__VITALISMEN_POST_SALE_ELIGIBLE_BATCH_V108 = Object.freeze({
    ready: true,
    version: 108,
    manifestSha256: result.manifestSha256
});
