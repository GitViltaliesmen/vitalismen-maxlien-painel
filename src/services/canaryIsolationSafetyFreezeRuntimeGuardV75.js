import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
    CANARY_V75_QA_PHONE,
    CANARY_V75_RECIPIENT_LIST_FLAGS,
    CANARY_V75_REQUIRED_FALSE_FLAGS,
    CANARY_V75_REQUIRED_TRUE_FLAGS,
    resolveCanaryV75Configuration
} from './canaryIsolationV75Service.js';
import { calculateCanaryControllerV77ProfileSha256 } from './canaryControllerV77Service.js';
import {
    getSuccessorOverrideFiles,
    withSuccessorGuardContext
} from './successorGuardContextService.js';

const root = process.cwd();
const manifestPath = 'docs/freeze/canary-isolation-safety-v75-20260828.json';
const parentManifestPath = 'docs/freeze/freeze-lock-ec-meta-dynamic-v74-20260828.json';
const parentManifestSha256 = 'f220fe972d1a0faa24cca007ff146c7455613b1c4f911fc5a26005e46afb18df';
const declaredAncestorOverrides = [
    'docs/ARQUITETURA_AUTOMACAO_OFICIAL.md',
    'docs/ARQUIVOS_OFICIAIS.md',
    'package.json',
    'scripts/guard-deploy-helper-v71-chain-alignment-safety-v72.mjs',
    'scripts/guard-meta-partner-destination-registry-v73.mjs',
    'scripts/senior-guard.mjs',
    'src/index.js',
    'src/routes/whatsapp.js',
    'src/routes/zapi.js',
    'src/services/agentRouter.js',
    'src/services/droppiEcuadorBrowserService.js',
    'src/services/ecEngagementFreezeRuntimeGuardV40.js',
    'src/services/metaConversionsService.js',
    'src/services/nitrixFastStateService.js',
    'src/services/postSaleNotificationDecisionService.js',
    'src/services/postSalePickupReconciliationService.js',
    'src/services/shipmentMessageService.js',
    'src/services/shipmentStatusDispatcherService.js',
    'src/services/zapiClient.js',
    'src/whatsapp/automationSafety.js',
    'src/whatsapp/connection.js',
    'src/whatsapp/dispatcher.js',
    'src/whatsapp/outboundGuard.js'
];
const newProtectedFiles = [
    'docs/CANARY_ISOLATION_SAFETY_FREEZE_V75_20260828.md',
    'scripts/guard-canary-isolation-v75.mjs',
    'src/services/canaryIsolationSafetyFreezeRuntimeGuardV75.js',
    'src/services/canaryIsolationV75Service.js',
    'tests/canary-isolation-v75.test.mjs'
];

const absolute = (relativePath) => path.join(root, relativePath);
const sha256 = (relativePath) => crypto.createHash('sha256')
    .update(fs.readFileSync(absolute(relativePath)))
    .digest('hex');
const manifest = JSON.parse(fs.readFileSync(absolute(manifestPath), 'utf8'));
const expectedProtectedFiles = [...declaredAncestorOverrides, ...newProtectedFiles].sort();
const protectedFiles = Object.keys(manifest.protectedFiles || {}).sort();

if (
    sha256(parentManifestPath) !== parentManifestSha256
    || manifest.freezeId !== 'canary-isolation-safety-v75'
    || manifest.parentFreezeId !== 'freeze-lock-ec-meta-dynamic-v74'
    || manifest.parentManifestSha256 !== parentManifestSha256
    || manifest.parentV74Commit !== 'c7099bc8e85b028079ad2e2f68600004c7684de2'
    || manifest.parentV74Tree !== '2a052c0f0a5b55020412d584ae7f3d81ea45fce4'
    || manifest.status !== 'implementation_validated'
    || manifest.publicationStatus !== 'local_candidate_no_push_no_stage_no_deploy'
    || manifest.country !== 'EC'
    || manifest.policy?.canonicalRuntimeGuard !== 'node src/services/canaryIsolationSafetyFreezeRuntimeGuardV75.js'
    || manifest.policy?.contractVersion !== 75
    || manifest.policy?.runtimeGuardChainVersion !== 71
    || manifest.policy?.dataCompatibilityVersion !== 66
    || manifest.policy?.qaPhone !== CANARY_V75_QA_PHONE
    || manifest.policy?.exactFullRecipientMatch !== true
    || manifest.policy?.recipientAllowlistCount !== 5
    || manifest.policy?.mongoQueryFailClosed !== true
    || manifest.policy?.providerBoundaryRequired !== true
    || manifest.policy?.dropiAllowed !== false
    || manifest.policy?.metaAllowed !== false
    || manifest.policy?.nRouteProduct !== 'tex_ultra_ec'
    || manifest.policy?.productionMutationExecuted !== false
    || manifest.policy?.ancestorFailurePropagation !== 'FAIL_CLOSED'
    || JSON.stringify([...(manifest.declaredAncestorOverrides || [])].sort()) !== JSON.stringify(declaredAncestorOverrides)
    || JSON.stringify([...(manifest.newProtectedFiles || [])].sort()) !== JSON.stringify(newProtectedFiles)
    || JSON.stringify(protectedFiles) !== JSON.stringify(expectedProtectedFiles)
) throw new Error('[CANARY-ISOLATION-SAFETY-V75] manifesto, ancestralidade ou política inválida; execução bloqueada.');

