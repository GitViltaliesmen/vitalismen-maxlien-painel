import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    NPM_LIFECYCLE_PRELOAD_V80_OFFICIAL_EVENTS,
    NPM_LIFECYCLE_PRELOAD_V80_SUCCESSOR_KEY,
    classifyNpmLifecycleProcessV80,
    resolveCanonicalProjectRootV80
} from './npmLifecyclePreloadBootstrapV80Service.js';

export const NPM_LIFECYCLE_STAGE_ENVELOPE_V81_PARENT_COMMIT = 'e1396b1650b2a5e0cb556f2f47c5af91fe38452e';
export const NPM_LIFECYCLE_STAGE_ENVELOPE_V81_PARENT_TREE = 'bf51cbd2d8b60be11bfc75ca4a4ddaeb495cb8ec';
export const NPM_LIFECYCLE_STAGE_ENVELOPE_V81_PARENT_MANIFEST_SHA256 = '80039ccfc19d41cd6235da63316887e22e1a291bf7150a3c4b29d4a3b0ef828c';
export const NPM_LIFECYCLE_STAGE_ENVELOPE_V81_PARENT_FREEZE_SHA256 = 'ae08bc04d41c524c829a322da7c179ff80ea97c7d12ff0da7539b52d400f1eb8';
export const NPM_LIFECYCLE_STAGE_ENVELOPE_V81_PARENT_ATTESTATION_SHA256 = '45c218e2edb1dc80f97ad1caaa8df594268b7097daf8b3756e0a1c6aa63ff482';
export const NPM_LIFECYCLE_STAGE_ENVELOPE_V81_HELPER_SHA256 = 'ff3d9c5ac129a98902b12ecda443cf97876b32142561ad46c70f3540c87c5853';
export const NPM_LIFECYCLE_STAGE_ENVELOPE_V81_MANIFEST_PATH = 'docs/freeze/npm-lifecycle-stage-envelope-compatibility-v81-20260829.json';
export const NPM_LIFECYCLE_STAGE_ENVELOPE_V81_PRELOAD_PATH = 'scripts/lib/npm-lifecycle-stage-envelope-v81.mjs';
export const NPM_LIFECYCLE_STAGE_ENVELOPE_V81_STATE_KEY = '__VITALISMEN_V81_STAGE_ENVELOPE_STATE';

const sha256Buffer = (value) => crypto.createHash('sha256').update(value).digest('hex');
const sha256File = (file) => sha256Buffer(fs.readFileSync(file));
const samePath = (left, right) => process.platform === 'win32'
    ? left.toLowerCase() === right.toLowerCase()
    : left === right;
const hasTraversal = (value) => String(value || '').split(/[\\/]+/).includes('..');
const isWithin = (parent, candidate) => {
    const relative = path.relative(parent, candidate);
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};
const canonicalJson = (file, label) => {
    const bytes = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(bytes);
    if (bytes !== `${JSON.stringify(parsed, null, 2)}\n`) {
        throw new Error(`[NPM-LIFECYCLE-STAGE-ENVELOPE-V81] ${label}_not_canonical`);
    }
    return parsed;
};
const relativeFile = (root, relativePath) => {
    if (!relativePath || path.isAbsolute(relativePath) || hasTraversal(relativePath) || relativePath.includes('\\')) {
        throw new Error('[NPM-LIFECYCLE-STAGE-ENVELOPE-V81] protected_path_invalid');
    }
    const candidate = path.resolve(root, ...relativePath.split('/'));
    if (!isWithin(root, candidate)) throw new Error('[NPM-LIFECYCLE-STAGE-ENVELOPE-V81] protected_path_outside_root');
    return candidate;
};
const assertExactKeys = (value, expected, label) => {
    const actual = Object.keys(value || {}).sort();
    const wanted = [...expected].sort();
    if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
        throw new Error(`[NPM-LIFECYCLE-STAGE-ENVELOPE-V81] ${label}_fields_invalid`);
    }
};

const STAGE_SOURCE_KEYS = Object.freeze([
    'repository', 'publicationStatus', 'releaseChannel', 'sourceRef',
    'sourceRefResolvedCommit', 'commit', 'functionalCommit', 'functionalTree',
    'freezeVersion', 'deployHelperContractVersion', 'guardChainVersion',
    'runtimeGuardChainValidated', 'predeployValidated', 'dataCompatibilityVersion',
    'strictReadOnly', 'safeObservationPolicy', 'allowedWriteClasses',
    'productionBranchCommitBefore', 'productionBranchChanged',
    'productionTagRequiredForStaging', 'productionTagObservation', 'createdAt',
    'releaseName', 'postSaleCompatibility'
]);
const POST_SALE_KEYS = Object.freeze([
    'runtimeVersion', 'readsDataCompatibilityThrough', 'writesDataCompatibilityVersion',
    'requiresRollbackTargetPreflight'
]);

