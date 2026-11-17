'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
test('patched shared SDKs load without opening WhatsApp, a browser, or a database',async()=>{
 const ww=require('whatsapp-web.js'),puppeteer=require('puppeteer'),mongoose=require('mongoose');
 assert.equal(typeof ww.Client,'function');assert.equal(typeof ww.LocalAuth,'function');
 assert.equal(typeof puppeteer.launch,'function');assert.equal(typeof mongoose.connect,'function');
 assert.match(mongoose.version,/^8\.24\.10$/);
});
test('sharp patched native binding decodes and resizes an isolated image',async()=>{
 const sharp=require('sharp'),png=await sharp(Buffer.from('<svg width="10" height="10"><rect width="10" height="10" fill="red"/></svg>')).resize(5,5).png().toBuffer();
 const meta=await sharp(png).metadata();assert.equal(meta.width,5);assert.equal(meta.height,5);assert.equal(meta.format,'png');
});
test('OpenAI updated SDK preserves chat.completions request/response contract with a loopback fixture',async t=>{
 const http=require('node:http'),OpenAI=require('openai');let received;
 const server=http.createServer((req,res)=>{let body='';req.on('data',x=>body+=x);req.on('end',()=>{
  received={url:req.url,body:JSON.parse(body)};res.setHeader('Content-Type','application/json');
  res.end(JSON.stringify({id:'offline',object:'chat.completion',choices:[{index:0,message:{role:'assistant',content:'ISOLATED'},finish_reason:'stop'}]}));
 });});
 server.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));
 const client=new OpenAI({apiKey:'OFFLINE_NOT_A_CREDENTIAL',baseURL:'http://127.0.0.1:'+server.address().port+'/v1',maxRetries:0});
 const result=await client.chat.completions.create({model:'offline-model',messages:[{role:'user',content:'ISOLATED_NO_CUSTOMER_DATA'}],temperature:0.2});
 assert.equal(result.choices[0].message.content,'ISOLATED');assert.equal(received.url,'/v1/chat/completions');assert.equal(received.body.model,'offline-model');
});
