from capture_common import H,E,capture
import json,subprocess,pathlib,hashlib
p=json.loads((H/'PREPARED.json').read_text());R=p['parentRelease'];S='/var/lib/vitalismen-deploy/ec-tex-entry-invites-v246-r2'
paths=[R+'/'+n for n in p['hashes']if (n.startswith('src/')or n.startswith('scripts/'))and n!='src/services/vitPowerScopedQuestionHistoryV243Service.js']
paths=[n for n in paths if n!=R+'/src/services/vitPowerEntryContextV246Service.js'] # New file has no parent preimage; absence is checked and recorded separately.
paths += ['/usr/local/lib/vitalismen-deploy/ec-tex-entry-invites-'+n+'-v246-r2.mjs'for n in ['sealed','profile']]
paths += [R+'/src/services/ecuadorProductService.js',R+'/public/media/templates/EC/01_A_buenas_noches.ogg',R+'/public/media/templates/EC/01_B_Buenos_dias.ogg',R+'/public/media/templates/EC/01_C_Buenos_tardes.ogg']
paths += [R+'/'+n for n in ['.release-source.json','.env','.staging-complete.json','.publication-complete.json']]
paths += ['/usr/local/lib/vitalismen-deploy/ec-tex-linked-entry-'+n+'-v242-r6.mjs'for n in ['sealed','profile']]
paths += [S+'/'+n for n in ['tex-measurement.secret','tex-measurement-qa-proof.json','approval.json','activation.json','meta-credential-proof.json','meta-token.secret','proxy-bridge.secret','elevenlabs.secret','web-proxy.secret','web-qa.secret','burst-qa-proof.json','linked-entry-qa-proof.json','tex-web-proxy.secret','tex-web-qa.secret','tex-web-qa-proof.json']]
paths += ['/var/lib/vitalismen-deploy/sealed-successors-v1/'+p['parentCommit']+'.json']
paths += ['/usr/local/lib/vitalismen-deploy/ec-tex-measurement-profile-v243-r5.mjs','/usr/local/lib/vitalismen-deploy/ec-tex-measurement-sealed-v243-r5.mjs','/var/lib/vitalismen-deploy/sealed-successors-v1/'+p['parentCommit']+'.json.sha256']
paths += ['/usr/local/lib/vitalismen-deploy/ec-tex-entry-invites-profile-v246-r2.mjs','/usr/local/lib/vitalismen-deploy/ec-qa-b01-cycle-sealed-v244-r8.mjs']
paths += ['/var/www/vitalismen-panel-phonefix-20261108-r1/qr.html']
capture('BOOT_BEFORE_V241','72.60.137.77','maxlien-vps-ec',paths)
capture('SITE_BEFORE_V241','169.58.51.100','vilaliemen-protocolo-g',['/var/www/vitalismen-vitpower-2026g/'+n for n in ['assets/cta.js','assets/chat-v220.js','assets/chat-v220.css','index.html','desktop.html']])
for name in ['RUNTIME_CONFIG.vbe','PRIVATE_CONFIG_CAPTURE.json']:
 target=E/name;assert not target.exists()
 with target.open('xb')as out:r=subprocess.run(['ssh','-o','HostName=72.60.137.77','-o','BatchMode=yes','maxlien-vps-ec','cat /opt/vitalismen-automacao/backups/vitpower-named-entry-v246-r5-20261118/'+name],stdout=out,stderr=subprocess.PIPE)
 assert r.returncode==0
print('ENCRYPTED_RUNTIME_COPIED')
