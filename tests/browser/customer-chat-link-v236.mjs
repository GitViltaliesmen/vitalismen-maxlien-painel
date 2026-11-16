import { chromium } from 'file:///opt/vitalismen-automacao/current/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const script=fs.readFileSync('chat.js','utf8'),css=fs.readFileSync('chat.css','utf8');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});let checks=0;
const ok=(condition,label)=>{assert(condition,label);checks++;};
try {
 for(const width of [375,430,1280]) {
  const context=await browser.newContext({viewport:{width,height:850}}),page=await context.newPage(),payloads=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.__voicePlays=0;window.Audio=class{play(){window.__voicePlays++;return Promise.resolve()}pause(){}}});
  await page.route('**/*',async route=>{
   const req=route.request(),url=req.url();
   if(url.includes('chat-v220.css'))return route.fulfill({contentType:'text/css',body:css});
   if(url.includes('/api/vitpower-chat')){
    const body=req.postDataJSON();payloads.push(body);
    if(body.action==='voice')return route.fulfill({contentType:'audio/mpeg',body:Buffer.alloc(256)});
    if(body.action==='start')return route.fulfill({json:{ok:true,history:[],voiceReplyId:'welcome_ana_lopez_v231'}});
    if(body.action==='order_status')return route.fulfill({json:{ok:true,reply:'Estado registrado de tu pedido: Enviado.',at:new Date().toISOString()}});
    if(body.action==='clear')return route.fulfill({json:{ok:true,cleared:true}});
    return route.fulfill({json:{ok:true,reply:'Precio: 3 frascos: USD 95.99.',at:new Date().toISOString()}});
   }
   if(req.isNavigationRequest())return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body><main><h1>Vit Power</h1><input id="background-input" aria-label="Página continua disponible"><button id="preco_89" style="display:none">Oferta</button></main><script>'+script+'</script></body></html>'});
   return route.abort();
  });
  await page.goto('https://taviazen.shop/vitpower_2026g');
  const launcher=page.getByRole('button',{name:'Abrir chat con Ana'});await launcher.waitFor();
  ok(await launcher.isVisible(),'launcher available before CTA '+width);
  await page.getByRole('button',{name:'Conversar ahora'}).waitFor({state:'visible',timeout:12000});
  ok(payloads.length===0,'invitation does not create API or commercial events '+width);
  await page.getByRole('button',{name:'Conversar ahora'}).click();
  const input=page.getByRole('textbox',{name:'Escribe tu mensaje'});await input.waitFor();await page.waitForFunction(()=>document.querySelector('#vp-web-chat-v220').shadowRoot.querySelector('[role=status]').textContent==='');
  await page.locator('#background-input').fill('Página operativa');ok(await page.locator('#background-input').inputValue()==='Página operativa','non-modal chat leaves page operable '+width);
  ok(!await page.getByRole('link',{name:'Continuar por WhatsApp',exact:true}).isVisible(),'checkout CTA remains gated '+width);
  await input.fill('¿Cuánto cuestan 3 frascos?');await page.getByRole('button',{name:'Enviar mensaje'}).click();
  await page.getByText('Precio: 3 frascos: USD 95.99.',{exact:true}).waitFor();
  const id=payloads.find(p=>p.action==='message').requestId;
  ok((await page.evaluate(()=>window.__voicePlays))===0,'voice requires user activation '+width);
  await page.getByRole('button',{name:'🔊 Escuchar'}).click();await page.waitForFunction(()=>window.__voicePlays===1);
  const voice=payloads.find(p=>p.action==='voice');ok(voice.requestId===id&&!('message'in voice),'voice uses owned reply reference, not arbitrary text '+width);
  await page.getByRole('button',{name:'Estado de mi pedido',exact:true}).click();
  const code=page.getByLabel('Código privado del pedido');await code.fill('invalid');await page.getByRole('button',{name:'Consultar',exact:true}).click();
  ok(!payloads.some(p=>p.action==='order_status'),'invalid order code never sent '+width);
  await code.fill('d'.repeat(64));await page.getByRole('button',{name:'Consultar',exact:true}).click();await page.getByText('Estado registrado de tu pedido: Enviado.',{exact:true}).waitFor();
  const query=payloads.find(p=>p.action==='order_status');ok(query.accessToken==='d'.repeat(64)&&!query.message,'order credential stays out of conversation payload '+width);
  ok(!await page.locator('#vp-web-chat-v220').evaluate(host=>host.shadowRoot.textContent.includes('d'.repeat(64))),'credential not rendered as message '+width);
  const bounds=await page.locator('#vp-chat-dialog').boundingBox();ok(bounds.x>=0&&bounds.x+bounds.width<=width+1,'chat fits viewport '+width);
  ok(errors.length===0,'no browser exceptions '+width);
  const beforePrivatePaste=payloads.length;await input.fill('e'.repeat(64));await page.getByRole('button',{name:'Enviar mensaje'}).click();ok(payloads.length===beforePrivatePaste&&await code.inputValue()==='e'.repeat(64),'accidental access-code paste stays out of AI conversation '+width);await code.fill('');
  await page.screenshot({path:'web-chat-v231-'+width+'.png'});
  await page.getByRole('button',{name:'Cerrar conversación'}).click();await launcher.click();
  ok(payloads.filter(p=>p.action==='start').length===1,'reopening preserves session '+width);
  await page.getByRole('button',{name:'Cerrar conversación'}).click();await page.reload();await page.waitForTimeout(8300);
  ok(!await page.getByRole('button',{name:'Conversar ahora'}).isVisible(),'invitation shown once per visit '+width);
  const statusQueries=payloads.filter(row=>row.action==='order_status').length;
  await page.goto('https://taviazen.shop/vitpower_2026g#consulta-pedido');
  await page.getByLabel('Código privado del pedido').waitFor({state:'visible'});
  ok(payloads.filter(row=>row.action==='order_status').length===statusQueries,'invitation opens private form without authorizing a phone or sending a code '+width);
  await page.getByRole('button',{name:'Cerrar conversación'}).click();
  const beforeFresh=payloads.length;await page.goto('https://taviazen.shop/vitpower_2026g?fixtureFresh=1#consulta-pedido');
  await page.getByLabel('Código privado del pedido').waitFor({state:'visible'});
  ok(payloads.slice(beforeFresh).every(row=>row.action==='start'),'fresh invitation opens chat without model calls or unauthorized order reads '+width);
  await page.screenshot({path:'invitation-private-form-'+width+'.png'});
  await page.goto('https://taviazen.shop/vitpower_2026g#chat');await page.getByRole('textbox',{name:'Escribe tu mensaje'}).waitFor({state:'visible'});ok(await page.locator('#vp-chat-dialog').isVisible(),'chat link opens conversation directly '+width);ok(!await page.getByLabel('Código privado del pedido').isVisible(),'general chat link does not ask for private order code '+width);
  await context.close();
 }
 console.log(JSON.stringify({pass:true,checks,viewports:[375,430,1280],networkIntercepted:true,realMessages:0,realOrders:0,scope:'public-widget'}));
}finally{await browser.close()}
