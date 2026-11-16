import { chromium } from 'file:///opt/vitalismen-automacao/current/node_modules/playwright/index.mjs';
import fs from 'node:fs';import assert from 'node:assert/strict';
const html=fs.readFileSync(process.env.PANEL_HTML,'utf8').replace('        bootstrapAuth();','window.__waFixture={state};');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});let checks=0;const details=[],ok=(v,label)=>{assert(v,label);checks++;details.push(label)};
try{for(const mobile of [false,true]){
 const context=await browser.newContext({viewport:mobile?{width:375,height:812}:{width:1600,height:1000}});await context.addInitScript(()=>{window.setInterval=()=>0});
 const page=await context.newPage(),writes=[],errors=[],requests=[];let failed=false;page.on('pageerror',e=>errors.push(e.message));
 const QA='5515998038637',EC='593999999991',now=Math.floor(Date.now()/1000),history=new Map([[QA,[{_id:'qa1',isFromMe:false,body:'Hola QA recebido',timestamp:now}]]]);
 await page.route('**/*',async route=>{const req=route.request(),u=new URL(req.url());if(req.isNavigationRequest())return route.fulfill({contentType:'text/html',body:html});if(req.method()!=='GET')writes.push(u.pathname);
  if(u.pathname.startsWith('/api/whatsapp/messages/')){requests.push(u.pathname);return route.fulfill({status:failed?503:200,json:history.get(u.pathname.split('/').at(-1))||[]})}
  if(u.pathname.startsWith('/api/web-chat-admin/'))return route.fulfill({json:{conversations:[]}});return route.fulfill({json:{}});
 });
 await page.goto('https://ec.maxlien.shop/qr.html?offline-wa-v226');await page.evaluate(()=>{const s=window.__waFixture.state;s.token='OFFLINE';s.user={role:'admin'};s.selectedChat={id:'593888888888@c.us',phone:'593888888888'};document.getElementById('dashboard').classList.remove('hidden');document.getElementById('loginPanel').classList.add('hidden')});
 const row=(p,at=now,body='Hola QA recebido')=>({id:p+'@c.us',phone:p,name:'Contato QA',unreadCount:1,lastMessage:{timestamp:at,body,isFromMe:false}});
 const emit=async rows=>{await page.evaluate(rows=>document.dispatchEvent(new CustomEvent('vitalismen:whatsapp-chats-loaded-v226',{detail:rows})),rows);await page.waitForTimeout(120)};
 await page.fill('#messageInput','Rascunho ativo');await emit([{...row(QA),unreadCount:0,lastInboundAt:new Date(now*1000).toISOString()}]);
 const popup=page.locator('#waIncomingDialogV226');ok(await popup.isVisible(),'recent QA WhatsApp opens even if read in another tab '+mobile);ok(await popup.evaluate(e=>!e.matches(':modal')),'nonmodal WhatsApp '+mobile);
 ok(await page.evaluate(()=>document.activeElement.id)==='messageInput','no keyboard focus theft '+mobile);ok(await page.locator('#messageInput').inputValue()==='Rascunho ativo','draft preserved '+mobile);ok(await page.evaluate(()=>window.__waFixture.state.selectedChat.phone)==='593888888888','active customer unchanged '+mobile);
 ok((await popup.textContent()).includes('Hola QA recebido'),'actual received text rendered '+mobile);const rect=await popup.boundingBox();ok(rect.x+rect.width<=(mobile?375:1600)&&rect.x>=0,'popup fits viewport '+mobile);
 await page.click('#waIncomingDialogV226 [data-attend]');ok((await popup.textContent()).includes('Há um rascunho'),'customer switch protected while draft exists '+mobile);
 await page.fill('#chatSearch','Busca continua');ok(await page.locator('#chatSearch').inputValue()==='Busca continua','background search interactive '+mobile);
 await page.click('#waIncomingDialogV226 [data-close]');await emit([row(QA)]);ok(!await popup.isVisible(),'dismissed message does not reopen '+mobile);
 await page.click('#waIncomingLauncherV226');ok(await popup.isVisible(),'manual reopen works '+mobile);await page.keyboard.press('Escape');ok(!await popup.isVisible(),'Escape closes '+mobile);
 history.get(QA).push({_id:'out1',isFromMe:true,body:'Resposta do bot',timestamp:now+1});await emit([row(QA,now+1,'Resposta do bot')]);ok(!await popup.isVisible(),'bot-only update does not reopen '+mobile);
 history.get(QA).push({_id:'qa2',isFromMe:false,body:'Nova pergunta',timestamp:now+2});await emit([row(QA,now+2,'Nova pergunta')]);ok(await popup.isVisible()&&(await popup.textContent()).includes('Nova pergunta'),'new inbound reopens '+mobile);await page.click('#waIncomingDialogV226 [data-close]');
 const before=requests.length;await emit([row('5511999999999'),{...row(QA),id:'123@g.us',isGroup:true},{...row(QA),id:'123@lid'},{...row(QA),id:'status@broadcast'}]);ok(requests.length===before,'foreign Brazil groups LID status excluded '+mobile);
 history.set(EC,[{_id:'ec1',isFromMe:false,body:'<img src=x onerror="window.bad=true">',timestamp:now+3}]);failed=true;await emit([row(EC,now+3)]);ok(!await popup.isVisible(),'failed read does not open '+mobile);failed=false;await emit([row(EC,now+3)]);ok(await popup.isVisible(),'failed read retried without losing alert '+mobile);ok(await popup.locator('img').count()===0&&!await page.evaluate(()=>window.bad),'message HTML inert '+mobile);
 await page.click('#waIncomingDialogV226 [data-close]');history.set(EC,[{_id:'old',isFromMe:false,body:'Histórico antigo',timestamp:now-90000}]);await emit([row(EC,now-90000)]);ok(!await popup.isVisible(),'old unread archive does not reopen '+mobile);
 await page.evaluate(()=>{window.__waFixture.state.token='';document.getElementById('dashboard').classList.add('hidden')});await page.waitForTimeout(50);ok((await popup.textContent()).includes('Nova pergunta')===false&&(await popup.locator('[data-body]').textContent())==='','logout clears private text '+mobile);
 ok(writes.length===0,'no outbound sends orders read markers or writes '+mobile);ok(errors.length===0,'no JavaScript errors '+mobile);await context.close();
}
 console.log(JSON.stringify({pass:true,checks,details,offline:true,whatsappSends:0,productionWrites:0}));
}finally{await browser.close()}
