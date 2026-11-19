import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
const base=new URL('./tex-event-correction/',import.meta.url);
function meta(source='https://plusmen.shop/tex',saved={},denied=false){
 const storage={...saved}, calls=[],requests=[],listeners={},timers=[];
 const document={cookie:'',readyState:'complete',visibilityState:'visible',head:{appendChild(){}},createElement(){return{}},querySelector(){return{}},addEventListener(n,f){listeners[n]=f}};
 const window={location:new URL(source),crypto:webcrypto,metaTrackingConsent:!denied,fbq:(...a)=>calls.push(a),fetch:(u,o)=>{requests.push({url:u,body:JSON.parse(o.body)});return Promise.resolve({json:async()=>({ok:false})})},setInterval:f=>timers.push(f),addEventListener(n,f){listeners[n]=f}};
 const localStorage={getItem:k=>storage[k]??null,setItem:(k,v)=>storage[k]=v,removeItem:k=>delete storage[k]};
 Object.assign(localStorage,storage);
 // Object.keys(storage) is how browsers expose storage keys.
 const proxy=new Proxy(localStorage,{ownKeys:()=>Object.keys(storage),getOwnPropertyDescriptor:()=>({enumerable:true,configurable:true})});
 const context={window,document,navigator:{},localStorage:proxy,URL,Uint8Array,Uint32Array,TextEncoder,Blob,Date,Set,Promise};
 vm.runInNewContext(fs.readFileSync(new URL('candidate/meta-tex-ultra.js',base),'utf8'),context);
 return{window,calls,requests,storage,timers,listeners};
}
const event=(url,id='a')=>({pixel_id:'1100892582698669',event_name:'InitiateCheckout',event_id:'vp_'+id.repeat(24),event_time:Math.floor(Date.now()/1000),event_source_url:url});
for(const url of ['https://plusmen.shop/tex','https://plusmen.shop/tex/?utm_campaign=cartaz','https://www.plusmen.shop/tex'])test('no checkout before or after WhatsApp invitation: '+url,async()=>{
 const x=meta(url);await Promise.resolve();x.window.VitpowerMeta.initiateCheckout();x.window.VitpowerMeta.initiateCheckout();x.listeners.pagehide();x.timers.forEach(f=>f());
 assert.equal(x.calls.filter(a=>a[2]==='InitiateCheckout').length,0);
 assert.equal(x.requests.filter(a=>a.body.event_name==='InitiateCheckout').length,0);
 assert.equal(x.calls.filter(a=>a[2]==='PageView').length,1);assert.equal(x.calls.filter(a=>a[2]==='ViewContent').length,1);
});
test('drop old Tex checkout queue but retain checkout on other routes',()=>{
 const key='vitpower_meta_pending_v2:1100892582698669:';
 const x=meta('https://plusmen.shop/tex',{[key+'tex']:JSON.stringify(event('https://plusmen.shop/tex')),[key+'other']:JSON.stringify(event('https://plusmen.shop/vitpower','b'))});
 assert.equal(x.storage[key+'tex'],undefined);assert.ok(x.storage[key+'other']);assert.equal(x.requests.filter(a=>a.body.event_name==='InitiateCheckout').length,1);assert.match(x.requests.find(a=>a.body.event_name==='InitiateCheckout').body.event_source_url,/vitpower$/);
});
test('other routes preserve checkout event',()=>{const x=meta('https://plusmen.shop/vitpower');x.window.VitpowerMeta.initiateCheckout();assert.equal(x.calls.filter(a=>a[2]==='InitiateCheckout').length,1);});
test('tracking denied emits nothing',()=>{const x=meta('https://plusmen.shop/tex',{},true);x.window.VitpowerMeta.initiateCheckout();assert.equal(x.calls.length,0);assert.equal(x.requests.length,0);});
function whatsapp(name,{disabled=false,unrelated=false,throwApp=false}={}){
 const handlers={},timers=[],assigned=[],attrs={};let checkouts=0;
 const button={nodeType:1,id:unrelated?'other':'preco_89',disabled,setAttribute:(k,v)=>attrs[k]=v};
 const window={location:{hostname:'plusmen.shop',pathname:'/tex',assign:u=>{if(throwApp&&u.startsWith('whatsapp:'))throw Error('no app');assigned.push(u)}},VitpowerMeta:{initiateCheckout:()=>checkouts++},addEventListener:(n,f)=>handlers[n]=f,removeEventListener(){},setTimeout:f=>{timers.push(f);return 1},clearTimeout(){}};
 const document={visibilityState:'visible',addEventListener(){},removeEventListener(){}};
 const code=fs.readFileSync(new URL('candidate/'+name,base),'utf8').split('// BEGIN CTA')[0];
 // The label addon only uses DOM helpers; exclude its independent IIFE for handler unit tests.
 vm.runInNewContext(code.slice(0,code.indexOf('\n})();')+6),{window,document,encodeURIComponent});
 const click=()=>handlers.click({composedPath:()=>[button],preventDefault(){},stopImmediatePropagation(){}});
 return{click,assigned,timers,attrs,get checkouts(){return checkouts}};
}
for(const name of ['whatsapp.js','whatsapp-tex-v243.js']){
 test(name+' preserves app and fallback, without checkout',()=>{const x=whatsapp(name);x.click();x.click();assert.equal(x.assigned.length,1);assert.match(x.assigned[0],/^whatsapp:\/\/send\?phone=553171862958&text=Hola/);x.timers[0]();assert.match(x.assigned[1],/^https:\/\/wa.me\/553171862958/);assert.equal(x.checkouts,0);assert.equal(x.attrs['data-whatsapp-message'],'Hola, quiero el tratamiento Tex Ultra.');});
 test(name+' ignores disabled or unrelated targets',()=>{for(const opts of [{disabled:true},{unrelated:true}]){const x=whatsapp(name,opts);x.click();assert.equal(x.assigned.length,0);assert.equal(x.checkouts,0)}});
 test(name+' app unavailable uses fallback without checkout',()=>{const x=whatsapp(name,{throwApp:true});x.click();assert.equal(x.assigned.length,1);assert.match(x.assigned[0],/^https:/);assert.equal(x.checkouts,0)});
}
test('all exact patches invert to inspected production bytes',()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',base)));
 for(const c of manifest.changes){let text=fs.readFileSync(new URL('candidate/'+c.name,base),'utf8');for(const p of [...c.patches].reverse()){assert.equal(text.split(p.after).length,2);text=text.replace(p.after,p.before)}assert.equal(text,fs.readFileSync(new URL(c.name,base),'utf8'));}
});
