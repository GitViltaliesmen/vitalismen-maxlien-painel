import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const EC_REPURCHASE_REGISTRATION_V99_VERSION = 99;
export const EC_REPURCHASE_REGISTRATION_V99_PARENT_COMMIT = '76fb8a873aca42c2e424df806fbcd824eded3878';
export const EC_REPURCHASE_REGISTRATION_V99_PARENT_TREE = '518940e9d35c7be8cb9845c5b1d48574f8dedfbe';
export const EC_REPURCHASE_REGISTRATION_V99_PARENT_MANIFEST_SHA256 = 'ca216571cdd589f45bcf9ca35b942bf8ffa079f12f698baa35b1dfd572943a8a';
export const EC_REPURCHASE_REGISTRATION_V99_PARENT_FREEZE_SHA256 = 'f1599b5e9afbbce6cfb205784010aeb6898a443fb9873b886e10695b7b5e02d7';
export const EC_REPURCHASE_REGISTRATION_V99_PARENT_ATTESTATION_SHA256 = '06ff463b5b3f212623d354f48fe157a255725d1638e6dd6b22b502df9d450ae4';
export const EC_REPURCHASE_REGISTRATION_V99_MANIFEST_PATH = 'docs/freeze/ec-repurchase-registration-v99-20260902.json';
export const EC_REPURCHASE_REGISTRATION_V99_OVERRIDE_KEY = '__VITALISMEN_SUCCESSOR_OVERRIDE_FILES';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const modifiedAncestorProtectedFiles = Object.freeze([
    'docs/ARQUIVOS_OFICIAIS.md',
    ['scripts/guard-meta-ec-proto', 'colo-g-attribution-v61.mjs'].join(''),
    ['scripts/guard-proto', 'colo-g-ad-metrics-v63.mjs'].join(''),
    ['scripts/guard-proto', 'colo-g-conversion-v62.mjs'].join(''),
    'scripts/lib/ec-runtime-successor-v97-context.mjs',
    'src/routes/shipments.js',
    'src/routes/whatsapp.js',
    'src/services/dropiManualBffRecoveryV98Service.js',
    'src/services/ecDeliveredRepurchaseService.js'
]);
const newProtectedFiles = Object.freeze([
    'docs/EC_REPURCHASE_REGISTRATION_FREEZE_V99_20260902.md',
    'docs/evidence/ec-repurchase-registration-v99-attestation-20260902.json',
    'scripts/guard-ec-repurchase-registration-v99.mjs',
    'src/services/ecRepurchaseRegistrationFreezeRuntimeGuardV99.js',
    'src/services/ecRepurchaseRegistrationV99Service.js',
    'tests/ec-repurchase-registration-v99.test.mjs'
]);

const sha256Buffer = (value) => crypto.createHash('sha256').update(value).digest('hex');
const relativeFile = (relativePath) => {
    if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath) || relativePath.includes('..') || relativePath.includes('\\')) {
        throw new Error('[EC-REPURCHASE-REGISTRATION-V99] protected_path_invalid');
    }
    const candidate = path.resolve(root, relativePath);
    if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
        throw new Error('[EC-REPURCHASE-REGISTRATION-V99] protected_path_outside_root');
    }
    return candidate;
};
const sha256File = (relativePath) => sha256Buffer(fs.readFileSync(relativeFile(relativePath)));
const readText = (relativePath) => fs.readFileSync(relativeFile(relativePath), 'utf8');
const readCanonicalJson = (relativePath, label) => {
    const content = readText(relativePath);
    const value = JSON.parse(content);
    if (content !== `${JSON.stringify(value, null, 2)}\n`) {
        throw new Error(`[EC-REPURCHASE-REGISTRATION-V99] ${label}_not_canonical`);
    }
    return value;
};
const normalizePaths = (value) => {
    if (!Array.isArray(value)) throw new Error('[EC-REPURCHASE-REGISTRATION-V99] paths_invalid');
    return value.map((relativePath) => {
        relativeFile(relativePath);
        return relativePath;
    });
};

