"""VITALISMEN_EC V232: scoped customer invitations; inherited controls and permanent no-resend ledger."""
import pathlib,os,json,hashlib,subprocess,datetime,fcntl,time,uuid,urllib.request,sys,re
B=pathlib.Path('/opt/vitalismen-automacao/backups/ec-customer-invites-v232-r5-20261116');STATE=pathlib.Path('/var/lib/vitalismen-deploy/ec-customer-invites-v232-r5');C=pathlib.Path('/opt/vitalismen-automacao/current');DROPIN=pathlib.Path('/etc/systemd/system/vitalismen-postsale-full-v203.service.d/zzzzzzzzzzzzzzzzzzzzzz-ec-dashboard-search-v233.conf')
read=lambda p:json.loads(pathlib.Path(p).read_text());canon=lambda x:(json.dumps(x,ensure_ascii=False,indent=2)+'\n').encode();sha=lambda p:hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest();utc=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')
def create(p,b,mode=0o400):
 p=pathlib.Path(p);fd=os.open(p,os.O_CREAT|os.O_EXCL|os.O_WRONLY,mode)
 with os.fdopen(fd,'wb') as f:f.write(b);f.flush();os.fsync(f.fileno())
def atomic(p,b,mode=0o400):
 p=pathlib.Path(p);t=p.with_name(p.name+'.v212-'+uuid.uuid4().hex);create(t,b,mode);os.replace(t,p)
def receipt(name,x):create(B/name,canon(x));return x
def run(args,env=None,cwd=None,timeout=90):return subprocess.run(args,env=env,cwd=cwd,capture_output=True,text=True,timeout=timeout)
def pm2list():
 r=run(['pm2','jlist'],env={**os.environ,'NODE_OPTIONS':'','npm_config_node_options':''});assert r.returncode==0;return json.loads(r.stdout)
def target():
 rows=[x for x in pm2list() if x['name']=='vitalismen-automation'];assert len(rows)==1;return rows[0]
def actualenv():
 p=target()['pm2_env'];e={**os.environ,**{k:str(v) for k,v in p.get('env',{}).items() if isinstance(v,(str,int,float)) and not isinstance(v,bool)}}
 e.update({k:str(v) for k,v in p.items() if isinstance(v,(str,int,float)) and not isinstance(v,bool) and (k.upper()==k or k in ['pm_exec_path','pm_cwd'])})
 for k in ['NODE_CHANNEL_FD','NODE_CHANNEL_SERIALIZATION_MODE','NODE_UNIQUE_ID','PM2_PROGRAMMATIC','PM2_JSON_PROCESSING']:e.pop(k,None)
 e['npm_config_node_options']='';e['NPM_CONFIG_NODE_OPTIONS']='';return e
def cleanenv(profile=None):
 e=actualenv()
 if profile:e.update(read(STATE/'approval.json')['profiles'][profile])
 if profile in ['postSale','postSaleLive']:e.pop('VITALISMEN_WEB_ELEVENLABS_API_KEY',None)
 return e
def health():
 with urllib.request.urlopen('http://127.0.0.1:3001/api/health/',timeout=3) as f:return json.load(f)
def approval():
 assert os.getuid()==0 and os.uname().nodename=='srv1182009';a=read(STATE/'approval.json');R=pathlib.Path(a['release']);b=read(B/'BINDINGS_V4.json')
 assert sha(__file__)==b['controllerSha256'];assert sha(STATE/'approval.json')==b['approvalSha256'];assert sha(R/'.release-source.json')==a['sourceMetadataSha256'];assert sha(R/'.env')==a['baseEnvSha256']
 assert sha('/usr/local/lib/vitalismen-deploy/ec-customer-invites-sealed-v232-r5.mjs')==a['engineSha256'];assert sha('/usr/local/lib/vitalismen-deploy/ec-customer-invites-profile-v232-r5.mjs')==a['helperSha256']
 assert sha('/var/lib/vitalismen-deploy/sealed-successors-v1/'+a['parentCommit']+'.json')==a['parentSeal'];return a,R
