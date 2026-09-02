import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DROPI_MANUAL_BFF_RECOVERY_V98_VERSION = 98;
export const DROPI_MANUAL_BFF_RECOVERY_V98_PARENT_COMMIT = 'bb5bf3d79d2b9e9fff0fbf5749478bdc8594385e';
export const DROPI_MANUAL_BFF_RECOVERY_V98_PARENT_TREE = 'e35037816173f2f2e17918e36d689602b8922c4b';
export const DROPI_MANUAL_BFF_RECOVERY_V98_PARENT_MANIFEST_SHA256 = '68d060e1596c03e2058546ae13841db5fb02e7a23869394c4a67a7087874caa1';
export const DROPI_MANUAL_BFF_RECOVERY_V98_PARENT_FREEZE_SHA256 = 'a27593a80e5ca8ddb156d94add6ccf418e4c14b822d5bd635d339b115ea3d255';
export const DROPI_MANUAL_BFF_RECOVERY_V98_PARENT_ATTESTATION_SHA256 = 'f5a9ac6e0acbb56ec23207f9235564e070b037758f52d56cc62ce90672b49349';
export const DROPI_MANUAL_BFF_RECOVERY_V98_MANIFEST_PATH = 'docs/freeze/dropi-manual-bff-recovery-v98-20260902.json';
export const DROPI_MANUAL_BFF_RECOVERY_V98_OVERRIDE_KEY = '__VITALISMEN_SUCCESSOR_OVERRIDE_FILES';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const modifiedAncestorProtectedFiles = Object.freeze([
    'scripts/lib/ec-runtime-successor-v97-context.mjs',
    'src/services/droppiEcuadorBrowserService.js',
    'src/services/ecOperationalGuardContextV97Service.js',
    'tests/ec-operational-guard-context-v97.test.mjs'
]);
const newProtectedFiles = Object.freeze([
    'docs/DROPI_MANUAL_BFF_RECOVERY_FREEZE_V98_20260902.md',
    'docs/evidence/dropi-manual-bff-recovery-v98-attestation-20260902.json',
    'scripts/guard-dropi-manual-bff-recovery-v98.mjs',
    'src/services/dropiBffAdapter.js',
    'src/services/dropiManualBffRecoveryFreezeRuntimeGuardV98.js',
    'src/services/dropiManualBffRecoveryV98Service.js',
    'tests/dropi-bff-manual-v60.test.mjs',
    'tests/dropi-manual-bff-recovery-v98.test.mjs'
]);

const sha256Buffer = (value) => crypto.createHash('sha256').update(value).digest('hex');
const relativeFile = (relativePath) => {
    if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath) || relativePath.includes('..') || relativePath.includes('\\')) {
        throw new Error('[DROPI-MANUAL-BFF-RECOVERY-V98] protected_path_invalid');
    }
    const candidate = path.resolve(root, relativePath);
    if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
        throw new Error('[DROPI-MANUAL-BFF-RECOVERY-V98] protected_path_outside_root');
    }
    return candidate;
};
const sha256File = (relativePath) => sha256Buffer(fs.readFileSync(relativeFile(relativePath)));
const readText = (relativePath) => fs.readFileSync(relativeFile(relativePath), 'utf8');
const readCanonicalJson = (relativePath, label) => {
    const content = readText(relativePath);
    const value = JSON.parse(content);
    if (content !== `${JSON.stringify(value, null, 2)}\n`) {
        throw new Error(`[DROPI-MANUAL-BFF-RECOVERY-V98] ${label}_not_canonical`);
    }
    return value;
};
const normalizePaths = (value) => {
    if (!Array.isArray(value)) throw new Error('[DROPI-MANUAL-BFF-RECOVERY-V98] paths_invalid');
    return value.map((relativePath) => {
        relativeFile(relativePath);
        return relativePath;
    });
};

