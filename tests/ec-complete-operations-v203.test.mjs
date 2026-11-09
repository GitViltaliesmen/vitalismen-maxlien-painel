import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { AsyncLocalStorage } from 'node:async_hooks';
import { ecPhoneV203, historicalEligibilityV203, manualHistoricalRequestV203, manualHistoricalMetadataV203, manualShipmentTerminalReviewV203 } from '../src/services/ecHistoricalOrderStatusV203Service.js';
import { ecPanelStatusV177Operation, ecPanelStatusV177MongoAllowed, ecPanelStatusV177Target, ecPanelStatusV177Actor, ecPanelStatusV177RouteDecision } from '../src/services/ecPanelStatusOperationsV177Service.js';
import { normalizeDropiBffCreateResponse } from '../src/services/dropiBffAdapter.js';
import { validateDropiBffListContract } from '../src/services/dropiBffListContract.js';
import { panelOrderLifecycle } from '../src/services/ecDeliveredRepurchaseService.js';

const phone='593990000001';
const shipment=(extra={})=>({orderId:'EC-OLD',client:{phone},logistics:{status:'ENTREGADO'},...extra});
const order=(extra={})=>({orderId:'EC-OLD',customer:{phone},status:'delivered',...extra});
const env={VITALISMEN_EC_BOT_CORE_OPERATIONAL:'true',PANEL_AUTH_DISABLED:'false'};
const path='/api/orders/EC-HISTORY-OLD';

const dropiMatcher = () => {
    const source=fs.readFileSync(new URL('../src/services/droppiEcuadorBrowserService.js',import.meta.url),'utf8');
    const fragment=source.slice(source.indexOf('const rowMatchesManualSubmission ='),source.indexOf('const findExistingDropiOrderForManualSubmission ='));
    const scope={Error,Date,Number,String,Boolean,Object,Array,
        normalizeAutocompleteText:value=>String(value||'').toLowerCase(),
        phoneLookupVariants:value=>{const d=String(value||'').replace(/\D/g,'');return [d,d.slice(-9)];},
        resolveEcuadorProductInfo:(...values)=>({key:values.find(value=>typeof value==='string'&&value)||values.find(value=>value?.productKey)?.productKey||''})};
    vm.runInNewContext(fragment+'\nthis.matches=rowMatchesManualSubmission;',scope);return scope.matches;
};
test('an old delivered order at the same promotional price is not the new recompra',()=>{
    const matches=dropiMatcher();
    const payload={orderId:'EC-RECOMPRA-NEW',phone,firstName:'Cliente',lastName:'Fixture',productKey:'vit_power_ec',price:35.99,orderCreatedAt:'2026-11-09T04:00:00Z',reference:'Frente al Mirador'};
    const old={id:7000001,phone:'990000001',name:'Cliente',surname:'Fixture',productKey:'vit_power_ec',total_order:35.99,status:'ENTREGADO',created_at:'2026-10-02T12:15:40',reference:'Frente al Mirador'};
    assert.equal(matches(old,payload),false);
    assert.equal(matches({...old,status:'PENDIENTE'},payload),false);
    assert.equal(matches({...old,status:'PENDIENTE',created_at:'2026-11-08T23:00:10'},payload),true);
});
test('exact internal reference remains idempotent and conflicting receipt blocks a new POST',()=>{
    const matches=dropiMatcher();const payload={orderId:'EC-RECOMPRA-NEW',phone,productKey:'vit_power_ec',price:35.99};
    const row={phone:'990000001',productKey:'vit_power_ec',total_order:35.99,status:'ENTREGADO',notes:'EC-RECOMPRA-NEW | Frente al Mirador'};
    assert.equal(matches(row,payload),true);
    assert.throws(()=>matches({...row,total_order:70},payload),/DROPI_DUPLICATE/);
    assert.throws(()=>matches({...row,phone:'991234567'},payload),/DROPI_DUPLICATE/);
});
test('manual recording time is not invented as the physical delivery date',()=>{
    const result=panelOrderLifecycle({order:order({updatedAt:'2026-11-09T04:00:00Z',manualHistoricalStatusV203:{source:'authenticated_operator'}})});
    assert.equal(result.delivered,true);assert.equal(result.previousDeliveredAt,null);
});

