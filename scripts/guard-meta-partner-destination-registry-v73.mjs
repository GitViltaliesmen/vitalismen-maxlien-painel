import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

await import('../src/services/canaryControllerHealthPolicyResetSafetyFreezeRuntimeGuardV77H2.js');

const read = (file) => fs.readFileSync(file, 'utf8');
const json = (file) => JSON.parse(read(file));
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const manifestPath = 'docs/freeze/meta-partner-destination-registry-v73-20260828.json';
const parentManifestPath = 'docs/freeze/deploy-helper-v71-chain-alignment-safety-v72-20260827.json';
const manifest = json(manifestPath);
const v74Manifest = json('docs/freeze/freeze-lock-ec-meta-dynamic-v74-20260828.json');
const v75Manifest = json('docs/freeze/canary-isolation-safety-v75-20260828.json');
const v76Manifest = json('docs/freeze/deploy-health-bridge-semantics-v76-20260828.json');
const v77Manifest = json('docs/freeze/canary-controller-safety-v77-20260828.json');
const v77hManifest = json('docs/freeze/canary-controller-pm2-stdin-hotfix-v77h-20260829.json');
const v77h2Manifest = json('docs/freeze/canary-controller-health-policy-reset-v77h2-20260829.json');
const v78Manifest = json('docs/freeze/ec-bot-core-structural-safety-v78-20260829.json');
const packageJson = json('package.json');
const registry = read('src/services/metaDestinationRegistryService.js');
const manager = read('scripts/manage-meta-destinations-v73.mjs');
const seniorGuard = read('scripts/senior-guard.mjs');
const conversions = read('src/services/metaConversionsService.js');
const healthRoute = read('src/routes/health.js');
const leadsRoute = read('src/routes/leads.js');
const whatsappRoute = read('src/routes/whatsapp.js');
const page = read('public/n/index.html');
const architecture = read('docs/ARQUITETURA_AUTOMACAO_OFICIAL.md');
const officialFiles = read('docs/ARQUIVOS_OFICIAIS.md');
const freeze = read('docs/META_PARTNER_DESTINATION_REGISTRY_FREEZE_V73_20260828.md');
const runbook = read('docs/META_PARTNER_ACCOUNT_RUNBOOK_20260828.md');

assert.equal(sha256(parentManifestPath), 'd6f2ea30ebec4365f3df9e99de655e6a4b5dae45dcfa25a085451ad45fd13ffd');
assert.equal(manifest.freezeId, 'meta-partner-destination-registry-v73');
assert.equal(manifest.parentFreezeId, 'deploy-helper-v71-chain-alignment-safety-v72');
assert.equal(manifest.parentManifestSha256, sha256(parentManifestPath));
assert.equal(manifest.policy.featureContractVersion, 73);
assert.equal(manifest.policy.deployHelperFreezeVersion, 72);
assert.equal(manifest.policy.runtimeGuardChainVersion, 71);
assert.equal(manifest.policy.dataCompatibilityVersion, 66);
assert.equal(manifest.policy.browserServerDatasetMustMatch, true);
assert.equal(manifest.policy.partnerPlanUsesActiveProfile, true);
assert.equal(manifest.policy.partnerShareRequiresRuntimeChange, false);
assert.equal(manifest.policy.staleActivationBlocked, true);
assert.equal(manifest.policy.concurrentMutationLock, true);
assert.equal(manifest.policy.registryAndSecretsRoot0600, true);
assert.equal(manifest.policy.publicRegistryUnknownFieldsBlocked, true);
assert.equal(manifest.policy.malformedBindingFailsClosed, true);
assert.equal(manifest.policy.vslEntryBindingPropagation, true);
assert.equal(manifest.policy.publicEndpointUsesExistingNginxProxy, true);
assert.equal(manifest.policy.seniorGuardProtocolExceptionScoped, true);
assert.equal(manifest.policy.metaServerTokenFrontendExposureAllowed, false);
assert.equal(manifest.policy.metaEventValidationAllowed, false);

for (const [file, approvedHash] of Object.entries(manifest.protectedFiles || {})) {
    const actualHash = sha256(file);
    if (
        v74Manifest.declaredAncestorOverrides?.includes(file)
        && v74Manifest.protectedFiles?.[file] === actualHash
    ) continue;
    if (
        v75Manifest.declaredAncestorOverrides?.includes(file)
        && v75Manifest.protectedFiles?.[file] === actualHash
    ) continue;
    if (
        v76Manifest.declaredAncestorOverrides?.includes(file)
        && v76Manifest.protectedFiles?.[file] === actualHash
    ) continue;
    if (
        v77Manifest.declaredAncestorOverrides?.includes(file)
        && v77Manifest.protectedFiles?.[file] === actualHash
    ) continue;
    if (
        v77hManifest.declaredAncestorOverrides?.includes(file)
        && v77hManifest.protectedFiles?.[file] === actualHash
    ) continue;
    if (
        v77h2Manifest.declaredAncestorOverrides?.includes(file)
        && v77h2Manifest.protectedFiles?.[file] === actualHash
    ) continue;
    if (
        v78Manifest.declaredAncestorOverrides?.includes(file)
        && v78Manifest.protectedFiles?.[file] === actualHash
    ) continue;
    assert.equal(actualHash, approvedHash, `arquivo protegido V73 divergente: ${file}`);
}

