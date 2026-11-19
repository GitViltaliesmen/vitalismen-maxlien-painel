from pathlib import Path
import base64, hashlib, json, subprocess

H=Path(__file__).resolve().parent
E=Path((H/'evidence-path.txt').read_text(encoding='utf8'))
NAMES=['QUALIFICATION','EXTRA_QUALIFICATION','CODE_CONFIG_RECOVERY','HTTP_TEX_TEST','INHERITED_REGRESSION','PUBLIC_BASELINE','OPERATIONS_TEST','INHERITED_CONTROL']
ssh=['ssh','-o','HostName=72.60.137.77','-o','BatchMode=yes','maxlien-vps-ec']
remote=r'''
import pathlib,base64,json
B=pathlib.Path('/opt/vitalismen-automacao/backups/tex-entry-greeting-v249-r6-20261118')
out={}
for n in ['QUALIFICATION','EXTRA_QUALIFICATION','HTTP_TEX_TEST','INHERITED_REGRESSION','PUBLIC_BASELINE','INHERITED_CONTROL']:
 p=B/(n+'.json');assert p.exists(),'GATE_NOT_READY:'+n
 x=json.loads(p.read_bytes());assert x.get('status')=='PASS' if n in ['QUALIFICATION','EXTRA_QUALIFICATION'] else x.get('pass') is True,'GATE_NOT_PASSED:'+n
 out[n]=base64.b64encode(p.read_bytes()).decode()
print(json.dumps(out))
'''
p=subprocess.run([*ssh,'python3 -I -B -S -'],input=remote,capture_output=True,text=True,encoding='utf8',timeout=25)
assert p.returncode==0,p.stderr[-1200:]
for n,v in json.loads(p.stdout).items():(H/(n+'.json')).write_bytes(base64.b64decode(v))
assert json.loads((H/'SOURCE_REVIEW.json').read_bytes())['pass']
candidate=json.loads((H/'PREPARED.json').read_bytes())
tests=json.loads((H/'OPERATIONS_TEST.json').read_bytes())
assert tests['pass'] and tests['controllerSha256']==hashlib.sha256((H/'operations-controller.py').read_bytes()).hexdigest()
files={n+'.json':((E if n=='CODE_CONFIG_RECOVERY'else H)/(n+'.json')).read_bytes() for n in NAMES}
files['operations-controller.py']=(H/'operations-controller.py').read_bytes()
bind=r'''
import pathlib,json,base64,hashlib,os
B=pathlib.Path('/opt/vitalismen-automacao/backups/tex-entry-greeting-v249-r6-20261118');S=pathlib.Path('/var/lib/vitalismen-deploy/ec-tex-entry-greeting-v249-r6')
a=json.loads((S/'approval.json').read_bytes());assert str(pathlib.Path('/opt/vitalismen-automacao/current').resolve())==a['parentRelease']
sha=lambda p:hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
for n,encoded in FILES.items():
 data=base64.b64decode(encoded);p=B/n
 if p.exists():assert p.read_bytes()==data,'EXISTING_EVIDENCE_DIFFERS:'+n
 else:
  fd=os.open(p,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o400)
  with os.fdopen(fd,'wb')as f:f.write(data);f.flush();os.fsync(f.fileno())
 os.chmod(p,0o400)
binding={'project':'VITALISMEN_EC','candidateCommit':a['commit'],'hashes':a['hashes'],'approvalSha256':sha(S/'approval.json'),'controllerSha256':sha(B/'operations-controller.py'),'gates':{n:sha(B/(n+'.json'))for n in NAMES}}
fd=os.open(B/'BINDINGS.json',os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o400)
with os.fdopen(fd,'wb')as f:f.write((json.dumps(binding,ensure_ascii=False,indent=2)+'\n').encode());f.flush();os.fsync(f.fileno())
print(json.dumps(binding))
'''
p=subprocess.run([*ssh,'python3 -I -B -S -'],input='NAMES='+repr(NAMES)+'\nFILES='+repr({n:base64.b64encode(v).decode()for n,v in files.items()})+'\n'+bind,capture_output=True,text=True,encoding='utf8',timeout=30)
assert p.returncode==0,p.stderr[-1500:]
x=json.loads(p.stdout);assert x['candidateCommit']==candidate['commit'];(H/'BINDINGS.json').write_bytes((json.dumps(x,indent=2)+'\n').encode())
print(json.dumps({'status':'BOUND_PASSED_GATES_NOT_ACTIVE','commit':x['candidateCommit'],'gates':len(x['gates'])}))