const runtimeGuardModule = () => {
    const source=fs.readFileSync(new URL('../src/services/ecBotCoreRuntimeIntegrationV78Service.js',import.meta.url),'utf8');
    const fragment=source.slice(source.indexOf('export const ecPanelStatusAuthenticatedActionV177 ='),source.indexOf('export const assertEcBotCoreExternalEffectAllowedV78 =')).replace(/export const /g,'const ');
    const storage=new AsyncLocalStorage();
    const denied=()=>({allowed:false,reason:'not-this-operation'});
    const scope={process:{env},console,Date,Object,String,Boolean,Array,
        runtimeContext:storage,currentEcBotCoreRuntimeContextV78:()=>storage.getStore(),
        ecBotCoreV78Requested:()=>true,resolveEcBotCoreV78Configuration:()=>({ready:true}),
        qaPipelineEnterV78:()=>null,qaLogV78(){},prepareManualHumanRequest:async()=>false,isExactEcAuthLoginV78Request:()=>false,
        ecBotCoreV78RouteDecision:denied,ecPanelRuntimeRecoveryV115RouteDecision:denied,ecManualDropiReleaseV129RouteDecision:denied,
        ecMultiproductManualReleaseV120RouteDecision:denied,ecPanelCustomerPersistenceV122RouteDecision:denied,
        isEcPanelStatusV177StrictLocalRequest:()=>false,ecPanelStatusV177RouteDecision,ecPanelStatusV177Actor,ecPanelStatusV177Target,ecPanelStatusV177Operation,
        EC_BOT_CORE_V78_MODE:'EC_BOT_CORE_OPERATIONAL',
        httpBlocked:(res,reason)=>res.status(423).json({reason})};
    vm.runInNewContext(fragment+'\nthis.runtime={guard:ecBotCoreMutationRouteGuardV78,authenticate:ecPanelStatusAuthenticatedActionV177};',scope);
    return {runtime:scope.runtime,storage};
};
const exerciseRuntimeGuard = async ({method='PATCH',url=path,body={status:'delivered'},user={_id:'admin',role:'admin',isActive:true}}={}) => {
    const {runtime,storage}=runtimeGuardModule();let context=null,status=null;
    const res={status(code){status=code;return this;},json(data){return data;}};
    await runtime.guard({method,originalUrl:url,body,user,params:{}},res,()=>runtime.authenticate({method,originalUrl:url,body,user,params:{}},res,()=>{context=storage.getStore();}));
    return {context,status};
};
test('real global runtime guard creates a PATCH write context only after human authentication',async()=>{
    const result=await exerciseRuntimeGuard();
    assert.equal(result.status,null);assert.equal(result.context.writeContext,true);
    assert.equal(result.context.panelStatusHumanAuthenticatedV177,true);
    assert.equal(ecPanelStatusV177MongoAllowed({context:result.context,collection:'orders',method:'updateOne',env}),true);
});
test('real runtime guard rejects unauthenticated identity and non-admin terminal edits',async()=>{
    for(const user of [{_id:'local-no-password',role:'admin'},{_id:'operator',role:'operator'},null]){
        const result=await exerciseRuntimeGuard({user});assert.equal(result.status,403);assert.equal(result.context,null);
    }
});
test('recompra staging receives only its authenticated route-specific write class',async()=>{
    const result=await exerciseRuntimeGuard({method:'POST',url:'/api/shipments/droppi/ec/admin-leads/1001/stage-confirmed',body:{forceRepurchase:true,note:'Recompra confirmada'}});
    assert.equal(result.context.panelStatusOperationV177,'stage-confirmed-v203');
    assert.equal(result.context.panelStatusTargetV177,'1001');
    assert.equal(ecPanelStatusV177MongoAllowed({context:result.context,collection:'orders',method:'insertOne',env}),true);
    assert.equal(ecPanelStatusV177MongoAllowed({context:result.context,collection:'shipments',method:'insertOne',env}),false);
    const invalid=await exerciseRuntimeGuard({method:'POST',url:'/api/shipments/droppi/ec/admin-leads/1001/stage-confirmed',body:{forceRepurchase:'true'}});
    assert.equal(invalid.status,423);
});
test('existing QR contact status gets terminal write scope without allowing order insertion',async()=>{
    const result=await exerciseRuntimeGuard({url:'/api/whatsapp/contact-state/'+phone,body:{customerDraft:{status:'devolvido',phone}}});
    assert.equal(result.context.panelStatusOperationV177,'manual-contact-historical-status-v203');
    assert.equal(ecPanelStatusV177MongoAllowed({context:result.context,collection:'orders',method:'updateOne',env}),true);
    assert.equal(ecPanelStatusV177MongoAllowed({context:result.context,collection:'orders',method:'insertOne',env}),false);
});
test('arbitrary order edits remain blocked before creating any runtime write context',async()=>{
    const result=await exerciseRuntimeGuard({body:{status:'delivered',customer:{phone:'593990000002'}}});
    assert.equal(result.status,423);assert.equal(result.context,null);
});

