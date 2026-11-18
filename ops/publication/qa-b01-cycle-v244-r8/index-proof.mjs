import assert from 'node:assert/strict';
import{createHash}from'node:crypto';
const R=process.env.QA_RELEASE;
const{default:mongoose}=await import(R+'/node_modules/mongoose/index.js');
const{default:Model}=await import(R+'/src/models/OutboundDedupe.js');
const{b01AttemptKeyV244:key,b01ReservationFingerprintV244:fp}=await import(R+'/src/services/vitPowerB01CoreV216Service.js');
const indexes=JSON.parse(process.env.QA_INDEXES);
await mongoose.connect('mongodb://127.0.0.1:27129/qa_index_v244',{autoIndex:false});
try{
 await Model.createCollection();
 for(const i of indexes){if(i.name==='_id_')continue;const{key,...options}=i;await Model.collection.createIndex(key,options);}
 const phone='5515998038637',hash=s=>createHash('sha256').update(s).digest('hex');
 for(let cursor=0;cursor<5;cursor++)await Model.create({key:hash(`vit-power-b01-v216:${phone}:${cursor}`),phoneDigits:phone,kind:['text','audio','image','image','text'][cursor],fingerprint:hash('b01-v216:'+cursor),status:'sent',providerMessageId:'legacy-'+cursor});
 const before=JSON.stringify(await Model.find().sort({_id:1}).lean());let collisions=0;
 const ids=await Model.find().select('_id').lean();
 for(const permit of ['ecqa-v78-'+'a'.repeat(32),'ecqa-v78-'+'b'.repeat(32)]){
  for(let cursor=0;cursor<5;cursor++){
   const job={phone,cursor,qaPermitId:permit},row={key:key(job),phoneDigits:phone,kind:['text','audio','image','image','text'][cursor],fingerprint:fp(job),status:'sent'};
   if(permit.endsWith('a')){try{await Model.create({...row,fingerprint:hash('b01-v216:'+cursor)});assert.fail('old tuple unexpectedly accepted');}catch(e){assert.equal(e.code,11000);collisions++;}}
   await Model.create(row);try{await Model.create(row);assert.fail('retry accepted');}catch(e){assert.equal(e.code,11000);collisions++;}
  }
 }
 assert.equal(JSON.stringify(await Model.find({_id:{$in:ids.map(x=>x._id)}}).sort({_id:1}).lean()),before);
 for(let cursor=0;cursor<5;cursor++){const job={phone:'593991234567',cursor};assert.equal(key(job),hash(`vit-power-b01-v216:${job.phone}:${cursor}`));assert.equal(fp(job),hash('b01-v216:'+cursor));}
 assert.equal(await Model.countDocuments(),15);
 console.log(JSON.stringify({pass:true,actualProductionIndexes:indexes.length,duplicateRejections:collisions,legacyRowsPreserved:5,newIndependentQaCycles:2,ecKeyFingerprintUnchanged:true,networkNamespaceIsolated:true,realMongo:true}));
}finally{await mongoose.disconnect();}
