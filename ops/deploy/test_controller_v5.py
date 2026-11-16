from pathlib import Path
import ast,hashlib,json,tempfile,time
H=Path(__file__).resolve().parent;s=(H/'operations-controller-v232-r5.py').read_text();nodes={n.name:n for n in ast.parse(s).body if isinstance(n,ast.FunctionDef)}
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
 cases={'QUALIFICATION':{'status':'PASS','candidateCommit':'new','productionUnchanged':True,'results':[{'name':'complete_senior','pass':True}]},'EXTRA_QUALIFICATION':{'status':'PASS','activeReleaseUnchanged':True,'productionDatabaseWrites':0,'whatsappSends':0},'CODE_CONFIG_RECOVERY':{'status':'PASS_CODE_CONFIG_RECOVERY_ONLY'},'INVITES_DB_TEST':{'pass':True,'candidateRelease':str(R),'actualMongooseRepository':True,'actualSealedPostSaleStartup':True,'sameRecipientGuardPipeline':True,'privateOrderVerificationUnchanged':True,'checks':list(range(19)),'productionWrites':0,'realWhatsAppSends':0},'BROWSER_TEST':{'pass':True,'networkIntercepted':True,'realOrders':0},'PANEL_BROWSER_TEST':{'pass':True,'networkIntercepted':True,'productionWrites':0},'INHERITED_REGRESSION':{'pass':True,'candidateCommit':'new','existingCommercialCoreUnchanged':True,'noDatabaseMigrations':True,'protectedFiles':{}},'PUBLIC_BASELINE':{'pass':True,'panelSha256':'panel','panelCandidateSha256':'panel','nginxSha256':'nginx'},'OPERATIONS_TEST_V5':{'pass':True},'PUBLIC_BROWSER_TEST':{'pass':True}}
 digest=lambda v:hashlib.sha256(json.dumps(v,sort_keys=True).encode()).hexdigest()
 cases['PANEL_PHONE_SEARCH_V233']={'pass':True,'beforeSha256':'panel','afterSha256':'3782def6eb39c4fba9299557d6fd01ee62c181fad931fd8d0737c205bddbc2fc','sourceCommit':'640a3cc9b3a5306fed60c93dea9f2160705576e1','checks':108,'publicUiVerified':True,'noAnonymousPhoneLinking':True,'serviceRestarts':0,'backendChanges':0,'nginxChanges':0}
 cases['PANEL_WHATSAPP_POPUP_V234']={'pass':True,'kind':'APPROVED_POPUP_UI_SUCCESSOR_V234','beforeSha256':'3782def6eb39c4fba9299557d6fd01ee62c181fad931fd8d0737c205bddbc2fc','afterSha256':'b07b2e939b6d80f2f5a6d7ccb8bfd218c6f2dec4465a9c3b9e974e7e049a1c65','sourceCommit':'2e13387b7f00ebfdc78a9053d66157cb02e2c2fb','tests':132,'mainConversationUnchanged':True,'backendChanges':False,'outboundChanges':False}
 panelVersion='3782def6eb39c4fba9299557d6fd01ee62c181fad931fd8d0737c205bddbc2fc'
 binding={'candidateCommit':'new','hashes':a['hashes'],'gates':{n:digest(v)for n,v in cases.items()}}
 def read(p):
  n=Path(p).name
  if n=='BASELINE.json':return {'baseEnvSha256':'env','currentSourceMetadataSha256':'source'}
  if n=='BINDINGS_V5.json':return binding
  return cases[Path(p).stem]
 def sha(p):
  n=Path(p).name
  if n=='.env':return 'env'
  if n=='.release-source.json':return 'source'
  if n=='qr.html':return panelVersion
  if n=='ec.maxlien.shop.clean.conf':return 'nginx'
  if n=='burst-qa-proof.json':return 'burst'
  return digest(cases[Path(p).stem])
 scope={'approval':lambda:(a,R),'read':read,'sha':sha,'B':B,'STATE':STATE,'pathlib':__import__('pathlib')};load('gates',scope);scope['gates']();checks.append('all_pass_required')
 for name in cases:
  v=cases[name];v['tampered']=True
  try:scope['gates']();raise RuntimeError('tampered gate accepted '+name)
  except AssertionError:checks.append('hash_drift_blocked_'+name)
  del v['tampered']
 for name,key,value in [('QUALIFICATION','status','FAIL'),('INVITES_DB_TEST','sameRecipientGuardPipeline',False),('INVITES_DB_TEST','privateOrderVerificationUnchanged',False),('INHERITED_REGRESSION','existingCommercialCoreUnchanged',False)]:
  before=cases[name][key];cases[name][key]=value;binding['gates'][name]=digest(cases[name])
  try:scope['gates']();raise RuntimeError('failed gate accepted')
  except AssertionError:checks.append('failure_blocked_'+name+'_'+key)
  cases[name][key]=before;binding['gates'][name]=digest(cases[name])
 for key,value in [('beforeSha256','unapproved-baseline'),('afterSha256','unapproved-next-html'),('sourceCommit','unpublished-commit')]:
  before=cases['PANEL_PHONE_SEARCH_V233'][key];cases['PANEL_PHONE_SEARCH_V233'][key]=value;binding['gates']['PANEL_PHONE_SEARCH_V233']=digest(cases['PANEL_PHONE_SEARCH_V233'])
  try:scope['gates']();raise RuntimeError('unapproved UI accepted')
  except AssertionError:checks.append('unapproved_ui_blocked_'+key)
  cases['PANEL_PHONE_SEARCH_V233'][key]=before;binding['gates']['PANEL_PHONE_SEARCH_V233']=digest(cases['PANEL_PHONE_SEARCH_V233'])
 panelVersion='b07b2e939b6d80f2f5a6d7ccb8bfd218c6f2dec4465a9c3b9e974e7e049a1c65';scope['gates']();checks.append('approved_new_popup_gate_passes')
 panelVersion='unapproved-html'
 try:scope['gates']();raise RuntimeError('unknown HTML accepted')
 except AssertionError:checks.append('unknown_popup_html_blocked')
 panelVersion='3782def6eb39c4fba9299557d6fd01ee62c181fad931fd8d0737c205bddbc2fc'
 for key,value in [('beforeSha256','bad-parent'),('afterSha256','bad-next'),('sourceCommit','unpublished'),('mainConversationUnchanged',False),('outboundChanges',True)]:
  oldValue=cases['PANEL_WHATSAPP_POPUP_V234'][key];cases['PANEL_WHATSAPP_POPUP_V234'][key]=value;binding['gates']['PANEL_WHATSAPP_POPUP_V234']=digest(cases['PANEL_WHATSAPP_POPUP_V234'])
  try:scope['gates']();raise RuntimeError('unapproved popup contract accepted')
  except AssertionError:checks.append('unapproved_popup_blocked_'+key)
  cases['PANEL_WHATSAPP_POPUP_V234'][key]=oldValue;binding['gates']['PANEL_WHATSAPP_POPUP_V234']=digest(cases['PANEL_WHATSAPP_POPUP_V234'])
 assert "'customerInvitesAllowed':False"in s and 'customerInvitesAllowed=True'in s;checks.append('invites_disabled_until_explicit_final_enable')
 assert "ec-web-voice-status-v231-r2/activation.json"in s and "ec-web-voice-status-v231-r2/approval.json"in s;checks.append('parent_activation_and_rollback_preserved')
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
out={'project':'VITALISMEN_EC','pass':True,'checks':checks,'controllerSha256':hashlib.sha256((H/'operations-controller-v232-r5.py').read_bytes()).hexdigest(),'noProductionReadsOrWrites':True}
(H/'OPERATIONS_TEST_V5.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps({'status':'PASS','checks':len(checks)}))
