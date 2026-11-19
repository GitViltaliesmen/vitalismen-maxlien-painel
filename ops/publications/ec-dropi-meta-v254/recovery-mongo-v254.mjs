import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import fs from 'node:fs';
const B='/opt/vitalismen-automacao/backups/ec-dropi-meta-v254-20261119-r8';
const registration=JSON.parse(fs.readFileSync('/var/lib/vitalismen-deploy/ec-dropi-meta-v254-r8/approval.json'));
const require=createRequire(registration.release+'/package.json'),mongoose=require('mongoose');
const {casV254,historicalPurchasePlanV254,commercialFingerprintV254,existingOrderPatchV254,existingShipmentPatchV254,verifiedReceiptV254}=await import(pathToFileURL(B+'/recovery-core-v254.mjs'));
assert.equal(process.env.MONGODB_URI,'mongodb://127.0.0.1:27354/v254_recovery_fixture');
assert.notEqual(fs.readlinkSync('/proc/self/ns/net'),fs.readlinkSync('/proc/1/ns/net'));
const connection=await mongoose.createConnection(process.env.MONGODB_URI,{autoIndex:false}).asPromise(),db=connection.db,checks=[];
try {
 const orders=db.collection('orders'),shipments=db.collection('shipments'),ledgers=db.collection('metapurchasedeliveriesv254');
 await orders.createIndex({country:1,orderId:1},{unique:true});await ledgers.createIndex({country:1,orderId:1,eventName:1},{unique:true});
 const now=new Date(),order={_id:new mongoose.Types.ObjectId(),orderId:'EC-PRIVATE-RECOVERY-254',country:'EC',status:'shipped',customer:{name:'Carlos Prueba',phone:'+593990000254'},package:{id:1,quantity:1},total:35.99,currency:'USD',confirmedAt:new Date(+now-86400000),tracking:{productKey:'tex_ultra_ec'},updatedAt:new Date(+now-10000)};
 const row={id:9999254,phone:'0990000254',status:'GUIA_GENERADA',sticker:'ORDEN-9999254-GUIA-D002282078.pdf',created_at:new Date(+now-80000000).toISOString(),distribution_company:{name:'GINTRACOM'}},receipt=verifiedReceiptV254({row,order,expectedId:'9999254'});
 const shipment={_id:new mongoose.Types.ObjectId(),country:'EC',orderId:order.orderId,client:order.customer,automation:{guideSentAt:new Date(+now-1000),browserLastError:'old auth failure'},review:{manualOnly:true},logistics:{trackingNumber:receipt.guide},events:[{kind:'old_failure'}],updatedAt:new Date(+now-10000)};
 await orders.insertOne(order);await shipments.insertOne(shipment);
 await casV254(shipments,shipment._id,s=>existingShipmentPatchV254(s,row,receipt));await casV254(orders,order._id,o=>existingOrderPatchV254(o,receipt));
 let after=await orders.findOne({_id:order._id}),sent=await shipments.findOne({_id:shipment._id});assert.equal(after.status,'shipped');assert.equal(after.total,35.99);assert.equal(+after.confirmedAt,+order.confirmedAt);assert.equal(+sent.automation.guideSentAt,+shipment.automation.guideSentAt);assert.equal(sent.automation.browserLastError,'');assert.equal(sent.events[0].kind,'old_failure');checks.push('real_mongo_repair_preserves_price_time_shipping_state_and_notification_lock');
 const accepted={...after,tracking:{...after.tracking,metaPurchaseEventId:after.orderId,metaPurchaseDatasetId:'920532663934291',metaPurchaseSentAt:now,metaPurchaseResponse:{events_received:1,fbtrace_id:'PRIVATE_ACCEPTED_RECEIPT'}}},purchase=historicalPurchasePlanV254(accepted,{pixelId:'920532663934291',route:'country_ec_default'},{now});
 await ledgers.insertOne(purchase.document);await assert.rejects(ledgers.insertOne({...purchase.document}),e=>e.code===11000);assert.equal(await ledgers.countDocuments({orderId:order.orderId}),1);assert.equal((await ledgers.findOne({_id:purchase.document._id})).state,'accepted');checks.push('real_unique_ledger_keeps_accepted_receipt_and_rejects_duplicate_purchase_identity');
 const original=await orders.findOne({_id:order._id}),fingerprint=commercialFingerprintV254(original);await orders.updateOne({_id:order._id},{$set:{total:39.99,updatedAt:new Date(+now+1)}});await assert.rejects(casV254(orders,order._id,o=>{assert.equal(commercialFingerprintV254(o),fingerprint);return existingOrderPatchV254(o,receipt)}));assert.equal((await orders.findOne({_id:order._id})).total,39.99);checks.push('concurrent_commercial_change_refuses_old_recovery_grant');
 await orders.updateOne({_id:order._id},{$set:{fixtureCount:0}});await Promise.all([1,2].map(()=>casV254(orders,order._id,o=>({$set:{fixtureCount:(o.fixtureCount||0)+1,updatedAt:new Date(+o.updatedAt+1)}}))));assert.equal((await orders.findOne({_id:order._id})).fixtureCount,2);checks.push('real_concurrent_cas_reloads_after_lost_match_without_lost_update');
 assert.equal(await orders.countDocuments(),1);assert.equal(await shipments.countDocuments(),1);assert.equal(await ledgers.countDocuments(),1);checks.push('repeat_recovery_does_not_create_extra_orders_shipments_or_ledger');
 console.log(JSON.stringify({project:'VITALISMEN_EC',pass:true,checks,privateMongo:true,networkIsolated:true,actualProviderCalls:0,productionWrites:0,physicalMessages:0,candidateCommit:registration.commit}));
} finally {await connection.close()}
