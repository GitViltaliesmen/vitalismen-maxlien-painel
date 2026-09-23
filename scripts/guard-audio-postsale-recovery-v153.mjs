import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const read = (relative) => fs.readFileSync(path.resolve(relative), 'utf8');
const hash = (relative) => crypto.createHash('sha256').update(fs.readFileSync(path.resolve(relative))).digest('hex');
const manifestPath = 'docs/freeze/ec-audio-postsale-recovery-v153-20260913.json';
const text = read(manifestPath);
const manifest = JSON.parse(text);
assert.equal(text, `${JSON.stringify(manifest, null, 2)}\n`);
assert.equal(manifest.freezeId, 'EC_AUDIO_POSTSALE_RECOVERY_V153_20260913');
assert.equal(manifest.parentCommit, 'ccbb64e035345bae0d3e4d464485f694a66629e2');
assert.equal(manifest.parentTree, '588f5f91842396b310600ba68c8fee50d7daebf6');
assert.deepEqual([...manifest.overrides].sort(), Object.keys(manifest.protectedFiles).sort());
for (const [relative, expected] of Object.entries(manifest.protectedFiles)) {
    assert.equal(hash(relative), expected, `V153 protected file diverged: ${relative}`);
}

const route = read('src/routes/whatsapp.js');
const authIndex = route.indexOf('router.use(authMiddleware)');
const uploadIndex = route.indexOf("'/funnel-media-upload-binary'");
const uploadEnd = route.indexOf('const latestByPhoneTail', uploadIndex);
assert.ok(authIndex >= 0 && uploadIndex > authIndex);
const uploadHandler = route.slice(uploadIndex, uploadEnd);
assert.match(uploadHandler, /adminOnly/);
assert.match(uploadHandler, /persistPanelFunnelMediaUploadV153/);
assert.doesNotMatch(uploadHandler, /sendWhatsAppMessage|sendZapi|sendAudio|sendText/);

const storage = read('src/services/panelFunnelMediaUploadV153Service.js');
assert.match(storage, /manualUploadsDirV129/);
assert.match(storage, /manualUploadUrlFromPathV129/);
assert.match(storage, /flag: 'wx'/);
assert.doesNotMatch(storage, /console\.(?:log|info|debug)/);

const reconciliation = read('src/services/ecPhoneServientregaReconciliationV140Service.js');
assert.match(reconciliation, /completeCanonicalPostSaleIdentityV153/);
assert.match(reconciliation, /sourceDropi: true/);
assert.match(reconciliation, /sourceServientrega: true/);
assert.match(reconciliation, /servientrega\?\.ok !== true/);

const mongoGuard = read('src/services/ecBotCoreRuntimeIntegrationV78Service.js');
assert.match(mongoGuard, /ecBotCoreMongoMutationRecoveryV153Allowed/);
assert.match(mongoGuard, /\['\/api\/zapi\/webhook', '\/api\/zapi\/webhook\/received'\]/);
assert.match(mongoGuard, /sellerrotationcounters/);
assert.match(mongoGuard, /authenticated-customer-state-persist/);

assert.equal(manifest.policy.panelAuthenticationRequired, true);
assert.equal(manifest.policy.audioUploadProviderCalls, 0);
assert.equal(manifest.policy.historicalBurstAllowed, false);
assert.equal(manifest.policy.genericMongoWriteAllowed, false);
assert.equal(manifest.policy.productionWhatsAppNumberChanged, false);
assert.equal(manifest.policy.dropiOrderCreationChanged, false);
assert.equal(manifest.policy.metaCapiChanged, false);
console.log('EC_AUDIO_POSTSALE_RECOVERY_V153=PASS');
