from pathlib import Path
import subprocess,json
H=Path(__file__).resolve().parent
remote=r'''
import pathlib,subprocess,json,hashlib,os
B=pathlib.Path('/var/backups/vitalismen-ec/order-access-v238-r4');proof=B/'NGINX_LANDING_ROUTES.json';v=json.loads(proof.read_text());p=pathlib.Path(v['path']);before=p.read_bytes();assert hashlib.sha256(before).hexdigest()==v['afterSha256'];text=before.decode()
for name in ['acesso-pedido.html','acesso-pedido-v238.js']:
 start=text.index('    location = /vitpower_2026g/assets/'+name+' {');end=text.index('\n    }',start)+6;block=text[start:end];assert block.count('Cache-Control "no-store"')==1;text=text[:start]+block.replace('Cache-Control "no-store"','Cache-Control "no-store, no-transform"')+text[end:]
after=text.encode();tmp=p.with_name(p.name+'.v238-headers.tmp');assert not tmp.exists();st=p.stat();tmp.write_bytes(after);os.chmod(tmp,st.st_mode&511);os.chown(tmp,st.st_uid,st.st_gid);os.replace(tmp,p)
r=subprocess.run(['nginx','-t'],capture_output=True);assert r.returncode==0
r=subprocess.run(['systemctl','reload','nginx'],capture_output=True);assert r.returncode==0
v.update(afterSha256=hashlib.sha256(after).hexdigest(),gracefulReloads=2,noTransformOnPrivateLanding=True,analyticsOnOtherPagesUnchanged=True,publicCheckInitiallyFailed=True,initialFailure='New paths absent from Nginx allowlist; transient cached404; automatic Cloudflare beacon transformed HTML')
proof.write_text(json.dumps(v,indent=2));os.chmod(proof,0o400);print(json.dumps(v))
'''
r=subprocess.run(['ssh','-o','HostName=169.58.51.100','-o','BatchMode=yes','vilaliemen-protocolo-g','python3 -I -B -S -'],input=remote,capture_output=True,text=True,encoding='utf-8',timeout=40);assert r.returncode==0,r.stderr[-600:]
v=json.loads(r.stdout);(H/'NGINX_LANDING_ROUTES.json').write_text(json.dumps(v,indent=2));print(json.dumps(v))
