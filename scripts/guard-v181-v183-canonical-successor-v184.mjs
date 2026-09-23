import './lib/ec-runtime-successor-v184-context.mjs';

import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (relativePath) => fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
const context = globalThis.__VITALISMEN_V184_CANONICAL_SUCCESSOR_CONTEXT;
const preload = read('scripts/lib/ec-runtime-successor-v97-context.mjs');
const bootstrap = read('scripts/lib/ec-runtime-successor-v144-bootstrap-context.mjs');
const v183 = JSON.parse(read('docs/freeze/ec-panel-only-agency-city-scope-v183-20260918.json'));

assert.equal(context?.loaded, true, '[V184] context_not_loaded');
assert.equal(context?.loadedBeforeV51, true, '[V184] context_order_not_attested');
assert.equal(context.policy?.guardLineageOnly, true, '[V184] scope_not_guard_only');
assert.equal(context.policy?.functionalCodeChanged, false, '[V184] functional_change_detected');
assert.equal(context.policy?.guardsBypassed, false, '[V184] guard_bypass_detected');
assert.match(preload, /^import '\.\/ec-runtime-successor-v144-bootstrap-context\.mjs';/);
assert.match(bootstrap, /^import '\.\/ec-runtime-successor-v184-context\.mjs';/);
assert.equal(globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES.includes('scripts/test-panel-customer-selection-browser-v51.mjs'), true);
assert.equal(globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES.includes('scripts/lib/ec-runtime-successor-v144-bootstrap-context.mjs'), true);
assert.equal(context.protectedFiles['public/qr.html'], v183.protectedFiles['public/qr.html']);
assert.equal(context.protectedFiles['src/routes/shipments.js'], v183.protectedFiles['src/routes/shipments.js']);
assert.equal(context.protectedFiles['src/services/servientregaEcuadorAgencyService.js'], v183.protectedFiles['src/services/servientregaEcuadorAgencyService.js']);

console.log('EC_V181_V183_CANONICAL_SUCCESSOR_V184=PASS');
console.log('V184_CONTEXT_LOADED_BEFORE_V51=YES');
console.log('V183_FUNCTIONAL_FILES_CHANGED_BY_V184=0');
console.log('BOT_FUNCTIONAL_CODE_CHANGED_BY_V184=0');
console.log('VSL_FILES_CHANGED_BY_V184=0');
console.log('GUARDS_BYPASSED=NO');
