import { assertPostSalePublicationMetadataV106Manifest } from './postSalePublicationMetadataV106Service.js';

const result = assertPostSalePublicationMetadataV106Manifest();
if (!result.ready) throw new Error('[POST-SALE-PUBLICATION-V106] runtime_guard_blocked');

globalThis.__VITALISMEN_POST_SALE_PUBLICATION_METADATA_V106 = Object.freeze({
    ready: true,
    version: 106,
    manifestSha256: result.manifestSha256
});
