import pathlib,subprocess,json,os,signal,time,re,tempfile,shutil
B=pathlib.Path('/opt/vitalismen-automacao/backups/tex-postlead-invite-v251-20261119-r2/qualification-r2-corrected');S=pathlib.Path('/var/lib/vitalismen-deploy/ec-tex-postlead-v251-r2');a=json.loads((S/'approval.json').read_bytes());R=pathlib.Path(a['release']);P=pathlib.Path(a['parentRelease'])
assert a['commit']=='76dc26f89393d694db9d8b3d95447fc7144f89f6'
assert subprocess.check_output(['git','-C',str(R),'rev-parse','HEAD'],text=True).strip()==a['commit']
assert pathlib.Path('/opt/vitalismen-automacao/current').resolve()==P
before=next(x for x in json.loads(subprocess.check_output(['pm2','jlist']))if x['name']=='vitalismen-automation');base={k:str(v)for k,v in before['pm2_env'].items()if isinstance(v,(str,int,float))and not isinstance(v,bool)}
private=[v for k,v in base.items()if any(x in k for x in ['KEY','TOKEN','SECRET','PASSWORD'])and len(v)>8]
def scrub(t):
 for value in sorted(private,key=len,reverse=True):t=t.replace(value,'[REDACTED]')
 return t
E={**base,**a['profiles']['fixture'],'OPENAI_API_KEY':'OFFLINE_NO_NETWORK','npm_config_node_options':'','NPM_CONFIG_NODE_OPTIONS':''}
D=pathlib.Path(tempfile.mkdtemp(prefix='vitalismen-v251-qualification-'));(D/'releases').mkdir();(D/'backups').mkdir();os.symlink(P,D/'current')
shell='set -eu\nmount --make-rprivate /\n'
for n in ['releases','backups']:shell+='mount --bind /opt/vitalismen-automacao/'+n+' '+str(D/n)+'\nmount -o remount,bind,ro '+str(D/n)+'\n'
shell+='mount --rbind '+str(D)+' /opt/vitalismen-automacao\nip link set lo up\nexec "$@"\n'
commands=[('senior_guard',['node','scripts/senior-guard.mjs'],180),('product_guard',['node','scripts/audit-ec-product-micro-layer.mjs'],180),('focused_tests',['node','--test','tests/tex-postlead-invite-v251.test.mjs','tests/tex-entry-greeting-v249.test.mjs','tests/ec-direct-product-name-v39.test.mjs','tests/tex-ultra-entry-unread-v22.test.mjs','tests/tex-ultra-entry-block-v242.test.mjs','tests/tex-ultra-linked-entry-v242.test.mjs'],900),('complete_senior',['node','/usr/lib/node_modules/npm/bin/npm-cli.js','run','senior:check'],5400)]
results=[]
try:
 for name,args,timeout in commands:
  assert pathlib.Path('/opt/vitalismen-automacao/current').resolve()==P,'PARENT_CHANGED_BEFORE_TEST'
  start=time.monotonic();log=B/(name+'.private.log')
  fd=os.open(log,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
  with os.fdopen(fd,'w') as stream:
   p=subprocess.Popen(['unshare','--mount','--net','--fork','nice','-n','10','ionice','-c','3','bash','-c',shell,'--',*args],cwd=R,env=E,stdout=stream,stderr=subprocess.STDOUT,text=True,start_new_session=True)
   print(json.dumps({'phase':name,'pid':p.pid,'status':'RUNNING'}),flush=True);timed=False
   while p.poll() is None:
    if time.monotonic()-start>timeout:
     timed=True;os.killpg(p.pid,signal.SIGKILL);p.wait();break
    text=log.read_text(errors='replace');titles=re.findall(r'^# Subtest: (.+)$',text,re.M)
    progress={'phase':name,'status':'RUNNING','seconds':round(time.monotonic()-start),'okLines':len(re.findall(r'^ok \d+ - ',text,re.M)),'lastCase':titles[-1][:170]if titles else None}
    (B/'QUALIFICATION_PROGRESS.json').write_bytes(json.dumps({'results':results,'current':progress},indent=2).encode());time.sleep(10)
  text=scrub(log.read_text(errors='replace'));result={'name':name,'pass':p.returncode==0 and not timed,'seconds':round(time.monotonic()-start,1),'exitCode':p.returncode,'timedOut':timed,'tapSummary':re.findall(r'# (?:tests|pass|fail) \d+',text)}
  if not result['pass']:result['tail']=text[-3500:]
  results.append(result);print(json.dumps(result),flush=True)
  if not result['pass']:break
finally:
 assert D.parent==pathlib.Path('/tmp')and D.name.startswith('vitalismen-v251-qualification-');shutil.rmtree(D)
after=next(x for x in json.loads(subprocess.check_output(['pm2','jlist']))if x['name']=='vitalismen-automation');unchanged=before['pid']==after['pid']and before['pm2_env']['restart_time']==after['pm2_env']['restart_time']and pathlib.Path('/opt/vitalismen-automacao/current').resolve()==P
result={'project':'VITALISMEN_EC','status':'PASS'if len(results)==4 and all(x['pass']for x in results)and unchanged else'FAIL','candidateCommit':a['commit'],'results':results,'productionUnchanged':unchanged,'networkIsolated':True,'messagesSent':0,'databaseProductionWrites':0};(B/'QUALIFICATION.json').write_bytes(json.dumps(result,indent=2).encode());print(json.dumps({'final':result}),flush=True)
