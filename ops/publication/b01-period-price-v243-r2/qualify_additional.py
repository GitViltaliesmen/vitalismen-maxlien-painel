import json,pathlib,subprocess
H=pathlib.Path(__file__).resolve().parent;E=H
remote=r'''
import datetime,hashlib,json,os,pathlib,shutil,signal,subprocess,tempfile
B=pathlib.Path('/opt/vitalismen-automacao/backups/b01-period-price-v243-r2-20261117');STATE=pathlib.Path('/var/lib/vitalismen-deploy/ec-b01-period-price-v243-r2');a=json.loads((STATE/'approval.json').read_text());R=pathlib.Path(a['release']);P=pathlib.Path(a['parentRelease'])
assert pathlib.Path('/opt/vitalismen-automacao/current').resolve()==P
rows=json.loads(subprocess.run(['pm2','jlist'],capture_output=True,text=True,check=True).stdout);row=rows[0];base={k:str(v) for k,v in row['pm2_env'].items() if isinstance(v,(str,int,float)) and not isinstance(v,bool)}
env={**base,**a['profiles']['fixture'],'OPENAI_API_KEY':'OFFLINE_NO_NETWORK','npm_config_node_options':'','NPM_CONFIG_NODE_OPTIONS':''}
def run(args,environment=env,input=None,timeout=100):
 p=subprocess.Popen(args,cwd=R,env=environment,stdin=subprocess.PIPE if input is not None else subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,start_new_session=True)
 try:out,err=p.communicate(input=input,timeout=timeout)
 except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);out,err=p.communicate();return p.returncode,out,err+'\nTIMED_OUT'
 return p.returncode,out,err
results=[]
code,out,err=run(['unshare','--net','node',str(R/'scripts/audit-ec-product-micro-layer.mjs')]);(B/'PRODUCT_AUDIT.log').write_text(out+'\n'+err);results.append({'name':'product_micro_layer','pass':code==0,'exitCode':code,'tail':(out+err)[-800:]})
for relative in ['src/services/vitPowerB01CoreV216Service.js','src/services/principalSdrFreeflowRuntimeService.js','src/services/vitPowerScopedQuestionHistoryV243Service.js','tests/b01-period-price-v242.test.mjs','scripts/lib/sealed-successor-preload-v1.mjs']:
 assert pathlib.Path('/opt/vitalismen-automacao/current').resolve()==P
 file=R/relative;original=file.read_bytes();digest=hashlib.sha256(original).hexdigest();fd,name=tempfile.mkstemp(prefix='vitalismen-v227-negative-');tamper=pathlib.Path(name)
 try:
  os.write(fd,original+b'\n// isolated negative integrity fixture\n');os.close(fd)
  command='set -eu; mount --make-rprivate /; mount --bind "$1" "$2"; exec node "$3"'
  code,out,err=run(['unshare','--mount','--net','bash','-c',command,'--',str(tamper),str(file),str(R/'scripts/senior-guard.mjs')]);results.append({'name':'tampered_'+file.name,'pass':code!=0 and 'SEALED' in out+err,'exitCode':code,'tail':(out+err)[-500:]})
 finally:
  tamper.unlink();assert hashlib.sha256(file.read_bytes()).hexdigest()==digest==a['hashes'][relative]
for key in ['AI_WORKER_ENABLED','VITALISMEN_META_PURCHASE_ENABLED']:
 code,out,err=run(['unshare','--net','node',str(R/'scripts/senior-guard.mjs')],environment={**env,key:'true'});results.append({'name':'forbidden_flag_'+key,'pass':code!=0,'exitCode':code,'tail':(out+err)[-400:]})
# Simulate only startup configuration in private aliases; never start a server or connect a commercial database.
D=pathlib.Path(tempfile.mkdtemp(prefix='vitalismen-v212-startup-'))
for name in ['releases','backups']:(D/name).mkdir()
os.symlink(R,D/'current')
active={'state':'ACTIVE','commit':a['commit'],'approvalSha256':hashlib.sha256((STATE/'approval.json').read_bytes()).hexdigest(),'runtimeAllowed':True,'postSaleApproved':True,'freeflowAudience':'EC_FORWARD_ONLY','privateStartupProbeOnly':True,'burstAllowed':True,'burstAudience':'QA_ONLY','burstActivatedAt':'2026-11-16T00:00:00.000Z','priorityAllowed':True,'priorityAudience':'EC_FORWARD_ONLY','priorityQaProofSha256':a['inheritedPriorityProofSha256']}
active.update(webAllowed=True,webAudience='PUBLIC_SITE',webQaProofSha256=a['inheritedWebProofSha256'],texWebAllowed=True,texWebAudience='PUBLIC_SITE',texWebQaProofSha256=a['inheritedTexWebProofSha256'])
stateFile=D/'activation.json';stateFile.write_text(json.dumps(active,indent=2)+'\n');stateFile.chmod(0o400)
shell='set -eu\nmount --make-rprivate /\n'
for name in ['releases','backups']:shell+='mount --bind /opt/vitalismen-automacao/'+name+' '+str(D/name)+'\nmount -o remount,bind,ro '+str(D/name)+'\n'
shell+='mount --rbind '+str(D)+' /opt/vitalismen-automacao\n'
for folder in ['/opt/maxlien-mvp','/root/wa_wpp','/root/.vitalismen-secrets','/var/lib/vitalismen-deploy','/usr/local/lib/vitalismen-deploy']:
 shell+='if test -d '+folder+'; then mount --bind '+folder+' '+folder+'; mount -o remount,bind,ro '+folder+'; fi\n'
shell+='mount --bind '+str(stateFile)+' '+str(STATE/'activation.json')+'\ncd '+str(R)+'\nexec node --input-type=module -\n'
probe="""import assert from'node:assert/strict';import fs from'node:fs';
process.argv[1]='/usr/lib/node_modules/pm2/lib/ProcessContainerFork.js';
process.env.NODE_OPTIONS='--import=file:///opt/vitalismen-automacao/current/scripts/lib/sealed-successor-preload-v1.mjs';
await import('/opt/vitalismen-automacao/current/scripts/lib/sealed-successor-preload-v1.mjs');
const R=fs.realpathSync('/opt/vitalismen-automacao/current');
const{assertCanaryControllerV77Startup}=await import(R+'/src/services/canaryControllerV77Service.js');
const{assertCanaryV75RuntimeConfiguration}=await import(R+'/src/services/canaryIsolationV75Service.js');
const{assertEcBotCoreV78Configuration,resolveEcBotCoreV78Configuration}=await import(R+'/src/services/ecBotCoreOperationalV78Service.js');
const core=resolveEcBotCoreV78Configuration(process.env);assert.equal(core.ready,true);assertCanaryControllerV77Startup(process.env);assertCanaryV75RuntimeConfiguration(process.env);assertEcBotCoreV78Configuration(process.env);
assert.notEqual(fs.readlinkSync('/proc/self/ns/net'),fs.readlinkSync('/proc/1/ns/net'));
assert.equal(globalThis.__VITALISMEN_EC_PRINCIPAL_SDR_V212.canHandle('5515998038637'),true);
assert.equal(globalThis.__VITALISMEN_EC_PRINCIPAL_SDR_V212.canHandle('593999000001'),true);
assert.equal(globalThis.__VITALISMEN_EC_PRINCIPAL_SDR_V212.canHandle('5511999999999'),false);
assert.equal(globalThis.__VITALISMEN_EC_BURST_V228.readPolicy().enabled,true);assert.equal(globalThis.__VITALISMEN_EC_BURST_V228.readPolicy().audience,'ISOLATED_TEST');
assert.equal(globalThis.__VITALISMEN_EC_MEASUREMENT_V213.readPolicy().approved,false);assert.equal(globalThis.__VITALISMEN_EC_CUSTOMER_INVITES_V232.readPolicy().enabled,false);
assert.equal(globalThis.__VITALISMEN_EC_FREEFLOW_V219.canHandle('593999000001'),true);assert.equal(globalThis.__VITALISMEN_EC_FREEFLOW_V219.canHandle('5511999999999'),false);assert.equal(globalThis.__VITALISMEN_EC_WEB_CHAT_V220.requestAllowed({method:'POST',originalUrl:'/api/web-chat/vitpower',headers:{}}),false);
const web=globalThis.__VITALISMEN_EC_WEB_CHAT_V220,DIR='/var/lib/vitalismen-deploy/ec-b01-period-price-v243-r2';
const texReq={method:'POST',originalUrl:'/api/web-chat/vitpower',headers:{origin:'https://plusmen.shop','x-vitalismen-chat-page':'plusmen-tex-v240','x-vitalismen-chat-proxy':fs.readFileSync(DIR+'/tex-web-proxy.secret','utf8')}};
assert.equal(web.requestAllowed(texReq),true);assert.equal(web.productForRequest(texReq),'tex_ultra_ec');
assert.equal(web.requestAllowed({...texReq,headers:{...texReq.headers,origin:'https://invalid.example'}}),false);
assert.equal(web.requestAllowed({...texReq,headers:{...texReq.headers,'x-vitalismen-chat-proxy':'x'.repeat(64)}}),false);
const vitReq={method:'POST',originalUrl:'/api/web-chat/vitpower',headers:{origin:'https://taviazen.shop','x-vitalismen-chat-proxy':fs.readFileSync(DIR+'/web-proxy.secret','utf8')}};
assert.equal(web.requestAllowed(vitReq),true);assert.equal(web.productForRequest(vitReq),'vit_power_ec');
const actualRead=fs.readFileSync;
try{
 fs.readFileSync=function(file,...args){const value=actualRead.call(fs,file,...args);if(String(file)===DIR+'/tex-web-qa-proof.json'){const obj=JSON.parse(String(value));obj.commit='0'.repeat(40);return Buffer.from(JSON.stringify(obj,null,2)+'\\n')}return value};
 assert.equal(web.requestAllowed(texReq),false);
}finally{fs.readFileSync=actualRead}
try{
 fs.readFileSync=function(file,...args){const value=actualRead.call(fs,file,...args);return String(file)===R+'/src/services/texUltraWebFunnelV240Service.js'?Buffer.concat([Buffer.from(value),Buffer.from('//altered fixture')]):value};
 assert.equal(web.requestAllowed(texReq),false);
}finally{fs.readFileSync=actualRead}
assert.equal(web.requestAllowed(texReq),true);

console.log('V213_STARTUP_CONFIG=PASS; INHERITED_SDR_PROOF=VERIFIED; MEASUREMENT=DISABLED; SERVER_STARTED=NO');
"""
try:
 live={**base,**a['profiles']['botLive'],'NODE_OPTIONS':'','npm_config_node_options':'','pm_exec_path':'/opt/vitalismen-automacao/current/src/index.js'}
 code,out,err=run(['unshare','--mount','--net','--fork','bash','-c',shell],environment=live,input=probe,timeout=120)
 (B/'STARTUP_CONFIG.log').write_text(out+'\n'+err);results.append({'name':'isolated_startup_and_qa_gate','pass':code==0 and 'V213_STARTUP_CONFIG=PASS' in out,'exitCode':code,'tail':(out+err)[-1000:],'pm2LauncherSimulated':True,'serverStarted':False})
finally:
 assert D.resolve().parent==pathlib.Path('/tmp') and D.name.startswith('vitalismen-v212-startup-');shutil.rmtree(D)
legacy='set -eu\nmount --make-rprivate /\nfor folder in /opt/vitalismen-automacao /opt/maxlien-mvp /root/wa_wpp; do if test -d "$folder"; then mount --bind "$folder" "$folder"; mount -o remount,bind,ro "$folder"; fi; done\ncd /root/wa_wpp\nexec npm run senior:check\n'
code,out,err=run(['unshare','--mount','--net','--fork','bash','-c',legacy],environment={'PATH':'/usr/bin:/bin','NODE_OPTIONS':'','npm_config_node_options':''},timeout=90)
(B/'LEGACY_SENIOR.log').write_text(out+'\n'+err);results.append({'name':'legacy_senior_readonly','pass':code==0,'exitCode':code,'tail':(out+err)[-1000:]})
result={'project':'VITALISMEN_EC','status':'PASS' if all(x['pass'] for x in results) else 'FAIL','results':results,'activeReleaseUnchanged':pathlib.Path('/opt/vitalismen-automacao/current').resolve()==P,'productionDatabaseWrites':0,'whatsappSends':0}
(B/'EXTRA_QUALIFICATION.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
'''
p=subprocess.run(['ssh','-o','HostName=72.60.137.77','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=12','maxlien-vps-ec','python3 -I -B -S -'],input=remote,capture_output=True,text=True,encoding='utf-8',timeout=550)
assert p.returncode==0,'QUALIFICATION_WRAPPER_FAILED'
r=json.loads(p.stdout);(E/'EXTRA_QUALIFICATION.json').write_text(json.dumps(r,indent=2)+'\n',encoding='utf-8');print(json.dumps(r,indent=2))
