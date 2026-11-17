# PROJECT=VITALISMEN_EC. Registered verified Tex entry only; inherited operations preserved.
import pathlib,os,json,hashlib,subprocess,datetime,fcntl,time,uuid,urllib.request,sys,re
B=pathlib.Path('/opt/vitalismen-automacao/backups/tex-ultra-linked-entry-v242-r6-20261117');STATE=pathlib.Path('/var/lib/vitalismen-deploy/ec-tex-linked-entry-v242-r6');C=pathlib.Path('/opt/vitalismen-automacao/current');PARENT_STATE=pathlib.Path('/var/lib/vitalismen-deploy/ec-qa-natural-entry-v241-r2')
DROPIN=pathlib.Path('/etc/systemd/system/vitalismen-postsale-full-v203.service.d/zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz-tex-linked-v242-r6.conf')
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


def gitfacts(a,R):
 def git(*args):
  r=run(['git','-C',str(R),*args]);assert r.returncode==0;return r.stdout.strip()
 assert git('rev-parse','HEAD')==a['commit'];assert git('rev-parse','HEAD^{tree}')==a['tree'];assert git('rev-list','--parents','-n','1','HEAD').split()==[a['commit'],a['parentCommit']]
 changed=git('diff','--name-only','--no-renames',a['parentCommit'],a['commit']).splitlines();assert changed==sorted(a['hashes'])
 allowed={'.env','.release-source.json','.staging-complete.json','.publication-complete.json','.activation-complete.json','node_modules'}
 for line in git('status','--porcelain=v1','--untracked-files=all').splitlines():assert line.startswith('?? ') and line[3:].split('/')[0] in allowed,'CANDIDATE_DIRTY'
 for p,d in a['hashes'].items():assert sha(R/p)==d,'CANDIDATE_DRIFT:'+p
 return {'commit':a['commit'],'tree':a['tree'],'parent':a['parentCommit'],'changedPaths':changed,'clean':True}


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


def assert_web_idle():
 directory=pathlib.Path('/var/lib/vitalismen-web-chat-v220-r2/sessions');now=time.time()*1000
 for file in directory.glob('*.json'):
  if len(file.stem)!=64 or any(c not in 'abcdef0123456789' for c in file.stem):continue
  try:
   record=json.loads(file.read_bytes())
  except FileNotFoundError:continue
  if record.get('expiresAt',0)<=now:continue
  assert not any(x.get('status')=='processing' and float(x.get('at',0))>now-300000 for x in record.get('requests',{}).values()),'WAIT_CURRENT_WEB_CHAT_RESPONSE'


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


GATE_NAMES=['FOCUSED_QUALIFICATION_attempt1','FULL_QUALIFICATION','PRIVATE_HTTP_QA_attempt1','CONTROL_PLANE_QUALIFICATION','PRESERVATION','CODE_CONFIG_RECOVERY','CONTROLLER_TESTS','FRONTEND_TESTS']
def approval():
 assert os.getuid()==0 and os.uname().nodename=='srv1182009';m=read(B/'PREPARED.json');a=read(STATE/'approval.json');R=pathlib.Path(a['release']);binding=read(B/'BINDINGS.json')
 assert sha(__file__)==binding['controllerSha256'] and sha(STATE/'approval.json')==binding['approvalSha256']
 assert a['commit']==m['commit'] and a['release']==m['release'] and a['sourceRef']==m['sourceRef']
 for field,file in [('sourceMetadataSha256',R/'.release-source.json'),('baseEnvSha256',R/'.env'),('engineSha256',m['engine']),('helperSha256',m['helper'])]:assert sha(file)==a[field],field
 assert sha('/var/lib/vitalismen-deploy/sealed-successors-v1/'+a['parentCommit']+'.json')==a['parentSeal'];return a,R

def parent_state_preserved():
 parent=read(PARENT_STATE/'activation.json');child=read(STATE/'activation.json');excluded={'state','commit','approvalSha256','runtimeAllowed','activatedAt','linkedEntryAllowed','linkedEntryAudience','linkedEntryActivatedAt'}
 assert parent['state']=='ACTIVE' and parent['runtimeAllowed'] is True
 for key,value in parent.items():
  if key not in excluded:assert child.get(key)==value,'PARENT_MUTABLE_STATE_CHANGED:'+key
 return parent

def gates():
 a,R=approval();binding=read(B/'BINDINGS.json');gitfacts(a,R);parent_state_preserved()
 for name in GATE_NAMES:
  p=B/(name+'.json');assert sha(p)==binding['gates'][name],'GATE_DRIFT:'+name;x=read(p);assert x['pass'] is True,'GATE_FAILED:'+name
  if name in ['FOCUSED_QUALIFICATION_attempt1','FULL_QUALIFICATION']:assert x['commit']==a['commit'] and all(row['returncode']==0 for row in x['results'])
  if name=='PRIVATE_HTTP_QA_attempt1':assert x['commit']==a['commit'] and x['actualHttpHandlerAndStores'] and x['networkAndMountNamespacesIsolated'] and x['externalOutbound']==0
  if name=='CONTROL_PLANE_QUALIFICATION':assert x['commit']==a['commit'] and x['realSealedVerifierUsed'] and x['allGuardsEnabled'] and x['productionRestarts']==0 and all(row['pass'] and row['productionRestarts']==0 for row in x['results'])
 assert sha(pathlib.Path(a['parentRelease'])/'.env')==read(B/'BASELINE.json')['baseEnvSha256']
 panel=read(B/'PUBLIC_BASELINE.json');assert sha(panel['panelPath']) in [panel['panelSha256'],panel['panelCandidateSha256']]
 assert sha('/etc/nginx/sites-enabled/ec.maxlien.shop.clean.conf')==panel['nginxSha256']

