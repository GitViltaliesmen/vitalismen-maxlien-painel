import pathlib,runpy,json,tempfile,hashlib,shutil
H=pathlib.Path(__file__).resolve().parent;checks=[]
def load():return runpy.run_path(str(H/'origin-controller.py'),run_name='isolated_controller_test')
s=load();g=s['publish_application'].__globals__;effects=[]
g.update(manifest=lambda:{'backendCommit':'approved'},same_before=lambda *a:None,read=lambda p:{'pass':False,'commit':'approved','runtimeActive':True},target=lambda:effects.append('pm2_read'),put=lambda *a:effects.append('write'))
try:s['publish_application']();raise RuntimeError('Unqualified backend admitted')
except AssertionError:assert not effects;checks.append('application_denies_failed_backend_before_mutation')
s=load();g=s['rollback_feature'].__globals__;state={'version':243,'enabled':True,'backendCommit':'approved','otherProducts':'preserved','originalDate':'keep'};writes=[]
g.update(manifest=lambda:{},read=lambda p:dict(state),put=lambda p,b,*args:writes.append(json.loads(b)),utc=lambda:'now',receipt=lambda n,x:x)
r=s['rollback_feature']();assert len(writes)==1 and writes[0]['enabled'] is False and writes[0]['otherProducts']=='preserved' and writes[0]['originalDate']=='keep';assert r['identityAndMeasurementLedgersErased'] is False and r['pm2Restarts']==0;checks.append('feature_rollback_retains_safe_dependencies_and_memory')
temp=pathlib.Path(tempfile.mkdtemp(prefix='tex243-origin-controller-'))
try:
 s=load();g=s['restore_code'].__globals__;g.update(B=temp,put=lambda *a:effects.append('write'));(temp/'SITE_PUBLIC.json').write_text('{}')
 try:s['restore_code']({},1);raise RuntimeError('Incompatible code rollback admitted')
 except AssertionError:assert not effects;checks.append('published_cohort_requires_compatible_rollback')
 (temp/'SITE_PUBLIC.json').unlink();s=load();g=s['publish_site'].__globals__;g.update(B=temp,manifest=lambda:{'backendCommit':'approved'},same_before=lambda *a:None,read=lambda p:{'pass':True,'commit':'approved','measurementEnabled':False},put=lambda *a:effects.append('write'))
 try:s['publish_site']();raise RuntimeError('Site admitted before measurement readiness')
 except AssertionError:assert not effects;checks.append('site_denies_disabled_backend_before_mutation')
finally:
 assert temp.resolve().parent==pathlib.Path(tempfile.gettempdir()).resolve();shutil.rmtree(temp)

# Exercise the real restart verifier against separate application/public responses.
import os,sys,types,urllib.request
for mode in ['matching','application_changed','public_changed']:
 s=load();g=s['restart'].__globals__;application=b'application baseline';public=b'public nginx baseline';seen=[]
 class Response:
  status=200
  def __init__(self,body):self.body=body
  def __enter__(self):return self
  def __exit__(self,*args):pass
  def read(self):return self.body
 def opener(req,timeout):
  seen.append(req.full_url)
  if req.full_url=='http://127.0.0.1:3002/tex':return Response(b'changed' if mode=='application_changed' else application)
  assert req.full_url=='https://plusmen.shop/tex'
  return Response(b'changed' if mode=='public_changed' else public)
 original=urllib.request.urlopen;urllib.request.urlopen=opener
 g.update(APP=pathlib.Path.cwd().resolve(),run=lambda *a,**kw:types.SimpleNamespace(returncode=0),target=lambda:{'pid':os.getpid(),'pm2_env':{'status':'online'}})
 try:
  try:
   result=s['restart'](str(pathlib.Path('/proc/self/exe').resolve()),-1,hashlib.sha256(public).hexdigest(),hashlib.sha256(application).hexdigest())
   assert mode=='matching' and result['pid']==os.getpid() and seen==['http://127.0.0.1:3002/tex','https://plusmen.shop/tex'];checks.append('restart_checks_both_exact_baselines')
  except AssertionError as e:
   if mode=='matching':raise
   expected='APPLICATION_DESKTOP_CHANGED_AFTER_RESTART' if mode=='application_changed' else 'PUBLIC_DESKTOP_CHANGED_AFTER_RESTART'
   assert str(e)==expected;checks.append('restart_rejects_'+mode)
 finally:urllib.request.urlopen=original

report={'project':'VITALISMEN_EC','pass':True,'checks':checks,'controllerSha256':hashlib.sha256((H/'origin-controller.py').read_bytes()).hexdigest(),'productionMutations':0};(H/'ORIGIN_CONTROLLER_TESTS.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
