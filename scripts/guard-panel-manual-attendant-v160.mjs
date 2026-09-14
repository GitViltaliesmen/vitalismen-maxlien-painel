import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const read = (relative) => fs.readFileSync(path.resolve(relative), 'utf8');
const hash = (relative) => crypto.createHash('sha256').update(fs.readFileSync(path.resolve(relative))).digest('hex');
const manifestPath = 'docs/freeze/ec-panel-manual-attendant-v160-20260914.json';
const text = read(manifestPath);
const manifest = JSON.parse(text);

assert.equal(text, `${JSON.stringify(manifest, null, 2)}\n`);
assert.equal(manifest.freezeId, 'EC_PANEL_MANUAL_ATTENDANT_V160_20260914');
assert.equal(manifest.version, 160);
assert.equal(manifest.parentCommit, 'ea98fbee0fd77bf81f30c30add796b008adf1d2f');
assert.equal(manifest.parentTree, '4591c35be71e39fb6185ef26fdca6fcfe42179ea');
assert.equal(manifest.parentManifestSha256, '5cad677f29fd8a90021e69fd480ea22b7f4891bf5ed0d1aa031c842a7a3692fc');
assert.deepEqual([...manifest.overrides].sort(), Object.keys(manifest.protectedFiles).sort());
for (const [relative, expected] of Object.entries(manifest.protectedFiles)) {
    assert.equal(hash(relative), expected, `V160 protected file diverged: ${relative}`);
}

const adapter = read('src/services/postSaleManualPanelV147R6Service.js');
const route = read('src/routes/whatsapp.js').split("router.post('/send', authMiddleware")[1].split('// DEBUG:')[0];
assert.match(adapter, /authenticatedManualAttendant === true/);
assert.match(route, /authenticatedManualAttendant: sendMode === 'manual_panel'/);
assert.match(route, /const allowAudioDedupeBypass = sendMode === 'manual_panel'/);
assert.doesNotMatch(route, /pickup_communication_blocked/);
assert.doesNotMatch(route, /PEDIDO AINDA NÃO ESTÁ LIBERADO PARA RETIRADA/);
assert.match(route, /recordManualOutboundMessage/);
assert.equal(manifest.policy.manualAttendantMessagesBlockedByLogistics, false);
assert.equal(manifest.policy.automaticPickupRequiresVerifiedReady, true);
assert.equal(manifest.policy.fakeShipmentCreated, false);
assert.equal(manifest.policy.realMessagesSentByValidation, 0);
assert.equal(manifest.policy.dropiChanged, false);
assert.equal(manifest.policy.metaCapiChanged, false);
console.log('EC_PANEL_MANUAL_ATTENDANT_V160=PASS');
