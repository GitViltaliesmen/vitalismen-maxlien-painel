'use strict';
// PROJECT=VITALISMEN_EC. /tex only. Public clicks never create Lead/Purchase.
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes, createHmac, timingSafeEqual, randomUUID } = require('node:crypto');
const { createJournal, hash } = require('./lib/tex-measurement-journal-v243.cjs');
const { buildEvent, sendToMeta } = require('./vitpower-meta-server');
const PIXEL = '1100892582698669';
const REF = /^TX243-[a-f0-9]{64}$/;
const HEX = /^[a-f0-9]{64}$/;
const ORIGINS = ['https://plusmen.shop', 'https://www.plusmen.shop'];
const mac = (key, text) => createHmac('sha256', key).update(text).digest('hex');
const equal = (a,b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && timingSafeEqual(Buffer.from(a),Buffer.from(b));
const failure = (code, status = 400) => Object.assign(Error(code), { status });
function createTexMeasurementV243(options = {}) {
  const root = options.root || __dirname;
  const config = options.config || JSON.parse(fs.readFileSync(path.join(root,'private/meta/vitpower-config.json'),'utf8'));
  const key = options.key || fs.readFileSync(path.join(root,'private/meta/tex-measurement-v243.secret'),'utf8').trim();
  if (config.pixel_id !== PIXEL || !HEX.test(key)) throw Error('tex_measurement_configuration');
  const now = options.now || Date.now;
  const journal = createJournal({ directory: options.directory || path.join(root,'private/meta/tex-measurement-v243'), now });
  const send = options.send || (event => sendToMeta(event, config));
  const publicOrigin = req => ORIGINS.includes(req.headers?.origin) && req.headers?.['sec-fetch-site'] !== 'cross-site';
  function enabled() {
    if (options.enabled) return options.enabled() === true;
    try { const state = JSON.parse(fs.readFileSync(path.join(root,'private/meta/tex-measurement-v243-activation.json'),'utf8'));
      return state.enabled === true && state.version === 243 && Number.isFinite(Date.parse(state.activatedAt));
    } catch { return false; }
  }
  async function referenceRecord(reference) {
    if (!REF.test(reference || '')) throw failure('invalid_reference');
    return journal.read('references', hash(reference));
  }
  async function issue(req) {
    if (!publicOrigin(req)) throw failure('invalid_origin',403);
    if (!enabled()) throw failure('measurement_unavailable',503);
    const body = req.body || {};
    if (body.reference && REF.test(body.reference)) {
      const previous = await referenceRecord(body.reference);
      if (previous && previous.expiresAt > now()) return { ok:true,reference:body.reference,expiresAt:previous.expiresAt };
    }
    const url = new URL(String(body.event_source_url || ''));
    if (!ORIGINS.includes(url.origin) || !/^\/tex\/?$/.test(url.pathname)) throw failure('invalid_source_url');
    // Reuse the existing sanitizer/anonymous matching, never form name/phone/health/conversation data.
    const event = buildEvent({ headers:req.headers,cookies:req.cookies,socket:req.socket, body:{ pixel_id:PIXEL,event_name:'ViewContent',event_id:'vp_'+randomUUID(),event_time:Math.floor(now()/1000),
      event_source_url:url.href,fbp:body.fbp,fbc:body.fbc,external_id:body.external_id } },config,now());
    const reference = 'TX243-'+randomBytes(32).toString('hex');
    const record = { version:243,issuedAt:now(),expiresAt:now()+604800000,sourceUrl:event.event_source_url,
      userData:event.user_data,customData:event.custom_data };
    await journal.lock('admission',()=>journal.write('references',hash(reference),record));
    return { ok:true,reference,expiresAt:record.expiresAt };
  }
  async function status(req) {
    if (!publicOrigin(req)) throw failure('invalid_origin',403);
    if (!enabled()) throw failure('measurement_unavailable',503);
    const ref = await referenceRecord(req.body?.reference);
    if (!ref || ref.expiresAt <= now() || !ref.subject) return { ok:true,confirmed:false };
    const lead = await journal.read('leads',ref.subject);
    return { ok:true,confirmed:Boolean(lead?.attemptedAt), ...(lead?.attemptedAt ? {
      eventId:lead.event.event_id,eventTime:lead.event.event_time,customData:lead.event.custom_data } : {}) };
  }
  function authenticate(req) {
    const timestamp = String(req.headers?.['x-tex-timestamp'] || ''), signature = req.headers?.['x-tex-signature'];
    if (!/^\d{13}$/.test(timestamp) || Math.abs(now()-Number(timestamp)) > 300000 || !HEX.test(signature || '')
      || !equal(signature,mac(key,timestamp+'.'+JSON.stringify(req.body)))) throw failure('invalid_proof',403);
    if (!enabled()) throw failure('measurement_unavailable',503);
  }
  async function proof(req) {
    authenticate(req);
    const b=req.body || {};
    const expected=b.kind==='Lead' ? ['version','kind','reference','subject','inboundId','occurredAt','channel']
      : ['version','kind','reference','subject','orderKey','occurredAt','quantity','value','currency'];
    if (Object.keys(b).sort().join('|')!==expected.sort().join('|') || b.version!==243 || !['Lead','Purchase'].includes(b.kind)
      || !REF.test(b.reference || '') || !HEX.test(b.subject || '') || !Number.isFinite(b.occurredAt)
      || b.occurredAt>now()+60000 || now()-b.occurredAt>604800000) throw failure('invalid_proof');
    const initial=await referenceRecord(b.reference);
    if (!initial || initial.issuedAt>b.occurredAt+60000 || initial.expiresAt<=b.occurredAt || initial.expiresAt<=now()) throw failure('reference_expired');
    if (b.kind==='Lead' && (!HEX.test(b.inboundId || '') || !['web','whatsapp'].includes(b.channel))) throw failure('invalid_proof');
    if (b.kind==='Purchase' && (!HEX.test(b.orderKey || '') || ![1,2,3,6].includes(b.quantity) || !Number.isFinite(b.value) || b.value<=0 || b.currency!=='USD')) throw failure('invalid_purchase');
    return journal.lock('reference:'+hash(b.reference),()=>journal.lock(b.kind==='Lead'?'subject:'+b.subject:'purchase:'+b.orderKey,async()=>{
      const ref=await referenceRecord(b.reference);
      if (ref.subject && ref.subject!==b.subject) throw failure('reference_already_bound',409);
      let lead=await journal.read('leads',b.subject);
      if (b.kind==='Purchase' && (!lead || lead.reference!==b.reference || b.occurredAt<lead.confirmedAt)) throw failure('lead_origin_required',409);
      if (!ref.subject) { ref.subject=b.subject;await journal.write('references',hash(b.reference),ref); }
      const kind=b.kind==='Lead'?'leads':'purchases',id=b.kind==='Lead'?b.subject:b.orderKey;
      const old=await journal.read(kind,id);
      if (old) {
        if (old.subject!==b.subject) throw failure('event_identity_conflict',409);
        return { ...old.receipt,duplicate:true };
      }
      const source=b.kind==='Lead'?ref:await referenceRecord(lead.reference);
      const custom={...source.customData,content_ids:['tex_ultra_ec'],content_type:'product',content_name:'Tex Ultra Ecuador'};
      if (b.kind==='Purchase') Object.assign(custom,{currency:'USD',value:b.value,order_id:b.orderKey,num_items:b.quantity,
        contents:[{id:'tex_ultra_ec',quantity:b.quantity,item_price:Number((b.value/b.quantity).toFixed(2))}]});
      const event={event_name:b.kind,event_id:b.kind==='Lead'?'tex243_lead_'+b.subject:'tex243_purchase_'+b.orderKey,
        event_time:Math.floor(b.occurredAt/1000),action_source:'website',event_source_url:source.sourceUrl,
        user_data:source.userData,custom_data:custom};
      const record={version:243,subject:b.subject,reference:b.reference,confirmedAt:b.occurredAt,attemptedAt:now(),sentAt:null,
        inboundId:b.inboundId || '',event,receipt:{ok:false,verified:true,blocked:true,datasetId:PIXEL,eventId:event.event_id,error:'tex_measurement_outcome_unknown'}};
      await journal.write(kind,id,record);
      let result;try{result=await send(event);}catch{result={accepted:false,status:0};}
      record.receipt={ok:result.accepted===true,verified:true,blocked:result.accepted!==true,datasetId:PIXEL,datasetRoute:'plusmen_tex_v243',
        eventId:event.event_id,eventTime:event.event_time,response:{events_received:Number(result.events_received)||0},
        ...(!result.accepted?{error:result.status?'tex_measurement_meta_rejected':'tex_measurement_outcome_unknown'}:{})};
      if(result.accepted)record.sentAt=now();
      // No retry queue, even when Meta/provider outcome is uncertain.
      await journal.write(kind,id,record);return record.receipt;
    }));
  }
  function route(work) { return async(req,res)=>{res.set('Cache-Control','no-store');try{res.json(await work(req));}
    catch(e){res.status(e.status || (/busy|capacity/.test(e.message)?429:503)).json({ok:false,error:e.status?e.message:'measurement_unavailable'});} }; }
  return Object.freeze({ issue,status,proof,
    publicHandler:route(req=>req.body?.action==='issue'?issue(req):req.body?.action==='status'?status(req):Promise.reject(failure('invalid_action'))),
    proofHandler:route(proof) });
}
module.exports={createTexMeasurementV243};
