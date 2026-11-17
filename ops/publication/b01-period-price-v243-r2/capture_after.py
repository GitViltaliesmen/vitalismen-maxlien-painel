from capture_common import H,E,capture
import json
p=json.loads((H/'PREPARED.json').read_text());R=p['release'];S='/var/lib/vitalismen-deploy/ec-b01-period-price-v243-r2';B='/opt/vitalismen-automacao/backups/b01-period-price-v243-r2-20261117'
assert json.loads((H/'LIVE_AUDIT.json').read_text())['pass']
paths=[R+'/'+n for n in p['hashes']]+[R+'/'+n for n in ['.release-source.json','.env','.staging-complete.json','.publication-complete.json']]
paths += ['/usr/local/lib/vitalismen-deploy/ec-b01-period-price-'+n+'-v243-r2.mjs'for n in ['sealed','profile']]
paths += ['/var/lib/vitalismen-deploy/sealed-successors-v1/'+p[n]+'.json'for n in ['commit','parentCommit']]
paths += [S+'/'+n for n in ['approval.json','activation.json','meta-credential-proof.json','meta-token.secret','proxy-bridge.secret','elevenlabs.secret','web-proxy.secret','web-qa.secret','burst-qa-proof.json','linked-entry-qa-proof.json','tex-web-proxy.secret','tex-web-qa.secret','tex-web-qa-proof.json']]
paths += [B+'/'+n for n in ['operations-controller.py','BINDINGS.json']]
import re
dropin=re.search(r"DROPIN=pathlib.Path\('([^']+)'\)",(H/'operations-controller.py').read_text(encoding='utf-8')).group(1)
paths += [dropin,'/var/www/vitalismen-panel-phonefix-20261108-r1/qr.html']
capture('BOOT_AFTER_V241','72.60.137.77','maxlien-vps-ec',paths)
b=json.loads((H/'PUBLIC_BASELINE.json').read_text());capture('SITE_AFTER_V241','169.58.51.100','vilaliemen-protocolo-g',['/var/www/vitalismen-vitpower-2026g/'+n for n in sorted(set(b['siteHashes'])|set(b['newSitePaths']))])
