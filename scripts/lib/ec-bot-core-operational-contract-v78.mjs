import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
    EC_BOT_CORE_V78_DATASET_ID,
    EC_BOT_CORE_V78_MODE,
    assertEcBotCoreV78Configuration,
    assertEcBotCoreV78Health,
    buildEcBotCoreV78OverlayEnvironment,
    parseEcBotCoreV78Overlay,
    serializeEcBotCoreV78Overlay
} from '../../src/services/ecBotCoreOperationalV78Service.js';
import {
    assertEcBotCoreRuntimeBootV87
} from '../../src/services/ecBotCoreRuntimeBootV87Service.js';
import { calculateFunctionalPayloadSha256V78 } from '../../src/services/mutableRuntimeArtifactV78Service.js';

export const EC_BOT_CORE_V78_AUTHORIZATION_PHRASE = 'I_UNDERSTAND_EC_BOT_CORE_V78';
export const EC_BOT_CORE_V78_PROFILE_NAME = EC_BOT_CORE_V78_MODE;
export const EC_BOT_CORE_V78_MAX_PERMIT_MS = 10 * 60 * 1000;
export const EC_BOT_CORE_V78_OVERLAY_NAME = 'ec-bot-core-v78.env';
export const EC_BOT_CORE_V78_ATTESTATION_NAME = 'ec-bot-core-v78-attestation.json';
export const EC_BOT_CORE_V78_PERMIT_NAME = 'ec-bot-core-v78-permit.json';
export const EC_BOT_CORE_V78_MANIFEST_PATH = 'docs/freeze/ec-bot-core-structural-safety-v78-20260829.json';

const SHA1 = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const RELEASE = /^[0-9]{8}T[0-9]{6}Z_production-[0-9]{8}-[0-9a-f]{7}$/;
const TAG = /^production-[0-9]{8}-[0-9a-f]{7}$/;
const PERMIT_ID = /^ec-bot-core-v78-[A-Za-z0-9_-]{8,80}$/;
const clean = (value = '') => String(value ?? '').trim();
const canonicalJson = (value) => `${JSON.stringify(value, null, 2)}\n`;
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const fileSha256 = (file) => sha256(fs.readFileSync(file));

const assertCanonicalJsonFile = (file, label) => {
    const content = fs.readFileSync(file, 'utf8');
    const value = JSON.parse(content);
    if (content !== canonicalJson(value)) throw new Error(`${label}_not_canonical`);
    return value;
};

const assertIdentity = ({ release, commit, tree, tag }) => {
    if (!RELEASE.test(clean(release))) throw new Error('release_invalid');
    if (!SHA1.test(clean(commit))) throw new Error('commit_invalid');
    if (!SHA1.test(clean(tree))) throw new Error('tree_invalid');
    if (!TAG.test(clean(tag))) throw new Error('tag_invalid');
    if (clean(release).slice(-7) !== clean(commit).slice(0, 7)) throw new Error('release_commit_mismatch');
    if (clean(tag).slice(-7) !== clean(commit).slice(0, 7)) throw new Error('tag_commit_mismatch');
};

const assertExactKeys = (value, expected, label) => {
    const actual = Object.keys(value || {}).sort();
    const wanted = [...expected].sort();
    if (JSON.stringify(actual) !== JSON.stringify(wanted)) throw new Error(`${label}_fields_invalid`);
};

