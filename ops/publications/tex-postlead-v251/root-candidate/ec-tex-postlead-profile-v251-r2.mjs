import fs from'node:fs';import path from'node:path';import os from'node:os';import assert from'node:assert/strict';import{createHash,timingSafeEqual}from'node:crypto';import{fileURLToPath}from'node:url';
import{texEntryGreetingRegistrationV249 as parentRegistration}from'/usr/local/lib/vitalismen-deploy/ec-tex-entry-greeting-profile-v249-r6.mjs';
import{verifyPublicProxyV213}from'/usr/local/lib/vitalismen-deploy/ec-meta-measurement-transport-v213-r4.mjs';
const DIR='/var/lib/vitalismen-deploy/ec-tex-postlead-v251-r2',ENGINE='/usr/local/lib/vitalismen-deploy/ec-tex-postlead-sealed-v251-r2.mjs',HELPER='/usr/local/lib/vitalismen-deploy/ec-tex-postlead-profile-v251-r2.mjs',CURRENT='/opt/vitalismen-automacao/current';
const PARENT='/opt/vitalismen-automacao/releases/20261117T205344Z_production-20261117-d35d58c',PARENT_COMMIT='d35d58c5a74fb4314d7c3548e614501453ab3ed6',PARENT_TREE='6d01a73371f2e97dbf80bc6f7fee96b18a7251b7',PARENT_SEAL='c3a1a12936f02f47c85a5535c53462a8a0183a81f3f1b459e3f87c2d8ab1e454';
const DEPLOY_PARENT='/opt/vitalismen-automacao/releases/20261117T231233Z_production-20261117-d27cc7c',DEPLOY_PARENT_COMMIT='d27cc7c7f2a21ad74e02ca5b6332ee50b151399b',DEPLOY_PARENT_TREE='c0da29835a547280cc7de3d52f753306eb516032',DEPLOY_PARENT_SEAL='8e366d2d15771077405724db4914f7a81cf557d7fa3136700ed8c71618218a07';
const INHERITED_TEX_HASHES=Object.freeze({"docs/freeze/tex-measurement-v243-contract.json":"3442ba0d1a7464a294028feed4ad1d017cb3311b722efe15d9ebdeb085998b07","scripts/lib/pm2-target-env-restart-v78-r4.mjs":"4b1db49eb1c23bde9a17ee04ecbb29e032698396a1a8ba05d7cdb9a18d38627e","scripts/lib/sealed-successor-preload-v1.mjs":"73165559c2c54720d8afa5c800515ae7570e43433328865ad03dc868a6c61f7f","src/services/agentRouter.js":"d62d43dd8d081cf08dd5a9d938299792009072cbdf201b75dd844fe13319eec1","src/services/metaConversionsService.js":"2239e50af5836a38a2a5069a49d760d597a74d3ea99dc28ef0df01c4f7da954e","src/services/texMeasurementJournalV243.cjs":"44972f0fdbf7529724a49df8d3d3ed2e34b7e4307b1b41547b6f1c787338c905","src/services/texUltraFunnelService.js":"ac1aa3d542fc12ae11404dd8ed5e96e5f3847b42d98bad96ef4ec93212c00152","src/services/texUltraMeasurementV243Service.js":"d7385772b4e09f06567189f15c25fb0fc1e32b7e0d81d8d67aff3da288880ca0","src/services/vitPowerWebChatV220Application.js":"9d2b0800686aa80887dfff2427d8d7d79c8d88df883718dbff7dd38a0dd4fbe7","tests/tex-measurement-purchase-routing-v243.test.mjs":"a3ce30326c15460173a10f1074307294a481330e5bd5b80f0ee6599352cab3db","tests/tex-measurement-runtime-readiness-v243.test.mjs":"ec696e0eb597c1ba610a79b70425a9cc64aaf3d2e14ec4d6538d0001c1a2d223","tests/tex-measurement-v243.test.mjs":"da344b5b10135d9524cbd667195ac5b73ead438cc73863d298fb3ff59692d6b5"});
const ENTRY_PARENT='/opt/vitalismen-automacao/releases/20261118T235313Z_production-20261118-a7f2c6c',ENTRY_PARENT_COMMIT='a7f2c6caa30ee9c6bf8cd0bfcf6a46a272ecc88f',ENTRY_PARENT_TREE='fb406814911240200c756c70f6a4c44b45862ee8',ENTRY_PARENT_SEAL='7fac69d5af302a10599015f8611edd64616fedf9e5f7c01ad4eb022f432236e8';
const HASHES=Object.freeze({"docs/freeze/tex-postlead-v251-contract.json":"66a2f00a984f7b3c7de66936780e9e353eef1f2213701b14212af68c84140249","scripts/lib/pm2-target-env-restart-v78-r4.mjs":"08d45b2a68fb9d94c10d8f2476724bbb44f4341b9fb10b7849d650a51a2b3365","scripts/lib/sealed-successor-preload-v1.mjs":"1a9ba8223de8a3226989bc267a80d5306646a483a2c03a44ccd6d95ee1185f5d","src/services/customerInviteContextV232Service.js":"0e62f5e94da22adf11b8784f91757a4bb7cf773ddf73ad48c364ba798017f948","src/services/customerInvitesV232Service.js":"54da966bc20d593ce2fafba963d737c61ad975fb309d9c8f7c67cc56aae92d67","src/services/texUltraLinkedEntryV242Service.js":"5d7a8c50c68095cb0adf3929623e181d88365732882a1d4b5996cf16366bd255","src/services/texUltraPostLeadInviteV251Service.js":"df8b1f8a6de304cd6067b3dcd06d556ce8bbb1a08d57ee50364f7d26c8a614f3","src/services/vitPowerWebChatV220Application.js":"4e1999ab97e14b89fee474c11c1180a675bf3359b851356d7e6c899e7b508168","tests/tex-postlead-invite-v251.test.mjs":"c4206a5fe103ded5691a71fc4a13d2d82a99d105b16bb0828e975bd3c4659739","tests/tex-postlead-runtime-v251.mjs":"be94cf7a7929a8bad40ae1a98dc032bf61d0091314a1d0adccbc52f2e21ee2f6"});
const sha=b=>createHash('sha256').update(b).digest('hex'),canonical=x=>Buffer.from(JSON.stringify(x,null,2)+'\n');
function regular(p){const s=fs.lstatSync(p);assert(s.isFile()&&!s.isSymbolicLink()&&s.uid===0&&s.gid===0&&s.nlink===1&&(s.mode&0o777)===0o400,'REPURCHASE_ROOT_RECORD');return fs.readFileSync(p)}
function record(p){const bytes=regular(p),x=JSON.parse(bytes);assert.deepEqual(bytes,canonical(x),'REPURCHASE_CANONICAL_RECORD');return x}
export function texPostLeadRegistrationV251(){
 assert.equal(process.getuid(),0);assert.equal(os.hostname(),'srv1182009');
 const a=record(DIR+'/approval.json');assert.equal(a.kind,'HUMAN_APPROVED_EC_TEX_POSTLEAD_V251');assert.equal(a.project,'VITALISMEN_EC');assert.equal(a.activationApproved,true);
 assert.equal(a.authorizationEvidence,'USER_20261118_WHATSAPP_INBOUND_BEFORE_CHAT_INVITATION');assert.equal(a.purpose,'EC_TEX_POSTLEAD_V251');
 assert.equal(a.parentRelease,ENTRY_PARENT);assert.equal(a.parentCommit,ENTRY_PARENT_COMMIT);assert.equal(a.parentTree,ENTRY_PARENT_TREE);assert.equal(a.parentSeal,ENTRY_PARENT_SEAL);
 assert.match(a.commit,/^[a-f0-9]{40}$/);assert.notEqual(a.commit,ENTRY_PARENT_COMMIT);assert.match(a.tree,/^[a-f0-9]{40}$/);assert.equal(path.dirname(a.release),'/opt/vitalismen-automacao/releases');assert(a.release.endsWith(a.commit.slice(0,7)));assert.notEqual(a.release,ENTRY_PARENT);
 assert.deepEqual(a.hashes,HASHES);assert.match(a.seal,/^[a-f0-9]{64}$/);
 const parent=parentRegistration();assert.equal(parent.commit,ENTRY_PARENT_COMMIT);assert.equal(parent.tree,ENTRY_PARENT_TREE);assert.equal(parent.release,ENTRY_PARENT);
 assert.equal(sha(regular('/var/lib/vitalismen-deploy/sealed-successors-v1/'+ENTRY_PARENT_COMMIT+'.json')),ENTRY_PARENT_SEAL);
 assert.equal(sha(regular('/usr/local/lib/vitalismen-deploy/ec-meta-measurement-transport-v213-r4.mjs')),'87c16d2d4605feeeba6049db194afc0c267ce81c4dfd6f897781673877689dda');
 assert.equal(a.engineSha256,sha(regular(ENGINE)));assert.equal(a.helperSha256,sha(regular(HELPER)));assert.equal(fileURLToPath(import.meta.url),HELPER);
 assert.equal(a.parentApprovalSha256,sha(regular('/var/lib/vitalismen-deploy/ec-tex-entry-greeting-v249-r6/approval.json')));
 assert.equal(a.sourceMetadataSha256,sha(fs.readFileSync(a.release+'/.release-source.json')));assert.equal(a.baseEnvSha256,sha(fs.readFileSync(a.release+'/.env')));assert.equal(a.pm2HelperSha256,sha(fs.readFileSync(a.release+'/scripts/lib/pm2-target-env-restart-v78-r4.mjs')));
 const expected=Object.fromEntries(Object.entries(parent.profiles).map(([name,p])=>[name,{...p,NODE_OPTIONS:p.NODE_OPTIONS.replace(ENTRY_PARENT,a.release)}]));
 assert.equal(a.inheritedTexMeasurementProofSha256,sha(regular('/var/lib/vitalismen-deploy/ec-tex-measurement-v243-r5/tex-measurement-qa-proof.json')));
 assert.deepEqual(a.profiles,expected,'REPURCHASE_PROFILE_DRIFT');for(const p of Object.values(a.profiles)){assert.equal(p.VITALISMEN_META_PURCHASE_ENABLED,'false');assert.equal(p.SERVER_FUNNEL_ENABLED,'false');assert.equal(p.AI_WORKER_ENABLED,'false');assert.equal(p.DROPPI_EC_ACTIVE_SYNC_MODE,'REPORT_ONLY')}
 return Object.freeze(a);
}
export function readWebChatPolicyV220(engineFile){
 if(process.env.VITALISMEN_EC_B01_V216!=='true'||process.env.VITALISMEN_EC_FREEFLOW_PRIORITY_V219!=='true'||process.env.VITALISMEN_EC_WEB_CHAT_V220!=='true')return null;
 assert.equal(fs.realpathSync(engineFile),ENGINE);const a=texPostLeadRegistrationV251(),s=record(DIR+'/activation.json');assert.equal(s.commit,a.commit);assert.equal(s.approvalSha256,sha(regular(DIR+'/approval.json')));
 const fixture=process.env.GIRA21X_FIXTURE_PROFILE_V1==='true',current=fs.realpathSync(CURRENT),script=process.argv[1]||'',isolated=fs.readlinkSync('/proc/self/ns/net')!==fs.readlinkSync('/proc/1/ns/net')&&Object.keys(os.networkInterfaces()).every(k=>k==='lo');
 const npmReadOnly=script==='/usr/lib/node_modules/npm/bin/npm-cli.js'&&process.argv.slice(2).join(' ')==='run senior:check'&&fs.realpathSync(process.cwd())===a.release&&isolated;
 const pm2Boot=script==='/usr/lib/node_modules/pm2/lib/ProcessContainerFork.js'&&process.env.pm_exec_path===CURRENT+'/src/index.js'&&process.env.NODE_OPTIONS==='--import=file://'+CURRENT+'/scripts/lib/sealed-successor-preload-v1.mjs';
 assert(script.startsWith(a.release+'/')||current===a.release&&script.startsWith(CURRENT+'/')||pm2Boot||npmReadOnly,'REPURCHASE_UNREGISTERED_LAUNCHER');
 if(s.state==='PREPARED'){assert(isolated,'REPURCHASE_PRECHECK_NETWORK_REQUIRED');assert([ENTRY_PARENT,a.release].includes(current));assert(![a.release+'/src/index.js',CURRENT+'/src/index.js'].includes(script),'REPURCHASE_PREPARED_BUSINESS_BOOT_FORBIDDEN')}
 else{assert.equal(s.state,'ACTIVE');assert(!fixture,'REPURCHASE_ACTIVE_FIXTURE_FORBIDDEN');assert.equal(current,a.release);assert.equal(s.runtimeAllowed,true)}
 const postSale=!fixture&&script===a.release+'/scripts/post-sale-full-v188.mjs';if(postSale&&process.argv[2]==='run')assert.equal(s.postSaleApproved,true);
 if(fixture)assert(![a.release+'/src/index.js',CURRENT+'/src/index.js',a.release+'/scripts/post-sale-full-v188.mjs'].includes(script),'REPURCHASE_FIXTURE_BUSINESS_BOOT_FORBIDDEN');
 const name=fixture?'fixture':postSale?(current===a.release?'postSaleLive':'postSale'):(current===a.release?'botLive':'bot'),launcher=script===a.release+'/scripts/lib/pm2-target-env-restart-v78-r4.mjs';
 for(const[k,v]of Object.entries(a.profiles[name]))assert.equal(launcher&&k==='NODE_OPTIONS'?process.argv[4]:process.env[k],v,'REPURCHASE_PROFILE:'+k);
 const old=record('/var/lib/vitalismen-deploy/gira21x-bridge-policy-v1.json');assert.equal(old.scope,'EC_FORWARD_ONLY');assert.equal(old.qaVerified,true);assert.equal(old.runtimeAllowed,true);
 for(const[p,digest]of [[old.historicalEngineBackup,'a244e3154d62de26f25d15ad3f33292fd27724623fe34efd1503b9c964ce0805'],['/usr/local/lib/vitalismen-callback-gate-v2/gate.cjs',old.gatewayCodeSha256],['/var/lib/vitalismen-deploy/callback-gate-v2-config.json',old.gatewayConfigSha256]])assert.equal(sha(fs.readFileSync(p)),digest,'REPURCHASE_PARENT_RUNTIME_INTEGRITY');
 return Object.freeze({...old,commit:a.commit,tree:a.tree,release:a.release,engineSha256:a.engineSha256,sourceMetadataSha256:a.sourceMetadataSha256,baseEnvSha256:a.baseEnvSha256,pm2HelperSha256:a.pm2HelperSha256,historicalEngineSha256:'a244e3154d62de26f25d15ad3f33292fd27724623fe34efd1503b9c964ce0805',runtimeAllowed:s.state==='ACTIVE',scope:s.state==='ACTIVE'?'EC_FORWARD_ONLY':'ISOLATED_PRECHECK'});
}
export function publishMeasurementRuntimeContextV213(){
 publishTexPostLeadCapabilityV251();
 publishTexEntryGreetingCapabilityV249();
 publishTexMeasurementCapabilityV243();
 publishTexLinkedEntryCapabilityV242();
 publishCustomerInviteCapabilityV232();
 publishBurstReplyCapabilityV228();
 publishB01CapabilityV216();
 publishQuestionPriorityCapabilityV219();
 publishWebChatCapabilityV220();
 publishScopedMeasurementCapabilityV213();
 publishPrincipalSdrCapabilityV212();
 publishPostSaleReadCapabilityV210();
 const p=readWebChatPolicyV220(ENGINE);assert(p);const a=texPostLeadRegistrationV251(),fixture=process.env.GIRA21X_FIXTURE_PROFILE_V1==='true',receive=!fixture&&p.runtimeAllowed&&process.env.VITALISMEN_EC_BOT_CORE_OPERATIONAL==='true';
 if(receive){const bytes=regular('/var/lib/vitalismen-deploy/gira21x-hmac-v1.secret');process.env.GIRA21X_HMAC_SECRET=bytes.toString();bytes.fill(0)}
 const isCurrent=()=>{try{const s=record(DIR+'/activation.json');return receive&&s.state==='ACTIVE'&&s.runtimeAllowed===true&&s.commit===a.commit&&s.approvalSha256===sha(regular(DIR+'/approval.json'))&&fs.realpathSync(CURRENT)===a.release}catch{return false}};
 Object.defineProperty(globalThis,'__VITALISMEN_GIRA21X_BRIDGE_CONTEXT',{configurable:false,enumerable:false,writable:false,value:Object.freeze({loaded:true,kind:'GIRA21X_EC_BRIDGE_RUNTIME_V1',receive,prepaidContract:'GIRA21X_EC_STRIPE_PREPAID_V1',notices:receive&&process.env.GIRA21X_NOTICES_ENABLED==='true',commit:a.commit,tree:a.tree,isCurrent})});
}

