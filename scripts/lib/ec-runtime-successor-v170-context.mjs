import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

const MANIFEST = 'docs/freeze/ec-pretraffic-final-restoration-v170-20260916.json';
const SUCCESSOR_MANIFEST = 'docs/freeze/ec-traffic-restoration-v171-20260917.json';
const LATEST_SUCCESSOR_MANIFEST = 'docs/freeze/ec-panel-contactable-prelead-v176-20260917.json';
const PANEL_STATUS_SUCCESSOR_MANIFEST = 'docs/freeze/ec-panel-status-operations-v177-20260917.json';
const CUSTOMER_STATUS_SUCCESSOR_MANIFEST = 'docs/freeze/ec-panel-customer-status-busy-v178-20260917.json';
const PANEL_FAST_LOAD_SUCCESSOR_MANIFEST = 'docs/freeze/ec-panel-fast-load-v179-20260918.json';
const PANEL_ONLY_AGENCY_SCOPE_SUCCESSOR_MANIFEST = 'docs/freeze/ec-panel-only-agency-city-scope-v183-20260918.json';
const hashFile = (relative) => crypto.createHash('sha256')
    .update(fs.readFileSync(new URL(`../../${relative}`, import.meta.url)))
    .digest('hex');
const text = fs.readFileSync(new URL(`../../${MANIFEST}`, import.meta.url), 'utf8');
const manifest = JSON.parse(text);
const successorText = fs.readFileSync(new URL(`../../${SUCCESSOR_MANIFEST}`, import.meta.url), 'utf8');
const successor = JSON.parse(successorText);
const latestSuccessorText = fs.readFileSync(new URL(`../../${LATEST_SUCCESSOR_MANIFEST}`, import.meta.url), 'utf8');
const latestSuccessor = JSON.parse(latestSuccessorText);
const panelStatusSuccessorText = fs.readFileSync(new URL(`../../${PANEL_STATUS_SUCCESSOR_MANIFEST}`, import.meta.url), 'utf8');
const panelStatusSuccessor = JSON.parse(panelStatusSuccessorText);
const customerStatusSuccessorText = fs.readFileSync(new URL(`../../${CUSTOMER_STATUS_SUCCESSOR_MANIFEST}`, import.meta.url), 'utf8');
const customerStatusSuccessor = JSON.parse(customerStatusSuccessorText);
const panelFastLoadSuccessorText = fs.readFileSync(new URL(`../../${PANEL_FAST_LOAD_SUCCESSOR_MANIFEST}`, import.meta.url), 'utf8');
const panelFastLoadSuccessor = JSON.parse(panelFastLoadSuccessorText);
const panelOnlyAgencyScopeSuccessorText = fs.readFileSync(new URL(`../../${PANEL_ONLY_AGENCY_SCOPE_SUCCESSOR_MANIFEST}`, import.meta.url), 'utf8');
const panelOnlyAgencyScopeSuccessor = JSON.parse(panelOnlyAgencyScopeSuccessorText);

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
assert.equal(latestSuccessorText, `${JSON.stringify(latestSuccessor, null, 2)}\n`, '[V176] manifest_not_canonical');
assert.equal(latestSuccessor.freezeId, 'EC_PANEL_CONTACTABLE_PRELEAD_V176_20260917');
assert.equal(latestSuccessor.version, 'V176');
assert.equal(latestSuccessor.parentCommit, '2aa544722e2a18ce2cbe58d79662d180150ff9c5');
assert.equal(latestSuccessor.parentTree, 'ed48c42ab5df0547aff9d6cef148ca030581718d');
assert.equal(latestSuccessor.policy.hideAnonymousVslPreleadsFromOperationalPanel, true);
assert.equal(latestSuccessor.policy.preserveVslTelemetry, true);
assert.equal(latestSuccessor.policy.deleteRecords, false);
assert.equal(latestSuccessor.policy.fakePhoneAllowed, false);
assert.deepEqual([...latestSuccessor.overrides].sort(), Object.keys(latestSuccessor.protectedFiles).sort());
assert.equal(latestSuccessor.overrides.some((file) => /[*?\[\]]/.test(file)), false);
assert.equal(panelStatusSuccessorText, `${JSON.stringify(panelStatusSuccessor, null, 2)}\n`, '[V177] manifest_not_canonical');
assert.equal(panelStatusSuccessor.freezeId, 'EC_PANEL_STATUS_OPERATIONS_V177_20260917');
assert.equal(panelStatusSuccessor.version, 'V177');
assert.equal(panelStatusSuccessor.parentCommit, '6f0fe637a226490e7fb3803370f10bdb86116765');
assert.equal(panelStatusSuccessor.parentTree, 'cbb067c516d88653307fcf4e3cfcb02f015a980e');
assert.equal(panelStatusSuccessor.policy.exactRouteCount, 4);
assert.deepEqual(panelStatusSuccessor.policy.orderWriteOperations, ['confirm-order', 'repurchase-new-cycle']);
assert.equal(panelStatusSuccessor.policy.localAdminSyncOnly, true);
assert.equal(panelStatusSuccessor.policy.productionDbWriteCount, 0);
assert.equal(panelStatusSuccessor.policy.deployExecuted, false);
assert.equal(panelStatusSuccessor.policy.externalEffectsChanged, false);
assert.deepEqual([...panelStatusSuccessor.overrides].sort(), Object.keys(panelStatusSuccessor.protectedFiles).sort());
assert.equal(panelStatusSuccessor.overrides.some((file) => /[*?\[\]]/.test(file)), false);
assert.equal(customerStatusSuccessorText, `${JSON.stringify(customerStatusSuccessor, null, 2)}\n`, '[V178] manifest_not_canonical');
assert.equal(customerStatusSuccessor.freezeId, 'EC_PANEL_CUSTOMER_STATUS_BUSY_V178_20260917');
assert.equal(customerStatusSuccessor.version, 'V178');
assert.equal(customerStatusSuccessor.parentCommit, 'cfc314de10a795c0995d30ae57c9765a3173e25c');
assert.equal(customerStatusSuccessor.parentTree, 'ca9d29381fd40c25520b70456258fdc45e54bb5b');
assert.equal(customerStatusSuccessor.policy.statusCount, 9);
assert.equal(customerStatusSuccessor.policy.customerFormOwnLock, true);
assert.equal(customerStatusSuccessor.policy.customerSaveQueuePreserved, true);
assert.equal(customerStatusSuccessor.policy.singleOperatorConfirmationPerChange, true);
assert.equal(customerStatusSuccessor.policy.vslChanged, false);
assert.equal(customerStatusSuccessor.policy.backendChanged, false);
assert.equal(customerStatusSuccessor.policy.externalEffectsChanged, false);
assert.equal(customerStatusSuccessor.policy.productionDbWriteCount, 0);
assert.equal(customerStatusSuccessor.policy.deployExecuted, false);
assert.deepEqual([...customerStatusSuccessor.overrides].sort(), Object.keys(customerStatusSuccessor.protectedFiles).sort());
assert.equal(customerStatusSuccessor.overrides.some((file) => /[*?\[\]]/.test(file)), false);
assert.equal(panelFastLoadSuccessorText, `${JSON.stringify(panelFastLoadSuccessor, null, 2)}\n`, '[V179] manifest_not_canonical');
assert.equal(panelFastLoadSuccessor.freezeId, 'EC_PANEL_FAST_LOAD_V179_20260918');
assert.equal(panelFastLoadSuccessor.version, 'V179');
assert.equal(panelFastLoadSuccessor.parentCommit, '6590b17b2abf10b7f371400f893cfb58920f383d');
assert.equal(panelFastLoadSuccessor.parentTree, 'e0c4c0d15b37ec6b8cd50efd39db6f59544b7dd0');
assert.equal(panelFastLoadSuccessor.policy.fastListSkipsDetailedResolution, true);
assert.equal(panelFastLoadSuccessor.policy.selectedCustomerProfilePreserved, true);
assert.equal(panelFastLoadSuccessor.policy.overlappingPeriodicRefreshBlocked, true);
assert.equal(panelFastLoadSuccessor.policy.v178StatusSavePreserved, true);
assert.equal(panelFastLoadSuccessor.policy.externalEffectsChanged, false);
assert.equal(panelFastLoadSuccessor.policy.productionDbWriteCount, 0);
assert.equal(panelFastLoadSuccessor.policy.deployExecuted, false);
assert.deepEqual([...panelFastLoadSuccessor.overrides].sort(), Object.keys(panelFastLoadSuccessor.protectedFiles).sort());
assert.equal(panelFastLoadSuccessor.overrides.some((file) => /[*?\[\]]/.test(file)), false);
assert.equal(panelOnlyAgencyScopeSuccessorText, `${JSON.stringify(panelOnlyAgencyScopeSuccessor, null, 2)}\n`, '[V183] manifest_not_canonical');
assert.equal(panelOnlyAgencyScopeSuccessor.freezeId, 'EC_PANEL_ONLY_AGENCY_CITY_SCOPE_V183_20260918');
assert.equal(panelOnlyAgencyScopeSuccessor.version, 'V183');
assert.equal(panelOnlyAgencyScopeSuccessor.parentCommit, '1c0e1457e0feedf8cd08e76a1593c9018a7ac3a1');
assert.equal(panelOnlyAgencyScopeSuccessor.parentTree, 'f2f46aec3e0b05e6da95df57fcf3696bfff5a2a0');
assert.equal(panelOnlyAgencyScopeSuccessor.policy.panelOptInOnly, true);
assert.equal(panelOnlyAgencyScopeSuccessor.policy.defaultStrictCityScope, false);
assert.equal(panelOnlyAgencyScopeSuccessor.policy.botBehaviorDiff, 0);
assert.equal(panelOnlyAgencyScopeSuccessor.policy.productionChanged, false);
assert.equal(panelOnlyAgencyScopeSuccessor.policy.deployExecuted, false);
assert.deepEqual([...panelOnlyAgencyScopeSuccessor.overrides].sort(), Object.keys(panelOnlyAgencyScopeSuccessor.protectedFiles).sort());
assert.equal(panelOnlyAgencyScopeSuccessor.overrides.some((file) => /[*?\[\]]/.test(file)), false);

