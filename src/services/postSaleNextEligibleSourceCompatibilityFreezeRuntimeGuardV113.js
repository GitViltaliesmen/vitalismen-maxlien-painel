import { assertPostSaleNextEligibleSourceCompatibilityV113Manifest } from './postSaleNextEligibleSourceCompatibilityV113Service.js';

const stateKey = '__VITALISMEN_POST_SALE_SOURCE_COMPAT_V113_STATE';
const result = assertPostSaleNextEligibleSourceCompatibilityV113Manifest();
globalThis[stateKey] = Object.freeze({
    version: 113,
    ready: result.ready,
    mode: 'READ_ONLY_FUNCTIONAL_TREE_ALIAS',
    metadataWrites: 0
});

export default globalThis[stateKey];
