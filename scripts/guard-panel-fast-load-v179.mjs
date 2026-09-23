import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (relativePath) => fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
const panel = read('public/qr.html');
const route = read('src/routes/whatsapp.js');
const readModel = read('src/services/panelCustomerReadModelService.js');

assert.match(readModel, /includeCustomerDataResolution\s*=\s*true/);
assert.match(readModel, /includeCustomerDataResolution\s*\?\s*currentCustomerDataResolution/);
assert.match(route, /includeCustomerDataResolution:\s*false/);
assert.match(
    panel,
    /if \(state\.token && !document\.hidden && !state\.chatsLoading\) loadChats\(\)\.catch\(\(\) => null\);/
);

assert.match(panel, /customerFormSaveInFlight:\s*false/);
assert.match(panel, /return merged;/);
assert.doesNotMatch(route, /DROPPI_EC_ACTIVE_SYNC_ENABLED\s*=|VITALISMEN_META_PURCHASE_ENABLED\s*=|WHATSAPP_AUTO_REPLY_ENABLED\s*=/);

console.log('EC_PANEL_FAST_LOAD_V179=PASS');
console.log('FAST_LIST_DATA_RESOLUTION=SKIPPED');
console.log('SELECTED_CUSTOMER_PROFILE=DETAILED_PRESERVED');
console.log('OVERLAPPING_PERIODIC_CHAT_REFRESH=BLOCKED');
console.log('V178_STATUS_SAVE=PRESERVED');
console.log('EXTERNAL_EFFECTS_CHANGED=NO');