export function publishPostSaleReadCapabilityV210(){
 const p=readWebChatPolicyV220(ENGINE),a=texPostLeadRegistrationV251();assert(p);
 const fixture=process.env.GIRA21X_FIXTURE_PROFILE_V1==='true';
 const allowed=fixture||p.runtimeAllowed&&process.argv[1]===a.release+'/scripts/post-sale-full-v188.mjs';
 const isCurrent=()=>{try{const s=record(DIR+'/activation.json');
  const stateOk=fixture?s.state==='PREPARED'&&fs.readlinkSync('/proc/self/ns/net')!==fs.readlinkSync('/proc/1/ns/net'):s.state==='ACTIVE'&&s.runtimeAllowed===true&&s.postSaleApproved===true&&fs.realpathSync(CURRENT)===a.release;
  return allowed&&stateOk&&s.commit===a.commit&&s.approvalSha256===sha(regular(DIR+'/approval.json'));
 }catch{return false}};
 Object.defineProperty(globalThis,'__VITALISMEN_EC_POSTSALE_TRACKING_V210',{configurable:false,enumerable:false,writable:false,value:Object.freeze({kind:'EC_POSTSALE_READ_ONLY_V210',isCurrent})});
}

export function publishPrincipalSdrCapabilityV212(){
 const p=readWebChatPolicyV220(ENGINE),a=texPostLeadRegistrationV251();assert(p);
 const fixture=process.env.GIRA21X_FIXTURE_PROFILE_V1==='true';
 const canHandle=phone=>{try{
  const s=record(DIR+'/activation.json');
  if(fixture||s.state!=='ACTIVE'||!s.runtimeAllowed||s.commit!==a.commit||s.approvalSha256!==sha(regular(DIR+'/approval.json'))||fs.realpathSync(CURRENT)!==a.release)return false;
  if(phone==='5515998038637')return true;
  if(s.freeflowAudience!=='EC_FORWARD_ONLY'||!/^593[2-79]\d{8}$/.test(phone))return false;
  const proof=record('/var/lib/vitalismen-deploy/ec-principal-sdr-v212-r11/qa-proof.json');
  return proof.kind==='REAL_ZAPI_PRINCIPAL_SDR_QA_V212'&&proof.commit==='db53328dfb0205704dc034f551f7aa40c9247317'&&proof.phone==='5515998038637'&&proof.inboundProvider==='zapi'&&proof.replyProvider==='zapi'&&proof.replyAck>=2&&proof.modelSuccess===true&&a.inheritedFreeflowProofSha256==='bdd09fea8f5d0b84fe390c2d093164e3dd52929ad58b80f03ceaeb79c8d08bad'&&a.inheritedFreeflowProofSha256===sha(regular('/var/lib/vitalismen-deploy/ec-principal-sdr-v212-r11/qa-proof.json'));
 }catch{return false}};
 Object.defineProperty(globalThis,'__VITALISMEN_EC_PRINCIPAL_SDR_V212',{configurable:false,enumerable:false,writable:false,value:Object.freeze({kind:'PRINCIPAL_SDR_FREEFLOW_V212',canHandle})});
}

