import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

import {
    assertEcBotCoreActivationHealthV84,
    EC_BOT_CORE_ACTIVATION_HEALTH_V84_PARENT_ATTESTATION_SHA256,
    EC_BOT_CORE_ACTIVATION_HEALTH_V84_PARENT_FREEZE_SHA256,
    EC_BOT_CORE_ACTIVATION_HEALTH_V84_PARENT_MANIFEST_SHA256
} from '../src/services/ecBotCoreActivationHealthV84Service.js';

const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
assert.equal(sha256('docs/freeze/ec-bot-core-operational-readiness-v83-20260829.json'), EC_BOT_CORE_ACTIVATION_HEALTH_V84_PARENT_MANIFEST_SHA256);
assert.equal(sha256('docs/EC_BOT_CORE_OPERATIONAL_READINESS_BRIDGE_FREEZE_V83_20260829.md'), EC_BOT_CORE_ACTIVATION_HEALTH_V84_PARENT_FREEZE_SHA256);
assert.equal(sha256('docs/evidence/ec-bot-core-operational-readiness-v83-attestation-20260829.json'), EC_BOT_CORE_ACTIVATION_HEALTH_V84_PARENT_ATTESTATION_SHA256);
const result = assertEcBotCoreActivationHealthV84();
assert.equal(result.ready, true);
assert.equal(result.healthAttempts, 30);
assert.equal(result.healthDelaySeconds, 2);
console.log('EC_BOT_CORE_ACTIVATION_HEALTH_V84=PASS');
console.log('PARENT_V83_BYTE_INTACT=YES');
console.log('HEALTH_STABILIZATION=30x2s_BOUNDED');
console.log('BOT_BUSINESS_LOGIC_CHANGED=NO');
console.log('REAL_CUSTOMER_TRAFFIC_AUTHORIZED=NO');
