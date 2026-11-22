from pathlib import Path
import json,hashlib,os,stat,sys
ROOT=Path('/root/plusmen-tex-checkout-v256-20261121')
EXPECTED='831ff907a2e9db0fa3b72523ad5760e5df82ec1db83bb4d20506e9eaccb775b7'
raw=(ROOT/'manifest.json').read_bytes();assert hashlib.sha256(raw).hexdigest()==EXPECTED
manifest=json.loads(raw)
sha=lambda d:hashlib.sha256(d).hexdigest()
def read_target(c):
 p=Path(c['path']);st=p.lstat()
 assert stat.S_ISREG(st.st_mode) and st.st_uid==0 and st.st_gid==0 and stat.S_IMODE(st.st_mode)==0o644 and st.st_nlink==1
 return p,p.read_bytes()
def validate(c,data):
 assert sha(data)==c['sha256']
 for patch in reversed(c['patches']):
  a=patch['before'].encode();b=patch['after'].encode();assert data.count(b)==1;data=data.replace(b,a,1)
 assert sha(data)==c['beforeSha256']
def replace(p,data,expected):
 assert sha(p.read_bytes())==expected,'concurrent_change'
 temp=p.with_name(p.name+'.v256.tmp')
 with temp.open('xb') as f:f.write(data);f.flush();os.fsync(f.fileno())
 os.chmod(temp,0o644);os.chown(temp,0,0)
 assert sha(p.read_bytes())==expected,'concurrent_change'
 os.replace(temp,p)
 fd=os.open(p.parent,os.O_RDONLY);os.fsync(fd);os.close(fd)
mode=sys.argv[1]
records=[]
for c in manifest['changes']:
 candidate=(ROOT/c['name']).read_bytes();validate(c,candidate)
 p,before=read_target(c);records.append((c,p,before,candidate))
if mode=='audit':
 print(json.dumps([{'path':c['path'],'sha256':sha(b),'isBefore':sha(b)==c['beforeSha256'],'isAfter':sha(b)==c['sha256']} for c,p,b,n in records]))
elif mode=='apply':
 assert all(sha(b)==c['beforeSha256'] for c,p,b,n in records),'preimage_mismatch'
 backup=ROOT/'backup';backup.mkdir(mode=0o700,exist_ok=False)
 for c,p,b,n in records:
  with (backup/c['name']).open('xb') as f:f.write(b);f.flush();os.fsync(f.fileno())
 for c,p,b,n in records:assert sha((backup/c['name']).read_bytes())==c['beforeSha256']
 completed=[]
 try:
  for c,p,b,n in records:replace(p,n,c['beforeSha256']);completed.append((c,p,b))
 except BaseException:
  for c,p,b in reversed(completed):replace(p,b,c['sha256'])
  raise
 print(json.dumps({'applied':True,'files':len(records),'backup':str(backup)}))
elif mode=='rollback':
 assert all(sha(b)==c['sha256'] for c,p,b,n in records),'successor_present_or_partial_state'
 for c,p,b,n in records:assert sha((ROOT/'backup'/c['name']).read_bytes())==c['beforeSha256']
 for c,p,b,n in records:replace(p,(ROOT/'backup'/c['name']).read_bytes(),c['sha256'])
 print(json.dumps({'rolledBack':True}))
else:raise ValueError(mode)
