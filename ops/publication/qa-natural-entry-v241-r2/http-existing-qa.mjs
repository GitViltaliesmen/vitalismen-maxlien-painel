import http from'node:http';import fs from'node:fs';import{spawn,spawnSync}from'node:child_process';import assert from'node:assert/strict';
import mongoose from'file:///opt/vitalismen-automacao/current/node_modules/mongoose/index.js';
import{createEcQaTestPermitV78,applyEcQaTestResetToStateV78}from'file:///opt/vitalismen-automacao/current/src/services/ecQaTestResetV78Service.js';
const R=fs.realpathSync('/opt/vitalismen-automacao/current');
assert.notEqual(fs.readlinkSync('/proc/self/ns/net'),fs.readlinkSync('/proc/1/ns/net'));
const uri='mongodb://127.0.0.1:27119/vitalismen_sale_simulation_disposable';await mongoose.connect(uri,{autoIndex:false,autoCreate:false});
const db=mongoose.connection.db,phone='593980000071',requests=[],stages=[],checks=[];
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const check=(value,label)=>{assert(value,label);checks.push(label);};
const advance=()=>{}; // All quiet windows elapse in real time; no guard clock substitution.
const provider=http.createServer((req,res)=>{let raw='';req.on('data',c=>raw+=c);req.on('end',()=>{
 res.writeHead(200,{'content-type':'application/json'});
 if(req.method==='GET')return res.end(JSON.stringify({connected:true,smartphoneConnected:true,phone:'5531971862958'}));
 const body=raw?JSON.parse(raw):{},id='SIM_OUT_'+String(requests.length+1).padStart(5,'0');requests.push({id,path:req.url,body});res.end(JSON.stringify({messageId:id,zaapId:id}));
})});await new Promise(r=>provider.listen(27120,'127.0.0.1',r));
const child=spawn('node',['--require',process.env.SIM_SHIM,R+'/src/index.js'],{cwd:R,env:{...process.env,NODE_OPTIONS:'--import=file:///opt/vitalismen-automacao/current/scripts/lib/sealed-successor-preload-v1.mjs',ZAPI_BASE_URL:'http://127.0.0.1:27120',ZAPI_INSTANCE_ID:'simulation',ZAPI_INSTANCE_TOKEN:'simulation',ZAPI_CLIENT_TOKEN:'simulation',MONGODB_URI:uri,PORT:'3001',HOST:'127.0.0.1',OPENAI_API_KEY:'OFFLINE_NO_NETWORK'},stdio:['ignore','pipe','pipe']});
let log='',seq=0;child.stdout.on('data',x=>{log+=x;fs.appendFileSync(process.env.SIM_APP_LOG,x);});child.stderr.on('data',x=>{log+=x;fs.appendFileSync(process.env.SIM_APP_LOG,x);});
const post=async(path,body)=>{const r=await fetch('http://127.0.0.1:3001'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const v=await r.json();assert.equal(r.status,200,JSON.stringify(v)+' '+log.slice(-1500));return v;};
const state=()=>db.collection('contactstates').findOne({phoneDigits:phone});
const ack=async()=>{for(const x of requests){for(let i=0;i<30;i++){const m=await db.collection('messages').findOne({providerMessageId:x.id,isFromMe:true});if(m){await post('/api/zapi/webhook/delivery',{messageId:x.id,phone:m.peerPhone,connectedPhone:'553171862958',fromMe:true,type:'DeliveryCallback',status:'READ'});break;}await pause(100);}}};
const ingress=[];
const send=async(text,otherPhone=phone)=>{const id='SIM_IN_'+String(++seq).padStart(5,'0');const payload={messageId:id,phone:otherPhone,connectedPhone:otherPhone==='5515998038637'?'553171862958':'5531971862958',fromMe:false,isGroup:false,status:'RECEIVED',type:'ReceivedCallback',senderName:'Carlos Prueba',text:{message:text}};const receipt=await post('/api/zapi/webhook/received',payload);ingress.push({id,text,phone:otherPhone,receipt});fs.writeFileSync(process.env.SIM_INGRESS,JSON.stringify(ingress,null,2));return payload;};
const wait=async(fn,label,timeout=100000)=>{const end=Date.now()+timeout;while(Date.now()<end){const r=await fn();if(r)return r;if(child.exitCode!==null)throw Error('APP_EXIT '+log.slice(-3500));await pause(200);}throw Error('TIMEOUT '+label+' '+log.slice(-5000));};
const settle=async()=>wait(async()=>{const s=await state();return !s?.metadata?.processingLock?.messageId && s?.vitPowerBurstV228?.status!=='processing';},'settle',15000);
const snapshot=async(label,customer)=>{await ack();const s=await state();const rows=await db.collection('orders').find({'customer.phone':{$in:[phone,'+'+phone]}}).toArray();const drafts=s?.metadata?.customerDraft||{};const memory=s?.metadata?.perAgentMemory?.vit_power_ec?.principalSdrFreeflow||{};
 const sql=spawnSync('python3',['-c',"import sqlite3,json;c=sqlite3.connect('file:/opt/maxlien-mvp/leads_ec.sqlite3?mode=ro',uri=True);c.row_factory=sqlite3.Row;print(json.dumps([dict(r)for r in c.execute('select id,status,name,city,province,product_qty,product_value,event_id from leads')]))"],{encoding:'utf8'});assert.equal(sql.status,0,sql.stderr);
 stages.push({stage:label,customer,simulatedAt:new Date(Date.now()+Number(fs.readFileSync(process.env.SIM_CLOCK,'utf8'))).toISOString(),replies:requests.filter(r=>r.body.phone?.replace(/\D/g,'')===phone).slice(-3).map(r=>r.body.message||r.body.caption||r.path),draft:{name:drafts.name,quantity:drafts.quantity,total:drafts.total,city:drafts.city,province:drafts.province,address:drafts.address,deliveryMode:drafts.deliveryMode,productKey:drafts.productKey},humanMode:s?.human?.mode,orderCount:rows.length,orders:rows.map(o=>({id:o.orderId,status:o.status,total:o.total,quantity:o.package?.quantity,dropiOrderId:o.dropiOrderId||'',confirmedSalePayload:o.confirmedSalePayload})),leads:JSON.parse(sql.stdout),pendingSummary:memory.pendingSummary?.summary||null,registration:memory.registrationAttempt?.status||null});return stages.at(-1);};
const turn=async(label,text)=>{const before=requests.length;await send(text);await wait(async()=>{const s=await state();return s?.vitPowerBurstV228?.status==='pending'||requests.length>before||s?.human?.mode==='manual';},'queued '+label);const s=await state();if(s.vitPowerBurstV228?.status==='pending'){advance(61000);await wait(async()=>{const x=await state();return x?.vitPowerBurstV228?.status==='idle'||x?.human?.mode==='manual';},label);}await pause(600);return snapshot(label,text);};

try{
 await wait(async()=>{try{return(await fetch('http://127.0.0.1:3001/api/health/')).ok;}catch{return false;}},'startup',160000);
 const qa='5515998038637',qaState={phoneDigits:qa,chatId:qa+'@c.us',countryCode:'55',assignedAgent:'vit_power_ec',human:{mode:'manual',pausedUntil:new Date('2036-01-01Z')},tags:['TESTE_8637_PRIORIDADE','TESTE_FIXO_NAO_MEXER','BOT_TESTE_LIBERADO'],metadata:{testOnly:true,botTestEnabled:true,fullFunnelTestEnabled:true,noDropiEver:true,productKey:'vit_power_ec',productName:'Vit Power Ecuador',perAgentMemory:{vit_power_ec:{}}}};
 const permit=createEcQaTestPermitV78({phone:qa,ttlMs:600000});applyEcQaTestResetToStateV78({state:qaState,phone:qa,permit});await db.collection('contactstates').insertOne(qaState);
 const qaEntry='Hola, vengo del video.\nQuiero conocer la oferta disponible de Vit Power.\n¡Me interesa aprovechar la mejor promoción y hacer mi pedido! ¿Me ayudan?\nNombre: Gerson';

 const past=new Date('2026-08-22T21:00:00Z');
 await db.collection('contactstates').updateOne({phoneDigits:qa},{$set:{createdAt:past,firstInboundAt:past}});
 await db.collection('messages').insertOne({_id:'SIM_PAST_QA_OUTBOUND',peerPhone:qa,chatId:qa+'@c.us',sessionId:'zapi',provider:'zapi',ownerPhoneDigits:'5531971862958',providerMessageId:'SIM_PAST_QA_OUTBOUND',isFromMe:true,isBot:true,body:'Historical QA reply fixture preserved.',createdAt:past,updatedAt:past,timestamp:Math.floor(+past/1000)});
 const initialAt=Date.now(),payload=await send(qaEntry,qa),qaRead=()=>db.collection('contactstates').findOne({phoneDigits:qa});
 await wait(async()=>(await qaRead())?.metadata?.qaTestContextV78?.processedMessageIds?.includes(payload.messageId),'existing QA initial accepted',25000);
 check((await db.collection('messages').findOne({_id:payload.messageId})).body===qaEntry,'existing_qa_named_entry_accepted_unchanged');
 await wait(()=>requests.some(x=>x.body.phone?.replace(/\D/g,'')===qa&&x.body.message),'existing QA continuation response',110000);
 const initialReplyElapsedMs=Date.now()-initialAt;
 check(requests.every(x=>!x.body.message?.includes('Te comparto una breve presentación')),'existing_qa_does_not_repeat_initial_presentation');
 check(requests.every(x=>x.path.includes('send-text')),'existing_qa_does_not_repeat_historical_media');
 await ack();const before=requests.length;await post('/api/zapi/webhook/received',payload);await pause(500);check(requests.length===before,'existing_qa_duplicate_entry_no_second_reply');
 await send('Precio',qa);await send('¿Qué contiene Vit Power?',qa);
 await wait(()=>requests.some(x=>x.body.phone?.replace(/\D/g,'')===qa&&x.body.message?.includes('Precio:')&&x.body.message?.includes('Composición')),'existing QA ordered questions',110000);
 const answer=requests.find(x=>x.body.message?.includes('Precio:')&&x.body.message?.includes('Composición')).body.message;
 check(answer.indexOf('Precio:')<answer.indexOf('Composición'),'existing_qa_questions_answered_in_customer_order');
 check(['39.99','95.99','167.99'].every(x=>answer.includes(x)),'existing_qa_official_price_source');
 check(await db.collection('messages').countDocuments({_id:'SIM_PAST_QA_OUTBOUND'})===1,'existing_qa_history_preserved');
 check(await db.collection('orders').countDocuments({'customer.phone':{$in:[qa,'+'+qa]}})===0,'existing_qa_never_creates_order');
 check((await qaRead()).metadata.noDropiEver===true,'existing_qa_no_dropi_flag_preserved');
 const result={project:'VITALISMEN_EC',pass:true,checks,initialReplyElapsedMs,historicalStateFixture:true,oldHistoryDeleted:false,actualHttpApp:true,actualMongoPersistence:true,nativeClock:true,realWhatsAppSends:0,realDropiOrders:0,realMetaEvents:0,productionWrites:0,networkNamespaceIsolated:true};
 fs.writeFileSync(process.env.SIM_RESULT,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}catch(error){fs.writeFileSync(process.env.SIM_RESULT,JSON.stringify({pass:false,error:error.message,checks,log:log.slice(-6000)},null,2)+'\n');throw error;}
finally{child.kill('SIGTERM');await Promise.race([new Promise(r=>child.once('exit',r)),pause(4000).then(()=>child.kill('SIGKILL'))]);await new Promise(r=>provider.close(r));await mongoose.disconnect();}