const assertParentV97 = () => {
    const identities = new Map([
        ['docs/freeze/ec-operational-guard-context-v97-20260830.json', DROPI_MANUAL_BFF_RECOVERY_V98_PARENT_MANIFEST_SHA256],
        ['docs/EC_OPERATIONAL_GUARD_CONTEXT_FREEZE_V97_20260830.md', DROPI_MANUAL_BFF_RECOVERY_V98_PARENT_FREEZE_SHA256],
        ['docs/evidence/ec-operational-guard-context-v97-attestation-20260830.json', DROPI_MANUAL_BFF_RECOVERY_V98_PARENT_ATTESTATION_SHA256]
    ]);
    for (const [relativePath, expectedHash] of identities) {
        if (sha256File(relativePath) !== expectedHash) {
            throw new Error(`[DROPI-MANUAL-BFF-RECOVERY-V98] parent_identity_invalid:${relativePath}`);
        }
    }
    const parent = readCanonicalJson('docs/freeze/ec-operational-guard-context-v97-20260830.json', 'parent_manifest');
    if (parent.version !== 97 || parent.freezeId !== 'ec-operational-guard-context-v97'
        || parent.policy?.guardsBypassed !== false || parent.policy?.databaseChanged !== false
        || parent.policy?.otherCountryTouched !== false) {
        throw new Error('[DROPI-MANUAL-BFF-RECOVERY-V98] parent_policy_invalid');
    }
    const overrides = new Set(modifiedAncestorProtectedFiles);
    for (const [relativePath, expectedHash] of Object.entries(parent.protectedFiles || {})) {
        if (overrides.has(relativePath)) continue;
        if (sha256File(relativePath) !== expectedHash) {
            throw new Error(`[DROPI-MANUAL-BFF-RECOVERY-V98] parent_protected_file_invalid:${relativePath}`);
        }
    }
};

const evaluateSourceContract = () => {
    const failures = [];
    const adapter = readText('src/services/dropiBffAdapter.js');
    const browser = readText('src/services/droppiEcuadorBrowserService.js');
    const routes = readText('src/routes/shipments.js');
    const scheduler = readText('src/services/schedulerService.js');
    const context = readText('scripts/lib/ec-runtime-successor-v97-context.mjs');
    if (!adapter.includes("https://api-v2.dropi.ec") || !adapter.includes('/bff/orders/myorders/v2') || !adapter.includes('/bff/orders')) failures.push('official_bff_contract_missing');
    if (!adapter.includes('sanitizeDropiBffStatusReason') || !adapter.includes('[REDACTED_PHONE]') || !adapter.includes('[REDACTED_EMAIL]')) failures.push('status_reason_sanitizer_missing');
    if (adapter.includes("headers.Cookie") || adapter.includes("'X-CSRF-Token'")) failures.push('invented_auth_header_present');
    const submitStart = browser.indexOf('const submitOrderInPanel');
    const submitEnd = browser.indexOf('const findMatchingPanelText', submitStart);
    const submitFlow = submitStart >= 0 && submitEnd > submitStart ? browser.slice(submitStart, submitEnd) : '';
    const lookup = submitFlow.indexOf('findExistingDropiOrderForManualSubmission(page, payload)');
    const post = submitFlow.indexOf('submitOrderViaDropiApi(page');
    if (lookup < 0 || post <= lookup) failures.push('idempotency_lookup_before_post_missing');
    if (browser.includes('submitOrderViaPanelButton')) failures.push('legacy_panel_submit_present');
    if (!browser.includes('buildDropiBffSubmitError') || !browser.includes('statusReason: safeStatusReason')) failures.push('sanitized_diagnostic_persistence_missing');
    if (!routes.includes("router.post('/droppi/ec/orders/:orderId/submit', adminOnly")) failures.push('admin_manual_route_missing');
    if (!routes.includes('if (dryRun !== false)')) failures.push('manual_dry_run_gate_missing');
    if (/submitDroppiEcuadorOrder|enqueueDropiSubmitJob/.test(scheduler)) failures.push('automatic_dropi_submit_present');
    if (!context.includes('assertDropiManualBffRecoveryManifestV98') || !context.includes('dropiManualBffRecoveryFreezeRuntimeGuardV98.js')) failures.push('successor_runtime_context_missing');
    return Object.freeze({ ok: failures.length === 0, failures: Object.freeze(failures) });
};

