import { chromium } from 'file:///opt/vitalismen-automacao/current/node_modules/playwright/index.mjs';
import fs from 'node:fs';import assert from 'node:assert/strict';import vm from 'node:vm';
const source=fs.readFileSync(process.env.PANEL_HTML,'utf8');let scripts=0;
for(const m of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!m[1].includes('src=')){new vm.Script(m[2]);scripts++}
assert.equal(source.split('        bootstrapAuth();').length,2);
const html=source.replace('        bootstrapAuth();','window.__vp222={state};');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});let checks=0;const details=[];
const ok=(value,label)=>{assert(value,label);checks++;details.push(label)};
try{for(const mobile of [false,true]){
 const context=await browser.newContext({viewport:mobile?{width:375,height:812}:{width:1440,height:960},locale:'pt-BR',timezoneId:'America/Sao_Paulo'});
 await context.addInitScript(()=>{window.setInterval=()=>0});const page=await context.newPage();const errors=[],writes=[];let mode='normal',slow=false;
 page.on('pageerror',e=>errors.push(e.message));
 const first={id:'a'.repeat(64),name:'Maria QA',city:'Quito',quantity:3,messageCount:2,lastAt:'2026-11-15T22:00:00Z'},second={id:'b'.repeat(64),name:null,messageCount:1,lastAt:'2026-11-15T21:00:00Z'};
 await page.route('**/*',async route=>{
  const request=route.request(),u=new URL(request.url());if(request.isNavigationRequest())return route.fulfill({contentType:'text/html',body:html});
  if(request.method()!=='GET')writes.push(u.pathname);
  if(u.pathname.startsWith('/api/web-chat-admin/vitpower')){
   if(mode==='denied')return route.fulfill({status:403,contentType:'application/json',body:'{}'});
   let body={version:222,readOnly:true,conversations:mode==='empty'?[]:[first,second]};
   if(u.pathname.endsWith(first.id)){if(slow)await new Promise(r=>setTimeout(r,300));body={conversation:{...first,history:[{role:'user',content:'<img src=x onerror="window.bad222=true">',at:first.lastAt},{role:'assistant',content:'Respuesta oficial de prueba',at:first.lastAt}]}}}
   if(u.pathname.endsWith(second.id))body={conversation:{...second,history:[{role:'user',content:'Segunda conversa QA',at:second.lastAt}]}};
   return route.fulfill({contentType:'application/json',body:JSON.stringify(body)}).catch(()=>{});
  }
  if(u.pathname.startsWith('/panel-intelligence/')){const file='/opt/vitalismen-automacao/current/public'+u.pathname;if(fs.existsSync(file))return route.fulfill({contentType:'application/javascript',body:fs.readFileSync(file)})}
  return route.fulfill({contentType:'application/json',body:'{}'});
 });
 await page.goto('https://ec.maxlien.shop/qr.html?offline-dashboard-v222');await page.waitForFunction(()=>window.__vp222);
 await page.evaluate(()=>{document.getElementById('loginPanel').classList.add('hidden');document.getElementById('dashboard').classList.remove('hidden');window.__vp222.state.token='';document.getElementById('customerNameInput').value='Rascunho V224';const contact=document.createElement('div');contact.className='chat-item';contact.textContent='Contato WhatsApp preservado';document.getElementById('chatList').append(contact)});
 ok(await page.locator('#dashboardFloatingChatV224').isVisible(),'floating launcher visible on dashboard '+mobile);
 const floatBounds=await page.locator('#dashboardFloatingChatV224').boundingBox();ok(floatBounds.x>=0&&floatBounds.x+floatBounds.width<=(mobile?375:1440)&&floatBounds.y+floatBounds.height<=(mobile?812:960),'floating launcher fits viewport '+mobile);
 await page.click('#dashboardFloatingChatV224');await page.waitForFunction(()=>document.getElementById('webChatDashboardStatusV222').textContent.includes('administrador'));
 ok(await page.locator('#webChatDashboardDialogV222').isVisible(),'popup opens from floating launcher '+mobile);ok(!await page.locator('#dashboardFloatingChatV224').isVisible(),'launcher hides while popup is open '+mobile);
 ok(await page.evaluate(()=>window.__vp222.state.token)==='','missing token does not change auth '+mobile);
 await page.click('#webChatDashboardCloseV222');ok(await page.locator('#dashboardFloatingChatV224').isVisible(),'launcher returns after close '+mobile);ok(await page.locator('#customerNameInput').inputValue()==='Rascunho V224','customer draft preserved '+mobile);await page.evaluate(()=>window.__vp222.state.token='OFFLINE_ADMIN_TOKEN');await page.click('#webChatDashboardBtnV222');
 await page.waitForFunction(()=>document.querySelectorAll('#webChatDashboardListV222 button').length===2);
 ok(!(await page.locator('#webChatDashboardListV222').textContent()).includes('Respuesta'),'list contains no message preview '+mobile);
 await page.locator('#webChatDashboardListV222 button').first().click();await page.waitForFunction(()=>document.querySelectorAll('.vpweb222-bubble').length===2);
 ok(await page.locator('#webChatDashboardThreadV222 img').count()===0,'untrusted html rendered only as text '+mobile);ok(!await page.evaluate(()=>window.bad222),'injected handler cannot execute '+mobile);
 await page.locator('#webChatDashboardListV222 button').nth(1).click();await page.waitForFunction(()=>document.getElementById('webChatDashboardThreadV222').textContent.includes('Segunda conversa'));
 ok(!(await page.locator('#webChatDashboardThreadV222').textContent()).includes('Respuesta oficial'),'switch clears previous history '+mobile);
 slow=true;await page.locator('#webChatDashboardListV222 button').first().click();await page.locator('#webChatDashboardListV222 button').nth(1).click();await page.waitForTimeout(450);
 ok((await page.locator('#webChatDashboardThreadV222').textContent()).includes('Segunda conversa'),'late response cannot replace selected conversation '+mobile);slow=false;
 const bounds=await page.locator('#webChatDashboardDialogV222').boundingBox();ok(bounds.width<=(mobile?375:1440)&&bounds.height<=(mobile?812:960),'popup fits viewport '+mobile);
 ok(Math.abs(bounds.x+bounds.width-(mobile?375:1440)+(mobile?8:12))<2,'popup aligned to right edge '+mobile);ok(Math.abs(bounds.y-(mobile?8:12))<2,'popup aligned to top edge '+mobile);ok(bounds.width<=(mobile?359:460)+1,'desktop panel remains narrow '+mobile);
 const columns=await page.locator('.vpweb222-body').evaluate(e=>getComputedStyle(e).gridTemplateColumns);ok(columns.split(' ').length===1,'conversations and messages stacked in sidebar '+mobile);
 await page.keyboard.press('Escape');ok(!await page.locator('#webChatDashboardDialogV222').isVisible(),'Escape closes popup '+mobile);ok(await page.locator('.vpweb222-bubble').count()===0,'close clears private history '+mobile);
 mode='denied';await page.click('#webChatDashboardBtnV222');await page.waitForFunction(()=>document.getElementById('webChatDashboardStatusV222').textContent.includes('restrito'));ok(await page.evaluate(()=>window.__vp222.state.token)==='OFFLINE_ADMIN_TOKEN','403 does not log operator out '+mobile);
 mode='empty';await page.click('#webChatDashboardRefreshV222');await page.waitForFunction(()=>document.getElementById('webChatDashboardStatusV222').textContent.includes('Nenhuma conversa'));ok(await page.locator('#webChatDashboardListV222 button').count()===0,'empty state supported '+mobile);
 mode='normal';await page.click('#webChatDashboardRefreshV222');await page.waitForFunction(()=>document.querySelectorAll('#webChatDashboardListV222 button').length===2);await page.locator('#webChatDashboardListV222 button').first().click();await page.waitForFunction(()=>document.querySelectorAll('.vpweb222-bubble').length===2);
 await page.screenshot({path:process.env.EVIDENCE_DIR+'/live-popup-'+(mobile?'mobile':'desktop')+'.png'});
 await page.click('#webChatDashboardCloseV222');
 ok((await page.locator('#chatList').textContent()).includes('Contato WhatsApp preservado'),'WhatsApp list preserved '+mobile);ok(await page.locator('.chat-preview .meta').count()===0,'left list preview prohibition preserved '+mobile);ok(writes.length===0,'no write or outbound requests '+mobile);ok(errors.length===0,'no page errors '+mobile+': '+errors.join(';'));
 await page.evaluate(()=>document.getElementById('dashboard').classList.add('hidden'));await page.waitForFunction(()=>document.getElementById('dashboardFloatingChatV224').hidden);ok(!await page.locator('#dashboardFloatingChatV224').isVisible(),'launcher hidden outside dashboard '+mobile);
 await context.close();
}console.log(JSON.stringify({pass:true,checks,scriptsParsed:scripts,details,networkIntercepted:true,whatsappSends:0,productionWrites:0}));}finally{await browser.close()}
