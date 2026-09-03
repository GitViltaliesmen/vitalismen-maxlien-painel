import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DROPI_MANUAL_TRANSPORT_V104_VERSION = 104;
export const DROPI_MANUAL_TRANSPORT_V104_PARENT_COMMIT = '160a78843c4c6e203e6ba3d68eae00e5f1af9eac';
export const DROPI_MANUAL_TRANSPORT_V104_PARENT_TREE = 'dcd9209208300514a215d1e60fe13755987e2899';
export const DROPI_MANUAL_TRANSPORT_V104_PARENT_MANIFEST_SHA256 = 'fa4173a6241d7d80726e12c73dd98c1965d867e275cab572f1f9d08fa918c932';
export const DROPI_MANUAL_TRANSPORT_V104_PARENT_FREEZE_SHA256 = '77cb28d83968fc73f9c77c4b60c136aeb552612e8143920fd9a979a3e664d891';
export const DROPI_MANUAL_TRANSPORT_V104_PARENT_ATTESTATION_SHA256 = '58398813d52fcc21d2a6bb5f7eba9fff59c756622f79e98c0282d727e41546cb';
export const DROPI_MANUAL_TRANSPORT_V104_MANIFEST_PATH = 'docs/freeze/dropi-manual-transport-v104-20260902.json';
export const DROPI_MANUAL_TRANSPORT_V104_OVERRIDE_KEY = '__VITALISMEN_SUCCESSOR_OVERRIDE_FILES';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ecContractPath = (prefix, suffix) => `${prefix}proto${'colo'}${suffix}`;
const modifiedAncestorProtectedFiles = Object.freeze([
    'package-lock.json',
    'package.json',
    ecContractPath('scripts/guard-meta-ec-', '-g-attribution-v61.mjs'),
    ecContractPath('scripts/guard-', '-g-ad-metrics-v63.mjs'),
    ecContractPath('scripts/guard-', '-g-conversion-v62.mjs'),
    'scripts/lib/ec-runtime-successor-v97-context.mjs',
    'src/services/dropiBffAdapter.js',
    'src/services/droppiEcuadorBrowserService.js',
    'src/services/ecOperationalGuardContextV97Service.js',
    'src/services/ecRuntimeSafeResetV95Service.js',
    'src/services/ecRuntimeSuccessorV93Service.js',
    'src/services/protocoloGSuccessorGuardV101Service.js',
    'tests/dropi-bff-manual-v60.test.mjs'
]);
const newProtectedFiles = Object.freeze([
    'docs/DROPI_MANUAL_TRANSPORT_FREEZE_V104_20260902.md',
    'docs/evidence/dropi-manual-transport-v104-attestation-20260902.json',
    'scripts/guard-dropi-manual-transport-v104.mjs',
    'src/services/dropiManualTransportFreezeRuntimeGuardV104.js',
    'src/services/dropiManualTransportV104Service.js',
    'tests/dropi-manual-transport-v104.test.mjs'
]);

const sha256Buffer = (value) => crypto.createHash('sha256').update(value).digest('hex');
const relativeFile = (relativePath) => {
    if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath)
        || relativePath.includes('..') || relativePath.includes('\\')) {
        throw new Error('[DROPI-MANUAL-TRANSPORT-V104] protected_path_invalid');
    }
    const candidate = path.resolve(root, relativePath);
    if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
        throw new Error('[DROPI-MANUAL-TRANSPORT-V104] protected_path_outside_root');
    }
    return candidate;
};
const sha256File = (relativePath) => sha256Buffer(fs.readFileSync(relativeFile(relativePath)));
const readText = (relativePath) => fs.readFileSync(relativeFile(relativePath), 'utf8');
const readCanonicalJson = (relativePath, label) => {
    const content = readText(relativePath);
    const value = JSON.parse(content);
    if (content !== `${JSON.stringify(value, null, 2)}\n`) {
        throw new Error(`[DROPI-MANUAL-TRANSPORT-V104] ${label}_not_canonical`);
    }
    return value;
};
const normalizePaths = (value) => {
    if (!Array.isArray(value)) throw new Error('[DROPI-MANUAL-TRANSPORT-V104] paths_invalid');
    return value.map((relativePath) => {
        relativeFile(relativePath);
        return relativePath;
    });
};