const authModule = () => {
    const source=fs.readFileSync(new URL('../src/middleware/auth.js',import.meta.url),'utf8')
        .replace(/^import .*;\r?\n/gm,'').replace(/export const /g,'const ');
    const active={_id:'real-admin',id:'real-admin',role:'admin',isActive:true};
    const scope={process:{env:{PANEL_AUTH_DISABLED:'false',JWT_SECRET:'test-secret'}},console:{error(){}},jwt:{verify(token,secret){assert.equal(secret,'test-secret');if(token!=='valid')throw Error('invalid');return {id:'real-admin'};}},User:{findById(id){assert.equal(id,'real-admin');return {select:async()=>active};}}};
    vm.runInNewContext(source+'\nthis.auth={authMiddleware,adminOnly,isPanelAuthDisabled};',scope);
    return {auth:scope.auth,active,env:scope.process.env};
};
test('loopback honors a supplied valid credential instead of replacing the actor',async()=>{
    const {auth,active}=authModule();let continued=false;
    const req={hostname:'127.0.0.1',ip:'127.0.0.1',headers:{authorization:'Bearer valid'}};
    await auth.authMiddleware(req,{status(){throw Error('unexpected rejection')}},()=>{continued=true;});
    assert.equal(continued,true);assert.equal(req.user,active);assert.equal(auth.isPanelAuthDisabled(req),true);
});
test('invalid supplied local credential is rejected and never falls back to no-password',async()=>{
    const {auth}=authModule();let code;
    const req={hostname:'127.0.0.1',ip:'127.0.0.1',headers:{authorization:'Bearer invalid'}};
    await auth.authMiddleware(req,{status(value){code=value;return this;},json(){}},()=>assert.fail('invalid token accepted'));
    assert.equal(code,401);assert.equal(req.user,undefined);
});
test('authenticated local non-admin cannot use adminOnly fallback',()=>{
    const {auth}=authModule();let code;
    auth.adminOnly({hostname:'127.0.0.1',ip:'127.0.0.1',headers:{authorization:'Bearer valid'},user:{id:'operator',role:'operator'}},{status(value){code=value;return this;},json(){}},()=>assert.fail('role bypass'));
    assert.equal(code,403);
});