export function publishScopedMeasurementCapabilityV213(){
 const a=texPostLeadRegistrationV251(),fixture=process.env.GIRA21X_FIXTURE_PROFILE_V1==='true';
 const readPolicy=()=>{try{
  const s=record(DIR+'/activation.json'),proof=record(DIR+'/meta-credential-proof.json');
  const active=!fixture&&s.state==='ACTIVE'&&s.runtimeAllowed===true&&s.measurementAllowed===true&&s.commit===a.commit&&s.approvalSha256===sha(regular(DIR+'/approval.json'))&&fs.realpathSync(CURRENT)===a.release;
  const credentialsVerified=proof.datasetId==='28298613626504767'&&proof.http===200&&proof.eventsReceived===1&&proof.accepted===true&&s.metaCredentialProofSha256===sha(regular(DIR+'/meta-credential-proof.json'));
  return Object.freeze({collectionApproved:active,approved:active,credentialsVerified,dataset:'28298613626504767',activatedAt:s.measurementActivatedAt});
 }catch{return Object.freeze({collectionApproved:false,approved:false,credentialsVerified:false,dataset:'28298613626504767'})}};
 Object.defineProperty(globalThis,'__VITALISMEN_EC_MEASUREMENT_V213',{configurable:false,enumerable:false,writable:false,value:Object.freeze({
  kind:'SEALED_VITPOWER_MEASUREMENT_V213',dataset:'28298613626504767',readPolicy,
  clientContext:req=>{if(!readPolicy().approved)return null;return verifyPublicProxyV213(req,regular(DIR+'/proxy-bridge.secret').toString().trim())},
  token:()=>{assert(readPolicy().approved);return regular(DIR+'/meta-token.secret').toString().trim()}
 })});
}

