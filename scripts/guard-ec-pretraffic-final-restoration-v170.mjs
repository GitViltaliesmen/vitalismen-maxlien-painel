import assert from 'node:assert/strict';

import './lib/ec-runtime-successor-v170-context.mjs';

const context = globalThis.__VITALISMEN_V170_PRETRAFFIC_FINAL_CONTEXT;
assert.equal(context?.loaded, true, '[V170] context_not_loaded');
assert.equal(context?.freezeId, 'EC_PRETRAFFIC_FINAL_RESTORATION_V170_20260916');
assert.equal(context?.parentCommit, '533b78f3df551c737cfc061085f2c78caf5c8508');
assert.ok(context.authorizedFiles.includes('public/qr.html'));
assert.ok(context.authorizedFiles.includes('src/services/panelCustomerReadModelService.js'));
assert.ok(context.authorizedFiles.includes('scripts/lib/freeze-lock-ec-meta-dynamic-v74-contract.mjs') === false);

console.log(`EC_PRETRAFFIC_FINAL_RESTORATION_V170=PASS manifest_sha256=${context.manifestSha256}`);