export const inspectPublishedEcBotCoreV78Release = ({ releaseDir, release } = {}) => {
    const resolved = path.resolve(clean(releaseDir));
    if (path.basename(resolved) !== clean(release) || !RELEASE.test(clean(release))) {
        throw new Error('release_path_identity_invalid');
    }
    const paths = {
        source: path.join(resolved, '.release-source.json'),
        staging: path.join(resolved, '.staging-complete.json'),
        publication: path.join(resolved, '.release-publication.json'),
        publicationComplete: path.join(resolved, '.publication-complete.json'),
        manifest: path.join(resolved, EC_BOT_CORE_V78_MANIFEST_PATH)
    };
    for (const [label, file] of Object.entries(paths)) {
        if (!fs.existsSync(file) || !fs.lstatSync(file).isFile() || fs.lstatSync(file).isSymbolicLink()) {
            throw new Error(`release_${label}_missing_or_unsafe`);
        }
    }
    const source = assertCanonicalJsonFile(paths.source, 'release_source');
    const staging = assertCanonicalJsonFile(paths.staging, 'staging_complete');
    const publication = assertCanonicalJsonFile(paths.publication, 'release_publication');
    const publicationComplete = assertCanonicalJsonFile(paths.publicationComplete, 'publication_complete');
    const manifest = assertCanonicalJsonFile(paths.manifest, 'v78_manifest');
    const commit = clean(source.functionalCommit || source.commit).toLowerCase();
    const tree = clean(source.functionalTree).toLowerCase();
    const tag = clean(publication.publicationTag);
    assertIdentity({ release, commit, tree, tag });
    if (source.releaseName !== release || publication.release !== release || publicationComplete.release !== release) {
        throw new Error('release_envelope_identity_mismatch');
    }
    if (publication.status !== 'production_published' || publicationComplete.status !== 'complete') {
        throw new Error('release_not_published');
    }
    if (clean(publication.functionalCommit).toLowerCase() !== commit
        || clean(publicationComplete.functionalCommit).toLowerCase() !== commit
        || clean(publication.functionalTree).toLowerCase() !== tree
        || clean(publicationComplete.functionalTree).toLowerCase() !== tree
        || clean(publication.publicationTagResolvedCommit).toLowerCase() !== commit
        || clean(publicationComplete.publicationTagResolvedCommit).toLowerCase() !== commit) {
        throw new Error('release_functional_identity_mismatch');
    }
    const functionalPayloadSha256 = calculateFunctionalPayloadSha256V78(resolved);
    if (staging.functionalPayloadSha256 !== functionalPayloadSha256
        || publication.functionalPayloadSha256 !== functionalPayloadSha256
        || publicationComplete.functionalPayloadSha256 !== functionalPayloadSha256) {
        throw new Error('release_functional_payload_mismatch');
    }
    const hashes = {
        manifestSha256: fileSha256(paths.manifest),
        releaseMetadataSha256: fileSha256(paths.source),
        stagingCompleteSha256: fileSha256(paths.staging),
        publicationMetadataSha256: fileSha256(paths.publication),
        publicationCompleteSha256: fileSha256(paths.publicationComplete),
        functionalPayloadSha256
    };
    if (publication.releaseMetadataSha256 !== hashes.releaseMetadataSha256
        || publication.stagingCompleteSha256 !== hashes.stagingCompleteSha256
        || publicationComplete.releaseMetadataSha256 !== hashes.releaseMetadataSha256
        || publicationComplete.stagingCompleteSha256 !== hashes.stagingCompleteSha256
        || publicationComplete.publicationMetadataSha256 !== hashes.publicationMetadataSha256) {
        throw new Error('release_attestation_hash_mismatch');
    }
    if (manifest.version !== 78 || manifest.status !== 'frozen' || manifest.parentVersion !== 'V77H2') {
        throw new Error('v78_manifest_identity_invalid');
    }
    if (manifest.deployment?.ready !== false
        || JSON.stringify(manifest.deployment?.blockers || []) !== JSON.stringify(['OFFICIAL_VSL_ORIGIN_CONTRACT_DIVERGENT'])) {
        throw new Error('v78_structural_evidence_identity_mismatch');
    }
    assertEcBotCoreRuntimeBootV87({ expectedRoot: resolved });
    return Object.freeze({ release, releaseDir: resolved, commit, tree, tag, ...hashes });
};

