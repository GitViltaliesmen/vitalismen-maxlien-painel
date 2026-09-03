import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

import {
    assertEcBotCoreCanaryClassificationV85,
    EC_BOT_CORE_CANARY_CLASSIFICATION_V85_PARENT_ATTESTATION_SHA256,
    EC_BOT_CORE_CANARY_CLASSIFICATION_V85_PARENT_FREEZE_SHA256,
    EC_BOT_CORE_CANARY_CLASSIFICATION_V85_PARENT_MANIFEST_SHA256
} from '../src/services/ecBotCoreCanaryClassificationV85Service.js';

const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
assert.equal(sha256('docs/freeze/ec-bot-core-activation-health-v84-20260829.json'), EC_BOT_CORE_CANARY_CLASSIFICATION_V85_PARENT_MANIFEST_SHA256);
assert.equal(sha256('docs/EC_BOT_CORE_ACTIVATION_HEALTH_STABILIZATION_FREEZE_V84_20260829.md'), EC_BOT_CORE_CANARY_CLASSIFICATION_V85_PARENT_FREEZE_SHA256);
assert.equal(sha256('docs/evidence/ec-bot-core-activation-health-v84-attestation-20260829.json'), EC_BOT_CORE_CANARY_CLASSIFICATION_V85_PARENT_ATTESTATION_SHA256);
const result = assertEcBotCoreCanaryClassificationV85();
assert.equal(result.ready, true);
assert.equal(result.v77EnforcementRequired, false);
assert.equal(result.v75EnforcementRequired, false);
console.log('EC_BOT_CORE_CANARY_CLASSIFICATION_V85=PASS');
console.log('PARENT_V84_BYTE_INTACT=YES');
console.log('EXACT_READY_V78_REQUIRED=YES');
console.log('V77_CANARY_SEMANTICS_CHANGED=NO');
console.log('REAL_CUSTOMER_TRAFFIC_AUTHORIZED=NO');
