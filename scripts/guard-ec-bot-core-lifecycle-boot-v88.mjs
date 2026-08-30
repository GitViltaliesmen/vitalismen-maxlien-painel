import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

import {
    assertEcBotCoreLifecycleBootV88,
    EC_BOT_CORE_LIFECYCLE_BOOT_V88_PARENT_ATTESTATION_SHA256,
    EC_BOT_CORE_LIFECYCLE_BOOT_V88_PARENT_FREEZE_SHA256,
    EC_BOT_CORE_LIFECYCLE_BOOT_V88_PARENT_MANIFEST_SHA256
} from '../src/services/ecBotCoreLifecycleBootV88Service.js';

const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
assert.equal(sha256('docs/freeze/ec-bot-core-runtime-boot-v87-20260829.json'), EC_BOT_CORE_LIFECYCLE_BOOT_V88_PARENT_MANIFEST_SHA256);
assert.equal(sha256('docs/EC_BOT_CORE_RUNTIME_BOOT_CONTEXT_FREEZE_V87_20260829.md'), EC_BOT_CORE_LIFECYCLE_BOOT_V88_PARENT_FREEZE_SHA256);
assert.equal(sha256('docs/evidence/ec-bot-core-runtime-boot-v87-attestation-20260829.json'), EC_BOT_CORE_LIFECYCLE_BOOT_V88_PARENT_ATTESTATION_SHA256);
const result = assertEcBotCoreLifecycleBootV88();
assert.equal(result.ready, true);
assert.equal(result.firstImportInstalled, true);
console.log('EC_BOT_CORE_LIFECYCLE_BOOT_V88=PASS');
console.log('PARENT_V87_IDENTITY_INTACT=YES');
console.log('DEPENDENCY_LIFECYCLE_BYPASS_ONLY=YES');
console.log('PROJECT_AND_RUNTIME_GUARDED=YES');
console.log('REAL_CUSTOMER_TRAFFIC_AUTHORIZED=NO');