assert.match(registry, /META_BROWSER_SERVER_DATASET_MISMATCH/);
assert.match(registry, /META_PROTOCOLO_G_DATASET_LOCKED/);
assert.match(registry, /META_DESTINATION_TOKEN_MISSING/);
assert.match(registry, /META_DESTINATION_REGISTRY_MISSING/);
assert.match(registry, /META_DESTINATION_SCHEMA_UNKNOWN_FIELD/);
assert.match(registry, /META_DESTINATION_SECRETS_PATH_INVALID/);
assert.match(registry, /resolveMetaDestinationProfile/);
assert.match(registry, /stat\.mode & 0o077/);
assert.match(registry, /META_DESTINATION_REGISTRY_OWNER/);
assert.match(registry, /source: 'shared_registry'/);
assert.match(manager, /I_UNDERSTAND_META_BROWSER_SERVER_ATOMIC_CHANGE/);
assert.match(manager, /Perfil ativo é imutável/);
assert.match(manager, /Segredo ativo é imutável/);
assert.match(manager, /token em argumento é proibido/i);
assert.match(manager, /SHARE_EXISTING_DATASET_WITH_PARTNER/);
assert.match(manager, /não é o perfil ativo/);
assert.match(manager, /expected-current-profile/);
assert.match(manager, /expected-next-dataset-id/);
assert.match(manager, /\.meta-destination-change\.lock/);
assert.match(manager, /fs\.fsyncSync/);
assert.match(manager, /runtimeChangeRequired: false/);
assert.match(manager, /siteRestartRequired: false/);
assert.match(seniorGuard, /'src\/services\/metaDestinationRegistryService\.js'/);
assert.match(seniorGuard, /'src\/services\/metaPartnerDestinationRegistryFreezeRuntimeGuardV73\.js'/);
assert.match(conversions, /resolveMetaDestination/);
assert.match(conversions, /META_DESTINATION_BINDING_TTL_MS = 6 \* 60 \* 60 \* 1000/);
assert.match(conversions, /createHmac\('sha256'/);
assert.match(conversions, /timingSafeEqual/);
assert.match(conversions, /typeof rawBinding !== 'object'/);
assert.match(healthRoute, /router\.get\('\/meta-destination'/);
assert.match(healthRoute, /Cache-Control', 'no-store, max-age=0'/);
assert.match(page, /\/api\/health\/meta-destination/);
assert.match(page, /destination\.browserServerSynchronized/);
assert.match(page, /destination\.bindingVersion/);
assert.match(page, /meta_destination/);
assert.match(page, /Promise\.resolve\(metaReady\)/);
assert.match(page, /Browser Pixel bloqueado/);
assert.doesNotMatch(page, /facebook\.com\/tr\?id=/);
assert.doesNotMatch(page, /page_fallback/);
assert.doesNotMatch(page, /META_ACCESS_TOKEN_EC/);
assert.match(leadsRoute, /meta_destination: body\?\.meta_destination \?\? body\?\.metaDestination/);
assert.match(whatsappRoute, /meta_destination: body\.meta_destination \?\? body\.metaDestination/);
assert.match(architecture, /registro único Meta e contas parceiras/i);
assert.match(officialFiles, /Registro V73 — destinos Meta/i);
assert.match(freeze, /Criar um Pixel paralelo apenas para a conta parceira é proibido/);
assert.match(freeze, /binding HMAC opaco/);
assert.match(runbook, /Compartilhar Dataset existente/);
assert.match(packageJson.scripts['guard:predeploy-v71'], /guard:meta-partner-v73/);
assert.equal(
    packageJson.scripts['guard:meta-partner-v73'],
    'node src/services/canaryControllerHealthPolicyResetSafetyFreezeRuntimeGuardV77H2.js && node scripts/guard-meta-partner-destination-registry-v73.mjs && node --test tests/meta-partner-destination-registry-v73.test.mjs'
);

console.log('META_PARTNER_DESTINATION_REGISTRY_V73_STATIC=OK');
console.log('FEATURE_CONTRACT_VERSION=73');
console.log('DEPLOY_HELPER_FREEZE_VERSION=72');
console.log('RUNTIME_GUARD_CHAIN_VERSION=71');
console.log('DATA_COMPATIBILITY_VERSION=66');
console.log('META_EVENT_VALIDATION_ALLOWED=false');