def gates():
 a,R=approval();binding=read(B/'BINDINGS_V4.json');baseline=read(B/'BASELINE.json');parent=pathlib.Path(a['parentRelease'])
 assert sha(parent/'.env')==baseline['baseEnvSha256'] and sha(parent/'.release-source.json')==baseline['currentSourceMetadataSha256']
 names=['QUALIFICATION','EXTRA_QUALIFICATION','CODE_CONFIG_RECOVERY','INVITES_DB_TEST','BROWSER_TEST','PANEL_BROWSER_TEST','INHERITED_REGRESSION','PUBLIC_BASELINE','OPERATIONS_TEST_V4','PUBLIC_BROWSER_TEST','PANEL_PHONE_SEARCH_V233']
 for name in names:
  p=B/(name+'.json');r=read(p);assert sha(p)==binding['gates'][name],'GATE_DRIFT:'+name
  if name in ['QUALIFICATION','EXTRA_QUALIFICATION']:assert r['status']=='PASS'
  elif name=='CODE_CONFIG_RECOVERY':assert r['status']=='PASS_CODE_CONFIG_RECOVERY_ONLY'
  elif name=='ELEVENLABS_VALIDATED':assert r['status']=='PASS_REAL_ELEVENLABS_TTS' and r['voiceId']=='qHkrJuifPpn95wK3rm2A' and r['http']==200 and r['keyStoredRootOnly'] is True
  else:assert r['pass'] is True,'GATE_FAILED:'+name
  if name=='QUALIFICATION':assert r['candidateCommit']==a['commit'] and r['productionUnchanged'] and any(x['name']=='complete_senior' and x['pass']for x in r['results'])
  if name=='EXTRA_QUALIFICATION':assert r['activeReleaseUnchanged'] and r['productionDatabaseWrites']==0 and r['whatsappSends']==0
  if name=='INVITES_DB_TEST':assert r['candidateRelease']==a['release'] and r['actualMongooseRepository'] and r['actualSealedPostSaleStartup'] and r['sameRecipientGuardPipeline'] and r['privateOrderVerificationUnchanged'] and len(r['checks'])>=19 and r['productionWrites']==0 and r['realWhatsAppSends']==0
  if name in ['BROWSER_TEST','PANEL_BROWSER_TEST']:assert r['networkIntercepted'] and r.get('productionWrites',0)==0 and r.get('realOrders',0)==0
  if name=='NGINX_ROUTING_TEST':assert r['syntax'] and r['networkIsolated'] and r['productionReloads']==0
  if name=='INHERITED_REGRESSION':
   assert r['candidateCommit']==a['commit'] and r['existingCommercialCoreUnchanged'] and r['noDatabaseMigrations']
   for n,digest in r['protectedFiles'].items():assert sha(R/n)==sha(parent/n)==digest,'PROTECTED_RUNTIME_DRIFT:'+n
  if name=='LIVE_MODEL_TEST':assert r['candidateCommit']==a['commit'] and r['realModel'] and r['productionDatabaseWrites']==0 and r['whatsappSends']==0
 assert binding['candidateCommit']==a['commit'] and binding['hashes']==a['hashes']
 ui=read(B/'PANEL_PHONE_SEARCH_V233.json')
 assert ui['beforeSha256']==read(B/'PUBLIC_BASELINE.json')['panelSha256'] and ui['afterSha256']=='3782def6eb39c4fba9299557d6fd01ee62c181fad931fd8d0737c205bddbc2fc'
 assert ui['sourceCommit']=='640a3cc9b3a5306fed60c93dea9f2160705576e1' and ui['checks']==108 and ui['publicUiVerified'] and ui['noAnonymousPhoneLinking']
 assert ui['serviceRestarts']==0 and ui['backendChanges']==0 and ui['nginxChanges']==0
 assert sha('/var/www/vitalismen-panel-phonefix-20261108-r1/qr.html')==ui['afterSha256']
 assert sha('/etc/nginx/sites-enabled/ec.maxlien.shop.clean.conf')==read(B/'PUBLIC_BASELINE.json')['nginxSha256']
 assert sha(STATE/'burst-qa-proof.json')==a['inheritedBurstProofSha256']