export function publishB01CapabilityV216(){
 const a=texPostLeadRegistrationV251(),fixture=process.env.GIRA21X_FIXTURE_PROFILE_V1==='true';
 const readPolicy=()=>{try{
  const s=record(DIR+'/activation.json');
  const enabled=!fixture&&s.state==='ACTIVE'&&s.runtimeAllowed===true&&s.b01Allowed===true
   &&s.commit===a.commit&&s.approvalSha256===sha(regular(DIR+'/approval.json'))&&fs.realpathSync(CURRENT)===a.release;
  return Object.freeze({enabled,activatedAt:s.b01ActivatedAt});
 }catch{return Object.freeze({enabled:false})}};
 Object.defineProperty(globalThis,'__VITALISMEN_EC_B01_V216',{configurable:false,enumerable:false,writable:false,value:Object.freeze({kind:'EC_B01_V216',readPolicy})});
}

export function publishQuestionPriorityCapabilityV219(){
 const a=texPostLeadRegistrationV251(),fixture=process.env.GIRA21X_FIXTURE_PROFILE_V1==='true';
 const canHandle=phone=>{try{
  const s=record(DIR+'/activation.json');
  if(fixture||s.state!=='ACTIVE'||s.priorityAllowed!==true||s.runtimeAllowed!==true||s.commit!==a.commit||s.approvalSha256!==sha(regular(DIR+'/approval.json'))||fs.realpathSync(CURRENT)!==a.release)return false;
  if(!globalThis.__VITALISMEN_EC_PRINCIPAL_SDR_V212?.canHandle?.(phone))return false;
  if(phone==='5515998038637')return true;
  if(s.priorityAudience!=='EC_FORWARD_ONLY'||!/^593[2-79]\d{8}$/.test(phone))return false;
  const proof=record('/var/lib/vitalismen-deploy/ec-freeflow-priority-v219-r4/qa-proof.json');
  return proof.kind==='REAL_ZAPI_ORDERED_QUESTIONS_V219'&&proof.commit==='822546911b5d2b00e1abde90d8cb5dbecffe72a2'&&proof.phone==='5515998038637'&&proof.modelSuccess===true&&proof.orderedQuestionVersion===219&&proof.replyAck>=2&&a.inheritedPriorityProofSha256===s.priorityQaProofSha256&&s.priorityQaProofSha256===sha(regular('/var/lib/vitalismen-deploy/ec-freeflow-priority-v219-r4/qa-proof.json'));
 }catch{return false}};
 Object.defineProperty(globalThis,'__VITALISMEN_EC_FREEFLOW_V219',{configurable:false,enumerable:false,writable:false,value:Object.freeze({kind:'ORDERED_QUESTIONS_V219',canHandle})});
}

const TEX_PARENT_PAYLOAD_V241=Object.freeze({"src/services/texUltraWebFunnelV240Service.js":"5ba57d71e01dfa1560e571b72c9a7ac9c98dda1b6fa2fb6989456e13e5bb9bdb","src/services/vitPowerWebAgentV220Service.js":"bf1b81bad2f6d5530442e03932469beec67401c1a211b75f032ffc9f29902bc8","src/services/vitPowerWebVoiceStatusV231Service.js":"6e4659d2b114ebccabf20d91a466621a6b28548722fa66e9b6d8a17d82e3c04a"});
function inheritedTexPayloadV241(a){return Object.entries(TEX_PARENT_PAYLOAD_V241).every(([n,d])=>sha(fs.readFileSync(path.join(PARENT,n)))===d&&sha(fs.readFileSync(path.join(a.release,n)))===d)}
export function publishWebChatCapabilityV220(){
 const a=texPostLeadRegistrationV251(),fixture=process.env.GIRA21X_FIXTURE_PROFILE_V1==='true';
 const equal=(x,p)=>{try{const actual=Buffer.from(String(x||'')),expected=regular(p);return actual.length===64&&actual.length===expected.length&&timingSafeEqual(actual,expected)}catch{return false}};
 const isTex=req=>{const h=req.headers||{};return ['https://plusmen.shop','https://www.plusmen.shop'].includes(h.origin)&&h['x-vitalismen-chat-page']==='plusmen-tex-v240'&&equal(h['x-vitalismen-chat-proxy'],DIR+'/tex-web-proxy.secret')};
 const requestAllowed=req=>{try{
  const s=record(DIR+'/activation.json');
  if(fixture||s.state!=='ACTIVE'||s.runtimeAllowed!==true||s.webAllowed!==true||s.commit!==a.commit||s.approvalSha256!==sha(regular(DIR+'/approval.json'))||fs.realpathSync(CURRENT)!==a.release)return false;
  if(req.method!=='POST'||String(req.originalUrl||req.path||'').split('?')[0]!=='/api/web-chat/vitpower')return false;
  const h=req.headers||{};
  if(isTex(req)){
   if(s.texWebAllowed!==true)return false;
   if(s.texWebAudience==='PRIVATE_QA')return equal(h['x-vitalismen-chat-qa'],DIR+'/tex-web-qa.secret');
   if(s.texWebAudience!=='PUBLIC_SITE')return false;
   const proof=record(DIR+'/tex-web-qa-proof.json');
   return proof.kind==='TEX_ULTRA_WEB_QA_V240'&&proof.commit==='30ca9d6f77788186ada1ca7ab2a8cd0962f773b9'&&inheritedTexPayloadV241(a)&&a.inheritedTexWebProofSha256===sha(regular(DIR+'/tex-web-qa-proof.json'))&&proof.realModel===true&&proof.sameOriginProxy===true&&proof.cookieIsolation===true&&proof.anaVoiceId==='qHkrJuifPpn95wK3rm2A'&&proof.anaVoiceAudioVerified===true&&s.texWebQaProofSha256===sha(regular(DIR+'/tex-web-qa-proof.json'));
  }
  if(h.origin!=='https://taviazen.shop'||!equal(h['x-vitalismen-chat-proxy'],DIR+'/web-proxy.secret'))return false;
  if(s.webAudience==='PRIVATE_QA')return equal(h['x-vitalismen-chat-qa'],DIR+'/web-qa.secret');
  if(s.webAudience!=='PUBLIC_SITE')return false;
  const proof=record('/var/lib/vitalismen-deploy/ec-web-chat-v220-r4/web-qa-proof.json');
  return proof.kind==='REAL_WEB_CHAT_V220'&&proof.commit==='025c90c7d5af299e206ee246341d2ec507d929ca'&&proof.realModel===true&&proof.sameOriginProxy===true&&proof.cookieIsolation===true&&a.inheritedWebProofSha256===s.webQaProofSha256&&s.webQaProofSha256===sha(regular('/var/lib/vitalismen-deploy/ec-web-chat-v220-r4/web-qa-proof.json'));
 }catch{return false}};
 Object.defineProperty(globalThis,'__VITALISMEN_EC_WEB_CHAT_V220',{configurable:false,enumerable:false,writable:false,value:Object.freeze({kind:'ANONYMOUS_WEB_V220',storeDirectory:'/var/lib/vitalismen-web-chat-v220-r2',requestAllowed,entryV242Allowed:req=>requestAllowed(req)&&isTex(req)&&linkedEntryPolicyV242(req),productForRequest:req=>requestAllowed(req)&&isTex(req)?'tex_ultra_ec':'vit_power_ec'})});
}

