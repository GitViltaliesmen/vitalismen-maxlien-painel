import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

import {
    findServientregaEcuadorAgencies,
    normalizeAgencyText
} from '../src/services/servientregaEcuadorAgencyService.js';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const sha256 = (file) => crypto.createHash('sha256').update(read(file)).digest('hex');
const service = read('src/services/servientregaEcuadorAgencyService.js');
const route = read('src/routes/shipments.js');
const panel = read('public/qr.html');
const conversation = read('src/services/conversationEngine.js');
const observer = read('src/services/observerAttentiveReaderService.js');

assert.match(service, /strictCityScope = false/);
assert.match(service, /strictCityScopeEnabled = strictCityScope === true/);
assert.match(service, /strictCityScopeEnabled && hasCityInput && !knownLocation\.cityMatched/);
assert.match(service, /strictCityScopeEnabled && hasCityInput\s*\? agencies\.filter/);
assert.match(route, /strictCityScope:\s*String\(strictCity \|\| ''\) === '1'/);
assert.match(panel, /strictCity=1/);
assert.doesNotMatch(panel, /city=&province=&q=\$\{encodeURIComponent\(city\)\}/);
assert.doesNotMatch(conversation, /strictCityScope/);
assert.doesNotMatch(observer, /strictCityScope/);
assert.equal(sha256('src/services/conversationEngine.js'), '0fe93987f5bb7e9735355fcf896b2c86abf97b0efa03af8828eb9dcb249bbfd3');
assert.equal(sha256('src/services/observerAttentiveReaderService.js'), '8840d51b3ebbaca2602c2e0de2ba6e15d5d44946e59f377c117ab8afe6f5db97');

const huaquillas = findServientregaEcuadorAgencies({
    city: 'Huaquillas', province: 'El Oro', query: '', limit: 100, strictCityScope: true
});
assert.equal(huaquillas.length, 2);
assert.equal(huaquillas.every((agency) => normalizeAgencyText(agency.city) === 'HUAQUILLAS'), true);
assert.deepEqual(findServientregaEcuadorAgencies({
    city: 'Huaquillas', province: 'El Oro', query: 'Arenillas', limit: 100, strictCityScope: true
}), []);

console.log('EC_PANEL_ONLY_AGENCY_CITY_SCOPE_V183=PASS');
console.log('SERVICE_CHANGE_IS_PANEL_OPT_IN=YES');
console.log('SERVICE_DEFAULT_STRICT_CITY_SCOPE=FALSE');
console.log(`HUAQUILLAS_RESULTS=${huaquillas.length}`);
console.log('HUAQUILLAS_CROSS_CITY_RESULTS=0');
console.log('CONVERSATION_ENGINE_HASH=V179_PRESERVED');
console.log('OBSERVER_HASH=V179_PRESERVED');
console.log('GUARDS_BYPASSED=NO');
