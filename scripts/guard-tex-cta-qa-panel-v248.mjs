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
 panel:{path:'/var/www/vitalismen-panel-phonefix-20261108-r1/qr.html',before:'e2dcc2343466f69a9850fae787b4ea8c29a7cdfac2e8734ed0ac1951fab2e3a3',after:'ecfb29720492931c884b37814fb9dae3a4f5dcc12c7f3845f332f725d31a4e56'}
};
for(const key of ['cta','panel']){assert.equal(m[key].path,fixed[key].path);assert.equal(m[key].beforeSha256,fixed[key].before);assert.equal(m[key].sha256,fixed[key].after);}
assert.equal(m.cta.phone,'553171862958');assert.equal(m.cta.message,'Hola, quiero el tratamiento Tex Ultra.');assert.equal(m.cta.label,'PEDIR TEX ULTRA POR WHATSAPP');
assert.equal(sha(Buffer.from(m.cta.addonBase64,'base64')),'42f5867800295c7f5f593119fa98d612f3e652491b4761effa222730c82f846f');
assert.equal(sha(JSON.stringify(m.panel.patches)),'40c5f13ee644bed438b741f0147d47b8098b51b129b03ac21b662c42dcf74b19');
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
if(process.argv.includes('--production')){
 for(const [key,host] of [['cta','vilaliemen-protocolo-g'],['panel','maxlien-vps-ec']]){
  const code=`import pathlib,hashlib,stat\np=pathlib.Path(${JSON.stringify(m[key].path)})\ns=p.lstat()\nassert stat.S_ISREG(s.st_mode) and s.st_uid==0 and s.st_gid==0 and s.st_nlink==1 and stat.S_IMODE(s.st_mode)==0o644\nassert hashlib.sha256(p.read_bytes()).hexdigest()==${JSON.stringify(m[key].sha256)}\nprint('V248 ${key}: PASS')\n`;
  const args=['-o','BatchMode=yes','-o','ConnectTimeout=10',...(key==='panel'?['-o','HostName=72.60.137.77']:[]),host,'python3 -I -B -S -'];
  const r=spawnSync('ssh',args,{input:code,encoding:'utf8',timeout:25000,windowsHide:true});if(r.stdout)process.stdout.write(r.stdout);assert.equal(r.status,0,r.stderr||'SOURCE_MISMATCH');
 }
 const r=spawnSync(process.execPath,[path.join(root,'scripts/guard-plusmen-tex-freeze.mjs')],{encoding:'utf8',timeout:40000,windowsHide:true});if(r.stdout)process.stdout.write(r.stdout);assert.equal(r.status,0,r.stderr);
}
console.log('TEX CTA / QA PANEL V248: PASS; explicit successor, exact inverse, old baselines preserved.');
