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
 await context.addInitScript(()=>{window.setInterval=()=>0});const page=await context.newPage();const errors=[],writes=[];let mode='normal',slow=false,waMode='normal';const waRequests=[];
 page.on('pageerror',e=>errors.push(e.message));
 const first={id:'a'.repeat(64),name:'Maria QA',city:'Quito',quantity:3,messageCount:2,lastAt:'2026-11-15T22:00:00Z'},second={id:'b'.repeat(64),name:null,messageCount:1,lastAt:'2026-11-15T21:00:00Z'};
 await page.route('**/*',async route=>{
  const request=route.request(),u=new URL(request.url());if(request.isNavigationRequest())return route.fulfill({contentType:'text/html',body:html});
  if(request.method()!=='GET')writes.push(u.pathname);
  if(request.method()==='POST'&&u.pathname.endsWith('/order-access')){const payload=request.postDataJSON();ok(payload.identityVerified===true&&payload.phone==='593999999991'&&payload.orderId==='EC-SIMULATED-231','private grant exact payload '+mobile);return route.fulfill({json:{ok:true,token:'d'.repeat(64),expiresAt:Date.now()+86400000,automaticSend:false}})}
  if(u.pathname.startsWith('/api/web-chat-admin/vitpower')){
   if(mode==='denied')return route.fulfill({status:403,contentType:'application/json',body:'{}'});
   let body={version:222,readOnly:true,conversations:mode==='empty'?[]:[first,second]};
   if(u.pathname.endsWith(first.id)){if(slow)await new Promise(r=>setTimeout(r,300));body={conversation:{...first,history:[{role:'user',content:'<img src=x onerror="window.bad222=true">',at:first.lastAt},{role:'assistant',content:'Respuesta oficial de prueba',at:first.lastAt}]}}}
   if(u.pathname.endsWith(second.id))body={conversation:{...second,history:[{role:'user',content:'Segunda conversa QA',at:second.lastAt}]}};
   return route.fulfill({contentType:'application/json',body:JSON.stringify(body)}).catch(()=>{});
  }
  if(u.pathname.startsWith('/panel-intelligence/')){const file='/opt/vitalismen-automacao/current/public'+u.pathname;if(fs.existsSync(file))return route.fulfill({contentType:'application/javascript',body:fs.readFileSync(file)})}
  if(u.pathname.startsWith('/api/whatsapp/messages/')){
   waRequests.push({url:u.pathname,query:u.search,method:request.method(),authorization:request.headers().authorization});
   if(waMode==='denied')return route.fulfill({status:403,json:{error:'FORBIDDEN'}});
   if(waMode==='slow')await new Promise(r=>setTimeout(r,300));
   return route.fulfill({json:[
    {_id:'QA234-IN',body:waMode==='updated'?'Pergunta nova recebida QA 234':'Pergunta QA dentro do popup <img src=x onerror="window.bad234=true">',timestamp:'2026-11-16T18:00:00Z',isFromMe:false,type:'chat'},
    {_id:'QA234-OUT',body:'Resposta QA guardada',timestamp:'2026-11-16T18:01:00Z',isFromMe:true,type:'chat'},
    {_id:'QA234-IMG',body:'[image]',timestamp:'2026-11-16T18:02:00Z',isFromMe:true,type:'image',mediaUrl:'/media/qa-234.png',mediaStorageStatus:'READY'},
    {_id:'QA234-PTT',body:'[audio]',timestamp:'2026-11-16T18:03:00Z',isFromMe:true,type:'ptt',mediaUrl:'/media/qa-234.wav',mediaStorageStatus:'READY'},
    {_id:'QA234-SYSTEM',body:'[PAINEL] Status alterado no Painel Unificado - QA',timestamp:'2026-11-16T18:04:00Z',isFromMe:true,type:'system'}
   ]}).catch(()=>{});
  }
  if(u.pathname.startsWith('/media/')||u.pathname.startsWith('/api/whatsapp/media')){
   const audio=u.pathname.includes('audio')||u.pathname.endsWith('.wav');const wav=Buffer.alloc(46);wav.write('RIFF',0);wav.writeUInt32LE(38,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(2,40);
   return route.fulfill({contentType:audio?'audio/wav':'image/png',body:audio?wav:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZzQAAAAASUVORK5CYII=','base64')});
  }
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
 const search=page.getByLabel('Buscar cliente no chat do site');await search.fill('MARÍA');ok(await page.locator('#webChatDashboardListV222 button').count()===1,'name search ignores case and accent '+mobile);
 await search.fill('bbbbbb');ok(await page.locator('#webChatDashboardListV222 button').count()===1&&(await page.locator('#webChatDashboardListV222').textContent()).includes('Visitante'),'anonymous visitor can be found by ID '+mobile);
 await search.fill('inexistente');ok(await page.locator('#webChatDashboardListV222 button').count()===0&&(await page.locator('#webChatDashboardSearchCountV232').textContent())==='0 / 2','empty search result has an accurate count '+mobile);
 ok(await page.locator('#customerNameInput').inputValue()==='Rascunho V224','popup search preserves the customer form draft '+mobile);ok(writes.length===0,'search never sends WhatsApp or changes data '+mobile);
 await search.fill('');ok(await page.locator('#webChatDashboardListV222 button').count()===2,'clearing search restores complete conversation list '+mobile);


 await page.evaluate(()=>{const s=window.__vp222.state;s.user={role:'admin'};s.zapiDevice={device:{phone:'593999991111'}};s.chats=[
 {id:'593999996269@c.us',phone:'593999996269',country:'EC',name:'Peter QA',human:{mode:'auto'},customerDraft:{city:'Quito'},lastMessage:{body:'NAO MOSTRAR TEXTO DO CLIENTE'}},
 {id:'593999996269-dup@c.us',phone:'593999996269',country:'EC',name:'Duplicado QA'},
 {id:'593999996269@g.us',phone:'593999996269',country:'EC',name:'Grupo QA',isGroup:true},
 {id:'status@broadcast',phone:'593999996269',country:'EC',name:'Status QA'},
 {id:'593999996269@lid',country:'EC',name:'LID sem telefone'},
 {id:'551198886269@c.us',phone:'551198886269',country:'EC',name:'Brasil bloqueado'},
 {id:'593999991111@c.us',phone:'593999991111',country:'EC',name:'Próprio número'}
 ];document.getElementById('chatSearch').value='filtro principal preservado';});
 await search.fill('');await page.locator('#webChatDashboardListV222 button').first().click();await page.waitForFunction(()=>document.querySelectorAll('.vpweb222-bubble').length===2);
 await search.fill('6269');ok(await page.locator('.vpweb222-bubble').count()===0,'phone search never shows an unrelated anonymous website history '+mobile);ok(await page.locator('[data-source="whatsapp"]').count()===1,'last four digits find Peter and deduplicate safe contacts '+mobile);
 ok((await page.locator('[data-source="whatsapp"]').textContent()).includes('Peter QA'),'phone result has correct name '+mobile);
 ok(!(await page.locator('#webChatDashboardListV222').textContent()).includes('NAO MOSTRAR'),'WhatsApp results never include message previews '+mobile);
 ok((await page.locator('#webChatDashboardSearchCountV232').textContent()).includes('WhatsApp: 1'),'result counter distinguishes WhatsApp '+mobile);
 await search.fill('+593 999996269');ok(await page.locator('[data-source="whatsapp"]').count()===1,'formatted complete phone supported '+mobile);
 await search.fill('PÉTER');ok(await page.locator('[data-source="whatsapp"]').count()===1,'WhatsApp name ignores accent and case '+mobile);
 await search.fill('Brasil bloqueado');ok(await page.locator('[data-source="whatsapp"]').count()===0,'Brazilian non-QA remains blocked '+mobile);
 await search.fill('LID sem telefone');ok(await page.locator('[data-source="whatsapp"]').count()===0,'unresolved LID remains excluded '+mobile);
 await search.fill('Próprio número');ok(await page.locator('[data-source="whatsapp"]').count()===0,'official own phone excluded '+mobile);

 await search.fill('6269');await page.evaluate(()=>{const s=window.__vp222.state;s.customerFormDirty=true;s.selectedChat={id:'previous-main@c.us',phone:'593999991234',name:'Cliente principal QA'};document.getElementById('conversation').textContent='CONVERSA CENTRAL PRESERVADA';document.getElementById('messageInput').value='Rascunho de resposta QA';});
 await page.locator('[data-source="whatsapp"]').click();await page.waitForFunction(()=>document.getElementById('webChatDashboardThreadV222').textContent.includes('Resposta QA guardada'));
 ok(await page.locator('#webChatDashboardDialogV222').isVisible(),'WhatsApp selection keeps popup open '+mobile);
 ok((await page.locator('#webChatDashboardThreadV222 h3').textContent()).includes('Peter QA'),'correct customer rendered inside popup '+mobile);
 ok(await page.evaluate(()=>window.__vp222.state.selectedChat.id)==='previous-main@c.us','main selected customer is unchanged '+mobile);
 ok(await page.locator('#conversation').textContent()==='CONVERSA CENTRAL PRESERVADA','central history remains untouched '+mobile);
 ok(await page.locator('#customerNameInput').inputValue()==='Rascunho V224'&&await page.evaluate(()=>window.__vp222.state.customerFormDirty),'customer form and dirty flag preserved '+mobile);
 ok(await page.locator('#messageInput').inputValue()==='Rascunho de resposta QA','main message draft preserved '+mobile);
 ok(!(await page.locator('#webChatDashboardThreadV222').textContent()).includes('[PAINEL]'),'internal status events omitted from popup '+mobile);
 ok(await page.locator('#webChatDashboardThreadV222 img').count()===1&&!await page.evaluate(()=>window.bad234),'media shown but untrusted message HTML remains inert '+mobile);
 ok(await page.locator('#webChatDashboardThreadV222 audio[controls]').count()===1,'native audio player shown inside popup '+mobile);
 ok(await page.locator('#webChatDashboardThreadV222 audio').evaluate(e=>e.paused),'audio does not autoplay '+mobile);
 ok(waRequests.length===1&&waRequests[0].method==='GET'&&waRequests[0].query.includes('limit=60')&&!waRequests[0].query.includes('sync=')&&waRequests[0].authorization==='Bearer OFFLINE_ADMIN_TOKEN','bounded authenticated history GET only '+mobile);
 ok(await page.locator('#chatSearch').inputValue()==='filtro principal preservado','main search remains unchanged '+mobile);
 ok(writes.length===0,'popup read sends no message and writes no data '+mobile);
 waMode='updated';await page.waitForFunction(()=>document.getElementById('webChatDashboardThreadV222').textContent.includes('Pergunta nova recebida QA 234'),null,{timeout:14000});
 ok(await page.locator('#webChatDashboardDialogV222').isVisible()&&await page.locator('#conversation').textContent()==='CONVERSA CENTRAL PRESERVADA','automatic refresh updates popup and preserves main attendance '+mobile);
 waMode='denied';await page.click('#webChatDashboardRefreshV222');await page.waitForFunction(()=>document.getElementById('webChatDashboardStatusV222').textContent.includes('Acesso restrito'));
 ok(await page.locator('#webChatDashboardThreadV222').textContent()===''&&await page.evaluate(()=>window.__vp222.state.token)==='OFFLINE_ADMIN_TOKEN','denied history clears popup data without logging main panel out '+mobile);
 waMode='normal';await page.click('#webChatDashboardRefreshV222');await page.waitForFunction(()=>document.getElementById('webChatDashboardThreadV222').textContent.includes('Resposta QA guardada'));
 ok(await page.locator('#webChatDashboardDialogV222').isVisible(),'manual refresh restores WhatsApp in same popup '+mobile);
 await page.click('#webChatDashboardCloseV222');ok(await page.locator('#webChatDashboardThreadV222').textContent()==='','close clears WhatsApp private history '+mobile);
 await page.click('#webChatDashboardBtnV222');await page.waitForFunction(()=>document.getElementById('webChatDashboardThreadV222').textContent.includes('Resposta QA guardada'));
 ok(await page.locator('#webChatDashboardDialogV222').isVisible(),'reopening resumes selected WhatsApp popup '+mobile);
 await search.fill('');await page.locator('#webChatDashboardListV222 button').first().click();await page.waitForFunction(()=>document.getElementById('webChatDashboardThreadV222').textContent.includes('Respuesta oficial de prueba'));
 ok(!(await page.locator('#webChatDashboardThreadV222').textContent()).includes('Resposta QA guardada'),'website and WhatsApp histories never merge '+mobile);
 await search.fill('6269');waMode='slow';await page.locator('[data-source="whatsapp"]').click();await search.fill('');await page.locator('#webChatDashboardListV222 button').nth(1).click();await page.waitForTimeout(450);
 ok((await page.locator('#webChatDashboardThreadV222').textContent()).includes('Segunda conversa QA'),'late WhatsApp response cannot replace selected website chat '+mobile);waMode='normal';
 await page.evaluate(()=>{window.__vp222.state.customerFormDirty=false;document.getElementById('messageInput').value=''});

 await page.locator('#webChatDashboardListV222 button').first().click();await page.waitForFunction(()=>document.querySelectorAll('.vpweb222-bubble').length===2);
 await page.getByText('Autorizar consulta de pedido',{exact:true}).click();await page.getByLabel('ID exato do pedido',{exact:true}).fill('EC-SIMULATED-231');await page.getByLabel('WhatsApp do titular',{exact:true}).fill('+593 999999991');
 await page.getByRole('button',{name:'Gerar código privado',exact:true}).click();ok(writes.length===0,'grant requires identity confirmation '+mobile);
 await page.getByLabel('Confirmei a identidade do titular pelo canal oficial').check();await page.getByRole('button',{name:'Gerar código privado',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('[aria-label="Código privado: entregar somente ao titular verificado"]').value.includes('dddddddd'));
 ok(writes.length===1,'one deliberate authenticated grant '+mobile);ok(await page.getByLabel('Código privado: entregar somente ao titular verificado').evaluate(el=>el.readOnly),'private code read only '+mobile);
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
 ok((await page.locator('#chatList').textContent()).includes('Contato WhatsApp preservado'),'WhatsApp list preserved '+mobile);ok(await page.locator('.chat-preview .meta').count()===0,'left list preview prohibition preserved '+mobile);ok(writes.length===1&&writes[0].endsWith('/order-access'),'only requested private-grant POST; no outbound or commercial writes '+mobile);ok(errors.length===0,'no page errors '+mobile+': '+errors.join(';'));
 await page.evaluate(()=>document.getElementById('dashboard').classList.add('hidden'));await page.waitForFunction(()=>document.getElementById('dashboardFloatingChatV224').hidden);ok(!await page.locator('#dashboardFloatingChatV224').isVisible(),'launcher hidden outside dashboard '+mobile);
 await context.close();
}console.log(JSON.stringify({pass:true,checks,scriptsParsed:scripts,details,networkIntercepted:true,whatsappSends:0,productionWrites:0}));}finally{await browser.close()}
