from pathlib import Path
import subprocess,json
H=Path(__file__).resolve().parent
remote=r'''
import pathlib,subprocess,hashlib,os,json,datetime,urllib.request
p=pathlib.Path('/etc/nginx/sites-enabled/taviazen.shop').resolve();before=p.read_bytes();text=before.decode();marker='    # END VITALISMEN_EC WEB CHAT V220'
assert text.count(marker)==1 and 'location = /vitpower_2026g/assets/acesso-pedido.html'not in text
block=''
for name,mime in [('acesso-pedido.html','text/html'),('acesso-pedido-v238.js','application/javascript')]:
 block+='    location = /vitpower_2026g/assets/'+name+' {\n        if ($host != taviazen.shop) { return 404; }\n        alias /var/www/vitalismen-vitpower-2026g/assets/'+name+';\n        default_type '+mime+';\n        add_header Cache-Control "no-store" always;\n        add_header Referrer-Policy "no-referrer" always;\n        add_header X-Content-Type-Options "nosniff" always;\n    }\n'
after=text.replace(marker,block+marker).encode();assert after.replace(block.encode(),b'',1)==before
B=pathlib.Path('/var/backups/vitalismen-ec/order-access-v238-r4');backup=B/'nginx-site.before.conf';fd=os.open(backup,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o400)
with os.fdopen(fd,'wb')as f:f.write(before);f.flush();os.fsync(f.fileno())
st=p.stat();tmp=p.with_name(p.name+'.v238-route.tmp');assert not tmp.exists();tmp.write_bytes(after);os.chmod(tmp,st.st_mode&511);os.chown(tmp,st.st_uid,st.st_gid);os.replace(tmp,p)
t=subprocess.run(['nginx','-t'],capture_output=True,text=True)
if t.returncode:
 p.write_bytes(before);raise RuntimeError('NGINX_CONFIG_TEST_FAILED_RESTORED')
r=subprocess.run(['systemctl','reload','nginx'],capture_output=True,text=True)
assert r.returncode==0,'RELOAD_FAILED'
checks=[]
for name in ['acesso-pedido.html','acesso-pedido-v238.js']:
 c=subprocess.run(['curl','--silent','--show-error','--fail','--resolve','taviazen.shop:443:127.0.0.1','https://taviazen.shop/vitpower_2026g/assets/'+name],capture_output=True)
 assert c.returncode==0,'LOCAL_ROUTE_FAILED:'+name
 assert c.stdout==pathlib.Path('/var/www/vitalismen-vitpower-2026g/assets/'+name).read_bytes()
 checks.append({'asset':name,'http':200,'exactBytes':True})
v={'project':'VITALISMEN_EC','pass':True,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'path':str(p),'backup':str(backup),'beforeSha256':hashlib.sha256(before).hexdigest(),'afterSha256':hashlib.sha256(after).hexdigest(),'onlyTwoExactAssetLocationsAdded':True,'otherConfigBytesPreserved':True,'nginxTestPass':True,'gracefulReloads':1,'serviceRestarts':0,'checks':checks,'uid':st.st_uid,'gid':st.st_gid,'mode':st.st_mode&511}
(B/'NGINX_LANDING_ROUTES.json').write_text(json.dumps(v,indent=2));os.chmod(B/'NGINX_LANDING_ROUTES.json',0o400);print(json.dumps(v))
'''
r=subprocess.run(['ssh','-o','HostName=169.58.51.100','-o','BatchMode=yes','vilaliemen-protocolo-g','python3 -I -B -S -'],input=remote,capture_output=True,text=True,encoding='utf-8',timeout=60)
assert r.returncode==0,r.stderr[-1500:]
v=json.loads(r.stdout);(H/'NGINX_LANDING_ROUTES.json').write_text(json.dumps(v,indent=2));print(json.dumps(v))
