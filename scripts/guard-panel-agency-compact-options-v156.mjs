import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const read = (relative) => fs.readFileSync(path.resolve(relative), 'utf8');
const hash = (relative) => crypto.createHash('sha256').update(fs.readFileSync(path.resolve(relative))).digest('hex');
const manifestPath = 'docs/freeze/ec-panel-agency-compact-options-v156-20260913.json';
const text = read(manifestPath);
const manifest = JSON.parse(text);
assert.equal(text, `${JSON.stringify(manifest, null, 2)}\n`);
assert.equal(manifest.freezeId, 'EC_PANEL_AGENCY_COMPACT_OPTIONS_V156_20260913');
assert.equal(manifest.version, 156);
assert.equal(manifest.parentCommit, '5508829f634b566e826e70e428eae1f9416a0e07');
assert.equal(manifest.parentTree, '23828e7151b54fb339e25808054f84b04c256db2');
assert.equal(manifest.parentManifestSha256, '0caaa7c79ddd3582b6736179c733513d2ec91c5e729997476ddd4cc6539bc844');
assert.deepEqual([...manifest.overrides].sort(), Object.keys(manifest.protectedFiles).sort());
for (const [relative, expected] of Object.entries(manifest.protectedFiles)) {
    assert.equal(hash(relative), expected, `V156 protected file diverged: ${relative}`);
}

const catalog = read('public/panel-intelligence/agency-catalog.js');
const panel = read('public/qr.html');
const bootstrap = read('scripts/lib/ec-runtime-successor-v144-bootstrap-context.mjs');
const parentContext = read('scripts/lib/ec-runtime-successor-v155-context.mjs');
assert.match(catalog, /formatAgencyOptionMessage/);
assert.match(catalog, /`Opción \$\{optionNumber\}: \$\{fullName\}`/);
assert.match(catalog, /sector \? `Sector \$\{sector\}` : ''/);
assert.match(panel, /agencyOptionLine\(agency, startNumber \+ index\)/);
assert.match(panel, /startNumber: state\.agencySuggestionOffset \+ index \+ 1/);
assert.match(panel, /startNumber: state\.agencySuggestionOffset \+ 1/);
assert.match(panel, /agencies\.filter\(Boolean\)\.slice\(0, 4\)/);
assert.match(panel, /window\.setTimeout\(resolve, 850\)/);
assert.doesNotMatch(panel, /`Agencia: \$\{name\}`/);
assert.doesNotMatch(panel, /`Direccion \/ Referencia: \$\{address\}`/);
assert.doesNotMatch(panel, /`Ciudad \/ Provincia: \$\{location\}`/);
assert.ok(bootstrap.indexOf("ec-runtime-successor-v156-context.mjs") < bootstrap.indexOf("ec-runtime-successor-v155-context.mjs"));
assert.match(parentContext, /successorOverrides/);
assert.equal(manifest.policy.maximumAgenciesPerClick, 4);
assert.equal(manifest.policy.absoluteNumberingAcrossBatches, true);
assert.equal(manifest.policy.sectorIncludedWhenAvailable, true);
assert.equal(manifest.policy.messagesSentByValidation, 0);
assert.equal(manifest.policy.funnelEngineChanged, false);
assert.equal(manifest.policy.postSaleChanged, false);
assert.equal(manifest.policy.dropiChanged, false);
assert.equal(manifest.policy.metaCapiChanged, false);
console.log('EC_PANEL_AGENCY_COMPACT_OPTIONS_V156=PASS');
