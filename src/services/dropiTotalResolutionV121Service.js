import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DROPI_TOTAL_RESOLUTION_V121_VERSION = 121;
export const DROPI_TOTAL_RESOLUTION_V121_MODE = 'EC_DROPI_TOTAL_MANUAL_ORDER_RESOLUTION';
export const DROPI_TOTAL_RESOLUTION_V121_MANIFEST_PATH = 'docs/freeze/dropi-total-resolution-v121-20260904.json';
export const DROPI_TOTAL_RESOLUTION_V121_PARENT_COMMIT = 'c7f44ed76c7d386dd9a1508c386cf8b7b2e8e404';
export const DROPI_TOTAL_RESOLUTION_V121_PARENT_TREE = 'f897776da6e45ce40e11f51e4246f830b510b0f9';
export const DROPI_TOTAL_RESOLUTION_V121_PARENT_MANIFEST_SHA256 = '3d888e5aeeb113351e1799b1cfa942925b1bd8e8b102e0a24718ee42ad3b101a';
export const DROPI_TOTAL_RESOLUTION_V121_FREEZE_SHA256 = 'daf0dc76956e97cbf9cd317afd69ef61c19f63e318b55b17095dcde5930b5fb2';
export const DROPI_TOTAL_RESOLUTION_V121_ATTESTATION_SHA256 = '5b622c8d402375f1ed4b12f11f86520654588557a4752c7778d81550b8f6ce05';
export const DROPI_TOTAL_RESOLUTION_V121_OVERRIDE_KEY = '__VITALISMEN_SUCCESSOR_OVERRIDE_FILES';

export const DROPI_TOTAL_RESOLUTION_V121_ANCESTOR_OVERRIDES = Object.freeze([
    '.github/workflows/ec-panel-quality.yml',
    'public/leads-window.html',
    'scripts/lib/ec-runtime-successor-v97-context.mjs',
    'src/routes/orders.js',
    'src/services/droppiEcuadorBrowserService.js',
    'src/services/droppiEcuadorService.js',
    'src/services/ecManualDropiReleaseV119Service.js',
    'src/services/ecMultiproductManualReleaseV120Service.js',
    'src/services/protocoloGSuccessorGuardV101Service.js'
]);

export const DROPI_TOTAL_RESOLUTION_V121_NEW_PROTECTED_FILES = Object.freeze([
    'docs/DROPI_TOTAL_RESOLUTION_FREEZE_V121_20260904.md',
    'docs/evidence/dropi-total-resolution-v121-attestation-20260904.json',
    'scripts/guard-dropi-total-resolution-v121.mjs',
    'src/services/dropiTotalResolutionFreezeRuntimeGuardV121.js',
    'src/services/dropiTotalResolutionV121Service.js',
    'tests/dropi-total-resolution-v121.test.mjs'
]);

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const relativeFile = (relativePath) => {
    if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath)
        || relativePath.includes('..') || relativePath.includes('\\')) {
        throw new Error('[DROPI-TOTAL-V121] protected_path_invalid');
    }
    const candidate = path.resolve(projectRoot, relativePath);
    if (candidate !== projectRoot && !candidate.startsWith(`${projectRoot}${path.sep}`)) {
        throw new Error('[DROPI-TOTAL-V121] protected_path_outside_root');
    }
    return candidate;
};
const fileSha256 = (relativePath) => sha256(fs.readFileSync(relativeFile(relativePath)));
const canonicalJson = (relativePath, label) => {
    const content = fs.readFileSync(relativeFile(relativePath), 'utf8');
    const value = JSON.parse(content);
    if (content !== `${JSON.stringify(value, null, 2)}\n`) {
        throw new Error(`[DROPI-TOTAL-V121] ${label}_not_canonical`);
    }
    return value;
};
const normalizePaths = (value) => {
    if (!Array.isArray(value)) throw new Error('[DROPI-TOTAL-V121] paths_invalid');
    return value.map((relativePath) => {
        relativeFile(relativePath);
        return relativePath;
    });
};

const assertParentV120 = () => {
    if (fileSha256('docs/freeze/ec-multiproduct-manual-release-v120-20260904.json')
        !== DROPI_TOTAL_RESOLUTION_V121_PARENT_MANIFEST_SHA256) {
        throw new Error('[DROPI-TOTAL-V121] parent_manifest_identity_invalid');
    }
    const parent = canonicalJson('docs/freeze/ec-multiproduct-manual-release-v120-20260904.json', 'parent_manifest');
    if (parent.version !== 120 || parent.freezeId !== 'ec-multiproduct-manual-release-v120'
        || parent.policy?.allowedProducts?.join('|') !== 'tex_ultra_ec|nitrix_ec|vit_power_ec'
        || parent.policy?.manualAuthorizationPerOrderRequired !== true
        || parent.policy?.automaticDispatchAllowed !== false
        || parent.policy?.automaticRetryAfterAmbiguousFailure !== false
        || parent.policy?.historicalBackfillAllowed !== false) {
        throw new Error('[DROPI-TOTAL-V121] parent_policy_invalid');
    }
    const modified = new Set(DROPI_TOTAL_RESOLUTION_V121_ANCESTOR_OVERRIDES);
    const successorOverrides = new Set(globalThis[DROPI_TOTAL_RESOLUTION_V121_OVERRIDE_KEY] || []);
    for (const [relativePath, expectedHash] of Object.entries(parent.protectedFiles || {})) {
        if (modified.has(relativePath) || successorOverrides.has(relativePath)) continue;
        if (fileSha256(relativePath) !== expectedHash) {
            throw new Error(`[DROPI-TOTAL-V121] parent_protected_file_invalid:${relativePath}`);
        }
    }
};

