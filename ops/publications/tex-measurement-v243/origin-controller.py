# PROJECT=VITALISMEN_EC. Exact measurement publication; never sends customer/test events.
import pathlib,json,os,sys,subprocess,hashlib,uuid,time,datetime,urllib.request,fcntl
ROOT=pathlib.Path('/root/tex-meta-attribution-v243-20261117-r5');B=ROOT/'production-backup';APP=pathlib.Path('/opt/cloaker')
STATE=APP/'private/meta/tex-measurement-v243-activation.json'
sha=lambda p:hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
read=lambda p:json.loads(pathlib.Path(p).read_text())
canon=lambda x:(json.dumps(x,ensure_ascii=False,indent=2)+'\n').encode()
utc=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')
def run(args,**kwargs):return subprocess.run(args,capture_output=True,text=True,timeout=120,**kwargs)
def put(path,data,mode=0o644,uid=0,gid=0):
 p=pathlib.Path(path);assert p.parent.is_dir() and not p.is_symlink();tmp=p.with_name(p.name+'.tex243-'+uuid.uuid4().hex)
 fd=os.open(tmp,os.O_CREAT|os.O_EXCL|os.O_WRONLY,mode)
 with os.fdopen(fd,'wb') as f:os.fchmod(f.fileno(),mode);f.write(data);f.flush();os.fsync(f.fileno())
 os.chown(tmp,uid,gid);os.replace(tmp,p);fd=os.open(p.parent,os.O_DIRECTORY)
 try:os.fsync(fd)
 finally:os.close(fd)
def receipt(name,data):
 p=B/name;assert not p.exists();put(p,canon(data),0o400);return data
def pm2():
 r=run(['pm2','jlist'],env={**os.environ,'NODE_OPTIONS':''});assert r.returncode==0;return json.loads(r.stdout)
def target():
 rows=[p for p in pm2() if p['name']=='cloaker'];assert len(rows)==1;return rows[0]
def manifest():
 assert os.getuid()==0
 binding=read(B/'BINDINGS.json');assert sha(__file__)==binding['controllerSha256'];assert sha(B/'PREPARED.json')==binding['manifestSha256']
 m=read(B/'PREPARED.json');assert m['project']=='VITALISMEN_EC';assert m['backendCommit']=='d27cc7c7f2a21ad74e02ca5b6332ee50b151399b'
 assert m['origin']=='169.58.51.100' and m['officialUrl']=='https://plusmen.shop/tex';assert m['zeroVulnerabilitiesRequired'] is True
 for p,record in m['files'].items():
  assert (p.startswith('/opt/cloaker/') and '..' not in pathlib.Path(p).parts) or p in m['sitePaths']
  assert sha(B/'candidate'/record['candidate'])==record['sha256'],'STAGED_SOURCE_CHANGED:'+p
 for p,digest in m['native'].items():assert sha(p)==digest,'FROZEN_NATIVE_CHANGED:'+p
 assert sha(APP/'private/meta/vitpower-config.json')==m['metaConfigSha256'];assert sha(APP/'private/meta/tex-measurement-v243.secret')==m['keySha256']
 for name,digest in binding['gates'].items():
  assert sha(B/(name+'.json'))==digest;assert read(B/(name+'.json'))['pass'] is True,'FAILED_GATE:'+name
 counts=read(B/'DEPENDENCY_AUDIT.json')['metadata']['vulnerabilities'];assert all(counts[k]==0 for k in ['info','low','moderate','high','critical','total'])
 return m
def same_before(m,scope):
 for p,r in m['files'].items():
  if r['scope']!=scope:continue
  target=pathlib.Path(p);before=r['before']
  if before['exists']:assert target.is_file() and not target.is_symlink() and sha(target)==before['sha256'],'CONCURRENT_FILE_CHANGED:'+p
  else:assert not target.exists(),'UNEXPECTED_NEW_FILE:'+p