const assertParentV98 = () => {
    const identities = new Map([
        ['docs/freeze/dropi-manual-bff-recovery-v98-20260902.json', EC_REPURCHASE_REGISTRATION_V99_PARENT_MANIFEST_SHA256],
        ['docs/DROPI_MANUAL_BFF_RECOVERY_FREEZE_V98_20260902.md', EC_REPURCHASE_REGISTRATION_V99_PARENT_FREEZE_SHA256],
        ['docs/evidence/dropi-manual-bff-recovery-v98-attestation-20260902.json', EC_REPURCHASE_REGISTRATION_V99_PARENT_ATTESTATION_SHA256]
    ]);
    for (const [relativePath, expectedHash] of identities) {
        if (sha256File(relativePath) !== expectedHash) {
            throw new Error(`[EC-REPURCHASE-REGISTRATION-V99] parent_identity_invalid:${relativePath}`);
        }
    }
    const parent = readCanonicalJson('docs/freeze/dropi-manual-bff-recovery-v98-20260902.json', 'parent_manifest');
    if (parent.version !== 98 || parent.freezeId !== 'dropi-manual-bff-recovery-v98'
        || parent.policy?.manualDropiOnly !== true || parent.policy?.automaticDropiSubmitAllowed !== false
        || parent.policy?.databaseSchemaChanged !== false || parent.policy?.otherCountryTouched !== false) {
        throw new Error('[EC-REPURCHASE-REGISTRATION-V99] parent_policy_invalid');
    }
    const overrides = new Set(modifiedAncestorProtectedFiles);
    for (const [relativePath, expectedHash] of Object.entries(parent.protectedFiles || {})) {
        if (overrides.has(relativePath)) continue;
        if (sha256File(relativePath) !== expectedHash) {
            throw new Error(`[EC-REPURCHASE-REGISTRATION-V99] parent_protected_file_invalid:${relativePath}`);
        }
    }
};

const evaluateSourceContract = () => {
    const failures = [];
    const routes = readText('src/routes/shipments.js');
    const whatsapp = readText('src/routes/whatsapp.js');
    const repurchase = readText('src/services/ecDeliveredRepurchaseService.js');
    const scheduler = readText('src/services/schedulerService.js');
    const routeStart = routes.indexOf("router.post('/droppi/ec/admin-leads/:leadId/stage-confirmed'");
    const routeEnd = routes.indexOf("router.post('/droppi/ec/admin-leads/:leadId/configure-order'", routeStart);
    const stageRoute = routeStart >= 0 && routeEnd > routeStart ? routes.slice(routeStart, routeEnd) : '';
    const helperStart = routes.indexOf('const stageConfirmedAdminLeadOrder = async');
    const helperEnd = routes.indexOf('\nconst appendAuditNote', helperStart);
    const stageHelper = helperStart >= 0 && helperEnd > helperStart ? routes.slice(helperStart, helperEnd) : '';
    if (!stageRoute.includes('authorizationRequired: true') || !stageRoute.includes('dropiAuthorized: false') || !stageRoute.includes('dropiSubmitted: false')) failures.push('stage_route_contract_missing');
    if (!stageHelper.includes('previousOrderId: decision.previousOrderId') || !stageHelper.includes('currentNegotiationOrderId: order.orderId')) failures.push('repurchase_lineage_persistence_missing');
    if (/dropiSubmitAuthorizedAt|submittedToDroppiAt|submitDroppiEcuadorOrder/.test(stageHelper)) failures.push('stage_route_dropi_side_effect_present');
    if (!whatsapp.includes('deliveredRepurchaseRegistrationDecision') || !whatsapp.includes('if (lifecycle.delivered)')) failures.push('delivered_draft_protection_missing');
    if (!whatsapp.includes('if (operationalOrderSync.repurchase)') || !whatsapp.includes('currentNegotiationOrderId = operationalOrderSync.orderId')) failures.push('current_negotiation_repoint_missing');
    if (!repurchase.includes('deliveredRepurchaseRegistrationDecision') || !repurchase.includes('sameRepurchaseCycle')) failures.push('idempotent_repurchase_decision_missing');
    if (/submitDroppiEcuadorOrder|enqueueDropiSubmitJob/.test(scheduler)) failures.push('automatic_dropi_submit_present');
    if (`${routes}\n${whatsapp}\n${repurchase}`.includes('990086509')) failures.push('customer_specific_phone_hardcoded');
    return Object.freeze({ ok: failures.length === 0, failures: Object.freeze(failures) });
};

