import assert from 'node:assert/strict';
import fs from 'node:fs';

import './lib/ec-runtime-successor-v170-context.mjs';

const panel = fs.readFileSync(new URL('../public/qr.html', import.meta.url), 'utf8');
const context = globalThis.__VITALISMEN_V178_PANEL_CUSTOMER_STATUS_CONTEXT;

assert.equal(context?.loaded, true, '[V178] context_not_loaded');
assert.equal(context.policy?.vslChanged, false, '[V178] vsl_scope_changed');
assert.equal(context.policy?.backendChanged, false, '[V178] backend_scope_changed');
assert.equal(context.policy?.externalEffectsChanged, false, '[V178] external_effect_scope_changed');
assert.match(panel, /customerFormSaveInFlight:\s*false/);
assert.match(panel, /const customerFormSaveBusy = \(\) => Boolean\([\s\S]{0,180}customerFormSaveInFlight[\s\S]{0,180}customerFieldAutoSaveInFlight/);
assert.match(
    panel.slice(panel.indexOf('const applyCustomerDraftToChat ='), panel.indexOf('const mergeSavedCustomerDraftIntoChat =')),
    /return merged;/
);
assert.doesNotMatch(
    panel.slice(panel.indexOf('async function saveCustomerForm'), panel.indexOf('async function resolveSelectedIdentityConflict')),
    /state\.busy/
);
assert.doesNotMatch(
    panel.slice(panel.indexOf('const autoSaveCustomerStatusChange ='), panel.indexOf('const scheduleCustomerFieldAutoSave =')),
    /autoSaveCustomerStatusChange\(\);|if \(state\.busy\)/
);

console.log('EC_PANEL_CUSTOMER_STATUS_BUSY_V178=PASS');
console.log('STATUS_9_OF_9=PASS');
console.log('VSL_CHANGED=NO');
console.log('BACKEND_CHANGED=NO');
console.log('EXTERNAL_EFFECTS_CHANGED=NO');