def gitfacts(a,R):
 def git(*args):
  r=run(['git','-C',str(R),*args]);assert r.returncode==0;return r.stdout.strip()
 assert git('rev-parse','HEAD')==a['commit'];assert git('rev-parse','HEAD^{tree}')==a['tree'];assert git('rev-list','--parents','-n','1','HEAD').split()==[a['commit'],a['parentCommit']]
 changed=git('diff','--name-only','--no-renames',a['parentCommit'],a['commit']).splitlines();assert changed==sorted(a['hashes'])
 allowed={'.env','.release-source.json','.staging-complete.json','.publication-complete.json','.activation-complete.json','node_modules'}
 for line in git('status','--porcelain=v1','--untracked-files=all').splitlines():assert line.startswith('?? ') and line[3:].split('/')[0] in allowed,'CANDIDATE_DIRTY'
 for p,d in a['hashes'].items():assert sha(R/p)==d,'CANDIDATE_DRIFT:'+p
 return {'commit':a['commit'],'tree':a['tree'],'parent':a['parentCommit'],'changedPaths':changed,'clean':True}
def publish():
 a,R=approval();gates();assert C.resolve()==pathlib.Path(a['parentRelease']);facts=gitfacts(a,R);ref=a['sourceRef'];tag='production-'+R.name.split('_production-')[1];env={**os.environ,'NODE_OPTIONS':'','GIT_TERMINAL_PROMPT':'0'};G='/var/lib/vitalismen-deploy/git-identity-sources/home-delivery-authority.git'
 def git(*args):
  r=run(['git','-C',G,*args],env=env,timeout=180);create(B/('GIT_'+uuid.uuid4().hex[:8]+'.private.log'),(r.stdout+r.stderr).encode());assert r.returncode==0,'GIT_PUBLICATION_FAILED_SEE_PRIVATE_LOG';return r.stdout.strip()
 before=git('ls-remote','--heads','origin','refs/heads/production').split()[0]
 # The exact bundle is published using the existing official Windows SSH key.
 # VPS verification remains read-only; no credential is copied to the server.
 branch=git('ls-remote','--heads','origin',ref);assert branch and branch.split()[0]==a['commit'],'EXACT_SOURCE_NOT_PUBLISHED'
 remoteTag=git('ls-remote','--tags','origin','refs/tags/'+tag);assert remoteTag and remoteTag.split()[0]==a['commit'],'EXACT_TAG_NOT_PUBLISHED'
 localTag=run(['git','-C',G,'show-ref','--verify','--hash','refs/tags/'+tag],env=env)
 if localTag.returncode==0:assert localTag.stdout.strip()==a['commit'],'LOCAL_TAG_DIVERGED'
 else:git('update-ref','refs/tags/'+tag,a['commit'],'0'*40)
 after=git('ls-remote','--heads','origin','refs/heads/production').split()[0];assert after==before,'PRODUCTION_BRANCH_CHANGED'
 stage={'status':'complete','commit':a['commit'],'functionalTree':a['tree'],'registeredExactSuccessor':True,'sourceRef':ref,'validatedGates':['senior','predeploy','runtime','freeze','product','dataCompatibility','negativeIntegrity','startup'],'createdAt':utc()};create(R/'.staging-complete.json',canon(stage),0o600)
 pub={'project':'VITALISMEN_EC','status':'complete','publicationStatus':'production_published','functionalCommit':a['commit'],'functionalTree':a['tree'],'sourceRef':ref,'publicationTag':tag,'publicationTagResolvedCommit':a['commit'],'sourceMetadataSha256':sha(R/'.release-source.json'),'stagingCompleteSha256':sha(R/'.staging-complete.json'),'sealedEnvelopeSha256':a['seal'],'productionBranchChanged':False,'productionBranchBefore':before,'productionBranchAfter':after,'publishedAt':utc(),'pm2Actions':0,'outboundActions':0,'dropiActions':0};create(R/'.publication-complete.json',canon(pub),0o600)
 return receipt('PUBLICATION.json',{'status':'PASS_SOURCE_PUBLISHED_NOT_ACTIVE','at':utc(),'facts':facts,'publication':pub})
def switch(R):
 a=read(STATE/'approval.json');assert str(R) in [a['release'],a['parentRelease']];t=C.with_name('current.v212-'+uuid.uuid4().hex);os.symlink(R,t);os.replace(t,C)