export function publishBurstReplyCapabilityV228(){
 const a=texPostLeadRegistrationV251(),fixture=process.env.GIRA21X_FIXTURE_PROFILE_V1==='true';
 const readPolicy=()=>{try{
  const s=record(DIR+'/activation.json');
  const current=!fixture&&process.env.VITALISMEN_EC_BURST_REPLY_V228==='true'&&s.state==='ACTIVE'&&s.runtimeAllowed===true&&s.burstAllowed===true
   &&s.commit===a.commit&&s.approvalSha256===sha(regular(DIR+'/approval.json'))&&fs.realpathSync(CURRENT)===a.release;
  if(!current||!['QA_ONLY','EC_FORWARD_ONLY'].includes(s.burstAudience)||!Number.isFinite(Date.parse(s.burstActivatedAt)))return Object.freeze({enabled:false});
  const isolated=s.privateStartupProbeOnly===true&&fs.readlinkSync('/proc/self/ns/net')!==fs.readlinkSync('/proc/1/ns/net')&&Object.keys(os.networkInterfaces()).every(k=>k==='lo');
  if(s.privateStartupProbeOnly===true&&!isolated)return Object.freeze({enabled:false});
  if(s.burstAudience==='EC_FORWARD_ONLY'&&!isolated){
   const proof=record(DIR+'/burst-qa-proof.json');
   assert.equal(s.burstQaProofSha256,sha(regular(DIR+'/burst-qa-proof.json')));assert.equal(proof.kind,'REAL_ZAPI_BURST_V228');assert.equal(proof.commit,'c03acf15b9baeee4116577b01caf3c0fd194cac4');assert.equal(a.inheritedBurstProofSha256,sha(regular(DIR+'/burst-qa-proof.json')));
   assert.equal(proof.phone,'5515998038637');assert.equal(proof.realInbound,true);assert.equal(proof.groupedReply,true);assert(proof.quietSeconds>=60);assert(proof.replyAck>=2);
  }
  return Object.freeze({enabled:true,activatedAt:s.burstActivatedAt,audience:isolated?'ISOLATED_TEST':s.burstAudience});
 }catch{return Object.freeze({enabled:false})}};
 Object.defineProperty(globalThis,'__VITALISMEN_EC_BURST_V228',{configurable:false,enumerable:false,writable:false,value:Object.freeze({kind:'PERSISTED_QUIET_WINDOW_V228',readPolicy})});
}

export function publishCustomerInviteCapabilityV232(){
 const a=texPostLeadRegistrationV251(),fixture=process.env.GIRA21X_FIXTURE_PROFILE_V1==='true';
 const readPolicy=()=>{try{const s=record(DIR+'/activation.json');return Object.freeze({enabled:!fixture&&s.state==='ACTIVE'&&s.runtimeAllowed===true&&s.customerInvitesAllowed===true&&s.postSaleApproved===true&&s.commit===a.commit&&s.approvalSha256===sha(regular(DIR+'/approval.json'))&&fs.realpathSync(CURRENT)===a.release&&process.argv[1]===a.release+'/scripts/post-sale-full-v188.mjs',minimumGapMs:600000,partnerGapMs:43200000,generalChat:true})}catch{return Object.freeze({enabled:false})}};
 Object.defineProperty(globalThis,'__VITALISMEN_EC_CUSTOMER_INVITES_V232',{configurable:false,enumerable:false,writable:false,value:Object.freeze({kind:'EC_CUSTOMER_INVITES_V232',readPolicy})});
}

