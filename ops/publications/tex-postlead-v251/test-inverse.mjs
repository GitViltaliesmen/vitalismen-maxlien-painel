import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const here=new URL('.',import.meta.url);
const profile=fs.readFileSync(new URL('root-candidate/ec-tex-postlead-profile-v251-r2.mjs',here),'utf8');
const build=JSON.parse(fs.readFileSync(new URL('AUTHORITY_BUILD.json',here)));
const inverse=JSON.parse(fs.readFileSync(new URL('FEATURE_BUILD.json',here))).inverse;
const start=profile.indexOf('function postLeadParentBytesV251('),end=profile.indexOf('\nfunction inheritedLinkedPayloadV243(',start);
assert.ok(start>0&&end>start);const fn=profile.slice(start,end),hash=b=>createHash('sha256').update(b).digest('hex');
function load(hashes){const scope={Buffer,assert,sha:hash,HASHES:hashes,POSTLEAD_INVERSE_V251:inverse};vm.createContext(scope);vm.runInContext(fn+'\nthis.run=postLeadParentBytesV251;',scope);return scope.run}
const normal=load(build.hashes),checks=[];
for(const name of Object.keys(inverse)){
 const candidate=fs.readFileSync(new URL('candidate/'+name,here)),parent=fs.readFileSync(new URL('official/'+name,here));
 assert.deepEqual(normal(name,candidate),parent);checks.push('exact_parent_bytes_'+name);
 const mutant=Buffer.concat([candidate,Buffer.from('\n// unauthorized widened change\n')]);
 assert.throws(()=>normal(name,mutant));checks.push('altered_payload_rejected_'+name);
 const forged=load({...build.hashes,[name]:hash(mutant)});assert.throws(()=>forged(name,mutant));checks.push('forged_successor_hash_cannot_bypass_parent_bytes_'+name);
}
fs.writeFileSync(new URL('INVERSE_TEST.json',here),JSON.stringify({pass:true,checks,productionWrites:0},null,2)+'\n');console.log(JSON.stringify({pass:true,checks:checks.length}));
