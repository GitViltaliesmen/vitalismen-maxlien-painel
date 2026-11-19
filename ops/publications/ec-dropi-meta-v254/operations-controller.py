"""VITALISMEN_EC V252: confirmed orders, existing-sale recovery, post-sale and permanent QA isolation."""
import pathlib,os,json,hashlib,subprocess,datetime,fcntl,time,uuid,urllib.request,sys,re
B=pathlib.Path('/opt/vitalismen-automacao/backups/ec-dropi-meta-v254-20261119-r8');STATE=pathlib.Path('/var/lib/vitalismen-deploy/ec-dropi-meta-v254-r8');C=pathlib.Path('/opt/vitalismen-automacao/current');DROPIN=pathlib.Path('/etc/systemd/system/vitalismen-postsale-full-v203.service.d/zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz-ec-dropi-meta-v254-r8.conf')
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
 assert os.getuid()==0 and os.uname().nodename=='srv1182009';a=read(STATE/'approval.json');R=pathlib.Path(a['release']);b=read(B/'BINDINGS.json')
 assert sha(__file__)==b['controllerSha256'];assert sha(STATE/'approval.json')==b['approvalSha256'];assert sha(R/'.release-source.json')==a['sourceMetadataSha256'];assert sha(R/'.env')==a['baseEnvSha256']
 assert sha(B/'PROCESS_BASELINE_CURRENT.json')==b['processBaselineSha256']
 assert sha('/usr/local/lib/vitalismen-deploy/ec-dropi-meta-sealed-v254-r8.mjs')==a['engineSha256'];assert sha('/usr/local/lib/vitalismen-deploy/ec-dropi-meta-profile-v254-r8.mjs')==a['helperSha256']
 assert sha('/var/lib/vitalismen-deploy/sealed-successors-v1/'+a['parentCommit']+'.json')==a['parentSeal'];assert all(sha(n)==d for n,d in b['inheritedOperationalFiles'].items());return a,R
def validate_results(a,q,n,browser,recovery,operations):
 assert q['status']=='PASS' and q['candidateCommit']==a['commit'] and q['productionUnchanged'] and q['networkIsolated']
 assert len(q['results'])==4 and all(x['pass']for x in q['results']) and any(x['name']=='complete_senior'for x in q['results'])
 assert q['messagesSent']==q['databaseProductionWrites']==0
 assert n['pass'] and n['candidateCommit']==a['commit'] and n['productionUnchanged'] and n['networkIsolated']
 assert n['realMongoose'] and n['privateMongo'] and n['privateSQLite'] and n['nativeHttpRoutes'] and len(n['checks'])>=31
 assert n['actualProviderCalls']==n['productionWrites']==n['physicalMessages']==0
 assert browser['pass'] and browser['realNativeHttp'] and browser['browserChromium'] and browser['privatePersistence'] and len(browser['checks'])>=8
 assert browser['fieldWrites']>=2 and browser['forbiddenRequests']==browser['productionWrites']==browser['physicalMessages']==0
 assert recovery['status']=='PASS_CODE_CONFIG_RECOVERY_ONLY' and recovery['privateKeyUploaded']is False and len(recovery['results'])>=2 and all(x['tamperRejected'] and x['decrypt']=='PASS' and x['plaintextHash']=='PASS' for x in recovery['results'])
 assert operations['pass'] and operations['productionActions']==0 and len(operations['checks'])>=15
 return True

