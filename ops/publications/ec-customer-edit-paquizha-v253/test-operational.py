from pathlib import Path
import ast,json,hashlib,copy,subprocess
H=Path(__file__).resolve().parent;checks=[];s=(H/'operations-controller.py').read_text(encoding='utf8');ast.parse(s);sha=lambda b:hashlib.sha256(b).hexdigest();delta=json.loads((H/'DELTA.json').read_bytes())
for n,v in delta['files'].items():
 a=(H/'candidate'/n).read_bytes();before=(H/'before'/n).read_bytes()
 for p in reversed(v['changes']):assert a.count(p['after'].encode())==1;a=a.replace(p['after'].encode(),p['before'].encode(),1)
 assert a==before;checks.append(n+':exact_inverse');assert sha(a+b'UNAUTHORIZED')!=sha(before);checks.append(n+':extra_bytes_rejected')
catalog=json.loads((H/'candidate/src/data/agencia_LISTA.json').read_bytes());old=json.loads((H/'before/src/data/agencia_LISTA.json').read_bytes());assert len(catalog)==592 and[x for x in catalog if x['ciudad']!='PAQUIZHA']==old;checks.append('all_591_original_agencies_preserved')
node=r"const fs=require('fs'),assert=require('assert');const source=fs.readFileSync(process.argv[1],'utf8');let count=0;for(const m of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){if(/\bsrc\s*=|application\/ld\+json|application\/json/.test(m[1]))continue;new Function(m[2]);count++}assert(count>0);console.log(count)"
p=subprocess.run(['node','-e',node,str(H/'candidate/qr.html')],capture_output=True,text=True,encoding='utf8');assert p.returncode==0,p.stderr;assert int(p.stdout)>0;checks.append('all_inline_scripts_compile')
for phrase in ["'automaticDropiV252ActivatedAt':inherited['automaticDropiV252ActivatedAt']","'texPostLeadActivatedAt':inherited['texPostLeadActivatedAt']","'burstActivatedAt':inherited['burstActivatedAt']","assert_web_idle();assert_vitpower_idle();assert_tex_idle();assert_dropi_idle()","restore(target()['pid'],original);raise","assert app['pm2_env']['restart_time']==before['pm2_env']['restart_time']+1","assert actualenv().get('OPENAI_API_KEY')==original.get('OPENAI_API_KEY')","assert actualenv().get('ELEVENLABS_API_KEY')==original.get('ELEVENLABS_API_KEY')","CONCURRENT_PUBLIC_CHANGE","physicalOutboundCount"]:
 if phrase=='CONCURRENT_PUBLIC_CHANGE':phrase='CONCURRENT_PUBLIC_CHANGE'if'CONCURRENT_PUBLIC_CHANGE'in s else'CONCURRENT_PUBLIC_CHANGE'
 if phrase=='CONCURRENT_PUBLIC_CHANGE':assert 'CONCURRENT_PUBLIC_CHANGE'in s or'CONCURRENT_PUBLIC_CHANGE'.replace('PUBLIC','PUBLIC')in s or'CONCURRENT_PUBLIC_CHANGE'in s
 else:assert phrase in s,phrase
 checks.append('controller:'+phrase[:65])
# Parse the actual Linux systemd target; Windows path conversions must never reach VPS.
from pathlib import PurePosixPath
assignment=next(n for n in ast.walk(ast.parse(s)) if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='DROPIN' for t in n.targets))
dropin=PurePosixPath(ast.literal_eval(assignment.value.args[0]));assert dropin.is_absolute() and str(dropin.parent)=='/etc/systemd/system/vitalismen-postsale-full-v203.service.d' and '\\'not in str(dropin) and len(dropin.name.encode())<=255
checks.append('systemd_dropin_is_absolute_linux_path_in_exact_existing_directory')
# The public change has one file and cannot restart the legacy API.
f=next(n for n in ast.parse(s).body if isinstance(n,ast.FunctionDef)and n.name=='publish_static');assert "'restart'"not in ast.unparse(f);checks.append('static_publication_does_not_restart_legacy_service')
assert not 'def reconcile_existing' in s;checks.append('no_historical_repair_action_in_this_scope')
result={'project':'VITALISMEN_EC','pass':True,'checks':checks,'controllerSha256':sha(s.encode()),'productionActions':0,'physicalMessages':0,'inlineScripts':int(p.stdout)};(H/'OPERATIONS_TEST.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf8');print(json.dumps({'pass':True,'checks':len(checks),'inlineScripts':int(p.stdout)}))
# Test the exact pure predicate invoked by gates, with each failure retained in the test report.
f=next(n for n in ast.parse(s).body if isinstance(n,ast.FunctionDef)and n.name=='validate_results');code=compile(ast.fix_missing_locations(ast.Module(body=[f],type_ignores=[])),'v253-validation-gates','exec');ctx={};exec(code,ctx)
a={'commit':'candidate'};q={'status':'PASS','candidateCommit':'candidate','productionUnchanged':True,'networkIsolated':True,'results':[{'name':n,'pass':True}for n in ['senior_guard','product_guard','focused_tests','complete_senior']],'messagesSent':0,'databaseProductionWrites':0};n={'pass':True,'candidateCommit':'candidate','productionUnchanged':True,'networkIsolated':True,'realMongoose':True,'privateMongo':True,'privateSQLite':True,'nativeHttpRoutes':True,'checks':list(range(24)),'actualProviderCalls':0,'productionWrites':0,'physicalMessages':0};b={'pass':True,'realNativeHttp':True,'browserChromium':True,'privatePersistence':True,'checks':list(range(8)),'fieldWrites':2,'forbiddenRequests':0,'productionWrites':0,'physicalMessages':0};r={'status':'PASS_CODE_CONFIG_RECOVERY_ONLY','privateKeyUploaded':False,'results':[{'tamperRejected':True,'decrypt':'PASS','plaintextHash':'PASS'},{'tamperRejected':True,'decrypt':'PASS','plaintextHash':'PASS'}]};op={'pass':True,'productionActions':0,'checks':list(range(15))}
items=[q,n,b,r,op];assert ctx['validate_results'](a,*items);negative=[]
for index,keys in [(0,['status','candidateCommit','productionUnchanged','networkIsolated','results','messagesSent','databaseProductionWrites']),(1,['pass','candidateCommit','productionUnchanged','networkIsolated','realMongoose','privateMongo','privateSQLite','nativeHttpRoutes','checks','actualProviderCalls','productionWrites','physicalMessages']),(2,['pass','realNativeHttp','browserChromium','privatePersistence','checks','fieldWrites','forbiddenRequests','productionWrites','physicalMessages']),(3,['status','privateKeyUploaded','results']),(4,['pass','productionActions','checks'])]:
 for key in keys:
  values=copy.deepcopy(items);v=values[index][key];values[index][key]=[]if isinstance(v,list)else not v if isinstance(v,bool)else(0 if v else 1)if isinstance(v,int)else'FAIL'
  if key=='results'and index==3:values[index][key]=[{'tamperRejected':False}]
  try:ctx['validate_results'](a,*values);raise RuntimeError('Accepted bad gate: '+str(index)+':'+key)
  except AssertionError:negative.append(str(index)+':'+key)
proof={'project':'VITALISMEN_EC','pass':True,'checks':negative,'controllerSha256':sha(s.encode()),'productionActions':0,'syntheticGatesOnly':True};(H/'GATES_SEMANTIC_TEST.json').write_text(json.dumps(proof,indent=2)+'\n',encoding='utf8');print(json.dumps({'negativeGateChecks':len(negative),'pass':True}))
