from pathlib import Path
import subprocess,json,concurrent.futures,datetime
H=Path(__file__).resolve().parent;b=json.loads((H/'PUBLIC_BASELINE.json').read_text());files={n:d for n,d in b['siteHashes'].items()if n.startswith('assets/')}
remote=r"""
import urllib.request,hashlib,json
out=[]
def open_public(req,timeout):
 try:return urllib.request.urlopen(req,timeout=timeout)
 except Exception as e:raise RuntimeError('PUBLIC_URL_FAILED:'+req.full_url+':'+type(e).__name__) from e
for n,expected in HASHES.items():
 req=urllib.request.Request('https://taviazen.shop/vitpower_2026g/'+n,headers={'User-Agent':'Vitalismen-EC-Availability-Audit'})
 with open_public(req,timeout=25)as r:data=r.read();assert r.status==200
 assert hashlib.sha256(data).hexdigest()==expected,'PUBLIC_ASSET_HASH:'+n;out.append({'path':n,'http':200,'sha256':expected})
for name,ua in [('mobile','Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36'),('desktop','Vitalismen-EC-Availability-Audit')]:
 req=urllib.request.Request('https://taviazen.shop/vitpower_2026g?vp_qa=1',headers={'User-Agent':ua})
 with open_public(req,timeout=25)as r:data=r.read();assert r.status==200
 if name=='mobile':assert b'69f206413ea7d424b034658c' in data
 out.append({'name':name,'http':200,'approvedPlayer':name=='mobile'})
req=urllib.request.Request('https://ec.maxlien.shop/qr.html?v=20261112-v206',headers={'User-Agent':'Vitalismen-EC-Availability-Audit'})
with open_public(req,timeout=25)as r:data=r.read();assert r.status==200
assert 'Preparar acesso seguro ao pedido'.encode()in data and 'Gerar código privado'.encode()not in data
out.append({'name':'dashboard','http':200,'simpleOrderAccessPresent':True})
print(json.dumps({'pass':True,'checks':out,'javascriptExecution':False,'commercialEvents':0}))
"""
def check(host,alias):
 r=subprocess.run(['ssh','-o','HostName='+host,'-o','BatchMode=yes',alias,'python3 -I -B -S -'],input='HASHES='+repr(files)+'\n'+remote,capture_output=True,text=True,encoding='utf-8',timeout=170)
 if r.returncode!=0:return{'host':host,'pass':False,'error':r.stderr[-1600:]}
 return{'host':host,**json.loads(r.stdout)}
with concurrent.futures.ThreadPoolExecutor(max_workers=2)as ex:out=list(ex.map(lambda x:check(*x),[('72.60.137.77','maxlien-vps-ec'),('169.58.51.100','vilaliemen-protocolo-g')]))
r={'project':'VITALISMEN_EC','pass':all(x['pass']for x in out),'phase':'AFTER_ACTIVATION','candidateCommit':json.loads((H/'PREPARED.json').read_bytes())['commit'],'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'results':out};(H/'PUBLIC_CHECKS.json').write_text(json.dumps(r,indent=2));print(json.dumps(r))

assert r['pass'],'PUBLIC_POST_CHECK_FAILED'