export const buildEcBotCoreOperationalBundleV78 = ({
    release,
    commit,
    tree,
    tag,
    permitId,
    createdAt,
    expiresAt,
    functionalPayloadSha256,
    manifestSha256,
    releaseMetadataSha256,
    stagingCompleteSha256,
    publicationMetadataSha256,
    publicationCompleteSha256
} = {}) => {
    assertIdentity({ release, commit, tree, tag });
    if (!PERMIT_ID.test(clean(permitId))) throw new Error('permit_id_invalid');
    const createdMs = Date.parse(createdAt);
    const expiresMs = Date.parse(expiresAt);
    if (!Number.isFinite(createdMs) || !Number.isFinite(expiresMs)
        || expiresMs <= createdMs || expiresMs - createdMs > EC_BOT_CORE_V78_MAX_PERMIT_MS) {
        throw new Error('permit_window_invalid');
    }
    for (const [label, value] of Object.entries({
        functionalPayloadSha256,
        manifestSha256,
        releaseMetadataSha256,
        stagingCompleteSha256,
        publicationMetadataSha256,
        publicationCompleteSha256
    })) {
        if (!SHA256.test(clean(value))) throw new Error(`${label}_invalid`);
    }
    const environment = buildEcBotCoreV78OverlayEnvironment({
        baseEnv: { META_PIXEL_ID_EC: EC_BOT_CORE_V78_DATASET_ID }
    });
    const overlay = serializeEcBotCoreV78Overlay(environment);
    const overlaySha256 = sha256(overlay);
    const attestation = {
        version: 78,
        status: 'attested',
        profile: EC_BOT_CORE_V78_PROFILE_NAME,
        createdAt: new Date(createdMs).toISOString(),
        release,
        commit,
        tree,
        tag,
        permitId,
        datasetId: EC_BOT_CORE_V78_DATASET_ID,
        browserServerSynchronized: true,
        functionalPayloadSha256,
        manifestSha256,
        releaseMetadataSha256,
        stagingCompleteSha256,
        publicationMetadataSha256,
        publicationCompleteSha256,
        profilePayloadSha256: environment.VITALISMEN_EC_BOT_CORE_PROFILE_SHA256,
        overlaySha256,
        mutatingSchedulersAllowed: false,
        dropiApplyAllowed: false,
        metaPurchaseAllowed: false,
        rootOnly: true,
        failClosed: true
    };
    const attestationContent = canonicalJson(attestation);
    const attestationSha256 = sha256(attestationContent);
    const permit = {
        version: 78,
        status: 'authorized',
        singleUse: true,
        createdAt: new Date(createdMs).toISOString(),
        expiresAt: new Date(expiresMs).toISOString(),
        release,
        commit,
        tree,
        tag,
        permitId,
        datasetId: EC_BOT_CORE_V78_DATASET_ID,
        profilePayloadSha256: environment.VITALISMEN_EC_BOT_CORE_PROFILE_SHA256,
        overlaySha256,
        attestationSha256,
        rollbackCommand: 'ec-bot-core-v78 contain',
        healthRequired: true
    };
    return Object.freeze({
        environment,
        overlay,
        overlaySha256,
        attestation,
        attestationContent,
        attestationSha256,
        permit,
        permitContent: canonicalJson(permit)
    });
};

const ATTESTATION_KEYS = [
    'version', 'status', 'profile', 'createdAt', 'release', 'commit', 'tree', 'tag',
    'permitId', 'datasetId', 'browserServerSynchronized', 'functionalPayloadSha256',
    'manifestSha256', 'releaseMetadataSha256', 'stagingCompleteSha256',
    'publicationMetadataSha256', 'publicationCompleteSha256', 'profilePayloadSha256',
    'overlaySha256', 'mutatingSchedulersAllowed', 'dropiApplyAllowed',
    'metaPurchaseAllowed', 'rootOnly', 'failClosed'
];
const PERMIT_KEYS = [
    'version', 'status', 'singleUse', 'createdAt', 'expiresAt', 'release', 'commit',
    'tree', 'tag', 'permitId', 'datasetId', 'profilePayloadSha256', 'overlaySha256',
    'attestationSha256', 'rollbackCommand', 'healthRequired'
];

