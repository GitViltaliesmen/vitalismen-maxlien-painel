from pathlib import Path
import subprocess,json
H=Path(__file__).resolve().parent
remote=r'''
from pathlib import Path
import subprocess,json,hashlib,os,tempfile,shutil,re
B=Path('/opt/vitalismen-automacao/backups/tex-entry-greeting-v249-r6-20261118');S=Path('/var/lib/vitalismen-deploy/ec-tex-entry-greeting-v249-r6');a=json.loads((S/'approval.json').read_text());R=Path(a['release']);P=Path(a['parentRelease']);assert Path('/opt/vitalismen-automacao/current').resolve()==P
test='tests/tex-ultra-linked-http-v242.test.mjs';parent=json.loads(Path('/var/lib/vitalismen-deploy/ec-tex-linked-entry-v242-r6/approval.json').read_text());assert hashlib.sha256((R/test).read_bytes()).hexdigest()==parent['hashes'][test]
row=next(x for x in json.loads(subprocess.check_output(['pm2','jlist']))if x['name']=='vitalismen-automation');base={k:str(v)for k,v in row['pm2_env'].items()if isinstance(v,(str,int,float))and not isinstance(v,bool)}
D=Path(tempfile.mkdtemp(prefix='vitalismen-native-linked-http-'))
for n in ['releases','backups','linked-store']:(D/n).mkdir()
os.symlink(R,D/'current')
originalTest=(R/test).read_bytes();originalSource=originalTest.decode('utf8')
before="assert.match(result.data.reply, /Hola, Juan,/);"
after="assert.match(result.data.reply, /^¡Hola! ¡(?:Buenos días|Buenas tardes|Buenas noches), Juan! Soy Ana Lopez, del equipo de la Dra\\. María Fernandes\\. Gracias por tu interés en Tex Ultra\\. Estoy aquí para ayudarte y aclarar tus dudas\\. Te comparto una breve presentación y seguimos conversando\\./);"
assert originalSource.count(before)==1
adapted=originalSource.replace(before,after,1)
assert adapted.count(after)==1 and adapted.replace(after,before,1)==originalSource
adaptedPath=D/'tex-linked-http-v249.mjs';adaptedPath.write_bytes(adapted.encode('utf8'))

active={**json.loads(Path('/var/lib/vitalismen-deploy/ec-tex-entry-invites-v246-r2/activation.json').read_text()),'state':'ACTIVE','commit':a['commit'],'approvalSha256':hashlib.sha256((S/'approval.json').read_bytes()).hexdigest(),'privateStartupProbeOnly':True,'linkedEntryAllowed':True,'linkedEntryAudience':'PRIVATE_QA'}
f=D/'activation.json';f.write_text(json.dumps(active,indent=2)+'\n');f.chmod(0o400)
shell='set -eu\nmount --make-rprivate /\n'
for n in ['releases','backups']:shell+='mount --bind /opt/vitalismen-automacao/'+n+' '+str(D/n)+'\nmount -o remount,bind,ro '+str(D/n)+'\n'
shell+='mount --rbind '+str(D)+' /opt/vitalismen-automacao\nip link set lo up\n'
for n in ['/var/lib/vitalismen-deploy','/usr/local/lib/vitalismen-deploy','/var/lib/vitalismen-tex-linked-entry-v242','/opt/maxlien-mvp','/root/wa_wpp','/root/.vitalismen-secrets']:
 shell+='if test -d '+n+'; then mount --bind '+n+' '+n+'; mount -o remount,bind,ro '+n+'; fi\n'
shell+='mount --bind '+str(D/'linked-store')+' /var/lib/vitalismen-tex-linked-entry-v242\n'
shell+='mount --bind '+str(f)+' '+str(S/'activation.json')+'\ncd '+str(R)+'\nexec node --input-type=module -\n'
probe="""import fs from'node:fs';import assert from'node:assert/strict';process.argv[1]='/usr/lib/node_modules/pm2/lib/ProcessContainerFork.js';process.env.NODE_OPTIONS='--import=file:///opt/vitalismen-automacao/current/scripts/lib/sealed-successor-preload-v1.mjs';await import('/opt/vitalismen-automacao/current/scripts/lib/sealed-successor-preload-v1.mjs');const R=fs.realpathSync('/opt/vitalismen-automacao/current');process.env.TEX_TEST_RELEASE=R;assert.equal(globalThis.__VITALISMEN_EC_TEX_LINKED_ENTRY_V242.isStoreCurrent(),true);assert.equal(globalThis.__VITALISMEN_EC_TEX_LINKED_ENTRY_V242.isCurrent(),false);await import(process.env.TEX_EXPECTATION_TEST_V249);"""
env={**base,**a['profiles']['botLive'],'TEX_EXPECTATION_TEST_V249':str(adaptedPath),'NODE_OPTIONS':'','npm_config_node_options':'','NPM_CONFIG_NODE_OPTIONS':'','pm_exec_path':'/opt/vitalismen-automacao/current/src/index.js'}
try:
 p=subprocess.run(['unshare','--mount','--net','--fork','bash','-c',shell],input=probe,env=env,capture_output=True,text=True,timeout=200)
 oldlog=B/'NATIVE_LINKED_HTTP.private.log'
 if oldlog.exists():
  failed=B/'NATIVE_LINKED_HTTP_LEGACY_GREETING_EXPECTATION_FAIL.private.log';assert not failed.exists();oldlog.rename(failed)
 (B/'NATIVE_LINKED_HTTP.private.log').write_text(p.stdout+p.stderr)
 assert p.returncode==0 and '# tests 1' in p.stdout and '# pass 1' in p.stdout and '# fail 0' in p.stdout,(p.stdout+p.stderr)[-2500:]
 result={'name':'native_linked_http_owner_scope','pass':True,'exitCode':0,'networkIsolated':True,'privateQaStoreEnabled':True,'publicBusinessDispatchEnabled':False,'unchangedInheritedTestSha256':hashlib.sha256((R/test).read_bytes()).hexdigest(),'adaptedTestSha256':hashlib.sha256(adaptedPath.read_bytes()).hexdigest(),'approvedGreetingExpectationChange':{'onlyGreetingAssertionChanged':True,'before':before,'after':after,'exactInversePass':adapted.replace(after,before,1)==originalSource},'greetingMatchesRequestedV249':True,'tapSummary':re.findall(r'# (?:tests|pass|fail) \d+',p.stdout),'productionWrites':0,'realMessages':0}
 old=json.loads((B/'EXTRA_QUALIFICATION.json').read_text());assert old['status']=='PASS';assert not any(x['name']==result['name']for x in old['results'])
 (B/'EXTRA_QUALIFICATION_BEFORE_NATIVE_HTTP.json').write_bytes((B/'EXTRA_QUALIFICATION.json').read_bytes());old['results'].append(result);old['activeReleaseUnchanged']=Path('/opt/vitalismen-automacao/current').resolve()==P;assert old['activeReleaseUnchanged']
 (B/'EXTRA_QUALIFICATION.json').write_text(json.dumps(old,indent=2)+'\n');print(json.dumps(old))
finally:
 assert D.parent==Path('/tmp')and D.name.startswith('vitalismen-native-linked-http-');shutil.rmtree(D)
'''
p=subprocess.run(['ssh','-o','HostName=72.60.137.77','-o','BatchMode=yes','maxlien-vps-ec','python3 -I -B -S -'],input=remote,text=True,capture_output=True,encoding='utf-8',timeout=220);assert p.returncode==0,p.stderr[-2500:]
r=json.loads(p.stdout);(H/'EXTRA_QUALIFICATION_BEFORE_NATIVE_HTTP.json').write_bytes((H/'EXTRA_QUALIFICATION.json').read_bytes());(H/'EXTRA_QUALIFICATION.json').write_bytes((json.dumps(r,indent=2)+'\n').encode());print(json.dumps({'status':r['status'],'checks':len(r['results']),'nativeLinkedHttp':r['results'][-1]}))
