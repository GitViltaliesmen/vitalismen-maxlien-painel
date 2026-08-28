import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
    getSuccessorOverrideFiles,
    withSuccessorGuardContext
} from './successorGuardContextService.js';

const root = process.cwd();
const manifestPath = 'docs/freeze/strict-read-only-observation-safety-v71-20260827.json';
const parentManifestPath = 'docs/freeze/deploy-publication-attestation-safety-v70-20260827.json';
const parentManifestSha256 = '7c3e646ffe8b44373dc1755260b92db4f7c413112bd862bc87529ed0a04fd194';
const attributionGuardSegment = ['proto', 'colo-g'].join('');
const declaredAncestorOverrides = [
    'docs/ARQUITETURA_AUTOMACAO_OFICIAL.md',
    'docs/ARQUIVOS_OFICIAIS.md',
    'ops/vitalismen-stage',
    'package.json',
    'scripts/deploy-vps-ready.mjs',
    `scripts/guard-meta-ec-${attributionGuardSegment}-attribution-v61.mjs`,
    `scripts/guard-${attributionGuardSegment}-ad-metrics-v63.mjs`,
    `scripts/guard-${attributionGuardSegment}-conversion-v62.mjs`,
    'scripts/guard-vitalismen-stage-v66.mjs',
    'src/config/db.js',
    'src/index.js',
    'src/routes/auth.js',
    'src/routes/health.js',
    'src/routes/whatsapp.js',
    'src/routes/zapi.js',
    'src/services/droppiEcuadorBrowserService.js',
    'src/services/ecEngagementFreezeRuntimeGuardV40.js',
    'src/services/outboundDedupeService.js',
    'src/services/zapiClient.js',
    'src/whatsapp/sendAudio.js',
    'src/whatsapp/sendDocument.js',
    'src/whatsapp/sendImage.js',
    'src/whatsapp/sendText.js',
    'src/whatsapp/sendVideo.js'
];
const newProtectedFiles = [
    'docs/STRICT_READ_ONLY_OBSERVATION_SAFETY_FREEZE_V71_20260827.md',
    'scripts/audit-document-level-baseline-readonly.mjs',
    'scripts/guard-strict-read-only-observation-safety-v71.mjs',
    'src/services/strictReadOnlyObservationSafetyFreezeRuntimeGuardV71.js',
    'src/services/strictReadOnlyObservationService.js',
    'tests/document-level-baseline-readonly.test.mjs',
    'tests/strict-read-only-observation-safety-v71.test.mjs'
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
    || manifest.freezeId !== 'strict-read-only-observation-safety-v71'
    || manifest.parentFreezeId !== 'deploy-publication-attestation-safety-v70-20260827'
    || manifest.parentManifestSha256 !== parentManifestSha256
    || manifest.status !== 'implementation_validated'
    || manifest.publicationStatus !== 'local_candidate_no_push_no_stage_no_deploy'
    || manifest.country !== 'EC'
    || manifest.policy?.canonicalRuntimeGuard !== 'node src/services/strictReadOnlyObservationSafetyFreezeRuntimeGuardV71.js'
    || manifest.policy?.guardChainVersion !== 71
    || manifest.policy?.dataCompatibilityVersion !== 66
    || manifest.policy?.safeObservationPolicy !== 'STRICT_READ_ONLY'
    || JSON.stringify(manifest.policy?.allowedWriteClasses) !== '[]'
    || manifest.policy?.mongoBusinessWrites !== 0
    || manifest.policy?.mongoBookkeepingWrites !== 0
    || manifest.policy?.filesystemSessionWrites !== 0
    || manifest.policy?.outboundCalls !== 0
    || manifest.policy?.dropiApplyCalls !== 0
    || manifest.policy?.mutatingSchedulers !== 0
    || manifest.policy?.autoIndex !== false
    || manifest.policy?.baileysRequired !== false
    || manifest.policy?.baileysStartCalls !== 0
    || manifest.policy?.zapiReadOnlyStatusAllowed !== true
    || manifest.policy?.zapiInboundPersistenceAllowed !== false
    || manifest.policy?.zapiAckPersistenceAllowed !== false
    || manifest.policy?.mutatingRoutesEnabled !== false
    || manifest.policy?.documentBaselineCollections !== 8
    || manifest.policy?.normalOperationalModePreserved !== true
    || manifest.policy?.v70Commit !== '288e49b73564bd17184174db0d5b0fa25f223225'
    || manifest.policy?.v70Tree !== 'e4732ca0ae4b6e33c41af4271f2597e3eb9a39f8'
    || manifest.policy?.v70PreservedAsImmutableParent !== true
    || manifest.policy?.ancestorFailurePropagation !== 'FAIL_CLOSED'
    || manifest.policy?.helperInstallAuthorized !== false
    || manifest.policy?.stagingAuthorized !== false
    || manifest.policy?.publicationAuthorized !== false
    || manifest.policy?.activationAuthorized !== false
    || manifest.policy?.productionMutationExecuted !== false
    || JSON.stringify([...(manifest.declaredAncestorOverrides || [])].sort()) !== JSON.stringify(declaredAncestorOverrides)
    || JSON.stringify([...(manifest.newProtectedFiles || [])].sort()) !== JSON.stringify(newProtectedFiles)
    || JSON.stringify(protectedFiles) !== JSON.stringify(expectedProtectedFiles)
) throw new Error('[STRICT-READ-ONLY-OBSERVATION-SAFETY-V71] manifesto, ancestralidade ou política inválida; execução bloqueada.');

const successorOverrides = new Set(getSuccessorOverrideFiles());
await withSuccessorGuardContext(declaredAncestorOverrides, async () => {
    await import('./deployPublicationAttestationSafetyFreezeRuntimeGuardV70.js');
});

for (const [relativePath, approvedHash] of Object.entries(manifest.protectedFiles || {})) {
    if (successorOverrides.has(relativePath)) continue;
    if (!fs.existsSync(absolute(relativePath)) || sha256(relativePath) !== approvedHash) {
        throw new Error(`[STRICT-READ-ONLY-OBSERVATION-SAFETY-V71] alteração não autorizada em ${relativePath}.`);
    }
}

console.log('[STRICT-READ-ONLY-OBSERVATION-SAFETY-V71] SAFE_OBSERVATION_ONLY equivale a STRICT_READ_ONLY global; writes permitidos=0; nenhum efeito operacional autorizado.');