for (const [file, expected] of Object.entries(manifest.protectedFiles)) {
    assert.equal(hashFile(file), panelOnlyAgencyScopeSuccessor.protectedFiles[file] || panelFastLoadSuccessor.protectedFiles[file] || customerStatusSuccessor.protectedFiles[file] || panelStatusSuccessor.protectedFiles[file] || latestSuccessor.protectedFiles[file] || successor.protectedFiles[file] || expected, `[V170/V171/V176/V177/V178/V179/V183] protected_file_invalid:${file}`);
}
for (const [file, expected] of Object.entries(successor.protectedFiles)) {
    assert.equal(hashFile(file), panelOnlyAgencyScopeSuccessor.protectedFiles[file] || panelFastLoadSuccessor.protectedFiles[file] || customerStatusSuccessor.protectedFiles[file] || panelStatusSuccessor.protectedFiles[file] || latestSuccessor.protectedFiles[file] || expected, `[V171/V176/V177/V178/V179/V183] protected_file_invalid:${file}`);
}
for (const [file, expected] of Object.entries(latestSuccessor.protectedFiles)) {
    assert.equal(hashFile(file), panelOnlyAgencyScopeSuccessor.protectedFiles[file] || panelFastLoadSuccessor.protectedFiles[file] || customerStatusSuccessor.protectedFiles[file] || panelStatusSuccessor.protectedFiles[file] || expected, `[V176/V177/V178/V179/V183] protected_file_invalid:${file}`);
}
for (const [file, expected] of Object.entries(panelStatusSuccessor.protectedFiles)) {
    assert.equal(hashFile(file), panelOnlyAgencyScopeSuccessor.protectedFiles[file] || panelFastLoadSuccessor.protectedFiles[file] || customerStatusSuccessor.protectedFiles[file] || expected, `[V177/V178/V179/V183] protected_file_invalid:${file}`);
}
for (const [file, expected] of Object.entries(customerStatusSuccessor.protectedFiles)) {
    assert.equal(hashFile(file), panelOnlyAgencyScopeSuccessor.protectedFiles[file] || panelFastLoadSuccessor.protectedFiles[file] || expected, `[V178/V179/V183] protected_file_invalid:${file}`);
}
for (const [file, expected] of Object.entries(panelFastLoadSuccessor.protectedFiles)) {
    assert.equal(hashFile(file), panelOnlyAgencyScopeSuccessor.protectedFiles[file] || expected, `[V179/V183] protected_file_invalid:${file}`);
}
for (const [file, expected] of Object.entries(panelOnlyAgencyScopeSuccessor.protectedFiles)) {
    assert.equal(hashFile(file), expected, `[V183] protected_file_invalid:${file}`);
}

