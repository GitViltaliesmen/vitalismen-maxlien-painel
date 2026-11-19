import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'docs/freeze/plusmen-tex-device-split-20261117.json'), 'utf8'));
assert.equal(manifest.project, 'VITALISMEN_EC');
assert.equal(manifest.freezeId, 'PLUSMEN_TEX_DEVICE_SPLIT_APPROVED_20261117');
assert.equal(manifest.status, 'FROZEN_OPERATOR_VISUAL_APPROVAL');
assert.equal(manifest.officialUrl, 'https://plusmen.shop/tex');
assert.equal(manifest.product.key, 'tex_ultra_ec');
assert.equal(manifest.whatsapp.destination, '553171862958');
assert.equal(manifest.player.id, '6aafe87d665f0c5b457748ad');
assert.equal(manifest.player.ctaStartSeconds, 2257);
assert.equal(manifest.player.turbo, 1.2);
assert.equal(manifest.operatorApproval.mobileVslVisuallyConfirmed, true);
assert.equal(manifest.operatorApproval.desktopInformativeVisuallyConfirmed, true);
const chatFile = path.join(root, 'docs/freeze/plusmen-tex-chat-v240-publication-20261117.json');
const chat = fs.existsSync(chatFile) ? JSON.parse(fs.readFileSync(chatFile, 'utf8')) : null;
if (chat) {
  assert.equal(chat.project, 'VITALISMEN_EC');
  assert.equal(chat.status, 'PUBLIC_VERIFIED');
  assert.equal(chat.backendCommit, '30ca9d6f77788186ada1ca7ab2a8cd0962f773b9');
  assert.equal(chat.parentFreezeSha256, createHash('sha256').update(fs.readFileSync(path.join(root, 'docs/freeze/plusmen-tex-device-split-20261117.json'))).digest('hex'));
  assert.deepEqual(Object.keys(chat.configChanges).sort(), ['/etc/nginx/sites-available/plusmen.shop', '/etc/nginx/snippets/plusmen-tex-mobile-v1.conf'].sort());
  assert.equal(chat.configChanges['/etc/nginx/sites-available/plusmen.shop'].additionBase64, Buffer.from('    # BEGIN TEX ULTRA WEB CHAT V240\n    include /etc/nginx/snippets/plusmen-tex-chat-proxy-v240.conf;\n    # END TEX ULTRA WEB CHAT V240\n\n').toString('base64'));
  assert.equal(chat.configChanges['/etc/nginx/snippets/plusmen-tex-mobile-v1.conf'].additionBase64, Buffer.from('include /etc/nginx/snippets/plusmen-tex-chat-inject-v240.conf;\n').toString('base64'));
  assert.deepEqual(Object.keys(chat.newFiles).sort(), ['/etc/nginx/snippets/plusmen-tex-chat-proxy-v240.conf', '/etc/nginx/snippets/plusmen-tex-chat-inject-v240.conf', '/var/www/plusmen-tex-vsl-v1/assets/chat-tex-ultra.js', '/var/www/plusmen-tex-vsl-v1/assets/chat-tex-ultra.css'].sort());
}

const linkedPath = path.join(root, 'docs/freeze/plusmen-tex-linked-entry-v242-20261117.json');
const linked = fs.existsSync(linkedPath) ? JSON.parse(fs.readFileSync(linkedPath, 'utf8')) : null;
if (linked) {
  assert.ok(chat); assert.equal(linked.project, 'VITALISMEN_EC');
  assert.equal(linked.status, 'AUTHORIZED_EXACT_SUCCESSOR');
  assert.equal(linked.authorization, 'USER_20261117_SAME_TEX_BLOCK_FIRST_CHANNEL_NAME_AND_CONFIRMED_WHATSAPP');
  assert.equal(linked.backendCommit, '4c47bb36266d919ce664911aafcf573c7a4d1570');
  assert.equal(linked.parentDeviceFreezeSha256, createHash('sha256').update(fs.readFileSync(path.join(root, 'docs/freeze/plusmen-tex-device-split-20261117.json'))).digest('hex'));
  assert.equal(linked.parentChatFreezeSha256, createHash('sha256').update(fs.readFileSync(chatFile)).digest('hex'));
  const base = '/var/www/plusmen-tex-vsl-v1/assets/';
  assert.deepEqual(Object.keys(linked.replacedFiles).sort(), [base+'chat-tex-ultra.css', base+'chat-tex-ultra.js']);
  assert.deepEqual(Object.keys(linked.files).sort(), [base+'chat-tex-ultra.css', base+'chat-tex-ultra.js', base+'tex-entry-v242/bottle.png', base+'tex-entry-v242/intro.mp3', base+'tex-entry-v242/proof.jpeg']);
  for (const [name, record] of Object.entries(linked.replacedFiles)) assert.equal(record.sha256, chat.newFiles[name].sha256);
  for (const record of Object.values(linked.files)) { assert.match(record.sha256, /^[a-f0-9]{64}$/); assert.equal(record.mode, 0o644); }
  assert.equal(linked.nativeVslPlayerCtaPhoneUnchanged, true);
}