const LINKED_PARENT_PAYLOAD_V243=Object.freeze({"src/services/agentRouter.js":"b0482515e93ff2d710fbf06a0ebc42ff16050fdc6d20c8eb4c0b7339dc2a349c","src/services/texUltraEntryBlockV242Service.js":"7bdeadbbd4254bd3ed8cfd3a460714bc94bc94f736835801bfa531b6dd3a646f","src/services/texUltraFunnelService.js":"f67a406481c10d4ac70859d7d0a711a6b4f399750c6dd59cbfaf4c32d39fd8b3","src/services/texUltraInitialLayerService.js":"3f4bfb40565213fb7494d81f6af08842f9edb3deefe0f78960b39855a57949d0","src/services/texUltraLinkedEntryV242Service.js":"fff753305f4015159a1c149392fbe97bc4f47b1b2c5ef25d856752ea97762735","src/services/texUltraLinkedRuntimeV242Service.js":"8047428850e7346c0d47077d6e65821a42d46a38cc253d93da8599b24fd1348f","src/services/vitPowerWebChatV220Application.js":"0b1456e0d78db8f9d3a14fc7a202b3b5007fc14ca11053d6758a839929f7c9ba","src/services/vitPowerWebDashboardV222Service.js":"1113cdeca317733ddced2006dc167f0d483111ce56c02c1af3f770cd1415c858","src/services/vitPowerWebStoreV220Service.js":"69d0f780b93e1ac90b2dc20e2b59aba00fbd6ed01c6e14efb4261865088d233d"});
const TEX_MEASUREMENT_INVERSE_V243=Object.freeze({"src/services/agentRouter.js":{"prefix":"import { observeTexMeasurementV243, texMeasurementReferenceV243 } from './texUltraMeasurementV243Service.js';\n","patches":[{"from":"    await observeTexMeasurementV243({ state, inboundText: body, sourceMessageId: messageId, sessionId, recovered: payload.recovered === true });\n    if (texLinkV242.handled) { await state.save(); return { handled: true, verificationOnly: true }; }\n    if (texMeasurementReferenceV243(body)) body = 'Hola, quiero el tratamiento Tex Ultra.';","to":"    if (texLinkV242.handled) { await state.save(); return { handled: true, verificationOnly: true }; }"},{"from":"    let body = String(payload.body || '');","to":"    const body = String(payload.body || '');"}]},"src/services/vitPowerWebChatV220Application.js":{"prefix":"import { bindTexMeasurementCodeV243 } from './texUltraMeasurementV243Service.js';\n","patches":[{"from":"const issued = await links.issue({ sessionId, requestId: body.requestId, firstName, phone: body.phone.replace(/^\\+/, '') });\n          return res.json(await bindTexMeasurementCodeV243(issued, body.measurementRef));","to":"return res.json(await links.issue({ sessionId, requestId: body.requestId, firstName, phone: body.phone.replace(/^\\+/, '') }));"},{"from":"['action', 'requestId', 'message', 'accessToken', 'firstName', 'phone', 'measurementRef']","to":"['action', 'requestId', 'message', 'accessToken', 'firstName', 'phone']"}]},"src/services/texUltraFunnelService.js":{"prefix":"import { bindTexMeasurementOrderV243 } from './texUltraMeasurementV243Service.js';\n","patches":[{"from":"        if (order.tracking?.measurementVersion !== 243) await enrichOrderWithMetaAttribution(order).catch(() => null);","to":"        await enrichOrderWithMetaAttribution(order).catch(() => null);"},{"from":"    else order = new Order({ ...payload, entryAt: new Date(), draftCreatedAt: new Date() });\r\n    await bindTexMeasurementOrderV243(order, state);\r\n    await order.save();","to":"    else order = new Order({ ...payload, entryAt: new Date(), draftCreatedAt: new Date() });\r\n    await order.save();"}]}});
const POSTLEAD_INVERSE_V251=Object.freeze({"src/services/texUltraLinkedEntryV242Service.js":{"parentSha256":"fff753305f4015159a1c149392fbe97bc4f47b1b2c5ef25d856752ea97762735","patches":[{"before":"const dirs = ['pending', 'codes', 'links', 'journeys', 'locks', 'limits'];","after":"const dirs = ['pending', 'codes', 'links', 'journeys', 'locks', 'limits', 'invitations'];"},{"before":"  return Object.freeze({ identity,","after":"  return Object.freeze({ identity,\n    async issueWhatsappInvitation({ phone, firstName, inboundId, verifiedInbound }) {\n      if (!validPhone(phone) || verifiedInbound !== true || typeof inboundId !== 'string' || !inboundId || inboundId.length > 250) throw Error('tex_link_invitation_invalid');\n      if (await currentContactHold(phone)) throw Error('tex_link_invitation_unavailable');\n      const journey = await reserveJourney(phone, 'whatsapp', { existingEntry: true });\n      return lock('phone:' + journey.id, async () => {\n        const fresh = await read(file('journeys', journey.id));\n        if (!fresh || fresh.blocked || fresh.firstChannel !== 'whatsapp') throw Error('tex_link_invitation_unavailable');\n        if (fresh.invitationV251) {\n          if (fresh.invitationV251.expiresAt <= now()) throw Error('tex_link_invitation_expired');\n          return { url: 'https://plusmen.shop/tex#chat=' + fresh.invitationV251.token };\n        }\n        const token = randomBytes(32).toString('hex'), expiresAt = now() + 604800000;\n        const name = String(firstName || '').replace(/[\\r\\n\\u0000-\\u001f]/g, ' ').trim().split(/\\s+/)[0].slice(0, 30);\n        await lock('admission', async () => {\n          await capacity('invitations');\n          await write(file('invitations', hash(token)), { version: 251, phone, firstName: name,\n            journeyId: journey.id, inboundId, issuedAt: now(), expiresAt, boundSession: '' });\n        });\n        await write(file('journeys', journey.id), { ...fresh, invitationV251: { token, expiresAt } });\n        return { url: 'https://plusmen.shop/tex#chat=' + token };\n      });\n    },\n    async invitationAvailable(token) {\n      if (!SESSION.test(token || '')) return false;\n      await initialize(); const invitation = await read(file('invitations', hash(token)));\n      return !expired(invitation) && invitation.version === 251 && validPhone(invitation.phone);\n    },\n    async acceptWhatsappInvitation({ token, sessionId }) {\n      if (!SESSION.test(token || '') || !SESSION.test(sessionId || '')) throw Error('tex_link_invitation_invalid');\n      return lock('invitation:' + hash(token), () => lock('session:' + sessionId, async () => {\n        const invitation = await read(file('invitations', hash(token)));\n        if (expired(invitation) || invitation.version !== 251 || !validPhone(invitation.phone)\n          || invitation.boundSession && invitation.boundSession !== sessionId) throw Error('tex_link_invitation_unavailable');\n        const journey = await read(file('journeys', phoneId(invitation.phone)));\n        if (!journey || journey.id !== invitation.journeyId || journey.firstChannel !== 'whatsapp' || journey.blocked\n          || await currentContactHold(invitation.phone)) throw Error('tex_link_invitation_unavailable');\n        const existing = await identity(sessionId);\n        if (existing && existing.phone !== invitation.phone) throw Error('tex_link_invitation_unavailable');\n        if (!invitation.boundSession) await write(file('invitations', hash(token)), { ...invitation, boundSession: sessionId, acceptedAt: now() });\n        await lock('admission', async () => {\n          if (!existing) await capacity('links');\n          await write(file('links', sessionId), { version: 242, sessionId, journeyId: journey.id,\n            phone: invitation.phone, firstName: invitation.firstName, verifiedAt: invitation.issuedAt,\n            expiresAt: invitation.expiresAt, verifiedBy: 'official_zapi_inbound', inboundId: invitation.inboundId });\n        });\n        return { ok: true, verified: true, invitationVersion: 251, firstChannel: 'whatsapp' };\n      }));\n    },\n"}]},"src/services/vitPowerWebChatV220Application.js":{"parentSha256":"9d2b0800686aa80887dfff2427d8d7d79c8d88df883718dbff7dd38a0dd4fbe7","patches":[{"before":"now = () => Date.now() } = {})","after":"now = () => Date.now(), linkedStore = texLinkedStoreV242, postLeadPolicy = texPostLeadPolicyV251 } = {})"},{"before":"links = texLinkedStoreV242();","after":"links = linkedStore();"},{"before":"await texLinkedStoreV242().identity","after":"await linkedStore().identity"},{"before":"import { bindTexMeasurementCodeV243 }","after":"import { texPostLeadPolicyV251 } from './texUltraPostLeadInviteV251Service.js';\nimport { bindTexMeasurementCodeV243 }"},{"before":"'link_status', 'tex_entry'] : ['start'","after":"'link_status', 'tex_entry', 'invite_accept'] : ['start'"},{"before":"      if (body.action === 'clear')","after":"      if (tex && postLeadPolicy().required) {\n        if (!postLeadPolicy().enabled) return res.status(503).json({ ok: false, error: 'tex_link_invitation_unavailable' });\n        if (!linkedEntry) return res.status(403).json({ ok: false, error: 'tex_link_invitation_required' });\n        const links = linkedStore();\n        if (body.action === 'invite_accept') {\n          if (!await links.invitationAvailable(body.accessToken)) return res.status(403).json({ ok: false, error: 'tex_link_invitation_unavailable' });\n          const session = await store.open(readToken(), context); writeCookie(session.token);\n          return res.json(await links.acceptWhatsappInvitation({ token: body.accessToken, sessionId: createHash('sha256').update(session.token).digest('hex') }));\n        }\n        if (body.action !== 'clear') {\n          const token = readToken();\n          const identity = token && await links.identity(createHash('sha256').update(token).digest('hex'));\n          if (!identity) return res.status(403).json({ ok: false, error: 'tex_link_invitation_required' });\n          if (identity.blocked && body.action !== 'link_status') return res.status(403).json({ ok: false, error: 'tex_link_human_hold' });\n        }\n      }\n      if (body.action === 'clear')"}]},"src/services/customerInvitesV232Service.js":{"parentSha256":"e7119298b814600cfa62e98104780967f116d644764cdd5ce7cdf1117592374b","patches":[{"before":"clock = () => now, dryRun = true })","after":"clock = () => now, dryRun = true, texPostLeadEligible = texPostLeadEligibleV251 })"},{"before":"import { createHash, randomUUID }","after":"import { texPostLeadPolicyV251, texPostLeadEligibleV251, buildTexPostLeadInviteV251 } from './texUltraPostLeadInviteV251Service.js';\nimport { createHash, randomUUID }"},{"before":"    const absent = lastActivity","after":"    if (policy.generalChat === true && !contact.returned && lastActivity > 0 && now - lastActivity >= INVITE_GAP_V232\n      && texPostLeadEligible(contact, now)) stages.push({ stage: 'TEX_CHAT_ACCESS', orderId: '' });\n    const absent = lastActivity"},{"before":"|| (['CHAT_ORDER', 'CHAT_ACCESS'].includes(item.stage) && suppressVitPowerInviteForTexV246(fresh)))","after":"|| (['CHAT_ORDER', 'CHAT_ACCESS'].includes(item.stage) && suppressVitPowerInviteForTexV246(fresh))\n          || item.stage === 'TEX_CHAT_ACCESS' && !texPostLeadEligible(fresh, clock()))"},{"before":"        const privateInvite = ['CHAT_ORDER'","after":"        const texInvite = item.stage === 'TEX_CHAT_ACCESS' ? await repository.privateTexInvite(fresh) : null;\n        if (item.stage === 'TEX_CHAT_ACCESS' && !texInvite?.message) throw Error('tex_link_invitation_unavailable');\n        const privateInvite = ['CHAT_ORDER'"},{"before":"        const body = privateInvite?.message ||","after":"        const body = texInvite?.message || privateInvite?.message ||"},{"before":"body.replace(/#pedido=[a-f0-9]{64}/g, '#pedido=[acceso-privado]')","after":"body.replace(/#pedido=[a-f0-9]{64}/g, '#pedido=[acceso-privado]').replace(/#chat=[a-f0-9]{64}/g, '#chat=[acceso-privado]')"},{"before":"    async privateOrderInvite(phone) {","after":"    async privateTexInvite(contact) {\n      const policy = texPostLeadPolicyV251();\n      if (!texPostLeadEligibleV251(contact)) throw Error('tex_link_invitation_unavailable');\n      const inbound = await Messages.findOne({ peerPhone: contact.phoneDigits, provider: 'zapi', sessionId: 'zapi',\n        ownerPhoneDigits: '5531971862958', isFromMe: false, createdAt: { $gte: new Date(policy.cutoff) } }).sort({ createdAt: -1 }).select('_id').lean();\n      if (!inbound) throw Error('tex_link_invitation_unavailable');\n      const { texLinkedStoreV242 } = await import('./texUltraLinkedRuntimeV242Service.js');\n      const name = contact.customerDraft?.name || contact.metadata?.customerDraft?.name || contact.name || contact.metadata?.notifyName || '';\n      const issued = await texLinkedStoreV242().issueWhatsappInvitation({ phone: contact.phoneDigits, firstName: name,\n        inboundId: String(inbound._id), verifiedInbound: true });\n      return { message: buildTexPostLeadInviteV251({ name, url: issued.url }) };\n    },\n    async privateOrderInvite(phone) {"},{"before":"const match = stage === 'CHAT_ACCESS' ?","after":"const match = stage === 'TEX_CHAT_ACCESS' ? { $or: [{ dedupeKey: key }, { body: /https:\\/\\/plusmen\\.shop\\/tex#chat=/ }] }\n        : stage === 'CHAT_ACCESS' ?"}]},"src/services/customerInviteContextV232Service.js":{"parentSha256":"7e6961b8b5eb97ad13063535b4aced5dc2522284f3221179e0cd83a17b6ea339","patches":[{"before":"import { AsyncLocalStorage }","after":"import { texPostLeadPolicyV251, texPostLeadEligibleV251 } from './texUltraPostLeadInviteV251Service.js';\nimport { AsyncLocalStorage }"},{"before":"!['CHAT_ORDER', 'CHAT_ACCESS', 'PARTNER_1', 'PARTNER_2'].includes(job.stage)","after":"!['CHAT_ORDER', 'CHAT_ACCESS', 'PARTNER_1', 'PARTNER_2', 'TEX_CHAT_ACCESS'].includes(job.stage)"},{"before":"  const claim = await Ledger.updateOne","after":"  if (job.stage === 'TEX_CHAT_ACCESS') {\n    const policy = texPostLeadPolicyV251();\n    if (!texPostLeadEligibleV251({ ...recipient, officialInboundVerified: true }) || !policy.enabled\n      || !await Message.exists({ peerPhone: phone, provider: 'zapi', sessionId: 'zapi', ownerPhoneDigits: '5531971862958',\n        isFromMe: false, createdAt: { $gte: new Date(policy.cutoff) } })) throw Error('tex_link_invitation_unavailable');\n  }\n  const claim = await Ledger.updateOne"}]}});
function postLeadParentBytesV251(n,bytes){
 const proof=POSTLEAD_INVERSE_V251[n];if(!proof)return bytes;assert.equal(sha(bytes),HASHES[n]);let text=bytes.toString();
 for(const patch of [...proof.patches].reverse()){assert.equal(text.split(patch.after).length,2);text=text.replace(patch.after,patch.before)}
 const parent=Buffer.from(text);assert.equal(sha(parent),proof.parentSha256);return parent;
}
function inheritedLinkedPayloadV243(a){
 return Object.entries(LINKED_PARENT_PAYLOAD_V243).every(([n,d])=>{
  if(sha(fs.readFileSync(path.join(PARENT,n)))!==d)return false;
  const bytes=postLeadParentBytesV251(n,fs.readFileSync(path.join(a.release,n)));if(sha(bytes)===d)return true;
  const inverse=TEX_MEASUREMENT_INVERSE_V243[n];if(!inverse||sha(bytes)!==INHERITED_TEX_HASHES[n])return false;
  let text=bytes.toString('utf8');if(!text.startsWith(inverse.prefix))return false;text=text.slice(inverse.prefix.length);
  for(const patch of inverse.patches){if(text.split(patch.from).length!==2)return false;text=text.replace(patch.from,patch.to)}
  return sha(Buffer.from(text))===d;
 })&&a.inheritedLinkedEntryProofSha256===sha(regular(DIR+'/linked-entry-qa-proof.json'));
}
function linkedEntryStateV242(){
 try{const a=texPostLeadRegistrationV251(),s=record(DIR+'/activation.json');
 if(process.env.GIRA21X_FIXTURE_PROFILE_V1==='true'||s.state!=='ACTIVE'||s.runtimeAllowed!==true||s.linkedEntryAllowed!==true||s.commit!==a.commit||s.approvalSha256!==sha(regular(DIR+'/approval.json'))||fs.realpathSync(CURRENT)!==a.release)return null;
 return {a,s};}catch{return null}
}
function linkedEntryPolicyV242(req){
 const state=linkedEntryStateV242();if(!state)return false;const {a,s}=state;
 if(s.linkedEntryAudience==='PRIVATE_QA'){
  try{const actual=Buffer.from(String(req?.headers?.['x-vitalismen-chat-qa']||'')),expected=regular(DIR+'/tex-web-qa.secret');return actual.length===expected.length&&timingSafeEqual(actual,expected)}catch{return false}
 }
 if(s.linkedEntryAudience!=='PUBLIC_SITE')return false;
 try{const p=record(DIR+'/linked-entry-qa-proof.json');return p.kind==='TEX_LINKED_ENTRY_V242'&&p.commit==='4c47bb36266d919ce664911aafcf573c7a4d1570'&&inheritedLinkedPayloadV243(a)&&p.officialInboundGuardVerified===true&&p.firstChannelAndRestartDedupeVerified===true&&p.cookieIsolationVerified===true&&p.mediaOrderVerified===true&&p.noOutboundOtpSender===true&&s.linkedEntryQaProofSha256===sha(regular(DIR+'/linked-entry-qa-proof.json'));}catch{return false}
}
export function publishTexLinkedEntryCapabilityV242(){
 const a=texPostLeadRegistrationV251();
 Object.defineProperty(globalThis,'__VITALISMEN_EC_TEX_LINKED_ENTRY_V242',{configurable:false,enumerable:false,writable:false,value:Object.freeze({
  kind:'TEX_LINKED_ENTRY_V242',directory:'/var/lib/vitalismen-tex-linked-entry-v242',officialPhone:'553171862958',ownerPhone:'5531971862958',
  activatedAt:record(DIR+'/activation.json').linkedEntryActivatedAt,
  isStoreCurrent:()=>Boolean(linkedEntryStateV242()),
  isCurrent:()=>linkedEntryPolicyV242(null),allowQa:()=>false
 })});
}

