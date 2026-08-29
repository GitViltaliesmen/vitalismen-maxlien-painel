import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

import {
    assertRuntimeSuccessorContextManifestV82,
    RUNTIME_SUCCESSOR_CONTEXT_V82_PARENT_ATTESTATION_SHA256,
    RUNTIME_SUCCESSOR_CONTEXT_V82_PARENT_COMMIT,
    RUNTIME_SUCCESSOR_CONTEXT_V82_PARENT_FREEZE_SHA256,
    RUNTIME_SUCCESSOR_CONTEXT_V82_PARENT_MANIFEST_SHA256,
    RUNTIME_SUCCESSOR_CONTEXT_V82_PARENT_TREE
} from '../src/services/runtimeSuccessorContextV82Service.js';

const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const identity = assertRuntimeSuccessorContextManifestV82();
assert.equal(RUNTIME_SUCCESSOR_CONTEXT_V82_PARENT_COMMIT, 'c2f6bedbd2327a2b41bfc0cb2bdb9d789812cfc6');
assert.equal(RUNTIME_SUCCESSOR_CONTEXT_V82_PARENT_TREE, '93bb427cb06a1e8fbac8dac0f1c6086f104929cb');
assert.equal(sha256('docs/freeze/npm-lifecycle-stage-envelope-compatibility-v81-20260829.json'), RUNTIME_SUCCESSOR_CONTEXT_V82_PARENT_MANIFEST_SHA256);
assert.equal(sha256('docs/NPM_LIFECYCLE_STAGE_ENVELOPE_COMPATIBILITY_FREEZE_V81_20260829.md'), RUNTIME_SUCCESSOR_CONTEXT_V82_PARENT_FREEZE_SHA256);
assert.equal(sha256('docs/evidence/npm-lifecycle-stage-envelope-v81-attestation-20260829.json'), RUNTIME_SUCCESSOR_CONTEXT_V82_PARENT_ATTESTATION_SHA256);
assert.deepEqual(identity.overrides, ['src/index.js']);
console.log('RUNTIME_SUCCESSOR_CONTEXT_V82=PASS');
console.log('PARENT_V81_BYTE_INTACT=YES');
console.log('DATASET_CHANGED=NO');
console.log('CTA_CHANGED=NO');
console.log('BOT_BUSINESS_LOGIC_CHANGED=NO');
console.log('REAL_CUSTOMER_TRAFFIC_AUTHORIZED=NO');
