import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = 'docs/freeze/dropi-customer-full-name-v64-20260826.json';
const parentManifestPath = 'docs/freeze/protocolo-g-ad-metrics-v63-20260826.json';
const parentManifestSha256 = '49511a622fff8526333f96478559eccd8db4874e6ddcf6cc17204286ddefa16c';
const declaredAncestorOverrides = [
    'docs/ARQUITETURA_AUTOMACAO_OFICIAL.md',
    'docs/ARQUIVOS_OFICIAIS.md',
    'package.json',
    'scripts/guard-baileys-libsignal-security-v59.mjs',
    'scripts/guard-meta-ec-protocolo-g-attribution-v61.mjs',
    'scripts/guard-pickup-bonus-delivery-v60.mjs',
    'scripts/guard-protocolo-g-ad-metrics-v63.mjs',
    'scripts/guard-protocolo-g-conversion-v62.mjs',
    'scripts/senior-guard.mjs',
    'src/routes/shipments.js',
    'src/services/droppiEcuadorService.js',
    'src/services/ecEngagementFreezeRuntimeGuardV40.js',
    'tests/whatsapp-outage-recovery-v49.test.mjs'
];
const newProtectedFiles = [
    'docs/AUDITORIA_GARGALOS_POS_VENDA_EC_20260826.md',
    'docs/DROPI_CUSTOMER_FULL_NAME_FREEZE_V64_20260826.md',
    'scripts/guard-dropi-customer-full-name-v64.mjs',
    'src/services/dropiCustomerFullNameFreezeRuntimeGuardV64.js',
    'tests/dropi-customer-full-name-v64.test.mjs'
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
    || manifest.freezeId !== 'dropi-customer-full-name-v64-20260826'
    || manifest.parentFreezeId !== 'protocolo-g-ad-metrics-v63-20260826'
    || manifest.parentManifestSha256 !== parentManifestSha256
    || manifest.status !== 'implementation_validated'
    || manifest.publicationStatus !== 'local_only_no_deploy'
    || manifest.country !== 'EC'
    || manifest.policy?.canonicalNameSource !== 'Order.customer.name'
    || manifest.policy?.fullNameRequired !== true
    || manifest.policy?.technicalIdentifierAllowed !== false
    || manifest.policy?.allDropiSubmitPathsGuarded !== true
    || manifest.policy?.historicalOrdersMutated !== false
    || manifest.policy?.whatsappSendAuthorized !== false
    || manifest.policy?.dropiSubmitAuthorizedByThisFreeze !== false
    || manifest.policy?.deployAuthorized !== false
    || JSON.stringify([...(manifest.declaredAncestorOverrides || [])].sort()) !== JSON.stringify(declaredAncestorOverrides)
    || JSON.stringify([...(manifest.newProtectedFiles || [])].sort()) !== JSON.stringify(newProtectedFiles)
    || JSON.stringify(protectedFiles) !== JSON.stringify(expectedProtectedFiles)
) throw new Error('[DROPI-CUSTOMER-FULL-NAME-V64] manifesto ou política inválida; startup bloqueado.');

const inheritedSuccessorOverrides = globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES || [];
const successorOverrides = new Set(inheritedSuccessorOverrides);
globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES = [
    ...successorOverrides,
    ...declaredAncestorOverrides
];
try {
    await import('./protocoloGAdMetricsFreezeRuntimeGuardV63.js');
} finally {
    if (inheritedSuccessorOverrides.length > 0) {
        globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES = inheritedSuccessorOverrides;
    } else {
        delete globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES;
    }
}

for (const [relativePath, approvedHash] of Object.entries(manifest.protectedFiles || {})) {
    if (successorOverrides.has(relativePath)) continue;
    if (!fs.existsSync(absolute(relativePath)) || sha256(relativePath) !== approvedHash) {
        throw new Error(`[DROPI-CUSTOMER-FULL-NAME-V64] alteração não autorizada em ${relativePath}.`);
    }
}

console.log('[DROPI-CUSTOMER-FULL-NAME-V64] nome completo obrigatório íntegro; deploy continua não autorizado.');
