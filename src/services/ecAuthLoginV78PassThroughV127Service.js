import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const EC_AUTH_LOGIN_V78_PASS_THROUGH_V127_VERSION = 127;
export const EC_AUTH_LOGIN_V78_PASS_THROUGH_V127_MANIFEST_PATH = 'docs/freeze/ec-auth-login-v78-pass-through-v127-20260904.json';
export const EC_AUTH_LOGIN_V78_PASS_THROUGH_V127_PARENT_COMMIT = '475ab887656bbb8865f3c16e42bec0d63e9421a6';
export const EC_AUTH_LOGIN_V78_PASS_THROUGH_V127_PARENT_TREE = '9cc5f631db2d2cf1925d82703478cdda18921386';
export const EC_AUTH_LOGIN_V78_PASS_THROUGH_V127_PARENT_MANIFEST_SHA256 = 'b62f84f9940f0e4fa9e911f79254bdfe40f8a9f3a346002d46add2910a33f2d7';
export const EC_AUTH_LOGIN_V78_PASS_THROUGH_V127_FREEZE_SHA256 = '8f88681afda1c73b93c246361ec5ece3a83a523658d1838f36fe41a321d59b3b';
export const EC_AUTH_LOGIN_V78_PASS_THROUGH_V127_ATTESTATION_SHA256 = '9071388479348e1fc0f45f2286a8aef777a7c12ae80589b3d491c521038f9d0e';
export const EC_AUTH_LOGIN_V78_PASS_THROUGH_V127_OVERRIDE_KEY = '__VITALISMEN_SUCCESSOR_OVERRIDE_FILES';

export const EC_AUTH_LOGIN_V78_PASS_THROUGH_V127_ANCESTOR_OVERRIDES = Object.freeze([
    '.github/workflows/ec-panel-quality.yml',
    'scripts/lib/ec-runtime-successor-v97-context.mjs',
    'src/services/ecBotCoreRuntimeIntegrationV78Service.js'
]);

export const EC_AUTH_LOGIN_V78_PASS_THROUGH_V127_NEW_PROTECTED_FILES = Object.freeze([
    'docs/EC_AUTH_LOGIN_V78_PASS_THROUGH_FREEZE_V127_20260904.md',
    'docs/evidence/ec-auth-login-v78-pass-through-v127-attestation-20260904.json',
    'scripts/guard-ec-auth-login-v78-pass-through-v127.mjs',
    'src/services/ecAuthLoginV78PassThroughFreezeRuntimeGuardV127.js',
    'src/services/ecAuthLoginV78PassThroughV127Service.js',
    'tests/ec-auth-login-v78-pass-through.test.mjs'
]);

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const relativeFile = (relativePath) => {
    if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath)
        || relativePath.includes('..') || relativePath.includes('\\')) {
        throw new Error('[EC-AUTH-LOGIN-V127] protected_path_invalid');
    }
    const candidate = path.resolve(projectRoot, relativePath);
    if (candidate !== projectRoot && !candidate.startsWith(`${projectRoot}${path.sep}`)) {
        throw new Error('[EC-AUTH-LOGIN-V127] protected_path_outside_root');
    }
    return candidate;
};
const fileSha256 = (relativePath) => sha256(fs.readFileSync(relativeFile(relativePath)));
const canonicalJson = (relativePath, label) => {
    const content = fs.readFileSync(relativeFile(relativePath), 'utf8');
    const value = JSON.parse(content);
    if (content !== `${JSON.stringify(value, null, 2)}\n`) {
        throw new Error(`[EC-AUTH-LOGIN-V127] ${label}_not_canonical`);
    }
    return value;
};
const normalizePaths = (value) => {
    if (!Array.isArray(value)) throw new Error('[EC-AUTH-LOGIN-V127] paths_invalid');
    return value.map((relativePath) => {
        relativeFile(relativePath);
        return relativePath;
    });
};

const assertParentV125 = () => {
    const parentPath = 'docs/freeze/ec-panel-status-state-layer-v125-20260904.json';
    if (fileSha256(parentPath) !== EC_AUTH_LOGIN_V78_PASS_THROUGH_V127_PARENT_MANIFEST_SHA256) {
        throw new Error('[EC-AUTH-LOGIN-V127] parent_manifest_identity_invalid');
    }
    const parent = canonicalJson(parentPath, 'parent_manifest');
    if (parent.version !== 125
        || parent.freezeId !== 'ec-panel-status-state-layer-v125'
        || parent.policy?.operatorStatusAlwaysPersists !== true
        || parent.policy?.incompleteOrderRemainsBlocked !== true
        || parent.policy?.genericOrderRoutesAllowed !== false
        || parent.policy?.whatsappOutboundChanged !== false
        || parent.policy?.dropiChanged !== false
        || parent.policy?.postSaleChanged !== false
        || parent.policy?.metaChanged !== false) {
        throw new Error('[EC-AUTH-LOGIN-V127] parent_policy_invalid');
    }
    const modified = new Set(EC_AUTH_LOGIN_V78_PASS_THROUGH_V127_ANCESTOR_OVERRIDES);
    const successorOverrides = new Set(globalThis[EC_AUTH_LOGIN_V78_PASS_THROUGH_V127_OVERRIDE_KEY] || []);
    for (const [relativePath, expectedHash] of Object.entries(parent.protectedFiles || {})) {
        if (modified.has(relativePath) || successorOverrides.has(relativePath)) continue;
        if (fileSha256(relativePath) !== expectedHash) {
            throw new Error(`[EC-AUTH-LOGIN-V127] parent_protected_file_invalid:${relativePath}`);
        }
    }
};

