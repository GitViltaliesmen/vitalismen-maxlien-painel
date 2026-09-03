import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROTOCOLO_G_SUCCESSOR_GUARD_V101_VERSION = 101;
export const PROTOCOLO_G_SUCCESSOR_GUARD_V101_PARENT_COMMIT = '1c66b017b4e61d7e22540e7a881474f35dbda5bb';
export const PROTOCOLO_G_SUCCESSOR_GUARD_V101_PARENT_TREE = '2bbba45903f9c6f71683e4937e8c79effeba2b85';
export const PROTOCOLO_G_SUCCESSOR_GUARD_V101_PARENT_MANIFEST_SHA256 = '86db366c94f627aec01024f65ac7f2052653cf1017aecdb187d259e9e7fb4681';
export const PROTOCOLO_G_SUCCESSOR_GUARD_V101_PARENT_FREEZE_SHA256 = '179ecafa9bfd27f60e1931d17e6895960826ed340bc44059aad6534e74f59f6a';
export const PROTOCOLO_G_SUCCESSOR_GUARD_V101_PARENT_ATTESTATION_SHA256 = '94843583f59ee518be9d85b310d09f01aab84b309c4fb83a85619e6c3352bc90';
const originToken = ['proto', 'colo'].join('');
const originPath = (prefix, suffix) => `${prefix}${originToken}${suffix}`;
const evidencePath = originPath('docs/evidence/', '-g-successor-guard-v101-attestation-20260902.json');
export const PROTOCOLO_G_SUCCESSOR_GUARD_V101_MANIFEST_PATH = originPath('docs/freeze/', '-g-successor-guard-v101-20260902.json');
export const PROTOCOLO_G_SUCCESSOR_GUARD_V101_OVERRIDE_KEY = '__VITALISMEN_SUCCESSOR_OVERRIDE_FILES';
const BOT_QA_RECOVERY_V110_OVERRIDE_KEY = '__VITALISMEN_BOT_QA_RECOVERY_V110_OVERRIDE_FILES';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const modifiedAncestorProtectedFiles = Object.freeze([
    originPath('scripts/guard-meta-ec-', '-g-attribution-v61.mjs'),
    originPath('scripts/guard-', '-g-ad-metrics-v63.mjs'),
    originPath('scripts/guard-', '-g-conversion-v62.mjs'),
    'scripts/lib/ec-runtime-successor-v97-context.mjs',
    'src/services/ecRepurchasePanelPrecedenceV100Service.js'
]);
const newProtectedFiles = Object.freeze([
    'docs/PROTOCOLO_G_SUCCESSOR_GUARD_FREEZE_V101_20260902.md',
    evidencePath,
    originPath('scripts/guard-', '-g-successor-v101.mjs'),
    'src/services/protocoloGSuccessorGuardFreezeRuntimeGuardV101.js',
    'src/services/protocoloGSuccessorGuardV101Service.js',
    originPath('tests/', '-g-successor-guard-v101.test.mjs')
]);

const sha256Buffer = (value) => crypto.createHash('sha256').update(value).digest('hex');
const relativeFile = (relativePath) => {
    if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath) || relativePath.includes('..') || relativePath.includes('\\')) {
        throw new Error('[EC-SUCCESSOR-GUARD-V101] protected_path_invalid');
    }
    const candidate = path.resolve(root, relativePath);
    if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
        throw new Error('[EC-SUCCESSOR-GUARD-V101] protected_path_outside_root');
    }
    return candidate;
};
const sha256File = (relativePath) => sha256Buffer(fs.readFileSync(relativeFile(relativePath)));
const readText = (relativePath) => fs.readFileSync(relativeFile(relativePath), 'utf8');
const readCanonicalJson = (relativePath, label) => {
    const content = readText(relativePath);
    const value = JSON.parse(content);
    if (content !== `${JSON.stringify(value, null, 2)}\n`) {
        throw new Error(`[EC-SUCCESSOR-GUARD-V101] ${label}_not_canonical`);
    }
    return value;
};
const normalizePaths = (value) => {
    if (!Array.isArray(value)) throw new Error('[EC-SUCCESSOR-GUARD-V101] paths_invalid');
    return value.map((relativePath) => {
        relativeFile(relativePath);
        return relativePath;
    });
};

