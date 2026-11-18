
const packet=EJSON.parse(__PACKET__),d=connect(process.env.VITALISMEN_QA_ADMIN_URI),p='5515998038637',apply=__APPLY__;
const canonical=x=>EJSON.stringify(x,{relaxed:false}),check=(ok,reason)=>{if(!ok)throw Error(reason)};
check(packet.project==='VITALISMEN_EC'&&packet.kind==='EXACT_QA_8637_BEFORE_USER_AUTHORIZED_FRESH_START','ARCHIVE_PROJECT');
const original=packet.contact,live=d.contactstates.findOne({_id:original._id,phoneDigits:p});
check(String(original._id)==='6a845eeda38e30281976b2be'&&live&&canonical(live)===canonical(original),'CONTACT_CHANGED_ABORT');
check(live.human.mode==='manual'&&['contained','consumed'].includes(live.metadata.qaTestContextV78.status)&&+new Date(live.metadata.qaTestContextV78.expiresAt)<Date.now(),'QA_MUST_STAY_CONTAINED');
check(d.contactstates.countDocuments({phoneDigits:p})===1,'EXACT_ONE_QA');
check(packet.messages.length===Number(packet.counts.scopedMessages),'ARCHIVE_MESSAGE_COUNT');
check(canonical(d.messages.find(packet.scope).sort({_id:1}).toArray())===canonical(packet.messages),'MESSAGES_CHANGED_ABORT');
check(d.orders.countDocuments({'customer.phone':{$in:[p,'+'+p]}})===0,'NO_ORDERS_ALLOWED');
const oldB01=d.outbounddedupes.find({phoneDigits:p,key:/^b01-v216:/}).toArray();
check(oldB01.length===Number(packet.counts.b01Ledgers)&&oldB01.length===5&&oldB01.every(x=>x.status==='sent'&&x.providerMessageId)&&live.vitPowerB01?.status==='ambiguous'&&live.vitPowerB01.reason==='attempt_already_reserved'&&live.vitPowerB01.cursor===0&&live.vitPowerB01.steps.length===5&&live.vitPowerB01.steps.every(x=>x.status==='pending'&&!x.attemptedAt&&!x.ledgerKey&&!x.providerMessageId),'NO_PENDING_OR_UNCERTAIN_B01_ALLOWED');
check(canonical(d.outbounddedupes.find({phoneDigits:p}).sort({_id:1}).toArray())===canonical(packet.ledgers),'EXACT_QA_LEDGER_SNAPSHOT_REQUIRED');
check(d.outbounddedupes.countDocuments({phoneDigits:p})===Number(packet.counts.qaLedgers),'LEDGER_CHANGED_ABORT');
const fresh=EJSON.parse(canonical(original)),m=original.metadata,now=new Date();
fresh.assignedAgent='vit_power_ec';
fresh.firstInboundText='';fresh.firstInboundAt=null;fresh.lastInboundText='';fresh.lastInboundAt=null;fresh.lastOutboundAt=null;
fresh.metadata={testOnly:true,outboundTestOnly:true,botTestEnabled:true,fullFunnelTestEnabled:true,noDropiEver:true,
 priorityFrozen:true,priorityFrozenReason:m.priorityFrozenReason,operationalPanelPhone:m.operationalPanelPhone,
 productKey:'vit_power_ec',productName:m.productName,vslProductKey:'vit_power_ec',vslProductName:m.vslProductName,
 productRouteLock:m.productRouteLock,customerDraft:{productKey:'vit_power_ec',productName:m.productName},perAgentMemory:{},
 processedInboundMessageIds:[...new Set([...(m.processedInboundMessageIds||[]),...packet.messages.filter(x=>x.isFromMe===false).map(x=>String(x._id))])],
 qaTestContextV78:m.qaTestContextV78,cleanTestResetAt:now,testPhoneResetAt:now,
 cleanTestResetReason:'USER_20261117_ZERE_PARA_TESTE_COMPLETO_B01_V244',qaFreshResetArchive:__ARCHIVE__};
