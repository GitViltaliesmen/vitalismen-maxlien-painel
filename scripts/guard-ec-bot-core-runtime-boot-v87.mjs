import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

import {
    assertEcBotCoreRuntimeBootV87,
    EC_BOT_CORE_RUNTIME_BOOT_V87_PARENT_ATTESTATION_SHA256,
    EC_BOT_CORE_RUNTIME_BOOT_V87_PARENT_FREEZE_SHA256,
    EC_BOT_CORE_RUNTIME_BOOT_V87_PARENT_MANIFEST_SHA256
} from '../src/services/ecBotCoreRuntimeBootV87Service.js';

const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
assert.equal(sha256('docs/freeze/ec-bot-core-operational-plan-v86-20260829.json'), EC_BOT_CORE_RUNTIME_BOOT_V87_PARENT_MANIFEST_SHA256);
assert.equal(sha256('docs/EC_BOT_CORE_OPERATIONAL_PLAN_ALIGNMENT_FREEZE_V86_20260829.md'), EC_BOT_CORE_RUNTIME_BOOT_V87_PARENT_FREEZE_SHA256);
assert.equal(sha256('docs/evidence/ec-bot-core-operational-plan-v86-attestation-20260829.json'), EC_BOT_CORE_RUNTIME_BOOT_V87_PARENT_ATTESTATION_SHA256);
const result = assertEcBotCoreRuntimeBootV87();
assert.equal(result.ready, true);
assert.equal(result.firstImportInstalled, true);
console.log('EC_BOT_CORE_RUNTIME_BOOT_V87=PASS');
console.log('PARENT_V86_IDENTITY_INTACT=YES');
console.log('SUCCESSOR_CONTEXT_FIRST_IMPORT=YES');
console.log('V86_OPERATIONAL_POLICY_CHANGED=NO');
console.log('REAL_CUSTOMER_TRAFFIC_AUTHORIZED=NO');