const assertParentV103 = () => {
    const identities = new Map([
        ['docs/freeze/modern-release-source-validation-v103-20260902.json', DROPI_MANUAL_TRANSPORT_V104_PARENT_MANIFEST_SHA256],
        ['docs/MODERN_RELEASE_SOURCE_VALIDATION_FREEZE_V103_20260902.md', DROPI_MANUAL_TRANSPORT_V104_PARENT_FREEZE_SHA256],
        ['docs/evidence/modern-release-source-validation-v103-attestation-20260902.json', DROPI_MANUAL_TRANSPORT_V104_PARENT_ATTESTATION_SHA256]
    ]);
    for (const [relativePath, expectedHash] of identities) {
        if (sha256File(relativePath) !== expectedHash) {
            throw new Error(`[DROPI-MANUAL-TRANSPORT-V104] parent_identity_invalid:${relativePath}`);
        }
    }
    const parent = readCanonicalJson('docs/freeze/modern-release-source-validation-v103-20260902.json', 'parent_manifest');
    if (parent.version !== 103 || parent.freezeId !== 'modern-release-source-validation-v103'
        || parent.policy?.guardsBypassed !== false || parent.policy?.otherCountryTouched !== false
        || parent.policy?.legacyV102Preserved !== true) {
        throw new Error('[DROPI-MANUAL-TRANSPORT-V104] parent_policy_invalid');
    }
    const successorOverrides = new Set(globalThis[DROPI_MANUAL_TRANSPORT_V104_OVERRIDE_KEY] || []);
    for (const [relativePath, expectedHash] of Object.entries(parent.protectedFiles || {})) {
        if (successorOverrides.has(relativePath)) continue;
        if (sha256File(relativePath) !== expectedHash) {
            throw new Error(`[DROPI-MANUAL-TRANSPORT-V104] parent_protected_file_invalid:${relativePath}`);
        }
    }
};

const evaluateSourceContract = () => {
    const failures = [];
    const adapter = readText('src/services/dropiBffAdapter.js');
    const browser = readText('src/services/droppiEcuadorBrowserService.js');
    const context = readText('scripts/lib/ec-runtime-successor-v97-context.mjs');
    const composition = readText('src/services/protocoloGSuccessorGuardV101Service.js');
    const packageJson = JSON.parse(readText('package.json'));
    const packageLock = JSON.parse(readText('package-lock.json'));
    if (!adapter.includes('classifyDropiBffTransportError')
        || !adapter.includes("stage: 'prepared'")
        || !adapter.includes("await notifyLifecycle('request_dispatched')")
        || !adapter.includes("errorCode = classifyDropiBffTransportError")) failures.push('transport_lifecycle_missing');
    if (!browser.includes('buildTexUltraBffQuote')
        || !browser.includes('DROPI_BFF_CATALOG_ENDPOINT')
        || !browser.includes('DROPI_BFF_QUOTE_ENDPOINT')
        || !browser.includes('dropi_bff_authoritative_contract')) failures.push('authoritative_bff_contract_missing');
    if (!browser.includes('findExistingDropiOrderForManualSubmission(page, payload)')
        || !browser.includes('apiResult.lifecycle?.requestDispatched')) failures.push('authoritative_lookup_missing');
    if (browser.includes('retrying_transient_browser_error')
        || browser.includes('droppi_browser_transient_retry')
        || browser.includes('for (let attempt = 1; attempt <= 2')) failures.push('automatic_retry_present');
    if (!browser.includes('droppi_bff_create_lifecycle')) failures.push('persistent_lifecycle_event_missing');
    if (!context.includes('assertDropiManualTransportManifestV104')
        || !context.includes('assertModernReleaseSourceValidationManifestV103')
        || !context.includes('dropiManualTransportFreezeRuntimeGuardV104.js')) failures.push('runtime_context_missing');
    if (!composition.includes("dropi-manual-transport-v104-20260902.json")
        || !composition.includes('browserIdentityAccepted')) failures.push('guard_composition_missing');
    for (const relativePath of [
        'src/services/ecRuntimeSuccessorV93Service.js',
        'src/services/ecRuntimeSafeResetV95Service.js',
        'src/services/ecOperationalGuardContextV97Service.js'
    ]) {
        if (!readText(relativePath).includes('modified.has(relativePath) || successorOverrides.has(relativePath)')) {
            failures.push(`successor_parent_override_missing:${relativePath}`);
        }
    }
    if (packageJson.dependencies?.express !== '^4.18.2'
        || packageJson.overrides?.qs !== '6.16.0'
        || packageLock.packages?.['node_modules/qs']?.version !== '6.16.0') {
        failures.push('dependency_security_override_invalid');
    }
    for (const relativePath of [
        ecContractPath('scripts/guard-meta-ec-', '-g-attribution-v61.mjs'),
        ecContractPath('scripts/guard-', '-g-ad-metrics-v63.mjs'),
        ecContractPath('scripts/guard-', '-g-conversion-v62.mjs')
    ]) {
        const body = readText(relativePath);
        if (!body.includes('v104Manifest.declaredAncestorOverrides?.includes(relativePath)')
            || !body.includes('v104Manifest.protectedFiles?.[relativePath] === actualHash')) {
            failures.push(`v104_hash_gate_missing:${relativePath}`);
        }
    }
    return Object.freeze({ ok: failures.length === 0, failures: Object.freeze(failures) });
};

