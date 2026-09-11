import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import mongoose from 'mongoose';
import axios from 'axios';
import { buildEcBotCoreV78OverlayEnvironment, EC_BOT_CORE_V78_DATASET_ID } from '../src/services/ecBotCoreOperationalV78Service.js';
import { ecBotCoreMutationRouteGuardV78, installEcBotCoreMongooseGuardV78 } from '../src/services/ecBotCoreRuntimeIntegrationV78Service.js';
import { recordTexUltraCheckoutV148 } from '../src/services/metaCheckoutV148Service.js';
import { protocoloGStructuredTracking } from '../src/services/metaProtocoloGAttributionService.js';
import { metaAttributionTrackingFromVisit } from '../src/services/metaAttributionService.js';
const root=fs.realpathSync(process.cwd());
assert.equal(process.platform,'linux');
assert.match(root,/^\/opt\/vitalismen-automacao\/releases\/[^/]+$/);
assert.notEqual(root,fs.realpathSync('/opt/vitalismen-automacao/current'));
const source=JSON.parse(fs.readFileSync('.release-source.json'));
assert.notEqual(source.commit,'f7927a9a8720d64f3c8ba5f02dcd290f2774f08f');
assert.equal(fs.existsSync('.activation-complete.json'),false);
axios.post=async()=>{throw new Error('V148_SINK_FORBIDS_EXTERNAL_POST');};
const worker=process.argv[2]==='worker';
const dbName=worker?process.argv[3]:`v148_sink_${source.commit.slice(0,7)}_${Date.now()}`;
assert.match(dbName,/^v148_sink_[a-f0-9]{7}_\d+$/);
const activationAt=worker?new Date(process.argv[4]):new Date(Date.now()-60000);
await mongoose.connect(process.env.MONGODB_URI,{dbName,autoIndex:false});
const db=mongoose.connection.db;
if(worker){
 Object.assign(process.env,buildEcBotCoreV78OverlayEnvironment({baseEnv:{META_PIXEL_ID_EC:EC_BOT_CORE_V78_DATASET_ID}}));
 installEcBotCoreMongooseGuardV78(mongoose);
 let calls=0;
 const state=await db.collection('contactstates').findOne({sinkFixtureV148:true});
 const result=await ecBotCoreMutationRouteGuardV78({method:'POST',originalUrl:'/api/zapi/webhook/received',body:{}},
  {status(){return this;},json(){throw new Error('V148_SINK_CONTEXT_BLOCKED');}},()=>recordTexUltraCheckoutV148({
   contactStateId:String(state._id),sourceMessageId:'V148_SINK_MESSAGE',quantity:3,activationAt,
   sendEvent:async event=>{calls++;assert.equal(event.eventName,'InitiateCheckout');assert.equal(event.ad_id,'A_TEST');assert.equal(event.action_source,'chat');return {ok:true,status:200,response:{events_received:1},datasetId:EC_BOT_CORE_V78_DATASET_ID};}
  }));
 console.log('V148_SINK_WORKER='+JSON.stringify({calls,result}));
 await mongoose.disconnect();process.exit(0);
}
const fixture=JSON.parse(fs.readFileSync('tests/fixtures/meta-funnel-v148-contract.json'));
const clicked=new Date(Date.now()-10000),occurred=new Date(Date.now()-3000);
const phone='593999999901',visitId=new mongoose.Types.ObjectId(),contactId=new mongoose.Types.ObjectId();
const visit={_id:visitId,country:'EC',productKey:'tex_ultra_ec',funnel:'PROTOCOLO_G',tracking:protocoloGStructuredTracking(fixture),externalId:fixture.external_id,visitorId:fixture.visitorId,sourceUrl:fixture.event_source_url,customerPhone:phone,attributionClaimedAt:clicked,lastClickAt:clicked};
await db.collection('vslvisits').insertOne(visit);
await db.collection('contactstates').insertOne({_id:contactId,sinkFixtureV148:true,countryCode:'EC',phoneDigits:phone,metadata:{vslVisitId:visitId,tracking:metaAttributionTrackingFromVisit(visit),customerDraft:{productKey:'tex_ultra_ec',productName:'Tex Ultra Ecuador',quantity:3,total:80.99}}});
await db.collection('messages').insertOne({_id:'V148_SINK_MESSAGE',isFromMe:false,peerPhone:phone,from:phone,body:'3 frascos',createdAt:occurred,timestamp:Math.floor(+occurred/1000)});
await mongoose.disconnect();
const env={...process.env};
for(const key of Object.keys(env))if(/META.*TOKEN|ZAPI.*TOKEN|DROPI.*PASSWORD|OPENAI_API_KEY/.test(key))delete env[key];
const run=async()=>{
 const out=await promisify(execFile)(process.execPath,['--import','./scripts/lib/ec-runtime-successor-v97-context.mjs',import.meta.filename,'worker',dbName,activationAt.toISOString()],{cwd:root,env,maxBuffer:4*1024*1024});
 const line=out.stdout.split(/\r?\n/).find(v=>v.startsWith('V148_SINK_WORKER='));assert.ok(line);return JSON.parse(line.slice('V148_SINK_WORKER='.length));
};
const race=await Promise.all([run(),run()]);
assert.equal(race.reduce((n,v)=>n+v.calls,0),1);
const restart=await run();assert.equal(restart.calls,0);
await mongoose.connect(process.env.MONGODB_URI,{dbName,autoIndex:false});
const records=await mongoose.connection.db.collection('metabusinessevents').find({}).toArray();
assert.equal(records.length,1);assert.equal(records[0].state,'ACCEPTED');assert.equal(records[0].response.events_received,1);
await mongoose.disconnect();
const receipt={status:'PASS',schema:'V148_MONGO_SINK',commit:source.commit,tree:source.functionalTree,dbName,
 twoProcessRaceCalls:1,restartCalls:0,persistentLogicalEvents:1,actualMongoGuard:'PASS',metaHttpStatusInSink:200,metaEventsReceivedInSink:1,
 realMetaProductionEvents:0,realMessages:0,productionChanged:false,completedAt:new Date().toISOString()};
const output=path.resolve(process.argv[2]||'');assert.match(output,/^\/var\/lib\/vitalismen-deploy\/evidence\/v148[^/]*\/[^/]+\.json$/);
fs.writeFileSync(output,JSON.stringify(receipt,null,2)+'\n',{mode:0o400});console.log(JSON.stringify(receipt));