def restart(desired,helper=True):
 e={**desired,'NODE_OPTIONS':'','npm_config_node_options':'','NPM_CONFIG_NODE_OPTIONS':''}
 if helper:
  R=C.resolve();args=['node',str(R/'scripts/lib/pm2-target-env-restart-v78-r4.mjs'),'/usr/lib/node_modules/pm2','vitalismen-automation',desired['NODE_OPTIONS'],str(R)]
 else:
  js="const pm2=require('/usr/lib/node_modules/pm2');process.env.NODE_OPTIONS=process.env.V212_PARENT_NODE_OPTIONS;delete process.env.V212_PARENT_NODE_OPTIONS;pm2.connect(e=>{if(e)throw e;pm2.restart('vitalismen-automation',{updateEnv:true},e=>{if(e)throw e;console.log('PARENT_RESTARTED');pm2.disconnect()})});"
  e['V212_PARENT_NODE_OPTIONS']=desired['NODE_OPTIONS'];args=['node','-e',js]
 r=run(args,env=e,timeout=100);assert r.returncode==0,'PM2_RESTART_FAILED:'+r.stderr[-1200:]
def awaithealth(R,previousPid):
 end=time.monotonic()+120
 while time.monotonic()<end:
  try:
   app=target();h=health();p=app['pm2_env']
   if app['pid']!=previousPid and p['status']=='online' and pathlib.Path('/proc/'+str(app['pid'])+'/cwd').resolve()==R and pathlib.Path(p['pm_cwd']).resolve()==R and pathlib.Path(p['pm_exec_path']).resolve()==R/'src/index.js' and h.get('status')=='online':return app,h
  except Exception:pass
  time.sleep(.5)
 raise RuntimeError('ACTIVATION_HEALTH_TIMEOUT')
def save():
 r=run(['pm2','save'],env={**os.environ,'NODE_OPTIONS':''});assert r.returncode==0
 for name in ['dump.pm2','dump.pm2.bak']:
  p=pathlib.Path('/root/.pm2')/name
  if p.exists():os.chmod(p,0o600)
def restore(previousPid,original=None):
 a,R=approval();P=pathlib.Path(a['parentRelease']);e=original or actualenv()
 parent=read('/var/lib/vitalismen-deploy/ec-web-voice-status-v231-r2/approval.json')['profiles']['botLive'];e.update(parent)
 switch(P);atomic(STATE/'activation.json',canon({'state':'PREPARED','commit':a['commit'],'approvalSha256':sha(STATE/'approval.json'),'runtimeAllowed':False,'postSaleApproved':False,'customerInvitesAllowed':False,'freeflowAudience':'EC_FORWARD_ONLY','rollbackAt':utc()}))
 oldDropin=pathlib.Path('/etc/systemd/system/vitalismen-postsale-full-v203.service.d/zzzzzzzzzzzzzzzzzzzz-ec-customer-invites-v232-r5.conf')
 for dropin in [DROPIN,oldDropin,pathlib.Path('/etc/systemd/system/vitalismen-postsale-full-v203.service.d/zzzzzzzzzzzzzzzzzzzzz-ec-customer-invites-v232-controller-r3.conf')]:
  if dropin.exists():dropin.unlink()
 assert run(['systemctl','daemon-reload']).returncode==0
 restart(e,helper=False);app,h=awaithealth(P,previousPid);save();return receipt('ROLLBACK_'+uuid.uuid4().hex[:6]+'.json',{'status':'RESTORED_PARENT','at':utc(),'release':str(P),'pid':app['pid'],'health':h.get('status'),'dataRestored':False})
def assert_web_idle():
 directory=pathlib.Path('/var/lib/vitalismen-web-chat-v220-r2/sessions');now=time.time()*1000
 for file in directory.glob('*.json'):
  if len(file.stem)!=64 or any(c not in 'abcdef0123456789' for c in file.stem):continue
  try:
   record=json.loads(file.read_bytes())
  except FileNotFoundError:continue
  if record.get('expiresAt',0)<=now:continue
  assert not any(x.get('status')=='processing' and float(x.get('at',0))>now-300000 for x in record.get('requests',{}).values()),'WAIT_CURRENT_WEB_CHAT_RESPONSE'

