import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import test from 'node:test';
const root=new URL('../',import.meta.url);
const helper=fs.readFileSync(new URL('src/services/ecHistoricalOrderStatusV203Service.js',root),'utf8').replaceAll('export const ','const ');
const source=fs.readFileSync(new URL('src/services/orderDuplicateGuardService.js',root),'utf8').replace(/^import .*;\r?\n/gm,'').replaceAll('export const ','const ');
const phone='593989183714',old='EC-RECOMPRA-OLD',fresh='EC-RECOMPRA-NEW';
const audited=()=>({country:'EC',orderId:old,status:'delivered',customer:{phone},manualHistoricalStatusV203:{version:203,source:'authenticated_operator',status:'delivered',orderId:old,phone,actorId:'6a651155041ab4949ebb4ecd',recordedAt:'2026-11-12T12:00:00Z'}});
const ship=()=>({country:'EC',orderId:old,client:{phone},logistics:{status:'PENDIENTE'},automation:{submittedToDroppiAt:'2026-11-09T07:00:00Z'},raw:{droppiOrder:{id:'7863339'}},review:{reviewStatus:'manual_terminal_recorded_v203'}});
async function guard({orders=[audited()],shipments=[ship()],input={}}={}){
 const query=value=>({sort(){return this},limit(){return this},lean:async()=>value,then:(r,j)=>Promise.resolve(value).then(r,j)});
 const model=(rows,kind)=>({find:()=>query(rows),findOne:q=>query(rows.find(r=>typeof q.orderId==='string'?r.orderId===q.orderId:kind==='shipment'?(q.$or?!!r.raw?.droppiOrder?.id:!!r.logistics?.trackingNumber):(q.dropiOrderId?!!r.dropiOrderId:!!r.trackingNumber))||null)});
 const context=vm.createContext({Order:model(orders,'order'),Shipment:model(shipments,'shipment'),process:{env:{}},Date,Map,Set});
 return vm.runInContext(helper+'\n'+source+'\ngetOrderDuplicateGuard',context)({phone,country:'EC',currentOrderId:fresh,...input});
}
test('manual delivered order closes its stale shipment duplicate, with manual authorization still required',async()=>{const r=await guard();assert.equal(r.allowed,true);assert.equal(r.requiresManualAuthorization,true);assert.equal(r.reason,'repurchase_manual_authorization_required')});
test('active historical order remains blocked',async()=>{const o=audited();o.status='shipped';assert.equal((await guard({orders:[o]})).allowed,false)});
test('delivered status without authenticated audit cannot close pending shipment',async()=>{const o=audited();delete o.manualHistoricalStatusV203;assert.equal((await guard({orders:[o]})).allowed,false)});
for(const [field,value]of [['source','untrusted'],['actorId','bad'],['recordedAt','invalid'],['phone','593999999999'],['orderId','EC-OTHER'],['version',204],['status','returned']])test('invalid audit '+field+' remains blocked',async()=>{const o=audited();o.manualHistoricalStatusV203[field]=value;assert.equal((await guard({orders:[o]})).allowed,false)});
test('missing matching order remains blocked',async()=>{assert.equal((await guard({orders:[]})).allowed,false)});
test('returned provider evidence remains blocked by required customer eligibility',async()=>{const s=ship();s.outcomes={returned:true};assert.equal((await guard({shipments:[s]})).allowed,true);const ctx=vm.createContext({Date,Map,Set});const eligible=vm.runInContext(helper+'\nhistoricalEligibilityV203',ctx);assert.equal(eligible({phone,orders:[audited()],shipments:[s]}).eligible,false)});
test('conflicting return and delivery remains blocked by required customer eligibility',async()=>{const s=ship();s.outcomes={returned:true,delivered:true};assert.equal((await guard({shipments:[s]})).allowed,true);/* Existing duplicate guard closes provider-terminal records; customer eligibility independently rejects the conflict. */
 const ctx=vm.createContext({Date,Map,Set});const eligible=vm.runInContext(helper+'\nhistoricalEligibilityV203',ctx);assert.equal(eligible({phone,orders:[audited()],shipments:[s]}).eligible,false)});
test('same tracking remains blocked before closure exception',async()=>{const s=ship();s.logistics.trackingNumber='GUIDE';assert.equal((await guard({shipments:[s],input:{trackingNumber:'GUIDE'}})).reason,'same_tracking_duplicate')});
test('same Dropi ID remains blocked before closure exception',async()=>{assert.equal((await guard({input:{dropiOrderId:'7863339'}})).reason,'same_dropi_order_duplicate')});
test('foreign country does not gain audited closure',async()=>{assert.equal((await guard({input:{country:'OTHER'}})).allowed,false)});
test('different shipment customer does not gain audited closure',async()=>{const s=ship();s.client.phone='593999999999';assert.equal((await guard({shipments:[s]})).allowed,false)});
test('different order customer does not gain audited closure',async()=>{const o=audited();o.customer.phone='593999999999';assert.equal((await guard({orders:[o]})).allowed,false)});
test('foreign shipment does not gain audited closure',async()=>{const s=ship();s.country='OTHER';assert.equal((await guard({shipments:[s]})).allowed,false)});
