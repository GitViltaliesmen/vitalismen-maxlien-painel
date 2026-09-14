import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const read = (relative) => fs.readFileSync(path.resolve(relative), 'utf8');
const hash = (relative) => crypto.createHash('sha256').update(fs.readFileSync(path.resolve(relative))).digest('hex');
const manifestPath = 'docs/freeze/ec-dropi-preflight-repair-v157-20260913.json';
const text = read(manifestPath);
const manifest = JSON.parse(text);

assert.equal(text, `${JSON.stringify(manifest, null, 2)}\n`);
assert.equal(manifest.freezeId, 'EC_DROPI_PREFLIGHT_REPAIR_V157_20260913');
assert.equal(manifest.version, 157);
assert.equal(manifest.parentCommit, '398ea6cc233eea0b7dd1b641e0a99f303a9c79ec');
assert.equal(manifest.parentTree, 'f7e7f1fa2b445bb05fe3a77a07889c5252617b83');
assert.equal(manifest.parentManifestSha256, '2d1baf5011c0d5aebcd8498af6b6895a643e43a7e22947e70e27cce812bd55e2');
assert.deepEqual([...manifest.overrides].sort(), Object.keys(manifest.protectedFiles).sort());
for (const [relative, expected] of Object.entries(manifest.protectedFiles)) {
    assert.equal(hash(relative), expected, `V157 protected file diverged: ${relative}`);
}

const adapter = read('src/services/dropiBffAdapter.js');
const browser = read('src/services/droppiEcuadorBrowserService.js');
const policy = read('src/services/dropiSubmitFailurePolicyV157Service.js');
const routes = read('src/routes/shipments.js');
const parentContext = read('scripts/lib/ec-runtime-successor-v155-context.mjs');
const v101SuccessorGuard = read('src/services/protocoloGSuccessorGuardV101Service.js');
const manualDropiRelease = read('src/services/ecManualDropiReleaseV119Service.js');
const botCoreRuntime = read('src/services/ecBotCoreRuntimeIntegrationV78Service.js');

assert.match(adapter, /DUPLICATE_CHECK_FAILED/);
assert.match(browser, /code: 'DUPLICATE_CHECK_FAILED'/);
assert.match(browser, /ORDER_LOOKUP_NOT_CONFIRMED/);
assert.match(policy, /dropi_preflight_failed/);
assert.match(policy, /dropi_submit_unconfirmed/);
assert.match(policy, /dropi_rejected/);
assert.equal((routes.match(/dropiManualReviewReasonForResultV157\(result\)/g) || []).length, 2);
assert.match(parentContext, /ec-dropi-preflight-repair-v157-20260913\.json/);
assert.match(parentContext, /__VITALISMEN_V157_CONTEXT/);
assert.match(v101SuccessorGuard, /ec-dropi-preflight-repair-v157-20260913\.json/);
assert.match(v101SuccessorGuard, /v157BrowserIdentityAccepted/);
assert.match(manualDropiRelease, /requeue-dropi-submit/);
assert.match(botCoreRuntime, /requeue-dropi-submit/);
assert.equal(manifest.policy.createPostsByValidation, 0);
assert.equal(manifest.policy.remoteDuplicateLookupRequired, true);
assert.equal(manifest.policy.failClosedBeforeCreate, true);
assert.equal(manifest.policy.automaticRetryAfterAmbiguousCreate, false);
assert.equal(manifest.policy.whatsappChanged, false);
assert.equal(manifest.policy.metaCapiChanged, false);
console.log('EC_DROPI_PREFLIGHT_REPAIR_V157=PASS');