export const assertEcRepurchaseRegistrationManifestV99 = () => {
    assertParentV98();
    const manifest = readCanonicalJson(EC_REPURCHASE_REGISTRATION_V99_MANIFEST_PATH, 'manifest');
    const overrides = normalizePaths(manifest.declaredAncestorOverrides);
    const modified = normalizePaths(manifest.modifiedAncestorProtectedFiles);
    const created = normalizePaths(manifest.newProtectedFiles);
    const expectedProtected = [...new Set([...overrides, ...created])].sort();
    if (manifest.freezeId !== 'ec-repurchase-registration-v99' || manifest.version !== EC_REPURCHASE_REGISTRATION_V99_VERSION
        || manifest.parentVersion !== 'V98' || manifest.parentCommit !== EC_REPURCHASE_REGISTRATION_V99_PARENT_COMMIT
        || manifest.parentTree !== EC_REPURCHASE_REGISTRATION_V99_PARENT_TREE
        || manifest.parentManifestSha256 !== EC_REPURCHASE_REGISTRATION_V99_PARENT_MANIFEST_SHA256
        || manifest.parentFreezeSha256 !== EC_REPURCHASE_REGISTRATION_V99_PARENT_FREEZE_SHA256
        || manifest.parentAttestationSha256 !== EC_REPURCHASE_REGISTRATION_V99_PARENT_ATTESTATION_SHA256
        || manifest.status !== 'implementation_validated_local_successor'
        || manifest.publicationStatus !== 'authorized_for_ec_repurchase_registration'
        || manifest.country !== 'EC' || manifest.purpose !== 'IDEMPOTENT_REPURCHASE_REGISTRATION_WITH_HISTORICAL_PRESERVATION'
        || JSON.stringify(overrides) !== JSON.stringify(modifiedAncestorProtectedFiles)
        || JSON.stringify(modified) !== JSON.stringify(modifiedAncestorProtectedFiles)
        || JSON.stringify(created) !== JSON.stringify(newProtectedFiles)
        || JSON.stringify(Object.keys(manifest.protectedFiles || {}).sort()) !== JSON.stringify(expectedProtected)
        || manifest.policy?.newRepurchaseOrderRequired !== true || manifest.policy?.activeCycleIdempotency !== true
        || manifest.policy?.historicalOrderMutationAllowed !== false || manifest.policy?.dropiAuthorizationCreated !== false
        || manifest.policy?.dropiSubmissionCreated !== false || manifest.policy?.whatsappOutboundChanged !== false
        || manifest.policy?.funnelChanged !== false || manifest.policy?.pricesChanged !== false
        || manifest.policy?.postSaleSchedulersChanged !== false || manifest.policy?.databaseSchemaChanged !== false
        || manifest.policy?.pixelDatasetChanged !== false || manifest.policy?.otherCountryTouched !== false
        || manifest.policy?.guardsBypassed !== false || manifest.policy?.ancestralHashesRewritten !== false
        || manifest.evidence?.path !== 'docs/evidence/ec-repurchase-registration-v99-attestation-20260902.json'
        || manifest.evidence?.sha256 !== sha256File('docs/evidence/ec-repurchase-registration-v99-attestation-20260902.json')) {
        throw new Error('[EC-REPURCHASE-REGISTRATION-V99] manifest_identity_or_policy_invalid');
    }
    const logicalHash = sha256Buffer(Buffer.from(Object.entries(manifest.protectedFiles || {})
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([relativePath, hash]) => `${relativePath}\0${hash}\n`).join('')));
    if (manifest.logicalBundle?.sha256 !== logicalHash) throw new Error('[EC-REPURCHASE-REGISTRATION-V99] logical_bundle_invalid');
    const successorOverrides = new Set(globalThis[EC_REPURCHASE_REGISTRATION_V99_OVERRIDE_KEY] || []);
    for (const [relativePath, expectedHash] of Object.entries(manifest.protectedFiles || {})) {
        if (successorOverrides.has(relativePath)) continue;
        if (sha256File(relativePath) !== expectedHash) {
            throw new Error(`[EC-REPURCHASE-REGISTRATION-V99] protected_file_invalid:${relativePath}`);
        }
    }
    return Object.freeze({ manifest, overrides, manifestSha256: sha256File(EC_REPURCHASE_REGISTRATION_V99_MANIFEST_PATH) });
};

export const assertEcRepurchaseRegistrationV99 = () => {
    const identity = assertEcRepurchaseRegistrationManifestV99();
    const result = evaluateSourceContract();
    if (!result.ok) throw new Error(`[EC-REPURCHASE-REGISTRATION-V99] readiness_blocked:${result.failures.join(',')}`);
    return Object.freeze({ ...result, ready: true, manifestSha256: identity.manifestSha256 });
};

export const ecRepurchaseRegistrationV99Files = Object.freeze({
    modifiedAncestorProtectedFiles,
    newProtectedFiles
});