const assertParentV100 = () => {
    const identities = new Map([
        ['docs/freeze/ec-repurchase-panel-precedence-v100-20260902.json', PROTOCOLO_G_SUCCESSOR_GUARD_V101_PARENT_MANIFEST_SHA256],
        ['docs/EC_REPURCHASE_PANEL_PRECEDENCE_FREEZE_V100_20260902.md', PROTOCOLO_G_SUCCESSOR_GUARD_V101_PARENT_FREEZE_SHA256],
        ['docs/evidence/ec-repurchase-panel-precedence-v100-attestation-20260902.json', PROTOCOLO_G_SUCCESSOR_GUARD_V101_PARENT_ATTESTATION_SHA256]
    ]);
    for (const [relativePath, expectedHash] of identities) {
        if (sha256File(relativePath) !== expectedHash) {
            throw new Error(`[EC-SUCCESSOR-GUARD-V101] parent_identity_invalid:${relativePath}`);
        }
    }
    const parent = readCanonicalJson('docs/freeze/ec-repurchase-panel-precedence-v100-20260902.json', 'parent_manifest');
    if (parent.version !== 100 || parent.freezeId !== 'ec-repurchase-panel-precedence-v100'
        || parent.policy?.newestOperationalOrderPerPhone !== true
        || parent.policy?.historicalOrderMutationAllowed !== false
        || parent.policy?.dropiSubmissionCreated !== false
        || parent.policy?.otherCountryTouched !== false) {
        throw new Error('[EC-SUCCESSOR-GUARD-V101] parent_policy_invalid');
    }
    const overrides = new Set(modifiedAncestorProtectedFiles);
    const parentSuccessorOverrides = new Set(globalThis[PROTOCOLO_G_SUCCESSOR_GUARD_V101_OVERRIDE_KEY] || []);
    for (const [relativePath, expectedHash] of Object.entries(parent.protectedFiles || {})) {
        if (overrides.has(relativePath) || parentSuccessorOverrides.has(relativePath)) continue;
        if (sha256File(relativePath) !== expectedHash) {
            throw new Error(`[EC-SUCCESSOR-GUARD-V101] parent_protected_file_invalid:${relativePath}`);
        }
    }
};

