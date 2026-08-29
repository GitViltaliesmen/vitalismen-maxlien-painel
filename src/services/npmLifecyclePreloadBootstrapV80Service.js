import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const NPM_LIFECYCLE_PRELOAD_V80_PARENT_COMMIT = 'f31e3cf011286fca9c26490e580185ed49ffaf1b';
export const NPM_LIFECYCLE_PRELOAD_V80_PARENT_TREE = '66e6abcd3f3bc2a35eeeb7a429dafe2aef0e9308';
export const NPM_LIFECYCLE_PRELOAD_V80_PARENT_MANIFEST_SHA256 = 'cafcc83ce9594d7e8eb840922e2796818d045124549eede8abdcea67d8b4890e';
export const NPM_LIFECYCLE_PRELOAD_V80_PARENT_FREEZE_SHA256 = '0f8bbf3303c19586826dc162a23d19215eb2f708c9659b8ee025d45bbd4113b8';
export const NPM_LIFECYCLE_PRELOAD_V80_MANIFEST_PATH = 'docs/freeze/npm-lifecycle-preload-bootstrap-compatibility-v80-20260829.json';
export const NPM_LIFECYCLE_PRELOAD_V80_PRELOAD_PATH = 'scripts/lib/npm-lifecycle-preload-bootstrap-v80.mjs';
export const NPM_LIFECYCLE_PRELOAD_V80_SERVICE_PATH = 'src/services/npmLifecyclePreloadBootstrapV80Service.js';
export const NPM_LIFECYCLE_PRELOAD_V80_STATE_KEY = '__VITALISMEN_V80_BOOTSTRAP_STATE';
export const NPM_LIFECYCLE_PRELOAD_V80_SUCCESSOR_KEY = '__VITALISMEN_SUCCESSOR_OVERRIDE_FILES';

const attributionGuardSegment = ['proto', 'colo-g'].join('');
export const NPM_LIFECYCLE_PRELOAD_V80_OFFICIAL_EVENTS = Object.freeze([
    'guard:runtime-chain-v71',
    'guard:deploy-helper-v72',
    'guard:predeploy-v71',
    'guard:predeploy-v72',
    'guard:meta-partner-v73',
    'guard:freeze-lock-v74',
    'guard:canary-v75',
    'guard:deploy-health-v76',
    'guard:canary-controller-v77',
    'guard:canary-controller-pm2-stdin-v77h',
    'guard:canary-controller-health-policy-v77h2',
    'guard:dropi-customer-full-name-v64',
    'guard:post-sale-gargalos-v65',
    'guard:post-sale-safety-v66',
    `guard:${attributionGuardSegment}-ad-metrics-v63`,
    `guard:${attributionGuardSegment}-conversion-v62`,
    `guard:meta-ec-${attributionGuardSegment}-v61`,
    'guard:baileys-security-v59',
    'guard:pickup-bonus-v60',
    'guard:ec-product-micro-layer',
    'guard:ec-dropi-catalog',
    'guard:pickup-notifications',
    'guard:whatsapp-status-contacts',
    'guard:freeze-lock',
    'test:operational-labels',
    'test:pickup-notifications',
    'senior:check',
    'official:audit',
    'lint',
    'test'
]);

const dependencyLifecycleEvents = new Set([
    'preinstall',
    'install',
    'postinstall',
    'prepare',
    'prepublish',
    'prepublishOnly'
]);
const officialEventSet = new Set(NPM_LIFECYCLE_PRELOAD_V80_OFFICIAL_EVENTS);
const sha256Buffer = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
const sha256File = (file) => sha256Buffer(fs.readFileSync(file));
const samePath = (left, right) => process.platform === 'win32'
    ? left.toLowerCase() === right.toLowerCase()
    : left === right;