export const assertOfficialStageSourceEnvelopeV81 = (root) => {
    const metadataPath = path.join(root, '.release-source.json');
    if (!fs.existsSync(metadataPath) || fs.existsSync(path.join(root, '.git'))) {
        throw new Error('[NPM-LIFECYCLE-STAGE-ENVELOPE-V81] official_stage_envelope_missing_or_ambiguous');
    }
    const metadata = canonicalJson(metadataPath, 'release_source');
    assertExactKeys(metadata, STAGE_SOURCE_KEYS, 'release_source');
    assertExactKeys(metadata.postSaleCompatibility, POST_SALE_KEYS, 'post_sale_compatibility');
    const commit = String(metadata.functionalCommit || '').toLowerCase();
    const tree = String(metadata.functionalTree || '').toLowerCase();
    const observation = String(metadata.productionTagObservation || '');
    if (
        metadata.repository !== 'GitViltaliesmen/vitalismen-maxlien-painel'
        || metadata.publicationStatus !== 'staged_candidate'
        || metadata.releaseChannel !== 'production'
        || !/^refs\/heads\/codex\/[A-Za-z0-9][A-Za-z0-9._/-]{1,198}[A-Za-z0-9]$/.test(String(metadata.sourceRef || ''))
        || hasTraversal(metadata.sourceRef)
        || !/^[0-9a-f]{40}$/.test(commit)
        || !/^[0-9a-f]{40}$/.test(tree)
        || String(metadata.sourceRefResolvedCommit || '').toLowerCase() !== commit
        || String(metadata.commit || '').toLowerCase() !== commit
        || metadata.freezeVersion !== 72
        || metadata.deployHelperContractVersion !== 72
        || metadata.guardChainVersion !== 71
        || metadata.runtimeGuardChainValidated !== 71
        || metadata.predeployValidated !== 'v71'
        || metadata.dataCompatibilityVersion !== 66
        || metadata.strictReadOnly !== true
        || metadata.safeObservationPolicy !== 'STRICT_READ_ONLY'
        || JSON.stringify(metadata.allowedWriteClasses) !== '[]'
        || !/^[0-9a-f]{40}$/.test(String(metadata.productionBranchCommitBefore || '').toLowerCase())
        || metadata.productionBranchChanged !== false
        || metadata.productionTagRequiredForStaging !== false
        || !(observation === 'ABSENT' || observation.toLowerCase() === commit)
        || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(String(metadata.createdAt || ''))
        || !/^\d{8}T\d{6}Z_production-\d{8}-[0-9a-f]{7}$/.test(String(metadata.releaseName || ''))
        || !String(metadata.releaseName).endsWith(`-${commit.slice(0, 7)}`)
        || metadata.postSaleCompatibility.runtimeVersion !== 66
        || metadata.postSaleCompatibility.readsDataCompatibilityThrough !== 66
        || metadata.postSaleCompatibility.writesDataCompatibilityVersion !== 66
        || metadata.postSaleCompatibility.requiresRollbackTargetPreflight !== true
    ) {
        throw new Error('[NPM-LIFECYCLE-STAGE-ENVELOPE-V81] official_stage_envelope_invalid');
    }
    return Object.freeze({ commit, tree, source: 'official-stage-v72-envelope', metadata });
};