fresh.metadata=EJSON.parse(canonical(fresh.metadata));
for(const key of ['vitPowerB01','vitPowerBurstV228','buyLaterReminder','customerDataResolution','engagementAutomation','stage','quantity','total','buyer_score'])delete fresh[key];
fresh.agentHistory=[];fresh.productHistory=[];fresh.updatedAt=now;
check(fresh.human.mode==='manual','NO_UNBOUNDED_RELEASE');
check(['TESTE_8637_PRIORIDADE','TESTE_FIXO_NAO_MEXER','BOT_TESTE_LIBERADO'].every(t=>fresh.tags.includes(t)),'PERMANENT_QA_TAGS');
check(fresh.conversationBucket?.value==='attendance','ATTENDANCE_BUCKET_REQUIRED');
for(const key of ['testOnly','botTestEnabled','fullFunnelTestEnabled','noDropiEver'])check(fresh.metadata[key]===true,'QA_PROTECTION');
check(canonical(fresh._id)===canonical(original._id)&&fresh.chatId===original.chatId&&fresh.phoneDigits===p,'IDENTITY_MUST_REMAIN');
if(apply){
 let replaced=false;
 try{
  const removed=d.messages.deleteMany({...packet.scope,_id:{$in:packet.messages.map(x=>x._id)}},{writeConcern:{w:'majority',j:true,wtimeout:5000}});
  check(removed.deletedCount===packet.messages.length,'DELETE_COUNT');
  const changed=d.contactstates.replaceOne({_id:original._id,phoneDigits:p,updatedAt:original.updatedAt,'human.mode':'manual','metadata.testOnly':true},fresh,{writeConcern:{w:'majority',j:true,wtimeout:5000}});
  check(changed.modifiedCount===1,'CONTACT_COMPARE_FAILED');replaced=true;
  const after=d.contactstates.findOne({_id:original._id,phoneDigits:p});
  check(canonical(after)===canonical(fresh),'FRESH_STATE_VERIFICATION');
  check(d.messages.countDocuments(packet.scope)===0,'OFFICIAL_QA_MESSAGES_NOT_EMPTY');
  check(d.outbounddedupes.countDocuments({phoneDigits:p})===Number(packet.counts.qaLedgers)&&canonical(d.outbounddedupes.find({phoneDigits:p}).sort({_id:1}).toArray())===canonical(packet.ledgers),'ALL_OLD_LEDGERS_MUST_REMAIN_UNCHANGED');
  check(d.orders.countDocuments({'customer.phone':{$in:[p,'+'+p]}})===0,'QA_ORDER_FORBIDDEN');
 }catch(error){
  // Restore only archived IDs that are still absent; never overwrite new incoming messages.
  for(const message of packet.messages)d.messages.updateOne({_id:message._id},{$setOnInsert:message},{upsert:true,writeConcern:{w:'majority',j:true,wtimeout:5000}});
  if(replaced)d.contactstates.replaceOne({_id:original._id,phoneDigits:p,'metadata.qaFreshResetArchive':__ARCHIVE__,'human.mode':'manual',updatedAt:now},original,{writeConcern:{w:'majority',j:true,wtimeout:5000}});
  throw error;
 }
}
print(JSON.stringify({project:'VITALISMEN_EC',pass:true,mode:apply?'APPLIED':'DRY_RUN',qaSuffix:'8637',resetArchive:__ARCHIVE__,
 archivedOfficialQaMessages:packet.messages.length,remainingOtherSessionMessages:Number(packet.counts.qaMessages)-packet.messages.length,
 sameContactId:true,permanentQaIdentityPreserved:true,noDropiEver:true,qaLedgersPreserved:Number(packet.counts.qaLedgers),
 legacyConversationMemoryCleared:true,initialInboundEmpty:true,b01AttemptsBefore:Number(packet.counts.b01Ledgers),allOldLedgersByteEquivalent:true,modeAfter:'manual',qaWindowOpened:false,
 customerMessagesSent:0,ordersCreated:0,productionCodeChanged:false,applicationGuardsChanged:false,otherContactsTargeted:0,globalMongoBackupPass:false}));
