import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime, entryHashV237 } from '../src/services/vitPowerMeasurementV213Runtime.js';
import { SCOPE } from '../src/services/vitPowerMeasurementV213Core.js';
const entry='Hola, vengo del video.\nQuiero conocer la oferta disponible de Vit Power.\n¡Me interesa aprovechar la mejor promoción y hacer mi pedido! ¿Me ayudan?';
const now=new Date('2026-11-17T01:00:00Z');
const never=new Proxy({}, {get(){throw Error('UNEXPECTED_DB_ACCESS');}});
const policy={collectionApproved:true,approved:true,credentialsVerified:true,dataset:SCOPE.dataset,activatedAt:'2026-11-15T04:06:13.449Z'};
const runtime=()=>createRuntime({VisitModel:never,EventModel:never,policyProvider:()=>policy,transport:async()=>{throw Error('UNEXPECTED_NETWORK');},now:()=>now});
test('entry fingerprint normalizes only line endings, NFC and outer whitespace',()=>{
 assert.equal(entryHashV237(entry),entryHashV237(' '+entry.replaceAll('\n','\r\n')+'\n'));
 assert.notEqual(entryHashV237(entry+'\nNombre: Ana'),entryHashV237(entry+'\nNombre: Maria'));
});
for(const [name,args]of [
 ['unverified provider',{phone:'593900000001',message:entry,providerVerified:false,inboundAt:now}],
 ['QA Brazilian',{phone:'5515998038637',message:entry,providerVerified:true,inboundAt:now}],
 ['foreign Brazilian',{phone:'5511999999999',message:entry,providerVerified:true,inboundAt:now}],
 ['edited generic message',{phone:'593900000001',message:'Hola',providerVerified:true,inboundAt:now}],
 ['added health or unrelated data',{phone:'593900000001',message:entry+'\nOtro dato',providerVerified:true,inboundAt:now}],
])test('contact claim rejects '+name+' before database/network',async()=>assert.equal((await runtime().claimContactV237(args)).reason,'verified_ec_contact_entry_required'));
test('stale entry cannot claim even a declared phone',async()=>assert.equal((await runtime().claimContactV237({phone:'593900000001',message:entry,providerVerified:true,inboundAt:new Date(now-180000)})).reason,'stale_inbound'));
test('disabled capability cannot collect or bind contact data',async()=>{
 const r=createRuntime({VisitModel:never,EventModel:never,policyProvider:()=>null,transport:never,now:()=>now});
 assert.equal((await r.claimContactV237({phone:'593900000001',message:entry,providerVerified:true,inboundAt:now})).reason,'measurement_not_activated');
});
test('contact enrollment rejects foreign phone before any write',async()=>{
 const r=await runtime().capture({consent:true,visitId:'12345678-1234-4234-8234-123456789abc',visitorId:'abcdef12-1234-4234-8234-123456789abc',entryMessage:entry,contactPhone:'5515998038637',events:[{name:'Contact'}]},
 {origin:SCOPE.origin,sourceUrl:SCOPE.url,privacyAllowed:true,trustedClientContext:true,ip:'198.51.100.25',userAgent:'Offline browser'});
 assert.equal(r.reason,'invalid_ec_contact_enrollment');
});
