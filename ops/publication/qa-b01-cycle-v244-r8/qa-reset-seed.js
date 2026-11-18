const d=connect(process.env.VITALISMEN_QA_ADMIN_URI);d.dropDatabase();
const p='5515998038637',id=ObjectId('6a845eeda38e30281976b2be');
const contact={_id:id,phoneDigits:p,chatId:p+'@c.us',createdAt:new Date(1),updatedAt:new Date(2),human:{mode:'manual'},tags:['TESTE_8637_PRIORIDADE','TESTE_FIXO_NAO_MEXER','BOT_TESTE_LIBERADO'],conversationBucket:{value:'attendance'},
metadata:{testOnly:true,botTestEnabled:true,fullFunnelTestEnabled:true,noDropiEver:true,priorityFrozenReason:'TEST',productKey:'vit_power_ec',productName:'Vit Power Ecuador',vslProductKey:'vit_power_ec',vslProductName:'Vit Power Ecuador',customerDraft:{productKey:'vit_power_ec'},processedInboundMessageIds:['OLD_PROCESSED'],qaTestContextV78:{permitId:'ecqa-v78-'+'a'.repeat(32),status:'contained',expiresAt:new Date(Date.now()-10000)}},
vitPowerB01:{status:'ambiguous',reason:'attempt_already_reserved',cursor:0,steps:Array.from({length:5},()=>({status:'pending'}))}};
if(CASE==='attempted')contact.vitPowerB01.steps[0].attemptedAt=new Date();
if(CASE==='provider_ambiguous')contact.vitPowerB01.reason='provider_result_unconfirmed';
if(CASE==='pending')contact.vitPowerB01.status='pending';
if(CASE==='human_auto')contact.human.mode='auto';
d.contactstates.insertOne(contact);
d.contactstates.insertOne({_id:ObjectId('6a845eeda38e30281976b2bf'),phoneDigits:'593999000001',marker:'UNRELATED_KEEP'});
d.messages.insertMany([{_id:'QA_MESSAGE',peerPhone:p,sessionId:'zapi',provider:'zapi',ownerPhoneDigits:'5531971862958',isFromMe:false,body:'SYNTHETIC_QA_ONLY'},{_id:'OTHER_MESSAGE',peerPhone:'593999000001',sessionId:'zapi',provider:'zapi',body:'UNRELATED_KEEP'}]);
for(let i=0;i<5;i++)d.outbounddedupes.insertOne({key:'b01-v216:LEGACY_'+i,phoneDigits:p,status:CASE==='uncertain_old_ledger'&&i===0?'reserved':'sent',providerMessageId:'SYNTHETIC_RECEIPT_'+i});
const scope={peerPhone:p,sessionId:'zapi',provider:'zapi',$or:[{ownerPhoneDigits:{$in:['','5531971862958']}},{ownerPhoneDigits:{$exists:false}},{ownerPhoneDigits:null}]};
const packet={project:'VITALISMEN_EC',kind:'EXACT_QA_8637_BEFORE_USER_AUTHORIZED_FRESH_START',contact:d.contactstates.findOne({_id:id}),scope,messages:d.messages.find(scope).sort({_id:1}).toArray(),ledgers:d.outbounddedupes.find({phoneDigits:p}).sort({_id:1}).toArray(),counts:{scopedMessages:1,b01Ledgers:5,qaLedgers:5,qaMessages:1}};
if(CASE==='concurrent_change')d.contactstates.updateOne({_id:id},{$set:{updatedAt:new Date(3)}});
const baseline={contacts:d.contactstates.find().sort({_id:1}).toArray(),messages:d.messages.find().sort({_id:1}).toArray(),ledgers:d.outbounddedupes.find().sort({_id:1}).toArray()};
print(JSON.stringify({packet:EJSON.stringify(packet,{relaxed:false}),baseline:EJSON.stringify(baseline,{relaxed:false})}));