def restart(interpreter,previous_pid,expected_desktop_sha):
 # No --update-env: preserve the existing process environment and all other PM2 apps.
 r=run(['pm2','restart','cloaker','--interpreter',interpreter],env={**os.environ,'NODE_OPTIONS':''});assert r.returncode==0,'ORIGIN_PM2_RESTART_FAILED'
 deadline=time.monotonic()+90
 while time.monotonic()<deadline:
  try:
   p=target();e=p['pm2_env']
   if p['pid']!=previous_pid and e['status']=='online' and pathlib.Path('/proc/'+str(p['pid'])+'/cwd').resolve()==APP:
    actual=pathlib.Path('/proc/'+str(p['pid'])+'/exe').resolve();assert actual==pathlib.Path(interpreter).resolve(),'ORIGIN_WRONG_NODE_INTERPRETER'
    req=urllib.request.Request('http://127.0.0.1:3002/tex',headers={'Host':'plusmen.shop','User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36'})
    with urllib.request.urlopen(req,timeout=4) as f:body=f.read();assert f.status==200
    assert hashlib.sha256(body).hexdigest()==expected_desktop_sha,'DESKTOP_CHANGED_AFTER_RESTART'
    return p
  except (OSError,urllib.error.URLError,ConnectionError):pass
  time.sleep(.4)
 raise RuntimeError('ORIGIN_HEALTH_TIMEOUT')
def save_pm2():
 assert run(['pm2','save'],env={**os.environ,'NODE_OPTIONS':''}).returncode==0
 for n in ['dump.pm2','dump.pm2.bak']:
  p=pathlib.Path('/root/.pm2')/n
  if p.exists():p.chmod(0o600)
def restore_code(m,previous_pid):
 # Emergency rollback before site publication only. Never erase proof/identity ledgers.
 assert not (B/'SITE_PUBLIC.json').exists(),'PUBLISHED_COHORT_REQUIRES_COMPATIBLE_FEATURE_ROLLBACK'
 put(STATE,canon({'version':243,'enabled':False,'activatedAt':utc(),'rollback':True}),0o400)
 for p,r in m['files'].items():
  if r['scope']!='application':continue
  target=pathlib.Path(p);old=r['before']
  if old['exists']:
   source=B/'before'/old['backup'];assert sha(source)==old['sha256'];put(target,source.read_bytes(),old['mode'],old['uid'],old['gid'])
  elif target.exists():
   assert sha(target)==r['sha256'];target.unlink()
 current=APP/'node_modules';old=B/'node_modules.before'
 if old.exists():
  failed=B/('node_modules.failed-'+uuid.uuid4().hex[:8]);os.rename(current,failed);os.rename(old,current)
 p=restart(m['originalInterpreter'],previous_pid,m['desktopSha256']);save_pm2()
 return receipt('EMERGENCY_ROLLBACK_'+uuid.uuid4().hex[:8]+'.json',{'status':'RESTORED_PREPUBLICATION_BASELINE','pid':p['pid'],'dataRestored':False,'measurementLedgersErased':False,'securityStatus':'ORIGINAL_BASELINE_NOT_QUALIFIED_ZERO'})
def publish_application():
 m=manifest();assert not (B/'APPLICATION_PUBLIC.json').exists();same_before(m,'application')
 ready=read(B/'BACKEND_READY.json');assert ready['pass'] is True and ready['commit']==m['backendCommit'] and ready['runtimeActive'] is True
 before=target();assert before['pid']==m['originPid'];all_before=pm2()
 runtime=pathlib.Path(m['nodeInterpreter']);assert runtime.is_file() and sha(runtime)==m['nodeBinarySha256'];assert run([str(runtime),'--version']).stdout.strip()=='v22.23.5'
 assert not (B/'node_modules.before').exists();assert (B/'node_modules.candidate').is_dir()
 put(STATE,canon({'project':'VITALISMEN_EC','version':243,'enabled':False,'activatedAt':utc(),'backendCommit':m['backendCommit']}),0o400)
 try:
  os.rename(APP/'node_modules',B/'node_modules.before');os.rename(B/'node_modules.candidate',APP/'node_modules')
  # Dependencies/helpers first; server entry last.
  for p in sorted((p for p,r in m['files'].items() if r['scope']=='application'),key=lambda p:(p.endswith('/server.js'),p)):
   r=m['files'][p];old=r['before'];path=pathlib.Path(p);path.parent.mkdir(parents=True,exist_ok=True)
   put(path,(B/'candidate'/r['candidate']).read_bytes(),old.get('mode',0o644),old.get('uid',0),old.get('gid',0));assert sha(path)==r['sha256']
  app=restart(str(runtime),before['pid'],m['desktopSha256'])
  for p in all_before:
   if p['name']!='cloaker':assert next(x for x in pm2() if x['name']==p['name'])['pid']==p['pid'],'OTHER_ORIGIN_PROCESS_CHANGED'
  env={**os.environ,'NODE_OPTIONS':'','PATH':str(runtime.parent)+':'+os.environ['PATH']}
  for cmd in [['npm','run','guard:protocolo-g-freeze'],['npm','run','guard:meta-ec-protocolo-g'],['npm','run','guard:security-predeploy']]:
   r=run(cmd,cwd=APP,env=env);assert r.returncode==0,'PUBLISHED_ORIGIN_GUARD_FAILED:'+cmd[-1]
  save_pm2()
  return receipt('APPLICATION_PUBLIC.json',{'project':'VITALISMEN_EC','pass':True,'pid':app['pid'],'nodeVersion':'v22.23.5','interpreter':str(runtime),'cwd':app['pm2_env']['pm_cwd'],'exec':app['pm2_env']['pm_exec_path'],'desktopUnchanged':True,'zeroVulnerabilities':True,'measurementEnabled':False,'otherProcessPidsUnchanged':True,'at':utc()})
 except BaseException as e:
  receipt('APPLICATION_FAILURE.json',{'error':str(e)[:300],'at':utc()});restore_code(m,target()['pid']);raise
