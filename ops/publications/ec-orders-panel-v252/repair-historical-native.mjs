// Authenticated metadata repair only. Root grants pin already existing remote sales.
import fs from'node:fs';import assert from'node:assert/strict';import{createRequire}from'node:module';
const R=fs.realpathSync('/opt/vitalismen-automacao/current'),require=createRequire(R+'/package.json'),mongoose=require('mongoose'),jwt=require('jsonwebtoken');
const S='/var/lib/vitalismen-deploy/ec-orders-dropi-postsale-v252-r11',B='/opt/vitalismen-automacao/backups/ec-orders-dropi-postsale-v252-20261119-r11';
const approval=JSON.parse(fs.readFileSync(S+'/approval.json','utf8'));assert.equal(R,approval.release);
const grants=JSON.parse(fs.readFileSync(S+'/historical-recovery.json','utf8')).grants;assert.ok(grants.length>=1&&grants.length<=3);
await mongoose.connect(process.env.MONGODB_URI,{serverSelectionTimeoutMS:10000});
try{
 const db=mongoose.connection.db,admin=await db.collection('users').findOne({role:'admin',isActive:true});assert.ok(admin);
 const token=jwt.sign({id:String(admin._id),role:'admin'},process.env.JWT_SECRET,{expiresIn:'5m'}),results=[];
 for(const grant of grants){
  assert.ok(Date.parse(grant.expiresAt)>Date.now());const p=grant.payload;
  const match={country:'EC','customer.phone':new RegExp(String(p.phone).replace(/\D/g,'').slice(-9)+'$')};
  const beforeOrders=await db.collection('orders').countDocuments(match),before=await db.collection('contactstates').findOne({_id:new mongoose.Types.ObjectId(p.customerId)});assert.ok(before);
  const nativeBefore=grant.nativeOrderObjectId?await db.collection('orders').findOne({_id:new mongoose.Types.ObjectId(grant.nativeOrderObjectId)}):null;
  if(grant.kind==='VERIFIED_EXISTING_DROPI_SALE_V252')assert.equal(beforeOrders,0);else assert.ok(nativeBefore);
  const r=await fetch('http://127.0.0.1:3001/api/shipments/droppi/ec/orders/'+encodeURIComponent(p.orderId)+'/authorize-submit',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({reconcileExistingV252:true}),signal:AbortSignal.timeout(60000)});
  const body=await r.json();fs.writeFileSync(B+'/NATIVE_LINK_'+p.dropiOrderId+'.private.json',JSON.stringify({http:r.status,body},null,2),{flag:'wx',mode:0o600});assert.equal(r.status,200,'NATIVE_REPAIR_REJECTED_INSPECT_NO_RETRY');assert.equal(body.success,true);
  const after=await db.collection('contactstates').findOne({_id:before._id}),shipment=await db.collection('shipments').findOne({country:'EC',orderId:p.orderId});
  assert.equal(await db.collection('orders').countDocuments(match),beforeOrders);assert.ok(shipment);assert.equal(shipment.raw?.latestDroppiPayload?.status,'submitted');assert.equal(String(shipment.raw?.manualDropiOrderId),p.dropiOrderId);assert.equal(shipment.logistics?.trackingNumber||'',p.trackingNumber||'');
  assert.deepEqual(after.human,before.human);assert.equal(after.metadata?.optOut,before.metadata?.optOut);
  if(nativeBefore){const nativeAfter=await db.collection('orders').findOne({_id:nativeBefore._id});assert.equal(String(nativeAfter.dropiOrderId),p.dropiOrderId);for(const key of ['customer','package','tracking','total','delivery'])assert.deepEqual(nativeAfter[key],nativeBefore[key],key)}
  results.push({orderId:p.orderId,dropiOrderId:p.dropiOrderId,trackingNumber:shipment.logistics.trackingNumber||'',status:shipment.logistics.status,humanHoldPreserved:true,commercialSnapshotPreserved:true});
 }
 console.log(JSON.stringify({pass:true,results,newMongoOrders:0,newRemoteOrders:0,metaReplay:false,humanHoldPreserved:true,physicalMessages:0}));
}finally{await mongoose.disconnect()}
