from pathlib import Path
import subprocess,json
H=Path(__file__).resolve().parent
remote=r"""
import pathlib,json,subprocess,hashlib,datetime,os,re
B=pathlib.Path('/opt/vitalismen-automacao/backups/vitpower-named-entry-v246-r5-20261118');a=json.loads((B/'PREPARED.json').read_bytes());base=json.loads((B/'BASELINE.json').read_bytes());target=B/'QUALIFICATION.json'
if target.exists():print(json.dumps({'complete':True,'result':json.loads(target.read_bytes())}));raise SystemExit()
progress=json.loads((B/'QUALIFICATION_PROGRESS.json').read_bytes());names=['senior_guard','product_guard','focused_tests','complete_senior']
if len(progress)!=4 or pathlib.Path('/proc/3958049').exists():print(json.dumps({'complete':False,'progress':progress,'driverAlive':pathlib.Path('/proc/3958049').exists()}));raise SystemExit()
assert [r['name']for r in progress]==names
for r in progress:assert r['pass'] is True and r['exitCode']==0 and r['timedOut'] is False
logs={}
for r in progress:
 f=B/(r['name']+'.private.log');assert f.is_file() and not f.is_symlink();raw=f.read_bytes();text=raw.decode();assert r['tapSummary']==re.findall(r'# (?:tests|pass|fail) \d+',text)
 if r['name']in ['focused_tests','complete_senior']:assert '# fail 0'in text and not re.search(r'^not ok ',text,re.M)
 logs[f.name]=hashlib.sha256(raw).hexdigest()
row=next(x for x in json.loads(subprocess.check_output(['pm2','jlist']))if x['name']=='vitalismen-automation')
unchanged=row['pid']==base['pid'] and row['pm2_env']['restart_time']==base['restarts'] and pathlib.Path('/opt/vitalismen-automacao/current').resolve()==pathlib.Path(a['parentRelease'])
assert unchanged,'PRODUCTION_CHANGED_DURING_QUALIFICATION'
r={'project':'VITALISMEN_EC','status':'PASS','candidateCommit':a['commit'],'results':progress,'productionUnchanged':unchanged,'networkIsolated':True,'messagesSent':0,'databaseProductionWrites':0,'transportRecovery':{'reason':'SSH reset while full suite continued; recover durable per-command exit records, not inferred test success','actualDriverPid':3958049,'actualSeniorProcessGroup':3961866,'driverExited':True,'rawLogSha256':logs,'at':datetime.datetime.now(datetime.timezone.utc).isoformat()}}
fd=os.open(target,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o400)
with os.fdopen(fd,'w')as out:json.dump(r,out,indent=2);out.write('\n');out.flush();os.fsync(out.fileno())
print(json.dumps({'complete':True,'result':r}))
"""
p=subprocess.run(['ssh','-o','HostName=72.60.137.77','-o','BatchMode=yes','maxlien-vps-ec','python3 -I -B -S -'],input=remote,capture_output=True,text=True,encoding='utf-8',timeout=25);assert p.returncode==0,p.stderr[-1200:]
x=json.loads(p.stdout)
if x['complete']:(H/'QUALIFICATION.json').write_text(json.dumps(x['result'],indent=2)+'\n',encoding='utf-8')
print(json.dumps(x))
