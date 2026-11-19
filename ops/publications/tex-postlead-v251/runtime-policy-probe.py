import pathlib,json,subprocess,os,tempfile,datetime,hashlib,shutil
B=pathlib.Path('/opt/vitalismen-automacao/backups/tex-postlead-invite-v251-20261119-r2')
S=pathlib.Path('/var/lib/vitalismen-deploy/ec-tex-postlead-v251-r2')
a=json.loads((S/'approval.json').read_bytes());R=pathlib.Path(a['release']);P=pathlib.Path(a['parentRelease'])
assert pathlib.Path('/opt/vitalismen-automacao/current').resolve()==P
app=next(x for x in json.loads(subprocess.check_output(['pm2','jlist']))if x['name']=='vitalismen-automation')
env={k:str(v)for k,v in app['pm2_env'].items()if isinstance(v,(str,int,float))and not isinstance(v,bool)}
env.update(a['profiles']['botLive']);env.update(OPENAI_API_KEY='OFFLINE_NO_NETWORK',MONGODB_URI='mongodb://127.0.0.1:1/fixture_only',npm_config_node_options='',NPM_CONFIG_NODE_OPTIONS='')
D=pathlib.Path(tempfile.mkdtemp(prefix='vitalismen-v251-policy-'))
for n in ['releases','backups','links','web']: (D/n).mkdir()
os.symlink(R,D/'current')
state=json.loads(pathlib.Path('/var/lib/vitalismen-deploy/ec-tex-entry-greeting-v249-r6/activation.json').read_bytes())
state.update(state='ACTIVE',runtimeAllowed=True,commit=a['commit'],approvalSha256=hashlib.sha256((S/'approval.json').read_bytes()).hexdigest(),texPostLeadActivatedAt=datetime.datetime.now(datetime.timezone.utc).isoformat())
(D/'activation.json').write_text(json.dumps(state,indent=2)+'\n');(D/'activation.json').chmod(0o400)
shell='set -eu\nmount --make-rprivate /\n'
for n in ['releases','backups']:
 shell+='mount --bind /opt/vitalismen-automacao/'+n+' '+str(D/n)+'\nmount -o remount,bind,ro '+str(D/n)+'\n'
shell+='mount --rbind '+str(D)+' /opt/vitalismen-automacao\n'
shell+='mount --bind '+str(D/'activation.json')+' '+str(S/'activation.json')+'\n'
shell+='mount --bind '+str(D/'links')+' /var/lib/vitalismen-tex-linked-entry-v242\n'
shell+='mount --bind '+str(D/'web')+' /var/lib/vitalismen-web-chat-v220-r2\n'
shell+='ip link set lo up\nexec "$@"\n'
try:
 p=subprocess.run(['unshare','--mount','--net','--fork','bash','-c',shell,'--','node',str(R/'tests/tex-postlead-runtime-v251.mjs')],env=env,cwd=R,capture_output=True,text=True,timeout=140)
 text=p.stdout+p.stderr
 for k,v in env.items():
  if len(v)>8 and any(x in k for x in ['KEY','TOKEN','SECRET','PASSWORD']):text=text.replace(v,'[REDACTED]')
 (B/'RUNTIME_POLICY.private.log').write_text(text);(B/'RUNTIME_POLICY.private.log').chmod(0o600)
 rows=[json.loads(line)for line in p.stdout.splitlines()if line.startswith('{')]
 result=rows[-1]if rows else {'pass':False}
 result.update(exitCode=p.returncode,candidateCommit=a['commit'],networkIsolated=True,productionUnchanged=pathlib.Path('/opt/vitalismen-automacao/current').resolve()==P,privateStoresUnchanged=not list((D/'links').iterdir())and not list((D/'web').iterdir()))
 result['pass']=result.get('pass')is True and p.returncode==0 and result['productionUnchanged'] and result['privateStoresUnchanged']
 (B/'RUNTIME_POLICY.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
finally:
 assert D.parent==pathlib.Path('/tmp')and D.name.startswith('vitalismen-v251-policy-');shutil.rmtree(D)