for (const key of ['__VITALISMEN_SUCCESSOR_OVERRIDE_FILES']) {
    globalThis[key] = [...new Set([...(globalThis[key] || []), ...manifest.overrides, ...successor.overrides, ...latestSuccessor.overrides, ...panelStatusSuccessor.overrides, ...customerStatusSuccessor.overrides, ...panelFastLoadSuccessor.overrides, ...panelOnlyAgencyScopeSuccessor.overrides])];
}

globalThis.__VITALISMEN_V170_PRETRAFFIC_FINAL_CONTEXT = Object.freeze({
    loaded: true,
    freezeId: manifest.freezeId,
    parentCommit: manifest.parentCommit,
    manifestSha256: crypto.createHash('sha256').update(text).digest('hex'),
    authorizedFiles: Object.freeze([...new Set([...manifest.overrides, ...successor.overrides, ...latestSuccessor.overrides, ...panelStatusSuccessor.overrides, ...customerStatusSuccessor.overrides, ...panelFastLoadSuccessor.overrides, ...panelOnlyAgencyScopeSuccessor.overrides])]),
    protectedFiles: Object.freeze({ ...manifest.protectedFiles, ...successor.protectedFiles, ...latestSuccessor.protectedFiles, ...panelStatusSuccessor.protectedFiles, ...customerStatusSuccessor.protectedFiles, ...panelFastLoadSuccessor.protectedFiles, ...panelOnlyAgencyScopeSuccessor.protectedFiles }),
    successorFreezeId: panelOnlyAgencyScopeSuccessor.freezeId,
    successorManifestSha256: crypto.createHash('sha256').update(panelOnlyAgencyScopeSuccessorText).digest('hex')
});

