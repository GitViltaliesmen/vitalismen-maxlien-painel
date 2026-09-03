await import('./lib/ec-runtime-successor-v97-context.mjs');
const { assertDropiManualBffRecoveryV98 } = await import('../src/services/dropiManualBffRecoveryV98Service.js');
const result = assertDropiManualBffRecoveryV98();
console.log('DROPI_MANUAL_BFF_RECOVERY_V98=PASS');
console.log(`MANIFEST_SHA256=${result.manifestSha256}`);
console.log('MANUAL_DROPI_ONLY=YES');
console.log('AUTOMATIC_DROPI_SUBMIT=NO');
console.log('FAILURE_REASON=SANITIZED');
console.log('GUARDS_BYPASSED=NO');