test('normalizes only a real Ecuador mobile identity',()=>{
    for(const value of [phone,'+'+phone,'0990000001','990000001']) assert.equal(ecPhoneV203(value),phone);
    for(const value of ['5515998038637','573009891837','120363990000001','abc','']) assert.equal(ecPhoneV203(value),'');
});
test('new customer is eligible only when all history sources are available',()=>{
    assert.equal(historicalEligibilityV203({phone}).eligible,true);
    assert.equal(historicalEligibilityV203({phone,unavailable:true}).eligible,false);
});
test('a returned order without any shipment blocks cash on delivery',()=>{
    const d=historicalEligibilityV203({phone,orders:[order({status:'returned'})]});
    assert.equal(d.eligible,false);assert.equal(d.paymentMode,'prepaid_only');
});
test('legacy return remains effective when a newer order says delivered',()=>{
    const d=historicalEligibilityV203({phone,orders:[order()],legacyLeads:[{id:1001,phone,status:'devolvido'}]});
    assert.equal(d.eligible,false);assert.equal(d.evidence[0].source,'legacy_lead');
});
test('conflicting pickup and return never releases another shipment',()=>{
    const d=historicalEligibilityV203({phone,shipments:[shipment({outcomes:{pickedUp:true,returned:true}})]});
    assert.equal(d.paymentMode,'manual_review');assert.equal(d.eligible,false);
});
test('waiting for pickup is blocked without being relabeled as returned',()=>{
    const d=historicalEligibilityV203({phone,shipments:[shipment({logistics:{status:'READY_FOR_PICKUP'}})]});
    assert.equal(d.paymentMode,'blocked_until_pickup');assert.notEqual(d.reason,'previous_order_not_picked_up');
});
test('current submission excludes itself from active-history checks only',()=>{
    assert.equal(historicalEligibilityV203({phone,currentOrderId:'EC-NEW',shipments:[shipment({orderId:'EC-NEW',logistics:{status:'CREATED'}})],orders:[order({orderId:'EC-NEW',status:'confirmed'})]}).eligible,true);
    assert.equal(historicalEligibilityV203({phone,currentOrderId:'EC-NEW',orders:[order({orderId:'EC-NEW',status:'returned'})]}).eligible,false);
});
test('another active order and manual block both require human review',()=>{
    assert.equal(historicalEligibilityV203({phone,orders:[order({status:'processing'})]}).eligible,false);
    assert.equal(historicalEligibilityV203({phone,legacyLeads:[{phone,status:'entregue',blocked:1}]}).eligible,false);
});
test('an audited manual pickup can release a stale placeholder without rewriting provider facts',()=>{
    const audit={version:203,source:'authenticated_operator',status:'delivered',orderId:'EC-OLD',phone,actorId:'0123456789abcdef01234567',recordedAt:'2026-11-09T04:00:00Z'};
    const old=order({manualHistoricalStatusV203:audit});
    const stale=shipment({logistics:{status:'CREATED'}});
    assert.equal(historicalEligibilityV203({phone,orders:[old],shipments:[stale]}).eligible,true);
    assert.equal(stale.logistics.status,'CREATED');
    assert.equal(historicalEligibilityV203({phone,orders:[order({manualHistoricalStatusV203:{...audit,actorId:'local-no-password'}})],shipments:[stale]}).eligible,false);
    assert.equal(historicalEligibilityV203({phone,orders:[old],shipments:[{...stale,outcomes:{returned:true}}]}).eligible,false);
});
test('another customer cannot contribute release or return evidence',()=>{
    const other='593990000002';
    const d=historicalEligibilityV203({phone,orders:[order({customer:{phone:other},status:'returned'})],legacyLeads:[{phone:other,status:'devolvido'}]});
    assert.equal(d.eligible,true);
});
test('terminal manual operation preserves restricted route and body scope',()=>{
    assert.equal(manualHistoricalRequestV203({method:'PATCH',path,body:{status:'entregue'}}).status,'delivered');
    assert.equal(manualHistoricalRequestV203({method:'PATCH',path,body:{status:'nao_retirado'}}).status,'returned');
    for(const body of [{status:'confirmed'},{status:'delivered',customer:{phone:'593990000002'}},{status:'returned',country:'CO'},{status:'delivered',total:0},{status:'delivered',total:35.991},{status:'delivered',package:{quantity:0}},{status:'delivered',package:{id:3,quantity:1}}]) assert.equal(manualHistoricalRequestV203({method:'PATCH',path,body}),null);
    assert.equal(manualHistoricalRequestV203({method:'POST',path,body:{status:'delivered'}}),null);
});
test('authenticated terminal correction only updates existing orders and shipment review',()=>{
    const body={status:'delivered',notes:'Entrega anterior confirmada pelo operador'};
    const operation=ecPanelStatusV177Operation({method:'PATCH',path,body});
    assert.equal(operation,'manual-historical-status-v203');
    const context={method:'PATCH',path,writeContext:true,panelStatusV177:true,panelStatusOperationV177:operation,panelStatusActorIdV177:'active-admin',panelStatusTargetV177:'EC-HISTORY-OLD',panelStatusBodyV177:body,panelStatusHumanAuthenticatedV177:true};
    assert.equal(ecPanelStatusV177Target({path}),context.panelStatusTargetV177);
    assert.equal(ecPanelStatusV177MongoAllowed({context,collection:'orders',method:'updateOne',env}),true);
    assert.equal(ecPanelStatusV177MongoAllowed({context,collection:'shipments',method:'updateOne',env}),true);
    for(const [collection,method] of [['orders','insertOne'],['shipments','insertOne'],['shipments','updateMany'],['shipments','deleteOne'],['users','updateOne'],['orders','deleteOne']]) assert.equal(ecPanelStatusV177MongoAllowed({context,collection,method,env}),false);
    assert.equal(ecPanelStatusV177MongoAllowed({context:{...context,panelStatusHumanAuthenticatedV177:false},collection:'orders',method:'updateOne',env}),false);
});

