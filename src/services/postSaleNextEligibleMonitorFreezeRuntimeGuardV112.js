import { assertPostSaleNextEligibleMonitorV112Manifest } from './postSaleNextEligibleMonitorV112Service.js';

const result = assertPostSaleNextEligibleMonitorV112Manifest();
if (!result.ready) throw new Error('[POST-SALE-NEXT-ELIGIBLE-V112] runtime_guard_blocked');

globalThis.__VITALISMEN_POST_SALE_NEXT_ELIGIBLE_V112 = Object.freeze({
    ready: true,
    version: 112,
    manifestSha256: result.manifestSha256
});