def gates():
 a,R=approval();binding=read(B/'BINDINGS.json');P=pathlib.Path(a['parentRelease'])
 assert read(B/'CODE_CONFIG_RECOVERY_BEFORE.json')['candidateCommit']==a['commit']
 assert read(B/'SCOPED_DATA_RECOVERY_BEFORE.json')['pass'] is True
 assert read(B/'LEADS_UI_TEST.json')['pass'] and len(read(B/'LEADS_UI_TEST.json')['checks'])>=12
 assert read(B/'SQLITE_NATIVE_TEST.json')['pass'] and read(B/'SQLITE_NATIVE_TEST.json')['sourceSha256']==a['hashes']['scripts/ec-sqlite-integration-v254.py']
 assert binding['candidateCommit']==a['commit'] and binding['hashes']==a['hashes']
 for n,d in binding['gates'].items():assert sha(B/n)==d,'GATE_DRIFT:'+n
 for n,d in binding['operationalFiles'].items():assert sha(B/n)==d,'OPERATIONAL_DRIFT:'+n
 validate_results(a,read(B/'qualification-r1/QUALIFICATION.json'),read(B/'NATIVE_QUEUE-complete.json'),read(B/'BROWSER_NATIVE_TEST.json'),read(B/'CODE_CONFIG_RECOVERY_BEFORE.json'),read(B/'OPERATIONS_TEST.json'))
 assert read(B/'OPERATIONS_TEST.json')['controllerSha256']==sha(__file__)
 assert read(B/'GATES_SEMANTIC_TEST.json')['pass'] and read(B/'GATES_SEMANTIC_TEST.json')['controllerSha256']==sha(__file__)
 contract=read(R/'docs/freeze/ec-dropi-meta-v254-contract.json');assert contract['allowedDelta']==sorted(a['hashes']) and contract['parentCommit']==a['parentCommit']
 assert contract['independentQueues'] and contract['qaExcluded'] and contract['foreignIntegrationsPreserved'] and contract['historicalRecoveryRequiresExactGrant']
 assert sha('/var/www/vitalismen-panel-phonefix-20261108-r1/qr.html')==contract['qrSha256Unchanged']
 for name,proof in read(B/'backend-delta.json')['files'].items():
  data=(R/name).read_bytes()
  for patch in reversed(proof['changes']):
   after=patch['after'].encode();assert data.count(after)==1;data=data.replace(after,patch['before'].encode(),1)
  assert hashlib.sha256(data).hexdigest()==sha(P/name)==proof['beforeSha256'],'EXACT_PARENT_INVERSE_FAILED:'+name
 for n,d in read(B/'PROTECTED_FILES.json').items():assert sha(R/n)==sha(P/n)==d,'PROTECTED_DRIFT:'+n
 for x in read(B/'STATIC_BUILD-r3.json')['files']:
  assert sha(x['path'])==x['beforeSha256'],'CONCURRENT_PANEL_CHANGE'
  data=(B/x['candidate']).read_bytes()
  assert hashlib.sha256(data).hexdigest()==x['sha256']
  for patch in reversed(x['patches']):
   after=patch['after'].encode();assert data.count(after)==1;data=data.replace(after,patch['before'].encode(),1)
  assert hashlib.sha256(data).hexdigest()==x['beforeSha256']
 assert str(C.resolve())==a['parentRelease'],'PARENT_CHANGED'
 return True

def restore_static():
 changed=[]
 for record in reversed(read(B/'STATIC_BUILD-r3.json')['files']):
  p=pathlib.Path(record['path']);digest=sha(p)
  if digest==record['beforeSha256']:continue
  assert digest==record['sha256'],'CONCURRENT_PUBLIC_CHANGE:'+str(p)
  data=p.read_bytes()
  for patch in reversed(record['patches']):
   after=patch['after'].encode();assert data.count(after)==1;data=data.replace(after,patch['before'].encode(),1)
  assert hashlib.sha256(data).hexdigest()==record['beforeSha256'];atomic(p,data,0o644);changed.append(str(p))
 if any(x.endswith('/app.py')for x in changed):assert run(['systemctl','restart','maxlien-mvp.service']).returncode==0
 elif run(['systemctl','is-active','maxlien-mvp.service']).stdout.strip()!='active':assert run(['systemctl','start','maxlien-mvp.service']).returncode==0
 return changed

def publish_static():
 changed=[]
 for record in read(B/'STATIC_BUILD-r3.json')['files']:
  p=pathlib.Path(record['path']);assert sha(p)==record['beforeSha256'],'CONCURRENT_PUBLIC_CHANGE:'+str(p)
  data=p.read_bytes()
  for patch in record['patches']:
   before=patch['before'].encode();assert data.count(before)==1;data=data.replace(before,patch['after'].encode(),1)
  assert hashlib.sha256(data).hexdigest()==record['sha256'];atomic(p,data,0o644);changed.append(str(p))
 if any(x.endswith('/app.py')for x in changed):
  assert run(['systemctl','restart','maxlien-mvp.service']).returncode==0
 assert run(['systemctl','is-active','maxlien-mvp.service']).stdout.strip()=='active'
 return receipt('STATIC_PUBLICATION.json',{'pass':True,'at':utc(),'paths':changed,'messagesSent':0,'databaseWrites':0})

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
def assert_site_rollback_ready():
 for record in read(B/'STATIC_BUILD-r3.json')['files']:assert sha(record['path'])==record['beforeSha256']

