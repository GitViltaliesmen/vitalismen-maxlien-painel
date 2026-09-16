import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
    V168A_PR_PARENT_SHA256,
    V168A_PR_PROTECTED_FILE,
    V168A_PR_SUCCESSOR_SHA256
} from './lib/ec-runtime-successor-v168a-pr-context.mjs';

const context = globalThis.__VITALISMEN_V168A_PR_CONTEXT;
assert.equal(context?.loaded, true);
assert.equal(context?.protectedFiles?.[V168A_PR_PROTECTED_FILE], V168A_PR_SUCCESSOR_SHA256);

const source = fs.readFileSync(V168A_PR_PROTECTED_FILE, 'utf8');
assert.match(source, /META_V148_EXISTING_DATASET = '1468946114265008'/);
assert.match(source, /META_V150_APPROVED_VSL_BROWSER_PIXEL = '920532663934291'/);
assert.match(source, /META_V148_APPROVED_BROWSER_PIXELS = Object\.freeze/);
assert.match(source, /META_V148_APPROVED_BROWSER_PIXELS\.includes/);
assert.doesNotMatch(source, /META_V148_EXISTING_DATASET = '920532663934291'/);

console.log('V168A_P_R_GUARD_SUCCESSOR=PASS');
console.log(`EXPECTED_PARENT_SHA256=${V168A_PR_PARENT_SHA256}`);
console.log(`AUTHORIZED_SUCCESSOR_SHA256=${V168A_PR_SUCCESSOR_SHA256}`);
console.log('AUTHORIZED_OVERRIDE_FILES_COUNT=1');
console.log(`AUTHORIZED_OVERRIDE_FILES=${V168A_PR_PROTECTED_FILE}`);
console.log('CANONICAL_CAPI_DATASET=1468946114265008');
console.log('APPROVED_BROWSER_PIXEL=920532663934291');
console.log('GLOBAL_DATASET_REPLACEMENT=NO');
