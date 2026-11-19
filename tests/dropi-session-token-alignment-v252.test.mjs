import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const source=fs.readFileSync(new URL('../src/services/droppiEcuadorBrowserService.js',import.meta.url),'utf8');
const begin=source.indexOf('const alignValidatedDropiSessionTokenV252 ='),end=source.indexOf('const performOfficialBffLogin =',begin);
assert.ok(begin>=0&&end>begin);
const factory=new Function('getDropiBrowserAuth','isUnexpiredDropiToken','dropiAccountIdentityIsPresent','sameDropiAccountIdentity','isFinalDropiLoginResult',source.slice(begin,end)+'\nreturn alignValidatedDropiSessionTokenV252;');
const build=(auth)=>{const writes=[];return{writes,run:factory(async()=>auth,token=>token==='valid-new'||token==='valid-old',login=>Boolean(login?.objects?.id),(a,b)=>a.objects.id===b.objects.id,login=>login.token!=='2FA'&&login.token.startsWith('valid-')),page:{evaluate:async(fn,value)=>writes.push(value)}}};
const auth=()=>({token:'valid-new',loginResult:{token:'valid-old',isSuccess:true,objects:{id:52},cities:[{id:1}],configurations:[{country:'ECUADOR'}]}});
test('aligns only the refreshed token while preserving account, country and geography',async()=>{
 const value=auth(),state=build(value);assert.equal(await state.run(state.page,value.loginResult),true);
 assert.equal(state.writes.length,1);assert.deepEqual(state.writes[0],{...value.loginResult,token:'valid-new'});assert.equal(value.loginResult.token,'valid-old');
});
test('matching token is idempotent and does not rewrite storage',async()=>{const value=auth();value.loginResult.token=value.token;const state=build(value);assert.equal(await state.run(state.page,value.loginResult),false);assert.equal(state.writes.length,0)});
test('even matching tokens cannot replace a different account identity',async()=>{const value=auth();value.loginResult.token=value.token;const state=build(value);await assert.rejects(state.run(state.page,{objects:{id:99}}),/ACCOUNT_IDENTITY_MISMATCH/);assert.equal(state.writes.length,0)});
test('expired or missing token never updates the saved login',async()=>{for(const token of ['expired','']){const value=auth();value.token=token;const state=build(value);await assert.rejects(state.run(state.page,value.loginResult),/ACCOUNT_IDENTITY_MISMATCH/);assert.equal(state.writes.length,0)}});
test('alignment is reachable only after the existing authenticated API probe succeeds',()=>{
 assert.match(source,/if \(storedProbe\.ok\) \{\s+await alignValidatedDropiSessionTokenV252\(page, expectedLoginResult\)/);
 assert.match(source,/if \(!finalProbe\.ok\) throw new Error\(`DROPI_AUTH_FAILED BFF_HTTP_\$\{finalProbe.status \|\| 0\}`\);\s+await alignValidatedDropiSessionTokenV252\(page, expectedLoginResult\)/);
 assert.match(source,/if \(!dropiAccountIdentityIsPresent\(expectedLoginResult\) && dropiAccountIdentityIsPresent\(pageLoginResult\)\)/);
});
