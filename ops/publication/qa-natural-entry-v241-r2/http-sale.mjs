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

 // Exact QA identity and native finite permit, stored only in disposable MongoDB.
 const qa='5515998038637',qaState={phoneDigits:qa,chatId:qa+'@c.us',countryCode:'55',assignedAgent:'vit_power_ec',human:{mode:'manual',pausedUntil:new Date('2036-01-01Z')},tags:['TESTE_8637_PRIORIDADE','TESTE_FIXO_NAO_MEXER','BOT_TESTE_LIBERADO'],metadata:{testOnly:true,botTestEnabled:true,fullFunnelTestEnabled:true,noDropiEver:true,productKey:'vit_power_ec',productName:'Vit Power Ecuador',perAgentMemory:{vit_power_ec:{}}}};
 const permit=createEcQaTestPermitV78({phone:qa,ttlMs:600000});applyEcQaTestResetToStateV78({state:qaState,phone:qa,permit});await db.collection('contactstates').insertOne(qaState);
 const qaEntry='Hola, vengo del video.\nQuiero conocer la oferta disponible de Vit Power.\n¡Me interesa aprovechar la mejor promoción y hacer mi pedido! ¿Me ayudan?\nNombre: Gerson';
 const qaStart=Date.now(),qaPayload=await send(qaEntry,qa);
 const qaRead=()=>db.collection('contactstates').findOne({phoneDigits:qa});
 await wait(async()=> (await qaRead())?.metadata?.qaTestContextV78?.processedMessageIds?.includes(qaPayload.messageId),'QA named entry accepted',25000);
 check((await db.collection('messages').findOne({_id:qaPayload.messageId})).body===qaEntry,'qa_named_entry_persisted_and_accepted');
 await wait(()=>requests.some(x=>x.body.phone?.replace(/\D/g,'')===qa&&x.body.message?.includes('Ana Lopez')),'QA initial greeting',40000);
 const qaGreetMs=Date.now()-qaStart;check(qaGreetMs>=4500&&qaGreetMs<=33000,'qa_named_entry_greeting_5_to_30_seconds');
 const qaGreeting=requests.find(x=>x.body.phone?.replace(/\D/g,'')===qa&&x.body.message?.includes('Ana Lopez'));
 check(qaGreeting.body.message.includes('Gerson'),'qa_optional_name_personalizes_greeting');await ack();
 const beforeDuplicate=requests.filter(x=>x.body.phone?.replace(/\D/g,'')===qa&&x.body.message?.includes('Ana Lopez')).length;
 await post('/api/zapi/webhook/received',qaPayload);await pause(600);
 check(requests.filter(x=>x.body.phone?.replace(/\D/g,'')===qa&&x.body.message?.includes('Ana Lopez')).length===beforeDuplicate,'qa_duplicate_entry_no_second_greeting');
 const qaPrice=await send('Precio',qa),qaIngredients=await send('¿Qué contiene Vit Power?',qa);
 await wait(async()=> (await qaRead())?.vitPowerBurstV228?.pendingIds?.includes(qaIngredients.messageId),'QA question batch');
 await wait(()=>requests.some(x=>x.body.phone?.replace(/\D/g,'')===qa&&x.body.message?.includes('Precio:')&&x.body.message?.includes('Composición')),'QA combined response',110000);
 const qaReply=requests.find(x=>x.body.phone?.replace(/\D/g,'')===qa&&x.body.message?.includes('Precio:')&&x.body.message?.includes('Composición'));
 check(['39.99','95.99','167.99'].every(p=>qaReply.body.message.includes(p))&&qaReply.body.message.indexOf('Precio:')<qaReply.body.message.indexOf('Composición'),'qa_price_and_ingredients_one_ordered_reply');
 check(requests.filter(x=>x.body.phone?.replace(/\D/g,'')===qa&&x.body.message?.includes('Precio:')&&x.body.message?.includes('Composición')).length===1,'qa_one_composed_answer');
 check(await db.collection('orders').countDocuments({'customer.phone':qa})===0,'qa_no_order_after_questions');
 await ack();await wait(async()=> (await qaRead())?.vitPowerB01?.status==='interrupted','QA new questions supersede presentation',15000);
 const qaJob=(await qaRead()).vitPowerB01;
 check(qaJob.cursor===1&&qaJob.steps[0].status==='accepted'&&qaJob.steps.slice(1).every(x=>x.status==='pending'),'qa_questions_do_not_force_or_repeat_b01_media');
 check(+new Date((await qaRead()).metadata.qaTestContextV78.expiresAt)>Date.now(),'qa_window_still_valid_after_grouped_response');
 // Start the independent Ecuador sale regression after the QA batch is settled.
 requests.length=0;

 const entry='Hola, vengo del video.\nQuiero conocer la oferta disponible de Vit Power.\n¡Me interesa aprovechar la mejor promoción y hacer mi pedido! ¿Me ayudan?\nNombre: Carlos Prueba';
 const start=Date.now();const lead=await send(entry);await wait(()=>requests.length,'greeting');const greetMs=Date.now()-start;await ack();
 check(greetMs>=4500&&greetMs<=33000,'initial_greeting_scheduled_5_to_30_seconds_with_worker_tolerance');check(requests[0].body.message.includes('Ana Lopez'),'greeting_persona');check(!requests[0].body.message.includes('Nitrix'),'no_foreign_product_greeting');
 await post('/api/zapi/webhook/received',lead);await pause(500);check(requests.length===1,'duplicate_entry_does_not_repeat_greeting');
 let s=await state();check(s.metadata.customerDraft.productKey==='vit_power_ec'&&s.metadata.vslProductKey==='vit_power_ec','automatic_product_and_vsl_origin_preserved');await snapshot('entrada_e_saudacao',entry);
 await wait(async()=> (await state())?.vitPowerB01?.status==='done','B01 complete',220000);check((await state()).vitPowerB01.steps.every(x=>x.status==='accepted'),'B01_completes_with_original_pauses_and_bottle');
 await send('¿Cuánto cuestan 3 frascos?');await pause(300);await send('¿Qué contiene Vit Power?');await wait(async()=> (await state())?.vitPowerBurstV228?.pendingIds?.length===2,'two questions queued');advance(61000);await wait(async()=> (await state())?.vitPowerBurstV228?.status==='idle','grouped answer');
 const grouped=requests.at(-1).body.message;check(grouped.includes('95.99')&&grouped.indexOf('Precio')<grouped.indexOf('Composici'),'questions_answered_price_then_ingredients');await snapshot('perguntas_fora_do_roteiro','Preço de 3 frascos, depois composição');
 await turn('precos_sem_interrogacao','Porfavor me indicas la promoci\u00f3n..\nLos precios..');const prices=requests.at(-1).body.message;check(prices.includes('39.99')&&prices.includes('95.99')&&prices.includes('167.99')&&!/cu[a\u00e1]ntos/i.test(prices),'unpunctuated_prices_answered_without_repeat_quantity');check((await state()).human.mode==='auto','price_request_keeps_automatic_attendance');
 await turn('quantidade_e_cidade','Quiero 3 frascos. Estoy en Quito.');s=await state();check(s.metadata.customerDraft.quantity===3&&s.metadata.customerDraft.city==='Quito','quantity_city_saved');check(s.metadata.customerDraft.total===95.99,'official_price_3_bottles');
 let snap;
 await turn('nome_e_entrega','Me llamo Carlos Prueba. Entrega a domicilio.');s=await state();check(s.metadata.customerDraft.name==='Carlos Prueba'&&s.metadata.customerDraft.deliveryMode==='home','name_and_home_delivery_saved');
 snap=await turn('dados_completos_e_resumo','La provincia es Pichincha. Dirección: Avenida Simulada 123. Referencia: junto al parque.');check(snap.orderCount===0,'summary_is_not_a_sale');check(snap.pendingSummary?.includes('95.99')&&snap.pendingSummary.includes('Avenida Simulada 123'),'validated_summary_with_correct_price_address');
 snap=await turn('correcao_preserva_dados','La dirección correcta es Avenida Simulada 456.');check(snap.pendingSummary?.includes('Avenida Simulada 456'),'new_summary_after_address_correction');check(snap.draft.quantity===3&&snap.draft.city==='Quito','correction_preserves_quantity_city');
 const confirmation=await send('Sí, confirmo');await wait(async()=> (await state())?.vitPowerBurstV228?.status==='pending','final confirmation queued');advance(61000);await wait(async()=> (await db.collection('orders').findOne({'customer.phone':{$in:[phone,'+'+phone]},status:'confirmed'})),'confirmed order');await wait(async()=> (await state())?.metadata?.perAgentMemory?.vit_power_ec?.lastFunnelStage==='order_closed','finalizer completed',90000);
 snap=await snapshot('venda_confirmada','Sí, confirmo');check(snap.orderCount===1,'exactly_one_confirmed_order');check(snap.registration==='registered','conversational_receipt_verified');check(requests.some(x=>/Gracias por confirmar sus datos/i.test(x.body.message||'')),'thank_you_only_after_confirmed_order');check(snap.orders[0].status==='confirmed'&&snap.orders[0].quantity===3&&snap.orders[0].total===95.99,'sale_marked_confirmed_3_bottles_usd_95_99');check(snap.leads.length===1&&snap.leads[0].status==='confirmado','lead_panel_mirror_confirmado');check(!snap.orders[0].dropiOrderId,'no_dropi_submission_without_manual_authorization');
 await post('/api/zapi/webhook/received',confirmation);await send('Sí, confirmo');await pause(1800);check(await db.collection('orders').countDocuments({'customer.phone':{$in:[phone,'+'+phone]}})===1,'repeated_confirmation_does_not_duplicate_sale');await snapshot('confirmacao_repetida_sem_duplicar','Sí, confirmo repetido');
 check(await db.collection('orders').countDocuments({'customer.phone':'5515998038637'})===0,'permanent_qa_never_creates_order');
 const meta=await db.collection('vitpower_measurement_v213').countDocuments();check(meta===0,'unattributed_simulation_does_not_invent_meta_purchase');
 const negativePhone='593980000072';await send(entry,negativePhone);await send('Confirmo',negativePhone);await pause(600);
 const negativeState=await db.collection('contactstates').findOne({phoneDigits:negativePhone}),negativeOrderCount=await db.collection('orders').countDocuments({'customer.phone':negativePhone});check(negativeOrderCount===0,'early_confirmation_separate_contact_cannot_create_sale');
 const negative={phone:negativePhone,orderCount:negativeOrderCount,bucket:negativeState?.conversationBucket,routeToBot:ingress.at(-1)?.receipt?.result?.routeToBot,receipt:ingress.at(-1)?.receipt};
 const result={pass:true,project:'VITALISMEN_EC',functionalCommit:'135d17cc75d71b7401c7f1e9400759e913ad867b',release:R,checks,stages,ingress,negative,greetingRealElapsedMs:greetMs,quietWindowSeconds:60,nativeClock:true,actualHttpApp:true,actualMongoPersistence:true,actualSqliteMirror:true,model:'SCRIPTED_TOOL_CALLS_SIMULATION',transport:'LOCAL_PROVIDER_NO_EXTERNAL_NETWORK',networkNamespaceIsolated:true,realWhatsAppSends:0,realDropiOrders:0,realMetaEvents:0,productionWrites:0,localProviderRequests:requests.length,localOrderCount:1};
 fs.writeFileSync(process.env.SIM_RESULT,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({pass:true,checks:checks.length,stages:stages.length,greetingRealElapsedMs:greetMs,orderStatus:'confirmed',panelStatus:'confirmado',quantity:3,total:95.99,realExternalActions:0}));
}catch(error){const diagnostic=await state();fs.writeFileSync(process.env.SIM_RESULT,JSON.stringify({pass:false,error:error.message,checks,stages,ingress,contactDiagnostic:diagnostic,providerRequests:requests,log:log.slice(-8000)},null,2)+'\n');throw error;}
finally{child.kill('SIGTERM');await Promise.race([new Promise(r=>child.once('exit',r)),pause(4000).then(()=>child.kill('SIGKILL'))]);await new Promise(r=>provider.close(r));await mongoose.disconnect();}
