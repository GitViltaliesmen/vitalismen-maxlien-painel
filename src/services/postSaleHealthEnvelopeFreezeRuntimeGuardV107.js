import { assertPostSaleHealthEnvelopeV107Manifest } from './postSaleHealthEnvelopeV107Service.js';

const result = assertPostSaleHealthEnvelopeV107Manifest();
if (!result.ready) throw new Error('[POST-SALE-HEALTH-V107] runtime_guard_blocked');

globalThis.__VITALISMEN_POST_SALE_HEALTH_ENVELOPE_V107 = Object.freeze({
    ready: true,
    version: 107,
    manifestSha256: result.manifestSha256
});