def publish():
 a,R=approval();gates();assert str(C.resolve())==a['parentRelease'];ref=a['sourceRef'];tag='production-'+R.name.split('_production-')[1];G='/var/lib/vitalismen-deploy/git-identity-sources/home-delivery-authority.git'
 def git(*args):
  r=run(['git','-C',G,*args],env={**os.environ,'NODE_OPTIONS':'','GIT_TERMINAL_PROMPT':'0'},timeout=120);assert r.returncode==0,'GIT_PUBLICATION_CHECK_FAILED';return r.stdout.strip()
 assert git('ls-remote','--heads','origin',ref).split()[0]==a['commit'];assert git('ls-remote','--tags','origin','refs/tags/'+tag).split()[0]==a['commit'];before=git('ls-remote','--heads','origin','refs/heads/production').split()[0]
 create(R/'.staging-complete.json',canon({'status':'complete','commit':a['commit'],'functionalTree':a['tree'],'registeredExactSuccessor':True,'sourceRef':ref,'validatedGates':GATE_NAMES,'createdAt':utc()}),0o600)
 after=git('ls-remote','--heads','origin','refs/heads/production').split()[0];assert after==before,'PRODUCTION_BRANCH_CONCURRENT_CHANGE'
 pub={'project':'VITALISMEN_EC','status':'complete','publicationStatus':'production_published','functionalCommit':a['commit'],'functionalTree':a['tree'],'sourceRef':ref,'publicationTag':tag,'publicationTagResolvedCommit':a['commit'],'sourceMetadataSha256':sha(R/'.release-source.json'),'stagingCompleteSha256':sha(R/'.staging-complete.json'),'sealedEnvelopeSha256':a['seal'],'productionBranchChanged':False,'productionBranchBefore':before,'productionBranchAfter':after,'publishedAt':utc(),'pm2Actions':0,'outboundActions':0,'dropiActions':0}
 create(R/'.publication-complete.json',canon(pub),0o600);return receipt('PUBLICATION.json',{'status':'PASS_SOURCE_PUBLISHED_NOT_ACTIVE','commit':a['commit'],'publication':pub})

def web_entries_exist():
 directory=pathlib.Path('/var/lib/vitalismen-tex-linked-entry-v242/journeys')
 if not directory.exists():return False
 for p in directory.iterdir():
  assert p.is_file() and not p.is_symlink() and re.fullmatch('[a-f0-9]{64}[.]json',p.name)
  value=read(p)
  if value.get('firstChannel')=='web' and value.get('entryAttempted') is True:return True
 return False

def restore(previousPid,original=None):
 a,R=approval();assert not web_entries_exist(),'LINKED_CUSTOMERS_REQUIRE_COMPATIBLE_FEATURE_ROLLBACK'
 P=pathlib.Path(a['parentRelease']);e=original or actualenv();e.update(read(PARENT_STATE/'approval.json')['profiles']['botLive'])
 if DROPIN.exists():assert DROPIN.read_text()==read(B/'POSTSALE_DROPIN.json')['content'];DROPIN.unlink()
 switch(P);state=read(STATE/'activation.json');state.update(state='PREPARED',runtimeAllowed=False,linkedEntryAllowed=False,rollbackAt=utc());atomic(STATE/'activation.json',canon(state))
 assert run(['systemctl','daemon-reload']).returncode==0;restart(e,helper=False);app,h=awaithealth(P,previousPid);save()
 return receipt('ROLLBACK_'+uuid.uuid4().hex[:8]+'.json',{'status':'RESTORED_PARENT','release':str(P),'pid':app['pid'],'health':h.get('status'),'dataRestored':False,'whatsappReplay':False})

