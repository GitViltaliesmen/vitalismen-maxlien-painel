"""Renew only the existing official Dropi session; no order/message actions."""
import pathlib,os,json,base64,time,subprocess,hashlib,fcntl,uuid,sys,stat
B=pathlib.Path('/opt/vitalismen-automacao/backups/ec-orders-dropi-postsale-v252-20261119-r11')
F=pathlib.Path('/root/.vitalismen-secrets/droppi-ec-storage.json')
sha=lambda data:hashlib.sha256(data).hexdigest()
def identity(data):
 state=json.loads(data);origins=[x for x in state['origins']if x['origin']=='https://app.dropi.ec'];assert len(origins)==1
 entries={x['name']:x['value']for x in origins[0]['localStorage']};login=json.loads(entries['DROPI_LoginResult']);token=json.loads(entries['DROPI_token'])
 assert token==login['token'];claims=json.loads(base64.urlsafe_b64decode(token.split('.')[1]+'==='))
 owner=str(login.get('objects',{}).get('id')or'');country=str((login.get('countries')or[{}])[0].get('code')or(login.get('configurations')or[{}])[0].get('country_code')or(login.get('configurations')or[{}])[0].get('code')or(login.get('configurations')or[{}])[0].get('country')or'').lower()
 assert owner.isdigit()and country in ['ec','ecuador'];return owner,'ec',float(claims['exp']),entries
def main():
 lock=open('/var/lib/vitalismen-deploy/dropi-session-renew-v252.lock','a');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
 before=F.read_bytes();owner,country,expiry,entries=identity(before)
 force=False
 if len(sys.argv)==2:
  proofPath=pathlib.Path(sys.argv[1]);assert proofPath.parent==pathlib.Path('/var/lib/vitalismen-deploy/ec-dropi-meta-v254-r8/session-observations');st=proofPath.lstat();assert stat.S_ISREG(st.st_mode)and st.st_uid==0 and st.st_nlink==1 and stat.S_IMODE(st.st_mode)==0o600
  proof=json.loads(proofPath.read_bytes());assert proof['project']=='VITALISMEN_EC'and proof['httpStatus']==401 and proof['apiOrigin']=='https://api-v2.dropi.ec'and proof['sessionSha256']==sha(before)and 0<=time.time()-proof['observedAt']<120
  S=pathlib.Path('/var/lib/vitalismen-deploy/ec-dropi-meta-v254-r8');a=json.loads((S/'approval.json').read_bytes());active=json.loads((S/'activation.json').read_bytes());assert active['state']=='ACTIVE'and active['commit']==a['commit']and str(pathlib.Path('/opt/vitalismen-automacao/current').resolve())==a['release']
  assert hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest()==a['hashes']['scripts/renew-dropi-session-v254.py'];force=True
 if expiry>time.time()+600 and not force:return{'status':'VALID_SESSION_RETAINED','renewed':False}
 marker=B/('SESSION_RENEW_'+sha(before)+'.json')
 if marker.exists():return{'status':'RENEWAL_ALREADY_ATTEMPTED_REVIEW_REQUIRED','renewed':False}
 fd=os.open(marker,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
 with os.fdopen(fd,'w')as out:json.dump({'status':'CLAIMED','at':time.time(),'ordersCreated':0,'physicalMessages':0},out)
 target=B/('session-renew-'+uuid.uuid4().hex+'.private.json')
 result={'status':'FAILED_REVIEW_REQUIRED','renewed':False,'ordersCreated':0,'physicalMessages':0}
 try:
  env={**os.environ,'NODE_OPTIONS':'','DROPPI_EC_STORAGE_STATE_PATH':str(target)}
  p=subprocess.run(['node',str(B/'renew-official-bff-session.mjs')],env=env,cwd='/opt/vitalismen-automacao/current',capture_output=True,timeout=220)
  if p.returncode!=0 or not target.is_file():raise RuntimeError('OFFICIAL_SESSION_NOT_VERIFIED')
  data=target.read_bytes();newOwner,newCountry,newExpiry,newEntries=identity(data)
  assert(newOwner,newCountry)==(owner,country)and newExpiry>time.time()+600,'ACCOUNT_OR_EXPIRY_MISMATCH'
  for key in ['DROPI_cities','DROPI_departments','DROPI_SessionData']:
   if key in entries:assert newEntries.get(key)==entries[key],'GEOGRAPHY_CHANGED'
  assert F.read_bytes()==before,'CONCURRENT_SESSION_CHANGE'
  tmp=F.with_name(F.name+'.v252-'+uuid.uuid4().hex);tmp.write_bytes(data);os.chmod(tmp,0o600);os.replace(tmp,F)
  result.update(status='RENEWED_VERIFIED_SAME_ACCOUNT',renewed=True,expiresAtEpoch=newExpiry,geographyPreserved=True)
 except Exception as error:result['reason']=str(error)if isinstance(error,(AssertionError,RuntimeError))else type(error).__name__
 finally:
  if target.exists():target.unlink()
  marker.write_text(json.dumps(result,indent=2)+'\n');os.chmod(marker,0o600)
 return result
if __name__=='__main__':print(json.dumps(main()))
