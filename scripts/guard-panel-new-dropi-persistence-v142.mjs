import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

export const assertPanelNewDropiPersistenceV142 = () => {
    const manifestPath = 'docs/freeze/ec-panel-new-dropi-persistence-v142-20260908.json';
    const parentPath = 'docs/freeze/ec-phone-servientrega-reconciliation-v140-20260907.json';
    const manifest = JSON.parse(read(manifestPath));
    const parent = JSON.parse(read(parentPath));

    assert.equal(manifest.parentCommit, '13e752adc08cd089181eeebe2ff527dbe97f5fa9');
    assert.equal(manifest.parentTree, '2b9c9608d110979eb56d7025d08d3506b475c4fb');
    assert.equal(manifest.parentManifestSha256, sha256(fs.readFileSync(path.join(root, parentPath))));
    for (const [file, expected] of Object.entries(parent.protectedFiles)) {
        if (manifest.overrides.includes(file)) continue;
        assert.equal(sha256(fs.readFileSync(path.join(root, file))), expected, `V140 alterada fora do override V142: ${file}`);
    }
    for (const [file, expected] of Object.entries(manifest.protectedFiles)) {
        assert.equal(sha256(fs.readFileSync(path.join(root, file))), expected, `V142 protegida divergente: ${file}`);
    }

    const panel = read('public/qr.html');
    const policy = read('public/panel-intelligence/panel-new-dropi-persistence-v142.js');
    const whatsapp = read('src/routes/whatsapp.js');
    const helper = panel.split('const prepareConfirmedAdminLeadForDropi = async')[1]
        ?.split('const applyLeadStatusUpdateLocally')[0] || '';
    const autoSave = panel.split('const autoSaveCustomerStatusChange = () =>')[1]
        ?.split('const scheduleCustomerFieldAutoSave')[0] || '';

    assert.match(panel, /panel-new-dropi-persistence-v142\.js/);
    assert.match(panel, /isManualNewContactPending\?\.\(chat\)/);
    assert.match(helper, /buildConfirmedAdminLeadPreparation/);
    assert.match(policy, /admin-leads\/\$\{encodeURIComponent\(adminMatch\[1\]\)\}\/configure-order/);
    assert.match(helper, /dropiAuthorized: false/);
    assert.match(helper, /dropiSubmitted: false/);
    assert.doesNotMatch(helper, /authorizeDropiOrder|submitDropiOrder|authorize-submit|orders\/.*\/submit/);
    assert.doesNotMatch(autoSave, /prepareConfirmedAdminLeadForDropi|configure-order|authorize-submit|submitDropiOrder/);
    assert.match(policy, /customer_data_not_ready/);
    assert.match(policy, /confirmed_order_incomplete_or_price_unknown/);
    assert.match(policy, /already_prepared/);
    assert.match(whatsapp, /manuallyCreatedAt: state\.metadata\?\.manuallyCreatedAt \|\| new Date\(\)\.toISOString\(\)/);
    assert.equal((whatsapp.match(/panelLastReadAt: contactState\?\.metadata\?\.panelLastReadAt/g) || []).length, 2);

    assert.equal(manifest.policy.manualContactRemainsNewUntilExplicitRead, true);
    assert.equal(manifest.policy.completeConfirmedAdminLeadPreparedOnExplicitSave, true);
    assert.equal(manifest.policy.automaticDropiSend, false);
    assert.equal(manifest.policy.automaticShipmentCreation, false);
    assert.equal(manifest.policy.humanDropiAuthorizationRequired, true);
    assert.equal(manifest.policy.dropiCallsOnSave, 0);
    assert.equal(manifest.policy.incompleteOrderPrepared, false);
    assert.equal(manifest.policy.preparationRoute, 'configure-order');
    return manifest;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    assertPanelNewDropiPersistenceV142();
    console.log('EC_PANEL_NEW_DROPI_PERSISTENCE_V142_GUARD=PASS');
}
