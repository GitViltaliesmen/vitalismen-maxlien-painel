await import('./lib/ec-runtime-successor-v95-context.mjs');
await import('../src/services/canaryControllerHealthPolicyResetSafetyFreezeRuntimeGuardV77H2.js');

const {
    assertDeployGuardAncestryV91
} = await import('../src/services/deployGuardAncestryV91Service.js');
const result = assertDeployGuardAncestryV91();
if (result.ready !== true || result.helperChangedOnlyForGuardContext !== true) {
    throw new Error('[DEPLOY-GUARD-ANCESTRY-V91] predeploy_readiness_blocked');
}

console.log('PREDEPLOY_SUCCESSOR_CHAIN_V91=PASS');
console.log('ANCESTOR_RUNTIME_CHAIN_V71_TO_V77H2=PASS');
console.log('SUCCESSOR_RUNTIME_CHAIN_V78_TO_V95=PASS');
console.log('GUARDS_BYPASSED=NO');
