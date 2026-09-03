import { assertEcOperationalGuardContextV97, EC_OPERATIONAL_GUARD_CONTEXT_V97_PARENT_MANIFEST_SHA256 } from '../src/services/ecOperationalGuardContextV97Service.js';
const result = assertEcOperationalGuardContextV97();
console.log('EC_OPERATIONAL_GUARD_CONTEXT_V97=PASS');
console.log(`PARENT_V96_MANIFEST_SHA256=${EC_OPERATIONAL_GUARD_CONTEXT_V97_PARENT_MANIFEST_SHA256}`);
console.log(`MANIFEST_SHA256=${result.manifestSha256}`);
console.log('OPERATIONAL_STRUCTURAL_GUARD=FULL_SUCCESSOR_CONTEXT');
console.log('GUARDS_BYPASSED=NO');
console.log('EXTERNAL_VSL_FILES_CHANGED=NO');
