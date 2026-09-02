import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const EC_REPURCHASE_PANEL_PRECEDENCE_V100_VERSION = 100;
export const EC_REPURCHASE_PANEL_PRECEDENCE_V100_PARENT_COMMIT = 'de6a20072ea1deabbf68747dcb601912ce224cfb';
export const EC_REPURCHASE_PANEL_PRECEDENCE_V100_PARENT_TREE = '7ae6df021a55a5661a7c40fd4ac3cd86f170ca74';
export const EC_REPURCHASE_PANEL_PRECEDENCE_V100_PARENT_MANIFEST_SHA256 = '0bb88ffbee48c7807800b97539a7911e40f703e5056189363699d5401e6c6f82';
export const EC_REPURCHASE_PANEL_PRECEDENCE_V100_PARENT_FREEZE_SHA256 = '8d46da5a7b99964da8ad3b1095d0f174cbd727faf347fcae26a94931679cb72e';
export const EC_REPURCHASE_PANEL_PRECEDENCE_V100_PARENT_ATTESTATION_SHA256 = 'a2697c65902953afebc90f5040ea7d941f38da16a5fdad6621674fd517f34f79';
export const EC_REPURCHASE_PANEL_PRECEDENCE_V100_MANIFEST_PATH = 'docs/freeze/ec-repurchase-panel-precedence-v100-20260902.json';
export const EC_REPURCHASE_PANEL_PRECEDENCE_V100_OVERRIDE_KEY = '__VITALISMEN_SUCCESSOR_OVERRIDE_FILES';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const modifiedAncestorProtectedFiles = Object.freeze([
    'public/leads-window.html',
    'scripts/lib/ec-runtime-successor-v97-context.mjs',
    'src/services/ecRepurchaseRegistrationV99Service.js'
]);
const newProtectedFiles = Object.freeze([
    'docs/EC_REPURCHASE_PANEL_PRECEDENCE_FREEZE_V100_20260902.md',
    'docs/evidence/ec-repurchase-panel-precedence-v100-attestation-20260902.json',
    'scripts/guard-ec-repurchase-panel-precedence-v100.mjs',
    'src/services/ecRepurchasePanelPrecedenceFreezeRuntimeGuardV100.js',
    'src/services/ecRepurchasePanelPrecedenceV100Service.js',
    'tests/ec-repurchase-panel-precedence-v100.test.mjs'
]);

const sha256Buffer = (value) => crypto.createHash('sha256').update(value).digest('hex');
const relativeFile = (relativePath) => {
    if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath) || relativePath.includes('..') || relativePath.includes('\\')) {
        throw new Error('[EC-REPURCHASE-PANEL-PRECEDENCE-V100] protected_path_invalid');
    }
    const candidate = path.resolve(root, relativePath);
    if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
        throw new Error('[EC-REPURCHASE-PANEL-PRECEDENCE-V100] protected_path_outside_root');
    }
    return candidate;
};
const sha256File = (relativePath) => sha256Buffer(fs.readFileSync(relativeFile(relativePath)));
const readText = (relativePath) => fs.readFileSync(relativeFile(relativePath), 'utf8');
const readCanonicalJson = (relativePath, label) => {
    const content = readText(relativePath);
    const value = JSON.parse(content);
    if (content !== `${JSON.stringify(value, null, 2)}\n`) {
        throw new Error(`[EC-REPURCHASE-PANEL-PRECEDENCE-V100] ${label}_not_canonical`);
    }
    return value;
};
const normalizePaths = (value) => {
    if (!Array.isArray(value)) throw new Error('[EC-REPURCHASE-PANEL-PRECEDENCE-V100] paths_invalid');
    return value.map((relativePath) => {
        relativeFile(relativePath);
        return relativePath;
    });
};

