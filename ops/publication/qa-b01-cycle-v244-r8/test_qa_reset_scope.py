from pathlib import Path
import subprocess,json,base64
H=Path(__file__).resolve().parent
files={n:base64.b64encode((H/n).read_bytes()).decode()for n in ['qa-reset-mongo-scope.js','qa-reset-seed.js','qa-reset-scope-runner.py']}
remote=r'''
import pathlib,tempfile,subprocess,json,base64,shutil
D=pathlib.Path(tempfile.mkdtemp(prefix='vitalismen-reset-scope-'));(D/'db').mkdir()
for n,b in FILES.items():(D/n).write_bytes(base64.b64decode(b))
try:
 p=subprocess.run(['unshare','--mount','--net','--fork','python3','-I','-B','-S',str(D/'qa-reset-scope-runner.py')],capture_output=True,text=True,timeout=300)
 assert p.returncode==0,p.stderr[-2200:]
 r=json.loads(p.stdout);B=pathlib.Path('/opt/vitalismen-automacao/backups/qa-b01-cycle-v244-r8-20261117')
 (B/'QA_RESET_SIMULATION.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r))
finally:shutil.rmtree(D)
'''
p=subprocess.run(['ssh','-o','HostName=72.60.137.77','-o','BatchMode=yes','maxlien-vps-ec','python3 -I -B -S -'],input='FILES='+repr(files)+'\n'+remote,capture_output=True,text=True,encoding='utf-8',timeout=320)
assert p.returncode==0,p.stderr[-2600:]
r=json.loads(p.stdout);(H/'QA_RESET_SIMULATION.json').write_text(json.dumps(r,indent=2)+'\n',encoding='utf-8');print(json.dumps(r))
