import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
test('registered Tex measurement and inherited public link capabilities keep their exact scope',async()=>{
 const measurement=globalThis.__VITALISMEN_EC_TEX_MEASUREMENT_V243,linked=globalThis.__VITALISMEN_EC_TEX_LINKED_ENTRY_V242;
 assert.equal(measurement.kind,'TEX_MEASUREMENT_V243');assert.equal(linked.kind,'TEX_LINKED_ENTRY_V242');
 assert.equal(measurement.officialPhone,'553171862958');assert.equal(measurement.ownerPhone,'5531971862958');
 assert.equal(measurement.isCurrent(),false);
 if(process.env.GIRA21X_FIXTURE_PROFILE_V1==='true'){
  assert.equal(linked.isCurrent(),false);
 }else{
  assert.notEqual(await fs.readlink('/proc/self/ns/net'),await fs.readlink('/proc/1/ns/net'));
  assert.notEqual(await fs.readlink('/proc/self/ns/mnt'),await fs.readlink('/proc/1/ns/mnt'));
  assert.equal(linked.isStoreCurrent(),true);assert.equal(linked.isCurrent(),true);
 }
});