const assertParentV99 = () => {
    const identities = new Map([
        ['docs/freeze/ec-repurchase-registration-v99-20260902.json', EC_REPURCHASE_PANEL_PRECEDENCE_V100_PARENT_MANIFEST_SHA256],
        ['docs/EC_REPURCHASE_REGISTRATION_FREEZE_V99_20260902.md', EC_REPURCHASE_PANEL_PRECEDENCE_V100_PARENT_FREEZE_SHA256],
        ['docs/evidence/ec-repurchase-registration-v99-attestation-20260902.json', EC_REPURCHASE_PANEL_PRECEDENCE_V100_PARENT_ATTESTATION_SHA256]
    ]);
    for (const [relativePath, expectedHash] of identities) {
        if (sha256File(relativePath) !== expectedHash) {
            throw new Error(`[EC-REPURCHASE-PANEL-PRECEDENCE-V100] parent_identity_invalid:${relativePath}`);
        }
    }
    const parent = readCanonicalJson('docs/freeze/ec-repurchase-registration-v99-20260902.json', 'parent_manifest');
    if (parent.version !== 99 || parent.freezeId !== 'ec-repurchase-registration-v99'
        || parent.policy?.newRepurchaseOrderRequired !== true
        || parent.policy?.historicalOrderMutationAllowed !== false
        || parent.policy?.dropiSubmissionCreated !== false
        || parent.policy?.otherCountryTouched !== false) {
        throw new Error('[EC-REPURCHASE-PANEL-PRECEDENCE-V100] parent_policy_invalid');
    }
    const overrides = new Set(modifiedAncestorProtectedFiles);
    for (const [relativePath, expectedHash] of Object.entries(parent.protectedFiles || {})) {
        if (overrides.has(relativePath)) continue;
        if (sha256File(relativePath) !== expectedHash) {
            throw new Error(`[EC-REPURCHASE-PANEL-PRECEDENCE-V100] parent_protected_file_invalid:${relativePath}`);
        }
    }
};

const evaluateSourceContract = () => {
    const failures = [];
    const panel = readText('public/leads-window.html');
    const orders = readText('src/routes/orders.js');
    const mergeStart = panel.indexOf('const mergeOperationalOrdersIntoLeads =');
    const mergeEnd = panel.indexOf('\n        const hydrateOperationalOrderLeads', mergeStart);
    const merge = mergeStart >= 0 && mergeEnd > mergeStart ? panel.slice(mergeStart, mergeEnd) : '';
    const duplicateGuard = 'if (tail && mergedPhoneTails.has(tail)) return;';
    const mergeLookup = 'const existingIndex = byOrderId.has(opsLead.orderId)';
    if (!merge.includes('const mergedPhoneTails = new Set()')) failures.push('phone_precedence_set_missing');
    if (!merge.includes(duplicateGuard) || merge.indexOf(duplicateGuard) > merge.indexOf(mergeLookup)) failures.push('historical_overwrite_guard_missing');
    if (!merge.includes('mergedPhoneTails.add(tail)')) failures.push('phone_precedence_registration_missing');
    if (!orders.includes('.sort({ entryAt: -1, createdAt: -1 })')) failures.push('newest_operational_order_sort_missing');
    if (panel.includes('990086509') || merge.includes('EC-RECOMPRA-MTKEFGCW-RZA8')) failures.push('customer_specific_data_hardcoded');
    return Object.freeze({ ok: failures.length === 0, failures: Object.freeze(failures) });
};