globalThis.__VITALISMEN_V171_TRAFFIC_RESTORATION_CONTEXT = Object.freeze({
    loaded: true,
    freezeId: successor.freezeId,
    parentCommit: successor.parentCommit,
    manifestSha256: crypto.createHash('sha256').update(successorText).digest('hex'),
    authorizedFiles: Object.freeze([...new Set([...successor.overrides, ...latestSuccessor.overrides, ...panelStatusSuccessor.overrides, ...customerStatusSuccessor.overrides, ...panelFastLoadSuccessor.overrides, ...panelOnlyAgencyScopeSuccessor.overrides])]),
    protectedFiles: Object.freeze({ ...successor.protectedFiles, ...latestSuccessor.protectedFiles, ...panelStatusSuccessor.protectedFiles, ...customerStatusSuccessor.protectedFiles, ...panelFastLoadSuccessor.protectedFiles, ...panelOnlyAgencyScopeSuccessor.protectedFiles }),
    successorFreezeId: panelOnlyAgencyScopeSuccessor.freezeId,
    successorManifestSha256: crypto.createHash('sha256').update(panelOnlyAgencyScopeSuccessorText).digest('hex')
});

globalThis.__VITALISMEN_V176_PANEL_CONTACTABLE_PRELEAD_CONTEXT = Object.freeze({
    loaded: true,
    freezeId: latestSuccessor.freezeId,
    parentCommit: latestSuccessor.parentCommit,
    manifestSha256: crypto.createHash('sha256').update(latestSuccessorText).digest('hex'),
    authorizedFiles: Object.freeze([...new Set([...latestSuccessor.overrides, ...panelStatusSuccessor.overrides, ...customerStatusSuccessor.overrides, ...panelFastLoadSuccessor.overrides, ...panelOnlyAgencyScopeSuccessor.overrides])]),
    protectedFiles: Object.freeze({ ...latestSuccessor.protectedFiles, ...panelStatusSuccessor.protectedFiles, ...customerStatusSuccessor.protectedFiles, ...panelFastLoadSuccessor.protectedFiles, ...panelOnlyAgencyScopeSuccessor.protectedFiles }),
    successorFreezeId: panelOnlyAgencyScopeSuccessor.freezeId,
    successorManifestSha256: crypto.createHash('sha256').update(panelOnlyAgencyScopeSuccessorText).digest('hex')
});

