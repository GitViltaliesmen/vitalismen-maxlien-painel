from pathlib import Path
import ast,subprocess,json
H=Path(__file__).resolve().parent
module=ast.parse((H/'qualify_additional.py').read_text(encoding='utf-8'));remote=next(x.value.value for x in module.body if isinstance(x,ast.Assign)and any(isinstance(t,ast.Name)and t.id=='remote'for t in x.targets))
remote=remote[:remote.index('results=[]')]+"results=[]\n"+remote[remote.index('# Simulate only startup configuration'):remote.index("legacy='set -eu")]+"\nprint(json.dumps({'pass':all(x['pass']for x in results),'results':results}))\n"
p=subprocess.run(['ssh','-o','HostName=72.60.137.77','-o','BatchMode=yes','maxlien-vps-ec','python3 -I -B -S -'],input=remote,capture_output=True,text=True,encoding='utf-8',timeout=150)
assert p.returncode==0,p.stderr[-2200:]
r=json.loads(p.stdout);(H/'STARTUP_SMOKE.json').write_text(json.dumps(r,indent=2)+'\n',encoding='utf-8');print(json.dumps(r));assert r['pass']