const manualAudit = (extra={}) => ({version:203,source:'authenticated_operator',actorId:'0123456789abcdef01234567',recordedAt:'2026-11-09T04:00:00Z',phone,orderId:'EC-OLD',status:'returned',...extra});
test('terminal review pauses only the owned old shipment without inventing carrier facts',()=>{
    const old=shipment({_id:'0123456789abcdef01234568',country:'EC',logistics:{status:'READY_FOR_PICKUP'},raw:{provider:'unchanged'},review:{reviewReason:'previous evidence'}});
    const before=JSON.stringify(old),audit=manualAudit();
    const plan=manualShipmentTerminalReviewV203({order:order({country:'EC'}),shipment:old,audit});
    assert.deepEqual(plan.filter,{_id:old._id,country:'EC',orderId:'EC-OLD','client.phone':phone});
    assert.equal(plan.update.$set['review.manualOnly'],true);
    assert.match(plan.update.$set['review.reviewReason'],/previous evidence/);
    assert.equal(Object.keys(plan.update.$set).every(key=>key.startsWith('review.')),true);
    assert.equal(JSON.stringify(old),before);
    assert.equal(manualShipmentTerminalReviewV203({}),null);
    for(const wrong of [{...old,country:'CO'},{...old,orderId:'EC-OTHER'},{...old,client:{phone:'593990000002'}}]) assert.throws(()=>manualShipmentTerminalReviewV203({order:order({country:'EC'}),shipment:wrong,audit}));
    assert.throws(()=>manualShipmentTerminalReviewV203({order:order({country:'EC'}),shipment:old,audit:{...audit,actorId:'anonymous'}}));
});
test('manual return remains blocked after a newer confirmed lead and unrelated delivery',()=>{
    let metadata=manualHistoricalMetadataV203({},manualAudit());
    metadata=manualHistoricalMetadataV203(metadata,manualAudit({orderId:'EC-NEW',status:'delivered'}));
    const decision=historicalEligibilityV203({phone,legacyLeads:[{phone,status:'confirmado'}],manualReturnHolds:metadata.manualReturnHoldsV203});
    assert.equal(decision.reason,'previous_order_not_picked_up');
    assert.equal(decision.paymentMode,'prepaid_only');
    assert.equal(historicalEligibilityV203({phone:'593990000002',manualReturnHolds:metadata.manualReturnHoldsV203}).eligible,true);
});
test('manual correction clears only the same old order and retains other returns and audit',()=>{
    let metadata=manualHistoricalMetadataV203({},manualAudit());
    metadata=manualHistoricalMetadataV203(metadata,manualAudit({orderId:'EC-OTHER'}));
    metadata=manualHistoricalMetadataV203(metadata,manualAudit({orderId:'EC-OTHER',status:'delivered'}));
    assert.equal(historicalEligibilityV203({phone,manualReturnHolds:metadata.manualReturnHoldsV203}).eligible,false);
    metadata=manualHistoricalMetadataV203(metadata,manualAudit({status:'delivered'}));
    assert.equal(historicalEligibilityV203({phone,manualReturnHolds:metadata.manualReturnHoldsV203}).eligible,true);
    assert.equal(metadata.manualHistoricalStatusHistoryV203.length,4);
    assert.equal(metadata.manualReturnResolutionV203.previousHold.orderId,'EC-OLD');
    assert.throws(()=>manualHistoricalMetadataV203({},manualAudit({source:'anonymous'})));
});
test('correct official create field and legacy spelling both require a real order id',()=>{
    for(const key of ['is_successful','is_succesfull','isSuccess']) assert.equal(normalizeDropiBffCreateResponse({[key]:true,data:{orderId:1234567}}).isSuccess,true);
    assert.equal(normalizeDropiBffCreateResponse({is_successful:true,isSuccess:false,data:{orderId:1234567}}).isSuccess,false);
    assert.equal(normalizeDropiBffCreateResponse({is_successful:'true',data:{orderId:1234567}}).isSuccess,false);
});
test('a successful quote, missing ID, multiple IDs and error never prove creation',()=>{
    for(const body of [{is_successful:true,status_reason:'Quote retrieved successfully',data:{objects:[{distributionCompany:{id:1}}]}},{is_successful:true,data:{}},{is_successful:true,data:{orderId:[123,456]}},{is_successful:false,data:{orderId:123}},{is_successful:true,data:{orderId:'NaN'}}]) assert.equal(normalizeDropiBffCreateResponse(body).isSuccess,false);
});

