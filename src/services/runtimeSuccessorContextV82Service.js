import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RUNTIME_SUCCESSOR_CONTEXT_V82_PARENT_COMMIT = 'c2f6bedbd2327a2b41bfc0cb2bdb9d789812cfc6';
export const RUNTIME_SUCCESSOR_CONTEXT_V82_PARENT_TREE = '93bb427cb06a1e8fbac8dac0f1c6086f104929cb';
export const RUNTIME_SUCCESSOR_CONTEXT_V82_PARENT_MANIFEST_SHA256 = '7951283864f1d429452442488bbf1563b1acb501a2be5b4edee096a249071031';
export const RUNTIME_SUCCESSOR_CONTEXT_V82_PARENT_FREEZE_SHA256 = 'd5e3c8e81888b958fa149817744aff5ae83173670ff90ca2cb04788fd15a9b30';
export const RUNTIME_SUCCESSOR_CONTEXT_V82_PARENT_ATTESTATION_SHA256 = 'e80b3415dda914272428d931cffe7d5aac7719b627c0c914936447ea65e7a68e';
export const RUNTIME_SUCCESSOR_CONTEXT_V82_MANIFEST_PATH = 'docs/freeze/runtime-successor-context-v82-20260829.json';
export const RUNTIME_SUCCESSOR_CONTEXT_V82_STATE_KEY = '__VITALISMEN_V82_RUNTIME_SUCCESSOR_CONTEXT_STATE';
export const RUNTIME_SUCCESSOR_CONTEXT_V82_OVERRIDE_KEY = '__VITALISMEN_SUCCESSOR_OVERRIDE_FILES';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sha256Buffer = (value) => crypto.createHash('sha256').update(value).digest('hex');
const sha256File = (file) => sha256Buffer(fs.readFileSync(file));
const readCanonicalJson = (file, label) => {
    const buffer = fs.readFileSync(file);
    const value = JSON.parse(buffer.toString('utf8'));
    const canonical = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
    if (!buffer.equals(canonical)) throw new Error(`[RUNTIME-SUCCESSOR-CONTEXT-V82] ${label}_not_canonical`);
    return value;
};
const relativeFile = (relativePath) => {
    if (typeof relativePath !== 'string' || relativePath.length === 0
        || path.isAbsolute(relativePath) || relativePath.includes('..') || relativePath.includes('\\')) {
        throw new Error('[RUNTIME-SUCCESSOR-CONTEXT-V82] protected_path_invalid');
    }
    const candidate = path.resolve(root, relativePath);
    if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
        throw new Error('[RUNTIME-SUCCESSOR-CONTEXT-V82] protected_path_outside_root');
    }
    return candidate;
};
const normalizeOverrides = (value) => {
    if (!Array.isArray(value)) throw new Error('[RUNTIME-SUCCESSOR-CONTEXT-V82] overrides_invalid');
    return value.map((relativePath) => {
        relativeFile(relativePath);
        return relativePath;
    });
};

