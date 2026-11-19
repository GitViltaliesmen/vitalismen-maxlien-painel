import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sha=b=>createHash('sha256').update(b).digest('hex');
const param=process.argv.indexOf('--manifest');
const m=JSON.parse(fs.readFileSync(param<0?path.join(root,'docs/freeze/tex-cta-qa-panel-v248-20261118.json'):process.argv[param+1],'utf8'));
assert.equal(m.project,'VITALISMEN_EC');assert.equal(m.version,248);assert.equal(m.status,'AUTHORIZED_EXACT_SUCCESSOR');
assert.equal(m.authorization,'USER_20261118_SIMPLIFY_WHATSAPP_CTA_FIX_QA_EMPTY_STATUS_TEST_PUBLISH_FREEZE');
assert.equal(m.parentSourceCommit,'72c6ab9c0e66e52bb79540ad2cbe7e18af8b6c96');
assert.equal(m.parentWhatsappFreezeSha256,sha(fs.readFileSync(path.join(root,'docs/freeze/plusmen-tex-whatsapp-clean-v245-20261117.json'))));
const fixed={
 cta:{path:'/var/www/plusmen-tex-vsl-v1/assets/whatsapp-tex-v243.js',before:'de67f978c52f7676d666bb22f2175cf72baa283f13fa47f7424d3a5262c35fcd',after:'deeeb05d598b697762d352f1c47d91d0ed850e57a81a3f4ee70e37118bbdddc7'},
 panel:{path:'/var/www/vitalismen-panel-phonefix-20261108-r1/qr.html',before:'e2dcc2343466f69a9850fae787b4ea8c29a7cdfac2e8734ed0ac1951fab2e3a3',after:'3b334f0cc5c8da9840fd257c521cdc828e264a8c4f1a814d190e292640a2f1e2'}
};
for(const key of ['cta','panel']){assert.equal(m[key].path,fixed[key].path);assert.equal(m[key].beforeSha256,fixed[key].before);assert.equal(m[key].sha256,fixed[key].after);}
assert.equal(m.cta.phone,'553171862958');assert.equal(m.cta.message,'Hola, quiero el tratamiento Tex Ultra.');assert.equal(m.cta.label,'PEDIR TEX ULTRA POR WHATSAPP');
assert.equal(sha(Buffer.from(m.cta.addonBase64,'base64')),'42f5867800295c7f5f593119fa98d612f3e652491b4761effa222730c82f846f');
assert.equal(sha(JSON.stringify(m.panel.patches)),'8d31d7a5e9ad892a0bedd84325abbe43e5a6c1479f3c904c6ad601332d070fcc');
const prefix=path.join(root,'ops/publications/tex-cta-qa-panel-v248');
assert.equal(sha(Buffer.concat([Buffer.from('\n'),fs.readFileSync(path.join(prefix,'cta-label.js'))])),m.cta.addonSha256);
assert.equal(sha(fs.readFileSync(path.join(prefix,'qa-panel.js'))),m.panel.helperSha256);
const stage=path.join(root,'ops/candidates/tex-cta-qa-panel-v248-20261118');
if(fs.existsSync(path.join(stage,'built'))){
 for(const [key,name] of [['cta','whatsapp-tex-v243.js'],['panel','qr.html']]){
  let b=fs.readFileSync(path.join(stage,'built',name));assert.equal(sha(b),m[key].sha256);
  if(key==='cta'){const suffix=Buffer.from(m.cta.addonBase64,'base64');assert.ok(b.subarray(-suffix.length).equals(suffix));b=b.subarray(0,-suffix.length);}
  else for(const p of [...m.panel.patches].reverse()){
   const old=Buffer.from(p.beforeBase64,'base64'),next=Buffer.from(p.afterBase64,'base64');const n=b.indexOf(next);assert.ok(n>=0);assert.equal(b.indexOf(next,n+1),-1);b=Buffer.concat([b.subarray(0,n),old,b.subarray(n+next.length)]);
  }
  assert.equal(sha(b),m[key].beforeSha256);
 }
}
const checkout250Bytes=fs.readFileSync(path.join(root,'docs/freeze/tex-checkout-v250-20261118.json'));
assert.equal(sha(checkout250Bytes),'d6cc2a6c00fa4faa01851ed01a87813abe1b86812a1e652b0cdec6d35c635747');
const checkout250=JSON.parse(checkout250Bytes);
const nativeCta250=checkout250.changes.find(record=>record.path===fixed.cta.path);
assert.equal(nativeCta250.beforeSha256,fixed.cta.after);
const panelConcurrentBytes=fs.readFileSync(path.join(root,'docs/freeze/panel-manual-edit-compatibility-v251-20261119.json'));
assert.equal(sha(panelConcurrentBytes),'a344a3a5adaf6592a13ba91f5bf84000fb10cd3aaf8cb283777abd16a613a3f5');
const panelConcurrent=JSON.parse(panelConcurrentBytes);
assert.equal(panelConcurrent.beforeSha256,fixed.panel.after);
const panelConcurrentSecondBytes=fs.readFileSync(path.join(root,'docs/freeze/panel-status-edit-compatibility-v251-20261119.json'));
assert.equal(sha(panelConcurrentSecondBytes),'290521ec67ce96c76553db043fd3e82877cd87e544edfd170009c2a841741c74');
const panelConcurrentSecond=JSON.parse(panelConcurrentSecondBytes);
assert.equal(panelConcurrentSecond.beforeSha256,panelConcurrent.sha256);
const panel252Bytes=fs.readFileSync(path.join(root,'docs/freeze/ec-orders-panel-compatibility-v252-20261119.json'));
assert.equal(sha(panel252Bytes),'d8f66e80c9cd6b93b25588b802f67c0e93614afa2f8b23ecc8d1c3a1be4c4363');
const panel252=JSON.parse(panel252Bytes);assert.equal(panel252.beforeSha256,panelConcurrentSecond.sha256);
const panel253Bytes=fs.readFileSync(path.join(root,'docs/freeze/ec-customer-edit-paquizha-panel-v253-20261119.json'));assert.equal(sha(panel253Bytes),'5951b4c9a204c0913ebfb374680b2364d08bbae40c20e8d2e6b76c1df04d3eea');const panel253=JSON.parse(panel253Bytes);assert.equal(panel253.beforeSha256,panel252.sha256);
if(process.argv.includes('--production')){
 for(const [key,host] of [['cta','vilaliemen-protocolo-g'],['panel','maxlien-vps-ec']]){
  const code=`import pathlib,hashlib,stat,json\np=pathlib.Path(${JSON.stringify(m[key].path)})\ns=p.lstat()\nassert stat.S_ISREG(s.st_mode) and s.st_uid==0 and s.st_gid==0 and s.st_nlink==1 and stat.S_IMODE(s.st_mode)==0o644\ndata=p.read_bytes()\nchanges=json.loads(${JSON.stringify(JSON.stringify(key==='cta'?[nativeCta250]:[panelConcurrentSecond,panelConcurrent]))})\nextra=json.loads(${JSON.stringify(JSON.stringify(panel252))})\nextra253=json.loads(${JSON.stringify(JSON.stringify(panel253))})\nif ${key==='panel'?'True':'False'} and hashlib.sha256(data).hexdigest()==extra253['sha256']:\n changes.insert(0,extra);changes.insert(0,extra253)\nif ${key==='panel'?'True':'False'} and hashlib.sha256(data).hexdigest()==extra['sha256']:changes.insert(0,extra)\nfor change in changes:\n assert hashlib.sha256(data).hexdigest()==change['sha256'],'EXACT_SUCCESSOR_CHANGED'\n for patch in reversed(change['patches']):\n  old=patch['before'].encode();new=patch['after'].encode();assert data.count(new)==1,'SUCCESSOR_PATCH_NOT_EXACT';data=data.replace(new,old,1)\n assert hashlib.sha256(data).hexdigest()==change['beforeSha256'],'SUCCESSOR_INVERSE_FAILED'\nassert hashlib.sha256(data).hexdigest()==${JSON.stringify(m[key].sha256)}\nprint('V248 ${key}: PASS')\n`;
  const args=['-o','BatchMode=yes','-o','ConnectTimeout=10',...(key==='panel'?['-o','HostName=72.60.137.77']:[]),host,'python3 -I -B -S -'];
  const r=spawnSync('ssh',args,{input:code,encoding:'utf8',timeout:25000,windowsHide:true});if(r.stdout)process.stdout.write(r.stdout);assert.equal(r.status,0,r.stderr||'SOURCE_MISMATCH');
 }
 const r=spawnSync(process.execPath,[path.join(root,'scripts/guard-plusmen-tex-freeze.mjs')],{encoding:'utf8',timeout:40000,windowsHide:true});if(r.stdout)process.stdout.write(r.stdout);assert.equal(r.status,0,r.stderr);
}
console.log('TEX CTA / QA PANEL V248: PASS; explicit successor, exact inverse, old baselines preserved.');