export const assertNpmLifecycleStageEnvelopeManifestV81 = (root) => {
    const manifestPath = relativeFile(root, NPM_LIFECYCLE_STAGE_ENVELOPE_V81_MANIFEST_PATH);
    const parentManifest = relativeFile(root, 'docs/freeze/npm-lifecycle-preload-bootstrap-compatibility-v80-20260829.json');
    const parentFreeze = relativeFile(root, 'docs/NPM_LIFECYCLE_PRELOAD_BOOTSTRAP_COMPATIBILITY_FREEZE_V80_20260829.md');
    const parentAttestation = relativeFile(root, 'docs/evidence/npm-lifecycle-preload-bootstrap-v80-attestation-20260829.json');
    const helper = relativeFile(root, 'ops/vitalismen-stage');
    for (const required of [manifestPath, parentManifest, parentFreeze, parentAttestation, helper]) {
        if (!fs.existsSync(required)) throw new Error('[NPM-LIFECYCLE-STAGE-ENVELOPE-V81] required_identity_file_missing');
    }
    const manifest = canonicalJson(manifestPath, 'v81_manifest');
    const expectedProtected = [...(manifest.newProtectedFiles || [])].sort();
    if (
        sha256File(parentManifest) !== NPM_LIFECYCLE_STAGE_ENVELOPE_V81_PARENT_MANIFEST_SHA256
        || sha256File(parentFreeze) !== NPM_LIFECYCLE_STAGE_ENVELOPE_V81_PARENT_FREEZE_SHA256
        || sha256File(parentAttestation) !== NPM_LIFECYCLE_STAGE_ENVELOPE_V81_PARENT_ATTESTATION_SHA256
        || sha256File(helper) !== NPM_LIFECYCLE_STAGE_ENVELOPE_V81_HELPER_SHA256
        || manifest.freezeId !== 'npm-lifecycle-stage-envelope-compatibility-v81'
        || manifest.version !== 81
        || manifest.parentVersion !== 'V80'
        || manifest.parentCommit !== NPM_LIFECYCLE_STAGE_ENVELOPE_V81_PARENT_COMMIT
        || manifest.parentTree !== NPM_LIFECYCLE_STAGE_ENVELOPE_V81_PARENT_TREE
        || manifest.purpose !== 'OFFICIAL_STAGE_ENVELOPE_COMPATIBILITY'
        || manifest.country !== 'EC'
        || manifest.policy?.officialHelperSha256 !== NPM_LIFECYCLE_STAGE_ENVELOPE_V81_HELPER_SHA256
        || manifest.policy?.helperFreezeVersion !== 72
        || manifest.policy?.runtimeGuardChainVersion !== 71
        || manifest.policy?.dataCompatibilityVersion !== 66
        || manifest.policy?.v80ByteIntact !== true
        || manifest.policy?.botBusinessLogicChanged !== false
        || manifest.policy?.datasetChanged !== false
        || manifest.policy?.ctaChanged !== false
        || JSON.stringify(manifest.declaredAncestorOverrides) !== '[]'
        || JSON.stringify(Object.keys(manifest.protectedFiles || {}).sort()) !== JSON.stringify(expectedProtected)
    ) {
        throw new Error('[NPM-LIFECYCLE-STAGE-ENVELOPE-V81] manifest_identity_or_policy_invalid');
    }
    const logicalBundleSha256 = sha256Buffer(Buffer.from(
        Object.entries(manifest.protectedFiles || {})
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([relativePath, fileHash]) => `${relativePath}\0${fileHash}\n`)
            .join('')
    ));
    if (manifest.logicalBundle?.sha256 !== logicalBundleSha256) {
        throw new Error('[NPM-LIFECYCLE-STAGE-ENVELOPE-V81] logical_bundle_invalid');
    }
    for (const [relativePath, expectedHash] of Object.entries(manifest.protectedFiles || {})) {
        const file = relativeFile(root, relativePath);
        if (!fs.existsSync(file) || sha256File(file) !== expectedHash) {
            throw new Error(`[NPM-LIFECYCLE-STAGE-ENVELOPE-V81] protected_file_invalid:${relativePath}`);
        }
    }
    return Object.freeze({ manifest, manifestPath, manifestSha256: sha256File(manifestPath) });
};

export const resolveCanonicalStageProjectRootV81 = ({
    preloadUrl = null,
    env = process.env,
    cwd = process.cwd(),
    requireInitCwd = false
} = {}) => {
    const v80AnchorUrl = pathToFileURL(path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        'npmLifecyclePreloadBootstrapV80Service.js'
    )).href;
    const base = resolveCanonicalProjectRootV80({
        anchorUrl: v80AnchorUrl,
        env,
        cwd,
        requireInitCwd,
        inspectIdentity: false
    });
    if (preloadUrl) {
        const preloadPath = fileURLToPath(preloadUrl);
        const expected = relativeFile(base.root, NPM_LIFECYCLE_STAGE_ENVELOPE_V81_PRELOAD_PATH);
        if (!path.isAbsolute(preloadPath) || hasTraversal(preloadPath) || !fs.existsSync(preloadPath)
            || !samePath(fs.realpathSync(preloadPath), fs.realpathSync(expected))
            || !isWithin(base.root, fs.realpathSync(preloadPath))) {
            throw new Error('[NPM-LIFECYCLE-STAGE-ENVELOPE-V81] preload_outside_canonical_root');
        }
    }
    const v81 = assertNpmLifecycleStageEnvelopeManifestV81(base.root);
    let sourceIdentity;
    if (fs.existsSync(path.join(base.root, '.release-source.json'))) {
        sourceIdentity = assertOfficialStageSourceEnvelopeV81(base.root);
    } else {
        const local = resolveCanonicalProjectRootV80({
            anchorUrl: v80AnchorUrl,
            env,
            cwd,
            requireInitCwd,
            inspectIdentity: true
        });
        if (local.sourceIdentity?.source !== 'git') {
            throw new Error('[NPM-LIFECYCLE-STAGE-ENVELOPE-V81] local_git_identity_required');
        }
        sourceIdentity = local.sourceIdentity;
    }
    return Object.freeze({ ...base, manifestV81: v81.manifest, manifestV81Sha256: v81.manifestSha256, sourceIdentity });
};