const hasTraversal = (value) => String(value || '').split(/[\\/]+/).includes('..');
const isWithin = (parent, candidate) => {
    const relative = path.relative(parent, candidate);
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};
const absoluteExistingPath = (value, label) => {
    if (typeof value !== 'string' || !value || !path.isAbsolute(value) || hasTraversal(value)) {
        throw new Error(`[NPM-LIFECYCLE-PRELOAD-V80] ${label}_must_be_absolute_without_traversal`);
    }
    if (!fs.existsSync(value)) {
        throw new Error(`[NPM-LIFECYCLE-PRELOAD-V80] ${label}_missing`);
    }
    return fs.realpathSync(value);
};
const canonicalJson = (file, label) => {
    const bytes = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(bytes);
    if (bytes !== `${JSON.stringify(parsed, null, 2)}\n`) {
        throw new Error(`[NPM-LIFECYCLE-PRELOAD-V80] ${label}_not_canonical`);
    }
    return parsed;
};
const relativeFile = (root, relativePath) => {
    if (
        typeof relativePath !== 'string'
        || !relativePath
        || path.isAbsolute(relativePath)
        || hasTraversal(relativePath)
        || relativePath.includes('\\')
    ) {
        throw new Error('[NPM-LIFECYCLE-PRELOAD-V80] protected_path_invalid');
    }
    const candidate = path.resolve(root, ...relativePath.split('/'));
    if (!isWithin(root, candidate)) {
        throw new Error('[NPM-LIFECYCLE-PRELOAD-V80] protected_path_outside_root');
    }
    return candidate;
};

export const buildNpmLifecyclePreloadOptionV80 = (root) => {
    const canonicalRoot = absoluteExistingPath(root, 'preload_root');
    const preloadPath = relativeFile(canonicalRoot, NPM_LIFECYCLE_PRELOAD_V80_PRELOAD_PATH);
    if (!fs.existsSync(preloadPath)) {
        throw new Error('[NPM-LIFECYCLE-PRELOAD-V80] preload_missing');
    }
    return `--import=${pathToFileURL(preloadPath).href}`;
};

const assertReleaseSourceIdentity = (root) => {
    const metadataPath = path.join(root, '.release-source.json');
    if (!fs.existsSync(metadataPath)) return null;
    const metadata = canonicalJson(metadataPath, 'release_source');
    const commit = String(metadata.functionalCommit || '').toLowerCase();
    const tree = String(metadata.functionalTree || '').toLowerCase();
    const resolvedCommit = String(metadata.sourceRefResolvedCommit || '').toLowerCase();
    if (
        !/^[0-9a-f]{40}$/.test(commit)
        || !/^[0-9a-f]{40}$/.test(tree)
        || resolvedCommit !== commit
        || String(metadata.commit || '').toLowerCase() !== commit
        || metadata.freezeVersion !== 80
        || metadata.strictReadOnly !== true
        || metadata.safeObservationPolicy !== 'STRICT_READ_ONLY'
        || JSON.stringify(metadata.allowedWriteClasses) !== '[]'
        || !/^refs\/(?:heads|tags)\/[A-Za-z0-9._\/-]+$/.test(String(metadata.sourceRef || ''))
        || hasTraversal(metadata.sourceRef)
        || !String(metadata.releaseName || '').endsWith(`-${commit.slice(0, 7)}`)
    ) {
        throw new Error('[NPM-LIFECYCLE-PRELOAD-V80] release_source_identity_invalid');
    }
    return Object.freeze({ commit, tree, source: 'release-source' });
};

