import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import crypto from 'node:crypto';
const src=fs.readFileSync(new URL('../../ops/browser/vitpower-v240/assets/cta.js',import.meta.url),'utf8');
const base=fs.readFileSync(new URL('../../ops/browser/vitpower-v238/assets/cta.js',import.meta.url),'utf8');
const MESSAGE='Hola, vengo del video.\nQuiero conocer la oferta disponible de Vit Power.\n¡Me interesa aprovechar la mejor promoción y hacer mi pedido! ¿Me ayudan?';
function fixture({qa=false,split=false,consent=true,otherHost=false}={}){
 const events={},calls=[],pixels=[],destinations=[],opened=[],cookies=new Map();let d;
 class E{
  constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.attrs={};this.style={};this.listeners={};this.value='';this.textContent='';}
  appendChild(n){n.parentElement=this;this.children.push(n);return n;}
  insertBefore(n,before){n.parentElement=this;const i=this.children.indexOf(before);if(i<0)this.children.push(n);else this.children.splice(i,0,n);return n;}
  get firstChild(){return this.children[0]||null;}
  setAttribute(k,v){this.attrs[k]=String(v);}
  getAttribute(k){return this.attrs[k]??null;}
  removeAttribute(k){delete this.attrs[k];}
  addEventListener(k,f){this.listeners[k]=f;}
  focus(){d.activeElement=this;}
  showModal(){this.modal=true;this.attrs.open='';}
  close(){delete this.attrs.open;}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(x=>x!==this);}
  setCustomValidity(v){this.validation=v;}
  reportValidity(){this.reported=true;return !this.validation;}
  insertAdjacentElement(_where,n){this.parentElement.appendChild(n);}
 }
 const root=new E('html'),body=new E('body'),head=new E('head');root.appendChild(head);root.appendChild(body);
 const walk=n=>[n,...n.children.flatMap(walk)],find=id=>walk(root).find(n=>n.id===id)||null;
 const player=new E('vturb-smartplayer');body.appendChild(player);
 const cta=new E('a');cta.id='preco_89';cta.setAttribute('data-product','vit_power_ec');cta.setAttribute('data-vsl-source','https://taviazen.shop/vitpower_2026g');cta.setAttribute('data-whatsapp-phone','553171862958');if(split)cta.setAttribute('data-vp-chat-whatsapp','true');body.appendChild(cta);
 const chat=new E('section');chat.id='vp-web-chat-v220';body.appendChild(chat);
 d={body,head,documentElement:root,activeElement:null,visibilityState:'visible',scripts:[],createElement:t=>new E(t),getElementById:find,querySelector:s=>s==='vturb-smartplayer'?player:s.startsWith('a[')?cta:null,addEventListener:(k,f)=>events[k]=f};
 Object.defineProperty(d,'cookie',{get:()=>[...cookies].map(([k,v])=>k+'='+v).join('; '),set:v=>{const pair=v.split(';')[0],i=pair.indexOf('=');cookies.set(pair.slice(0,i),pair.slice(i+1));}});
 const w={location:{hostname:otherHost?'example.invalid':'taviazen.shop',pathname:'/vitpower_2026g',search:qa?'?vp_qa=1':'?utm_campaign=creative-240&fbclid=TEST_CLICK_240',assign:u=>destinations.push(u)},navigator:{},vitalismenMarketingConsent:consent,crypto,localStorage:{getItem:()=>null,setItem(){}},addEventListener(){},fbq:(...x)=>pixels.push(x),fetch:(url,init)=>{calls.push({url,body:JSON.parse(init.body)});return Promise.resolve({ok:true,json:()=>Promise.resolve({ok:true,reference:'VP-'+'A'.repeat(36)})});},setTimeout:(f,ms)=>{if(ms===1200)f();return 1;},open:()=>{const x={opener:{},closed:false,location:{replace:u=>destinations.push(u)}};opened.push(x);return x;}};
 vm.runInNewContext(src,{window:w,document:d,URLSearchParams,Promise,DataView,Uint8Array,MutationObserver:class{observe(){}}});
 const click=(el=cta)=>events.click?.({composedPath:()=>[el],target:el,isTrusted:true,button:0,preventDefault(){},stopImmediatePropagation(){}});
 const flush=async()=>{for(let i=0;i<18;i++)await Promise.resolve();};
 const submit=async()=>{const form=walk(root).find(n=>n.tagName==='FORM');assert(form);form.listeners.submit({preventDefault(){}});await flush();};
 return{w,d,root,walk,find,cta,player,calls,pixels,destinations,opened,click,flush,submit};
}
test('QA: immediate shortcut, zero form, exact entry, no Meta or bridge traffic',async()=>{
 const f=fixture({qa:true});const shortcut=f.find('vp-qa-entry-v240');assert(shortcut);assert.equal(f.d.body.firstChild,shortcut);assert.equal(shortcut.style.position,undefined);assert.match(shortcut.style.cssText,/position:relative/);
 f.click(shortcut);await f.flush();assert.equal(f.walk(f.root).filter(n=>n.tagName==='DIALOG').length,0);assert.equal(f.destinations.length,1);const url=new URL(f.destinations[0]);assert.equal(url.hostname,'wa.me');assert.equal(url.pathname,'/553171862958');assert.equal(url.searchParams.get('text'),MESSAGE);assert.equal(f.calls.length,0);assert.equal(f.pixels.length,0);
});
test('QA combined CTA keeps original page and opens only one reviewed destination',async()=>{
 const f=fixture({qa:true,split:true});f.click();await f.flush();assert.equal(f.opened.length,1);assert.equal(f.opened[0].opener,null);assert.equal(f.destinations.length,1);assert.equal(f.w.location.pathname,'/vitpower_2026g');assert.equal(f.calls.length,0);
});
test('Public form: phone first, autofocus, one mandatory field; name optional and collapsed',()=>{
 const f=fixture();f.click();assert.equal(f.find('vp-qa-entry-v240'),null);const phone=f.find('vp-contact-phone'),name=f.find('vp-first-name');assert.equal(f.d.activeElement,phone);assert.equal(phone.required,true);assert.notEqual(name.required,true);assert.equal(name.parentElement.tagName,'DETAILS');assert(!name.parentElement.open);const nodes=f.walk(f.root);assert(nodes.indexOf(phone)<nodes.indexOf(name));assert.equal(nodes.filter(n=>n.required===true).length,1);assert(nodes.some(n=>n.textContent==='Habla con Ana por WhatsApp'));assert(nodes.some(n=>n.textContent==='Abrir WhatsApp con Ana'));
});
for(const value of['0991234567','991234567','+593 99 123 4567'])test('EC phone normalization: '+value,async()=>{
 const f=fixture();f.click();f.find('vp-contact-phone').value=value;await f.submit();assert.equal(f.destinations.length,1);const contacts=f.calls.filter(x=>x.body.contactPhone);assert.equal(contacts.length,1);assert.equal(contacts[0].body.contactPhone,'593991234567');assert.equal(contacts[0].body.utm_campaign,'creative-240');assert.equal(contacts[0].body.fbclid,'TEST_CLICK_240');assert(contacts[0].body.fbp);assert(contacts[0].body.fbc);assert.equal(contacts[0].body.entryMessage,MESSAGE);assert.equal(new URL(f.destinations[0]).searchParams.get('text'),MESSAGE);assert(f.pixels.some(x=>x[2]==='Contact'));assert(!JSON.stringify(f.pixels).includes('593991234567'));
});
for(const value of['','5515998038637','5515991418416','123','593991234567999'])test('Public form rejects invalid or Brazilian number: '+(value||'empty'),async()=>{
 const f=fixture();f.click();f.find('vp-contact-phone').value=value;await f.submit();assert.equal(f.destinations.length,0);assert(f.find('vp-contact-phone').validation);assert.equal(f.calls.filter(x=>x.body.contactPhone).length,0);
});
test('Optional name stays in user-reviewed WhatsApp text and bridge, never Pixel',async()=>{
 const f=fixture();f.click();f.find('vp-contact-phone').value='0991234567';f.find('vp-first-name').value='José Prueba';await f.submit();assert.equal(new URL(f.destinations[0]).searchParams.get('text'),MESSAGE+'\nNombre: José');assert(!JSON.stringify(f.pixels).includes('José'));assert(!f.destinations[0].includes('991234567'));
});
test('Combined public form stays inline; selected phone and attribution preserved',async()=>{
 const f=fixture({split:true});f.click();const dialog=f.walk(f.root).find(n=>n.tagName==='DIALOG');assert(!dialog.modal);assert.equal(dialog.style.position,'relative');assert.equal(dialog.parentElement,f.find('vp-web-chat-v220').parentElement);f.find('vp-contact-phone').value='0991234567';await f.submit();assert.equal(f.opened.length,1);assert.equal(f.opened[0].opener,null);assert.equal(f.destinations.length,1);
});
test('Cancel exits without WhatsApp or contact registration',async()=>{
 const f=fixture();f.click();f.walk(f.root).find(n=>n.textContent==='Volver al video').listeners.click();await f.flush();assert.equal(f.destinations.length,0);assert.equal(f.calls.filter(x=>x.body.contactPhone).length,0);
});
test('Declined marketing consent still opens WhatsApp; sends no tracking',async()=>{
 const f=fixture({consent:false});f.click();f.find('vp-contact-phone').value='0991234567';await f.submit();assert.equal(f.destinations.length,1);assert.equal(f.calls.length,0);assert.equal(f.pixels.length,0);
});
test('Scope and measurement implementation remain untouched',()=>{
 const f=fixture({otherHost:true});assert.equal(f.find('vp-qa-entry-v240'),null);assert.equal(f.calls.length,0);
 assert.equal(src.slice(src.indexOf('  function attribution()'),src.indexOf('  function collectName(')),base.slice(base.indexOf('  function attribution()'),base.indexOf('  function collectName(')));
 assert.equal(src.slice(src.indexOf('  d.addEventListener(\'click\''),src.indexOf('  // QA-only shortcut')),base.slice(base.indexOf('  d.addEventListener(\'click\''),base.indexOf('  annotate(); new MutationObserver')));
});
