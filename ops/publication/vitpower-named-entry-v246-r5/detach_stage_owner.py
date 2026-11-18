from pathlib import Path
import subprocess,json,uuid,hashlib
H=Path(__file__).resolve().parent;old=json.loads((H/'STAGE_OWNER_READY.json').read_bytes());lease=uuid.uuid4().hex
remote=r"""
import pathlib,json,os,signal,subprocess,time,hashlib
B=pathlib.Path('/opt/vitalismen-automacao/backups/vitpower-named-entry-v246-r5-20261118');a=json.loads((B/'PREPARED.json').read_bytes())
assert pathlib.Path('/opt/vitalismen-automacao/current').resolve()==pathlib.Path(a['parentRelease'])
assert not(B/'STAGE_OWNER_ACTION.json').exists() and not(B/'BINDINGS.json').exists()
ready=B/'STAGE_OWNER_READY.json';old=json.loads(ready.read_bytes());assert old==OLD and old['candidateCommit']==a['commit']
pid=old['pid'];assert str(B/'stage-owner.py').encode()in pathlib.Path('/proc/'+str(pid)+'/cmdline').read_bytes()
assert hashlib.sha256((B/'stage-owner.py').read_bytes()).hexdigest()==SOURCE_SHA
os.kill(pid,signal.SIGTERM)
for i in range(30):
 if not pathlib.Path('/proc/'+str(pid)).exists():break
 time.sleep(.1)
else:raise RuntimeError('OLD_OWNER_NOT_STOPPED')
archive=B/'STAGE_OWNER_READY_BEFORE_TRANSPORT_DETACH.json';assert not archive.exists();ready.rename(archive)
log=B/'STAGE_OWNER_DETACHED.private.log';fd=os.open(log,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
with os.fdopen(fd,'wb')as out:
 p=subprocess.Popen(['python3','-I','-B','-S',str(B/'stage-owner.py'),LEASE],stdin=subprocess.DEVNULL,stdout=out,stderr=subprocess.STDOUT,start_new_session=True,env={**os.environ,'NODE_OPTIONS':''})
for i in range(40):
 if ready.exists():break
 if p.poll()is not None:raise RuntimeError('DETACHED_OWNER_FAILED')
 time.sleep(.1)
else:raise RuntimeError('NO_NEW_OWNER_READY')
r=json.loads(ready.read_bytes());assert r['pid']==p.pid and r['leaseId']==LEASE
print(json.dumps({'ready':r,'previousOwner':old,'noActionWasTriggered':True,'ownerStdoutDurable':str(log),'published':False}))
"""
p=subprocess.run(['ssh','-o','HostName=72.60.137.77','-o','BatchMode=yes','maxlien-vps-ec','python3 -I -B -S -'],input='OLD='+repr(old)+'\nLEASE='+repr(lease)+'\nSOURCE_SHA='+repr(hashlib.sha256((H/'stage-owner.py').read_bytes()).hexdigest())+'\n'+remote,capture_output=True,text=True,encoding='utf-8',timeout=20);assert p.returncode==0,p.stderr[-1200:];x=json.loads(p.stdout)
(H/'STAGE_OWNER_READY_BEFORE_TRANSPORT_DETACH.json').write_text(json.dumps(old,indent=2)+'\n',encoding='utf-8');(H/'STAGE_OWNER_READY.json').write_text(json.dumps(x['ready'],indent=2)+'\n',encoding='utf-8');(H/'STAGE_OWNER_TRANSPORT_RESILIENCE.json').write_text(json.dumps(x,indent=2)+'\n',encoding='utf-8');print(json.dumps(x))
