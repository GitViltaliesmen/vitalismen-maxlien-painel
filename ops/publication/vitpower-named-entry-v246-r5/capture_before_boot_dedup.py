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
paths=list(dict.fromkeys(paths))
capture('BOOT_BEFORE_V246_R5','72.60.137.77','maxlien-vps-ec',paths)
print('CURRENT_BOOT_BACKUP_DEDUPLICATED_SCOPE_CAPTURED')
