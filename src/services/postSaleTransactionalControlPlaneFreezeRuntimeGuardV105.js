import { assertPostSaleTransactionalV105Manifest } from './postSaleTransactionalControlPlaneV105Service.js';

const result = assertPostSaleTransactionalV105Manifest();
if (!result.ready) throw new Error('[POST-SALE-V105] runtime_guard_blocked');

globalThis.__VITALISMEN_POST_SALE_TRANSACTIONAL_CONTROL_PLANE_V105 = Object.freeze({
    ready: true,
    version: 105,
    manifestSha256: result.manifestSha256
});
