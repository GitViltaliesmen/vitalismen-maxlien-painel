from pathlib import Path
import subprocess,json,base64
H=Path(__file__).resolve().parent
remote=r'''
import tempfile,pathlib,subprocess,os,shutil,json,base64
B=pathlib.Path('/opt/vitalismen-automacao/backups/vitpower-named-entry-v246-r5-20261118');a=json.loads((B/'PREPARED.json').read_text());R=a['release'];D=pathlib.Path(tempfile.mkdtemp(prefix='vitalismen-index-proof-'));(D/'db').mkdir();(D/'probe.mjs').write_bytes(base64.b64decode(DATA))
runner="""import subprocess,time,pathlib,json,os
D=pathlib.Path(TEMP)
assert os.readlink('/proc/self/ns/net')!=os.readlink('/proc/1/ns/net')
subprocess.run(['ip','link','set','lo','up'],check=True)
subprocess.run(['mount','--make-rprivate','/'],check=True)
subprocess.run(['mount','-t','tmpfs','-o','size=384M,mode=0700','tmpfs',str(D/'db')],check=True)
p=subprocess.Popen(['mongod','--dbpath',str(D/'db'),'--port','27129','--bind_ip','127.0.0.1','--logpath',str(D/'mongo.log'),'--wiredTigerCacheSizeGB','0.25','--setParameter','diagnosticDataCollectionEnabled=false'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
 time.sleep(2)
 q=subprocess.run(['node',str(D/'probe.mjs')],capture_output=True,text=True,timeout=60);assert q.returncode==0,(q.stdout+q.stderr)[-1800:];print(q.stdout)
finally:
 p.terminate();p.wait(timeout=10)
"""
(D/'runner.py').write_text('TEMP='+repr(str(D))+'\n'+runner)
try:
 env={**os.environ,'NODE_OPTIONS':'','QA_RELEASE':R,'QA_INDEXES':INDEXES}
 q=subprocess.run(['unshare','--mount','--net','--fork','python3','-I','-B','-S',str(D/'runner.py')],capture_output=True,text=True,env=env,timeout=80);assert q.returncode==0,q.stderr[-2200:]
 result=json.loads(q.stdout);(B/'NATIVE_INDEX_PROOF.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
finally:shutil.rmtree(D)
'''
q=subprocess.run(['ssh','-o','HostName=72.60.137.77','-o','BatchMode=yes','maxlien-vps-ec','python3 -I -B -S -'],input='DATA='+repr(base64.b64encode((H/'index-proof.mjs').read_bytes()).decode())+'\nINDEXES='+repr((H/'PRODUCTION_DEDUPE_INDEXES.json').read_text())+'\n'+remote,capture_output=True,text=True,encoding='utf-8',timeout=90)
assert q.returncode==0,q.stderr[-2400:]
r=json.loads(q.stdout);(H/'NATIVE_INDEX_PROOF.json').write_text(json.dumps(r,indent=2)+'\n',encoding='utf-8');print(json.dumps(r))
