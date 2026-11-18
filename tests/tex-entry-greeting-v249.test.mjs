import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
const read = name => fs.readFileSync(new URL('../'+name, import.meta.url), 'utf8');
const feature = read('src/services/texUltraEntryV249Service.js');
const classifier = read('src/services/texUltraEntryClassificationV246Service.js');
const greeting = read('src/services/texUltraEntryGreetingService.js');
const direct = read('src/services/ecDirectProductInquiryService.js');
const strip = s => s.replace(/^import[\s\S]*?from\s*['"][^'"]+['"];\s*$/gm,'').replace(/\bexport\s+/g,'');
function fixture(enabled=true) {
  const env={TEX_ULTRA_FUNNEL_ENABLED:'true'};
  const context=vm.createContext({Intl,Date,crypto,process:{env},globalThis:null,
    ContactState:new Proxy({}, {get(){throw Error('database_was_called')}}),Message:new Proxy({}, {get(){throw Error('history_was_called')}}),
    sendText(){throw Error('send_was_called')},getEcuadorOffer(){throw Error('catalog_was_called')},
    isOperatorProductRouteLock(){return null},getEcuadorProductInfoByKey(){throw Error('product_lookup_was_called')},
    currentProductRouteForState(){throw Error('unrelated_route_called')}});
  context.globalThis=context;
  context.__VITALISMEN_EC_TEX_ENTRY_V249={isCurrent:()=>enabled};
  for(const [name,source] of [['classifier',classifier],['feature',feature],['greeting',greeting],['direct',direct]])vm.runInContext(strip(source),context,{filename:name});
  vm.runInContext('Object.assign(globalThis, { buildTexUltraEntryGreeting, maybeHandleEcuadorDirectProductInquiry });',context);
  return context;
}
const state=()=>({countryCode:'EC',phoneDigits:'593990000079',human:{mode:'auto'},metadata:{productKey:'tex_ultra_ec',vslProductKey:'tex_ultra_ec',lastSessionId:'zapi'}});
const input=()=>({text:'Hola, quiero el tratamiento Tex Ultra.',state:state(),sourceMessageId:'SIM_NATIVE_IN_249'});
test('V249 exact published Tex entry goes to the existing funnel',()=>{const f=fixture();assert.equal(f.preferTexPublishedEntryV249(input()),true)});
test('V249 direct informational responder returns before database, history or send',async()=>{
 const f=fixture();const p=input();const r=await f.maybeHandleEcuadorDirectProductInquiry({text:p.text,contactState:p.state,contactStateId:'SIM_STATE',sourceMessageId:p.sourceMessageId,chatId:'593990000079@c.us'});assert.equal(r.handled,false);assert.equal(r.skipped,'published_tex_initial_funnel_v249');
});
test('V249 without sealed capability leaves legacy routing and greeting available',()=>{
 const f=fixture(false);assert.equal(f.preferTexPublishedEntryV249(input()),false);assert.match(f.buildTexUltraEntryGreeting({name:'Miguel Angel',date:new Date('2026-08-18T14:30:00Z'),emoji:'👋'}),/^👋 Hola, Miguel Angel, buenos días\./);
});
test('V249 unavailable/throwing capability fails closed',()=>{const f=fixture();f.__VITALISMEN_EC_TEX_ENTRY_V249={isCurrent(){throw Error('invalid')}};assert.equal(f.preferTexPublishedEntryV249(input()),false)});
test('V249 disabled Tex flag preserves legacy path',()=>{const f=fixture();f.process.env.TEX_ULTRA_FUNNEL_ENABLED='false';assert.equal(f.preferTexPublishedEntryV249(input()),false)});
test('V249 explicit price, quantity and question remain outside generic entry',()=>{
 const f=fixture();for(const text of ['¿Cuánto cuesta Tex Ultra?','Hola, quiero el tratamiento Tex Ultra. ¿Cómo se usa?','Hola, quiero el tratamiento Tex Ultra?','2 frascos Tex Ultra','Hola, quiero Tex Ultra y Vit Power.','Quiero saber los ingredientes de Tex Ultra'])assert.equal(f.preferTexPublishedEntryV249({...input(),text}),false,text);
});
test('V249 other products, operator choice and manual mode preserved',()=>{
 const f=fixture();for(const s of [{...state(),human:{mode:'manual'}},{...state(),countryCode:'BR'},{...state(),metadata:{productKey:'vit_power_ec',lastSessionId:'zapi'}},{...state(),metadata:{productKey:'nitrix_ec',lastSessionId:'zapi'}},{...state(),metadata:{...state().metadata,productRouteLock:{active:true,productKey:'vit_power_ec'}}}])assert.equal(f.preferTexPublishedEntryV249({...input(),state:s}),false);
});
test('V249 requires existing state, official session and source inbound identity',()=>{const f=fixture();for(const p of [{...input(),state:{}},{...input(),sourceMessageId:''},{...input(),state:{...state(),metadata:{...state().metadata,lastSessionId:'other'}}}])assert.equal(f.preferTexPublishedEntryV249(p),false)});
test('V249 callback text formatting keeps only the exact published intention',()=>{const f=fixture();for(const text of [' Hola, quiero el tratamiento Tex Ultra. ','HOLA, QUIERO EL TRATAMIENTO TEX ULTRA.'])assert.equal(f.preferTexPublishedEntryV249({...input(),text}),true)});
test('V249 greeting uses requested morning body and first name',()=>{
 const f=fixture();assert.equal(f.buildTexUltraEntryGreeting({name:'Alfredo Delgado',date:new Date('2026-08-18T14:30:00Z')}),'¡Hola! ¡Buenos días, Alfredo! Soy Ana Lopez, del equipo de la Dra. María Fernandes. Gracias por tu interés en Tex Ultra. Estoy aquí para ayudarte y aclarar tus dudas. Te comparto una breve presentación y seguimos conversando.');
});
test('V249 afternoon and night use Ecuador time',()=>{const f=fixture();assert.match(f.buildTexUltraEntryGreeting({name:'María Pérez',date:new Date('2026-08-18T19:00:00Z')}),/^¡Hola! ¡Buenas tardes, María!/);assert.match(f.buildTexUltraEntryGreeting({name:'José Luis',date:new Date('2026-08-18T23:00:00Z')}),/^¡Hola! ¡Buenas noches, José!/)});
test('V249 greeting changes period at Guayaquil boundaries',()=>{const f=fixture();for(const [at,text] of [['2026-08-18T09:59:59Z','Buenas noches'],['2026-08-18T10:00:00Z','Buenos días'],['2026-08-18T16:59:59Z','Buenos días'],['2026-08-18T17:00:00Z','Buenas tardes'],['2026-08-18T22:59:59Z','Buenas tardes'],['2026-08-18T23:00:00Z','Buenas noches']])assert.ok(f.buildTexUltraEntryGreeting({date:new Date(at)}).includes(text),at)});
test('V249 no default Alfredo, placeholder, phone or invalid preferred name',()=>{const f=fixture();for(const name of ['',null,undefined,'5515998038637','+593 99 239 7123','cliente','año','unknown','[Nombre]','Alfredo@example.com','<script>alert(1)</script>']){const text=f.buildTexUltraEntryGreeting({name,date:new Date('2026-08-18T14:30:00Z')});assert.match(text,/^¡Hola! ¡Buenos días!/);assert.doesNotMatch(text,/Alfredo|551599|593|unknown|Nombre|script/)} });
test('V249 accepted Unicode first name does not rewrite legal order identity',()=>{const f=fixture();const s=state();s.metadata.customerDraft={name:'María Fernanda Pérez',quantity:'2',orderId:'EC-EXISTING'};const snapshot=JSON.stringify(s);const text=f.buildTexUltraEntryGreeting({name:s.metadata.customerDraft.name,date:new Date('2026-08-18T14:30:00Z')});assert.match(text,/Buenos días, María!/);assert.equal(JSON.stringify(s),snapshot)});
test('V249 unknown greeting period is rejected',()=>{assert.throws(()=>fixture().buildTexGreetingV249({name:'Alfredo',salutation:'whatever'}),/period_required/)});
test('V249 delta preserves direct responder and greeting legacy bytes beyond exact additions',()=>{
 const contract=JSON.parse(read('docs/freeze/tex-entry-greeting-v249-contract.json'));for(const name of ['src/services/ecDirectProductInquiryService.js','src/services/texUltraEntryGreetingService.js','src/routes/zapi.js']){
  let current=read(name);for(const p of [...contract.inverse[name].patches].reverse()){assert.equal(current.split(p.after).length-1,1);current=current.replace(p.after,p.before)}assert.equal(crypto.createHash('sha256').update(current).digest('hex'),contract.inverse[name].parentSha256);
 }
});

