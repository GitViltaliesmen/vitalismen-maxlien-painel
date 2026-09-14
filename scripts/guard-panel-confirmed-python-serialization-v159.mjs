import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const read = (relative) => fs.readFileSync(path.resolve(relative), 'utf8');
const hash = (relative) => crypto.createHash('sha256').update(fs.readFileSync(path.resolve(relative))).digest('hex');
const manifestPath = 'docs/freeze/ec-panel-confirmed-python-serialization-v159-20260914.json';
const text = read(manifestPath);
const manifest = JSON.parse(text);
const v160ManifestPath = 'docs/freeze/ec-panel-manual-attendant-v160-20260914.json';
const v160 = fs.existsSync(path.resolve(v160ManifestPath))
    ? JSON.parse(read(v160ManifestPath))
    : { overrides: [] };
const v160Overrides = new Set(v160.overrides || []);

assert.equal(text, `${JSON.stringify(manifest, null, 2)}\n`);
assert.equal(manifest.freezeId, 'EC_PANEL_CONFIRMED_PYTHON_SERIALIZATION_V159_20260914');
assert.equal(manifest.version, 159);
assert.equal(manifest.parentCommit, '174c85c525bd2f803d81812118ca81fc4d988ce5');
assert.equal(manifest.parentTree, 'ede79efebe5e57f065bf13c3b4b85a301b8681a2');
assert.equal(manifest.parentManifestSha256, 'f37431da16e1c332f7daf931f757451bd35cb6b0d27e51ecf80193f2a4edbfcc');
assert.deepEqual([...manifest.overrides].sort(), Object.keys(manifest.protectedFiles).sort());
for (const [relative, expected] of Object.entries(manifest.protectedFiles)) {
    if (v160Overrides.has(relative)) continue;
    assert.equal(hash(relative), expected, `V159 protected file diverged: ${relative}`);
}

const service = read('src/services/adminPanelStatusService.js');
assert.match(service, /require_existing_lead: Number\(requireExistingLead === true\)/);
assert.match(service, /force_human_confirmed_cycle: Number\(forceHumanConfirmedCycle === true\)/);
assert.doesNotMatch(service, /require_existing_lead: requireExistingLead === true/);
assert.doesNotMatch(service, /force_human_confirmed_cycle: forceHumanConfirmedCycle === true/);
assert.equal(manifest.policy.v158PublishedReleaseRewritten, false);
assert.equal(manifest.policy.javascriptBooleansInterpolatedIntoPython, false);
assert.equal(manifest.policy.pythonFlagsSerializedAsIntegers, true);
assert.equal(manifest.policy.externalCallsByRepair, 0);
assert.equal(manifest.policy.messagesSentByRepair, 0);
console.log('EC_PANEL_CONFIRMED_PYTHON_SERIALIZATION_V159=PASS');
