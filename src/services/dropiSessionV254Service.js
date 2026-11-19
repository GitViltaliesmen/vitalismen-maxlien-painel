import fs from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { integrationPolicyV254 } from './orderIntegrationScopeV254Service.js';
import { requestDropiBff, normalizeDropiBffListResponse, isUnexpiredDropiToken } from './dropiBffAdapter.js';
const exec=promisify(execFile),statePath='/root/.vitalismen-secrets/droppi-ec-storage.json';
const sha=x=>createHash('sha256').update(x).digest('hex');
export const readDropiSessionV254 = () => {
    const bytes=fs.readFileSync(statePath),state=JSON.parse(bytes),origin=state.origins.find(x=>x.origin==='https://app.dropi.ec');
    const entries=Object.fromEntries(origin.localStorage.map(x=>[x.name,x.value]));
    const token=JSON.parse(entries.DROPI_token),login=JSON.parse(entries.DROPI_LoginResult);
    if(token!==login.token||!login.objects?.id)throw Error('dropi_session_identity_not_aligned');
    const country=String(login.countries?.[0]?.code||login.configurations?.[0]?.country_code||login.configurations?.[0]?.code||login.configurations?.[0]?.country||'').toLowerCase();
    if(!['ec','ecuador'].includes(country))throw Error('dropi_country_identity_invalid');
    return {bytes,token,userId:login.objects.id,valid:isUnexpiredDropiToken(token)};
};
export const dropiOrdersReadV254 = async (session,{search='',start=0,limit=50,from='2026-11-01'}={}) => {
    const u=new URL('https://api-v2.dropi.ec/bff/orders/myorders/v2');
    for(const[k,v]of Object.entries({exportAs:'orderByRow',orderBy:'id',orderDirection:'desc',result_number:limit,start,textToSearch:search,status:'null',supplier_id:'false',user_id:session.userId,
        from,until:new Date(Date.now()+86400000).toISOString().slice(0,10),filter_product:'undefined',haveIncidenceProcesamiento:'false',tag_id:'',warranty:'false',seller:'null',filter_date_by:'FECHA DE CREADO',invoiced:'null'}))u.searchParams.set(k,String(v));
    const response=await requestDropiBff({url:u.href,method:'GET',token:session.token,countryCode:'ec',operation:'list',timeoutMs:15000,
        fetchImpl:(url,options)=>{if(url!==u.href||options.method!=='GET'||options.body!==undefined)throw Error('dropi_read_only_required');return fetch(url,{...options,redirect:'error'});}});
    return {...response,list:normalizeDropiBffListResponse(response.body,response.listResponseContext)};
};
let checking=null;
export function ensureDropiSessionV254() {
    if(!integrationPolicyV254())return Promise.resolve({ok:false,error:'integration_inactive'});
    if(checking)return checking;
    checking=(async()=>{
        try{
            let session=readDropiSessionV254(),probe=session.valid?await dropiOrdersReadV254(session,{limit:1}):null;
            if(probe?.ok&&probe.list.isSuccess)return{ok:true};
            if(probe&&probe.status!==401)return{ok:false,error:'dropi_session_probe_unavailable'};
            let proofPath;
            if(probe?.status===401){
                const directory='/var/lib/vitalismen-deploy/ec-dropi-meta-v254-r8/session-observations';fs.mkdirSync(directory,{recursive:true,mode:0o700});
                proofPath=directory+'/'+randomUUID()+'.json';fs.writeFileSync(proofPath,JSON.stringify({project:'VITALISMEN_EC',httpStatus:401,apiOrigin:'https://api-v2.dropi.ec',sessionSha256:sha(session.bytes),observedAt:Date.now()/1000}),{flag:'wx',mode:0o600});
            }
            const script=fileURLToPath(new URL('../../scripts/renew-dropi-session-v254.py',import.meta.url));
            const run=await exec('python3',['-I','-B','-S',script,...(proofPath?[proofPath]:[])],{env:{...process.env,NODE_OPTIONS:'',npm_config_node_options:''},timeout:240000,maxBuffer:128*1024});
            const result=JSON.parse(run.stdout);
            if(!['VALID_SESSION_RETAINED','RENEWED_VERIFIED_SAME_ACCOUNT'].includes(result.status))return{ok:false,error:'dropi_session_renewal_requires_review'};
            session=readDropiSessionV254();if(!session.valid)return{ok:false,error:'dropi_session_still_invalid'};
            probe=await dropiOrdersReadV254(session,{limit:1});return probe.ok&&probe.list.isSuccess?{ok:true}:{ok:false,error:'dropi_renewed_session_not_accepted'};
        }catch(error){return{ok:false,error:'dropi_session_preflight_unavailable'};}
    })().finally(()=>{checking=null;});return checking;
}
export async function findExactDropiReceiptV254(order,shipment) {
    const session=readDropiSessionV254();if(!session.valid)return null;
    const phone=String(order.customer?.phone||'').replace(/\D/g,''),known=String(order.dropiOrderId||shipment.raw?.latestDroppiPayload?.dropiOrderId||'');
    const matches=[];
    for(let page=0;page<6;page++){
        const response=await dropiOrdersReadV254(session,{search:known||phone.slice(-9),start:page*50,from:new Date(+new Date(order.confirmedAt)-86400000).toISOString().slice(0,10)});
        if(!response.ok||!response.list.isSuccess)throw Error('dropi_receipt_read_not_verified');
        const rows=response.list.objects||[];
        for(const row of rows){
            const samePhone=String(row.phone||'').replace(/\D/g,'').endsWith(phone.slice(-9));
            const notes=String(row.notes||row.observations||row.comments||'');
            const exact=known?String(row.id)===known:notes.split(/[^A-Za-z0-9-]+/).includes(order.orderId);
            if(samePhone&&exact)matches.push(row);
        }
        if(rows.length<50)break;
    }
    const unique=[...new Map(matches.map(x=>[String(x.id),x])).values()];return unique.length===1?unique[0]:null;
}