const measurementPath=path.join(root,'docs/freeze/plusmen-tex-measurement-v243-20261117.json');
const measurement=fs.existsSync(measurementPath)?JSON.parse(fs.readFileSync(measurementPath,'utf8')):null;
if(measurement){
 assert.equal(measurement.project,'VITALISMEN_EC');assert.equal(measurement.status,'AUTHORIZED_EXACT_SUCCESSOR');assert.equal(measurement.version,243);
 assert.equal(measurement.authorization,'USER_20261117_FULL_TEX_MEASUREMENT_AND_ISOLATED_DEPENDENCY_MAINTENANCE');assert.equal(measurement.pixelId,'1100892582698669');assert.equal(measurement.phone,'553171862958');
 assert.equal(measurement.parentDeviceFreezeSha256,createHash('sha256').update(fs.readFileSync(path.join(root,'docs/freeze/plusmen-tex-device-split-20261117.json'))).digest('hex'));
 assert.equal(measurement.parentLinkedFreezeSha256,createHash('sha256').update(fs.readFileSync(linkedPath)).digest('hex'));
 assert.deepEqual(Object.keys(measurement.changes).sort(),["/etc/nginx/sites-available/plusmen.shop", "/var/www/plusmen-tex-vsl-v1/assets/chat-tex-ultra.js", "/var/www/plusmen-tex-vsl-v1/index.html"]);
 assert.equal(createHash('sha256').update(Buffer.from(measurement.inverse.nginxAdditionBase64,'base64')).digest('hex'),'3ced7a9d32544495cc5a78b1b91d278ec39b8a1648a1171cfa4ae3a5eed14827');
 assert.equal(createHash('sha256').update(Buffer.from(measurement.inverse.whatsappAdditionBase64,'base64')).digest('hex'),'41f0419c160964c441f70096e7f4716ebe7f9cb054355a1ade790edca04c0787');
 assert.equal(measurement.inverse.chatAddition," measurementRef: window.TexUltraMeasurementV243?.reference?.() || '',");
 assert.deepEqual(Object.keys(measurement.newFiles),['/var/www/plusmen-tex-vsl-v1/assets/meta-tex-ultra.js','/var/www/plusmen-tex-vsl-v1/assets/whatsapp-tex-v243.js']);
}

const chatGatePath=path.join(root,'docs/freeze/plusmen-tex-chat-cta-v244-20261117.json');
const chatGate=fs.existsSync(chatGatePath)?JSON.parse(fs.readFileSync(chatGatePath,'utf8')):null;
if(chatGate){
 assert.equal(chatGate.project,'VITALISMEN_EC');assert.equal(chatGate.version,244);assert.equal(chatGate.status,'AUTHORIZED_EXACT_SUCCESSOR');
 assert.equal(chatGate.authorization,'USER_20261117_CHAT_ONLY_WITH_NATIVE_WHATSAPP_CTA');
 assert.equal(chatGate.path,'/var/www/plusmen-tex-vsl-v1/assets/chat-tex-ultra.js');assert.equal(chatGate.beforeSha256,'e5a2c9b4816c46883acd4db5d8bb1ee0218748ed9fb0d58bafc81d5c8dfbdb0b');
 assert.equal(chatGate.parentMeasurementFreezeSha256,createHash('sha256').update(fs.readFileSync(measurementPath)).digest('hex'));
 assert.equal(chatGate.nativeButton,'preco_89');assert.equal(chatGate.player,'6aafe87d665f0c5b457748ad');assert.equal(chatGate.mode,0o644);
 assert.equal(createHash('sha256').update(JSON.stringify(chatGate.patches)).digest('hex'),'828f669db69561429531b2194459fffc49d81284f87e3381c3dba71259575120');
}

