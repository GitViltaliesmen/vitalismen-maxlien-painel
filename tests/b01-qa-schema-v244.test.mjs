import test from 'node:test';
import assert from 'node:assert/strict';
import Contact from '../src/models/ContactState.js';
const permit='ecqa-v78-'+'a'.repeat(32);
const create=(phone,extra={})=>new Contact({phoneDigits:phone,chatId:phone+'@c.us',vitPowerB01:{version:'vit-power-b01-v216',phone,status:'pending',cursor:0,...extra}});
test('actual strict Mongoose schema retains the optional QA permit on document round-trip',()=>{
 const first=create('5515998038637',{qaPermitId:permit});assert.equal(first.validateSync(),undefined);
 assert.equal(first.toObject().vitPowerB01.qaPermitId,permit);
 const second=new Contact(JSON.parse(JSON.stringify(first.toObject())));assert.equal(second.toObject().vitPowerB01.qaPermitId,permit);assert.equal(second.validateSync(),undefined);
});
test('ordinary EC B01 records gain no default permit field and require no backfill',()=>{
 const c=create('593980000001');assert.equal(c.validateSync(),undefined);assert.equal(Object.hasOwn(c.toObject().vitPowerB01,'qaPermitId'),false);
});
test('schema does not accept a QA permit on an EC customer',()=>{
 assert(create('593980000001',{qaPermitId:permit}).validateSync()?.errors['vitPowerB01.qaPermitId']);
});
for(const value of ['invalid','ecqa-v78-'+'A'.repeat(32),'ecqa-v78-'+'a'.repeat(33)])test('actual schema rejects malformed or oversized QA permit: '+value.length,()=>{
 assert(create('5515998038637',{qaPermitId:value}).validateSync()?.errors['vitPowerB01.qaPermitId']);
});
