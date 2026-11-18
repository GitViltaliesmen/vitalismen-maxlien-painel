from pathlib import Path
import subprocess,json
H=Path(__file__).resolve().parent
remote=r'''
from pathlib import Path
import subprocess,json,hashlib,os,tempfile,shutil
B=Path('/opt/vitalismen-automacao/backups/qa-b01-cycle-v244-r8-20261117');S=Path('/var/lib/vitalismen-deploy/ec-qa-b01-cycle-v244-r8');a=json.loads((S/'approval.json').read_text());R=Path(a['release']);P=Path(a['parentRelease']);assert Path('/opt/vitalismen-automacao/current').resolve()==P
row=next(x for x in json.loads(subprocess.check_output(['pm2','jlist']))if x['name']=='vitalismen-automation')
base={k:str(v)for k,v in row['pm2_env'].items()if isinstance(v,(str,int,float))and not isinstance(v,bool)}
D=Path(tempfile.mkdtemp(prefix='vitalismen-linked-inheritance-'))
for n in ['releases','backups']:(D/n).mkdir()
os.symlink(R,D/'current')
parent=json.loads(Path('/var/lib/vitalismen-deploy/ec-tex-measurement-v243-r5/activation.json').read_text());active={**parent,'commit':a['commit'],'approvalSha256':hashlib.sha256((S/'approval.json').read_bytes()).hexdigest(),'privateStartupProbeOnly':True}
f=D/'activation.json';f.write_text(json.dumps(active,indent=2)+'\n');f.chmod(0o400)
shell='set -eu\nmount --make-rprivate /\n'
for n in ['releases','backups']:shell+='mount --bind /opt/vitalismen-automacao/'+n+' '+str(D/n)+'\nmount -o remount,bind,ro '+str(D/n)+'\n'
shell+='mount --rbind '+str(D)+' /opt/vitalismen-automacao\n'
for n in ['/var/lib/vitalismen-deploy','/usr/local/lib/vitalismen-deploy','/var/lib/vitalismen-tex-linked-entry-v242']:
 shell+='if test -d '+n+'; then mount --bind '+n+' '+n+'; mount -o remount,bind,ro '+n+'; fi\n'
shell+='mount --bind '+str(f)+' '+str(S/'activation.json')+'\ncd '+str(R)+'\nexec node --input-type=module -\n'
probe=r"""import assert from'node:assert/strict';import fs from'node:fs';
process.argv[1]='/usr/lib/node_modules/pm2/lib/ProcessContainerFork.js';process.env.NODE_OPTIONS='--import=file:///opt/vitalismen-automacao/current/scripts/lib/sealed-successor-preload-v1.mjs';await import('/opt/vitalismen-automacao/current/scripts/lib/sealed-successor-preload-v1.mjs');
const R=fs.realpathSync('/opt/vitalismen-automacao/current'),D='/var/lib/vitalismen-deploy/ec-qa-b01-cycle-v244-r8',linked=globalThis.__VITALISMEN_EC_TEX_LINKED_ENTRY_V242,web=globalThis.__VITALISMEN_EC_WEB_CHAT_V220;
const req={method:'POST',originalUrl:'/api/web-chat/vitpower',headers:{origin:'https://plusmen.shop','x-vitalismen-chat-page':'plusmen-tex-v240','x-vitalismen-chat-proxy':fs.readFileSync(D+'/tex-web-proxy.secret','utf8')}};
assert.equal(linked.isCurrent(),true);assert.equal(web.entryV242Allowed(req),true);assert.equal(web.productForRequest(req),'tex_ultra_ec');
const original=fs.readFileSync;
try{fs.readFileSync=function(file,...args){const b=original.call(fs,file,...args);if(String(file)===D+'/linked-entry-qa-proof.json'){const p=JSON.parse(String(b));p.commit='0'.repeat(40);return Buffer.from(JSON.stringify(p,null,2)+'\n')}return b};assert.equal(linked.isCurrent(),false);assert.equal(web.entryV242Allowed(req),false)}finally{fs.readFileSync=original}
assert.equal(linked.isCurrent(),true);
try{fs.readFileSync=function(file,...args){const b=original.call(fs,file,...args);return String(file)===R+'/src/services/texUltraLinkedEntryV242Service.js'?Buffer.concat([Buffer.from(b),Buffer.from('//tampered isolated fixture')]):b};assert.equal(linked.isCurrent(),false)}finally{fs.readFileSync=original}
assert.equal(linked.isCurrent(),true);assert.equal(web.entryV242Allowed({...req,headers:{...req.headers,origin:'https://invalid.example'}}),false);
console.log(JSON.stringify({publicLinkedEntryPreserved:true,parentProofCommitAndShaBound:true,changedProofRejected:true,changedInheritedPayloadRejected:true,foreignOriginRejected:true,realMessages:0,productionWrites:0,serverStarted:false}));
"""
env={**base,**a['profiles']['botLive'],'NODE_OPTIONS':'','npm_config_node_options':'','NPM_CONFIG_NODE_OPTIONS':'','pm_exec_path':'/opt/vitalismen-automacao/current/src/index.js'}
try:
 p=subprocess.run(['unshare','--mount','--net','--fork','bash','-c',shell],input=probe,env=env,capture_output=True,text=True,timeout=150)
 (B/'INHERITED_LINKED_QUALIFICATION.private.log').write_text(p.stdout+p.stderr);assert p.returncode==0,p.stderr[-1500:]
 result=json.loads(p.stdout.splitlines()[-1]);assert result['publicLinkedEntryPreserved']and result['changedProofRejected']and result['changedInheritedPayloadRejected']
 old=json.loads((B/'EXTRA_QUALIFICATION.json').read_text());assert old['status']=='PASS'
 backup=B/'EXTRA_QUALIFICATION_INITIAL.json';assert not backup.exists();backup.write_bytes((B/'EXTRA_QUALIFICATION.json').read_bytes())
 old['results'].append({'name':'inherited_linked_entry_public_policy_and_tamper_rejection','pass':True,'exitCode':0,'proof':result});old['activeReleaseUnchanged']=Path('/opt/vitalismen-automacao/current').resolve()==P;assert old['activeReleaseUnchanged']
 (B/'EXTRA_QUALIFICATION.json').write_text(json.dumps(old,indent=2)+'\n');print(json.dumps(old))
finally:
 assert D.parent==Path('/tmp')and D.name.startswith('vitalismen-linked-inheritance-');shutil.rmtree(D)
'''
r=subprocess.run(['ssh','-o','HostName=72.60.137.77','-o','BatchMode=yes','maxlien-vps-ec','python3 -I -B -S -'],input=remote,text=True,capture_output=True,encoding='utf-8',timeout=170);assert r.returncode==0,r.stderr[-1500:]
v=json.loads(r.stdout);(H/'EXTRA_QUALIFICATION_INITIAL.json').write_bytes((H/'EXTRA_QUALIFICATION.json').read_bytes());(H/'EXTRA_QUALIFICATION.json').write_text(json.dumps(v,indent=2)+'\n',encoding='utf-8');print(json.dumps({'status':v['status'],'checks':len(v['results']),'linkedInheritance':v['results'][-1]}))