export const validateEcBotCoreOperationalBundleV78 = ({
    overlay,
    attestation,
    permit,
    nowMs = Date.now(),
    expected = {}
} = {}) => {
    assertExactKeys(attestation, ATTESTATION_KEYS, 'attestation');
    assertExactKeys(permit, PERMIT_KEYS, 'permit');
    if (attestation.version !== 78 || attestation.status !== 'attested'
        || attestation.profile !== EC_BOT_CORE_V78_PROFILE_NAME
        || attestation.rootOnly !== true || attestation.failClosed !== true) {
        throw new Error('attestation_invalid');
    }
    if (permit.version !== 78 || permit.status !== 'authorized' || permit.singleUse !== true
        || permit.healthRequired !== true || permit.rollbackCommand !== 'ec-bot-core-v78 contain') {
        throw new Error('permit_invalid');
    }
    if (attestation.mutatingSchedulersAllowed !== false
        || attestation.dropiApplyAllowed !== false
        || attestation.metaPurchaseAllowed !== false) {
        throw new Error('external_mutation_attestation_invalid');
    }
    assertIdentity(permit);
    for (const field of ['release', 'commit', 'tree', 'tag', 'permitId', 'datasetId', 'profilePayloadSha256', 'overlaySha256']) {
        if (permit[field] !== attestation[field]) throw new Error(`permit_attestation_${field}_mismatch`);
        if (Object.hasOwn(expected, field) && permit[field] !== expected[field]) throw new Error(`expected_${field}_mismatch`);
    }
    for (const field of [
        'functionalPayloadSha256', 'manifestSha256', 'releaseMetadataSha256',
        'stagingCompleteSha256', 'publicationMetadataSha256', 'publicationCompleteSha256'
    ]) {
        if (Object.hasOwn(expected, field) && attestation[field] !== expected[field]) {
            throw new Error(`expected_${field}_mismatch`);
        }
    }
    if (permit.datasetId !== EC_BOT_CORE_V78_DATASET_ID
        || attestation.datasetId !== EC_BOT_CORE_V78_DATASET_ID
        || attestation.browserServerSynchronized !== true) {
        throw new Error('dataset_contract_invalid');
    }
    const parsed = parseEcBotCoreV78Overlay(overlay);
    const merged = { ...parsed, META_PIXEL_ID_EC: EC_BOT_CORE_V78_DATASET_ID };
    assertEcBotCoreV78Configuration(merged, {
        browserPixelId: EC_BOT_CORE_V78_DATASET_ID,
        serverDatasetId: EC_BOT_CORE_V78_DATASET_ID
    });
    if (sha256(overlay) !== permit.overlaySha256 || sha256(overlay) !== attestation.overlaySha256) {
        throw new Error('overlay_sha256_mismatch');
    }
    if (sha256(canonicalJson(attestation)) !== permit.attestationSha256) {
        throw new Error('attestation_sha256_mismatch');
    }
    const createdMs = Date.parse(permit.createdAt);
    const expiresMs = Date.parse(permit.expiresAt);
    if (!Number.isFinite(createdMs) || !Number.isFinite(expiresMs)
        || createdMs > nowMs + 60_000 || expiresMs <= nowMs
        || expiresMs <= createdMs || expiresMs - createdMs > EC_BOT_CORE_V78_MAX_PERMIT_MS) {
        throw new Error('permit_expired_or_invalid');
    }
    return Object.freeze({ ok: true, environment: merged, overlaySha256: sha256(overlay) });
};

export const assertEcBotCoreV78PreActivationHealth = (health = {}, metaDestination = {}) => {
    const failures = [];
    if (health.status !== 'online') failures.push('health_not_online');
    if (health.engine !== 'Z-API') failures.push('official_transport_not_zapi');
    if (health?.zapi?.connected !== true) failures.push('zapi_not_connected');
    if (health?.zapi?.outboundBlocked === true) failures.push('zapi_outbound_blocked');
    if (clean(metaDestination?.datasetId) !== EC_BOT_CORE_V78_DATASET_ID) failures.push('meta_dataset_invalid');
    if (clean(metaDestination?.browserPixelId) !== EC_BOT_CORE_V78_DATASET_ID) failures.push('browser_pixel_invalid');
    if (metaDestination?.browserServerSynchronized !== true) failures.push('browser_server_not_synchronized');
    if (failures.length) throw new Error(`ec_bot_core_pre_activation_health_invalid:${failures.join(',')}`);
    return Object.freeze({ ok: true });
};

