from pathlib import Path
import subprocess,json
H=Path(__file__).resolve().parent
remote=r'''
import pathlib,subprocess,json,os,signal,time,re,tempfile,shutil
B=pathlib.Path('/opt/vitalismen-automacao/backups/qa-b01-cycle-v244-r8-20261117');S=pathlib.Path('/var/lib/vitalismen-deploy/ec-qa-b01-cycle-v244-r8');a=json.loads((S/'approval.json').read_text());R=pathlib.Path(a['release']);P=pathlib.Path(a['parentRelease'])
assert pathlib.Path('/opt/vitalismen-automacao/current').resolve()==P
before=next(x for x in json.loads(subprocess.check_output(['pm2','jlist'],text=True))if x['name']=='vitalismen-automation');base={k:str(v)for k,v in before['pm2_env'].items()if isinstance(v,(str,int,float))and not isinstance(v,bool)}
private=[v for k,v in base.items()if any(x in k for x in ['KEY','TOKEN','SECRET','PASSWORD'])and len(v)>8]
def scrub(t):
 for value in sorted(private,key=len,reverse=True):t=t.replace(value,'[REDACTED]')
 return t
E={**base,**a['profiles']['fixture'],'OPENAI_API_KEY':'OFFLINE_NO_NETWORK','npm_config_node_options':'','NPM_CONFIG_NODE_OPTIONS':''}
results=[]
D=pathlib.Path(tempfile.mkdtemp(prefix='vitalismen-v241r2-qualification-'));(D/'releases').mkdir();(D/'backups').mkdir();os.symlink(P,D/'current')
shell='set -eu\nmount --make-rprivate /\n'
for n in ['releases','backups']:shell+='mount --bind /opt/vitalismen-automacao/'+n+' '+str(D/n)+'\nmount -o remount,bind,ro '+str(D/n)+'\n'
shell+='mount --rbind '+str(D)+' /opt/vitalismen-automacao\nip link set lo up\nexec "$@"\n'
commands=[('senior_guard',['node','scripts/senior-guard.mjs'],120),('product_guard',['node','scripts/audit-ec-product-micro-layer.mjs'],120),('focused_tests',['node','--test','tests/principal-sdr-qa-ingress-v212.test.mjs','tests/qa-natural-entry-v241.test.mjs','tests/mixed-questions-v241.test.mjs','tests/tex-ultra-web-v240.test.mjs','tests/tex-ultra-web-http-v240.test.mjs','tests/tex-ultra-entry-block-v242.test.mjs','tests/tex-ultra-linked-entry-v242.test.mjs','tests/tex-measurement-v243.test.mjs','tests/tex-measurement-purchase-routing-v243.test.mjs','tests/tex-measurement-runtime-readiness-v243.test.mjs','tests/b01-qa-schema-v244.test.mjs','tests/b01-qa-cycle-v244.test.mjs','tests/b01-period-price-v242.test.mjs','tests/vit-power-b01-v216.test.mjs','tests/vit-power-b01-auth-v216.test.mjs','tests/freeflow-priority-v219.test.mjs','tests/vitpower-scoped-question-history-v243.test.mjs','tests/price-request-v239.test.mjs','tests/principal-sdr-runtime.test.mjs','tests/vitpower-burst-v228.test.mjs','tests/burst-order-persistence-v230.test.mjs'],1800),('complete_senior',['node','/usr/lib/node_modules/npm/bin/npm-cli.js','run','senior:check'],4800)]
for name,args,timeout in commands:
 assert pathlib.Path('/opt/vitalismen-automacao/current').resolve()==P,'PARENT_CHANGED_ABORT_BEFORE_NEXT_TEST'
 start=time.monotonic();p=subprocess.Popen(['unshare','--mount','--net','--fork','nice','-n','10','ionice','-c','3','bash','-c',shell,'--',*args],cwd=R,env=E,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,start_new_session=True)
 timed=False
 try:out,err=p.communicate(timeout=timeout)
 except subprocess.TimeoutExpired:timed=True;os.killpg(p.pid,signal.SIGKILL);out,err=p.communicate()
 text=scrub(out+'\n'+err);(B/(name+'.private.log')).write_text(text)
 result={'name':name,'pass':p.returncode==0 and not timed,'seconds':round(time.monotonic()-start,1),'exitCode':p.returncode,'timedOut':timed,'tapSummary':re.findall(r'# (?:tests|pass|fail) \d+',out)}
 if not result['pass']:result['tail']=text[-2400:]
 results.append(result);(B/'QUALIFICATION_PROGRESS.json').write_text(json.dumps(results,indent=2)+'\n');print(json.dumps({'progress':result}),flush=True)
 if not result['pass']:break
after=next(x for x in json.loads(subprocess.check_output(['pm2','jlist'],text=True))if x['name']=='vitalismen-automation');unchanged=before['pid']==after['pid'] and before['pm2_env']['restart_time']==after['pm2_env']['restart_time'] and pathlib.Path('/opt/vitalismen-automacao/current').resolve()==P
assert D.parent==pathlib.Path('/tmp')and D.name.startswith('vitalismen-v241r2-qualification-');shutil.rmtree(D)
result={'project':'VITALISMEN_EC','status':'PASS'if len(results)==4 and all(x['pass']for x in results)and unchanged else'FAIL','candidateCommit':a['commit'],'results':results,'productionUnchanged':unchanged,'networkIsolated':True,'messagesSent':0,'databaseProductionWrites':0};(B/'QUALIFICATION.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'final':result}),flush=True)
'''
p=subprocess.Popen(['ssh','-o','HostName=72.60.137.77','-o','BatchMode=yes','maxlien-vps-ec','python3 -I -B -S -'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,encoding='utf-8');p.stdin.write(remote);p.stdin.close();final=None
for line in p.stdout:
 if not line.strip():continue
 obj=json.loads(line);print(json.dumps(obj),flush=True)
 if 'final'in obj:final=obj['final']
err=p.stderr.read();code=p.wait();assert code==0,err[-800:];assert final
(H/'QUALIFICATION.json').write_text(json.dumps(final,indent=2)+'\n',encoding='utf-8');assert final['status']=='PASS'
