import {chromium} from 'file:///opt/vitalismen-automacao/current/node_modules/playwright/index.mjs';
import fs from 'node:fs';import assert from 'node:assert/strict';
const script=fs.readFileSync('cta.js','utf8'),browser=await chromium.launch({headless:true,args:['--no-sandbox']});let checks=0;
const ok=(c,m)=>{assert(c,m);checks++;};
try{
 for(const width of [375,430,1280])for(const mode of ['normal','qa','denied','failure','slow']){
  const c=await browser.newContext({viewport:{width,height:850}}),p=await c.newPage(),payloads=[],urls=[],errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(mode=>{window.__pixel=[];window.fbq=(...a)=>window.__pixel.push(a);if(mode==='denied')window.vitalismenMarketingConsent=false;},mode);
  await p.route('**/*',async route=>{const r=route.request(),u=r.url();
   if(u.startsWith('https://wa.me/')){urls.push(u);return route.fulfill({contentType:'text/html',body:'<p>Destino interceptado</p>'});}
   if(u.includes('/api/vitpower-measurement')){payloads.push(r.postDataJSON());if(mode==='failure')return route.abort();if(mode==='slow')await new Promise(r=>setTimeout(r,1400));return route.fulfill({json:{ok:true,reference:'VP-'+'A'.repeat(36)}});}
   if(r.isNavigationRequest())return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body><main class="vp-hero">'+(width<600?'<vturb-smartplayer></vturb-smartplayer><button id="preco_89">Hablar</button>':'<a data-product="vit_power_ec" data-vsl-source="https://taviazen.shop/vitpower_2026g" data-whatsapp-phone="553171862958">Hablar</a>')+'</main><script>'+script+'</script></body></html>'});
   return route.fulfill({contentType:'application/javascript',body:''});
  });
  await p.goto('https://taviazen.shop/vitpower_2026g?fbclid=ISOLATED_CLICK&utm_source=isolated_test&campaign_id=SYNTHETIC_CAMPAIGN&ad_id=SYNTHETIC_AD'+(mode==='qa'?'&vp_qa=1':''));
  const button=p.getByText('Hablar',{exact:true});await button.click();await p.locator('dialog').waitFor();
  const box=await p.locator('dialog').boundingBox();ok(box.x>=0&&box.x+box.width<=width+1,'responsive form '+width);
  await p.locator('button[type=submit]').click();ok(urls.length===0,'no incomplete phone submission');
  await p.locator('#vp-first-name').fill('José');await p.locator('#vp-contact-phone').fill('5511999999999');await p.locator('button[type=submit]').click();ok(urls.length===0,'foreign phone blocked');
  await p.locator('#vp-contact-phone').fill(mode==='qa'?'5515998038637':'0991234567');
  const start=Date.now();await p.locator('button[type=submit]').click();await p.waitForURL('https://wa.me/**');
  ok(urls.length===1,'one clean destination');const target=new URL(urls[0]),message=target.searchParams.get('text');
  ok(target.pathname==='/553171862958','official number');ok(message.startsWith('Hola, vengo del video.')&&message.endsWith('\nNombre: José'),'commercial text/name');
  ok(!/Visita:|VP-|593991234567|SYNTHETIC|_fbp|fbclid/.test(message),'no technical or advertising identifiers in WhatsApp');
  if(mode==='slow')ok(Date.now()-start<1400,'tracking latency does not block WhatsApp beyond fallback');
  if(['qa','denied'].includes(mode))ok(payloads.length===0,'privacy/QA no measurement');
  else{
   const contact=payloads.find(x=>x.events.some(e=>e.name==='Contact'));ok(contact?.contactPhone==='593991234567','contact enrollment in protected bridge');
   ok(contact.entryMessage===message,'fingerprint matches customer-reviewed message');
   ok(payloads.every(x=>x.fbp&&x.fbc.endsWith('.ISOLATED_CLICK')&&x.campaign_id==='SYNTHETIC_CAMPAIGN'&&x.ad_id==='SYNTHETIC_AD'),'original attribution retained');
   ok(payloads.filter(x=>x.contactPhone!==undefined).length===1,'phone sent only on contact submission');
  }
  ok(!payloads.flatMap(x=>x.events).some(x=>['InitiateCheckout','Purchase'].includes(x.name)),'click is not structured checkout or sale');
  ok(errors.length===0,'no browser errors');await c.close();
 }
 console.log(JSON.stringify({project:'VITALISMEN_EC',pass:true,checks,viewports:[375,430,1280],modes:['normal','qa','denied','failure','slow'],networkIntercepted:true,productionWrites:0,realOrders:0,realMetaRequests:0,whatsappSends:0}));
}finally{await browser.close();}
