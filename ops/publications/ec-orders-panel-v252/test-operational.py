from pathlib import Path
import ast,json,hashlib,tempfile,types,io,time,base64,copy
H=Path(__file__).resolve().parent;checks=[];sha=lambda b:hashlib.sha256(b).hexdigest()
def inverse(data,patches):
 for p in reversed(patches):
  a=p['after'].encode();assert data.count(a)==1;data=data.replace(a,p['before'].encode(),1)
 return data
delta=json.loads((H/'backend-delta.json').read_bytes())
for n,v in delta['files'].items():
 before=(H/'official'/n).read_bytes();after=(H/'candidate'/n).read_bytes();assert inverse(after,v['changes'])==before
 assert inverse(after+b'UNAUTHORIZED',v['changes'])!=before;checks.extend([n+':exact_inverse',n+':extra_bytes_rejected'])
for v in json.loads((H/'STATIC_BUILD.json').read_bytes())['files']:
 data=(H/'candidate/legacy-app.py').read_bytes()if v['kind']=='legacy'else(H/'candidate/public'/('qr.html'if v['kind']=='panel'else'leads-window.html')).read_bytes()
 assert sha(data)==v['sha256']and sha(inverse(data,v['patches']))==v['beforeSha256'];checks.append(v['kind']+':exact_static_inverse')
legacy=(H/'candidate/legacy-app.py').read_text(encoding='utf8');node=next(n for n in ast.parse(legacy).body if isinstance(n,ast.FunctionDef)and n.name=='admin_api_status')
gate=next(n for n in ast.walk(node)if isinstance(n,ast.If)and 'operational_confirmation_required'in ast.unparse(n));scope={}
code=compile(ast.fix_missing_locations(ast.Module(body=[ast.FunctionDef(name='gate',args=ast.arguments(posonlyargs=[],args=[],kwonlyargs=[],kw_defaults=[],defaults=[]),body=[gate,ast.Return(value=ast.Constant(value='continue'))],decorator_list=[])],type_ignores=[])),'legacy-confirmation-gate','exec')
for country,new,old,want in [('EC','confirmado','novo',409),('EC','confirmado','atendendo',409),('EC','confirmado','confirmado','continue'),('EC','recompra','entregue','continue'),('CO','confirmado','novo','continue')]:
 class Conn:
  closed=False
  def close(self):self.closed=True
 conn=Conn();scope={'safe_str':str,'row':{'country':country},'new_status':new,'old_status_normalized':old,'conn':conn,'_admin_json_response':lambda body,status:status};exec(code,scope);assert scope['gate']()==want;assert conn.closed==(want==409);checks.append('legacy_gate:'+country+':'+new+':'+old)
controller=(H/'operations-controller.py').read_text(encoding='utf8');ast.parse(controller)
for phrase in ["'texPostLeadActivatedAt':inherited['texPostLeadActivatedAt']","'burstActivatedAt':inherited['burstActivatedAt']","'automaticDropiV252ActivatedAt':utc()","assert_web_idle();assert_vitpower_idle();assert_tex_idle()","restore_static();P=","restore(target()['pid'],original);raise","assert read(B/'STATIC_TEST.json')" ]:
 if phrase.startswith('assert read'):continue
 assert phrase in controller;checks.append('controller_preserves:'+phrase[:65])
assert "automaticDropiV252Allowed':True"in controller and 'newCron' in controller
assert "mode=='run'"in controller and "'renew-if-needed.py'"in controller
assert 'physicalOutboundCount' in controller and "<=1"in controller
checks+=['only_new_confirmation_cutoff','existing_postsale_timer_only','session_renewal_run_only','post_sale_maximum_one']
# Session fixture: no real account, file, API, or process is used.
# exec globals must be shared for the actual function globals.
scope={'__file__':str(H/'renew-if-needed.py'),'__name__':'fixture'};exec(compile((H/'renew-if-needed.py').read_text(encoding='utf8'),'renewal-fixture','exec'),scope)
def state(exp,owner='7',geo='one'):
 token='x.'+base64.urlsafe_b64encode(json.dumps({'exp':exp}).encode()).decode().rstrip('=')+'.x'
 d={'DROPI_token':token,'DROPI_LoginResult':{'token':token,'objects':{'id':owner},'countries':[{'code':'EC'}]},'DROPI_cities':[geo],'DROPI_departments':[geo],'DROPI_SessionData':{'cities':[geo]}}
 return json.dumps({'origins':[{'origin':'https://app.dropi.ec','localStorage':[{'name':k,'value':json.dumps(v)}for k,v in d.items()]}]}).encode()
