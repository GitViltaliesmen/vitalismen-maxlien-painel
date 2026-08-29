import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const V78_PRODUCTION_ROOT = '/opt/vitalismen-automacao';
export const V78_SHARED_RUNTIME_ROOT = `${V78_PRODUCTION_ROOT}/shared/runtime`;

export const MUTABLE_RUNTIME_ARTIFACTS_V78 = Object.freeze({
    passiveFunnelObserverReport: Object.freeze({
        envKey: 'PASSIVE_FUNNEL_OBSERVER_REPORT_PATH',
        relativePath: 'observers/passive-funnel-observer-latest.json',
        legacyRelativePath: 'runtime/passive-funnel-observer-latest.json',
        kind: 'file'
    }),
    perfectFunnelObserverReport: Object.freeze({
        envKey: 'PERFECT_FUNNEL_OBSERVER_REPORT_PATH',
        relativePath: 'observers/perfect-funnel-observer-latest.json',
        legacyRelativePath: 'runtime/perfect-funnel-observer-latest.json',
        kind: 'file'
    }),
    observerSpreadsheets: Object.freeze({
        envKey: 'PERFECT_FUNNEL_OBSERVER_SPREADSHEET_DIR',
        relativePath: 'observers/spreadsheets',
        legacyRelativePath: 'runtime/observer-spreadsheets',
        kind: 'directory'
    }),
    salesHoursObserverReport: Object.freeze({
        envKey: 'SALES_HOURS_OBSERVER_REPORT_PATH',
        relativePath: 'observers/sales-hours-observer-latest.json',
        legacyRelativePath: 'runtime/sales-hours-observer-latest.json',
        kind: 'file'
    }),
    salesHoursObserverSpreadsheets: Object.freeze({
        envKey: 'SALES_HOURS_OBSERVER_SPREADSHEET_DIR',
        relativePath: 'observers/spreadsheets',
        legacyRelativePath: 'runtime/observer-spreadsheets',
        kind: 'directory'
    })
});

const FUNCTIONAL_ROOT_EXCLUSIONS_V78 = Object.freeze(new Set([
    '.env',
    '.env.v66-safe-observation',
    '.env.v77-canary-qa',
    '.canary-v77-profile-attestation.json',
    '.release-source.json',
    '.staging-complete.json',
    '.release-publication.json',
    '.publication-complete.json',
    '.activation-complete.json'
]));

const clean = (value = '') => String(value ?? '').trim();
const canonical = (value) => path.resolve(clean(value));

const pathInside = (target, root) => {
    const relative = path.relative(canonical(root), canonical(target));
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

export const isProductionReleasePathV78 = (cwd = process.cwd()) => {
    const current = canonical(cwd).replace(/\\/g, '/');
    return current === `${V78_PRODUCTION_ROOT}/current`
        || current.startsWith(`${V78_PRODUCTION_ROOT}/releases/`);
};

export const assertNoSymlinkTraversalV78 = ({
    target,
    allowedRoot,
    fsImpl = fs
} = {}) => {
    const resolvedRoot = canonical(allowedRoot);
    const resolvedTarget = canonical(target);
    if (!pathInside(resolvedTarget, resolvedRoot)) throw new Error('mutable_runtime_path_outside_allowed_root');

    const relative = path.relative(resolvedRoot, resolvedTarget);
    const segments = relative ? relative.split(path.sep).filter(Boolean) : [];
    let cursor = resolvedRoot;
    for (const segment of segments) {
        cursor = path.join(cursor, segment);
        if (!fsImpl.existsSync(cursor)) continue;
        const stats = fsImpl.lstatSync(cursor);
        if (stats.isSymbolicLink()) throw new Error('mutable_runtime_symlink_blocked');
    }
    return true;
};

export const resolveMutableRuntimeArtifactPathV78 = (artifactName, {
    env = process.env,
    cwd = process.cwd(),
    productionRoot = V78_PRODUCTION_ROOT,
    sharedRuntimeRoot = `${productionRoot}/shared/runtime`,
    localRuntimeRoot = path.resolve(cwd, '.runtime')
} = {}) => {
    const artifact = MUTABLE_RUNTIME_ARTIFACTS_V78[artifactName];
    if (!artifact) throw new Error('mutable_runtime_artifact_not_declared');

    const production = isProductionReleasePathV78(cwd)
        || canonical(cwd).replace(/\\/g, '/').startsWith(`${canonical(productionRoot).replace(/\\/g, '/')}/releases/`);
    const allowedRoot = production ? canonical(sharedRuntimeRoot) : canonical(localRuntimeRoot);
    const configured = clean(env[artifact.envKey]);
    let target;

    if (!configured || configured.replace(/\\/g, '/') === artifact.legacyRelativePath) {
        target = path.join(allowedRoot, artifact.relativePath);
    } else {
        if (!path.isAbsolute(configured)) throw new Error('mutable_runtime_relative_override_blocked');
        target = canonical(configured);
    }

    if (!pathInside(target, allowedRoot)) throw new Error('mutable_runtime_path_outside_allowed_root');
    assertNoSymlinkTraversalV78({ target, allowedRoot });

    const functionalRoot = canonical(cwd);
    if (production && pathInside(target, functionalRoot)) {
        throw new Error('mutable_runtime_artifact_inside_release');
    }
    return target;
};

export const calculateFunctionalPayloadSha256V78 = (candidateRoot) => {
    const root = canonical(candidateRoot);
    const hash = crypto.createHash('sha256');

    const visit = (directory, relative = '') => {
        const entries = fs.readdirSync(directory, { withFileTypes: true })
            .filter((entry) => !(relative === '' && FUNCTIONAL_ROOT_EXCLUSIONS_V78.has(entry.name)))
            .filter((entry) => entry.name !== '.git' && entry.name !== 'node_modules')
            .sort((left, right) => left.name.localeCompare(right.name, 'en'));

        for (const entry of entries) {
            const childRelative = relative ? `${relative}/${entry.name}` : entry.name;
            const child = path.join(directory, entry.name);
            const stats = fs.lstatSync(child);
            if (stats.isDirectory()) {
                visit(child, childRelative);
                continue;
            }
            hash.update(childRelative, 'utf8');
            hash.update('\0');
            if (stats.isSymbolicLink()) {
                hash.update('symlink\0');
                hash.update(fs.readlinkSync(child), 'utf8');
                hash.update('\0');
                continue;
            }
            if (!stats.isFile()) throw new Error(`functional_payload_type_unsupported:${childRelative}`);
            hash.update(`file:${(stats.mode & 0o111) !== 0 ? 'x' : '-'}\0`);
            hash.update(fs.readFileSync(child));
            hash.update('\0');
        }
    };

    visit(root);
    return hash.digest('hex');
};

export const V78_FUNCTIONAL_ROOT_EXCLUSIONS = FUNCTIONAL_ROOT_EXCLUSIONS_V78;
