from pathlib import Path
import ast,hashlib,json,tempfile,time
H=Path(__file__).resolve().parent;s=(H/'operations-controller.py').read_text();nodes={n.name:n for n in ast.parse(s).body if isinstance(n,ast.FunctionDef)}
def load(name,scope):exec(compile(ast.fix_missing_locations(ast.Module(body=[nodes[name]],type_ignores=[])),'<isolated-controller-test>','exec'),scope)
checks=[]
with tempfile.TemporaryDirectory(prefix='vitalismen-v232-controller-')as tmp:
 root=Path(tmp);B=root/'B';STATE=root/'state';R=root/'release';P=root/'parent';sessions=root/'sessions';sessions.mkdir()
 class Paths:
  @staticmethod
  def Path(value):return sessions if value=='/var/lib/vitalismen-web-chat-v220-r2/sessions'else Path(value)
 scope={'pathlib':Paths,'time':time,'json':json};load('assert_web_idle',scope);scope['assert_web_idle']();checks.append('empty_chat_allows_restart')
 file=sessions/('a'*64+'.json');file.write_text(json.dumps({'expiresAt':time.time()*1000+60000,'requests':{'one':{'status':'processing','at':time.time()*1000}}}))
 try:scope['assert_web_idle']();raise RuntimeError('processing not blocked')
 except AssertionError:checks.append('processing_chat_blocks_restart')
 file.write_text(json.dumps({'expiresAt':time.time()*1000-1,'requests':{'one':{'status':'processing','at':time.time()*1000}}}));scope['assert_web_idle']();checks.append('expired_chat_not_blocking')
 a={'commit':'new','release':str(R),'parentRelease':str(P),'hashes':{'file':'digest'},'inheritedBurstProofSha256':'burst'}
 cases={'QUALIFICATION':{'status':'PASS','candidateCommit':'new','productionUnchanged':True,'results':[{'name':'complete_senior','pass':True}]},'EXTRA_QUALIFICATION':{'status':'PASS','activeReleaseUnchanged':True,'productionDatabaseWrites':0,'whatsappSends':0},'CODE_CONFIG_RECOVERY':{'status':'PASS_CODE_CONFIG_RECOVERY_ONLY'},'NATIVE_HOOKS_TEST':{'pass':True,'candidateCommit':'new','productionWrites':0,'realMetaRequests':0,'scopedMongoGuardExercised':True,'checkoutEvents':2,'purchaseEvents':2},'BROWSER_TEST':{'pass':True,'networkIntercepted':True,'realOrders':0},'PANEL_BROWSER_TEST':{'pass':True,'networkIntercepted':True,'productionWrites':0},'INHERITED_REGRESSION':{'pass':True,'candidateCommit':'new','existingCommercialCoreUnchanged':True,'noDatabaseMigrations':True,'protectedFiles':{}},'PUBLIC_BASELINE':{'pass':True,'panelSha256':'panel','panelCandidateSha256':'panel','nginxSha256':'nginx'},'OPERATIONS_TEST':{'pass':True},'PUBLIC_BROWSER_TEST':{'pass':True},'INHERITED_CONTROL':{'pass':True,'files':{}}}
 digest=lambda v:hashlib.sha256(json.dumps(v,sort_keys=True).encode()).hexdigest()
 cases.pop('PANEL_BROWSER_TEST');cases.pop('PUBLIC_BROWSER_TEST')
 cases['HTTP_SALE_TEST']={'pass':True,'functionalCommit':'new','productionWrites':0,'realMetaEvents':0,'realWhatsAppSends':0,'realDropiOrders':0,'productionUnchanged':True,'actualHttpApp':True,'actualSqliteMirror':True,'scopedMetaSimulation':{'ledgerRows':6}}
 cases['BROWSER_TEST']['productionWrites']=0
 binding={'candidateCommit':'new','hashes':a['hashes'],'gates':{n:digest(v)for n,v in cases.items()}}
 def read(p):
  n=Path(p).name
  if n=='BASELINE.json':return {'baseEnvSha256':'env','currentSourceMetadataSha256':'source'}
  if n=='BINDINGS.json':return binding
  return cases[Path(p).stem]
 def sha(p):
  n=Path(p).name
  if n=='.env':return 'env'
  if n=='.release-source.json':return 'source'
  if n=='qr.html':return 'panel'
  if n=='ec.maxlien.shop.clean.conf':return 'nginx'
  if n=='burst-qa-proof.json':return 'burst'
  return digest(cases[Path(p).stem])
 scope={'approval':lambda:(a,R),'read':read,'sha':sha,'B':B,'STATE':STATE,'pathlib':__import__('pathlib')};load('gates',scope);scope['gates']();checks.append('all_pass_required')
 for name in cases:
  v=cases[name];v['tampered']=True
  try:scope['gates']();raise RuntimeError('tampered gate accepted '+name)
  except AssertionError:checks.append('hash_drift_blocked_'+name)
  del v['tampered']
 for name,key,value in [('QUALIFICATION','status','FAIL'),('NATIVE_HOOKS_TEST','scopedMongoGuardExercised',False),('NATIVE_HOOKS_TEST','checkoutEvents',0),('NATIVE_HOOKS_TEST','realMetaRequests',1),('HTTP_SALE_TEST','productionUnchanged',False),('HTTP_SALE_TEST','realMetaEvents',1)]:
  before=cases[name][key];cases[name][key]=value;binding['gates'][name]=digest(cases[name])
  try:scope['gates']();raise RuntimeError('failed gate accepted')
  except AssertionError:checks.append('failure_blocked_'+name+'_'+key)
  cases[name][key]=before;binding['gates'][name]=digest(cases[name])
 assert "'customerInvitesAllowed':inherited['customerInvitesAllowed']"in s;checks.append('inherited_invite_activation_preserved')
 assert "ec-chat-access-v236/activation.json"in s and "ec-chat-access-v236/approval.json"in s;checks.append('parent_activation_and_rollback_preserved')
 assert "read(B/'LIVE_AUDIT.json')['pass'] is True"in s;checks.append('enable_requires_live_audit')
 scope={'actualenv':lambda:{'VITALISMEN_WEB_ELEVENLABS_API_KEY':'fixture','ELEVENLABS_API_KEY':'shared'},'read':lambda p:{'profiles':{'postSaleLive':{}}},'STATE':STATE};load('cleanenv',scope);assert scope['cleanenv']('postSaleLive')=={'ELEVENLABS_API_KEY':'shared'};checks.append('post_sale_excludes_web_voice_secret')
 class Current:
  def resolve(self):return R
 live={'state':'ACTIVE','commit':'new','runtimeAllowed':True,'postSaleApproved':True,'customerInvitesAllowed':False,'measurementAllowed':True,'burstAllowed':True,'existingDate':'unchanged'};audit={'pass':False};writes=[]
 def state_read(p):return audit if Path(p).name=='LIVE_AUDIT.json'else dict(live)
 def atomic(p,b):assert Path(p)==STATE/'activation.json';writes.append(json.loads(b))
 import uuid
 scope={'approval':lambda:(a,R),'gates':lambda:None,'C':Current(),'health':lambda:{'status':'online'},'read':state_read,'B':B,'STATE':STATE,'atomic':atomic,'canon':json.dumps,'utc':lambda:'now','receipt':lambda n,v:v,'uuid':uuid}
 load('enable_invites',scope);load('disable_invites',scope)
 try:scope['enable_invites']();raise RuntimeError('unaudited activation accepted')
 except AssertionError:assert not writes;checks.append('unaudited_enable_does_not_write')
 audit['pass']=True;scope['enable_invites']();assert writes[-1]['customerInvitesAllowed']is True
 assert all(writes[-1][k]==live[k]for k in ['measurementAllowed','burstAllowed','existingDate']);checks.append('enable_preserves_other_features_and_dates')
 live.update(writes[-1]);scope['disable_invites']();assert writes[-1]['customerInvitesAllowed']is False
 assert all(writes[-1][k]==live[k]for k in ['measurementAllowed','burstAllowed','existingDate']);checks.append('disable_preserves_other_features_and_ledger')

 import re
 scope={'json':json,'re':re};load('parse_post_sale_report',scope)
 main={'status':'PASS_DRY_RUN','mode':'V188_TOTAL_DRY_RUN','profile':{},'zapiConnected':True,'sendCount':0,'child':{'status':'PASS_DRY_RUN','sent':0}}
 assert scope['parse_post_sale_report']('guard log\n'+json.dumps(main,indent=2))==main;checks.append('nested_pass_does_not_replace_root')
 fail={**main,'status':'FAIL_OUTBOUND_LIMIT'};assert scope['parse_post_sale_report'](json.dumps(fail,indent=2))['status']=='FAIL_OUTBOUND_LIMIT';checks.append('nested_pass_cannot_hide_root_failure')
 for text in [json.dumps(main['child']),json.dumps(main)+'\n'+json.dumps(main),'{incomplete']:
  try:scope['parse_post_sale_report'](text);raise RuntimeError('invalid root accepted')
  except AssertionError:checks.append('missing_ambiguous_or_malformed_root_rejected')
scope={'approval':lambda:(a,R),'sha':lambda p:'new-panel','read':lambda p:{'panelSha256':'old-panel'},'B':B};load('restore',scope)
try:scope['restore'](123);raise RuntimeError('rollback without restoring UI accepted')
except AssertionError:checks.append('rollback_requires_parent_public_ui_before_backend_switch')
out={'project':'VITALISMEN_EC','pass':True,'checks':checks,'controllerSha256':hashlib.sha256((H/'operations-controller.py').read_bytes()).hexdigest(),'noProductionReadsOrWrites':True}
(H/'OPERATIONS_TEST.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps({'status':'PASS','checks':len(checks)}))
