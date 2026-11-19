import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';
const source=fs.readFileSync(new URL('../src/routes/whatsapp.js',import.meta.url),'utf8');
const line=source.slice(source.indexOf('const realContacts = contacts.filter('),source.indexOf('const commercialContacts =',source.indexOf('const realContacts = contacts.filter(')));
const count=new Function('contacts','realPhoneFromState','digitsOnly',line+'return realContacts;');
const phone=x=>x.phone||'',digits=x=>String(x).replace(/\D/g,'');
test('permanent Brazilian QA is excluded from every dashboard period and commercial total',()=>{const data=[{phone:'+5515998038637'},{phone:'+593990000001'}];assert.deepEqual(count(data,phone,digits),[data[1]]);assert.equal(data.length,2)});
test('real Ecuador client ending in the same four digits is retained',()=>{const data=[{phone:'593990008637'},{phone:'593990000002'}];assert.deepEqual(count(data,phone,digits),data)});
test('invalid unresolved contacts remain excluded and no other contact identity changes',()=>{const real={phone:'593990000003'};assert.deepEqual(count([{},real],phone,digits),[real])});