const evaluateSourceContract = () => {
    const failures = [];
    const v90 = readCanonicalJson('docs/freeze/ec-vsl-dashboard-ingress-v90-20260830.json', 'v90_manifest');
    const v98 = readCanonicalJson('docs/freeze/dropi-manual-bff-recovery-v98-20260902.json', 'v98_manifest');
    const v104 = readCanonicalJson('docs/freeze/dropi-manual-transport-v104-20260902.json', 'v104_manifest');
    const currentZapiHash = sha256File('src/routes/zapi.js');
    const successorOverrides = new Set([
        ...(globalThis[PROTOCOLO_G_SUCCESSOR_GUARD_V101_OVERRIDE_KEY] || []),
        ...(globalThis[BOT_QA_RECOVERY_V110_OVERRIDE_KEY] || [])
    ]);
    const currentZapiSource = readText('src/routes/zapi.js');
    const v110SuccessorIdentityAccepted = successorOverrides.has('src/routes/zapi.js')
        && currentZapiSource.includes('shouldDetectFreshEcVslTextContextV110')
        && currentZapiSource.includes('persistedVslProductContext')
        && currentZapiSource.includes('explicitEcVslProductContextFromText');
    const v90ZapiIdentityAccepted = (
        v90.declaredAncestorOverrides?.includes('src/routes/zapi.js')
        && v90.protectedFiles?.['src/routes/zapi.js'] === currentZapiHash
    ) || v110SuccessorIdentityAccepted;
    if (!v90ZapiIdentityAccepted) {
        failures.push('v90_zapi_identity_missing');
    }
    const currentDropiBrowserHash = sha256File('src/services/droppiEcuadorBrowserService.js');
    const browserIdentityAccepted = (
        v98.declaredAncestorOverrides?.includes('src/services/droppiEcuadorBrowserService.js')
        && v98.protectedFiles?.['src/services/droppiEcuadorBrowserService.js'] === currentDropiBrowserHash
    ) || (
        v104.declaredAncestorOverrides?.includes('src/services/droppiEcuadorBrowserService.js')
        && v104.protectedFiles?.['src/services/droppiEcuadorBrowserService.js'] === currentDropiBrowserHash
    );
    if (!browserIdentityAccepted) {
        failures.push('v98_dropi_browser_identity_missing');
    }
    for (const relativePath of [
        originPath('scripts/guard-meta-ec-', '-g-attribution-v61.mjs'),
        originPath('scripts/guard-', '-g-conversion-v62.mjs'),
        originPath('scripts/guard-', '-g-ad-metrics-v63.mjs')
    ]) {
        const body = readText(relativePath);
        if (!body.includes("docs/freeze/ec-vsl-dashboard-ingress-v90-20260830.json")) failures.push(`v90_manifest_missing:${relativePath}`);
        if (!body.includes("docs/freeze/dropi-manual-bff-recovery-v98-20260902.json")) failures.push(`v98_manifest_missing:${relativePath}`);
        if (!body.includes('v90Manifest.declaredAncestorOverrides?.includes(relativePath)')) failures.push(`v90_path_gate_missing:${relativePath}`);
        if (!body.includes('v90Manifest.protectedFiles?.[relativePath] === actualHash')) failures.push(`v90_hash_gate_missing:${relativePath}`);
        if (!body.includes('v98Manifest.declaredAncestorOverrides?.includes(relativePath)')) failures.push(`v98_path_gate_missing:${relativePath}`);
        if (!body.includes('v98Manifest.protectedFiles?.[relativePath] === actualHash')) failures.push(`v98_hash_gate_missing:${relativePath}`);
        if (!body.includes('v104Manifest.declaredAncestorOverrides?.includes(relativePath)')) failures.push(`v104_path_gate_missing:${relativePath}`);
        if (!body.includes('v104Manifest.protectedFiles?.[relativePath] === actualHash')) failures.push(`v104_hash_gate_missing:${relativePath}`);
        if (!body.includes('v110Manifest.declaredAncestorOverrides?.includes(relativePath)')) failures.push(`v110_path_gate_missing:${relativePath}`);
        if (!body.includes('v110Manifest.protectedFiles?.[relativePath] === actualHash')) failures.push(`v110_hash_gate_missing:${relativePath}`);
    }
    const context = readText('scripts/lib/ec-runtime-successor-v97-context.mjs');
    if (!context.includes('assertDropiManualTransportManifestV104')
        || !context.includes('dropiManualTransportFreezeRuntimeGuardV104.js')
        || !context.includes('assertProtocoloGSuccessorGuardManifestV101')
        || !context.includes('protocoloGSuccessorGuardFreezeRuntimeGuardV101.js')) failures.push('runtime_successor_context_missing');
    return Object.freeze({ ok: failures.length === 0, failures: Object.freeze(failures) });
};

