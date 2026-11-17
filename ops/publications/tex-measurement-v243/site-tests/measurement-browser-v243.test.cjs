const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const H=path.resolve(__dirname,'..'),meta=fs.readFileSync(path.join(H,'site-candidate/meta-tex-ultra.js'),'utf8'),whatsapp=fs.readFileSync(path.join(H,'site-candidate/whatsapp.js'),'utf8');
const flush=()=>new Promise(r=>setImmediate(r)),reference='TX243-'+'a'.repeat(64),eventId='tex243_lead_'+'b'.repeat(64);
async function fixture({denied=false,failed=false,memory=new Map()}={}){
 const calls=[],tracks=[],navigation=[],listeners={},intervals=[],timers=[];let verified=false;
 const location={origin:'https://plusmen.shop',hostname:'plusmen.shop',pathname:'/tex',href:'https://plusmen.shop/tex?utm_source=facebook&ad_id=123&fbclid=ISOLATED',assign:url=>navigation.push(url)};
 const button={nodeType:1,id:'preco_89',disabled:false,setAttribute(){}};
 const context={URL,Uint8Array,Uint32Array,TextEncoder,Blob,Set,Date,Promise,console,crypto:crypto.webcrypto,navigator:{doNotTrack:denied?'1':'0',sendBeacon:()=>true},
 localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)},
 document:{cookie:'',readyState:'complete',visibilityState:'visible',querySelector:()=>({}),createElement:()=>({}),head:{appendChild(){}},addEventListener:(n,h)=>(listeners[n]||=[]).push(h),removeEventListener(){}}};
 context.window={location,crypto:crypto.webcrypto,fbq:(...a)=>tracks.push(a),setInterval:h=>intervals.push(h),setTimeout:h=>(timers.push(h),timers.length),clearTimeout(){},
 addEventListener:(n,h)=>(listeners[n]||=[]).push(h),removeEventListener(){},fetch:async(url,o)=>{
 const b=JSON.parse(o.body);calls.push({url,body:b});if(url.includes('tex-measurement')){
  if(failed)throw Error('ISOLATED_FAILURE');return{json:async()=>b.action==='issue'?{ok:true,reference,expiresAt:Date.now()+600000}:{ok:true,confirmed:verified,...(verified?{eventId,eventTime:Math.floor(Date.now()/1000),customData:{content_name:'Tex Ultra Ecuador',content_ids:['tex_ultra_ec']}}:{})}};
 }return{json:async()=>({ok:true,queued:true,event_id:b.event_id})};}};
 vm.createContext(context);vm.runInContext(meta,context);vm.runInContext(whatsapp,context);await flush();await flush();
 return{calls,tracks,navigation,context,memory,timers,verify:()=>verified=true,button,async fire(n){for(const h of listeners[n]||[])h({composedPath:()=>[button],preventDefault(){},stopImmediatePropagation(){}});await flush();await flush();}};
}
test('browser preserves PageView/ViewContent/checkout IDs, product, pixel and ad origin',async()=>{
 const s=await fixture();await s.fire('click');const events=s.calls.filter(x=>x.url==='/api/public/vitpower-meta').map(x=>x.body);
 assert.deepEqual(events.map(x=>x.event_name),['PageView','ViewContent','InitiateCheckout']);
 for(const e of events){assert.equal(e.pixel_id,'1100892582698669');assert.ok(e.event_source_url.includes('ad_id=123'));assert.ok(s.tracks.some(t=>t[2]===e.event_name&&t[4]?.eventID===e.event_id));}
 const content=s.tracks.find(t=>t[2]==='ViewContent')[3];assert.equal(content.content_name,'Tex Ultra Ecuador');assert.equal(content.content_ids[0],'tex_ultra_ec');
 assert.equal(s.calls.some(x=>x.body.event_name==='Lead'),false);
});
test('native CTA keeps phone, user gesture and message base; an opaque reference is appended once',async()=>{
 const s=await fixture();await s.fire('click');await s.fire('click');assert.equal(s.navigation.length,1);
 const u=new URL(s.navigation[0]);assert.equal(u.protocol,'whatsapp:');assert.equal(u.searchParams.get('phone'),'553171862958');assert.equal(u.searchParams.get('text'),'Hola, quiero el tratamiento Tex Ultra.\nReferencia: '+reference);
 assert.equal(s.calls.filter(x=>x.body.event_name==='InitiateCheckout').length,1);
});
test('measurement service failure preserves original native WhatsApp destination and exact base message',async()=>{
 const s=await fixture({failed:true});await s.fire('click');const u=new URL(s.navigation[0]);assert.equal(u.searchParams.get('phone'),'553171862958');assert.equal(u.searchParams.get('text'),'Hola, quiero el tratamiento Tex Ultra.');
});
test('DNT prevents new attribution and all Meta events while preserving ordinary contact',async()=>{
 const s=await fixture({denied:true});await s.fire('click');assert.equal(s.calls.length,0);assert.equal(s.tracks.length,0);assert.equal(new URL(s.navigation[0]).searchParams.get('text'),'Hola, quiero el tratamiento Tex Ultra.');
});
test('only the server verified receipt produces Browser Lead and it shares the exact CAPI event ID',async()=>{
 const s=await fixture();assert.equal(s.tracks.some(t=>t[2]==='Lead'),false);s.verify();await s.fire('pageshow');await s.fire('pageshow');
 const leads=s.tracks.filter(t=>t[2]==='Lead');assert.equal(leads.length,1);assert.equal(leads[0][1],'1100892582698669');assert.equal(leads[0][4].eventID,eventId);
 const again=await fixture({memory:s.memory});again.verify();await again.fire('pageshow');assert.equal(again.tracks.some(t=>t[2]==='Lead'),false);
});
test('changing privacy choice suppresses reference decoration and receipt checks',async()=>{
 const s=await fixture(),before=s.calls.length;s.context.window.metaTrackingConsent=false;await s.fire('pageshow');assert.equal(s.calls.length,before);
 assert.equal(s.context.window.TexUltraMeasurementV243.reference(),'');await s.fire('click');assert.equal(new URL(s.navigation[0]).searchParams.get('text'),'Hola, quiero el tratamiento Tex Ultra.');
});
test('new measurement sends no name, WhatsApp number or conversation in its requests',async()=>{
 const s=await fixture();for(const r of s.calls.filter(c=>c.url.includes('tex-measurement'))){assert.ok(!('phone'in r.body));assert.ok(!('name'in r.body));assert.ok(!('message'in r.body));assert.ok(!('matching'in r.body));}
});
test('native HTML changes only the two versioned measurement/handler references',()=>{
 const old=fs.readFileSync(path.join(H,'../../audits/tex-vsl-meta-bot-20261117/official-origin/var/www/plusmen-tex-vsl-v1/index.html'),'utf8');
 const next=fs.readFileSync(path.join(H,'site-candidate/index.html'),'utf8');assert.equal(next.replace('/tex-assets/meta-tex-ultra.js?v=20261117-meta-v243-r1','/assets/js/vitpower-meta.js?v=20261013-3').replace('/tex-assets/whatsapp-tex-v243.js?v=20261117-v243','/tex-assets/whatsapp.js?v=20261117-r1'),old);
});
