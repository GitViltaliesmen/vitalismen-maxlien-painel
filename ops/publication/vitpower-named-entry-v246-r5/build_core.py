from pathlib import Path
import json,hashlib,re
H=Path(__file__).resolve().parent;C=H/'candidate';D=H/'root-candidate';D.mkdir(exist_ok=True)
p=json.loads((H/'official/PREPARED.json').read_bytes())
STATE='ec-b01-named-entry-v246-r5';PROFILE='ec-b01-named-entry-profile-v246-r5.mjs';ENGINE='ec-b01-named-entry-sealed-v246-r5.mjs'
OLD_PROFILE='ec-tex-entry-invites-profile-v246-r2.mjs';OLD_ENGINE='ec-tex-entry-invites-sealed-v246-r2.mjs'
REG='b01NamedEntryRegistrationV246R5';OLD_REG='texEntryInvitesRegistrationV246'
def once(s,a,b):
 assert s.count(a)==1,(a[:100],s.count(a))
 return s.replace(a,b)
for n in ['scripts/lib/sealed-successor-preload-v1.mjs','scripts/lib/pm2-target-env-restart-v78-r4.mjs']:
 s=(H/'official'/n).read_text(encoding='utf-8').replace(OLD_PROFILE,PROFILE).replace(OLD_ENGINE,ENGINE).replace(OLD_REG,REG)
 (C/n).write_text(s,encoding='utf-8',newline='\n')
contractName='docs/freeze/vitpower-named-entry-v246-contract.json';(C/contractName).parent.mkdir(parents=True,exist_ok=True)
allowed=sorted(set([f.relative_to(C).as_posix()for f in C.rglob('*')if f.is_file()]+[contractName]))
contract={'project':'VITALISMEN_EC','parentCommit':p['commit'],'allowedDelta':allowed,'scope':'Recognize a terminal first-name field on the same line as an otherwise exact generic Vit Power entry. Route a verified fresh generic first message to B01 before burst grouping; ordinary contacts require exactly one persisted official inbound, while exact QA requires the native initial claim. Never synthesize VSL attribution. Preserve specific-question priority, period audio, all prices, B01 order, native finite QA permits, attempt/fingerprint/semantic identities, history, retries, other product routes, attribution and integrations. QA test preparation must distinguish an expired prior Hola from a new controlled first entry without deleting ledgers.','productionDatabaseMigration':False,'automaticRetryAuthorized':False,'oldLedgerDeletionAuthorized':False,'historicalMessagesReplayed':False,'nativePermitStillRequired':True}
(C/contractName).write_text(json.dumps(contract,indent=2)+'\n',encoding='utf-8',newline='\n')
hashes={n:hashlib.sha256((C/n).read_bytes()).hexdigest()for n in allowed};assert len(hashes)==8