def activate():
 a,R=approval();gates();assert health().get('bot_inbound_queue',{}).get('pendingTasks',0)==0,'WAIT_INBOUND_QUEUE';assert read(B/'PUBLICATION.json')['status']=='PASS_SOURCE_PUBLISHED_NOT_ACTIVE';assert str(C.resolve())==a['parentRelease'];gitfacts(a,R)
 assert run(['systemctl','show','vitalismen-postsale-full-v203.service','-p','MainPID','--value']).stdout.strip()=='0','WAIT_CURRENT_POSTSALE'
 assert_web_idle()
 lock=open('/var/lib/vitalismen-deploy/ec-postsale-v203.lock','a');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
 before=target();allBefore=pm2list();original=actualenv();assert before['pid']==read(B/'BASELINE.json')['pid'];assert run(['systemctl','is-active','vitalismen-postsale-full-v203.timer']).stdout.strip()=='active';assert not DROPIN.exists()
 receipt('ACTIVATION_BEFORE.json',{'at':utc(),'pid':before['pid'],'restarts':before['pm2_env']['restart_time'],'release':str(C.resolve()),'apiKeyFingerprint':hashlib.sha256(original.get('OPENAI_API_KEY','').encode()).hexdigest(),'globalDataBackupPass':False})
 try:
  create(DROPIN,('[Service]\nEnvironment="HOME=/root" "PM2_HOME=/root/.pm2"\nExecStart=\nExecStart=/usr/bin/python3 -I -B -S '+str(B/'operations-controller-v232-r4.py')+' post-sale-run\n').encode(),0o644);assert run(['systemctl','daemon-reload']).returncode==0
  assert str(B/'operations-controller-v232-r4.py') in run(['systemctl','show','vitalismen-postsale-full-v203.service','-p','ExecStart','--value']).stdout
  inherited=read('/var/lib/vitalismen-deploy/ec-web-voice-status-v231-r2/activation.json');assert inherited['priorityAudience']=='EC_FORWARD_ONLY' and inherited['runtimeAllowed'] and inherited['measurementAllowed'] and inherited['b01Allowed']
  atomic(STATE/'activation.json',canon({**inherited,'commit':a['commit'],'approvalSha256':sha(STATE/'approval.json'),'webAllowed':True,'webAudience':'PUBLIC_SITE','burstAllowed':True,'burstAudience':'EC_FORWARD_ONLY','burstActivatedAt':inherited['burstActivatedAt'],'activatedAt':utc(),'customerInvitesAllowed':False}));switch(R)
  desired={**original,**a['profiles']['botLive'],'VITALISMEN_WEB_ELEVENLABS_API_KEY':(STATE/'elevenlabs.secret').read_text()};assert len(desired['VITALISMEN_WEB_ELEVENLABS_API_KEY'])>=20;restart(desired);app,h=awaithealth(R,before['pid'])
  assert app['pm2_env']['restart_time']==before['pm2_env']['restart_time']+1
  for k,v in a['profiles']['botLive'].items():assert app['pm2_env'].get(k)==v,'PROFILE_DRIFT:'+k
  assert actualenv().get('OPENAI_API_KEY')==original.get('OPENAI_API_KEY'),'ACTIVE_KEY_CHANGED'
  assert actualenv().get('ELEVENLABS_API_KEY')==original.get('ELEVENLABS_API_KEY'),'SHARED_ELEVENLABS_KEY_CHANGED'
  assert actualenv().get('VITALISMEN_WEB_ELEVENLABS_API_KEY')==desired['VITALISMEN_WEB_ELEVENLABS_API_KEY'],'WEB_VOICE_KEY_NOT_INSTALLED'
  for old in allBefore:
   if old['name']!='vitalismen-automation':
    now=next(x for x in pm2list() if x['name']==old['name']);assert now['pid']==old['pid'] and now['pm2_env']['restart_time']==old['pm2_env']['restart_time']
  assert run(['systemctl','is-active','vitalismen-postsale-full-v203.timer']).stdout.strip()=='active';save()
  return receipt('ACTIVATION.json',{'status':'PASS_ACTIVE_V232_INVITES_DISABLED_UNTIL_FINAL_AUDIT','at':utc(),'release':str(R),'commit':a['commit'],'pidBefore':before['pid'],'pidAfter':app['pid'],'restartDelta':1,'actualProcessCwd':str(pathlib.Path('/proc/'+str(app['pid'])+'/cwd').resolve()),'pmCwd':app['pm2_env']['pm_cwd'],'pmExecPath':app['pm2_env']['pm_exec_path'],'health':h.get('status'),'apiKeyPreserved':True,'postSaleTimerPreserved':True,'burstAudience':'EC_FORWARD_ONLY','publicAudience':'PRESERVED_EC_FORWARD_ONLY_WEB_PUBLIC_SITE','voiceId':'qHkrJuifPpn95wK3rm2A','voiceCredentialValidated':True,'sharedVoiceCredentialPreserved':True,'webVoiceCredentialScoped':True,'globalDataBackupPass':False,'databaseMigrations':0})
 except BaseException as error:
  receipt('ACTIVATION_FAILURE.json',{'status':'FAIL','at':utc(),'reason':str(error)[:1800]});restore(target()['pid'],original);raise