def restore(previousPid,original=None):
 a,R=approval();assert_integration_rollback_safe(R);restore_static();P=pathlib.Path(a['parentRelease']);e=original or actualenv()
 assert_site_rollback_ready()
 parent=read('/var/lib/vitalismen-deploy/ec-customer-edit-paquizha-v253-r2/approval.json')['profiles']['botLive'];e.update(parent)
 switch(P);atomic(STATE/'activation.json',canon({'state':'PREPARED','commit':a['commit'],'approvalSha256':sha(STATE/'approval.json'),'runtimeAllowed':False,'postSaleApproved':False,'customerInvitesAllowed':False,'freeflowAudience':'EC_FORWARD_ONLY','rollbackAt':utc()}))
 if DROPIN.exists():DROPIN.unlink()
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

def assert_vitpower_idle():
 # Read-only, exact official EC/QA scope. Do not interrupt a persisted send/batch.
 R=C.resolve();e=actualenv()
 code="""import mongoose from'mongoose';const c=await mongoose.createConnection(process.env.MONGODB_URI,{maxPoolSize:1,serverSelectionTimeoutMS:5000}).asPromise();try{const n=await c.db.collection('contactstates').countDocuments({phoneDigits:{$regex:/^(?:593[2-79]\\d{8}|5515998038637)$/},'human.mode':'auto',$or:[{'vitPowerB01.status':{$in:['pending','sending']}},{'vitPowerBurstV228.status':{$in:['pending','processing']}},{'metadata.processingLock.expiresAt':{$gt:new Date()}}]});console.log(JSON.stringify({pending:n}));}finally{await c.close()}"""
 p=run(['node','--input-type=module','-e',code],cwd=R,env={'PATH':'/usr/bin:/bin','NODE_OPTIONS':'','MONGODB_URI':e['MONGODB_URI']},timeout=20)
 assert p.returncode==0,'READONLY_IDLE_CHECK_FAILED'
 assert json.loads(p.stdout)['pending']==0,'WAIT_CURRENT_VITPOWER_BATCH_OR_B01'

def assert_tex_idle():
 R=C.resolve();e=actualenv()
 code="""import mongoose from'mongoose';const c=await mongoose.createConnection(process.env.MONGODB_URI,{maxPoolSize:1,serverSelectionTimeoutMS:5000}).asPromise();try{const pending=await c.db.collection('contactstates').countDocuments({phoneDigits:{$regex:/^593[2-79]\\d{8}$/},'metadata.perAgentMemory.tex_ultra_ec.initialLayerCadence.status':'running'});console.log(JSON.stringify({pending}));}finally{await c.close()}"""
 p=run(['node','--input-type=module','-e',code],cwd=R,env={'PATH':'/usr/bin:/bin','NODE_OPTIONS':'','MONGODB_URI':e['MONGODB_URI']},timeout=20)
 assert p.returncode==0,'READONLY_TEX_IDLE_CHECK_FAILED'
 assert json.loads(p.stdout)['pending']==0,'WAIT_CURRENT_TEX_INITIAL_PRESENTATION'

def assert_dropi_idle():
 e=actualenv();code="import mongoose from'mongoose';const c=await mongoose.createConnection(process.env.MONGODB_URI,{maxPoolSize:1,serverSelectionTimeoutMS:5000}).asPromise();try{const n=await c.db.collection('shipments').countDocuments({country:'EC',$or:[{'automation.submitLockedUntil':{$gt:new Date()}},{'review.reviewStatus':'dropi_submit_running','automation.submittedToDroppiAt':null,updatedAt:{$gt:new Date(Date.now()-15*60000)}}]});console.log(JSON.stringify({pending:n}));}finally{await c.close()}"
 p=run(['node','--input-type=module','-e',code],cwd=C.resolve(),env={'PATH':'/usr/bin:/bin','NODE_OPTIONS':'','MONGODB_URI':e['MONGODB_URI']},timeout=20)
 assert p.returncode==0,'READONLY_DROPI_IDLE_CHECK_FAILED'
 assert json.loads(p.stdout)['pending']==0,'WAIT_CURRENT_DROPI_SUBMISSION'

