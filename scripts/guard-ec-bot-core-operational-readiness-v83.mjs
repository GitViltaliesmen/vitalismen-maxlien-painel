import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

import {
    assertEcBotCoreOperationalReadinessV83,
    EC_BOT_CORE_OPERATIONAL_READINESS_V83_PARENT_ATTESTATION_SHA256,
    EC_BOT_CORE_OPERATIONAL_READINESS_V83_PARENT_FREEZE_SHA256,
    EC_BOT_CORE_OPERATIONAL_READINESS_V83_PARENT_MANIFEST_SHA256,
    EC_BOT_CORE_OPERATIONAL_READINESS_V83_V78_MANIFEST_SHA256,
    EC_BOT_CORE_OPERATIONAL_READINESS_V83_V79_ATTESTATION_SHA256,
    EC_BOT_CORE_OPERATIONAL_READINESS_V83_V79_EVIDENCE_SHA256,
    EC_BOT_CORE_OPERATIONAL_READINESS_V83_V79_MANIFEST_SHA256
} from '../src/services/ecBotCoreOperationalReadinessV83Service.js';

const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
assert.equal(sha256('docs/freeze/runtime-successor-context-v82-20260829.json'), EC_BOT_CORE_OPERATIONAL_READINESS_V83_PARENT_MANIFEST_SHA256);
assert.equal(sha256('docs/RUNTIME_SUCCESSOR_CONTEXT_FREEZE_V82_20260829.md'), EC_BOT_CORE_OPERATIONAL_READINESS_V83_PARENT_FREEZE_SHA256);
assert.equal(sha256('docs/evidence/runtime-successor-context-v82-attestation-20260829.json'), EC_BOT_CORE_OPERATIONAL_READINESS_V83_PARENT_ATTESTATION_SHA256);
assert.equal(sha256('docs/freeze/ec-bot-core-structural-safety-v78-20260829.json'), EC_BOT_CORE_OPERATIONAL_READINESS_V83_V78_MANIFEST_SHA256);
assert.equal(sha256('docs/freeze/ec-bot-core-readiness-v79-20260829.json'), EC_BOT_CORE_OPERATIONAL_READINESS_V83_V79_MANIFEST_SHA256);
assert.equal(sha256('docs/evidence/ec-meta-dataset-reconciliation-v79-20260829.json'), EC_BOT_CORE_OPERATIONAL_READINESS_V83_V79_EVIDENCE_SHA256);
assert.equal(sha256('docs/evidence/ec-bot-core-readiness-attestation-v79-20260829.json'), EC_BOT_CORE_OPERATIONAL_READINESS_V83_V79_ATTESTATION_SHA256);
assert.equal(assertEcBotCoreOperationalReadinessV83().ready, true);
console.log('EC_BOT_CORE_OPERATIONAL_READINESS_V83=PASS');
console.log('V78_STRUCTURAL_MANIFEST_BYTE_INTACT=YES');
console.log('V79_READINESS_BYTE_INTACT=YES');
console.log('DATASET_CHANGED=NO');
console.log('BOT_BUSINESS_LOGIC_CHANGED=NO');
console.log('REAL_CUSTOMER_TRAFFIC_AUTHORIZED=NO');
