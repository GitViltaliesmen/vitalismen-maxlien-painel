from pathlib import Path
import subprocess,json
H=Path(__file__).resolve().parent
remote=r'''
import pathlib,subprocess,json,hashlib,urllib.request,time,datetime
B=pathlib.Path('/opt/vitalismen-automacao/backups/tex-entry-greeting-v249-r6-20261118');S=pathlib.Path('/var/lib/vitalismen-deploy/ec-tex-entry-greeting-v249-r6');C=pathlib.Path('/opt/vitalismen-automacao/current')
read=lambda p:json.loads(pathlib.Path(p).read_bytes());sha=lambda p:hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
a=read(S/'approval.json');activation=read(B/'ACTIVATION.json');R=pathlib.Path(a['release']);assert C.resolve()==R
assert activation['commit']==a['commit'] and activation['restartDelta']==1
active=read(S/'activation.json');assert active['state']=='ACTIVE'and active['runtimeAllowed'] is True and active['commit']==a['commit']and active['approvalSha256']==sha(S/'approval.json')
before=read('/var/lib/vitalismen-deploy/ec-b01-named-entry-v246-r5/activation.json')
for k,v in before.items():
 if k not in ['commit','approvalSha256','activatedAt']:assert active[k]==v,'INHERITED_POLICY_CHANGED:'+k
assert sha(R/'.env')==a['baseEnvSha256'] and sha(R/'.release-source.json')==a['sourceMetadataSha256']
for n,d in a['hashes'].items():assert sha(R/n)==d,'LIVE_SOURCE_DRIFT:'+n
for n,key in [('ec-tex-entry-greeting-profile-v249-r6.mjs','helperSha256'),('ec-tex-entry-greeting-sealed-v249-r6.mjs','engineSha256')]:assert sha('/usr/local/lib/vitalismen-deploy/'+n)==a[key]
observations=[]
for index in range(4):
 row=next(x for x in json.loads(subprocess.check_output(['pm2','jlist']))if x['name']=='vitalismen-automation');e=row['pm2_env']
 assert row['pid']==activation['pidAfter'] and e['status']=='online'
 assert pathlib.Path('/proc/'+str(row['pid'])+'/cwd').resolve()==R
 assert pathlib.Path(e['pm_cwd']).resolve()==R and pathlib.Path(e['pm_exec_path']).resolve()==R/'src/index.js'
 for k,v in a['profiles']['botLive'].items():assert e.get(k)==v,'LIVE_PROFILE_CHANGED:'+k
 for k in ['TEX_ULTRA_FUNNEL_ENABLED','TEX_ULTRA_INITIAL_LAYER_ENABLED']:assert str(e.get(k,''))=='true','TEX_FLAG_NOT_ACTIVE:'+k
 with urllib.request.urlopen('http://127.0.0.1:3001/api/health/',timeout=6)as f:h=json.load(f)
 assert h.get('status')=='online' and h.get('zapi',{}).get('connected') is True and h.get('zapi',{}).get('outboundBlocked') is False
 observations.append({'pid':row['pid'],'restartCount':e['restart_time'],'health':h['status'],'zapiConnected':True,'queue':h.get('bot_inbound_queue',{})})
 if index<3:time.sleep(10)
assert len({x['restartCount']for x in observations})==1
timer=subprocess.check_output(['systemctl','is-active','vitalismen-postsale-full-v203.timer'],text=True).strip();assert timer=='active'
command=subprocess.check_output(['systemctl','show','vitalismen-postsale-full-v203.service','-p','ExecStart','--value'],text=True);assert str(B/'operations-controller.py')in command
public=read(B/'PUBLIC_BASELINE.json');assert sha('/var/www/vitalismen-panel-phonefix-20261108-r1/qr.html')==public['panelSha256'];assert sha('/etc/nginx/sites-enabled/ec.maxlien.shop.clean.conf')==public['nginxSha256']
result={'project':'VITALISMEN_EC','pass':True,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commit':a['commit'],'release':str(R),'pid':observations[-1]['pid'],'observations':observations,'profilesPreserved':True,'baseEnvPreserved':True,'parentPolicyPreserved':True,'texInitialFlagsActive':True,'postSaleTimerPreserved':True,'postSaleExecutorCurrent':True,'publicPanelV248R2Preserved':True,'productionMessagesSentByAudit':0,'productionDatabaseWrites':0,'physicalNewCustomerObservation':'PENDING_NATURAL_INBOUND','globalDataBackupPass':False}
p=B/'LIVE_AUDIT.json';assert not p.exists();p.write_bytes((json.dumps(result,indent=2)+'\n').encode());p.chmod(0o400);print(json.dumps(result))
'''
p=subprocess.run(['ssh','-o','HostName=72.60.137.77','-o','BatchMode=yes','maxlien-vps-ec','python3 -I -B -S -'],input=remote,capture_output=True,text=True,encoding='utf8',timeout=65)
assert p.returncode==0,p.stderr[-1800:]
x=json.loads(p.stdout);(H/'LIVE_AUDIT.json').write_bytes((json.dumps(x,indent=2)+'\n').encode());print(json.dumps(x))
