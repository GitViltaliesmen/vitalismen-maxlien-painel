import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from 'file:///C:/Users/Wolfe/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const code=fs.readFileSync(new URL('chat-tex-ultra.js',import.meta.url),'utf8');
const head=fs.readFileSync(new URL('invitation-head.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('chat-tex-ultra.css',import.meta.url),'utf8');
const indexHtml=fs.readFileSync(new URL('index.html',import.meta.url),'utf8');
const playerBody=indexHtml.match(/<script type="text\/javascript"> ([\s\S]*?)<\/script>/)[1];
for(const privateMode of [false,true]){let loads=0;vm.runInNewContext(playerBody,{window:{__texChatInvitationPageV251:privateMode},document:{createElement:()=>({}),head:{appendChild:()=>loads++}}});assert.equal(loads,privateMode?0:1);}
const browser=await chromium.launch({headless:true,executablePath:'C:/Users/Wolfe/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe'});
const results=[];
async function fixture(mode,hash='',initialHidden=false){
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true});const page=await context.newPage();const requests=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.origin!=='https://plusmen.shop')throw Error('External network forbidden: '+url.origin);
  if(url.pathname==='/tex')return route.fulfill({contentType:'text/html',body:`<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><script>${head}</script><script>window.urlSeenByAnalyticsFixture=location.href;</script><style>${css}body{font:16px Arial;margin:16px}.uihiui{height:240px;background:#eee}</style><body><div class="uihiui"><vturb-smartplayer id="vid-6aafe87d665f0c5b457748ad" style="display:block;height:150px"></vturb-smartplayer><button id="preco_89">WhatsApp</button></div><script src="/fixture-chat.js"></script></body></html>`});
  if(url.pathname==='/fixture-chat.js')return route.fulfill({contentType:'application/javascript',body:code});
  if(url.pathname==='/api/public/tex-ultra-chat'){
   const body=route.request().postDataJSON();requests.push(body);
   if(body.action==='invite_accept')return route.fulfill({status:mode==='valid'?200:403,json:mode==='valid'?{ok:true,verified:true,invitationVersion:251,firstChannel:'whatsapp'}:{ok:false}});
   if(body.action==='link_status')return route.fulfill({json:{ok:true,verified:mode==='existing',firstChannel:'whatsapp',humanHold:mode==='hold'}});
   if(body.action==='start')return route.fulfill({json:{ok:true,identity:{productKey:'tex_ultra_ec',origin:'https://plusmen.shop',sourcePath:'/tex'},history:[],linkedEntryVersion:242,entryLinked:true,welcome:'Atención Tex Ultra recibida por WhatsApp.'}});
   return route.fulfill({status:400,json:{ok:false}});
  }
  return route.abort();
 });
 if(initialHidden) await page.addInitScript(()=>Object.defineProperty(document,'hidden',{configurable:true,value:true}));
 await page.goto('https://plusmen.shop/tex'+hash);await page.waitForTimeout(700);
 return{context,page,requests,errors};
}
try{
 let f=await fixture('anonymous');
 assert.equal(await f.page.locator('.tx240-launcher').isVisible(),false);
 await f.page.locator('#preco_89').click();await f.page.evaluate(()=>window.dispatchEvent(new Event('focus')));await f.page.waitForTimeout(200);
 assert.equal(await f.page.locator('.tx240-launcher').isVisible(),false);assert.equal(f.requests.some(x=>x.action==='start'),false);
 await f.page.locator('.tx240-launcher').dispatchEvent('click');assert.equal(await f.page.locator('.tx240-card').isVisible(),false);assert.deepEqual(f.errors,[]);
 results.push('Landing, CTA visible, click, focus and forced launcher event cannot unlock anonymous chat');await f.context.close();
 f=await fixture('valid','#chat='+'a'.repeat(64));
 assert.equal(await f.page.locator('.tx240-launcher').isVisible(),true);assert.equal(new URL(f.page.url()).hash,'');assert.equal(new URL(await f.page.evaluate(()=>window.urlSeenByAnalyticsFixture)).hash,'');assert.equal(await f.page.evaluate(()=>Object.hasOwn(window,'__texInviteTokenV251')),false);assert.equal(f.requests[0].action,'invite_accept');assert.equal(await f.page.locator('.uihiui').isVisible(),false);assert.equal(await f.page.locator('a[href="https://wa.me/553171862958"]').isVisible(),true);assert.equal(f.requests.some(x=>x.action==='start'),false);
 await f.page.locator('#preco_89').evaluate(e=>e.hidden=true);assert.equal(await f.page.locator('.tx240-launcher').isVisible(),true);
 await f.page.locator('.tx240-launcher').click();await f.page.waitForTimeout(150);assert.equal(await f.page.locator('.tx240-card').isVisible(),true);assert.equal(await f.page.locator('.tx242-identity').isVisible(),false);assert.equal(f.requests.some(x=>x.action==='link_start'),false);assert.deepEqual(f.errors,[]);
 await f.page.screenshot({path:new URL('invited-mobile.png',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'),fullPage:true});
 results.push('Valid invitation is removed before tracking, private memory is cleared, and chat opens only on user click');await f.context.close();
 for(const mode of ['invalid','hold']){
  f=await fixture(mode,'#chat='+'b'.repeat(64));assert.equal(await f.page.locator('.tx240-launcher').isVisible(),false);assert.equal(f.requests.some(x=>x.action==='start'),false);assert.match(await f.page.locator('p[role=status]').last().textContent(),/invitación no está disponible/);assert.deepEqual(f.errors,[]);await f.context.close();
 }
 results.push('Invalid, expired/unavailable and held invitation cannot release chat; private entry does not start VSL playback');
 f=await fixture('existing');assert.equal(await f.page.locator('.tx240-launcher').isVisible(),true);assert.equal(f.requests.some(x=>x.action==='start'),false);assert.deepEqual(f.errors,[]);await f.context.close();
 results.push('Verified returning session may resume without exposing a form or opening a new anonymous conversation');
 f=await fixture('valid','#chat='+'e'.repeat(64),true);assert.equal(f.requests.length,0);assert.equal(await f.page.locator('.tx240-launcher').isVisible(),false);
 await f.page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'))});await f.page.waitForTimeout(250);assert.equal(await f.page.locator('.tx240-launcher').isVisible(),true);assert.equal(new URL(f.page.url()).hash,'');assert.deepEqual(f.errors,[]);await f.context.close();
 results.push('Invitation opened in a background tab is verified only after the page becomes visible');

 fs.writeFileSync(new URL('BROWSER_TEST.json',import.meta.url),JSON.stringify({pass:true,checks:results,privateInviteDoesNotStartVsl:true,sourceHashes:{index:createHash('sha256').update(indexHtml).digest('hex'),chat:createHash('sha256').update(code).digest('hex'),head:createHash('sha256').update(head).digest('hex'),css:createHash('sha256').update(css).digest('hex')},productionRequests:0,physicalMessages:0},null,2)+'\n');console.log(JSON.stringify(results));
}finally{await browser.close()}
