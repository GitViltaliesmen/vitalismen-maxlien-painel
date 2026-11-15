import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/routes/zapi.js',import.meta.url),'utf8');
const start=source.indexOf('    const messageWrite = await Message.updateOne('),end=source.indexOf('    const newMessage =',start);
assert(start>0&&end>start);
const statement=source.slice(start,end);
const writer=new Function('Message','context',`return (async()=>{const {messageId,chatId,phone,normalizedBody,effectiveType,internalMediaUrl,now,inboundProfileName,providerMessageId,providerZaapId,payload,hasDeclaredMedia,mediaUrl,mediaMime,providerMediaId,INBOUND_MEDIA_STATUS}=context;${statement};return messageWrite;})()`);
for(const kind of ['text','audio','image'])test(`real Z-API upsert stores trusted session identity for ${kind}`,async()=>{
 let saved;const Message={updateOne:async(q,u,o)=>{saved={q,u,o};return{upsertedCount:1};}};
 const context={messageId:'OFFLINE_'+kind,chatId:'593900000001@s.whatsapp.net',phone:'593900000001',normalizedBody:'Hola. Test aislado.',effectiveType:kind,now:new Date(),payload:{ownerPhoneDigits:'UNTRUSTED'},hasDeclaredMedia:kind!=='text',INBOUND_MEDIA_STATUS:{RECEIVED:'RECEIVED'}};
 const result=await writer(Message,context);assert.equal(result.upsertedCount,1);
 assert.equal(saved.u.$setOnInsert.ownerPhoneDigits,'5531971862958');assert.equal(saved.u.$setOnInsert.sessionId,'zapi');assert.equal(saved.u.$setOnInsert.provider,'zapi');assert.equal(saved.u.$setOnInsert.isFromMe,false);assert.equal(saved.u.$setOnInsert.peerPhone,context.phone);assert.equal(saved.o.upsert,true);
 assert.equal(saved.q._id,context.messageId);assert.equal(saved.u.$set,undefined);
});
test('owner is assigned only on insert; historical records are not overwritten',()=>{assert.match(statement,/\$setOnInsert/);assert.doesNotMatch(statement,/\$set\s*:/);});