export const assertDropiTotalResolutionV121Manifest = () => {
    assertParentV120();
    const manifest = canonicalJson(DROPI_TOTAL_RESOLUTION_V121_MANIFEST_PATH, 'manifest');
    const overrides = normalizePaths(manifest.declaredAncestorOverrides);
    const newProtected = normalizePaths(manifest.newProtectedFiles);
    const expectedPaths = [...new Set([...overrides, ...newProtected])].sort();
    if (manifest.freezeId !== 'dropi-total-resolution-v121'
        || manifest.version !== DROPI_TOTAL_RESOLUTION_V121_VERSION
        || manifest.parentVersion !== 'V120_PRODUCTION_BASELINE'
        || manifest.parentCommit !== DROPI_TOTAL_RESOLUTION_V121_PARENT_COMMIT
        || manifest.parentTree !== DROPI_TOTAL_RESOLUTION_V121_PARENT_TREE
        || manifest.parentManifestSha256 !== DROPI_TOTAL_RESOLUTION_V121_PARENT_MANIFEST_SHA256
        || manifest.purpose !== 'COMPLETE_EXISTING_DROPI_STATUS_TRACKING_AND_OPERATOR_VISIBILITY'
        || JSON.stringify(overrides) !== JSON.stringify(DROPI_TOTAL_RESOLUTION_V121_ANCESTOR_OVERRIDES)
        || JSON.stringify(newProtected) !== JSON.stringify(DROPI_TOTAL_RESOLUTION_V121_NEW_PROTECTED_FILES)
        || JSON.stringify(Object.keys(manifest.protectedFiles || {}).sort()) !== JSON.stringify(expectedPaths)
        || manifest.policy?.allowedProducts?.join('|') !== 'tex_ultra_ec|nitrix_ec|vit_power_ec'
        || manifest.policy?.manualAuthorizationPerOrderRequired !== true
        || manifest.policy?.authoritativeLookupBeforeCreate !== true
        || manifest.policy?.oneCreatePostPerOperatorAction !== true
        || manifest.policy?.automaticRetryAfterAmbiguousFailure !== false
        || manifest.policy?.externalTerminalStatusProjection !== true
        || manifest.policy?.trackingAndCarrierProjection !== true
        || manifest.policy?.existingPanelOnly !== true
        || manifest.policy?.historicalBackfillAllowed !== false
        || manifest.policy?.massDispatchAllowed !== false
        || manifest.policy?.whatsappOutboundChanged !== false
        || manifest.policy?.postSaleArchitectureChanged !== false
        || manifest.policy?.metaChanged !== false
        || manifest.evidence?.sha256 !== DROPI_TOTAL_RESOLUTION_V121_ATTESTATION_SHA256
        || fileSha256(manifest.evidence.path) !== manifest.evidence.sha256
        || fileSha256('docs/DROPI_TOTAL_RESOLUTION_FREEZE_V121_20260904.md') !== DROPI_TOTAL_RESOLUTION_V121_FREEZE_SHA256) {
        throw new Error('[DROPI-TOTAL-V121] manifest_identity_or_policy_invalid');
    }
    const successorOverrides = new Set(globalThis[DROPI_TOTAL_RESOLUTION_V121_OVERRIDE_KEY] || []);
    for (const relativePath of expectedPaths) {
        if (!successorOverrides.has(relativePath) && fileSha256(relativePath) !== manifest.protectedFiles[relativePath]) {
            throw new Error(`[DROPI-TOTAL-V121] protected_file_invalid:${relativePath}`);
        }
    }
    const logical = expectedPaths.map((relativePath) => (
        `${relativePath}\0${successorOverrides.has(relativePath) ? manifest.protectedFiles[relativePath] : fileSha256(relativePath)}\n`
    )).join('');
    if (manifest.logicalBundle?.sha256 !== sha256(logical)) {
        throw new Error('[DROPI-TOTAL-V121] logical_bundle_invalid');
    }
    return Object.freeze({
        ready: true,
        failures: [],
        manifest,
        overrides,
        manifestSha256: fileSha256(DROPI_TOTAL_RESOLUTION_V121_MANIFEST_PATH)
    });
};