export const buildNpmLifecycleStageEnvelopeOptionV81 = (root) => {
    if (!path.isAbsolute(root) || hasTraversal(root) || !fs.existsSync(root)) {
        throw new Error('[NPM-LIFECYCLE-STAGE-ENVELOPE-V81] preload_root_invalid');
    }
    const canonicalRoot = fs.realpathSync(root);
    assertNpmLifecycleStageEnvelopeManifestV81(canonicalRoot);
    const preload = relativeFile(canonicalRoot, NPM_LIFECYCLE_STAGE_ENVELOPE_V81_PRELOAD_PATH);
    if (!fs.existsSync(preload)) throw new Error('[NPM-LIFECYCLE-STAGE-ENVELOPE-V81] preload_missing');
    return `--import=${pathToFileURL(preload).href}`;
};

const stripExactOption = (value, preloadOption) => String(value || '')
    .split(/\s+/)
    .filter(Boolean)
    .filter((option) => option !== preloadOption)
    .join(' ');
const removeOption = (env, key, preloadOption) => {
    const remaining = stripExactOption(env[key], preloadOption);
    if (remaining) env[key] = remaining;
    else delete env[key];
};

export const bootstrapNpmLifecycleStageEnvelopeV81 = async ({ preloadUrl, env = process.env } = {}) => {
    const resolved = resolveCanonicalStageProjectRootV81({
        preloadUrl,
        env,
        cwd: process.cwd(),
        requireInitCwd: Boolean(env.npm_lifecycle_event || env.npm_package_json)
    });
    const classification = classifyNpmLifecycleProcessV80({ root: resolved.root, cwd: resolved.cwd, env });
    const preloadOption = buildNpmLifecycleStageEnvelopeOptionV81(resolved.root);
    const inheritedOptions = `${env.NODE_OPTIONS || ''} ${env.npm_config_node_options || ''} ${env.NPM_CONFIG_NODE_OPTIONS || ''}`;
    if (inheritedOptions.includes('ec-bot-core-readiness-v79-successor-context.mjs')
        || inheritedOptions.includes('npm-lifecycle-preload-bootstrap-v80.mjs')) {
        throw new Error('[NPM-LIFECYCLE-STAGE-ENVELOPE-V81] mixed_or_relative_preload_forbidden');
    }
    if (classification.contextRequired) {
        await import(pathToFileURL(path.join(
            resolved.root,
            'scripts/lib/ec-bot-core-readiness-v79-successor-context.mjs'
        )).href);
        const inherited = Array.isArray(globalThis[NPM_LIFECYCLE_PRELOAD_V80_SUCCESSOR_KEY])
            ? globalThis[NPM_LIFECYCLE_PRELOAD_V80_SUCCESSOR_KEY]
            : [];
        globalThis[NPM_LIFECYCLE_PRELOAD_V80_SUCCESSOR_KEY] = [...new Set([
            ...inherited,
            ...(resolved.manifestV81.declaredAncestorOverrides || [])
        ])];
    }
    removeOption(env, 'NODE_OPTIONS', preloadOption);
    if (!classification.contextRequired) {
        removeOption(env, 'npm_config_node_options', preloadOption);
        removeOption(env, 'NPM_CONFIG_NODE_OPTIONS', preloadOption);
    }
    globalThis[NPM_LIFECYCLE_STAGE_ENVELOPE_V81_STATE_KEY] = Object.freeze({
        version: 81,
        classification: classification.classification,
        event: classification.event,
        canonicalRoot: resolved.root,
        contextActive: classification.contextRequired,
        sourceIdentity: resolved.sourceIdentity.source,
        manifestSha256: resolved.manifestV81Sha256
    });
    return globalThis[NPM_LIFECYCLE_STAGE_ENVELOPE_V81_STATE_KEY];
};

export { NPM_LIFECYCLE_PRELOAD_V80_OFFICIAL_EVENTS };
