from pathlib import Path
import subprocess,json
H=Path(__file__).resolve().parent
remote=r"""
import pathlib,json
B=pathlib.Path('/opt/vitalismen-automacao/backups/vitpower-named-entry-v246-r5-20261118');ready=json.loads((B/'STAGE_OWNER_READY.json').read_bytes());pid=ready['pid']
x={'ownerAlive':pathlib.Path('/proc/'+str(pid)).exists(),'ready':ready}
for n,key in [('PUBLICATION.json','publication'),('ACTIVATION.json','activation'),('ACTIVATION_FAILURE.json','failure')]:
 if (B/n).exists():x[key]=json.loads((B/n).read_bytes())
print(json.dumps(x))
"""
p=subprocess.run(['ssh','-o','HostName=72.60.137.77','-o','BatchMode=yes','maxlien-vps-ec','python3 -I -B -S -'],input=remote,capture_output=True,text=True,encoding='utf-8',timeout=20);assert p.returncode==0,p.stderr[-900:];x=json.loads(p.stdout)
for k,n in [('publication','PUBLISH'),('activation','ACTIVATE')]:
 if k in x:(H/(n+'.json')).write_text(json.dumps(x[k],indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:(v if k in ['ownerAlive','failure'] else {'status':v.get('status'),'commit':v.get('commit'),'pidAfter':v.get('pidAfter')})for k,v in x.items()if k!='ready'}))
