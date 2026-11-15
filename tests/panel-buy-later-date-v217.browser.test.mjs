import { chromium } from 'file:///opt/vitalismen-automacao/current/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const original=fs.readFileSync(process.env.PANEL_HTML || 'public/qr.html','utf8');
let parsed=0;for(const m of original.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){if(!m[1].includes('src=')){new vm.Script(m[2]);parsed++;}}
const hook=`window.__v217={state,renderSelectedDetails,updateCustomerStatusStyle,updateCustomerPrimaryAction,completeBuyLaterDateV217,saveCustomerForm,scheduleCustomerFieldAutoSave};`;
assert.equal(original.split('        bootstrapAuth();').length,2);
const html=original.replace('        bootstrapAuth();',hook);
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
let checks=0;const details=[];
const ok=(v,label)=>{assert(v,label);checks++;details.push(label)};
try {
 for(const mobile of [false,true]){
  const context=await browser.newContext({viewport:mobile?{width:430,height:932}:{width:1536,height:1000},locale:'pt-BR',timezoneId:'America/Sao_Paulo'});
  await context.addInitScript(()=>{window.setInterval=()=>0;});
  const page=await context.newPage();const errors=[],dialogs=[],writes=[];let acceptConfirm=true;let draft={name:'Cliente de simulação',phone:'593990000001',country:'EC',status:'novo',city:'Guayaquil',province:'Guayas',productKey:'vit_power_ec',productName:'Vit Power Ecuador',quantity:'0',total:''};
  const chat=()=>({id:'593990000001@c.us',phone:'593990000001',name:draft.name,country:'EC',sessionId:'zapi',provider:'zapi',orderStatus:draft.status,customerDraft:{...draft},human:{mode:'manual',owner:'QA simulado'},productKey:'vit_power_ec'});
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{dialogs.push(d.message());if(acceptConfirm)await d.accept();else await d.dismiss();});
  await page.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url()),p=u.pathname;
   if(req.isNavigationRequest()&&p==='/qr.html')return route.fulfill({contentType:'text/html',body:html});
   if(p.startsWith('/panel-intelligence/')){
    const f=path.resolve('/opt/vitalismen-automacao/current/public','.'+p);
    if(f.startsWith('/opt/vitalismen-automacao/current/public/panel-intelligence/')&&fs.existsSync(f))return route.fulfill({contentType:'application/javascript',body:fs.readFileSync(f)});
   }
   if(p.startsWith('/api/')||p.startsWith('/admin/api/')){
    let body={success:true};let data={};try{data=req.postDataJSON()||{}}catch{}
    if(req.method()!=='GET')writes.push({path:p,method:req.method(),data});
    if(p.endsWith('/resolve-customer-data'))body={success:true,customerDraft:data.customerDraft};
    else if(p.startsWith('/api/whatsapp/contact-state/')&&req.method()==='PATCH'){
     draft={...draft,...data.customerDraft};body={success:true,state:{phoneDigits:draft.phone,metadata:{customerDraft:{...draft}}}};
    }else if(p.includes('/chats'))body={success:true,chats:[chat()],total:1};
    else if(p.includes('/messages/'))body={success:true,messages:[]};
    else if(p.includes('/profile'))body={success:true};
    else if(p==='/admin/api/status')body={ok:true};
    return route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
   }
   return route.fulfill({status:200,contentType:p.endsWith('.js')?'application/javascript':'text/plain',body:''});
  });
  await page.goto('https://ec.maxlien.shop/qr.html?v=v217-offline');
  await page.waitForFunction(()=>window.__v217);
  await page.evaluate(c=>{
   const t=window.__v217;t.state.selectedChat=c;t.state.chats=[c];t.state.token='OFFLINE_FIXTURE';
   document.getElementById('loginPanel')?.classList.add('hidden');
   for(const id of ['app','appPanel','dashboard','mainPanel'])document.getElementById(id)?.classList.remove('hidden');
   t.renderSelectedDetails();
   document.getElementById('customerForm').closest('.side-section')?.classList.remove('hidden');
  },chat());
  // Actual DOM listeners and actual form save/persistence pipeline; all network is intercepted.
  await page.fill('#customerNameInput','Cliente de simulação');
  await page.selectOption('#customerStatusInput','atendendo');
  ok(dialogs.length===1,'previous status queued after explicit confirmation '+mobile);dialogs.length=0;
  await page.selectOption('#customerStatusInput','comprar_depois');
  await page.waitForTimeout(950);
  ok(writes.length===0,'pending field and status timers canceled '+mobile);
  ok(dialogs.length===0,'status transition does not open confirmation '+mobile);
  for(const date of ['0002-11-28','0020-11-28','0202-11-28','2026-11-28']){
   await page.locator('#customerBuyLaterDateInput').fill(date);
   await page.locator('#customerBuyLaterDateInput').dispatchEvent('change');
   await page.waitForTimeout(60);
   ok(dialogs.length===0,'segmented year '+date+' no popup '+mobile);
  }
  await page.locator('#customerBuyLaterDateInput').press('Enter');await page.waitForTimeout(400);
  ok(dialogs.length===0&&writes.length===0,'Enter in date neither submits nor persists '+mobile);
  await page.fill('#customerNameInput','Cliente de simulação editado');await page.locator('#customerNameInput').dispatchEvent('blur');await page.waitForTimeout(1100);
  ok(writes.length===0,'other field autosave cannot commit pending buy-later '+mobile);
  await page.locator('#customerBuyLaterDateInput').fill('0020-11-28');
  await page.evaluate(()=>window.__v217.saveCustomerForm({preventDefault(){}}));
  ok(dialogs.length===0&&writes.length===0,'incomplete year rejected before confirmation '+mobile);
  await page.locator('#customerBuyLaterDateInput').fill('2026-11-28');await page.locator('#customerBuyLaterDateInput').dispatchEvent('change');
  ok(await page.evaluate(()=>window.__v217.completeBuyLaterDateV217()),'complete date accepted '+mobile);
  await page.locator('#confirmCustomerDataBtn').evaluate(e=>e.click());
  await page.waitForTimeout(1000);
  ok(dialogs.length===1,'explicit save asks exactly once '+mobile);
  const saved=writes.filter(w=>w.method==='PATCH'&&w.path.startsWith('/api/whatsapp/contact-state/'));
  ok(saved.length===1&&saved[0].data.customerDraft.status==='comprar_depois'&&saved[0].data.customerDraft.buyLaterFollowupAt==='2026-11-28','actual save pipeline sends exact scheduled date once '+mobile);
  ok(!writes.some(w=>w.path.startsWith('/api/orders')||/send|dropi|meta/i.test(w.path)),'no order or physical-send effects '+mobile);
  await page.evaluate(()=>window.__v217.renderSelectedDetails());
  ok(await page.locator('#customerBuyLaterDateInput').inputValue()==='2026-11-28','saved date restored on render '+mobile);
  ok(await page.locator('#customerStatusInput').inputValue()==='comprar_depois','saved status restored on render '+mobile);
  await page.locator('#customerBuyLaterDateInput').fill('2026-12-03');await page.locator('#customerBuyLaterDateInput').dispatchEvent('change');await page.waitForTimeout(450);
  ok(writes.filter(w=>w.method==='PATCH'&&w.path.startsWith('/api/whatsapp/contact-state/')).length===1&&dialogs.length===1,'editing previously saved date remains manual '+mobile);
  acceptConfirm=false;await page.locator('#confirmCustomerDataBtn').evaluate(e=>e.click());await page.waitForTimeout(150);acceptConfirm=true;
  ok(dialogs.length===2&&writes.filter(w=>w.method==='PATCH'&&w.path.startsWith('/api/whatsapp/contact-state/')).length===1,'cancel explicit save performs no write '+mobile);
  ok(await page.locator('#customerBuyLaterDateInput').inputValue()==='2026-12-03','cancel preserves editable date '+mobile);
  await page.selectOption('#customerStatusInput','atendendo');await page.waitForTimeout(900);
  ok(dialogs.length===3,'other status confirmation preserved '+mobile);
  ok(writes.filter(w=>w.method==='PATCH'&&w.path.startsWith('/api/whatsapp/contact-state/')).some(w=>w.data.customerDraft.status==='atendendo'),'other status autosave preserved '+mobile);
  ok(errors.length===0,'no page errors '+mobile+': '+errors.join(';'));
  // Screenshot only after behavioral checks; rearrangement is confined to this offline fixture.
  await page.evaluate(()=>{
   document.getElementById('customerStatusInput').value='comprar_depois';document.getElementById('customerBuyLaterDateInput').value='2026-11-28';
   window.__v217.updateCustomerStatusStyle();window.__v217.updateCustomerPrimaryAction();
   const f=document.getElementById('customerForm');document.body.replaceChildren(f);
   f.style.cssText='display:block;position:relative;width:390px;max-width:100%;margin:0;padding:12px;background:white;';
   document.body.style.cssText='display:block;margin:0;padding:0;background:white;min-height:0;overflow:visible';
  });
  await page.locator('.customer-primary-panel').screenshot({path:mobile?'buy-later-mobile.png':'buy-later-desktop.png'});

  await context.close();
 }
 console.log(JSON.stringify({pass:true,assertions:checks,inlineScriptsParsed:parsed,details,network:'ALL_REQUESTS_INTERCEPTED',productionWrites:0,physicalMessages:0}));
}finally{await browser.close();}
