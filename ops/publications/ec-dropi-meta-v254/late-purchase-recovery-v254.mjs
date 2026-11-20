// Bounded native confirmations written by the predecessor during publication.
// This program only persists an Order intention; it has no provider or WhatsApp client.
import fs from'node:fs';import assert from'node:assert/strict';import os from'node:os';import{createHash}from'node:crypto';import{createRequire}from'node:module';import{fileURLToPath}from'node:url';
import{latePurchaseGrantV254}from'./late-purchase-core-v254.mjs';import{commercialFingerprintV254,casV254}from'./recovery-core-v254-r2.mjs';
const B='/opt/vitalismen-automacao/backups/ec-dropi-meta-v254-20261119-r8',S='/var/lib/vitalismen-deploy/ec-dropi-meta-v254-r8',sha=b=>createHash('sha256').update(b).digest('hex'),read=p=>JSON.parse(fs.readFileSync(p));
function regular(p){const st=fs.lstatSync(p);assert(st.isFile()&&!st.isSymbolicLink()&&st.uid===0&&st.nlink===1&&(st.mode&0o777)===0o400);return fs.readFileSync(p)}
function create(p,obj){const fd=fs.openSync(p,'wx',0o400);try{fs.writeFileSync(fd,JSON.stringify(obj,null,2)+'\n');fs.fsyncSync(fd)}finally{fs.closeSync(fd)}}
assert.equal(process.getuid(),0);assert.equal(os.hostname(),'srv1182009');assert.equal(fileURLToPath(import.meta.url),B+'/late-purchase-recovery-v254.mjs');const mode=process.argv[2];assert(['prepare','apply','verify'].includes(mode));
const a=read(S+'/approval.json'),active=read(S+'/activation.json'),binding=read(B+'/BINDINGS.json'),scope=read(B+'/LATE_PURCHASE_SCOPE.json');assert.equal(fs.realpathSync('/opt/vitalismen-automacao/current'),a.release);assert.equal(a.commit,'05f23b13cd89385a3cfdbdaf6c27d58f17384516');assert.equal(active.state,'ACTIVE');assert.equal(active.orderIntegrationV254Allowed,true);
for(const n of ['late-purchase-recovery-v254.mjs','late-purchase-core-v254.mjs','late-purchase-core-v254.test.mjs','LATE_PURCHASE_SCOPE.json','LATE_PURCHASE_TEST.json'])assert.equal(sha(regular(B+'/'+n)),binding.operationalFiles[n]);assert.equal(scope.commit,a.commit);assert.equal(scope.country,'EC');assert.equal(scope.maxPurchases,40);assert.equal(read(B+'/LATE_PURCHASE_TEST.json').pass,true);
const require=createRequire(a.release+'/package.json'),mongoose=require('mongoose');require('dotenv').config({path:a.release+'/.env',quiet:true});const c=await mongoose.createConnection(process.env.MONGODB_URI,{autoIndex:false,serverSelectionTimeoutMS:8000}).asPromise();
try{
 const orders=c.db.collection('orders'),ledgers=c.db.collection('metapurchasedeliveriesv254'),primary=read(B+'/RECOVERY_PLAN.json'),policy={startAt:scope.startAt,endAt:active.orderIntegrationV254ActivatedAt,excludedOrderIds:primary.cases.map(x=>x.case.orderId)};
 assert(+new Date(policy.endAt)>+new Date(policy.startAt));assert(+new Date(policy.endAt)-+new Date(policy.startAt)<4*3600000);
 if(mode==='prepare'){
  const rows=await orders.find({country:'EC',source:'manual',integration:null,status:{$in:['confirmed','processing','shipped','delivered']},confirmedAt:{$gte:new Date(policy.startAt),$lt:new Date(policy.endAt)},'customer.phone':/^\+?5939\d{8}$/,currency:'USD',total:{$gt:0},'tracking.productKey':{$in:['tex_ultra_ec','vit_power_ec','nitrix_ec']},'package.quantity':{$in:[1,2,3,6]},orderId:{$nin:policy.excludedOrderIds}}).toArray();assert(rows.length<=scope.maxPurchases);const grants=[];
  for(const order of rows){const grant=latePurchaseGrantV254(order,policy);if(grant)grants.push({...grant,case:{orderId:order.orderId,providerId:String(order.dropiOrderId||''),metaOnly:true,late:true}})}
  create(B+'/LATE_PURCHASE_PLAN.json',{project:'VITALISMEN_EC',commit:a.commit,createdAt:new Date(),scopeSha256:sha(regular(B+'/LATE_PURCHASE_SCOPE.json')),policy,grants});console.log(JSON.stringify({project:'VITALISMEN_EC',pass:true,mode,grants:grants.map(x=>({orderId:x.orderId,originalConfirmedAt:x.originalConfirmedAt})),productionWrites:0,providerCreates:0}));
 }else{
  const bytes=regular(B+'/LATE_PURCHASE_PLAN.json'),plan=JSON.parse(bytes);assert.equal(plan.commit,a.commit);assert.equal(plan.scopeSha256,sha(regular(B+'/LATE_PURCHASE_SCOPE.json')));assert.equal(plan.policy.endAt,active.orderIntegrationV254ActivatedAt);const results=[];
  if(mode==='apply'){const proof=read(B+'/CUTOVER_DATA_RECOVERY_BEFORE.json');assert.equal(proof.pass,true);assert.equal(proof.candidateCommit,a.commit);assert.equal(proof.latePlanSha256,sha(bytes));assert(Date.now()-Date.parse(plan.createdAt)<20*60000);}
  for(const grant of plan.grants){const order=await orders.findOne({_id:new mongoose.Types.ObjectId(grant.orderObjectId),country:'EC',orderId:grant.orderId});assert(order);assert.equal(commercialFingerprintV254(order),grant.fingerprint);
   if(mode==='apply')await casV254(orders,order._id,o=>{assert.equal(commercialFingerprintV254(o),grant.fingerprint);assert(['confirmed','processing','shipped','delivered'].includes(o.status));return o.purchaseDeliveryV254?.requestedAt?null:{$set:{purchaseDeliveryV254:grant.intent,updatedAt:new Date()}}});
   const ledger=await ledgers.findOne({_id:grant.ledgerId});if(mode==='verify'){assert.equal(ledger?.state,'accepted',ledger?.lastError);assert(Number(ledger.response?.events_received)>0);assert.equal(ledger.eventId,grant.eventId);assert.equal(ledger.datasetId,grant.datasetId);assert.equal(+new Date(ledger.occurredAt),+new Date(grant.originalConfirmedAt));}
   results.push({orderId:grant.orderId,originalConfirmedAt:grant.originalConfirmedAt,state:ledger?.state||'pending'});
  }
  const out={project:'VITALISMEN_EC',pass:true,mode,results,providerCreates:0,physicalMessages:0,latePlanSha256:sha(bytes)};if(mode==='apply')create(B+'/LATE_PURCHASE_RECOVERY.json',out);console.log(JSON.stringify(out));
 }
}finally{await c.close()}