def publish_site():
 m=manifest();assert read(B/'APPLICATION_PUBLIC.json')['pass'];assert not (B/'SITE_PUBLIC.json').exists();same_before(m,'site')
 ready=read(B/'BACKEND_MEASUREMENT_READY.json');assert ready['pass'] is True and ready['commit']==m['backendCommit'] and ready['measurementEnabled'] is True
 # New assets exist before switching the HTML's two versioned references.
 paths=sorted((p for p,r in m['files'].items() if r['scope']=='site'),key=lambda p:(p.endswith('/index.html'),p.endswith('/chat-tex-ultra.js'),p))
 for p in paths:
  if p=='/etc/nginx/sites-available/plusmen.shop':continue
  if p.endswith('/index.html') or p.endswith('/chat-tex-ultra.js'):continue
  r=m['files'][p];old=r['before'];put(p,(B/'candidate'/r['candidate']).read_bytes(),old.get('mode',0o644),old.get('uid',0),old.get('gid',0))
 nginx='/etc/nginx/sites-available/plusmen.shop';r=m['files'][nginx];old=r['before'];put(nginx,(B/'candidate'/r['candidate']).read_bytes(),old['mode'],old['uid'],old['gid'])
 r=run(['nginx','-t'])
 if r.returncode:
  put(nginx,(B/'before'/old['backup']).read_bytes(),old['mode'],old['uid'],old['gid']);raise RuntimeError('NGINX_CANDIDATE_REJECTED_BASELINE_RESTORED')
 assert run(['nginx','-s','reload']).returncode==0
 state=read(STATE);state.update(enabled=True,measurementEnabledAt=utc());put(STATE,canon(state),0o400)
 for p in [p for p in paths if p.endswith('/chat-tex-ultra.js') or p.endswith('/index.html')]:
  r=m['files'][p];old=r['before'];put(p,(B/'candidate'/r['candidate']).read_bytes(),old['mode'],old['uid'],old['gid'])
 for p,r in m['files'].items():assert sha(p)==r['sha256'],'POST_PUBLICATION_SOURCE_DRIFT:'+p
 for p,h in m['native'].items():assert sha(p)==h,'NATIVE_OR_DESKTOP_CHANGED:'+p
 return receipt('SITE_PUBLIC.json',{'project':'VITALISMEN_EC','pass':True,'backendCommit':m['backendCommit'],'pixelId':'1100892582698669','phone':'553171862958','originalWhatsappFileUnchanged':True,'playerAndCtaTimingUnchanged':True,'desktopUnchanged':True,'siteFiles':m['sitePaths'],'at':utc(),'syntheticMetaEventsSent':0})
def rollback_feature():
 m=manifest();s=read(STATE);s.update(enabled=False,rolledBackAt=utc());put(STATE,canon(s),0o400)
 return receipt('FEATURE_ROLLBACK_'+uuid.uuid4().hex[:8]+'.json',{'project':'VITALISMEN_EC','status':'MEASUREMENT_DISABLED_COMPATIBLE_CODE_AND_SAFE_DEPENDENCIES_RETAINED','identityAndMeasurementLedgersErased':False,'pm2Restarts':0,'nginxReloads':0})
if __name__=='__main__':
 lock=open(ROOT/'origin-publication.lock','a');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
 actions={'publish-application':publish_application,'publish-site':publish_site,'rollback-feature':rollback_feature};assert sys.argv[1] in actions;print(json.dumps(actions[sys.argv[1]]()))
