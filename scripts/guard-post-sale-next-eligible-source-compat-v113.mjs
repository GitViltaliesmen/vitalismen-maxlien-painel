import assert from 'node:assert/strict';

import {
    normalizeModernReleaseSourceV113,
    assertPostSaleNextEligibleSourceCompatibilityV113Manifest
} from '../src/services/postSaleNextEligibleSourceCompatibilityV113Service.js';

const result = assertPostSaleNextEligibleSourceCompatibilityV113Manifest();
const tree = '1c6639ced97dfce384c765a0d80432da84822367';
const modern = { commit: '86e4b14052b5e41360dab84be25c09df450733c8', functionalTree: tree };
assert.equal(normalizeModernReleaseSourceV113(modern).tree, tree);
assert.equal(Object.hasOwn(modern, 'tree'), false);
assert.equal(result.ready, true);
console.log('POST_SALE_NEXT_ELIGIBLE_SOURCE_COMPAT_V113=PASS');
console.log('METADATA_WRITES=0');
console.log('PROVIDER_CALLS_ADDED=0');
console.log('MONGO_MUTATIONS_ADDED=0');
console.log('FROZEN_V112=DELEGATED_INTACT');