const cleanWhatsAppPath=path.join(root,'docs/freeze/plusmen-tex-whatsapp-clean-v245-20261117.json');
const cleanWhatsApp=fs.existsSync(cleanWhatsAppPath)?JSON.parse(fs.readFileSync(cleanWhatsAppPath,'utf8')):null;
if(cleanWhatsApp){
 assert.equal(cleanWhatsApp.project,'VITALISMEN_EC');assert.equal(cleanWhatsApp.version,245);assert.equal(cleanWhatsApp.status,'AUTHORIZED_EXACT_SUCCESSOR');
 assert.equal(cleanWhatsApp.authorization,'USER_20261117_REMOVE_VISIBLE_TX243_REFERENCE_FROM_WHATSAPP');assert.equal(cleanWhatsApp.path,'/var/www/plusmen-tex-vsl-v1/assets/whatsapp-tex-v243.js');
 assert.equal(cleanWhatsApp.beforeSha256,'86278207e6135ccf65a45f172457c88f551ce352ec44b4cd771c26ef23355fb3');assert.equal(cleanWhatsApp.sha256,'de67f978c52f7676d666bb22f2175cf72baa283f13fa47f7424d3a5262c35fcd');
 assert.equal(cleanWhatsApp.phone,'553171862958');assert.equal(cleanWhatsApp.visibleMessage,'Hola, quiero el tratamiento Tex Ultra.');
 assert.equal(cleanWhatsApp.parentTotalFreezeSha256,createHash('sha256').update(fs.readFileSync(path.join(root,'docs/freeze/vitalismen-ec-total-aprovado-v244-20261117.json'))).digest('hex'));
 assert.equal(cleanWhatsApp.parentMeasurementFreezeSha256,createHash('sha256').update(fs.readFileSync(measurementPath)).digest('hex'));
 assert.equal(createHash('sha256').update(JSON.stringify(cleanWhatsApp.patches)).digest('hex'),'8a524fdb6a6856e1a4b6199d978536a52b68020ddd472594fe71b2fe894c3541');
}

const ctaUiPath=path.join(root,'docs/freeze/tex-cta-qa-panel-v248-20261118.json');
const ctaUi=fs.existsSync(ctaUiPath)?JSON.parse(fs.readFileSync(ctaUiPath,'utf8')):null;
if(ctaUi){
 assert.equal(ctaUi.project,'VITALISMEN_EC');assert.equal(ctaUi.version,248);assert.equal(ctaUi.status,'AUTHORIZED_EXACT_SUCCESSOR');
 assert.equal(ctaUi.authorization,'USER_20261118_SIMPLIFY_WHATSAPP_CTA_FIX_QA_EMPTY_STATUS_TEST_PUBLISH_FREEZE');
 assert.equal(ctaUi.parentWhatsappFreezeSha256,createHash('sha256').update(fs.readFileSync(cleanWhatsAppPath)).digest('hex'));
 assert.equal(ctaUi.cta.path,'/var/www/plusmen-tex-vsl-v1/assets/whatsapp-tex-v243.js');
 assert.equal(ctaUi.cta.beforeSha256,'de67f978c52f7676d666bb22f2175cf72baa283f13fa47f7424d3a5262c35fcd');
 assert.equal(ctaUi.cta.sha256,'deeeb05d598b697762d352f1c47d91d0ed850e57a81a3f4ee70e37118bbdddc7');
 assert.equal(createHash('sha256').update(Buffer.from(ctaUi.cta.addonBase64,'base64')).digest('hex'),'42f5867800295c7f5f593119fa98d612f3e652491b4761effa222730c82f846f');
}

const checkout250Path = path.join(root, 'docs/freeze/tex-checkout-v250-20261118.json');
const checkout250Bytes = fs.readFileSync(checkout250Path);
assert.equal(createHash('sha256').update(checkout250Bytes).digest('hex'), 'd6cc2a6c00fa4faa01851ed01a87813abe1b86812a1e652b0cdec6d35c635747');
const checkout250 = JSON.parse(checkout250Bytes);
assert.equal(checkout250.project, 'VITALISMEN_EC');
assert.equal(checkout250.version, 250);