export const assertRuntimeSuccessorContextManifestV82 = () => {
    const manifestPath = relativeFile(RUNTIME_SUCCESSOR_CONTEXT_V82_MANIFEST_PATH);
    const parentManifestPath = relativeFile('docs/freeze/npm-lifecycle-stage-envelope-compatibility-v81-20260829.json');
    const parentFreezePath = relativeFile('docs/NPM_LIFECYCLE_STAGE_ENVELOPE_COMPATIBILITY_FREEZE_V81_20260829.md');
    const parentAttestationPath = relativeFile('docs/evidence/npm-lifecycle-stage-envelope-v81-attestation-20260829.json');
    for (const required of [manifestPath, parentManifestPath, parentFreezePath, parentAttestationPath]) {
        if (!fs.existsSync(required)) throw new Error('[RUNTIME-SUCCESSOR-CONTEXT-V82] required_identity_file_missing');
    }
    const manifest = readCanonicalJson(manifestPath, 'manifest');
    const overrides = normalizeOverrides(manifest.declaredAncestorOverrides);
    const newProtected = normalizeOverrides(manifest.newProtectedFiles);
    const expectedProtected = [...new Set([...newProtected, ...overrides])].sort();
    if (
        sha256File(parentManifestPath) !== RUNTIME_SUCCESSOR_CONTEXT_V82_PARENT_MANIFEST_SHA256
        || sha256File(parentFreezePath) !== RUNTIME_SUCCESSOR_CONTEXT_V82_PARENT_FREEZE_SHA256
        || sha256File(parentAttestationPath) !== RUNTIME_SUCCESSOR_CONTEXT_V82_PARENT_ATTESTATION_SHA256
        || manifest.freezeId !== 'runtime-successor-context-v82'
        || manifest.version !== 82
        || manifest.parentVersion !== 'V81'
        || manifest.parentCommit !== RUNTIME_SUCCESSOR_CONTEXT_V82_PARENT_COMMIT
        || manifest.parentTree !== RUNTIME_SUCCESSOR_CONTEXT_V82_PARENT_TREE
        || manifest.purpose !== 'RUNTIME_SUCCESSOR_CONTEXT_BOOTSTRAP'
        || manifest.country !== 'EC'
        || JSON.stringify(overrides) !== '["src/index.js"]'
        || manifest.policy?.datasetId !== '1468946114265008'
        || manifest.policy?.botBusinessLogicChanged !== false
        || manifest.policy?.ctaChanged !== false
        || manifest.policy?.mutatingSchedulersAllowed !== false
        || manifest.policy?.dropiApplyAllowed !== false
        || manifest.policy?.metaPurchaseAllowed !== false
        || manifest.policy?.realCustomerTrafficAuthorized !== false
        || JSON.stringify(Object.keys(manifest.protectedFiles || {}).sort()) !== JSON.stringify(expectedProtected)
    ) {
        throw new Error('[RUNTIME-SUCCESSOR-CONTEXT-V82] manifest_identity_or_policy_invalid');
    }
    const logicalBundleSha256 = sha256Buffer(Buffer.from(
        Object.entries(manifest.protectedFiles || {})
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([relativePath, fileHash]) => `${relativePath}\0${fileHash}\n`)
            .join('')
    ));
    if (manifest.logicalBundle?.sha256 !== logicalBundleSha256) {
        throw new Error('[RUNTIME-SUCCESSOR-CONTEXT-V82] logical_bundle_invalid');
    }
    for (const [relativePath, expectedHash] of Object.entries(manifest.protectedFiles || {})) {
        const file = relativeFile(relativePath);
        if (!fs.existsSync(file) || sha256File(file) !== expectedHash) {
            throw new Error(`[RUNTIME-SUCCESSOR-CONTEXT-V82] protected_file_invalid:${relativePath}`);
        }
    }
    return Object.freeze({ manifest, manifestSha256: sha256File(manifestPath), overrides });
};

export const installRuntimeSuccessorContextV82 = ({ mode = 'runtime' } = {}) => {
    if (!['runtime', 'official_guard'].includes(mode)) {
        throw new Error('[RUNTIME-SUCCESSOR-CONTEXT-V82] mode_invalid');
    }
    const identity = assertRuntimeSuccessorContextManifestV82();
    const inherited = normalizeOverrides(globalThis[RUNTIME_SUCCESSOR_CONTEXT_V82_OVERRIDE_KEY] || []);
    const effectiveOverrides = [...new Set([...inherited, ...identity.overrides])];
    globalThis[RUNTIME_SUCCESSOR_CONTEXT_V82_OVERRIDE_KEY] = effectiveOverrides;
    const state = Object.freeze({
        version: 82,
        mode,
        canonicalRoot: root,
        manifestSha256: identity.manifestSha256,
        effectiveOverrides: Object.freeze([...effectiveOverrides])
    });
    globalThis[RUNTIME_SUCCESSOR_CONTEXT_V82_STATE_KEY] = state;
    return state;
};
