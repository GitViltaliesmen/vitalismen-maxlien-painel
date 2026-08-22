import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('./assert-ec-repurchase-sqlite-activation-approved-v47.mjs');
await import('./guard-ec-repurchase-sync-preservation-v46.mjs');

const read = (relativePath) => fs.readFileSync(relativePath, 'utf8');
const admin = read('src/services/adminPanelStatusService.js');
const testFile = read('tests/ec-repurchase-sqlite-serialization-v47.test.mjs');
const freeze = read('docs/EC_REPURCHASE_SQLITE_SERIALIZATION_FREEZE_V47_20260822.md');

assert.match(admin, /export const adminRepurchaseCycleFlag/);
assert.match(admin, /Number\(Boolean\(/);
assert.match(admin, /repurchase_cycle: adminRepurchaseCycleFlag\(order\)/);
assert.doesNotMatch(admin, /repurchase_cycle: Boolean\(/);
assert.match(testFile, /inteiro compatível com Python/);
assert.match(freeze, /inteiro `1` ou `0`/);

console.log('EC_REPURCHASE_SQLITE_SERIALIZATION_V47_GUARD=OK');