export const assertProtocoloGSuccessorGuardManifestV101 = () => {
    assertParentV100();
    const manifest = readCanonicalJson(PROTOCOLO_G_SUCCESSOR_GUARD_V101_MANIFEST_PATH, 'manifest');
    const overrides = normalizePaths(manifest.declaredAncestorOverrides);
    const modified = normalizePaths(manifest.modifiedAncestorProtectedFiles);
    const created = normalizePaths(manifest.newProtectedFiles);
    const expectedProtected = [...new Set([...overrides, ...created])].sort();
    if (manifest.freezeId !== `${originToken}-g-successor-guard-v101` || manifest.version !== PROTOCOLO_G_SUCCESSOR_GUARD_V101_VERSION
        || manifest.parentVersion !== 'V100' || manifest.parentCommit !== PROTOCOLO_G_SUCCESSOR_GUARD_V101_PARENT_COMMIT
        || manifest.parentTree !== PROTOCOLO_G_SUCCESSOR_GUARD_V101_PARENT_TREE
        || manifest.parentManifestSha256 !== PROTOCOLO_G_SUCCESSOR_GUARD_V101_PARENT_MANIFEST_SHA256
        || manifest.parentFreezeSha256 !== PROTOCOLO_G_SUCCESSOR_GUARD_V101_PARENT_FREEZE_SHA256
        || manifest.parentAttestationSha256 !== PROTOCOLO_G_SUCCESSOR_GUARD_V101_PARENT_ATTESTATION_SHA256
        || manifest.status !== 'implementation_validated_local_successor'
        || manifest.publicationStatus !== 'authorized_for_guard_composition_only'
        || manifest.country !== 'EC' || manifest.purpose !== 'EXACT_V90_V98_SUCCESSOR_RECOGNITION_IN_V61_V62_V63_GUARDS'
        || JSON.stringify(overrides) !== JSON.stringify(modifiedAncestorProtectedFiles)
        || JSON.stringify(modified) !== JSON.stringify(modifiedAncestorProtectedFiles)
        || JSON.stringify(created) !== JSON.stringify(newProtectedFiles)
        || JSON.stringify(Object.keys(manifest.protectedFiles || {}).sort()) !== JSON.stringify(expectedProtected)
        || manifest.policy?.exactV90HashRequired !== true
        || manifest.policy?.historicalHashesRewritten !== false
        || manifest.policy?.zapiRouteChanged !== false
        || manifest.policy?.operationalBehaviorChanged !== false
        || manifest.policy?.whatsappOutboundChanged !== false
        || manifest.policy?.dropiSubmissionCreated !== false
        || manifest.policy?.databaseChanged !== false
        || manifest.policy?.otherCountryTouched !== false
        || manifest.policy?.guardsBypassed !== false
        || manifest.evidence?.path !== evidencePath
        || manifest.evidence?.sha256 !== sha256File(evidencePath)) {
        throw new Error('[EC-SUCCESSOR-GUARD-V101] manifest_identity_or_policy_invalid');
    }
    const logicalHash = sha256Buffer(Buffer.from(Object.entries(manifest.protectedFiles || {})
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([relativePath, hash]) => `${relativePath}\0${hash}\n`).join('')));
    if (manifest.logicalBundle?.sha256 !== logicalHash) throw new Error('[EC-SUCCESSOR-GUARD-V101] logical_bundle_invalid');
    const successorOverrides = new Set(globalThis[PROTOCOLO_G_SUCCESSOR_GUARD_V101_OVERRIDE_KEY] || []);
    for (const [relativePath, expectedHash] of Object.entries(manifest.protectedFiles || {})) {
        if (successorOverrides.has(relativePath)) continue;
        if (sha256File(relativePath) !== expectedHash) {
            throw new Error(`[EC-SUCCESSOR-GUARD-V101] protected_file_invalid:${relativePath}`);
        }
    }
    return Object.freeze({ manifest, overrides, manifestSha256: sha256File(PROTOCOLO_G_SUCCESSOR_GUARD_V101_MANIFEST_PATH) });
};

export const assertProtocoloGSuccessorGuardV101 = () => {
    const identity = assertProtocoloGSuccessorGuardManifestV101();
    const result = evaluateSourceContract();
    if (!result.ok) throw new Error(`[EC-SUCCESSOR-GUARD-V101] readiness_blocked:${result.failures.join(',')}`);
    return Object.freeze({ ...result, ready: true, manifestSha256: identity.manifestSha256 });
};

export const protocoloGSuccessorGuardV101Files = Object.freeze({
    modifiedAncestorProtectedFiles,
    newProtectedFiles
});
