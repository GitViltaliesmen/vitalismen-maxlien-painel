import {createHash} from 'node:crypto';
import http from 'node:http';
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import mongoose from 'file:///opt/vitalismen-automacao/current/node_modules/mongoose/index.js';
const R=fs.realpathSync('/opt/vitalismen-automacao/current');
assert.notEqual(fs.readlinkSync('/proc/self/ns/net'),fs.readlinkSync('/proc/1/ns/net'));
const uri='mongodb://127.0.0.1:27119/vitalismen_tex_disposable';
await mongoose.connect(uri,{autoIndex:false,autoCreate:false});
const db=mongoose.connection.db,checks=[],requests=[],ingress=[],phone='593990000079';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const check=(x,label)=>{assert(x,label);checks.push(label);};
await db.collection('outbounddedupes').createIndexes([
 {name:'key_1',key:{key:1},unique:true},
 {name:'phoneDigits_1_kind_1_fingerprint_1',key:{phoneDigits:1,kind:1,fingerprint:1},unique:true},
 ...['phoneDigits','jid','kind','fingerprint','status','logicalMessageId','channelId','provider','providerMessageId'].map(n=>({name:n+'_1',key:{[n]:1}}))
]);
let providerSequence=0;
const provider=http.createServer((req,res)=>{let raw='';req.on('data',c=>raw+=c);req.on('end',()=>{
 res.writeHead(200,{'content-type':'application/json'});
 if(req.method==='GET')return res.end(JSON.stringify({connected:true,smartphoneConnected:true,phone:'5531971862958'}));
 const body=raw?JSON.parse(raw):{},id='TEX_SIM_OUT_'+String(++providerSequence).padStart(5,'0');
 requests.push({id,path:req.url,body,at:Date.now()});res.end(JSON.stringify({messageId:id,zaapId:id}));
});});
await new Promise(r=>provider.listen(27120,'127.0.0.1',r));
const child=spawn('node',['--require',process.env.SIM_SHIM,R+'/src/index.js'],{cwd:R,env:{...process.env,NODE_OPTIONS:'--import=file:///opt/vitalismen-automacao/current/scripts/lib/sealed-successor-preload-v1.mjs',ZAPI_BASE_URL:'http://127.0.0.1:27120',ZAPI_INSTANCE_ID:'simulation',ZAPI_INSTANCE_TOKEN:'simulation',ZAPI_CLIENT_TOKEN:'simulation',MONGODB_URI:uri,PORT:'3001',HOST:'127.0.0.1',OPENAI_API_KEY:'OFFLINE_NO_NETWORK'},stdio:['ignore','pipe','pipe']});
let log='',seq=0;
for(const stream of [child.stdout,child.stderr])stream.on('data',x=>{log+=x;fs.appendFileSync(process.env.SIM_APP_LOG,x);});
const wait=async(fn,label,timeout=30000)=>{const end=Date.now()+timeout;while(Date.now()<end){const value=await fn();if(value)return value;if(child.exitCode!==null)throw Error('APP_EXIT '+log.slice(-4000));await pause(200);}throw Error('TIMEOUT '+label+' '+log.slice(-6000));};
const post=async(path,body)=>{const r=await fetch('http://127.0.0.1:3001'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const v=await r.json();assert.equal(r.status,200,JSON.stringify(v)+' '+log.slice(-1500));return v;};
const send=async(text,peer=phone)=>{const payload={messageId:'TEX_SIM_IN_'+String(++seq).padStart(5,'0'),phone:peer,connectedPhone:'553171862958',fromMe:false,isGroup:false,status:'RECEIVED',type:'ReceivedCallback',senderName:'Alfredo Prueba',text:{message:text}};ingress.push({payload,receipt:await post('/api/zapi/webhook/received',payload)});return payload;};
const state=(peer=phone)=>db.collection('contactstates').findOne({phoneDigits:peer});
const outbound=(peer=phone)=>requests.filter(x=>String(x.body.phone||'').replace(/\D/g,'')===peer);
const flow=s=>s?.metadata?.perAgentMemory?.tex_ultra_ec?.initialLayerCadence;
const acknowledged=new Set();
const ack=async()=>{for(const x of requests){if(acknowledged.has(x.id))continue;const m=await db.collection('messages').findOne({providerMessageId:x.id,isFromMe:true});if(m){await post('/api/zapi/webhook/delivery',{messageId:x.id,phone:m.peerPhone,connectedPhone:'553171862958',fromMe:true,type:'DeliveryCallback',status:'READ'});acknowledged.add(x.id);}}};
let result;
try{
 await wait(async()=>{try{return(await fetch('http://127.0.0.1:3001/api/health/')).ok;}catch{return false;}},'startup',180000);
 const started=Date.now(),payload=await send('Hola, quiero el tratamiento Tex Ultra.');
 await wait(()=>outbound().some(x=>x.body.message?.includes('Soy Ana Lopez, del equipo de la Dra. María Fernandes.')),'new initial greeting',45000);
 const greeting=outbound().find(x=>x.body.message?.includes('Soy Ana Lopez'));
 const hour=Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/Guayaquil',hour:'2-digit',hourCycle:'h23'}).format(new Date(greeting.at)));
 const salutation=hour>=5&&hour<=11?'Buenos días':hour>=12&&hour<=17?'Buenas tardes':'Buenas noches';
 check(greeting.body.message===`¡Hola! ¡${salutation}, Alfredo! Soy Ana Lopez, del equipo de la Dra. María Fernandes. Gracias por tu interés en Tex Ultra. Estoy aquí para ayudarte y aclarar tus dudas. Te comparto una breve presentación y seguimos conversando.`,'native_new_greeting_correct_first_name_and_guayaquil_period');
 check(greeting.at-started>=1800&&greeting.at-started<40000,'native_greeting_real_cadence');
 await ack();await post('/api/zapi/webhook/received',payload);await pause(1000);
 check(outbound().filter(x=>x.body.message?.includes('Soy Ana Lopez')).length===1,'duplicate_callback_does_not_repeat_greeting');
 await wait(async()=>{await ack();return flow(await state())?.status==='completed';},'full native Tex sequence',240000);
 await ack();await pause(400);
 const s=await state(),f=flow(s),rows=outbound();
 check(rows.length===5,'native_exactly_five_initial_messages');
 check(Object.keys(f.steps).join(',')==='greeting,intro,proof,bottle,offer'&&Object.values(f.steps).every(x=>x.sentAt),'native_all_approved_steps_persisted');
 check(rows[0]===greeting&&/send-audio/.test(rows[1].path)&&/send-image/.test(rows[2].path)&&/send-image/.test(rows[3].path)&&rows[4].body.message?.includes('Hoy tenemos estas opciones de Tex Ultra'),'native_approved_sequence_order');
 check(['35.99','70.00','80.99','147.99'].every(x=>rows[4].body.message.includes(x)),'native_official_tex_prices_preserved');
 check(!rows.some(x=>/se presenta en cápsulas|Vit Power|VitPower/.test(x.body.message||x.body.caption||'')),'generic_and_foreign_product_text_not_sent');
 const before=rows.length;await send('2 frascos');
 await wait(async()=>Number((await state())?.metadata?.customerDraft?.quantity)===2,'quantity capture',35000);await ack();
 check(Number((await state()).metadata.customerDraft.total)===70,'quantity_two_correct_total');
 check(outbound().length>before&&outbound().filter(x=>x.body.message?.includes('Soy Ana Lopez')).length===1&&flow(await state()).status==='completed','quantity_continues_without_restarting_initial_block');
 const manual='593990000078';await db.collection('contactstates').insertOne({phoneDigits:manual,chatId:manual+'@c.us',countryCode:'EC',assignedAgent:'vit_power_ec',human:{mode:'manual',lastManualBy:'operator',pausedUntil:new Date('2036-01-01T00:00:00Z')},metadata:{productKey:'tex_ultra_ec',vslProductKey:'tex_ultra_ec',lastSessionId:'zapi',customerDraft:{productKey:'tex_ultra_ec'}}});
 const held=await send('Hola, quiero el tratamiento Tex Ultra.',manual);await wait(()=>db.collection('messages').findOne({_id:held.messageId}),'manual inbound persistence');await pause(10000);
 check(outbound(manual).length===0&&(await state(manual)).human.mode==='manual','native_human_pause_preserved');
 const questionPhone='593990000077';const unknownPayload=await send('¿Cuál es el precio de Tex Ultra?',questionPhone);
 await wait(()=>db.collection('messages').findOne({_id:unknownPayload.messageId}),'unknown question persisted');
 await wait(async()=>{const s=await state(questionPhone);return s?.tags?.includes('PRODUCT_REVIEW_REQUIRED')&&s?.conversationBucket?.value==='review'&&!s?.metadata?.lastRouterDecisionProductKey;},'unknown product review preserved',35000);
 check(!flow(await state(questionPhone))&&outbound(questionPhone).length===0,'native_unknown_question_review_preserved');
 const knownQuestion='593990000075';await db.collection('contactstates').insertOne({phoneDigits:knownQuestion,chatId:knownQuestion+'@c.us',countryCode:'EC',assignedAgent:'tex_ultra_ec',human:{mode:'auto',lastManualBy:''},metadata:{productKey:'tex_ultra_ec',productName:'Tex Ultra Ecuador',vslProductKey:'tex_ultra_ec',vslProductSource:'zapi_explicit_product_text',vslEntryPanelLeadAt:new Date().toISOString(),lastSessionId:'zapi',productRouteLock:{active:true,productKey:'tex_ultra_ec',source:'zapi_explicit_product_text'},customerDraft:{productKey:'tex_ultra_ec'},perAgentMemory:{tex_ultra_ec:{stage:'awaiting_interest',presentationSentAt:new Date(Date.now()-3600000).toISOString()}}}});
 await send('¿Cuál es el precio de Tex Ultra?',knownQuestion);
 await wait(()=>outbound(knownQuestion).some(x=>x.body.message),'known Tex specific price answer',40000);
 check(!flow(await state(knownQuestion))&&!outbound(knownQuestion).some(x=>/Soy Ana Lopez|send-image|send-audio/.test(x.body.message||x.path)),'specific_question_does_not_start_presentation');
 check(outbound(knownQuestion).some(x=>['35.99','70.00','80.99','147.99'].every(p=>x.body.message?.includes(p))),'native_known_tex_question_after_presentation_gets_official_prices');
 const interruptPhone='593990000076';await send('Hola, quiero el tratamiento Tex Ultra.',interruptPhone);
 await wait(()=>outbound(interruptPhone).some(x=>x.body.message?.includes('Soy Ana Lopez')),'interrupt initial greeting',40000);
 await wait(async()=>flow(await state(interruptPhone))?.steps?.greeting?.sentAt,'interrupt greeting persisted');await ack();
 await send('2 frascos',interruptPhone);
 await wait(async()=>Number((await state(interruptPhone))?.metadata?.customerDraft?.quantity)===2,'new customer quantity priority',35000);
 await pause(12000);await ack();
 check(flow(await state(interruptPhone))?.status==='paused_by_customer'&&!outbound(interruptPhone).some(x=>/send-audio|send-image/.test(x.path)),'native_new_message_interrupts_remaining_presentation');
 check(await db.collection('orders').countDocuments({})===0,'no_simulated_or_real_order_created');
 check(!fs.existsSync(process.env.SIM_MODEL_TRACE)||fs.statSync(process.env.SIM_MODEL_TRACE).size===0,'native_tex_path_does_not_call_free_ai');
 check(new Set(requests.map(x=>x.id)).size===requests.length,'unique_provider_ids');
 result={pass:true,checks,greeting:greeting.body.message,greetingRealElapsedMs:greeting.at-started,sequence:rows.map(x=>({path:x.path,message:x.body.message||x.body.caption||'',audio:x.body.audio?{bytes:String(x.body.audio).length,sha256:createHash('sha256').update(String(x.body.audio)).digest('hex')}:null,image:x.body.image?{bytes:String(x.body.image).length,sha256:createHash('sha256').update(String(x.body.image)).digest('hex')}:null})),networkIsolated:true,productionMessagesSent:0,productionDatabaseWrites:0,ordersCreated:0};
}catch(error){result={pass:false,checks,error:String(error),tail:log.slice(-8000),requests:requests.map(x=>({path:x.path,message:x.body.message||x.body.caption||'',at:x.at}))};}
finally{child.kill('SIGTERM');await Promise.race([new Promise(r=>child.once('exit',r)),pause(8000)]);if(child.exitCode===null)child.kill('SIGKILL');await new Promise(r=>provider.close(r));await mongoose.disconnect();fs.writeFileSync(process.env.SIM_RESULT,JSON.stringify(result,null,2)+'\n');}
console.log(JSON.stringify(result));if(!result.pass)process.exitCode=1;
