await import('./lib/modern-release-source-validation-v103-context.mjs');
const { assertModernReleaseSourceValidationV103 } = await import('../src/services/modernReleaseSourceValidationV103Service.js');

const result = assertModernReleaseSourceValidationV103();
console.log('MODERN_RELEASE_SOURCE_VALIDATION_V103=PASS');
console.log(`MANIFEST_SHA256=${result.manifestSha256}`);
console.log('MODERN_SOURCE_GIT_DIRECTORY_REQUIRED=NO');
console.log('PUBLISHED_ATTESTATIONS_REQUIRED=YES');
console.log('LEGACY_V102_PRESERVED=YES');
console.log('GUARDS_BYPASSED=NO');