const readBundleFiles = (overlayPath, attestationPath, permitPath) => ({
    overlay: fs.readFileSync(overlayPath, 'utf8'),
    attestation: assertCanonicalJsonFile(attestationPath, 'attestation'),
    permit: assertCanonicalJsonFile(permitPath, 'permit')
});

const runCli = () => {
    const [action, ...args] = process.argv.slice(2);
    if (action === 'inspect') {
        if (args.length !== 2) throw new Error('usage_inspect_invalid');
        process.stdout.write(canonicalJson(inspectPublishedEcBotCoreV78Release({ releaseDir: args[0], release: args[1] })));
        return;
    }
    if (action === 'create') {
        if (args.length !== 9) throw new Error('usage_create_invalid');
        const [releaseDir, release, overlayPath, attestationPath, permitPath, permitId, createdAt, expiresAt, authorization] = args;
        if (authorization !== EC_BOT_CORE_V78_AUTHORIZATION_PHRASE) throw new Error('authorization_phrase_invalid');
        const identity = inspectPublishedEcBotCoreV78Release({ releaseDir, release });
        const bundle = buildEcBotCoreOperationalBundleV78({ ...identity, permitId, createdAt, expiresAt });
        const created = [];
        try {
            fs.writeFileSync(overlayPath, bundle.overlay, { encoding: 'utf8', mode: 0o400, flag: 'wx' });
            created.push(overlayPath);
            fs.writeFileSync(attestationPath, bundle.attestationContent, { encoding: 'utf8', mode: 0o400, flag: 'wx' });
            created.push(attestationPath);
            fs.writeFileSync(permitPath, bundle.permitContent, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
            created.push(permitPath);
        } catch (error) {
            for (const file of created.reverse()) fs.rmSync(file, { force: true });
            throw error;
        }
        process.stdout.write(`EC_BOT_CORE_V78=ATTESTED\nOVERLAY_SHA256=${bundle.overlaySha256}\nATTESTATION_SHA256=${bundle.attestationSha256}\n`);
        return;
    }
    if (action === 'validate') {
        if (args.length !== 7) throw new Error('usage_validate_invalid');
        const [releaseDir, release, overlayPath, attestationPath, permitPath, permitId, nowIso] = args;
        const identity = inspectPublishedEcBotCoreV78Release({ releaseDir, release });
        const result = validateEcBotCoreOperationalBundleV78({
            ...readBundleFiles(overlayPath, attestationPath, permitPath),
            nowMs: Date.parse(nowIso),
            expected: { ...identity, permitId }
        });
        process.stdout.write(`EC_BOT_CORE_V78_BUNDLE=VALID\nOVERLAY_SHA256=${result.overlaySha256}\n`);
        return;
    }
    if (action === 'pre-health' || action === 'health') {
        if (args.length !== 2) throw new Error('usage_health_invalid');
        const health = JSON.parse(fs.readFileSync(args[0], 'utf8'));
        const metaEnvelope = JSON.parse(fs.readFileSync(args[1], 'utf8'));
        const metaDestination = metaEnvelope.destination || metaEnvelope;
        if (action === 'pre-health') assertEcBotCoreV78PreActivationHealth(health, metaDestination);
        else assertEcBotCoreV78Health(health, metaDestination);
        process.stdout.write(action === 'pre-health' ? 'EC_BOT_CORE_V78_PRE_HEALTH=VALID\n' : 'EC_BOT_CORE_V78_HEALTH=VALID\n');
        return;
    }
    throw new Error('cli_action_invalid');
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    try {
        runCli();
    } catch (error) {
        process.stderr.write(`ERRO: ${error.message}\n`);
        process.exitCode = 1;
    }
}
