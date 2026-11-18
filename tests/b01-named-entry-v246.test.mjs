import test from 'node:test';
import assert from 'node:assert/strict';
import {isB01GenericEntry,firstName,b01AttemptKeyV244,b01ReservationFingerprintV244} from '../src/services/vitPowerB01CoreV216Service.js';
const cta='Hola, vengo del video.\nQuiero conocer la oferta disponible de Vit Power.\n¡Me interesa aprovechar la mejor promoción y hacer mi pedido! ¿Me ayudan?';
for(const [label,entry] of [
 ['line-separated',cta+'\nNombre: Gerson'],
 ['single-line',cta.replaceAll('\n',' ')+' Nombre: Gerson'],
 ['single-line-full-name',cta.replaceAll('\n',' ')+' Nombre: Gerson Silva'],
 ['CRLF',cta.replaceAll('\n','\r\n')+'\r\nNombre: Gerson'],
 ['nonbreaking-spaces',cta.replaceAll('\n','\u00a0')+'\u00a0Nombre: Gerson'],
 ['extra-spaces',cta.replaceAll('\n','   ')+'  Nome: Gerson'],
])test('generic named entry survives '+label,()=>{assert.equal(isB01GenericEntry(entry),true);assert.equal(firstName(entry),'Gerson')});
test('inline Unicode first name is captured',()=>{const x=cta.replaceAll('\n',' ')+' Nombre: José Pérez';assert.equal(firstName(x),'José');assert.equal(isB01GenericEntry(x),true)});
for(const x of [
 cta.replaceAll('\n',' ')+' Nombre: Gerson ¿Cuánto cuesta?',
 cta.replaceAll('\n',' ')+' ¿Qué contiene Vit Power? Nombre: Gerson',
 cta.replaceAll('\n',' ')+' Quiero 3 frascos. Nombre: Gerson',
 cta.replaceAll('\n',' ')+' Confirmo mi pedido. Nombre: Gerson',
 cta.replaceAll('\n',' ')+' Dirección: Calle 123. Nombre: Gerson',
 '¿Cuánto cuesta Vit Power? Nombre: Gerson',
 '¿Qué contiene Vit Power? Nombre: Gerson',
 'Hola, quiero el tratamiento Tex Ultra. Nombre: Gerson',
 'Hola, quiero Nitrix. Nombre: Gerson',
 cta.replaceAll('\n',' ')+' Nombre: https://invalid.example',
 cta.replaceAll('\n',' ')+' Nombre: '+'A'.repeat(90),
])test('specific intent and invalid suffix stay outside generic B01: '+x.slice(-65),()=>assert.equal(isB01GenericEntry(x),false));
test('known generic no-name greetings retain behavior',()=>{for(const x of ['Hola','Buenas tardes',cta,cta.replaceAll('\n',' ')])assert.equal(isB01GenericEntry(x),true)});
test('new name handling never changes reservation identities',()=>{const job={phone:'593980000071',cursor:4};assert.match(b01AttemptKeyV244(job),/^[a-f0-9]{64}$/);assert.match(b01ReservationFingerprintV244(job),/^[a-f0-9]{64}$/);assert.throws(()=>b01AttemptKeyV244({phone:'5515998038637',cursor:0}),/native_qa_permit_required/)});

import {isVerifiedVitPowerFirstEntryV246 as verifiedEntry} from '../src/services/vitPowerEntryContextV246Service.js';
const flatEntry=cta.replaceAll('\n',' ')+' Nombre: Gerson';
const firstInput={phone:'593980000071',productKey:'vit_power_ec',sessionId:'zapi',text:flatEntry,inboundId:'TEST_NATIVE_INITIAL'};
const firstState={phoneDigits:firstInput.phone,firstInboundText:flatEntry,metadata:{}};
test('first persisted generic EC message gets the B01 lane without claiming VSL attribution',()=>{assert.equal(verifiedEntry({input:firstInput,state:firstState,firstPersistedInbound:true}),true);assert.equal(firstState.metadata.vslEntryMessage,undefined)});
test('multiple inbound messages cannot claim ordinary first-entry authority',()=>assert.equal(verifiedEntry({input:firstInput,state:firstState,firstPersistedInbound:false}),false));
test('prior B01 cannot be restarted through the generic lane',()=>assert.equal(verifiedEntry({input:firstInput,state:{...firstState,vitPowerB01:{status:'done'}},firstPersistedInbound:true}),false));
for(const productKey of ['tex_ultra_ec','nitrix_ec',''])test('other product cannot use Vit Power entry lane '+productKey,()=>assert.equal(verifiedEntry({input:{...firstInput,productKey},state:firstState,firstPersistedInbound:true}),false));
test('questions appended to the public CTA retain question priority',()=>assert.equal(verifiedEntry({input:{...firstInput,text:flatEntry+' ¿Qué contiene?'},state:firstState,firstPersistedInbound:true}),false));
const qaInput={...firstInput,phone:'5515998038637'};
const qaState={phoneDigits:qaInput.phone,firstInboundText:'Hola',metadata:{qaTestContextV78:{routingPhase:'initial',routingMessageId:qaInput.inboundId}}};
test('only a verified native initial QA claim can supersede an earlier expired Hola',()=>{assert.equal(verifiedEntry({input:qaInput,state:qaState,verifiedQaInitial:true}),true);assert.equal(verifiedEntry({input:qaInput,state:qaState,verifiedQaInitial:false}),false)});
test('a client field is not native initial authority',()=>assert.equal(verifiedEntry({input:{...qaInput,verifiedQaInitial:true},state:qaState}),false));
test('QA followup cannot restart the initial B01 lane',()=>assert.equal(verifiedEntry({input:qaInput,state:{...qaState,metadata:{qaTestContextV78:{routingPhase:'followup',routingMessageId:qaInput.inboundId}}},verifiedQaInitial:true}),false));
test('native initial proof for another inbound is rejected',()=>assert.equal(verifiedEntry({input:qaInput,state:{...qaState,metadata:{qaTestContextV78:{routingPhase:'initial',routingMessageId:'OTHER_MESSAGE'}}},verifiedQaInitial:true}),false));

// Evaluate the exact small production route predicate without booting provider integrations.
import fs from 'node:fs';
const routeSource=fs.readFileSync(new URL('../src/routes/zapi.js',import.meta.url),'utf8');
const routeBody=routeSource.match(/export const isPublishedVitPowerLeadV227 = \(text = ''\) => \{([\s\S]*?)\n\};/)[1];
const routeNormalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
const published=new Function('normalizeVslText','text',routeBody).bind(null,routeNormalize);
for(const entry of [cta,cta+'\nNombre: Gerson',flatEntry,cta.replaceAll('\n',' '),cta.replaceAll('\n','\u00a0')+' Nombre: José Pérez'])test('published CTA product context accepts formatting '+entry.slice(-22),()=>assert.equal(published(entry),true));
for(const entry of ['Hola','¿Cuánto cuesta Vit Power?',flatEntry+' ¿Qué contiene?',cta.replaceAll('Vit Power','Tex Ultra'),cta+' Quiero 3 frascos',cta.replaceAll('\n',' ')+' Nombre: https://invalid.example'])test('published CTA context rejects unrelated or appended intent '+entry.slice(-35),()=>assert.equal(published(entry),false));
