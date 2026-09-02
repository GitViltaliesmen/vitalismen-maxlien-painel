await import('./lib/legacy-baseline-attestation-v102-context.mjs');
const { assertLegacyBaselineAttestationV102 } = await import('../src/services/legacyBaselineAttestationV102Service.js');

const result = assertLegacyBaselineAttestationV102();
console.log('LEGACY_BASELINE_ATTESTATION_V102=PASS');
console.log(`MANIFEST_SHA256=${result.manifestSha256}`);
console.log('LEGACY_BASELINE_PROOF=LEGACY_BASELINE_VERIFIED');
console.log('STAGED_SOURCE_CLAIMED=NO');
console.log('IMPLICIT_FALLBACK=NO');
console.log('GUARDS_BYPASSED=NO');
