import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const contract = read('src/services/metaProtocoloGAttributionService.js');
const conversions = read('src/services/metaConversionsService.js');
const registry = read('src/services/metaDestinationRegistryService.js');
const manager = read('scripts/manage-meta-destinations-v73.mjs');
const envExample = read('.env.example');
const operational = [contract, conversions, registry, manager, envExample].join('\n');

assert.match(contract, /datasetId: '920532663934291'/);
assert.match(contract, /browserPixelId: '920532663934291'/);
assert.match(contract, /tokenSource: 'env:META_ACCESS_TOKEN_EC_TEX_ULTRA_PROTOCOLO_G'/);
assert.match(contract, /eventSourceUrl: 'https:\/\/vilaliemen\.shop\/protocolo-g'/);
assert.match(contract, /Boolean\(parseVilaliemenProtocoloGUrl\(sourceUrl\)\)/);
assert.match(conversions, /accessToken: env\[PROTOCOLO_G_META_TOKEN_ENV\]/);
assert.match(registry, /META_PROTOCOLO_G_SPECIFIC_TOKEN_REQUIRED/);
assert.match(manager, /accessTokenRefs: \['env:META_ACCESS_TOKEN_EC_TEX_ULTRA_PROTOCOLO_G'\]/);
assert.doesNotMatch(operational, /2048099902484149/);
assert.doesNotMatch(
    operational,
    /META_ACCESS_TOKEN_EC_TEX_ULTRA_PROTOCOLO_G\s*\|\|\s*(?:env\.)?META_ACCESS_TOKEN_EC/
);
assert.doesNotMatch(operational, /TEST61236/);

console.log('[V189] META_CAPI_ROUTE=PASS');
console.log('[V189] DATASET=920532663934291');
console.log('[V189] TOKEN_SOURCE=env:META_ACCESS_TOKEN_EC_TEX_ULTRA_PROTOCOLO_G');
console.log('[V189] TOKEN_FALLBACK=NONE');
console.log('[V189] OLD_DATASET_OPERATIONAL_USE=0');
