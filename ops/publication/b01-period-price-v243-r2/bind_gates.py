from pathlib import Path
import subprocess,json,base64,hashlib
H=Path(__file__).resolve().parent;E=Path((H/'evidence-path.txt').read_text())
names=['QUALIFICATION', 'EXTRA_QUALIFICATION', 'CODE_CONFIG_RECOVERY', 'HTTP_SALE_TEST', 'INHERITED_REGRESSION', 'PUBLIC_BASELINE', 'OPERATIONS_TEST', 'INHERITED_CONTROL']
files={n+'.json':((E if n=='CODE_CONFIG_RECOVERY'else H)/(n+'.json')).read_bytes()for n in names};files['operations-controller.py']=(H/'operations-controller.py').read_bytes();files['stage-owner.py']=(H/'stage-owner.py').read_bytes()
remote=r'''
import pathlib,json,base64,hashlib,os
B=pathlib.Path('/opt/vitalismen-automacao/backups/b01-period-price-v243-r2-20261117');S=pathlib.Path('/var/lib/vitalismen-deploy/ec-b01-period-price-v243-r2');a=json.loads((S/'approval.json').read_text());assert str(pathlib.Path('/opt/vitalismen-automacao/current').resolve())==a['parentRelease']
sha=lambda p:hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
for n,encoded in FILES.items():
 data=base64.b64decode(encoded);p=B/n
 if p.exists():assert json.loads(p.read_bytes())==json.loads(data)if n.endswith('.json')else p.read_bytes()==data
 else:
  fd=os.open(p,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o400)
  with os.fdopen(fd,'wb')as f:f.write(data);f.flush();os.fsync(f.fileno())
 os.chmod(p,0o400)
binding={'project':'VITALISMEN_EC','candidateCommit':a['commit'],'hashes':a['hashes'],'approvalSha256':sha(S/'approval.json'),'controllerSha256':sha(B/'operations-controller.py'),'stageOwnerSha256':sha(B/'stage-owner.py'),'gates':{n:sha(B/(n+'.json'))for n in NAMES}}
fd=os.open(B/'BINDINGS.json',os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o400)
with os.fdopen(fd,'wb')as f:f.write((json.dumps(binding,ensure_ascii=False,indent=2)+'\n').encode());f.flush();os.fsync(f.fileno())
print(json.dumps(binding))
'''
p=subprocess.run(['ssh','-o','HostName=72.60.137.77','-o','BatchMode=yes','maxlien-vps-ec','python3 -I -B -S -'],input='NAMES='+repr(names)+'\nFILES='+repr({n:base64.b64encode(b).decode()for n,b in files.items()})+'\n'+remote,capture_output=True,text=True,encoding='utf-8',timeout=40)
assert p.returncode==0,p.stderr[-1000:];r=json.loads(p.stdout);(H/'BINDINGS.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({'status':'BOUND','gates':len(r['gates'])}))