test('V249 duplicate callback recognized only with exact official persisted and processed receipt',()=>{
 const f=fixture(),p=input();p.state.metadata.processedInboundMessageIds=[p.sourceMessageId];
 const stored={_id:p.sourceMessageId,peerPhone:p.state.phoneDigits,sessionId:'zapi',provider:'zapi',ownerPhoneDigits:'5531971862958',isFromMe:false,body:p.text,providerMessageId:p.sourceMessageId};
 const arg={text:p.text,state:p.state,messageId:p.sourceMessageId,phone:p.state.phoneDigits,storedMessage:stored};
 assert.equal(f.isProcessedTexEntryDuplicateV249(arg),true);
 for(const change of [{_id:'other'},{peerPhone:'593990000078'},{sessionId:'other'},{provider:'other'},{ownerPhoneDigits:'other'},{isFromMe:true},{body:'other'},{providerMessageId:'other'}])assert.equal(f.isProcessedTexEntryDuplicateV249({...arg,storedMessage:{...stored,...change}}),false);
 assert.equal(f.isProcessedTexEntryDuplicateV249({...arg,messageId:'NEW_ID'}),false);
 assert.equal(f.isProcessedTexEntryDuplicateV249({...arg,state:{...p.state,metadata:{...p.state.metadata,processedInboundMessageIds:[]}}}),false);
 assert.equal(fixture(false).isProcessedTexEntryDuplicateV249(arg),false);
});

test('V249 duplicate recognizes official outbound session alias without accepting foreign session or mutating state',()=>{
 const f=fixture(),p=input();p.state.metadata.processedInboundMessageIds=[p.sourceMessageId];p.state.metadata.lastSessionId='5531971862958';
 const arg={text:p.text,state:p.state,messageId:p.sourceMessageId,phone:p.state.phoneDigits,storedMessage:{_id:p.sourceMessageId,peerPhone:p.state.phoneDigits,sessionId:'zapi',provider:'zapi',ownerPhoneDigits:'5531971862958',isFromMe:false,body:p.text,providerMessageId:p.sourceMessageId}};
 const original=JSON.stringify(arg);assert.equal(f.isProcessedTexEntryDuplicateV249(arg),true);assert.equal(JSON.stringify(arg),original);
 assert.equal(f.isProcessedTexEntryDuplicateV249({...arg,state:{...p.state,metadata:{...p.state.metadata,lastSessionId:'foreign'}}}),false);
});