def activate():
 a,R=approval();gates();assert read(B/'PUBLICATION.json')['status']=='PASS_SOURCE_PUBLISHED_NOT_ACTIVE';assert str(C.resolve())==a['parentRelease'];assert health().get('bot_inbound_queue',{}).get('pendingTasks',0)==0,'WAIT_INBOUND_QUEUE'
 assert run(['systemctl','show','vitalismen-postsale-full-v203.service','-p','MainPID','--value']).stdout.strip()=='0','WAIT_CURRENT_POSTSALE';assert_web_idle()
 lock=open('/var/lib/vitalismen-deploy/ec-postsale-v203.lock','a');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB);before=target();allBefore=pm2list();original=actualenv();assert before['pid']==read(B/'BASELINE.json')['pid'];assert not DROPIN.exists()
 parent_state_preserved();assert run(['systemctl','is-active','vitalismen-postsale-full-v203.timer']).stdout.strip()=='active'
 receipt('ACTIVATION_BEFORE.json',{'release':str(C.resolve()),'pid':before['pid'],'restartCount':before['pm2_env']['restart_time'],'target':'vitalismen-automation','parentMutableStatePreserved':True})
 state=read(STATE/'activation.json');state.update(state='ACTIVE',runtimeAllowed=True,linkedEntryAllowed=False,linkedEntryAudience='PRIVATE_QA',linkedEntryActivatedAt=utc(),activatedAt=utc());atomic(STATE/'activation.json',canon(state));switch(R)
 try:
  desired=cleanenv('botLive');restart(desired);app,h=awaithealth(R,before['pid']);assert h.get('zapi',{}).get('connected') is True,'ZAPI_NOT_CONNECTED'
  assert app['pm2_env']['pm_cwd']==str(C) and app['pm2_env']['pm_exec_path']==str(C/'src/index.js')
  for prior in allBefore:
   if prior['name']!='vitalismen-automation':assert next(x for x in pm2list()if x['name']==prior['name'])['pid']==prior['pid'],'OTHER_PM2_PROCESS_CHANGED'
  content='[Service]\nExecStart=\nExecStart=/usr/bin/python3 '+str(B/'operations-controller.py')+' post-sale-run\n';receipt('POSTSALE_DROPIN.json',{'content':content});create(DROPIN,content.encode(),0o644)
  assert run(['systemctl','daemon-reload']).returncode==0;assert str(B/'operations-controller.py') in run(['systemctl','show','vitalismen-postsale-full-v203.service','-p','ExecStart','--value']).stdout
  save();create(R/'.activation-complete.json',canon({'status':'complete','commit':a['commit'],'activatedAt':utc(),'pm2Process':'vitalismen-automation','pid':app['pid']}),0o600)
  return receipt('ACTIVATION.json',{'pass':True,'commit':a['commit'],'release':str(R),'pidBefore':before['pid'],'pid':app['pid'],'restartDelta':1,'pmCwd':app['pm2_env']['pm_cwd'],'pmExecPath':app['pm2_env']['pm_exec_path'],'actualProcessCwd':str(pathlib.Path('/proc/'+str(app['pid'])+'/cwd').resolve()),'health':h.get('status'),'zapiConnected':True,'linkedEntryAudience':'DISABLED_PENDING_PUBLIC_PROOF','inheritedAutomationPreserved':True,'globalMongoBackupPass':False,'databaseMigrations':0})
 except BaseException as error:
  receipt('ACTIVATION_FAILURE.json',{'error':str(error)[:1200],'at':utc()});restore(target()['pid'],original);raise

def open_public():
 a,R=approval();assert C.resolve()==R;gates();s=read(STATE/'activation.json');assert s['state']=='ACTIVE' and s['runtimeAllowed']
 p=read(STATE/'linked-entry-qa-proof.json');assert p['kind']=='TEX_LINKED_ENTRY_V242' and p['commit']==a['commit']
 for key in ['officialInboundGuardVerified','firstChannelAndRestartDedupeVerified','cookieIsolationVerified','mediaOrderVerified','noOutboundOtpSender']:assert p[key] is True,key
 assert p['realWhatsAppInboundClaimed'] is False and p['whatsappSends']==0 and p['ordersCreated']==0 and p['metaEvents']==0
 s.update(linkedEntryAllowed=True,linkedEntryAudience='PUBLIC_SITE',linkedEntryQaProofSha256=sha(STATE/'linked-entry-qa-proof.json'),linkedEntryPublicAt=utc());atomic(STATE/'activation.json',canon(s))
 return receipt('LINKED_ENTRY_PUBLIC.json',{'pass':True,'commit':a['commit'],'at':utc(),'pm2Restarts':0,'noOutboundOtpSender':True})

def rollback_feature():
 a,R=approval();assert C.resolve()==R;s=read(STATE/'activation.json');assert s['state']=='ACTIVE'
 s.update(linkedEntryAllowed=False,linkedEntryRolledBackAt=utc());atomic(STATE/'activation.json',canon(s))
 return receipt('FEATURE_ROLLBACK_'+uuid.uuid4().hex[:8]+'.json',{'status':'FEATURE_DISABLED_COMPATIBLE_CODE_RETAINED','release':str(R),'pm2Restarts':0,'identityAndAntiReplayMemoryPreserved':True,'dataRestored':False})

if __name__=='__main__':
 actions={'publish':publish,'activate':activate,'open-public':open_public,'rollback-feature':rollback_feature,'rollback-code':lambda:restore(target()['pid']),'post-sale-run':lambda:post_sale('run'),'post-sale-dry-run':lambda:post_sale('dry-run')};assert sys.argv[1] in actions;print(json.dumps(actions[sys.argv[1]](),ensure_ascii=False))