export const assertEcAuthLoginV78PassThroughV127Manifest = () => {
    assertParentV125();
    const manifest = canonicalJson(EC_AUTH_LOGIN_V78_PASS_THROUGH_V127_MANIFEST_PATH, 'manifest');
    const overrides = normalizePaths(manifest.declaredAncestorOverrides);
    const newProtected = normalizePaths(manifest.newProtectedFiles);
    const expectedPaths = [...new Set([...overrides, ...newProtected])].sort();
    if (manifest.freezeId !== 'ec-auth-login-v78-pass-through-v127'
        || manifest.version !== EC_AUTH_LOGIN_V78_PASS_THROUGH_V127_VERSION
        || manifest.parentVersion !== 'V125_PRODUCTION_BASELINE'
        || manifest.parentFreezeId !== 'ec-panel-status-state-layer-v125'
        || manifest.parentCommit !== EC_AUTH_LOGIN_V78_PASS_THROUGH_V127_PARENT_COMMIT
        || manifest.parentTree !== EC_AUTH_LOGIN_V78_PASS_THROUGH_V127_PARENT_TREE
        || manifest.parentManifestSha256 !== EC_AUTH_LOGIN_V78_PASS_THROUGH_V127_PARENT_MANIFEST_SHA256
        || manifest.purpose !== 'ALLOW_EXACT_EXISTING_PANEL_LOGIN_THROUGH_V78'
        || manifest.status !== 'implementation_validated_local_successor'
        || manifest.publicationStatus !== 'local_candidate_pending_staging_and_auth_approval'
        || manifest.country !== 'EC'
        || JSON.stringify(overrides) !== JSON.stringify(EC_AUTH_LOGIN_V78_PASS_THROUGH_V127_ANCESTOR_OVERRIDES)
        || JSON.stringify(manifest.modifiedAncestorProtectedFiles) !== JSON.stringify(EC_AUTH_LOGIN_V78_PASS_THROUGH_V127_ANCESTOR_OVERRIDES)
        || JSON.stringify(newProtected) !== JSON.stringify(EC_AUTH_LOGIN_V78_PASS_THROUGH_V127_NEW_PROTECTED_FILES)
        || JSON.stringify(Object.keys(manifest.protectedFiles || {}).sort()) !== JSON.stringify(expectedPaths)
        || manifest.policy?.exactMethod !== 'POST'
        || manifest.policy?.exactPath !== '/api/auth/login'
        || manifest.policy?.genericAuthRoutesAllowed !== false
        || manifest.policy?.allowedMongoCollection !== 'users'
        || manifest.policy?.allowedMongoMethod !== 'updateOne'
        || manifest.policy?.writeContextEnabled !== false
        || manifest.policy?.authenticationImplementationChanged !== false
        || manifest.policy?.externalEffectsAllowed !== false
        || manifest.policy?.databaseMigration !== false
        || manifest.policy?.historicalBackfillAllowed !== false
        || manifest.policy?.productionMutationAuthorized !== false
        || manifest.evidence?.sha256 !== EC_AUTH_LOGIN_V78_PASS_THROUGH_V127_ATTESTATION_SHA256
        || fileSha256(manifest.evidence.path) !== manifest.evidence.sha256
        || fileSha256('docs/EC_AUTH_LOGIN_V78_PASS_THROUGH_FREEZE_V127_20260904.md') !== EC_AUTH_LOGIN_V78_PASS_THROUGH_V127_FREEZE_SHA256) {
        throw new Error('[EC-AUTH-LOGIN-V127] manifest_identity_or_policy_invalid');
    }
    const successorOverrides = new Set(globalThis[EC_AUTH_LOGIN_V78_PASS_THROUGH_V127_OVERRIDE_KEY] || []);
    for (const relativePath of expectedPaths) {
        if (!successorOverrides.has(relativePath) && fileSha256(relativePath) !== manifest.protectedFiles[relativePath]) {
            throw new Error(`[EC-AUTH-LOGIN-V127] protected_file_invalid:${relativePath}`);
        }
    }
    const logical = expectedPaths.map((relativePath) => (
        `${relativePath}\0${successorOverrides.has(relativePath) ? manifest.protectedFiles[relativePath] : fileSha256(relativePath)}\n`
    )).join('');
    if (manifest.logicalBundle?.sha256 !== sha256(logical)) {
        throw new Error('[EC-AUTH-LOGIN-V127] logical_bundle_invalid');
    }
    return Object.freeze({ ready: true, failures: [], manifest, overrides });
};