function readLinkedMeasurementRecordV243(kind,id){
 assert(['codes','pending','links'].includes(kind)&&/^[a-f0-9]{64}$/.test(id));
 const p='/var/lib/vitalismen-tex-linked-entry-v242/'+kind+'/'+id+'.json';let fd;
 try{fd=fs.openSync(p,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);const st=fs.fstatSync(fd);assert(st.isFile()&&st.uid===0&&(st.mode&0o077)===0&&st.size<=16384);return JSON.parse(fs.readFileSync(fd,'utf8'))}finally{if(fd!==undefined)fs.closeSync(fd)}
}
export function publishTexMeasurementCapabilityV243(){
 const a=texPostLeadRegistrationV251(),fixture=process.env.GIRA21X_FIXTURE_PROFILE_V1==='true';
 const bytes=regular(DIR+'/tex-measurement.secret');assert.equal(sha(bytes),a.texMeasurementKeySha256);const key=bytes.toString().trim();assert.match(key,/^[a-f0-9]{64}$/);
 const initial=record(DIR+'/activation.json');
 const isCurrent=()=>{try{const s=record(DIR+'/activation.json'),proof=record(DIR+'/tex-measurement-qa-proof.json');
 return !fixture&&s.state==='ACTIVE'&&s.runtimeAllowed===true&&s.texMeasurementV243Allowed===true&&s.commit===a.commit&&s.approvalSha256===sha(regular(DIR+'/approval.json'))&&fs.realpathSync(CURRENT)===a.release
 &&proof.kind==='TEX_MEASUREMENT_V243'&&proof.commit===DEPLOY_PARENT_COMMIT&&proof.pass===true&&proof.noProductionSyntheticEvents===true&&sha(regular(DIR+'/tex-measurement-qa-proof.json'))===a.inheritedTexMeasurementProofSha256&&s.texMeasurementQaProofSha256===sha(regular(DIR+'/tex-measurement-qa-proof.json'));
 }catch{return false}};
 Object.defineProperty(globalThis,'__VITALISMEN_EC_TEX_MEASUREMENT_V243',{configurable:false,enumerable:false,writable:false,value:Object.freeze({
 kind:'TEX_MEASUREMENT_V243',directory:'/var/lib/vitalismen-tex-measurement-v243',officialPhone:'553171862958',ownerPhone:'5531971862958',
 key,activatedAt:initial.texMeasurementActivatedAt,isCurrent,
 confirmedCode:async(code,phone)=>{try{if(!isCurrent()||!/^TX242-[a-f0-9]{64}$/.test(code)||!/^593[2-79]\d{8}$/.test(phone))return false;
  const i=readLinkedMeasurementRecordV243('codes',sha(code));if(!/^[a-f0-9]{64}$/.test(i.sessionId)||i.expiresAt<=Date.now())return false;
  const p=readLinkedMeasurementRecordV243('pending',i.sessionId),link=readLinkedMeasurementRecordV243('links',i.sessionId);
  return p.codeHash===sha(code)&&p.phone===phone&&link.phone===phone&&link.sessionId===i.sessionId&&link.verifiedBy==='official_zapi_inbound'&&Boolean(link.inboundId)&&link.expiresAt>Date.now();
 }catch{return false}}
 })});
}