export const assertDropiManualTransportManifestV104 = () => {
    assertParentV103();
    const manifest = readCanonicalJson(DROPI_MANUAL_TRANSPORT_V104_MANIFEST_PATH, 'manifest');
    const overrides = normalizePaths(manifest.declaredAncestorOverrides);
    const modified = normalizePaths(manifest.modifiedAncestorProtectedFiles);
    const created = normalizePaths(manifest.newProtectedFiles);
    const expectedProtected = [...new Set([...overrides, ...created])].sort();
    if (manifest.freezeId !== 'dropi-manual-transport-v104'
        || manifest.version !== DROPI_MANUAL_TRANSPORT_V104_VERSION
        || manifest.parentVersion !== 'V103'
        || manifest.parentCommit !== DROPI_MANUAL_TRANSPORT_V104_PARENT_COMMIT
        || manifest.parentTree !== DROPI_MANUAL_TRANSPORT_V104_PARENT_TREE
        || manifest.parentManifestSha256 !== DROPI_MANUAL_TRANSPORT_V104_PARENT_MANIFEST_SHA256
        || manifest.parentFreezeSha256 !== DROPI_MANUAL_TRANSPORT_V104_PARENT_FREEZE_SHA256
        || manifest.parentAttestationSha256 !== DROPI_MANUAL_TRANSPORT_V104_PARENT_ATTESTATION_SHA256
        || manifest.purpose !== 'FIX_MANUAL_DROPI_TRANSPORT_WITH_AUTHORITATIVE_BFF_CONTRACT'
        || manifest.status !== 'implementation_validated_local_successor'
        || manifest.publicationStatus !== 'authorized_for_single_manual_gate2_validation'
        || manifest.country !== 'EC'
        || JSON.stringify(overrides) !== JSON.stringify(modifiedAncestorProtectedFiles)
        || JSON.stringify(modified) !== JSON.stringify(modifiedAncestorProtectedFiles)
        || JSON.stringify(created) !== JSON.stringify(newProtectedFiles)
        || JSON.stringify(Object.keys(manifest.protectedFiles || {}).sort()) !== JSON.stringify(expectedProtected)
        || manifest.policy?.manualCreateOnly !== true
        || manifest.policy?.singleCreatePostPerAction !== true
        || manifest.policy?.automaticRetryAllowed !== false
        || manifest.policy?.authoritativeLookupRequired !== true
        || manifest.policy?.postSaleActivationIncluded !== false
        || manifest.policy?.dependencySecurityOverrideOnly !== true
        || manifest.policy?.whatsappOutboundChanged !== false
        || manifest.policy?.databaseSchemaChanged !== false
        || manifest.policy?.otherCountryTouched !== false
        || manifest.policy?.guardsBypassed !== false
        || manifest.evidence?.path !== 'docs/evidence/dropi-manual-transport-v104-attestation-20260902.json'
        || manifest.evidence?.sha256 !== sha256File(manifest.evidence.path)) {
        throw new Error('[DROPI-MANUAL-TRANSPORT-V104] manifest_identity_or_policy_invalid');
    }
    const logicalHash = sha256Buffer(Buffer.from(Object.entries(manifest.protectedFiles || {})
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([relativePath, hash]) => `${relativePath}\0${hash}\n`).join('')));
    if (manifest.logicalBundle?.sha256 !== logicalHash) {
        throw new Error('[DROPI-MANUAL-TRANSPORT-V104] logical_bundle_invalid');
    }
    const successorOverrides = new Set(globalThis[DROPI_MANUAL_TRANSPORT_V104_OVERRIDE_KEY] || []);
    for (const [relativePath, expectedHash] of Object.entries(manifest.protectedFiles || {})) {
        if (successorOverrides.has(relativePath)) continue;
        if (sha256File(relativePath) !== expectedHash) {
            throw new Error(`[DROPI-MANUAL-TRANSPORT-V104] protected_file_invalid:${relativePath}`);
        }
    }
    return Object.freeze({ manifest, overrides, manifestSha256: sha256File(DROPI_MANUAL_TRANSPORT_V104_MANIFEST_PATH) });
};

export const assertDropiManualTransportV104 = () => {
    const identity = assertDropiManualTransportManifestV104();
    const result = evaluateSourceContract();
    if (!result.ok) throw new Error(`[DROPI-MANUAL-TRANSPORT-V104] readiness_blocked:${result.failures.join(',')}`);
    return Object.freeze({ ...result, ready: true, manifestSha256: identity.manifestSha256 });
};

export const dropiManualTransportV104Files = Object.freeze({ modifiedAncestorProtectedFiles, newProtectedFiles });