def assert_process_baseline(before):
 baseline=read(B/'PROCESS_BASELINE_CURRENT.json');old=read(B/'BASELINE.json');e=before['pm2_env']
 assert baseline['pass'] and baseline['predecessorBaselineSha256']==sha(B/'BASELINE.json')
 assert baseline['release']==old['release']==str(C.resolve()) and baseline['commit']==old['commit']
 assert before['pid']==baseline['pid'] and e['restart_time']==baseline['restarts'],'PROCESS_CHANGED_SINCE_RECOVERY_REVIEW'
 digest=hashlib.sha256(json.dumps({n:hashlib.sha256(str(e[n]).encode()).hexdigest()for n in baseline['comparedNames']},sort_keys=True,separators=(',',':')).encode()).hexdigest()
 assert digest==baseline['runtimeSha256'],'RUNTIME_CHANGED_SINCE_RECOVERY_REVIEW'

def activate():
 a,R=approval();gates();assert health().get('bot_inbound_queue',{}).get('pendingTasks',0)==0,'WAIT_INBOUND_QUEUE';assert read(B/'PUBLICATION.json')['status']=='PASS_SOURCE_PUBLISHED_NOT_ACTIVE';assert str(C.resolve())==a['parentRelease'];gitfacts(a,R)
 assert run(['systemctl','show','vitalismen-postsale-full-v203.service','-p','MainPID','--value']).stdout.strip()=='0','WAIT_CURRENT_POSTSALE'
 assert_web_idle();assert_vitpower_idle();assert_tex_idle();assert_dropi_idle()
 lock=open('/var/lib/vitalismen-deploy/ec-postsale-v203.lock','a');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
 before=target();allBefore=pm2list();original=actualenv();assert_process_baseline(before);assert run(['systemctl','is-active','vitalismen-postsale-full-v203.timer']).stdout.strip()=='active';assert not DROPIN.exists()
 receipt('ACTIVATION_BEFORE.json',{'at':utc(),'pid':before['pid'],'restarts':before['pm2_env']['restart_time'],'release':str(C.resolve()),'apiKeyFingerprint':hashlib.sha256(original.get('OPENAI_API_KEY','').encode()).hexdigest(),'globalDataBackupPass':False})
 try:
  create(DROPIN,('[Service]\nTimeoutStartSec=600\nEnvironment="HOME=/root" "PM2_HOME=/root/.pm2"\nExecStart=\nExecStart=/usr/bin/python3 -I -B -S '+str(B/'operations-controller-r3.py')+' post-sale-run\n').encode(),0o644);assert run(['systemctl','daemon-reload']).returncode==0
  assert str(B/'operations-controller-r3.py') in run(['systemctl','show','vitalismen-postsale-full-v203.service','-p','ExecStart','--value']).stdout
  inherited=read('/var/lib/vitalismen-deploy/ec-customer-edit-paquizha-v253-r2/activation.json');assert inherited['priorityAudience']=='EC_FORWARD_ONLY' and inherited['runtimeAllowed'] and inherited['measurementAllowed'] and inherited['b01Allowed'];assert inherited['automaticDropiV252Allowed'] is True and inherited['automaticDropiV252ActivatedAt']
  assert run(['systemctl','stop','maxlien-mvp.service'],timeout=100).returncode==0
  assert run(['systemctl','is-active','maxlien-mvp.service']).stdout.strip()!='active'
  integrationCutoff=utc();migrate_integration_schema(R)
  atomic(STATE/'activation.json',canon({'state':'PREPARED','commit':a['commit'],'approvalSha256':sha(STATE/'approval.json'),'runtimeAllowed':False,'postSaleApproved':False,'orderIntegrationV254Reserved':True,'orderIntegrationV254Allowed':False,'orderIntegrationV254ActivatedAt':integrationCutoff}));publish_static()
  atomic(STATE/'activation.json',canon({**inherited,'orderIntegrationV254Reserved':True,'orderIntegrationV254Allowed':False,'orderIntegrationV254ActivatedAt':integrationCutoff,'commit':a['commit'],'approvalSha256':sha(STATE/'approval.json'),'webAllowed':True,'webAudience':'PUBLIC_SITE','burstAllowed':True,'burstAudience':'EC_FORWARD_ONLY','burstActivatedAt':inherited['burstActivatedAt'],'activatedAt':utc(),'texPostLeadActivatedAt':inherited['texPostLeadActivatedAt'],'automaticDropiV252Allowed':True,'automaticDropiV252ActivatedAt':inherited['automaticDropiV252ActivatedAt'],'customerInvitesAllowed':inherited['customerInvitesAllowed']}));switch(R)
  desired={**original,**a['profiles']['botLive'],'VITALISMEN_WEB_ELEVENLABS_API_KEY':(STATE/'elevenlabs.secret').read_text()};assert len(desired['VITALISMEN_WEB_ELEVENLABS_API_KEY'])>=20;restart(desired);app,h=awaithealth(R,before['pid'])
  assert app['pm2_env']['restart_time']==before['pm2_env']['restart_time']+1
  for k,v in a['profiles']['botLive'].items():assert app['pm2_env'].get(k)==v,'PROFILE_DRIFT:'+k
  assert actualenv().get('OPENAI_API_KEY')==original.get('OPENAI_API_KEY'),'ACTIVE_KEY_CHANGED'
  assert actualenv().get('ELEVENLABS_API_KEY')==original.get('ELEVENLABS_API_KEY'),'SHARED_ELEVENLABS_KEY_CHANGED'
  assert actualenv().get('VITALISMEN_WEB_ELEVENLABS_API_KEY')==desired['VITALISMEN_WEB_ELEVENLABS_API_KEY'],'WEB_VOICE_KEY_NOT_INSTALLED'
  for old in allBefore:
   if old['name']!='vitalismen-automation':
    now=next(x for x in pm2list() if x['name']==old['name']);assert now['pid']==old['pid'] and now['pm2_env']['restart_time']==old['pm2_env']['restart_time']
  assert run(['systemctl','is-active','vitalismen-postsale-full-v203.timer']).stdout.strip()=='active';time.sleep(13)
  staged=read(STATE/'activation.json');assert not staged['orderIntegrationV254Allowed'];atomic(STATE/'activation.json',canon({**staged,'orderIntegrationV254Allowed':True,'integrationDispatchActivatedAt':utc()}));save()
  return receipt('ACTIVATION.json',{'status':'PASS_ACTIVE_DROPI_META_V254_V253_CUSTOMER_CARD_PRESERVED','at':utc(),'release':str(R),'commit':a['commit'],'pidBefore':before['pid'],'pidAfter':app['pid'],'restartDelta':1,'actualProcessCwd':str(pathlib.Path('/proc/'+str(app['pid'])+'/cwd').resolve()),'pmCwd':app['pm2_env']['pm_cwd'],'pmExecPath':app['pm2_env']['pm_exec_path'],'health':h.get('status'),'apiKeyPreserved':True,'postSaleTimerPreserved':True,'burstAudience':'EC_FORWARD_ONLY','publicAudience':'PRESERVED_EC_FORWARD_ONLY_WEB_PUBLIC_SITE','voiceId':'qHkrJuifPpn95wK3rm2A','voiceCredentialValidated':True,'sharedVoiceCredentialPreserved':True,'webVoiceCredentialScoped':True,'globalDataBackupPass':False,'databaseMigrations':2})
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
 if mode=='run':
  for name,digest in read(B/'BINDINGS.json')['operationalFiles'].items():assert sha(B/name)==digest,'OPERATIONAL_SOURCE_DRIFT:'+name
  renewal=run(['python3','-I','-B','-S','/opt/vitalismen-automacao/backups/ec-orders-dropi-postsale-v252-20261119-r11/renew-if-needed.py'],env=actualenv(),timeout=240)
  assert renewal.returncode==0,'SESSION_RENEWAL_CHECK_FAILED';record=json.loads(renewal.stdout);create(B/('SESSION_CHECK_'+stamp+'.json'),canon(record),0o600)
 r=run(['node',str(R/'scripts/post-sale-full-v188.mjs'),mode],env=cleanenv('postSaleLive'),cwd=R,timeout=300);create(B/('POSTSALE_'+mode+'_'+stamp+'.private.log'),(r.stdout+r.stderr).encode());assert r.returncode==0,'POSTSALE_FAILED'
 report=parse_post_sale_report(r.stdout)
 assert report and str(report['status']).startswith('PASS_'),'POSTSALE_REPORT_FAILED'
 if mode=='dry-run':assert report.get('sendCount')==0
 if mode=='run':assert int(report.get('physicalOutboundCount',report.get('outboundCount',0)))<=1
 return receipt('POSTSALE_'+mode+'_'+stamp+'.json',{'status':report['status'],'mode':mode,'at':utc(),'sendCount':report.get('sendCount',0),'physicalOutboundCount':report.get('physicalOutboundCount',report.get('outboundCount',0)),'forwardOnlySince':a['profiles']['postSaleLive'].get('POST_SALE_V194_FORWARD_ONLY_SINCE'),'report':report})

