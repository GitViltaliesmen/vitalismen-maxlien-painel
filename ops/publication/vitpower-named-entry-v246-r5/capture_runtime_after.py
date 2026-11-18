from pathlib import Path
import subprocess,json
H=Path(__file__).resolve().parent;E=Path((H/'evidence-path.txt').read_text())
remote=r'''
import pathlib,subprocess,json,hashlib,os,base64
B=pathlib.Path('/opt/vitalismen-automacao/backups/vitpower-named-entry-v246-r5-20261118');S=pathlib.Path('/var/lib/vitalismen-deploy/ec-b01-named-entry-v246-r5');a=json.loads((S/'approval.json').read_bytes());R=pathlib.Path('/opt/vitalismen-automacao/current').resolve();assert str(R)==a['release']
app=next(x for x in json.loads(subprocess.check_output(['pm2','jlist']))if x['name']=='vitalismen-automation');assert app['pm2_env']['status']=='online'
private=(json.dumps({'project':'VITALISMEN_EC','pm2':app['pm2_env'],'baseEnvBase64':base64.b64encode((R/'.env').read_bytes()).decode(),'baseEnvMetadata':{'uid':(R/'.env').stat().st_uid,'gid':(R/'.env').stat().st_gid,'mode':(R/'.env').stat().st_mode&511}},ensure_ascii=False,indent=2)+'\n').encode()
packet=B/'RUNTIME_CONFIG_AFTER.vbe';assert not packet.exists()
with packet.open('xb')as f:
 os.chmod(packet,0o600)
 p=subprocess.run(['node','/opt/vitalismen-automacao/backup-tools/current/seal_stream.mjs','private_config'],input=private,stdout=f,stderr=subprocess.PIPE,env={'PATH':'/usr/bin:/bin','NODE_OPTIONS':''},timeout=25)
assert p.returncode==0
proof={'project':'VITALISMEN_EC','envelope':json.loads(p.stderr),'sha256':hashlib.sha256(packet.read_bytes()).hexdigest(),'bytes':packet.stat().st_size,'privateKeyUploaded':False}
(B/'PRIVATE_CONFIG_AFTER_CAPTURE.json').write_text(json.dumps(proof,indent=2)+'\n');print(json.dumps(proof))
'''
ssh=['ssh','-o','HostName=72.60.137.77','-o','BatchMode=yes','maxlien-vps-ec']
p=subprocess.run([*ssh,'python3 -I -B -S -'],input=remote,capture_output=True,text=True,encoding='utf-8',timeout=40)
assert p.returncode==0,p.stderr[-800:]
proof=json.loads(p.stdout);(E/'PRIVATE_CONFIG_AFTER_CAPTURE.json').write_text(json.dumps(proof,indent=2)+'\n')
with(E/'RUNTIME_CONFIG_AFTER.vbe').open('xb')as file:
 p=subprocess.run([*ssh,'cat /opt/vitalismen-automacao/backups/vitpower-named-entry-v246-r5-20261118/RUNTIME_CONFIG_AFTER.vbe'],stdout=file,stderr=subprocess.PIPE,timeout=25);assert p.returncode==0
print(json.dumps({'status':'SEALED_RUNTIME_AFTER_CAPTURED','bytes':proof['bytes'],'sha256':proof['sha256'],'privateKeyUploaded':False}))