const assertGitIdentityWhenPresent = (root) => {
    if (!fs.existsSync(path.join(root, '.git'))) return null;
    let gitRoot;
    let commit;
    let tree;
    try {
        gitRoot = execFileSync('git', ['-C', root, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
        commit = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD^{commit}'], { encoding: 'utf8' }).trim().toLowerCase();
        tree = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim().toLowerCase();
    } catch {
        throw new Error('[NPM-LIFECYCLE-PRELOAD-V80] git_identity_unavailable');
    }
    if (
        !samePath(fs.realpathSync(gitRoot), root)
        || !/^[0-9a-f]{40}$/.test(commit)
        || !/^[0-9a-f]{40}$/.test(tree)
    ) {
        throw new Error('[NPM-LIFECYCLE-PRELOAD-V80] git_identity_invalid');
    }
    return Object.freeze({ commit, tree, source: 'git' });
};

export const assertNpmLifecyclePreloadManifestV80 = (root) => {
    const v79ManifestPath = relativeFile(root, 'docs/freeze/ec-bot-core-readiness-v79-20260829.json');
    const v79FreezePath = relativeFile(root, 'docs/EC_BOT_CORE_READINESS_FREEZE_V79_20260829.md');
    const manifestPath = relativeFile(root, NPM_LIFECYCLE_PRELOAD_V80_MANIFEST_PATH);
    for (const required of [v79ManifestPath, v79FreezePath, manifestPath]) {
        if (!fs.existsSync(required)) throw new Error('[NPM-LIFECYCLE-PRELOAD-V80] required_manifest_or_freeze_missing');
    }
    const manifest = canonicalJson(manifestPath, 'v80_manifest');
    const expectedProtected = [
        ...(manifest.declaredAncestorOverrides || []),
        ...(manifest.newProtectedFiles || [])
    ].sort();
    if (
        sha256File(v79ManifestPath) !== NPM_LIFECYCLE_PRELOAD_V80_PARENT_MANIFEST_SHA256
        || sha256File(v79FreezePath) !== NPM_LIFECYCLE_PRELOAD_V80_PARENT_FREEZE_SHA256
        || manifest.freezeId !== 'npm-lifecycle-preload-bootstrap-compatibility-v80'
        || manifest.version !== 80
        || manifest.parentVersion !== 'V79'
        || manifest.parentFreezeId !== 'ec-bot-core-readiness-v79'
        || manifest.parentManifestSha256 !== NPM_LIFECYCLE_PRELOAD_V80_PARENT_MANIFEST_SHA256
        || manifest.parentFreezeSha256 !== NPM_LIFECYCLE_PRELOAD_V80_PARENT_FREEZE_SHA256
        || manifest.parentCommit !== NPM_LIFECYCLE_PRELOAD_V80_PARENT_COMMIT
        || manifest.parentTree !== NPM_LIFECYCLE_PRELOAD_V80_PARENT_TREE
        || manifest.purpose !== 'NPM_LIFECYCLE_PRELOAD_BOOTSTRAP_COMPATIBILITY'
        || manifest.country !== 'EC'
        || manifest.policy?.cwdIndependent !== true
        || manifest.policy?.dependencyLifecycleScriptsEnabled !== true
        || manifest.policy?.ignoreScriptsAllowed !== false
        || manifest.policy?.preloadCopyToNodeModulesAllowed !== false
        || manifest.policy?.botBusinessLogicChanged !== false
        || manifest.policy?.datasetChanged !== false
        || manifest.policy?.ctaChanged !== false
        || manifest.policy?.productionDeployAuthorized !== false
        || manifest.policy?.qaCanaryAuthorized !== false
        || manifest.policy?.colombiaOperationalInfrastructureTouched !== false
        || JSON.stringify(manifest.policy?.officialLifecycleEvents) !== JSON.stringify(NPM_LIFECYCLE_PRELOAD_V80_OFFICIAL_EVENTS)
        || JSON.stringify(Object.keys(manifest.protectedFiles || {}).sort()) !== JSON.stringify(expectedProtected)
    ) {
        throw new Error('[NPM-LIFECYCLE-PRELOAD-V80] manifest_identity_or_policy_invalid');
    }
    const bundleHash = sha256Buffer(Buffer.from(
        Object.entries(manifest.protectedFiles || {})
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([relativePath, fileHash]) => `${relativePath}\0${fileHash}\n`)
            .join('')
    ));
    if (manifest.logicalBundle?.sha256 !== bundleHash) {
        throw new Error('[NPM-LIFEC-PRELOAD-V80] logical_bundle_invalid');
    }
    for (const [relativePath, expectedHash] of Object.entries(manifest.protectedFiles || {})) {
        const file = relativeFile(root, relativePath);
        if (!fs.existsSync(file) || sha256File(file) !== expectedHash) {
            throw new Error(`[NPM-LIFECYCLE-PRELOAD-V80] protected_file_invalid:${relativePath}`);
        }
    }
    return Object.freeze({ manifest, manifestPath, manifestSha256: sha256File(manifestPath) });
};

export const resolveCanonicalProjectRootV80 = ({
    anchorUrl = import.meta.url,
    anchorRelativePath = NPM_LIFECYCLE_PRELOAD_V80_SERVICE_PATH,
    preloadUrl = null,
    env = process.env,
    cwd = process.cwd(),
    requireInitCwd = false,
    inspectIdentity = true
} = {}) => {
    const anchorPath = fileURLToPath(anchorUrl);
    if (!path.isAbsolute(anchorPath) || hasTraversal(anchorPath)) {
        throw new Error('[NPM-LIFECYCLE-PRELOAD-V80] anchor_invalid');
    }
    const depth = anchorRelativePath.split('/').length - 1;
    const derivedRoot = path.resolve(path.dirname(anchorPath), ...Array(depth).fill('..'));
    const root = absoluteExistingPath(derivedRoot, 'derived_root');
    const expectedAnchor = relativeFile(root, anchorRelativePath);
    if (!fs.existsSync(expectedAnchor) || !samePath(fs.realpathSync(anchorPath), fs.realpathSync(expectedAnchor))) {
        throw new Error('[NPM-LIFECYCLE-PRELOAD-V80] anchor_outside_canonical_root');
    }
    const explicitRoot = env.VITALISMEN_V80_CANONICAL_PROJECT_ROOT;
    if (explicitRoot) {
        const validatedExplicitRoot = absoluteExistingPath(explicitRoot, 'explicit_root');
        if (!samePath(validatedExplicitRoot, root)) {
            throw new Error('[NPM-LIFECYCLE-PRELOAD-V80] explicit_root_identity_mismatch');
        }
    }
    const markerPath = path.join(root, '.vitalismen-official-root');
    if (
        !fs.existsSync(markerPath)
        || !fs.readFileSync(markerPath, 'utf8').includes('VITALISMEN_OFFICIAL_PROJECT=vit_power_ec')
    ) {
        throw new Error('[NPM-LIFECYCLE-PRELOAD-V80] official_root_marker_invalid');
    }
    if (preloadUrl) {
        const preloadPath = fileURLToPath(preloadUrl);
        const expectedPreload = relativeFile(root, NPM_LIFECYCLE_PRELOAD_V80_PRELOAD_PATH);
        if (
            !path.isAbsolute(preloadPath)
            || hasTraversal(preloadPath)
            || !fs.existsSync(preloadPath)
            || !samePath(fs.realpathSync(preloadPath), fs.realpathSync(expectedPreload))
            || !isWithin(root, fs.realpathSync(preloadPath))
        ) {
            throw new Error('[NPM-LIFECYCLE-PRELOAD-V80] preload_outside_canonical_root');
        }
    }
    const initCwd = env.INIT_CWD;
    if (initCwd || requireInitCwd) {
        const validatedInitCwd = absoluteExistingPath(initCwd, 'init_cwd');
        if (!samePath(validatedInitCwd, root)) {
            throw new Error('[NPM-LIFECYCLE-PRELOAD-V80] init_cwd_identity_mismatch');
        }
    }
    if (!path.isAbsolute(cwd) || hasTraversal(cwd) || !fs.existsSync(cwd)) {
        throw new Error('[NPM-LIFECYCLE-PRELOAD-V80] cwd_invalid');
    }
    const manifestIdentity = assertNpmLifecyclePreloadManifestV80(root);
    const releaseIdentity = inspectIdentity ? assertReleaseSourceIdentity(root) : null;
    const gitIdentity = inspectIdentity && !releaseIdentity ? assertGitIdentityWhenPresent(root) : null;
    return Object.freeze({
        root,
        cwd: fs.realpathSync(cwd),
        manifest: manifestIdentity.manifest,
        manifestSha256: manifestIdentity.manifestSha256,
        sourceIdentity: releaseIdentity || gitIdentity
    });
};

export const classifyNpmLifecycleProcessV80 = ({ root, cwd, env = process.env }) => {
    const event = String(env.npm_lifecycle_event || '');
    const packageJsonValue = env.npm_package_json;
    if (event || packageJsonValue) {
        if (!event || !packageJsonValue || !env.INIT_CWD) {
            throw new Error('[NPM-LIFECYCLE-PRELOAD-V80] incomplete_npm_lifecycle_identity');
        }
        const packageJson = absoluteExistingPath(packageJsonValue, 'npm_package_json');
        const nodeModulesRoot = path.join(root, 'node_modules');
        const dependencyCwd = isWithin(nodeModulesRoot, cwd) && !samePath(nodeModulesRoot, cwd);
        const dependencyPackage = isWithin(nodeModulesRoot, packageJson) && !samePath(nodeModulesRoot, packageJson);
        if (dependencyCwd !== dependencyPackage) {
            throw new Error('[NPM-LIFECYCLE-PRELOAD-V80] npm_lifecycle_scope_mismatch');
        }
        if (dependencyCwd) {
            if (!dependencyLifecycleEvents.has(event)) {
                throw new Error('[NPM-LIFECYCLE-PRELOAD-V80] dependency_lifecycle_event_not_allowed');
            }
            return Object.freeze({ classification: 'dependency_lifecycle', event, contextRequired: false });
        }
        const rootPackageJson = path.join(root, 'package.json');
        if (!samePath(cwd, root) || !samePath(packageJson, fs.realpathSync(rootPackageJson))) {
            throw new Error('[NPM-LIFECYCLE-PRELOAD-V80] project_lifecycle_root_mismatch');
        }
        if (officialEventSet.has(event)) {
            return Object.freeze({ classification: 'official_guard', event, contextRequired: true });
        }
        return Object.freeze({ classification: 'project_lifecycle', event, contextRequired: false });
    }
    if (env.VITALISMEN_V80_PROCESS_CLASSIFICATION === 'official_guard_subprocess') {
        const guardId = String(env.VITALISMEN_V80_OFFICIAL_GUARD_ID || '');
        if (!officialEventSet.has(guardId) || !samePath(cwd, root)) {
            throw new Error('[NPM-LIFECYCLE-PRELOAD-V80] official_subprocess_identity_invalid');
        }
        return Object.freeze({ classification: 'official_guard_subprocess', event: guardId, contextRequired: true });
    }
    throw new Error('[NPM-LIFECYCLE-PRELOAD-V80] process_classification_missing');
};

const stripExactPreloadOption = (value, preloadOption) => String(value || '')
    .split(/\s+/)
    .filter(Boolean)
    .filter((option) => option !== preloadOption)
    .join(' ');
const updateEnvWithoutPreload = (env, key, preloadOption) => {
    const remaining = stripExactPreloadOption(env[key], preloadOption);
    if (remaining) env[key] = remaining;
    else delete env[key];
};

export const bootstrapNpmLifecyclePreloadV80 = async ({ preloadUrl, env = process.env } = {}) => {
    const resolved = resolveCanonicalProjectRootV80({
        preloadUrl,
        env,
        cwd: process.cwd(),
        requireInitCwd: Boolean(env.npm_lifecycle_event || env.npm_package_json)
    });
    const classification = classifyNpmLifecycleProcessV80({
        root: resolved.root,
        cwd: resolved.cwd,
        env
    });
    const preloadOption = buildNpmLifecyclePreloadOptionV80(resolved.root);
    if (String(env.NODE_OPTIONS || '').includes('ec-bot-core-readiness-v79-successor-context.mjs')) {
        throw new Error('[NPM-LIFECYCLE-PRELOAD-V80] relative_v79_preload_forbidden');
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
            ...(resolved.manifest.declaredAncestorOverrides || [])
        ])];
    }
    updateEnvWithoutPreload(env, 'NODE_OPTIONS', preloadOption);
    if (!classification.contextRequired) {
        updateEnvWithoutPreload(env, 'npm_config_node_options', preloadOption);
        updateEnvWithoutPreload(env, 'NPM_CONFIG_NODE_OPTIONS', preloadOption);
    }
    globalThis[NPM_LIFECYCLE_PRELOAD_V80_STATE_KEY] = Object.freeze({
        version: 80,
        classification: classification.classification,
        event: classification.event,
        canonicalRoot: resolved.root,
        contextActive: classification.contextRequired,
        manifestSha256: resolved.manifestSha256
    });
    return globalThis[NPM_LIFECYCLE_PRELOAD_V80_STATE_KEY];
};