def migrate_integration_schema(R):
 assert read(B/'SCOPED_DATA_RECOVERY_BEFORE.json')['pass'] is True
 sql=run(['python3','-I','-B','-S',str(R/'scripts/ec-sqlite-integration-v254.py'),'migrate'],env=actualenv(),cwd=R,timeout=30);assert sql.returncode==0,'SQLITE_INTAKE_MIGRATION_FAILED'
 env=actualenv();env['NODE_OPTIONS']='';env['npm_config_node_options']=''
 code="import mongoose from'mongoose';const c=await mongoose.createConnection(process.env.MONGODB_URI,{autoIndex:false,serverSelectionTimeoutMS:5000}).asPromise();try{if(!(await c.db.listCollections({name:'metapurchasedeliveriesv254'}).toArray()).length)await c.db.createCollection('metapurchasedeliveriesv254');await c.db.collection('metapurchasedeliveriesv254').createIndex({country:1,orderId:1,eventName:1},{unique:true});await c.db.collection('metapurchasedeliveriesv254').createIndex({state:1,nextAttemptAt:1});await c.db.collection('orders').createIndex({integrationIntakeKeyV254:1},{unique:true,sparse:true});console.log(JSON.stringify({pass:true,newCollections:1,ordersChanged:0}));}finally{await c.close()}"
 mongo=run(['node','--input-type=module','-e',code],cwd=R,env=env,timeout=30);assert mongo.returncode==0,'MONGO_QUEUE_INDEX_MIGRATION_FAILED';assert json.loads(mongo.stdout)['pass']
 receipt('MIGRATION.json',{'pass':True,'at':utc(),'sqlite':json.loads(sql.stdout),'mongo':json.loads(mongo.stdout),'oldReceiptLocksPreserved':True,'globalDataBackupPass':False})

