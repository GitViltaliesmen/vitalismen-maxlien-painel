import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url));
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
export const assertEcDropiHumanAuthorizationV138 = () => {
    const manifest = JSON.parse(read('docs/freeze/ec-dropi-human-authorization-v138-20260907.json'));
    assert.equal(manifest.parentCommit, '0efea9b594cebacb9d2d8bd0d078f33f89151afb');
    assert.equal(manifest.layer, 'EC_DROPI_EXPLICIT_HUMAN_AUTHORIZATION');
    assert.deepEqual(manifest.overrides, ["public/leads-window.html","scripts/guard-ec-dropi-selection-v129a.mjs","scripts/guard-ec-queue-guard-compatibility-v137.mjs","scripts/lib/ec-runtime-successor-v97-context.mjs","src/routes/shipments.js","src/services/adminPanelImportService.js","src/services/droppiEcuadorBrowserService.js","src/services/ecBotCoreRuntimeIntegrationV78Service.js","src/services/protocoloGSuccessorGuardV101Service.js","tests/dropi-bff-manual-v60.test.mjs","tests/ec-admin-dropi-draft-bridge-v128.test.mjs","tests/ec-dropi-selection-v129a.test.mjs"]);
    assert.equal(hash(read('docs/freeze/ec-queue-guard-compatibility-v137-20260907.json')), manifest.parentManifestSha256);
    const successorOverrides = new Set(globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES || []);
    for (const [file, expected] of Object.entries(manifest.protectedFiles)) {
        if (successorOverrides.has(file)) continue;
        assert.equal(hash(read(file)), expected, file);
    }
    assert.equal(manifest.bundleSha256, hash(Object.entries(manifest.protectedFiles).map(([file, sha]) => `${file}\0${sha}\n`).join('')));
    const importer = read('src/services/adminPanelImportService.js').toString();
    assert.doesNotMatch(importer, /new Shipment\s*\(/, 'automatic confirmed import must not create a shipment');
    const transport = read('src/services/droppiEcuadorBrowserService.js').toString();
    assert.match(transport, /const humanBlock = ecHumanDropiSubmitBlockV138/);
    assert.match(transport, /const latestHumanBlock = ecHumanDropiSubmitBlockV138/);
    const panel = read('public/leads-window.html').toString();
    const send = panel.slice(panel.indexOf('const sendSelectedDropi ='), panel.indexOf('const setCountry =', panel.indexOf('const sendSelectedDropi =')));
    assert.doesNotMatch(send, /visibleLeads\(\)/, 'no implicit selection of visible orders');
    return manifest;
};
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    assertEcDropiHumanAuthorizationV138();
    console.log('EC_DROPI_HUMAN_AUTHORIZATION_V138=PASS');
}