const successorOverrides = new Set(getSuccessorOverrideFiles());
await withSuccessorGuardContext(declaredAncestorOverrides, async () => {
    await import('./freezeLockEcMetaDynamicFreezeRuntimeGuardV74.js');
});

for (const [relativePath, approvedHash] of Object.entries(manifest.protectedFiles || {})) {
    if (successorOverrides.has(relativePath)) continue;
    if (!fs.existsSync(absolute(relativePath)) || sha256(relativePath) !== approvedHash) {
        throw new Error(`[CANARY-ISOLATION-SAFETY-V75] alteração não autorizada em ${relativePath}.`);
    }
}

const env = {
    NODE_ENV: 'production',
    DISABLE_SCHEDULER: '0',
    DROPPI_EC_ACTIVE_SYNC_MODE: 'REPORT_ONLY',
    POST_SALE_V66_MUTATIONS_AUTHORIZATION: 'I_UNDERSTAND_V66_OPERATIONAL_MUTATIONS',
    META_TEST_EVENT_CODE_EC: '',
    META_TEST_EVENT_CODE: '',
    VITALISMEN_CANARY_V75_ENABLED: 'true'
};
for (const flag of CANARY_V75_REQUIRED_TRUE_FLAGS) env[flag] = 'true';
for (const flag of CANARY_V75_REQUIRED_FALSE_FLAGS) env[flag] = 'false';
for (const flag of CANARY_V75_RECIPIENT_LIST_FLAGS) env[flag] = CANARY_V75_QA_PHONE;
const controllerStartedAt = Date.now();
Object.assign(env, {
    VITALISMEN_CANARY_CTRL_V77_ENABLED: 'true',
    VITALISMEN_CANARY_V77_RELEASE: '20260828T210000Z_production-20260828-297324a',
    VITALISMEN_CANARY_V77_COMMIT: '297324afa20ae5d59fbcb6080eae2e62c4841c8b',
    VITALISMEN_CANARY_V77_TREE: '56a2b2cdc5c3062d1b90b7906bb48c705ab7d865',
    VITALISMEN_CANARY_V77_TAG: 'production-20260828-297324a',
    VITALISMEN_CANARY_V77_BASELINE_RELEASE: '20260828T210000Z_production-20260828-297324a',
    VITALISMEN_CANARY_V77_BASELINE_COMMIT: '297324afa20ae5d59fbcb6080eae2e62c4841c8b',
    VITALISMEN_CANARY_V77_BASELINE_TREE: '56a2b2cdc5c3062d1b90b7906bb48c705ab7d865',
    VITALISMEN_CANARY_V77_BASELINE_TAG: 'production-20260828-297324a',
    VITALISMEN_CANARY_V77_QA_PHONE: CANARY_V75_QA_PHONE,
    VITALISMEN_CANARY_V77_PERMIT_ID: 'v75-runtime-guard',
    VITALISMEN_CANARY_V77_STARTED_AT: new Date(controllerStartedAt).toISOString(),
    VITALISMEN_CANARY_V77_EXPIRES_AT: new Date(controllerStartedAt + 60 * 60 * 1000).toISOString()
});
env.VITALISMEN_CANARY_V77_PROFILE_SHA256 = calculateCanaryControllerV77ProfileSha256(env);
const contract = resolveCanaryV75Configuration(env);
if (!contract.enabled || !contract.ready || contract.failures.length > 0) {
    throw new Error('[CANARY-ISOLATION-SAFETY-V75] configuração canônica sintética não satisfaz o contrato.');
}

console.log('[CANARY-ISOLATION-SAFETY-V75] V75 → V74 → V73 → V72 → V71 íntegra; destinatário único, providers e efeitos externos falham fechados; nenhuma mutação operacional autorizada.');