export const assertDropiManualBffRecoveryManifestV98 = () => {
    assertParentV97();
    const manifest = readCanonicalJson(DROPI_MANUAL_BFF_RECOVERY_V98_MANIFEST_PATH, 'manifest');
    const overrides = normalizePaths(manifest.declaredAncestorOverrides);
    const modified = normalizePaths(manifest.modifiedAncestorProtectedFiles);
    const created = normalizePaths(manifest.newProtectedFiles);
    const expectedProtected = [...new Set([...overrides, ...created])].sort();
    if (manifest.freezeId !== 'dropi-manual-bff-recovery-v98' || manifest.version !== DROPI_MANUAL_BFF_RECOVERY_V98_VERSION
        || manifest.parentVersion !== 'V97' || manifest.parentCommit !== DROPI_MANUAL_BFF_RECOVERY_V98_PARENT_COMMIT
        || manifest.parentTree !== DROPI_MANUAL_BFF_RECOVERY_V98_PARENT_TREE
        || manifest.parentManifestSha256 !== DROPI_MANUAL_BFF_RECOVERY_V98_PARENT_MANIFEST_SHA256
        || manifest.parentFreezeSha256 !== DROPI_MANUAL_BFF_RECOVERY_V98_PARENT_FREEZE_SHA256
        || manifest.parentAttestationSha256 !== DROPI_MANUAL_BFF_RECOVERY_V98_PARENT_ATTESTATION_SHA256
        || manifest.status !== 'implementation_validated_local_successor'
        || manifest.publicationStatus !== 'authorized_for_controlled_manual_dropi_recovery'
        || manifest.country !== 'EC'
        || manifest.purpose !== 'MANUAL_DROPI_BFF_CURRENT_BASE_WITH_SANITIZED_FAILURE_REASON'
        || JSON.stringify(overrides) !== JSON.stringify(modifiedAncestorProtectedFiles)
        || JSON.stringify(modified) !== JSON.stringify(modifiedAncestorProtectedFiles)
        || JSON.stringify(created) !== JSON.stringify(newProtectedFiles)
        || JSON.stringify(Object.keys(manifest.protectedFiles || {}).sort()) !== JSON.stringify(expectedProtected)
        || manifest.policy?.manualDropiOnly !== true || manifest.policy?.automaticDropiSubmitAllowed !== false
        || manifest.policy?.idempotencyLookupBeforePost !== true || manifest.policy?.sanitizedFailureReasonOnly !== true
        || manifest.policy?.postSaleSchedulersChanged !== false || manifest.policy?.whatsappOutboundChanged !== false
        || manifest.policy?.funnelChanged !== false || manifest.policy?.pricesChanged !== false
        || manifest.policy?.externalVslFilesChanged !== false || manifest.policy?.pixelDatasetChanged !== false
        || manifest.policy?.databaseSchemaChanged !== false || manifest.policy?.otherCountryTouched !== false
        || manifest.policy?.guardsBypassed !== false || manifest.policy?.ancestralHashesRewritten !== false
        || manifest.evidence?.path !== 'docs/evidence/dropi-manual-bff-recovery-v98-attestation-20260902.json'
        || manifest.evidence?.sha256 !== sha256File('docs/evidence/dropi-manual-bff-recovery-v98-attestation-20260902.json')) {
        throw new Error('[DROPI-MANUAL-BFF-RECOVERY-V98] manifest_identity_or_policy_invalid');
    }
    const logicalHash = sha256Buffer(Buffer.from(Object.entries(manifest.protectedFiles || {})
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([relativePath, hash]) => `${relativePath}\0${hash}\n`).join('')));
    if (manifest.logicalBundle?.sha256 !== logicalHash) throw new Error('[DROPI-MANUAL-BFF-RECOVERY-V98] logical_bundle_invalid');
    for (const [relativePath, expectedHash] of Object.entries(manifest.protectedFiles || {})) {
        if (sha256File(relativePath) !== expectedHash) {
            throw new Error(`[DROPI-MANUAL-BFF-RECOVERY-V98] protected_file_invalid:${relativePath}`);
        }
    }
    return Object.freeze({ manifest, overrides, manifestSha256: sha256File(DROPI_MANUAL_BFF_RECOVERY_V98_MANIFEST_PATH) });
};

export const assertDropiManualBffRecoveryV98 = () => {
    const identity = assertDropiManualBffRecoveryManifestV98();
    const result = evaluateSourceContract();
    if (!result.ok) throw new Error(`[DROPI-MANUAL-BFF-RECOVERY-V98] readiness_blocked:${result.failures.join(',')}`);
    return Object.freeze({ ...result, ready: true, manifestSha256: identity.manifestSha256 });
};

export const dropiManualBffRecoveryV98Files = Object.freeze({
    modifiedAncestorProtectedFiles,
    newProtectedFiles
});