globalThis.__VITALISMEN_V177_PANEL_STATUS_CONTEXT = Object.freeze({
    loaded: true,
    freezeId: panelStatusSuccessor.freezeId,
    parentCommit: panelStatusSuccessor.parentCommit,
    manifestSha256: crypto.createHash('sha256').update(panelStatusSuccessorText).digest('hex'),
    authorizedFiles: Object.freeze([...new Set([...panelStatusSuccessor.overrides, ...customerStatusSuccessor.overrides, ...panelFastLoadSuccessor.overrides, ...panelOnlyAgencyScopeSuccessor.overrides])]),
    protectedFiles: Object.freeze({ ...panelStatusSuccessor.protectedFiles, ...customerStatusSuccessor.protectedFiles, ...panelFastLoadSuccessor.protectedFiles, ...panelOnlyAgencyScopeSuccessor.protectedFiles }),
    successorFreezeId: panelOnlyAgencyScopeSuccessor.freezeId,
    successorManifestSha256: crypto.createHash('sha256').update(panelOnlyAgencyScopeSuccessorText).digest('hex'),
    policy: Object.freeze({ ...panelStatusSuccessor.policy })
});

globalThis.__VITALISMEN_V178_PANEL_CUSTOMER_STATUS_CONTEXT = Object.freeze({
    loaded: true,
    freezeId: customerStatusSuccessor.freezeId,
    parentCommit: customerStatusSuccessor.parentCommit,
    manifestSha256: crypto.createHash('sha256').update(customerStatusSuccessorText).digest('hex'),
    authorizedFiles: Object.freeze([...new Set([...customerStatusSuccessor.overrides, ...panelFastLoadSuccessor.overrides, ...panelOnlyAgencyScopeSuccessor.overrides])]),
    protectedFiles: Object.freeze({ ...customerStatusSuccessor.protectedFiles, ...panelFastLoadSuccessor.protectedFiles, ...panelOnlyAgencyScopeSuccessor.protectedFiles }),
    successorFreezeId: panelOnlyAgencyScopeSuccessor.freezeId,
    successorManifestSha256: crypto.createHash('sha256').update(panelOnlyAgencyScopeSuccessorText).digest('hex'),
    policy: Object.freeze({ ...customerStatusSuccessor.policy })
});

globalThis.__VITALISMEN_V179_PANEL_FAST_LOAD_CONTEXT = Object.freeze({
    loaded: true,
    freezeId: panelFastLoadSuccessor.freezeId,
    parentCommit: panelFastLoadSuccessor.parentCommit,
    manifestSha256: crypto.createHash('sha256').update(panelFastLoadSuccessorText).digest('hex'),
    authorizedFiles: Object.freeze([...new Set([...panelFastLoadSuccessor.overrides, ...panelOnlyAgencyScopeSuccessor.overrides])]),
    protectedFiles: Object.freeze({ ...panelFastLoadSuccessor.protectedFiles, ...panelOnlyAgencyScopeSuccessor.protectedFiles }),
    successorFreezeId: panelOnlyAgencyScopeSuccessor.freezeId,
    successorManifestSha256: crypto.createHash('sha256').update(panelOnlyAgencyScopeSuccessorText).digest('hex'),
    policy: Object.freeze({ ...panelFastLoadSuccessor.policy })
});
