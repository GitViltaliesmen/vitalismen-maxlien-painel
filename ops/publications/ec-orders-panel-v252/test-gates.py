from pathlib import Path
import ast,json,hashlib,copy
H=Path(__file__).resolve().parent
s=(H/'operations-controller.py').read_text(encoding='utf8');f=next(n for n in ast.parse(s).body if isinstance(n,ast.FunctionDef)and n.name=='gates')
code=compile(ast.fix_missing_locations(ast.Module(body=[f],type_ignores=[])),'controller-gates-fixture','exec')
a=json.loads((H/'PREPARED.json').read_bytes())
q={'status':'PASS','candidateCommit':a['commit'],'productionUnchanged':True,'networkIsolated':True,'results':[{'name':n,'pass':True}for n in ['senior_guard','product_guard','focused_tests','complete_senior']]}
recover={'status':'PASS_CODE_CONFIG_RECOVERY_ONLY','privateKeyUploaded':False,'results':[{'tamperRejected':True}]}
native={'pass':True,'checks':list(range(15)),'candidateCommit':a['commit'],'realMongoose':True,'nativeHttpRoutes':True,'actualProviderCalls':0,'productionWrites':0,'physicalMessages':0,'networkIsolated':True}
cases={'qualification-r1/QUALIFICATION.json':q,'NATIVE_QUEUE-complete.json':native,'PANEL_BROWSER_TEST.json':{'status':'PASS','checks':list(range(8)),'providerRequests':0,'productionWrites':0,'physicalMessages':0},'CODE_CONFIG_RECOVERY_BEFORE.json':recover,'SCOPED_DATA_RECOVERY_BEFORE.json':{**recover,'status':'PASS_SCOPED_DATA_RECOVERY_ONLY'},'backend-delta.json':json.loads((H/'backend-delta.json').read_bytes()),'PROTECTED_FILES.json':{},'STATIC_BUILD.json':{'files':[]},**{n:{'pass':True}for n in ['INVERSE_TEST.json','STATIC_TEST.json','OPERATIONS_TEST.json','ALIGNMENT_PROBE.json','GATES_SEMANTIC_TEST.json']}}
a['parentRelease']=str((H/'official').resolve());B=(H/'synthetic-fixture').resolve();R=(H/'candidate').resolve();C=(H/'official').resolve()
for name in ['OPERATIONS_TEST.json','GATES_SEMANTIC_TEST.json']:cases[name]['controllerSha256']=hashlib.sha256(s.encode()).hexdigest()
binding={'candidateCommit':a['commit'],'hashes':a['hashes'],'gates':{},'operationalFiles':{}}
def read(p):
 p=Path(p)
 if p==B/'BINDINGS.json':return binding
 if p.is_relative_to(B):return cases[p.relative_to(B).as_posix()]
 return json.loads(p.read_bytes())
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
scope={'approval':lambda:(a,R),'read':read,'sha':sha,'B':B,'C':C,'pathlib':__import__('pathlib'),'hashlib':hashlib,'__file__':str(H/'operations-controller.py')}
exec(code,scope);scope['gates']();checks=['accepts_complete_fixture_gates']
for name,keys in [('qualification-r1/QUALIFICATION.json',['status','candidateCommit','productionUnchanged','networkIsolated','results']),('NATIVE_QUEUE-complete.json',['pass','checks','candidateCommit','realMongoose','nativeHttpRoutes','actualProviderCalls','productionWrites','physicalMessages','networkIsolated']),('PANEL_BROWSER_TEST.json',['status','checks','providerRequests','productionWrites','physicalMessages']),('CODE_CONFIG_RECOVERY_BEFORE.json',['status','privateKeyUploaded','results']),('SCOPED_DATA_RECOVERY_BEFORE.json',['status','privateKeyUploaded','results'])]:
 for key in keys:
  value=cases[name];old=copy.deepcopy(value[key]);value[key]=[]if isinstance(old,list)else not old if isinstance(old,bool)else 1 if isinstance(old,int)else 'FAIL'
  if key=='results':value[key]=[{'tamperRejected':False}]if 'RECOVERY'in name else []
  try:scope['gates']();raise RuntimeError('Gate accepted '+name+key)
  except AssertionError:checks.append('rejects:'+name+':'+key)
  finally:value[key]=old
for name in ['INVERSE_TEST.json','STATIC_TEST.json','OPERATIONS_TEST.json','ALIGNMENT_PROBE.json','GATES_SEMANTIC_TEST.json']:
 cases[name]['pass']=False
 try:scope['gates']();raise RuntimeError('Bad proof accepted')
 except AssertionError:checks.append('rejects:'+name)
 cases[name]['pass']=True
result={'project':'VITALISMEN_EC','pass':True,'checks':checks,'controllerSha256':sha(H/'operations-controller.py'),'productionActions':0,'syntheticGatesOnly':True}
(H/'GATES_SEMANTIC_TEST.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf8')
print(json.dumps({'pass':True,'semanticGateChecks':len(checks)}))