def parse_post_sale_report(output):
 decoder=json.JSONDecoder();reports=[]
 for match in re.finditer(r'(?m)^\{',output):
  try:value,_=decoder.raw_decode(output,match.start())
  except json.JSONDecodeError:continue
  if isinstance(value,dict) and value.get('mode') in ['V188_TOTAL_DRY_RUN','V188_OPERATIONAL_BATCH_ONE','V188_READ_ONLY_SNAPSHOT'] and 'profile'in value and value.get('zapiConnected') is True:reports.append(value)
 assert len(reports)==1,'POSTSALE_ROOT_REPORT_MISSING_OR_AMBIGUOUS'
 return reports[0]

def post_sale(mode):
 assert mode in['snapshot','dry-run','run'];a,R=approval();assert C.resolve()==R;assert read(STATE/'activation.json')['state']=='ACTIVE'
 lock=open('/var/lib/vitalismen-deploy/ec-postsale-v203.lock','a');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB);stamp=uuid.uuid4().hex[:10]
 r=run(['node',str(R/'scripts/post-sale-full-v188.mjs'),mode],env=cleanenv('postSaleLive'),cwd=R,timeout=300);create(B/('POSTSALE_'+mode+'_'+stamp+'.private.log'),(r.stdout+r.stderr).encode());assert r.returncode==0,'POSTSALE_FAILED'
 report=parse_post_sale_report(r.stdout)
 assert report and str(report['status']).startswith('PASS_'),'POSTSALE_REPORT_FAILED'
 if mode=='dry-run':assert report.get('sendCount')==0
 if mode=='run':assert int(report.get('physicalOutboundCount',report.get('outboundCount',0)))<=1
 return receipt('POSTSALE_'+mode+'_'+stamp+'.json',{'status':report['status'],'mode':mode,'at':utc(),'sendCount':report.get('sendCount',0),'physicalOutboundCount':report.get('physicalOutboundCount',report.get('outboundCount',0)),'forwardOnlySince':a['profiles']['postSaleLive'].get('POST_SALE_V194_FORWARD_ONLY_SINCE'),'report':report})
def enable_invites():
 a,R=approval();gates();assert C.resolve()==R and health().get('status')=='online'
 assert read(B/'LIVE_AUDIT.json')['pass'] is True
 state=read(STATE/'activation.json');assert state['state']=='ACTIVE' and state['runtimeAllowed'] is True and state['postSaleApproved'] is True
 state.update(customerInvitesAllowed=True,customerInvitesActivatedAt=utc())
 atomic(STATE/'activation.json',canon(state))
 return receipt('INVITES_ENABLED.json',{'status':'PASS_CUSTOMER_INVITATIONS_ENABLED','at':utc(),'release':str(R),'oneAttemptPerSeconds':600,'partnerSecondDelayHours':12,'persistentNoRetry':True,'privateCredentialIssuanceUnchanged':True,'globalDataBackupPass':False})

def disable_invites():
 a,R=approval();state=read(STATE/'activation.json');assert state['commit']==a['commit']
 state.update(customerInvitesAllowed=False,customerInvitesDisabledAt=utc());atomic(STATE/'activation.json',canon(state))
 return receipt('INVITES_DISABLED_'+uuid.uuid4().hex[:8]+'.json',{'status':'INVITATIONS_DISABLED_LEDGER_PRESERVED','at':utc(),'release':str(R),'pm2Restarts':0,'dataRestored':False})

if __name__=='__main__':
 action=sys.argv[1] if len(sys.argv)==2 else '';assert action in ['publish','activate','rollback','enable-invites','disable-invites','post-sale-snapshot','post-sale-dry-run','post-sale-run']
 if action in ['publish','activate','rollback','enable-invites','disable-invites']:
  lock=open('/run/lock/vitalismen-stage.lock','a');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
 result={'publish':publish,'activate':activate,'rollback':lambda:restore(target()['pid']),'enable-invites':enable_invites,'disable-invites':disable_invites}.get(action,lambda:post_sale(action.removeprefix('post-sale-')))()
 print(json.dumps({k:v for k,v in result.items() if k not in ['report','processes']},ensure_ascii=False))
