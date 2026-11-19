from pathlib import Path
import ast,hashlib,json,tempfile,time,re
H=Path(__file__).resolve().parent
s=(H/'operations-controller.py').read_text(encoding='utf-8')
nodes={n.name:n for n in ast.parse(s).body if isinstance(n,ast.FunctionDef)}
def load(name,scope):exec(compile(ast.fix_missing_locations(ast.Module(body=[nodes[name]],type_ignores=[])),'<controller-fixture>','exec'),scope)
checks=[]
digest=lambda x:hashlib.sha256(json.dumps(x,sort_keys=True).encode()).hexdigest()
with tempfile.TemporaryDirectory()as tmp:
 base=Path(tmp);B=base/'backup';R=base/'release';P=base/'parent';STATE=base/'state'
 a={'commit':'new','parentCommit':'parent','hashes':{'file':'digest'},'parentRelease':str(P),'inheritedBurstProofSha256':'burst','inheritedTexWebProofSha256':'tex','inheritedLinkedEntryProofSha256':'linked'}
 cases={
 'QUALIFICATION':{'status':'PASS','candidateCommit':'new','productionUnchanged':True,'networkIsolated':True,'results':[{'name':n,'pass':True}for n in ['senior_guard','product_guard','focused_tests','complete_senior']]},
 'RUNTIME_POLICY':{'pass':True,'candidateCommit':'new','activePostLeadCapability':True,'inheritedLinkedValidation':True,'publicTexProxyAuthorized':True,'anonymousTexDenied':True,'physicalMessages':0,'productionWrites':0,'privateStoresUnchanged':True},
 'INVERSE_TEST':{'pass':True,'productionWrites':0,'checks':list(range(12))},
 'FEATURE_UNIT':{'pass':True,'candidateCommit':'new','tests':10,'physicalMessages':0,'productionWrites':0},
 'BROWSER_TEST':{'pass':True,'productionRequests':0,'physicalMessages':0,'checks':['one','two','three','four']},
 'CODE_CONFIG_RECOVERY':{'status':'PASS_CODE_CONFIG_RECOVERY_ONLY','privateKeyUploaded':False,'results':[{'tamperRejected':True}]},
 'INHERITED_REGRESSION':{'pass':True,'candidateCommit':'new','noDatabaseMigrations':True,'protectedFiles':{'protected':'safe'}},
 'PUBLIC_BASELINE_CURRENT_R3':{'pass':True,'panelSha256':'panel','localFiles':{'local':'safe'},'urls':{'https://fixture.invalid/asset':hashlib.sha256(b'asset').hexdigest()}},
 'OPERATIONS_TEST':{'pass':True,'controllerSha256':'controller','checks':list(range(16))},
 'INHERITED_CONTROL':{'pass':True,'files':{'control':'safe'}}}
 binding={'candidateCommit':'new','hashes':a['hashes'],'gates':{n:digest(v)for n,v in cases.items()}}
 contract={'allowedDelta':['file'],'parentCommit':'parent','productionDatabaseMigration':False,'historicalMessagesReplayed':False,'automaticRetryAuthorized':False,'inverse':{}}
 parent={'runtimeAllowed':True,'webAllowed':True,'linkedEntryAllowed':True}
 def read(p):
  name=Path(p).name
  if name=='BINDINGS.json':return binding
  if name=='BASELINE.json':return{'baseEnvSha256':'env','currentSourceMetadataSha256':'source'}
  if name=='activation.json':return parent
  if name=='tex-postlead-v251-contract.json':return contract
  return cases[Path(p).stem]
 def sha(p):
  if Path(p) in [R/'file',P/'file']:return hashlib.sha256(Path(p).read_bytes()).hexdigest()
  name=Path(p).name
  if name=='.env':return'env'
  if name=='.release-source.json':return'source'
  if name=='operations-controller.py':return'controller'
  if name in ['burst-qa-proof.json','tex-web-qa-proof.json','linked-entry-qa-proof.json']:return {'burst-qa-proof.json':'burst','tex-web-qa-proof.json':'tex','linked-entry-qa-proof.json':'linked'}[name]
  if Path(p).stem in cases:return digest(cases[Path(p).stem])
  return 'safe'
 class Response:
  status=200
  def __enter__(self):return self
  def __exit__(self,*_):pass
  def read(self):return b'asset'
 class Request:
  @staticmethod
  def Request(*_,**__):return None
  @staticmethod
  def urlopen(*_,**__):return Response()
 class Url:request=Request
 scope={'approval':lambda:(a,R),'read':read,'sha':sha,'pathlib':__import__('pathlib'),'hashlib':hashlib,'B':B,'STATE':STATE,'urllib':Url,'__file__':str(H/'operations-controller.py')}
 load('gates',scope);scope['gates']();checks.append('all_complete_scoped_gates_accepted')
 R.mkdir();P.mkdir()
 parentBytes=b'alpha\r\nbeta\r\n';candidateBytes=b'alpha\r\nnew\nbeta\r\n'
 (P/'file').write_bytes(parentBytes);(R/'file').write_bytes(candidateBytes)
 proof={'parentSha256':hashlib.sha256(parentBytes).hexdigest(),'patches':[{'before':parentBytes.decode(),'after':candidateBytes.decode()}]}
 contract['inverse']={'file':proof};scope['gates']();checks.append('mixed_CRLF_LF_inverse_preserves_exact_parent_bytes')
 (R/'file').write_bytes(candidateBytes+b'// unauthorized\n')
 try:scope['gates']();raise RuntimeError('extra bytes outside inverse accepted')
 except AssertionError:checks.append('mixed_newline_inverse_rejects_extra_bytes')
 proof['parentSha256']=hashlib.sha256(parentBytes+b'// unauthorized\n').hexdigest()
 try:scope['gates']();raise RuntimeError('forged parent hash accepted')
 except AssertionError:checks.append('mixed_newline_inverse_rejects_forged_parent_hash')
 (R/'file').write_bytes(candidateBytes);contract['inverse']={}
 for name,value in cases.items():
  value['tampered']=True
  try:scope['gates']();raise RuntimeError('hash drift accepted')
  except AssertionError:checks.append('hash_drift_rejected_'+name)
  del value['tampered']
 for name,key,value in [('QUALIFICATION','status','FAIL'),('QUALIFICATION','candidateCommit','wrong'),('QUALIFICATION','productionUnchanged',False),('QUALIFICATION','networkIsolated',False),('QUALIFICATION','results',[]),('RUNTIME_POLICY','inheritedLinkedValidation',False),('RUNTIME_POLICY','anonymousTexDenied',False),('INVERSE_TEST','checks',[]),('FEATURE_UNIT','tests',0),('FEATURE_UNIT','productionWrites',1),('FEATURE_UNIT','physicalMessages',1),('BROWSER_TEST','productionRequests',1),('BROWSER_TEST','checks',[]),('CODE_CONFIG_RECOVERY','privateKeyUploaded',True),('CODE_CONFIG_RECOVERY','results',[{'tamperRejected':False}]),('OPERATIONS_TEST','checks',[])]:
  prior=cases[name][key];cases[name][key]=value;binding['gates'][name]=digest(cases[name])
  try:scope['gates']();raise RuntimeError('semantic failure accepted')
  except AssertionError:checks.append('semantic_failure_rejected_'+name+'_'+key)
  cases[name][key]=prior;binding['gates'][name]=digest(cases[name])
 for key in ['runtimeAllowed','webAllowed','linkedEntryAllowed']:
  parent[key]=False
  try:scope['gates']();raise RuntimeError('parent authorization drift accepted')
  except AssertionError:checks.append('parent_authorization_rejected_'+key)
  parent[key]=True
 for key in ['productionDatabaseMigration','historicalMessagesReplayed','automaticRetryAuthorized']:
  contract[key]=True
  try:scope['gates']();raise RuntimeError('expanded action accepted')
  except AssertionError:checks.append('expanded_action_rejected_'+key)
  contract[key]=False
 scope['gates']()
 # Restart requires absence of active chat processing.
 sessions=base/'sessions';sessions.mkdir()
 class Paths:
  @staticmethod
  def Path(value):return sessions if value=='/var/lib/vitalismen-web-chat-v220-r2/sessions'else Path(value)
 web={'pathlib':Paths,'time':time,'json':json};load('assert_web_idle',web);web['assert_web_idle']();checks.append('empty_chat_allows_restart')
 record=sessions/('a'*64+'.json');record.write_text(json.dumps({'expiresAt':time.time()*1000+60000,'requests':{'one':{'status':'processing','at':time.time()*1000}}}))
 try:web['assert_web_idle']();raise RuntimeError('active conversation interrupted')
 except AssertionError:checks.append('active_chat_blocks_restart')
 record.write_text(json.dumps({'expiresAt':0,'requests':{'one':{'status':'processing','at':time.time()*1000}}}));web['assert_web_idle']();checks.append('expired_session_does_not_block_restart')
 parser={'json':json,'re':re};load('parse_post_sale_report',parser)
 report={'status':'PASS_DRY_RUN','mode':'V188_TOTAL_DRY_RUN','profile':{},'zapiConnected':True,'sendCount':0,'child':{'status':'PASS_DRY_RUN'}}
 assert parser['parse_post_sale_report']('log\n'+json.dumps(report,indent=2))==report;checks.append('root_postsale_report_parsed')
 for text in [json.dumps(report['child']),json.dumps(report)+'\n'+json.dumps(report),'{incomplete']:
  try:parser['parse_post_sale_report'](text);raise RuntimeError('ambiguous report accepted')
  except AssertionError:checks.append('missing_ambiguous_report_rejected')
 assert "'texPostLeadActivatedAt':utc()"in s;checks.append('prospective_cutoff_created_only_during_activation')
 assert "'customerInvitesAllowed':inherited['customerInvitesAllowed']"in s;checks.append('existing_invitation_authorization_preserved')
 assert "assert_web_idle();assert_vitpower_idle();assert_tex_idle()"in s;checks.append('all_existing_funnels_must_be_idle')
 assert "assert_site_rollback_ready()"in s and 'RESTORE_PARENT_SITE_BEFORE_BACKEND_ROLLBACK'in s;checks.append('site_compatibility_required_before_backend_rollback')
 assert "except BaseException as error:"in s and "restore(target()['pid'],original);raise"in s;checks.append('activation_failure_restores_parent')
 assert "def enable_invites"not in s;checks.append('no_separate_invitation_enable_or_disable_operation')
 # A concurrent failed release must be reviewed against recovered configuration,
 # and that reviewed process/configuration must remain exact until activation.
 pe={'FLAG':'true','TOKEN':'fixture-only','restart_time':59};process={'pid':123,'pm2_env':pe}
 pb={'pass':True,'predecessorBaselineSha256':'oldhash','release':str(R),'commit':'parent','pid':123,'restarts':59,'comparedNames':['FLAG','TOKEN']}
 pb['runtimeSha256']=hashlib.sha256(json.dumps({n:hashlib.sha256(str(pe[n]).encode()).hexdigest()for n in pb['comparedNames']},sort_keys=True,separators=(',',':')).encode()).hexdigest()
 old={'release':str(R),'commit':'parent'}
 scope={'read':lambda p:pb if Path(p).name=='PROCESS_BASELINE_CURRENT.json'else old,'sha':lambda p:'oldhash','B':B,'C':R,'hashlib':hashlib,'json':json}
 load('assert_process_baseline',scope);scope['assert_process_baseline'](process);checks.append('reviewed_recovered_process_accepted')
 for container,key,value in [(process,'pid',124),(pe,'restart_time',60),(pe,'FLAG','false'),(pe,'TOKEN','changed'),(pb,'predecessorBaselineSha256','wrong'),(pb,'release',str(P)),(pb,'commit','wrong'),(pb,'pass',False)]:
  previous=container[key];container[key]=value
  try:scope['assert_process_baseline'](process);raise RuntimeError('unreviewed process/configuration accepted')
  except AssertionError:checks.append('recovered_process_drift_rejected_'+key)
  container[key]=previous
result={'project':'VITALISMEN_EC','pass':True,'controllerSha256':hashlib.sha256((H/'operations-controller.py').read_bytes()).hexdigest(),'checks':checks,'productionActions':0}
(H/'OPERATIONS_TEST.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8');print(json.dumps({'pass':True,'checks':len(checks)}))
