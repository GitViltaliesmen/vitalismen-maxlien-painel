import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

await import('./lib/ec-runtime-successor-v97-context.mjs');

const manifestUrl = new URL('../docs/freeze/ec-postsale-canonical-restoration-v147-20260909.json', import.meta.url);
const manifestText = fs.readFileSync(manifestUrl, 'utf8');
const manifest = JSON.parse(manifestText);
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

assert.equal(manifestText, `${JSON.stringify(manifest, null, 2)}\n`, 'manifesto V147 não canônico');
assert.equal(manifest.freezeId, 'EC_POSTSALE_CANONICAL_RESTORATION_V147_20260909');
assert.equal(manifest.layer, 'V147');
assert.equal(manifest.parentCommit, '4d848d749255bfd0a7bdc47ac52390b74311966b');
assert.equal(manifest.parentTree, 'ec73378896f2ceb64dfa8b2d9cb2d5dd85df7cf9');
assert.equal(manifest.parentTag, 'production-20260908-4d848d7');
assert.equal(manifest.parentFreezeTag, 'freeze-production-v146-r2-official-preload-repurchase-20260908');
assert.equal(manifest.policy.productionChanged, false);
assert.equal(manifest.policy.publicationAllowed, false);
assert.equal(manifest.policy.currentSwitchAllowed, false);
assert.equal(manifest.policy.pm2RestartAllowed, false);
assert.equal(manifest.policy.realMessagesSent, 0);
assert.equal(manifest.policy.transport, 'SINK');
assert.equal(manifest.policy.dropiStatusAuthoritativeForPickup, false);
assert.equal(manifest.policy.servientregaLiveAuthoritative, true);
assert.equal(manifest.policy.operatorApprovalRequired, true);
assert.equal(globalThis.__VITALISMEN_V147_CONTEXT?.loaded, true, 'preload oficial V147 ausente');
assert.equal(globalThis.__VITALISMEN_V146_CONTEXT?.loaded, true, 'ancestral V146 ausente');

for (const [relativePath, expectedHash] of Object.entries(manifest.protectedFiles || {})) {
    const actual = sha256(fs.readFileSync(new URL(`../${relativePath}`, import.meta.url)));
    assert.equal(actual, expectedHash, `V147 divergente: ${relativePath}`);
}

const carrier = fs.readFileSync(new URL('../src/services/carrierTrackingService.js', import.meta.url), 'utf8');
const dispatcher = fs.readFileSync(new URL('../src/services/shipmentStatusDispatcherService.js', import.meta.url), 'utf8');
const executor = fs.readFileSync(new URL('../ops/post-sale-v116', import.meta.url), 'utf8');
const reminders = fs.readFileSync(new URL('../src/services/shipmentMessageService.js', import.meta.url), 'utf8');
assert.match(carrier, /canonicalLogisticsProjectionV147/);
assert.match(dispatcher, /customerId[\s\S]*orderId[\s\S]*shipmentId[\s\S]*canonicalEvent[\s\S]*templateId/);
assert.match(executor, /\/proc\/\$pid\/cmdline/);
assert.doesNotMatch(executor, /pm2 jlist/);
assert.match(reminders, /\{ kind: 'day3', field: 'reminderDay3At', days: 3 \}/);
assert.match(reminders, /\{ kind: 'day5', field: 'reminderDay5At', days: 5 \}/);

console.log('EC_POSTSALE_CANONICAL_RESTORATION_V147=PASS');
console.log(`V147_MANIFEST_SHA256=${sha256(manifestText)}`);
