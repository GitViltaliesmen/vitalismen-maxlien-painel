import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

import {
    assertEcBotCoreOperationalPlanV86,
    EC_BOT_CORE_OPERATIONAL_PLAN_V86_PARENT_ATTESTATION_SHA256,
    EC_BOT_CORE_OPERATIONAL_PLAN_V86_PARENT_FREEZE_SHA256,
    EC_BOT_CORE_OPERATIONAL_PLAN_V86_PARENT_MANIFEST_SHA256
} from '../src/services/ecBotCoreOperationalPlanV86Service.js';

const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
assert.equal(sha256('docs/freeze/ec-bot-core-canary-classification-v85-20260829.json'), EC_BOT_CORE_OPERATIONAL_PLAN_V86_PARENT_MANIFEST_SHA256);
assert.equal(sha256('docs/EC_BOT_CORE_CANARY_CLASSIFICATION_FREEZE_V85_20260829.md'), EC_BOT_CORE_OPERATIONAL_PLAN_V86_PARENT_FREEZE_SHA256);
assert.equal(sha256('docs/evidence/ec-bot-core-canary-classification-v85-attestation-20260829.json'), EC_BOT_CORE_OPERATIONAL_PLAN_V86_PARENT_ATTESTATION_SHA256);
const result = assertEcBotCoreOperationalPlanV86();
assert.equal(result.ready, true);
assert.equal(result.ancestralPlanGuardCalled, false);
assert.equal(result.successorPlanGuardCalled, true);
console.log('EC_BOT_CORE_OPERATIONAL_PLAN_V86=PASS');
console.log('PARENT_V85_BYTE_INTACT=YES');
console.log('ANCESTRAL_V78_PLAN_GUARD_CALLED=NO');
console.log('V85_CLASSIFICATION_CHANGED=NO');
console.log('REAL_CUSTOMER_TRAFFIC_AUTHORIZED=NO');
