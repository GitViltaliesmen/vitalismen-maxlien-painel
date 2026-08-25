import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('../src/services/ecEngagementFreezeRuntimeGuardV40.js');

const read = (file) => fs.readFileSync(file, 'utf8');
const packageSource = read('package.json');
const packageJson = JSON.parse(packageSource);
const packageLockSource = read('package-lock.json');
const packageLock = JSON.parse(packageLockSource);
const entryGuard = read('src/services/ecEngagementFreezeRuntimeGuardV40.js');
const manifest = JSON.parse(read('docs/freeze/baileys-libsignal-security-v59-20260824.json'));
const packages = packageLock.packages || {};
const baileys = packages['node_modules/@whiskeysockets/baileys'];
const libsignal = packages['node_modules/@whiskeysockets/baileys/node_modules/libsignal'];
const protobuf = packages['node_modules/protobufjs'];

assert.equal(manifest.status, 'activation_approved');
assert.equal(manifest.policy.dependencySecurityRepair, true);
assert.equal(manifest.policy.directBaileysVersionChanged, false);
assert.equal(manifest.policy.baileysMajorUpgradeAuthorized, false);
assert.equal(manifest.policy.libsignalRuntimeSourceChanged, false);
assert.equal(manifest.policy.officialZapiTransportPreserved, true);
assert.equal(manifest.policy.productionAuditZeroRequired, true);
assert.equal(manifest.policy.realClientSendAuthorized, false);
assert.equal(manifest.policy.automaticDropiAuthorization, false);
assert.equal(manifest.policy.metaPurchaseResendAllowed, false);
assert.equal(manifest.policy.commercialFunnelChanged, false);
assert.equal(packageJson.dependencies['@whiskeysockets/baileys'], '^6.7.21');
assert.equal(
    packageJson.overrides?.libsignal,
    'git+https://github.com/WhiskeySockets/libsignal-node.git#v6.0.0'
);
assert.equal(baileys?.version, '6.7.24');
assert.equal(libsignal?.version, '6.0.0');
assert.match(libsignal?.resolved || '', /bcea72df9ec34d9d9140ab30619cf479c7c144c7$/);
assert.equal(libsignal?.dependencies?.protobufjs, '^7.5.5');
assert.equal(protobuf?.version, '7.6.5');
assert.equal(packages['node_modules/libsignal'], undefined);
assert.equal(
    packages['node_modules/@whiskeysockets/baileys/node_modules/libsignal/node_modules/protobufjs'],
    undefined
);
assert.doesNotMatch(packageLockSource, /1c30d7d7e76a3b0aa120b04dc6a26f5a12dccf67/);
assert.doesNotMatch(packageLockSource, /protobufjs-6\.8\.8\.tgz|"protobufjs":\s*"6\.8\.8"/);
assert.match(entryGuard, /(?:baileysLibsignalSecurityFreezeRuntimeGuardV59|pickupBonusDeliveryFreezeRuntimeGuardV60|metaAttributionFreezeRuntimeGuardV61)\.js/);
assert.match(packageJson.scripts.test, /guard:baileys-security-v59/);
assert.match(packageJson.scripts['senior:check'], /baileys-libsignal-security-v59\.test\.mjs/);
assert.match(packageJson.scripts['guard:baileys-security-v59'], /npm audit --omit=dev --audit-level=moderate/);
assert.match(packageJson.scripts['deploy:v59'], /assert-baileys-libsignal-security-activation-approved-v59\.mjs/);
assert.match(packageJson.scripts['deploy:v59'], /deploy:vps/);

console.log('BAILEYS_LIBSIGNAL_SECURITY_V59_GUARD=OK');