def assert_integration_rollback_safe(R):
 state=read(STATE/'activation.json')
 if state.get('orderIntegrationV254Allowed') is not True:return
 e=actualenv();e['NODE_OPTIONS']=''
 code="import mongoose from'mongoose';const c=await mongoose.createConnection(process.env.MONGODB_URI,{serverSelectionTimeoutMS:5000}).asPromise();try{const n=await c.db.collection('metapurchasedeliveriesv254').countDocuments({$or:[{dispatchedAt:{$ne:null}},{state:'accepted'}]});console.log(JSON.stringify({externalEffects:n}));}finally{await c.close()}"
 q=run(['node','--input-type=module','-e',code],cwd=R,env=e,timeout=20);assert q.returncode==0;assert json.loads(q.stdout)['externalEffects']==0,'ROLLBACK_REQUIRES_RECEIPT_PRESERVING_SUCCESSOR_AFTER_EXTERNAL_EFFECT'

if __name__=='__main__':
 action=sys.argv[1] if len(sys.argv)==2 else '';assert action in ['publish','activate','rollback','post-sale-snapshot','post-sale-dry-run','post-sale-run']
 if action in ['publish','activate','rollback']:
  lock=open('/run/lock/vitalismen-stage.lock','a');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
 result={'publish':publish,'activate':activate,'rollback':lambda:restore(target()['pid'])}.get(action,lambda:post_sale(action.removeprefix('post-sale-')))()
 print(json.dumps({k:v for k,v in result.items() if k not in ['report','processes']},ensure_ascii=False))