test('create rejects explicit errors, non-success status and unsafe numeric identifiers',()=>{
    for(const extra of [{error:'failed'},{errors:['failed']},{status_code:422},{data:{orderId:Number.MAX_SAFE_INTEGER+1}},{data:{orderId:123,error:'failed'}}]) {
        assert.equal(normalizeDropiBffCreateResponse({is_successful:true,data:{orderId:123},...extra}).isSuccess,false);
    }
    assert.equal(normalizeDropiBffCreateResponse({is_successful:true,status_code:201,data:{orderId:123},errors:[]}).isSuccess,true);
});

test('official list success spelling never hides explicit failure or conflict',()=>{
    const check=body=>validateDropiBffListContract({httpStatus:200,jsonValid:true,contentTypeClass:'JSON',body});
    assert.equal(check({is_successful:true,data:{objects:[]}}).ok,true);
    assert.equal(check({is_successful:false,data:{objects:[]}}).ok,false);
    assert.equal(check({is_successful:true,isSuccess:false,data:{objects:[]}}).ok,false);
    assert.equal(check({is_successful:'true',data:{objects:[]}}).ok,false);
});

test('global public no-password preference does not erase an explicit protected-route credential',async()=>{
 const{auth,env}=authModule();env.PANEL_AUTH_DISABLED='true';let status;
 const req={hostname:'ec.maxlien.shop',ip:'203.0.113.10',headers:{authorization:'Bearer invalid'}};
 assert.equal(auth.isPanelAuthDisabled(req),true);
 await auth.authMiddleware(req,{status(code){status=code;return this;},json(){}},()=>assert.fail('invalid protected credential accepted'));
 assert.equal(status,401);assert.equal(req.user,undefined);
});
test('explicit non-admin identity cannot obtain admin privileges when public password preference is disabled',()=>{
 const{auth,env}=authModule();env.PANEL_AUTH_DISABLED='true';let status;
 auth.adminOnly({hostname:'ec.maxlien.shop',headers:{authorization:'Bearer valid'},user:{role:'operator'}},{status(code){status=code;return this;},json(){}},()=>assert.fail('admin role bypass'));
 assert.equal(status,403);
});