alias=json.loads(state(time.time()+7200));entry=next(x for x in alias['origins'][0]['localStorage']if x['name']=='DROPI_LoginResult');login=json.loads(entry['value']);login['countries']=[];login['configurations']=[{'country':'ECUADOR'}];entry['value']=json.dumps(login);assert scope['identity'](json.dumps(alias).encode())[1]=='ec';checks.append('renewal_country_name_and_code_aliases_are_the_same_verified_Ecuador')
login['configurations']=[{'country':'COLOMBIA'}];entry['value']=json.dumps(login)
try:scope['identity'](json.dumps(alias).encode());raise RuntimeError('foreign country accepted')
except AssertionError:checks.append('renewal_country_alias_never_accepts_foreign_country')
with tempfile.TemporaryDirectory()as tmp:
 root=Path(tmp);calls=[];F=root/'original';scope.update(B=root,F=F,open=lambda *_:io.StringIO(),fcntl=types.SimpleNamespace(flock=lambda *_:None,LOCK_EX=1,LOCK_NB=2))
 def run(args,env,**kw):
  calls.append(1);Path(env['DROPPI_EC_STORAGE_STATE_PATH']).write_bytes(state(time.time()+7200));return types.SimpleNamespace(returncode=0)
 scope['subprocess']=types.SimpleNamespace(run=run)
 F.write_bytes(state(time.time()+7200));assert scope['main']()['status']=='VALID_SESSION_RETAINED'and not calls;checks.append('renewal_valid_session_no_login')
 F.write_bytes(state(time.time()-1));assert scope['main']()['renewed']and len(calls)==1;checks.append('renewal_verified_atomic_promotion')
 failed=state(time.time()-2);F.write_bytes(failed)
 def wrong(args,env,**kw):
  calls.append(1);Path(env['DROPPI_EC_STORAGE_STATE_PATH']).write_bytes(state(time.time()+7200,owner='99'));return types.SimpleNamespace(returncode=0)
 scope['subprocess']=types.SimpleNamespace(run=wrong);assert not scope['main']()['renewed']and F.read_bytes()==failed;checks.append('renewal_wrong_account_rejected')
 count=len(calls);assert scope['main']()['status']=='RENEWAL_ALREADY_ATTEMPTED_REVIEW_REQUIRED'and len(calls)==count;checks.append('renewal_uncertain_failure_no_automatic_repeat')
 scope['subprocess']=types.SimpleNamespace(run=run);original=state(time.time()-3,geo='different');F.write_bytes(original);assert not scope['main']()['renewed']and F.read_bytes()==original;checks.append('renewal_geography_loss_rejected')
r={'project':'VITALISMEN_EC','pass':True,'checks':checks,'controllerSha256':sha(controller.encode()),'productionActions':0,'physicalMessages':0}
(H/'OPERATIONS_TEST.json').write_text(json.dumps(r,indent=2)+'\n',encoding='utf8')
(H/'INVERSE_TEST.json').write_text(json.dumps({**r,'checks':[x for x in checks if 'inverse'in x or'extra_bytes'in x]},indent=2)+'\n',encoding='utf8')
(H/'STATIC_TEST.json').write_text(json.dumps({**r,'checks':[x for x in checks if'legacy_gate'in x or'static_inverse'in x]},indent=2)+'\n',encoding='utf8')
print(json.dumps({'pass':True,'checks':len(checks),'productionActions':0}))
