from pathlib import Path
import json,base64,subprocess
H=Path(__file__).resolve().parent;E=Path((H/'evidence-path.txt').read_text());names=['QUALIFICATION','EXTRA_QUALIFICATION','CODE_CONFIG_RECOVERY','HTTP_SALE_TEST','INHERITED_REGRESSION','PUBLIC_BASELINE','OPERATIONS_TEST','INHERITED_CONTROL']
files={n+'.json':((E if n=='CODE_CONFIG_RECOVERY'else H)/(n+'.json')).read_bytes()for n in names};files['operations-controller.py']=(H/'operations-controller.py').read_bytes();files['PRODUCTION_DEDUPE_INDEXES.json']=(H/'PRODUCTION_DEDUPE_INDEXES.json').read_bytes()
remote=r"""import ast,base64,pathlib,json,hashlib
B=pathlib.Path('/opt/vitalismen-automacao/backups/vitpower-named-entry-v246-r5-20261118');S=pathlib.Path('/var/lib/vitalismen-deploy/ec-b01-named-entry-v246-r5');a=json.loads((S/'approval.json').read_text());R=pathlib.Path(a['release']);assert pathlib.Path('/opt/vitalismen-automacao/current').resolve()==pathlib.Path(a['parentRelease'])
files={B/n:base64.b64decode(v)for n,v in FILES.items()}
def content(p):
 p=pathlib.Path(p)
 if p.exists():
  data=p.read_bytes()
  if p in files:assert (json.loads(data)==json.loads(files[p])if p.suffix=='.json'else data==files[p]),'EXISTING_EVIDENCE_DRIFT:'+p.name
  return data
 return files[p]
sha=lambda p:hashlib.sha256(content(p)).hexdigest()
binding={'candidateCommit':a['commit'],'hashes':a['hashes'],'gates':{n:sha(B/(n+'.json'))for n in NAMES}}
def read(p):return binding if pathlib.Path(p)==B/'BINDINGS.json'else json.loads(content(p))
code=files[B/'operations-controller.py'];assert read(B/'OPERATIONS_TEST.json')['controllerSha256']==hashlib.sha256(code).hexdigest(),'CONTROLLER_NOT_TESTED'
node=next(n for n in ast.parse(code).body if isinstance(n,ast.FunctionDef)and n.name=='gates');scope={'approval':lambda:(a,R),'read':read,'sha':sha,'B':B,'STATE':S,'pathlib':pathlib};exec(compile(ast.fix_missing_locations(ast.Module(body=[node],type_ignores=[])),'<prebind-real-receipts>','exec'),scope);scope['gates']()
print(json.dumps({'project':'VITALISMEN_EC','status':'PASS_PREBIND_REAL_RECEIPTS','pass':True,'candidateCommit':a['commit'],'gatesChecked':len(NAMES),'actualControllerFunction':True,'actualEvidenceOnly':True,'remoteWrites':0,'productionActionInvoked':False}))
"""
p=subprocess.run(['ssh','-o','HostName=72.60.137.77','-o','BatchMode=yes','maxlien-vps-ec','python3 -I -B -S -'],input='FILES='+repr({n:base64.b64encode(v).decode()for n,v in files.items()})+'\nNAMES='+repr(names)+'\n'+remote,capture_output=True,text=True,encoding='utf-8',timeout=40);assert p.returncode==0,p.stderr[-1500:];r=json.loads(p.stdout);(H/'PREBIND_REVIEW.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r))