s=(H/'official/deploy-profile.mjs').read_text(encoding='utf-8')
PREG='texEntryInvitesRegistrationV246';PPROFILE='ec-tex-entry-invites-profile-v246-r2.mjs';PENGINE='ec-tex-entry-invites-sealed-v246-r2.mjs';PSTATE='ec-tex-entry-invites-v246-r2'
parentImport="import{qaB01CycleRegistrationV244R8 as parentRegistration}from'/usr/local/lib/vitalismen-deploy/ec-qa-b01-cycle-profile-v244-r8.mjs';"
s=once(s,parentImport,'__PARENT_IMPORT__')
s=s.replace(PSTATE,STATE).replace(PPROFILE,PROFILE).replace(PENGINE,ENGINE).replace(PREG,REG)
s=once(s,'__PARENT_IMPORT__',"import{"+PREG+" as parentRegistration}from'/usr/local/lib/vitalismen-deploy/"+PPROFILE+"';")
s=re.sub(r"const ENTRY_PARENT=.*?;",f"const ENTRY_PARENT='{p['release']}',ENTRY_PARENT_COMMIT='{p['commit']}',ENTRY_PARENT_TREE='{p['tree']}',ENTRY_PARENT_SEAL='{p['seal']}';",s,count=1)
s=re.sub(r'const HASHES=Object.freeze\(.*?\);','const HASHES=Object.freeze('+json.dumps(hashes,separators=(',',':'))+');',s,count=1)
s=s.replace('HUMAN_APPROVED_EC_TEX_ENTRY_INVITES_V246','HUMAN_APPROVED_EC_B01_NAMED_ENTRY_V246_R5').replace('EC_TEX_ENTRY_INVITES_V246','EC_B01_NAMED_ENTRY_V246_R5').replace('USER_20261118_TEX_ENTRY_RECOGNITION_AND_NO_VITPOWER_INVITES_TO_TEX','USER_20261118_RESTORE_INITIAL_FUNNEL_WITH_INLINE_NAME_PRODUCT_ISOLATION')
s=once(s,"a.parentApprovalSha256,sha(regular('/var/lib/vitalismen-deploy/ec-qa-b01-cycle-v244-r8/approval.json'))","a.parentApprovalSha256,sha(regular('/var/lib/vitalismen-deploy/ec-tex-entry-invites-v246-r2/approval.json'))")
(D/PROFILE).write_text(s,encoding='utf-8',newline='\n')
s=(H/'official/deploy-engine.mjs').read_text(encoding='utf-8')
parentImport="import{"+PREG+"}from'/usr/local/lib/vitalismen-deploy/"+PPROFILE+"';"
s=once(s,parentImport,'__PARENT_IMPORT__');s=s.replace(PPROFILE,PROFILE).replace(PENGINE,ENGINE)
s=once(s,'__PARENT_IMPORT__',parentImport+"\nimport{"+REG+"}from'/usr/local/lib/vitalismen-deploy/"+PROFILE+"';")
s=once(s,'const isEcTexEntry=sealed=>sealed.envelope.PURPOSE===EC_TEX_ENTRY.purpose;',f"const EC_NAMED=Object.freeze({{...{REG}(),successor:{REG}().commit}});\nconst isEcNamed=sealed=>sealed.envelope.PURPOSE===EC_NAMED.purpose;\nconst isEcTexEntry=sealed=>sealed.envelope.PURPOSE===EC_TEX_ENTRY.purpose||isEcNamed(sealed);")
assert s.count('EC_TEX_ENTRY.purpose].includes(')==2;s=s.replace('EC_TEX_ENTRY.purpose].includes(','EC_TEX_ENTRY.purpose, EC_NAMED.purpose].includes(')
a=s.index('     } else if(e.PURPOSE===EC_TEX_ENTRY.purpose){');b=s.index('     } else if(e.PURPOSE===EC_QA_CYCLE.purpose){',a)
block=s[a:b].replace('EC_TEX_ENTRY','__NEW__').replace('EC_QA_CYCLE','EC_TEX_ENTRY').replace('__NEW__','EC_NAMED').replace('TEX_ENTRY_INVITES_','B01_NAMED_ENTRY_');s=s[:a]+block+s[a:]
a=s.index('    if(commit===EC_TEX_ENTRY.successor||raw.PURPOSE===EC_TEX_ENTRY.purpose){');b=s.index('    if(commit===EC_QA_CYCLE.successor',a)
block=s[a:b].replace('EC_TEX_ENTRY','__NEW__').replace('EC_QA_CYCLE','EC_TEX_ENTRY').replace('__NEW__','EC_NAMED').replace(PREG+'()',REG+'()').replace('TEX_ENTRY_INVITES_','B01_NAMED_ENTRY_');s=s[:a]+block+s[a:]
s=once(s,"assert.equal(depth,0,'TEX_ENTRY_INVITES_REUSE_FORBIDDEN')","assert(depth===0||depth===1&&commit===EC_NAMED.parentCommit,'TEX_ENTRY_INVITES_REUSE_FORBIDDEN')")
s=once(s,"assert(depth===0||depth===1&&commit===EC_TEX_ENTRY.parentCommit,'QA_B01_CYCLE_REUSE_FORBIDDEN')","assert(depth===0||[1,2].includes(depth)&&commit===EC_TEX_ENTRY.parentCommit,'QA_B01_CYCLE_REUSE_FORBIDDEN')")
s=once(s,"assert(depth===0||[1,2].includes(depth)&&commit===EC_QA_CYCLE.parentCommit,'TEX_MEASUREMENT_REUSE_FORBIDDEN')","assert(depth===0||[1,2,3].includes(depth)&&commit===EC_QA_CYCLE.parentCommit,'TEX_MEASUREMENT_REUSE_FORBIDDEN')")
s=once(s,'const parent = raw.PURPOSE===EC_TEX_ENTRY.purpose ?','const parent = raw.PURPOSE===EC_NAMED.purpose ? registryEnvelope(EC_TEX_ENTRY.successor)\n        : raw.PURPOSE===EC_TEX_ENTRY.purpose ?')
s=once(s,'    const texEntryParent=isEcTexEntry(sealed)?','    const namedParent=isEcNamed(sealed)?requireSealedRelease(EC_TEX_ENTRY.release):null;\n    const texEntryParent=isEcTexEntry(sealed)?')
s=once(s,'(isEcTexEntry(sealed)?EC_TEX_ENTRY.hashes[file]:null)','(isEcNamed(sealed)?EC_NAMED.hashes[file]:null)||(isEcTexEntry(sealed)?EC_TEX_ENTRY.hashes[file]:null)')
s=once(s,'...(texEntryParent?texEntryParent.authority.ALLOWED_DELTA:[])','...(namedParent?namedParent.authority.ALLOWED_DELTA:[]), ...(texEntryParent?texEntryParent.authority.ALLOWED_DELTA:[])')
a=s.index('                if(isEcTexEntry(sealed)){');b=s.index('                if(isEcQaCycle(sealed)){',a)
block=s[a:b].replace('isEcTexEntry','isEcNamed').replace('EC_TEX_ENTRY','__NEW__').replace('EC_QA_CYCLE','EC_TEX_ENTRY').replace('__NEW__','EC_NAMED').replace('TEX_ENTRY_INVITES_','B01_NAMED_ENTRY_');s=s[:a]+block+s[a:]
(D/ENGINE).write_text(s,encoding='utf-8',newline='\n')
(H/'AUTHORITY_BUILD.json').write_text(json.dumps({'project':'VITALISMEN_EC','parent':{k:p[k]for k in ['release','commit','tree','seal']},'files':{n:n for n in hashes},'hashes':hashes,'rootFiles':[ENGINE,PROFILE],'globalDataBackupPass':False},indent=2)+'\n',encoding='utf-8',newline='\n')
print('NAMED_ENTRY_AUTHORITY_BUILT_NOT_PUBLISHED')
