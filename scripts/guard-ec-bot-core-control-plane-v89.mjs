import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

import {
    assertEcBotCoreControlPlaneV89,
    installEcBotCoreControlPlaneContextV89,
    EC_BOT_CORE_CONTROL_PLANE_V89_PARENT_ATTESTATION_SHA256,
    EC_BOT_CORE_CONTROL_PLANE_V89_PARENT_FREEZE_SHA256,
    EC_BOT_CORE_CONTROL_PLANE_V89_PARENT_MANIFEST_SHA256
} from '../src/services/ecBotCoreControlPlaneV89Service.js';

const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
assert.equal(sha256('docs/freeze/ec-bot-core-lifecycle-boot-v88-20260830.json'), EC_BOT_CORE_CONTROL_PLANE_V89_PARENT_MANIFEST_SHA256);
assert.equal(sha256('docs/EC_BOT_CORE_LIFECYCLE_BOOT_FREEZE_V88_20260830.md'), EC_BOT_CORE_CONTROL_PLANE_V89_PARENT_FREEZE_SHA256);
assert.equal(sha256('docs/evidence/ec-bot-core-lifecycle-boot-v88-attestation-20260830.json'), EC_BOT_CORE_CONTROL_PLANE_V89_PARENT_ATTESTATION_SHA256);
installEcBotCoreControlPlaneContextV89({ mode: 'official_guard' });
const result = assertEcBotCoreControlPlaneV89();
assert.equal(result.ready, true);
assert.equal(result.pm2TargetEnvironmentIsolated, true);
console.log('EC_BOT_CORE_CONTROL_PLANE_V89=PASS');
console.log('PARENT_V88_IDENTITY_INTACT=YES');
console.log('PM2_CONTROLLER_NODE_OPTIONS=EMPTY');
console.log('PM2_TARGET_NODE_OPTIONS=CANONICAL_V78');
console.log('FAILED_AUTHORIZATION_ABORT=SAFE_HEALTH_ONLY');
console.log('REAL_CUSTOMER_TRAFFIC_AUTHORIZED=NO');