export function publishTexEntryGreetingCapabilityV249(){
 const a=texPostLeadRegistrationV251(),p=readWebChatPolicyV220(ENGINE);
 const receive=process.env.GIRA21X_FIXTURE_PROFILE_V1!=='true'&&p?.runtimeAllowed===true&&process.env.VITALISMEN_EC_BOT_CORE_OPERATIONAL==='true';
 const isCurrent=()=>{try{const s=record(DIR+'/activation.json');return receive&&s.state==='ACTIVE'&&s.runtimeAllowed===true&&s.commit===a.commit&&s.approvalSha256===sha(regular(DIR+'/approval.json'))&&fs.realpathSync(CURRENT)===a.release}catch{return false}};
 Object.defineProperty(globalThis,'__VITALISMEN_EC_TEX_ENTRY_V249',{configurable:false,enumerable:false,writable:false,value:Object.freeze({kind:'EC_TEX_ENTRY_GREETING_V249',isCurrent})});
}

export function publishTexPostLeadCapabilityV251(){
 const a=texPostLeadRegistrationV251(),p=readWebChatPolicyV220(ENGINE),fixture=process.env.GIRA21X_FIXTURE_PROFILE_V1==='true';
 const isCurrent=()=>{try{const s=record(DIR+'/activation.json');return !fixture&&p?.runtimeAllowed===true&&s.state==='ACTIVE'&&s.runtimeAllowed===true&&s.commit===a.commit&&s.approvalSha256===sha(regular(DIR+'/approval.json'))&&Number.isFinite(Date.parse(s.texPostLeadActivatedAt))&&fs.realpathSync(CURRENT)===a.release}catch{return false}};
 const activatedAt=()=>{try{return Date.parse(record(DIR+'/activation.json').texPostLeadActivatedAt)}catch{return NaN}};
 Object.defineProperty(globalThis,'__VITALISMEN_EC_TEX_POSTLEAD_V251',{configurable:false,enumerable:false,writable:false,value:Object.freeze({kind:'EC_TEX_POSTLEAD_V251',required:!fixture,isCurrent,activatedAt})});
}