const ownedPaths = [
  '/etc/nginx/sites-available/plusmen.shop',
  '/etc/nginx/snippets/plusmen-tex-mobile-v1.conf',
  '/var/www/plusmen-tex-vsl-v1/index.html',
  '/var/www/plusmen-tex-vsl-v1/assets/whatsapp.js'
];
const desktopPaths = ['public/verdevibe/dist/index.html', 'public/verdevibe/dist/assets/index-YfNAnfMa.js'];
assert.deepEqual(Object.keys(manifest.frozenFiles).sort(), [...ownedPaths].sort());
assert.deepEqual(Object.keys(manifest.frozenDesktopFiles).sort(), [...desktopPaths].sort());
const files = {};
for (const file of ownedPaths) files[file] = manifest.frozenFiles[file].sha256;
for (const file of desktopPaths) files['/opt/cloaker/' + file] = manifest.frozenDesktopFiles[file].sha256;
for (const value of Object.values(files)) assert.match(value, /^[a-f0-9]{64}$/);
const remote = `import hashlib,json,pathlib,base64,stat
checkout250=json.loads(${JSON.stringify(JSON.stringify(checkout250))})
_read_bytes_v250=pathlib.Path.read_bytes
_changes_v250={r['path']:r for r in checkout250['changes']}
def _read_checked_v250(file):
 data=_read_bytes_v250(file)
 record=_changes_v250.get(str(file))
 if not record:return data
 assert hashlib.sha256(data).hexdigest()==record['sha256'],'V250_CHANGED: '+str(file)
 for patch in reversed(record['patches']):
  old=patch['before'].encode();new=patch['after'].encode()
  assert data.count(new)==1,'V250_PATCH_NOT_EXACT'
  data=data.replace(new,old,1)
 assert hashlib.sha256(data).hexdigest()==record['beforeSha256'],'V250_INVERSE_FAILED'
 return data
pathlib.Path.read_bytes=_read_checked_v250
files=json.loads(${JSON.stringify(JSON.stringify(files))})
chat=json.loads(${JSON.stringify(JSON.stringify(chat))})
linked=json.loads(${JSON.stringify(JSON.stringify(linked))})
measurement=json.loads(${JSON.stringify(JSON.stringify(measurement))})
chatGate=json.loads(${JSON.stringify(JSON.stringify(chatGate))})
def chat_gate_bytes(name,data):
 if not chatGate or name!=chatGate['path']:return data
 assert hashlib.sha256(data).hexdigest()==chatGate['sha256'],'V244_CHAT_FILE_CHANGED'
 for patch in reversed(chatGate['patches']):
  old=base64.b64decode(patch['beforeBase64']);new=base64.b64decode(patch['afterBase64']);assert data.count(new)==1,'V244_PATCH_NOT_EXACT';data=data.replace(new,old,1)
 assert hashlib.sha256(data).hexdigest()==chatGate['beforeSha256'],'V244_INVERSE_FAILED'
 return data

cleanWhatsApp=json.loads(${JSON.stringify(JSON.stringify(cleanWhatsApp))})
ctaUi=json.loads(${JSON.stringify(JSON.stringify(ctaUi))})
def clean_whatsapp_bytes(name,data):
 if ctaUi and name==ctaUi['cta']['path'] and hashlib.sha256(data).hexdigest()==ctaUi['cta']['sha256']:
  suffix=base64.b64decode(ctaUi['cta']['addonBase64']);assert data.endswith(suffix),'V248_SUFFIX_NOT_EXACT';data=data[:-len(suffix)]
  assert hashlib.sha256(data).hexdigest()==ctaUi['cta']['beforeSha256'],'V248_NATIVE_PREFIX_CHANGED'
 if not cleanWhatsApp or name!=cleanWhatsApp['path']:return data
 assert hashlib.sha256(data).hexdigest()==cleanWhatsApp['sha256'],'V245_CLEAN_HANDLER_CHANGED'
 assert data==pathlib.Path('/var/www/plusmen-tex-vsl-v1/assets/whatsapp.js').read_bytes(),'V245_NATIVE_HANDLER_NOT_EXACT'
 for patch in reversed(cleanWhatsApp['patches']):
  before=base64.b64decode(patch['beforeBase64']);after=base64.b64decode(patch['afterBase64']);assert data.count(after)==patch['count'],'V245_PATCH_NOT_EXACT';data=data.replace(after,before)
 assert hashlib.sha256(data).hexdigest()==cleanWhatsApp['beforeSha256'],'V245_INVERSE_FAILED'
 return data

def native_bytes(name,data):
 data=chat_gate_bytes(name,data)
 if not measurement or name not in measurement['changes']:return data
 change=measurement['changes'][name]
 assert hashlib.sha256(data).hexdigest()==change['sha256'],'V243_FILE_CHANGED: '+name
 text=data.decode('utf-8')
 if name=='/etc/nginx/sites-available/plusmen.shop':
  addition=base64.b64decode(measurement['inverse']['nginxAdditionBase64']).decode();assert text.count(addition)==1;text=text.replace(addition,'',1)
 elif name=='/var/www/plusmen-tex-vsl-v1/index.html':
  old='/assets/js/vitpower-meta.js?v=20261013-3';new='/tex-assets/meta-tex-ultra.js?v=20261117-meta-v243-r1';assert text.count(new)==1;text=text.replace(new,old,1)
  old='/tex-assets/whatsapp.js?v=20261117-r1';new='/tex-assets/whatsapp-tex-v243.js?v=20261117-v243';assert text.count(new)==1;text=text.replace(new,old,1)
 elif name=='/var/www/plusmen-tex-vsl-v1/assets/whatsapp.js':
  addition=base64.b64decode(measurement['inverse']['whatsappAdditionBase64']).decode();assert text.count(addition)==1;text=text.replace(addition,'',1).replace('window.location.assign(selectedFallbackUrl)','window.location.assign(fallbackUrl)').replace('window.location.assign(selectedAppUrl)','window.location.assign(appUrl)')
 elif name=='/var/www/plusmen-tex-vsl-v1/assets/chat-tex-ultra.js':
  addition=measurement['inverse']['chatAddition'];assert text.count(addition)==1;text=text.replace(addition,'',1)
 else:raise AssertionError('V243_UNAPPROVED_PATH')
 original=text.encode();assert hashlib.sha256(original).hexdigest()==change['beforeSha256'],'V243_INVERSE_FAILED: '+name
 return original

for name,expected in files.items():
 data=pathlib.Path(name).read_bytes()
 data=native_bytes(name,data)
 if chat and name in chat['configChanges']:
  change=chat['configChanges'][name]
  assert hashlib.sha256(data).hexdigest()==change['sha256'],'CHAT_CONFIG_CHANGED: '+name
  addition=base64.b64decode(change['additionBase64'])
  assert data.count(addition)==1,'CHAT_ADDITION_NOT_EXACT: '+name
  data=data.replace(addition,b'',1)
 actual=hashlib.sha256(data).hexdigest()
 assert actual==expected,'FROZEN_FILE_CHANGED: '+name
if chat:
 effective=dict(chat['newFiles'])
 if linked:effective.update(linked['files'])
 for name,record in effective.items():
  file=pathlib.Path(name);meta=file.lstat()
  assert stat.S_ISREG(meta.st_mode) and meta.st_uid==0 and meta.st_gid==0 and meta.st_nlink==1 and (meta.st_mode&0o777)==record['mode'],'CHAT_FILE_METADATA_CHANGED: '+name
  assert hashlib.sha256(native_bytes(name,file.read_bytes())).hexdigest()==record['sha256'],'CHAT_ASSET_CHANGED: '+name
if measurement:
 for name,record in measurement['newFiles'].items():
  file=pathlib.Path(name);st=file.lstat();assert stat.S_ISREG(st.st_mode) and st.st_uid==0 and st.st_gid==0 and st.st_nlink==1 and (st.st_mode&0o777)==record['mode']
  data=clean_whatsapp_bytes(name,file.read_bytes())
  assert hashlib.sha256(data).hexdigest()==record['sha256'],'V243_NEW_ASSET_CHANGED'
  if name.endswith('/whatsapp-tex-v243.js'):
   text=data.decode();addition=base64.b64decode(measurement['inverse']['whatsappAdditionBase64']).decode();assert text.count(addition)==1
   text=text.replace(addition,'',1).replace('window.location.assign(selectedFallbackUrl)','window.location.assign(fallbackUrl)').replace('window.location.assign(selectedAppUrl)','window.location.assign(appUrl)')
   assert hashlib.sha256(text.encode()).hexdigest()==record['baselineSha256']=='de67f978c52f7676d666bb22f2175cf72baa283f13fa47f7424d3a5262c35fcd','V243_NATIVE_HANDLER_INVERSE_FAILED'
html=pathlib.Path('/var/www/plusmen-tex-vsl-v1/index.html').read_text()
script=pathlib.Path('/var/www/plusmen-tex-vsl-v1/assets/whatsapp.js').read_text()
assert html.count('<vturb-smartplayer ')==1 and 'vid-6aafe87d665f0c5b457748ad' in html,'PLAYER_CHANGED'
assert "var phone = '553171862958';" in script and '5515991418416' not in script,'DESTINATION_CHANGED'
print('PLUSMEN TEX FREEZE: PASS; baseline de 6 arquivos preservado; player e telefone intactos; chat autorizado conferido quando publicado; somente leitura')
`;
const result = spawnSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=12', 'vilaliemen-protocolo-g', 'python3 -'], {
  input: remote, encoding: 'utf8', timeout: 30000, windowsHide: true
});
if (result.error) throw result.error;
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
assert.equal(result.status, 0, 'Freeze Plusmen Tex divergente ou origem indisponível; não publicar nem corrigir automaticamente.');