export const assertEcRepurchasePanelPrecedenceManifestV100 = () => {
    assertParentV99();
    const manifest = readCanonicalJson(EC_REPURCHASE_PANEL_PRECEDENCE_V100_MANIFEST_PATH, 'manifest');
    const overrides = normalizePaths(manifest.declaredAncestorOverrides);
    const modified = normalizePaths(manifest.modifiedAncestorProtectedFiles);
    const created = normalizePaths(manifest.newProtectedFiles);
    const expectedProtected = [...new Set([...overrides, ...created])].sort();
    if (manifest.freezeId !== 'ec-repurchase-panel-precedence-v100' || manifest.version !== EC_REPURCHASE_PANEL_PRECEDENCE_V100_VERSION
        || manifest.parentVersion !== 'V99' || manifest.parentCommit !== EC_REPURCHASE_PANEL_PRECEDENCE_V100_PARENT_COMMIT
        || manifest.parentTree !== EC_REPURCHASE_PANEL_PRECEDENCE_V100_PARENT_TREE
        || manifest.parentManifestSha256 !== EC_REPURCHASE_PANEL_PRECEDENCE_V100_PARENT_MANIFEST_SHA256
        || manifest.parentFreezeSha256 !== EC_REPURCHASE_PANEL_PRECEDENCE_V100_PARENT_FREEZE_SHA256
        || manifest.parentAttestationSha256 !== EC_REPURCHASE_PANEL_PRECEDENCE_V100_PARENT_ATTESTATION_SHA256
        || manifest.status !== 'implementation_validated_local_successor'
        || manifest.publicationStatus !== 'authorized_for_ec_repurchase_panel_precedence'
        || manifest.country !== 'EC' || manifest.purpose !== 'NEWEST_REPURCHASE_WINS_PANEL_PHONE_MERGE'
        || JSON.stringify(overrides) !== JSON.stringify(modifiedAncestorProtectedFiles)
        || JSON.stringify(modified) !== JSON.stringify(modifiedAncestorProtectedFiles)
        || JSON.stringify(created) !== JSON.stringify(newProtectedFiles)
        || JSON.stringify(Object.keys(manifest.protectedFiles || {}).sort()) !== JSON.stringify(expectedProtected)
        || manifest.policy?.newestOperationalOrderPerPhone !== true
        || manifest.policy?.historicalOrderOverwriteAllowed !== false
        || manifest.policy?.historicalOrderMutationAllowed !== false
        || manifest.policy?.dropiAuthorizationCreated !== false
        || manifest.policy?.dropiSubmissionCreated !== false
        || manifest.policy?.whatsappOutboundChanged !== false
        || manifest.policy?.funnelChanged !== false || manifest.policy?.pricesChanged !== false
        || manifest.policy?.databaseSchemaChanged !== false || manifest.policy?.pixelDatasetChanged !== false
        || manifest.policy?.otherCountryTouched !== false || manifest.policy?.guardsBypassed !== false
        || manifest.policy?.ancestralHashesRewritten !== false
        || manifest.evidence?.path !== 'docs/evidence/ec-repurchase-panel-precedence-v100-attestation-20260902.json'
        || manifest.evidence?.sha256 !== sha256File('docs/evidence/ec-repurchase-panel-precedence-v100-attestation-20260902.json')) {
        throw new Error('[EC-REPURCHASE-PANEL-PRECEDENCE-V100] manifest_identity_or_policy_invalid');
    }
    const logicalHash = sha256Buffer(Buffer.from(Object.entries(manifest.protectedFiles || {})
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([relativePath, hash]) => `${relativePath}\0${hash}\n`).join('')));
    if (manifest.logicalBundle?.sha256 !== logicalHash) throw new Error('[EC-REPURCHASE-PANEL-PRECEDENCE-V100] logical_bundle_invalid');
    for (const [relativePath, expectedHash] of Object.entries(manifest.protectedFiles || {})) {
        if (sha256File(relativePath) !== expectedHash) {
            throw new Error(`[EC-REPURCHASE-PANEL-PRECEDENCE-V100] protected_file_invalid:${relativePath}`);
        }
    }
    return Object.freeze({ manifest, overrides, manifestSha256: sha256File(EC_REPURCHASE_PANEL_PRECEDENCE_V100_MANIFEST_PATH) });
};

export const assertEcRepurchasePanelPrecedenceV100 = () => {
    const identity = assertEcRepurchasePanelPrecedenceManifestV100();
    const result = evaluateSourceContract();
    if (!result.ok) throw new Error(`[EC-REPURCHASE-PANEL-PRECEDENCE-V100] readiness_blocked:${result.failures.join(',')}`);
    return Object.freeze({ ...result, ready: true, manifestSha256: identity.manifestSha256 });
};

export const ecRepurchasePanelPrecedenceV100Files = Object.freeze({
    modifiedAncestorProtectedFiles,
    newProtectedFiles
});
