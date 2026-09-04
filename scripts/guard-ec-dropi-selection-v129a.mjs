import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const read = file => fs.readFileSync(new URL('../' + file, import.meta.url));
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
export const assertDropiSelectionV129A = () => {
    const manifest = JSON.parse(read('docs/freeze/ec-dropi-selection-v129a.json'));
    assert.equal(manifest.parentCommit, '40f9ddba7d00eec59fa1c322f684092d1a8c0560');
    assert.equal(manifest.layer, 'DROPI_MULTI_PRODUCT_ELIGIBILITY');
    assert.deepEqual(manifest.overrides, ['public/leads-window.html', 'src/services/ecBotCoreRuntimeIntegrationV78Service.js', 'src/services/ecManualDropiReleaseV119Service.js']);
    assert.equal(hash(read('docs/freeze/ec-admin-dropi-draft-bridge-v128-20260904.json')), manifest.parentManifestSha256);
    for (const [file, expected] of Object.entries(manifest.protectedFiles)) assert.equal(hash(read(file)), expected, file);
    assert.equal(manifest.bundleSha256, hash(Object.entries(manifest.protectedFiles).map(([file, sha]) => `${file}\0${sha}\n`).join('')));
    const panel = read('public/leads-window.html').toString();
    const saveFlow = panel.slice(panel.indexOf("modal.addEventListener('click', async (event) => {"), panel.indexOf('document.body.appendChild(modal);', panel.indexOf("modal.addEventListener('click', async (event) => {")));
    assert.match(saveFlow, /\/configure-order/);
    assert.doesNotMatch(saveFlow, /submitLeadToDropi|authorize-submit/);
    return manifest;
};
if (process.argv[1] === fileURLToPath(import.meta.url)) { assertDropiSelectionV129A(); console.log('DROPI_SELECTION_V129A=PASS'); }
