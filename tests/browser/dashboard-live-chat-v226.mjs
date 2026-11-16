import { chromium } from 'file:///opt/vitalismen-automacao/current/node_modules/playwright/index.mjs';
import fs from 'node:fs';import assert from 'node:assert/strict';
const html=fs.readFileSync(process.env.PANEL_HTML,'utf8').replace('        bootstrapAuth();','window.__watchFixture={state};');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});let checks=0;const details=[],ok=(v,label)=>{assert(v,label);checks++;details.push(label)};
const A='a'.repeat(64),B='b'.repeat(64),C='c'.repeat(64);const iso=n=>new Date(Date.UTC(2026,10,16,1,0,n)).toISOString();
try{
 const context=await browser.newContext({viewport:{width:1600,height:1000}});
 await context.addInitScript(()=>{
  window.setInterval=()=>0;window.__hiddenFixture=false;Object.defineProperty(document,'hidden',{get:()=>window.__hiddenFixture});
  const realSet=window.setTimeout.bind(window),realClear=window.clearTimeout.bind(window);let id=900000;const timers=new Map();
  window.setTimeout=(fn,ms,...args)=>{if(ms===10000){timers.set(++id,()=>fn(...args));return id}return realSet(fn,ms,...args)};
  window.clearTimeout=value=>{if(!timers.delete(value))realClear(value)};
  window.__runWatch=()=>{const next=timers.entries().next().value;if(!next)throw Error('WATCH_TIMER_NOT_READY');timers.delete(next[0]);return next[1]()};
 });
 const page=await context.newPage(),errors=[],requests=[],writes=[];page.on('pageerror',e=>errors.push(e.message));
 const records=new Map([[A,{id:A,name:'QA Antigo',messageCount:2,createdAt:iso(0),lastAt:iso(0),history:[{role:'user',content:'Mensagem antiga',at:iso(0)},{role:'assistant',content:'Resposta antiga',at:iso(0)}]}]]);let failureId=null;
 const rows=()=>[...records.values()].map(({history,...row})=>row).sort((a,b)=>b.lastAt.localeCompare(a.lastAt));
 await page.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());if(req.isNavigationRequest())return route.fulfill({contentType:'text/html',body:html});
  if(req.method()!=='GET')writes.push(u.pathname);
  if(u.pathname.startsWith('/api/web-chat-admin/vitpower')){requests.push(u.pathname);const id=u.pathname.split('/').at(-1);if(id===failureId)return route.fulfill({status:503,json:{error:'fixture failure'}});return route.fulfill({json:records.has(id)?{conversation:records.get(id)}:{conversations:rows()}})}
  return route.fulfill({contentType:'application/json',body:'{}'});
 });
 await page.goto('https://ec.maxlien.shop/qr.html?offline-v226');
 await page.evaluate(()=>{const s=window.__watchFixture.state;s.token='OFFLINE_ADMIN';s.user={role:'admin'};document.getElementById('loginPanel').classList.add('hidden');document.getElementById('dashboard').classList.remove('hidden')});
 await page.waitForFunction(()=>document.getElementById('webChatDashboardBtnV222').title.includes('avisos ativos'));
 ok(!await page.locator('#webChatDashboardDialogV222').isVisible(),'historical messages do not auto-open at startup');
 await page.fill('#messageInput','Rascunho WhatsApp preservado');
 records.set(B,{id:B,name:'QA Novo',messageCount:2,createdAt:iso(10),lastAt:iso(10),history:[{role:'user',content:'Nova pergunta QA',at:iso(10)},{role:'assistant',content:'Nova resposta QA',at:iso(10)}]});
 await page.evaluate(()=>window.__runWatch());
 ok(await page.locator('#webChatDashboardDialogV222').isVisible(),'new visitor automatically opens side chat');
 ok(await page.locator('#webChatDashboardDialogV222').evaluate(e=>!e.matches(':modal')),'chat is nonmodal');
 ok(await page.evaluate(()=>document.activeElement.id)==='messageInput','automatic opening does not steal WhatsApp keyboard focus');
 ok(await page.locator('#messageInput').inputValue()==='Rascunho WhatsApp preservado','WhatsApp draft survives automatic opening');
 ok((await page.locator('#webChatDashboardThreadV222').textContent()).includes('Nova resposta QA'),'automatic opening selects the new conversation');
 await page.fill('#chatSearch','teste de busca');ok(await page.locator('#chatSearch').inputValue()==='teste de busca','background search remains usable');
 await page.fill('#messageInput','Atendimento continua');ok(await page.locator('#messageInput').inputValue()==='Atendimento continua','background composer remains usable');
 await page.click('#webChatDashboardCloseV222');await page.evaluate(()=>window.__runWatch());ok(!await page.locator('#webChatDashboardDialogV222').isVisible(),'closing is respected without new messages');
 const current=records.get(B);current.history.push({role:'assistant',content:'Complemento sem cliente',at:iso(20)});current.messageCount++;current.lastAt=iso(20);
 await page.evaluate(()=>window.__runWatch());ok(!await page.locator('#webChatDashboardDialogV222').isVisible(),'assistant-only update does not reopen chat');
 current.history.push({role:'user',content:'Segunda pergunta QA',at:iso(30)},{role:'assistant',content:'Segunda resposta QA',at:iso(30)});current.messageCount+=2;current.lastAt=iso(30);
 await page.evaluate(()=>window.__runWatch());ok(await page.locator('#webChatDashboardDialogV222').isVisible(),'new question in existing conversation reopens chat');
 await page.click('#webChatDashboardCloseV222');await page.click('#dashboardFloatingChatV224');await page.waitForFunction(()=>document.getElementById('webChatDashboardThreadV222').textContent.includes('Segunda resposta QA'));
 ok((await page.locator('#webChatDashboardThreadV222').textContent()).includes('QA Novo'),'manual reopen restores selected conversation');
 await page.keyboard.press('Escape');ok(!await page.locator('#webChatDashboardDialogV222').isVisible(),'Escape closes nonmodal chat');
 records.set(C,{id:C,name:'QA Retry',messageCount:2,createdAt:iso(40),lastAt:iso(40),history:[{role:'user',content:'Pergunta após falha QA',at:iso(40)},{role:'assistant',content:'Resposta após falha QA',at:iso(40)}]});failureId=C;
 await page.evaluate(()=>window.__runWatch());ok(!await page.locator('#webChatDashboardDialogV222').isVisible(),'failed detail read does not open an incomplete alert');failureId=null;
 await page.evaluate(()=>window.__runWatch());ok((await page.locator('#webChatDashboardThreadV222').textContent()).includes('Resposta após falha QA'),'read retry does not lose incoming alert');
 await page.click('#webChatDashboardCloseV222');
 await page.evaluate(()=>{window.__hiddenFixture=true;document.dispatchEvent(new Event('visibilitychange'))});const beforeHidden=requests.length;
 await page.waitForTimeout(30);ok(requests.length===beforeHidden,'background tab pauses monitoring');
 await page.evaluate(()=>{window.__hiddenFixture=false;document.dispatchEvent(new Event('visibilitychange'))});await page.waitForFunction(()=>document.getElementById('webChatDashboardBtnV222').title.includes('avisos ativos'));await page.waitForTimeout(50);
 await page.evaluate(()=>{window.__watchFixture.state.token='';document.getElementById('dashboard').classList.add('hidden')});await page.waitForTimeout(30);const beforeLogout=requests.length;
 await page.waitForTimeout(50);ok(requests.length===beforeLogout,'logout stops monitor requests');
 ok(writes.length===0,'all monitoring uses GET and sends no customer messages');ok(errors.length===0,'no JavaScript errors: '+errors.join(';'));
 console.log(JSON.stringify({pass:true,checks,details,networkIntercepted:true,whatsappSends:0,productionWrites:0}));await context.close();
}finally{await browser.close()}
