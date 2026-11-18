from pathlib import Path
import subprocess,json,hashlib,base64,concurrent.futures
H=Path(__file__).resolve().parent;E=Path((H/'evidence-path.txt').read_text());E.mkdir(parents=True,exist_ok=True);(H/'evidence-path.txt').write_text(str(E),encoding='utf-8')
back=['ssh','-o','HostName=72.60.137.77','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','maxlien-vps-ec']
def capture(label,host,alias,paths):
 remote='''import hashlib,json,os,pathlib,subprocess,sys
def records():
 return [{'path':n,'bytes':pathlib.Path(n).stat().st_size,'uid':pathlib.Path(n).stat().st_uid,'gid':pathlib.Path(n).stat().st_gid,'mode':pathlib.Path(n).stat().st_mode&511,'sha256':hashlib.sha256(pathlib.Path(n).read_bytes()).hexdigest()}for n in PATHS]
before=records();r=subprocess.run(['tar','--acls','--xattrs','--numeric-owner','-czf','-','-C','/',*[n.lstrip('/')for n in PATHS]],stdout=sys.stdout.buffer,stderr=subprocess.PIPE);assert r.returncode==0 and records()==before
print(json.dumps({'project':'VITALISMEN_EC','files':before,'sourceUnchanged':True}),file=sys.stderr)
'''
 code='PATHS='+repr(paths)+'\n'+remote;command="python3 -I -B -S -c 'import base64;exec(base64.b64decode(\""+base64.b64encode(code.encode()).decode()+"\"))'"
 target=E/(label+'.vbe');assert not target.exists()
 with target.open('xb')as out:
  src=subprocess.Popen(['ssh','-o','HostName='+host,'-o','BatchMode=yes','-o','StrictHostKeyChecking=yes',alias,command],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
  enc=subprocess.Popen([*back,'env NODE_OPTIONS= node /opt/vitalismen-automacao/backup-tools/current/seal_stream.mjs site'],stdin=src.stdout,stdout=out,stderr=subprocess.PIPE);src.stdout.close();src.stdout=None
  with concurrent.futures.ThreadPoolExecutor(max_workers=1) as workers:
   reading=workers.submit(src.communicate,timeout=90)
   try:
    crypt=enc.communicate(timeout=90)[1];proof=reading.result(timeout=95)[1]
   except BaseException:
    enc.kill();src.kill();enc.communicate();raise
  assert enc.returncode==0 and src.returncode==0
 value={**json.loads(proof),'envelope':json.loads(crypt),'ciphertextSha256':hashlib.sha256(target.read_bytes()).hexdigest()}
 (E/(label+'_CAPTURE.json')).write_text(json.dumps(value,indent=2)+'\n',encoding='utf-8');print(label,len(value['files']))
