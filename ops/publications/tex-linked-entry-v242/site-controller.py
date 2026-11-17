# PROJECT=VITALISMEN_EC. Only two authorized chat assets and three official media files.
import pathlib,json,hashlib,os,uuid,sys,datetime
B=pathlib.Path('/root/plusmen-tex-linked-entry-backups/20261117-v242-r6')
read=lambda p:json.loads(pathlib.Path(p).read_text());sha=lambda p:hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest();canon=lambda x:(json.dumps(x,ensure_ascii=False,indent=2)+'\n').encode()
def put(target,body,mode=0o644,uid=0,gid=0):
 p=pathlib.Path(target);assert p.parent.is_dir() and not p.is_symlink();tmp=p.with_name(p.name+'.v242-'+uuid.uuid4().hex);fd=os.open(tmp,os.O_CREAT|os.O_EXCL|os.O_WRONLY,mode);os.fchmod(fd,mode)
 with os.fdopen(fd,'wb')as f:f.write(body);f.flush();os.fsync(f.fileno())
 os.chown(tmp,uid,gid);os.replace(tmp,p)
def native_preserved():
 binding=read(B/'BINDINGS.json');assert sha(__file__)==binding['controllerSha256'] and sha(B/'SITE_PREPARED.json')==binding['manifestSha256']
 m=read(B/'SITE_PREPARED.json');base='/var/www/plusmen-tex-vsl-v1/assets/'
 assert set(m['files'])=={base+'chat-tex-ultra.js',base+'chat-tex-ultra.css',base+'tex-entry-v242/intro.mp3',base+'tex-entry-v242/proof.jpeg',base+'tex-entry-v242/bottle.png'}
 assert set(m['before'])=={base+'chat-tex-ultra.js',base+'chat-tex-ultra.css'} and m['project']=='VITALISMEN_EC'
 for name,record in m['native'].items():assert sha(name)==record['sha256'],'NATIVE_OR_SHARED_CHAT_CONFIG_CHANGED:'+name
 return m
def publish():
 m=native_preserved();p=read(B/'BACKEND_PUBLIC.json');assert p['pass']is True and p['commit']==m['backendCommit']
 folder=pathlib.Path('/var/www/plusmen-tex-vsl-v1/assets/tex-entry-v242');assert not folder.is_symlink()
 if not folder.exists():folder.mkdir(mode=0o755)
 assert folder.resolve()==folder and set(x.name for x in folder.iterdir())<={'intro.mp3','proof.jpeg','bottle.png'}
 assert folder.stat().st_uid==0 and folder.stat().st_gid==0;folder.chmod(0o755)
 for name,record in m['files'].items():
  target=pathlib.Path(name)
  if target.exists():assert sha(target)in [record['sha256'],m['before'].get(name,{}).get('sha256')],'CONCURRENT_CHAT_ASSET_CHANGED:'+name
  else:assert name not in m['before'],'CHAT_PARENT_MISSING:'+name
 # Publish dependencies first; the widget is the last atomic replacement.
 ordered=sorted(m['files'],key=lambda name:(name.endswith('chat-tex-ultra.js'),name.endswith('chat-tex-ultra.css'),name))
 for name in ordered:
  record=m['files'][name];source=B/'candidate'/record['relative'];assert sha(source)==record['sha256'];meta=m['before'].get(name,{'uid':0,'gid':0,'mode':0o644})
  put(name,source.read_bytes(),meta['mode'],meta['uid'],meta['gid']);assert sha(name)==record['sha256']
 native_preserved();result={'project':'VITALISMEN_EC','pass':True,'backendCommit':m['backendCommit'],'files':m['files'],'nativeVslPlayerCtaPhoneUnchanged':True,'nginxReloads':0,'pm2Restarts':0,'at':datetime.datetime.now(datetime.timezone.utc).isoformat()};put(B/'SITE_PUBLIC.json',canon(result),0o400);return result
def rollback():
 m=native_preserved()
 for name,record in m['files'].items():assert not pathlib.Path(name).exists()or sha(name)==record['sha256'],'CONCURRENT_ASSET_CHANGED:'+name
 for name,record in m['before'].items():
  source=B/'before'/pathlib.Path(name).name;assert sha(source)==record['sha256'];put(name,source.read_bytes(),record['mode'],record['uid'],record['gid'])
 for name in m['files']:
  if name not in m['before'] and pathlib.Path(name).exists():pathlib.Path(name).unlink()
 folder=pathlib.Path('/var/www/plusmen-tex-vsl-v1/assets/tex-entry-v242')
 if folder.exists():assert folder.resolve()==folder and not list(folder.iterdir());folder.rmdir()
 native_preserved();result={'project':'VITALISMEN_EC','pass':True,'status':'CHAT_ASSETS_RESTORED','nginxReloads':0,'pm2Restarts':0,'dataRestored':False};put(B/('ROLLBACK_'+uuid.uuid4().hex[:8]+'.json'),canon(result),0o400);return result
if __name__=='__main__':
 assert os.getuid()==0;actions={'publish':publish,'rollback':rollback};assert sys.argv[1]in actions;print(json.dumps(actions[sys.argv[1]]()))
