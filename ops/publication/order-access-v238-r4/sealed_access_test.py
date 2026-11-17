from pathlib import Path
import subprocess,json,base64
H=Path(__file__).resolve().parent
remote=r"""
import pathlib,subprocess,os,tempfile,json,base64,shutil,hashlib
assert shutil.disk_usage('/').free >= 2*1024**3, 'DISPOSABLE_MONGO_REQUIRES_2GB_FREE_NO_PRODUCTION_ACTIONS'
B=pathlib.Path('/opt/vitalismen-automacao/backups/ec-order-access-v238-r4-20261117');a=json.loads((B/'PREPARED.json').read_text());before=json.loads(subprocess.check_output(['pm2','jlist']))[0]['pid'];P=pathlib.Path('/opt/vitalismen-automacao/current').resolve();D=pathlib.Path(tempfile.mkdtemp(prefix='vitalismen-access-v238-'))
for n in ['db','store','root']:(D/n).mkdir()
for n in ['releases','backups']:(D/'root'/n).mkdir()
os.symlink(a['release'],D/'root/current')
state=pathlib.Path('/var/lib/vitalismen-deploy/ec-order-access-v238-r4');active=json.loads(pathlib.Path('/var/lib/vitalismen-deploy/ec-journey-measurement-v237-r2/activation.json').read_text());active.update(state='ACTIVE',commit=a['commit'],approvalSha256=hashlib.sha256((state/'approval.json').read_bytes()).hexdigest(),runtimeAllowed=True,postSaleApproved=True)
(D/'activation.json').write_text(json.dumps(active,indent=2)+'\n');(D/'activation.json').chmod(0o400)
approval=json.loads((state/'approval.json').read_text());base={k:str(v)for k,v in json.loads(subprocess.check_output(['pm2','jlist']))[0]['pm2_env'].items()if isinstance(v,(str,int,float))and not isinstance(v,bool)}
base.update(approval['profiles']['botLive'])

(D/'probe.mjs').write_bytes(base64.b64decode(BODY))
mounts='mount --make-rprivate /\n'
for n in ['releases','backups']:mounts+='mount --bind /opt/vitalismen-automacao/'+n+' '+str(D/'root'/n)+'\nmount -o remount,bind,ro '+str(D/'root'/n)+'\n'
mounts+='mount --rbind '+str(D/'root')+' /opt/vitalismen-automacao\nmount --bind '+str(D/'activation.json')+' '+str(state/'activation.json')+'\n'
shell=mounts+'set -eu\nulimit -c 0\nmount --make-rprivate /\nip link set lo up\nmount --bind '+str(D/'store')+' /var/lib/vitalismen-web-chat-v220-r2\nmongod --dbpath '+str(D/'db')+' --port 27138 --bind_ip 127.0.0.1 --nounixsocket --wiredTigerCacheSizeGB 0.25 --logpath '+str(D/'mongo.log')+' &\naccessMongo=$!\ntrap \'kill "$accessMongo" 2>/dev/null || true; wait "$accessMongo" 2>/dev/null || true\' EXIT\nnode '+str(D/'probe.mjs')+'\n'
env={**base,'PATH':'/usr/bin:/bin','HOME':'/root','NODE_OPTIONS':'','JWT_SECRET':'ISOLATED_ACCESS_V238_ONLY_NOT_A_REAL_SECRET','CANDIDATE_RELEASE':a['release'],'CANDIDATE_COMMIT':a['commit'],'ONLINE_ADMIN_PANEL_SYNC_ENABLED':'false','META_ENABLED':'false'}
try:
 r=subprocess.run(['unshare','--mount','--net','--fork','bash','-c',shell],cwd=a['release'],env=env,capture_output=True,text=True,timeout=100)
 (B/'SEALED_ACCESS_TEST.private.log').write_text(r.stdout+'\n'+r.stderr)
 assert r.returncode==0,r.stderr[-1600:]
 lines=[json.loads(l)for l in r.stdout.splitlines()if l.startswith('{')and '"checks"'in l];assert len(lines)==1;out=lines[0]
 assert json.loads(subprocess.check_output(['pm2','jlist']))[0]['pid']==before and pathlib.Path('/opt/vitalismen-automacao/current').resolve()==P
 out['productionUnchanged']=True;(B/'SEALED_ACCESS_TEST.json').write_text(json.dumps(out,indent=2));print(json.dumps(out))
finally:
 assert D.resolve().parent==pathlib.Path('/tmp')and D.name.startswith('vitalismen-access-v238-');shutil.rmtree(D)
"""
r=subprocess.run(['ssh','-o','HostName=72.60.137.77','-o','BatchMode=yes','maxlien-vps-ec','python3 -I -B -S -'],input='BODY='+repr(base64.b64encode((H/'access-sealed-probe.mjs').read_bytes()).decode())+'\n'+remote,capture_output=True,text=True,encoding='utf-8',timeout=120)
assert r.returncode==0,r.stderr[-2000:];out=json.loads(r.stdout);(H/'SEALED_ACCESS_TEST.json').write_text(json.dumps(out,indent=2));print(json.dumps(out))
