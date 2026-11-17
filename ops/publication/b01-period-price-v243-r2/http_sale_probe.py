from pathlib import Path
import subprocess,json,base64
H=Path(__file__).resolve().parent
FILES={n:base64.b64encode((H/n).read_bytes()).decode()for n in ['http-sale.mjs','sale-model-shim.cjs']}
remote=r'''
import pathlib,json,subprocess,tempfile,os,hashlib,shutil,datetime
CURRENT=pathlib.Path('/opt/vitalismen-automacao/current').resolve();S=pathlib.Path('/var/lib/vitalismen-deploy/ec-b01-period-price-v243-r2');a=json.loads((S/'approval.json').read_bytes())
R=pathlib.Path(a['release']);assert str(CURRENT)==a['parentRelease']and a['commit']=='d35d58c5a74fb4314d7c3548e614501453ab3ed6'
B=pathlib.Path('/opt/vitalismen-automacao/backups/b01-period-price-v243-r2-20261117');assert len(a['hashes'])==10
before=next(x for x in json.loads(subprocess.check_output(['pm2','jlist'],text=True))if x['name']=='vitalismen-automation');base={k:str(v)for k,v in before['pm2_env'].items()if isinstance(v,(str,int,float))and not isinstance(v,bool)}
D=pathlib.Path(tempfile.mkdtemp(prefix='vitalismen-sale-simulation-'))
for n in ['releases','backups','db','web-store','admin']:(D/n).mkdir()
os.symlink(R,D/'current')
for n,b in FILES.items():(D/n).write_bytes(__import__('base64').b64decode(b))
(D/'clock').write_text('0')
active={'state':'ACTIVE','commit':a['commit'],'approvalSha256':hashlib.sha256((S/'approval.json').read_bytes()).hexdigest(),'runtimeAllowed':True,'postSaleApproved':True,'freeflowAudience':'EC_FORWARD_ONLY','measurementAllowed':False,'b01Allowed':True,'b01ActivatedAt':'2026-11-15T00:00:00.000Z','privateStartupProbeOnly':True,'webAllowed':True,'webAudience':'PRIVATE_QA','priorityAllowed':True,'priorityAudience':'EC_FORWARD_ONLY','priorityQaProofSha256':a['inheritedPriorityProofSha256'],'burstAllowed':True,'burstAudience':'QA_ONLY','burstActivatedAt':'2026-11-16T00:00:00.000Z'}
(D/'activation.json').write_text(json.dumps(active,indent=2)+'\n');(D/'activation.json').chmod(0o400)
runner=r"""
import pathlib,subprocess,os,time,json,sqlite3,resource
resource.setrlimit(resource.RLIMIT_CORE,(0,0))
D=pathlib.Path(TEMP)
assert int(next(l.split()[1]for l in pathlib.Path('/proc/meminfo').read_text().splitlines()if l.startswith('MemAvailable:')))>2*1024*1024,'RAM_RESERVE_REQUIRED'
assert os.readlink('/proc/self/ns/net')!=os.readlink('/proc/1/ns/net')
subprocess.run(['ip','link','set','lo','up'],check=True,capture_output=True)
subprocess.run(['mount','-t','tmpfs','-o','size=384M,mode=0700','tmpfs',str(D/'db')],check=True,capture_output=True)
mongo=subprocess.Popen(['mongod','--dbpath',str(D/'db'),'--bind_ip','127.0.0.1','--port','27119','--quiet','--logpath',str(D/'mongo.log'),'--wiredTigerCacheSizeGB','0.25','--setParameter','diagnosticDataCollectionEnabled=false'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
 time.sleep(2)
 p=subprocess.run(['node',str(D/'http-sale.mjs')],cwd=RELEASE,env=os.environ,capture_output=True,text=True,timeout=1200)
 (D/'test.private.log').write_text(p.stdout+'\n'+p.stderr)
 result=json.loads((D/'result.json').read_text())if(D/'result.json').exists()else{'pass':False,'error':'NO_RESULT','tail':(p.stdout+'\n'+p.stderr)[-5000:]}
 result.update(processExit=p.returncode)
 print(json.dumps(result))
finally:
 mongo.terminate()
 try:mongo.wait(timeout=8)
 except subprocess.TimeoutExpired:mongo.kill();mongo.wait(timeout=5)
"""
# Metadata-only SQLite schema, no customer rows or live DB copy.
import sqlite3
with sqlite3.connect('file:/opt/maxlien-mvp/leads_ec.sqlite3?mode=ro',uri=True)as c:
 schema=[row[0]for row in c.execute("SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND type='table' AND name IN ('leads','lead_history','lead_status_history')")]
with sqlite3.connect(str(D/'admin/leads_ec.sqlite3'))as c:
 for sql in schema:c.execute(sql)
 assert c.execute('select count(*) from leads').fetchone()[0]==0
(D/'runner.py').write_text('TEMP='+repr(str(D))+'\nRELEASE='+repr(str(R))+'\n'+runner)
shell='set -eu\nmount --make-rprivate /\n'
for n in ['releases','backups']:shell+='mount --bind /opt/vitalismen-automacao/'+n+' '+str(D/n)+'\nmount -o remount,bind,ro '+str(D/n)+'\n'
shell+='mount --rbind '+str(D)+' /opt/vitalismen-automacao\n'
for folder in ['/root/wa_wpp','/root/.vitalismen-secrets','/var/lib/vitalismen-deploy','/usr/local/lib/vitalismen-deploy']:
 shell+='if test -d '+folder+'; then mount --bind '+folder+' '+folder+'; mount -o remount,bind,ro '+folder+'; fi\n'
shell+='mount --bind '+str(D/'admin')+' /opt/maxlien-mvp\nmount --bind '+str(D/'web-store')+' /var/lib/vitalismen-web-chat-v220-r2\nmount --bind '+str(D/'activation.json')+' '+str(S/'activation.json')+'\ncd '+str(R)+'\nexec python3 -I -B -S '+str(D/'runner.py')+'\n'
env={**base,**a['profiles']['botLive'],'NODE_OPTIONS':'','npm_config_node_options':'','pm_exec_path':'/opt/vitalismen-automacao/current/src/index.js','SIM_SHIM':str(D/'sale-model-shim.cjs'),'SIM_CLOCK':str(D/'clock'),'SIM_MODEL_TRACE':str(D/'model-trace.jsonl'),'SIM_APP_LOG':str(D/'app.log'),'SIM_INGRESS':str(D/'ingress.json'),'SIM_RESULT':str(D/'result.json')}
try:
 p=subprocess.run(['unshare','--mount','--net','--fork','bash','-c',shell],env=env,capture_output=True,text=True,timeout=1230)
 raw=p.stdout+'\n'+p.stderr
 for k,v in base.items():
  if any(x in k for x in ['KEY','TOKEN','SECRET','PASSWORD'])and len(v)>8:raw=raw.replace(v,'[REDACTED]')
 try:result=json.loads(p.stdout)
 except ValueError:result={'pass':False,'error':'LAUNCHER_FAILED','tail':raw[-5000:]}
 after=next(x for x in json.loads(subprocess.check_output(['pm2','jlist'],text=True))if x['name']=='vitalismen-automation')
 result.update(scopedHistoryMongoVerified='real_mongo_history_accepts_proven_receipts_and_rejects_foreign_or_unproven_rows'in result.get('checks',[]),providerIdsGloballyUniqueVerified='provider_message_ids_globally_unique_across_qa_and_ec'in result.get('checks',[]),periodAudioVerified='one_correct_ecuador_period_audio'in result.get('checks',[]),finalPriceTableVerified='uninterrupted_b01_ends_in_readable_official_price_table'in result.get('checks',[]),qaNaturalEntryVerified='qa_named_entry_persisted_and_accepted'in result.get('checks',[]),qaGreetingVerified='qa_named_entry_greeting_5_to_30_seconds'in result.get('checks',[]),qaMixedQuestionsVerified='qa_price_and_ingredients_one_ordered_reply'in result.get('checks',[]),candidateCommit=a['commit'],unpunctuatedPriceVerified='unpunctuated_prices_answered_without_repeat_quantity'in result.get('checks',[]),confirmedOrderVerified='exactly_one_confirmed_order'in result.get('checks',[]),thankYouVerified='thank_you_only_after_confirmed_order'in result.get('checks',[]),at=datetime.datetime.now(datetime.timezone.utc).isoformat(),productionUnchanged=before['pid']==after['pid']and before['pm2_env']['restart_time']==after['pm2_env']['restart_time']and pathlib.Path('/opt/vitalismen-automacao/current').resolve()==CURRENT,baselinePid=before['pid'],candidateIntegrationBeforeFullSuite=True,launcherExit=p.returncode)
 trace=(D/'model-trace.jsonl').read_text()if(D/'model-trace.jsonl').exists()else''
 fd=os.open(B/'HTTP_SALE_TEST.json',os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o400)
 with os.fdopen(fd,'w')as f:json.dump(result,f,ensure_ascii=False,indent=2);f.write(chr(10));f.flush();os.fsync(f.fileno())
 print(json.dumps({'result':result,'modelTrace':trace}))
finally:
 assert D.parent==pathlib.Path('/tmp')and D.name.startswith('vitalismen-sale-simulation-');shutil.rmtree(D)
'''
p=subprocess.run(['ssh','-o','HostName=72.60.137.77','-o','BatchMode=yes','maxlien-vps-ec','python3 -I -B -S -'],input='FILES='+repr(FILES)+'\n'+remote,capture_output=True,text=True,encoding='utf-8',timeout=1250)
assert p.returncode==0,p.stderr[-1200:]
v=json.loads(p.stdout);(H/'HTTP_SALE_TEST.json').write_text(json.dumps(v['result'],ensure_ascii=False,indent=2)+'\n',encoding='utf-8');(H/'HTTP_SALE_MODEL_TRACE.jsonl').write_text(v['modelTrace'],encoding='utf-8')
r=v['result'];print(json.dumps({k:r.get(k)for k in ['pass','error','checks','greetingRealElapsedMs','productionUnchanged','baselinePid','launcherExit']},ensure_ascii=False));assert r['pass']and r['productionUnchanged']
