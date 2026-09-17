import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

const MANIFEST = 'docs/freeze/ec-pretraffic-final-restoration-v170-20260916.json';
const SUCCESSOR_MANIFEST = 'docs/freeze/ec-traffic-restoration-v171-20260917.json';
const hashFile = (relative) => crypto.createHash('sha256')
    .update(fs.readFileSync(new URL(`../../${relative}`, import.meta.url)))
    .digest('hex');
const text = fs.readFileSync(new URL(`../../${MANIFEST}`, import.meta.url), 'utf8');
const manifest = JSON.parse(text);
const successorText = fs.readFileSync(new URL(`../../${SUCCESSOR_MANIFEST}`, import.meta.url), 'utf8');
const successor = JSON.parse(successorText);

assert.equal(text, `${JSON.stringify(manifest, null, 2)}\n`, '[V170] manifest_not_canonical');
assert.equal(manifest.freezeId, 'EC_PRETRAFFIC_FINAL_RESTORATION_V170_20260916');
assert.equal(manifest.version, 'V170');
assert.equal(manifest.parentCommit, '533b78f3df551c737cfc061085f2c78caf5c8508');
assert.equal(manifest.parentTree, '4c8efc135f0ef578bb4b2edf9ae91df03cbf2e3e');
assert.equal(manifest.policy.statusAuthority, 'CONTACT_STATE_CURRENT_DRAFT');
assert.equal(manifest.policy.shipmentMayAdvanceOnly, true);
assert.equal(manifest.policy.dropiHumanAuthorizationRequired, true);
assert.equal(manifest.policy.metaPurchaseAfterFreshDropiOnly, true);
assert.equal(manifest.policy.zapiPreserved, true);
assert.equal(manifest.policy.whatsappWebMode, 'SHADOW');
assert.equal(manifest.policy.futureChangesRequireExplicitAuthorization, true);
assert.deepEqual([...manifest.overrides].sort(), Object.keys(manifest.protectedFiles).sort());
assert.equal(manifest.overrides.some((file) => /[*?\[\]]/.test(file)), false);
assert.equal(successorText, `${JSON.stringify(successor, null, 2)}\n`, '[V171] manifest_not_canonical');
assert.equal(successor.freezeId, 'EC_TRAFFIC_RESTORATION_V171_20260917');
assert.equal(successor.version, 'V171');
assert.equal(successor.parentCommit, '461c876bd87d7b96ca500217030707b1fe938b95');
assert.equal(successor.parentTree, '4d80a4d8109a9642e046f83e8353b48be7f0ce58');
assert.equal(successor.policy.zapiPreserved, true);
assert.equal(successor.policy.whatsappWebMode, 'SHADOW');
assert.equal(successor.policy.dropiHumanAuthorizationRequired, true);
assert.equal(successor.policy.fakePhoneAllowed, false);
assert.deepEqual([...successor.overrides].sort(), Object.keys(successor.protectedFiles).sort());
assert.equal(successor.overrides.some((file) => /[*?\[\]]/.test(file)), false);

for (const [file, expected] of Object.entries(manifest.protectedFiles)) {
    assert.equal(hashFile(file), successor.protectedFiles[file] || expected, `[V170/V171] protected_file_invalid:${file}`);
}
for (const [file, expected] of Object.entries(successor.protectedFiles)) {
    assert.equal(hashFile(file), expected, `[V171] protected_file_invalid:${file}`);
}

for (const key of ['__VITALISMEN_SUCCESSOR_OVERRIDE_FILES']) {
    globalThis[key] = [...new Set([...(globalThis[key] || []), ...manifest.overrides, ...successor.overrides])];
}

globalThis.__VITALISMEN_V170_PRETRAFFIC_FINAL_CONTEXT = Object.freeze({
    loaded: true,
    freezeId: manifest.freezeId,
    parentCommit: manifest.parentCommit,
    manifestSha256: crypto.createHash('sha256').update(text).digest('hex'),
    authorizedFiles: Object.freeze([...new Set([...manifest.overrides, ...successor.overrides])]),
    protectedFiles: Object.freeze({ ...manifest.protectedFiles, ...successor.protectedFiles }),
    successorFreezeId: successor.freezeId,
    successorManifestSha256: crypto.createHash('sha256').update(successorText).digest('hex')
});

globalThis.__VITALISMEN_V171_TRAFFIC_RESTORATION_CONTEXT = Object.freeze({
    loaded: true,
    freezeId: successor.freezeId,
    parentCommit: successor.parentCommit,
    manifestSha256: crypto.createHash('sha256').update(successorText).digest('hex'),
    authorizedFiles: Object.freeze([...successor.overrides]),
    protectedFiles: Object.freeze({ ...successor.protectedFiles })
});
