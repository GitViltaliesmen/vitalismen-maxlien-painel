import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const read = (relative) => fs.readFileSync(path.resolve(relative), 'utf8');
const hash = (relative) => crypto.createHash('sha256').update(fs.readFileSync(path.resolve(relative))).digest('hex');
const manifestPath = 'docs/freeze/ec-panel-confirmed-persistence-v158-20260914.json';
const text = read(manifestPath);
const manifest = JSON.parse(text);
const v159ManifestPath = 'docs/freeze/ec-panel-confirmed-python-serialization-v159-20260914.json';
const v159 = fs.existsSync(path.resolve(v159ManifestPath))
    ? JSON.parse(read(v159ManifestPath))
    : { overrides: [] };
const v159Overrides = new Set(v159.overrides || []);
const v160ManifestPath = 'docs/freeze/ec-panel-manual-attendant-v160-20260914.json';
const v160 = fs.existsSync(path.resolve(v160ManifestPath))
    ? JSON.parse(read(v160ManifestPath))
    : { overrides: [] };
const v160Overrides = new Set(v160.overrides || []);

assert.equal(text, `${JSON.stringify(manifest, null, 2)}\n`);
assert.equal(manifest.freezeId, 'EC_PANEL_CONFIRMED_PERSISTENCE_V158_20260914');
assert.equal(manifest.version, 158);
assert.equal(manifest.parentCommit, 'd5f898d5fb59be87307aaa36bfb02f03c688704b');
assert.equal(manifest.parentTree, '5a471e60c301c57d7de62dde5bcdd3c6c0de1a82');
assert.equal(manifest.parentManifestSha256, '5aecf61299ea77e9f1dabc67788a141c7c9c8ce88f0adf4895d3210d5a3cc960');
assert.deepEqual([...manifest.overrides].sort(), Object.keys(manifest.protectedFiles).sort());
for (const [relative, expected] of Object.entries(manifest.protectedFiles)) {
    if (v159Overrides.has(relative) || v160Overrides.has(relative)) continue;
    assert.equal(hash(relative), expected, `V158 protected file diverged: ${relative}`);
}

const statusService = read('src/services/adminPanelStatusService.js');
const whatsappRoute = read('src/routes/whatsapp.js');
const shipmentRoute = read('src/routes/shipments.js');
const leadsPanel = read('public/leads-window.html');
const whatsappPanel = read('public/qr.html');
const repair = read('scripts/repair-ec-confirmed-order-v158.mjs');
const successorContext = read('scripts/lib/ec-runtime-successor-v155-context.mjs');

assert.match(statusService, /persistConfirmedOrderToOnlineAdminPanelV158/);
assert.match(statusService, /force_human_confirmed_cycle/);
assert.match(statusService, /visibleInConfirmedQuery/);
assert.match(whatsappRoute, /panel_confirm_final_read_after_write_failed/);
assert.match(whatsappRoute, /\[PANEL_CONFIRM_V158\]/);
assert.match(shipmentRoute, /confirmed_order_already_advanced/);
assert.match(shipmentRoute, /persistenceVerified: staged\.confirmedPersistence/);
assert.match(leadsPanel, /assertConfirmedLeadVisibleV158/);
assert.match(whatsappPanel, /assertConfirmedPersistenceV158\(contactSave, customerDraft\)/);
assert.match(repair, /V158_CONFIRM_REPAIR_AUTHORIZE/);
assert.doesNotMatch(repair, /sendMessage|submitDroppi|sendPurchaseEvent|zapi/i);
assert.match(successorContext, /ec-panel-confirmed-persistence-v158-20260914\.json/);
assert.equal(manifest.policy.confirmationFalseSuccessAllowed, false);
assert.equal(manifest.policy.readAfterWriteRequired, true);
assert.equal(manifest.policy.singleLeadRepairOnly, true);
assert.equal(manifest.policy.whatsappCallsByRepair, 0);
assert.equal(manifest.policy.dropiCallsByRepair, 0);
assert.equal(manifest.policy.metaCallsByRepair, 0);
assert.equal(manifest.policy.messagesSentByRepair, 0);
assert.equal(manifest.policy.v157DropiProtectionsPreserved, true);
console.log('EC_PANEL_CONFIRMED_PERSISTENCE_V158=PASS');
