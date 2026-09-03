import crypto from 'node:crypto';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

import {
    CANARY_V75_QA_PHONE,
    CANARY_V75_RECIPIENT_LIST_FLAGS,
    CANARY_V75_REQUIRED_FALSE_FLAGS,
    CANARY_V75_REQUIRED_TRUE_FLAGS,
    resolveCanaryV75Configuration
} from '../../src/services/canaryIsolationV75Service.js';
import {
    CANARY_CONTROLLER_V77_BASE_COMMIT,
    CANARY_CONTROLLER_V77_BASE_RELEASE,
    CANARY_CONTROLLER_V77_BASE_TAG,
    CANARY_CONTROLLER_V77_BASE_TREE,
    CANARY_CONTROLLER_V77_FLAG,
    CANARY_CONTROLLER_V77_MAX_PERMIT_MS,
    CANARY_CONTROLLER_V77_MAX_WINDOW_MS,
    calculateCanaryControllerV77ProfileSha256,
    assertCanaryControllerV77Health,
    resolveCanaryControllerV77Runtime
} from '../../src/services/canaryControllerV77Service.js';

export const CANARY_CONTROLLER_V77_AUTHORIZATION_PHRASE = 'I_UNDERSTAND_V77_QA_CANARY';
export const CANARY_CONTROLLER_V77_PROFILE_NAME = 'V77_QA_CANARY_TIMED';
export const CANARY_CONTROLLER_V77_OVERLAY_NAME = '.env.v77-canary-qa';
export const CANARY_CONTROLLER_V77_ATTESTATION_NAME = '.canary-v77-profile-attestation.json';
export const CANARY_CONTROLLER_V77_PERMIT_NAME = 'canary-v77-permit.json';

const SHA1 = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const RELEASE = /^[0-9]{8}T[0-9]{6}Z_production-[0-9]{8}-[0-9a-f]{7}$/;
const TAG = /^production-[0-9]{8}-[0-9a-f]{7}$/;
const PERMIT_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/;
const clean = (value = '') => String(value ?? '').trim();
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const canonicalJson = (value) => `${JSON.stringify(value, null, 2)}\n`;

const assertExactKeys = (value, expected, label) => {
    const actual = Object.keys(value || {}).sort();
    const wanted = [...expected].sort();
    if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
        throw new Error(`${label}_fields_invalid`);
    }
};

const assertIdentity = ({ release, commit, tree, tag }) => {
    if (!RELEASE.test(clean(release))) throw new Error('release_invalid');
    if (!SHA1.test(clean(commit))) throw new Error('commit_invalid');
    if (!SHA1.test(clean(tree))) throw new Error('tree_invalid');
    if (!TAG.test(clean(tag))) throw new Error('tag_invalid');
    if (clean(release).slice(-7) !== clean(commit).slice(0, 7)) throw new Error('release_commit_mismatch');
    if (clean(tag).slice(-7) !== clean(commit).slice(0, 7)) throw new Error('tag_commit_mismatch');
};

export const buildCanaryControllerV77Environment = ({
    release,
    commit,
    tree,
    tag,
    permitId,
    startedAt,
    expiresAt
}) => {
    assertIdentity({ release, commit, tree, tag });
    if (!PERMIT_ID.test(clean(permitId))) throw new Error('permit_id_invalid');

    const env = {
        NODE_ENV: 'production',
        SAFE_OBSERVATION_POLICY: '',
        DISABLE_SCHEDULER: '0',
        DROPPI_EC_ACTIVE_SYNC_MODE: 'REPORT_ONLY',
        POST_SALE_V66_MUTATIONS_AUTHORIZATION: 'I_UNDERSTAND_V66_OPERATIONAL_MUTATIONS',
        META_TEST_EVENT_CODE_EC: '',
        META_TEST_EVENT_CODE: '',
        WHATSAPP_CONNECT_ENABLED: 'false',
        VSL_STAGE_PERSIST_ENABLED: 'true',
        EC_ENGAGEMENT_AUTO_REPLY_ENABLED: 'false',
        [CANARY_CONTROLLER_V77_FLAG]: 'true',
        VITALISMEN_CANARY_V75_ENABLED: 'true',
        VITALISMEN_CANARY_V77_RELEASE: clean(release),
        VITALISMEN_CANARY_V77_COMMIT: clean(commit).toLowerCase(),
        VITALISMEN_CANARY_V77_TREE: clean(tree).toLowerCase(),
        VITALISMEN_CANARY_V77_TAG: clean(tag),
        VITALISMEN_CANARY_V77_BASELINE_RELEASE: CANARY_CONTROLLER_V77_BASE_RELEASE,
        VITALISMEN_CANARY_V77_BASELINE_COMMIT: CANARY_CONTROLLER_V77_BASE_COMMIT,
        VITALISMEN_CANARY_V77_BASELINE_TREE: CANARY_CONTROLLER_V77_BASE_TREE,
        VITALISMEN_CANARY_V77_BASELINE_TAG: CANARY_CONTROLLER_V77_BASE_TAG,
        VITALISMEN_CANARY_V77_QA_PHONE: CANARY_V75_QA_PHONE,
        VITALISMEN_CANARY_V77_PERMIT_ID: clean(permitId),
        VITALISMEN_CANARY_V77_STARTED_AT: new Date(startedAt).toISOString(),
        VITALISMEN_CANARY_V77_EXPIRES_AT: new Date(expiresAt).toISOString()
    };
    for (const flag of CANARY_V75_REQUIRED_TRUE_FLAGS) env[flag] = 'true';
    for (const flag of CANARY_V75_REQUIRED_FALSE_FLAGS) env[flag] = 'false';
    for (const flag of CANARY_V75_RECIPIENT_LIST_FLAGS) env[flag] = CANARY_V75_QA_PHONE;
    env.VITALISMEN_CANARY_V77_PROFILE_SHA256 = calculateCanaryControllerV77ProfileSha256(env);

    const controller = resolveCanaryControllerV77Runtime(env, { nowMs: Date.parse(startedAt) });
    const canary = resolveCanaryV75Configuration(env);
    if (!controller.ready) throw new Error(`controller_profile_invalid:${controller.failures.join(',')}`);
    if (!canary.ready) throw new Error(`canary_profile_invalid:${canary.failures.join(',')}`);
    return Object.freeze({ ...env });
};

export const serializeCanaryControllerV77Overlay = (env) => {
    const orderedKeys = Object.keys(env).sort();
    const invalid = orderedKeys.find((key) => /[\r\n]/.test(key) || /[\r\n]/.test(clean(env[key])));
    if (invalid) throw new Error(`overlay_value_invalid:${invalid}`);
    return `${orderedKeys.map((key) => `${key}=${clean(env[key])}`).join('\n')}\n`;
};

export const parseCanaryControllerV77Overlay = (content = '') => {
    const env = {};
    for (const line of String(content).split(/\r?\n/)) {
        if (!line) continue;
        const separator = line.indexOf('=');
        if (separator <= 0) throw new Error('overlay_line_invalid');
        const key = line.slice(0, separator);
        if (!/^[A-Z][A-Z0-9_]*$/.test(key) || Object.hasOwn(env, key)) throw new Error('overlay_key_invalid');
        env[key] = line.slice(separator + 1);
    }
    return env;
};

export const buildCanaryControllerV77Bundle = ({
    release,
    commit,
    tree,
    tag,
    permitId,
    createdAt,
    permitExpiresAt,
    windowExpiresAt,
    manifestSha256,
    releaseMetadataSha256,
    stagingCompleteSha256,
    publicationMetadataSha256,
    publicationCompleteSha256
}) => {
    const createdMs = Date.parse(createdAt);
    const permitExpiresMs = Date.parse(permitExpiresAt);
    const windowExpiresMs = Date.parse(windowExpiresAt);
    if (!Number.isFinite(createdMs) || !Number.isFinite(permitExpiresMs) || !Number.isFinite(windowExpiresMs)) {
        throw new Error('bundle_timestamp_invalid');
    }
    if (permitExpiresMs <= createdMs || permitExpiresMs - createdMs > CANARY_CONTROLLER_V77_MAX_PERMIT_MS) {
        throw new Error('permit_window_invalid');
    }
    if (windowExpiresMs <= createdMs || windowExpiresMs - createdMs > CANARY_CONTROLLER_V77_MAX_WINDOW_MS) {
        throw new Error('canary_window_invalid');
    }
    for (const [label, value] of Object.entries({
        manifestSha256,
        releaseMetadataSha256,
        stagingCompleteSha256,
        publicationMetadataSha256,
        publicationCompleteSha256
    })) {
        if (!SHA256.test(clean(value))) throw new Error(`${label}_invalid`);
    }

    const env = buildCanaryControllerV77Environment({
        release,
        commit,
        tree,
        tag,
        permitId,
        startedAt: createdAt,
        expiresAt: windowExpiresAt
    });
    const overlay = serializeCanaryControllerV77Overlay(env);
    const overlaySha256 = hash(overlay);
    const profilePayloadSha256 = env.VITALISMEN_CANARY_V77_PROFILE_SHA256;
    const attestation = {
        version: 77,
        status: 'attested',
        profile: CANARY_CONTROLLER_V77_PROFILE_NAME,
        createdAt: new Date(createdMs).toISOString(),
        release,
        commit,
        tree,
        tag,
        baselineRelease: CANARY_CONTROLLER_V77_BASE_RELEASE,
        baselineCommit: CANARY_CONTROLLER_V77_BASE_COMMIT,
        baselineTree: CANARY_CONTROLLER_V77_BASE_TREE,
        baselineTag: CANARY_CONTROLLER_V77_BASE_TAG,
        qaPhone: CANARY_V75_QA_PHONE,
        permitId,
        windowExpiresAt: new Date(windowExpiresMs).toISOString(),
        profilePayloadSha256,
        overlaySha256,
        manifestSha256,
        releaseMetadataSha256,
        stagingCompleteSha256,
        publicationMetadataSha256,
        publicationCompleteSha256,
        rootOnly: true,
        failClosed: true
    };
    const attestationContent = canonicalJson(attestation);
    const attestationSha256 = hash(attestationContent);
    const permit = {
        version: 77,
        status: 'authorized',
        singleUse: true,
        createdAt: new Date(createdMs).toISOString(),
        expiresAt: new Date(permitExpiresMs).toISOString(),
        windowExpiresAt: new Date(windowExpiresMs).toISOString(),
        release,
        commit,
        tree,
        tag,
        baselineRelease: CANARY_CONTROLLER_V77_BASE_RELEASE,
        baselineCommit: CANARY_CONTROLLER_V77_BASE_COMMIT,
        baselineTree: CANARY_CONTROLLER_V77_BASE_TREE,
        baselineTag: CANARY_CONTROLLER_V77_BASE_TAG,
        qaPhone: CANARY_V75_QA_PHONE,
        permitId,
        profilePayloadSha256,
        overlaySha256,
        attestationSha256,
        rollbackCompatibility: 'PASS_SAFE_BOOT',
        healthRequired: true
    };
    return {
        env,
        overlay,
        overlaySha256,
        attestation,
        attestationContent,
        attestationSha256,
        permit,
        permitContent: canonicalJson(permit)
    };
};

const ATTESTATION_KEYS = [
    'version', 'status', 'profile', 'createdAt', 'release', 'commit', 'tree', 'tag',
    'baselineRelease', 'baselineCommit', 'baselineTree', 'baselineTag', 'qaPhone',
    'permitId', 'windowExpiresAt', 'profilePayloadSha256', 'overlaySha256',
    'manifestSha256', 'releaseMetadataSha256', 'stagingCompleteSha256',
    'publicationMetadataSha256', 'publicationCompleteSha256', 'rootOnly', 'failClosed'
];

const PERMIT_KEYS = [
    'version', 'status', 'singleUse', 'createdAt', 'expiresAt', 'windowExpiresAt',
    'release', 'commit', 'tree', 'tag', 'baselineRelease', 'baselineCommit',
    'baselineTree', 'baselineTag', 'qaPhone', 'permitId', 'profilePayloadSha256',
    'overlaySha256', 'attestationSha256', 'rollbackCompatibility', 'healthRequired'
];

export const validateCanaryControllerV77Bundle = ({
    overlay,
    attestation,
    permit,
    nowMs = Date.now(),
    expected = {}
}) => {
    assertExactKeys(attestation, ATTESTATION_KEYS, 'attestation');
    assertExactKeys(permit, PERMIT_KEYS, 'permit');
    if (attestation.version !== 77 || attestation.status !== 'attested') throw new Error('attestation_invalid');
    if (attestation.profile !== CANARY_CONTROLLER_V77_PROFILE_NAME) throw new Error('profile_invalid');
    if (attestation.rootOnly !== true || attestation.failClosed !== true) throw new Error('attestation_safety_invalid');
    if (permit.version !== 77 || permit.status !== 'authorized' || permit.singleUse !== true) throw new Error('permit_invalid');
    if (permit.healthRequired !== true) throw new Error('permit_health_not_required');
    if (permit.rollbackCompatibility !== 'PASS_SAFE_BOOT') throw new Error('rollback_incompatible');

    const env = parseCanaryControllerV77Overlay(overlay);
    const overlaySha256 = hash(overlay);
    const attestationSha256 = hash(canonicalJson(attestation));
    if (attestation.overlaySha256 !== overlaySha256 || permit.overlaySha256 !== overlaySha256) {
        throw new Error('overlay_sha256_mismatch');
    }
    if (permit.attestationSha256 !== attestationSha256) throw new Error('attestation_sha256_mismatch');
    if (attestation.profilePayloadSha256 !== calculateCanaryControllerV77ProfileSha256(env)) {
        throw new Error('profile_payload_sha256_mismatch');
    }
    if (permit.profilePayloadSha256 !== attestation.profilePayloadSha256) {
        throw new Error('permit_profile_sha256_mismatch');
    }

    const identityFields = [
        'release', 'commit', 'tree', 'tag', 'baselineRelease', 'baselineCommit',
        'baselineTree', 'baselineTag', 'qaPhone', 'permitId', 'windowExpiresAt'
    ];
    for (const field of identityFields) {
        if (permit[field] !== attestation[field]) throw new Error(`permit_attestation_${field}_mismatch`);
        if (Object.hasOwn(expected, field) && permit[field] !== expected[field]) {
            throw new Error(`expected_${field}_mismatch`);
        }
    }
    for (const field of [
        'manifestSha256', 'releaseMetadataSha256', 'stagingCompleteSha256',
        'publicationMetadataSha256', 'publicationCompleteSha256'
    ]) {
        if (Object.hasOwn(expected, field) && attestation[field] !== expected[field]) {
            throw new Error(`expected_${field}_mismatch`);
        }
    }
    assertIdentity(permit);
    if (permit.baselineRelease !== CANARY_CONTROLLER_V77_BASE_RELEASE
        || permit.baselineCommit !== CANARY_CONTROLLER_V77_BASE_COMMIT
        || permit.baselineTree !== CANARY_CONTROLLER_V77_BASE_TREE
        || permit.baselineTag !== CANARY_CONTROLLER_V77_BASE_TAG) {
        throw new Error('baseline_identity_invalid');
    }
    if (permit.qaPhone !== CANARY_V75_QA_PHONE) throw new Error('qa_phone_invalid');
    if (!PERMIT_ID.test(permit.permitId)) throw new Error('permit_id_invalid');

    const createdAt = Date.parse(permit.createdAt);
    const expiresAt = Date.parse(permit.expiresAt);
    const windowExpiresAt = Date.parse(permit.windowExpiresAt);
    if (!Number.isFinite(createdAt) || !Number.isFinite(expiresAt) || !Number.isFinite(windowExpiresAt)) {
        throw new Error('permit_timestamp_invalid');
    }
    if (createdAt > nowMs + 60_000 || expiresAt <= nowMs || expiresAt <= createdAt
        || expiresAt - createdAt > CANARY_CONTROLLER_V77_MAX_PERMIT_MS) {
        throw new Error('permit_expired_or_invalid');
    }
    if (windowExpiresAt <= nowMs || windowExpiresAt <= createdAt
        || windowExpiresAt - createdAt > CANARY_CONTROLLER_V77_MAX_WINDOW_MS) {
        throw new Error('canary_window_expired_or_invalid');
    }

    const controller = resolveCanaryControllerV77Runtime(env, { nowMs });
    const canary = resolveCanaryV75Configuration(env);
    if (!controller.ready) throw new Error(`controller_runtime_invalid:${controller.failures.join(',')}`);
    if (!canary.ready) throw new Error(`canary_runtime_invalid:${canary.failures.join(',')}`);
    return { ok: true, env, overlaySha256, attestationSha256 };
};

export const CANARY_CONTROLLER_V77_ATTESTATION_KEYS = Object.freeze(ATTESTATION_KEYS);
export const CANARY_CONTROLLER_V77_PERMIT_KEYS = Object.freeze(PERMIT_KEYS);

const runCli = () => {
    const [action, ...args] = process.argv.slice(2);
    if (action === 'create') {
        if (args.length !== 18) throw new Error('usage_create_invalid');
        const [
            overlayPath, attestationPath, permitPath, release, commit, tree, tag,
            permitId, createdAt, permitExpiresAt, windowExpiresAt, manifestSha256,
            releaseMetadataSha256, stagingCompleteSha256, publicationMetadataSha256,
            publicationCompleteSha256, authorization, expectedAuthorization
        ] = args;
        if (authorization !== expectedAuthorization || authorization !== CANARY_CONTROLLER_V77_AUTHORIZATION_PHRASE) {
            throw new Error('authorization_phrase_invalid');
        }
        const bundle = buildCanaryControllerV77Bundle({
            release,
            commit,
            tree,
            tag,
            permitId,
            createdAt,
            permitExpiresAt,
            windowExpiresAt,
            manifestSha256,
            releaseMetadataSha256,
            stagingCompleteSha256,
            publicationMetadataSha256,
            publicationCompleteSha256
        });
        const createdFiles = [];
        try {
            fs.writeFileSync(overlayPath, bundle.overlay, { encoding: 'utf8', mode: 0o400, flag: 'wx' });
            createdFiles.push(overlayPath);
            fs.writeFileSync(attestationPath, bundle.attestationContent, { encoding: 'utf8', mode: 0o400, flag: 'wx' });
            createdFiles.push(attestationPath);
            fs.writeFileSync(permitPath, bundle.permitContent, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
            createdFiles.push(permitPath);
        } catch (error) {
            for (const file of createdFiles.reverse()) fs.rmSync(file, { force: true });
            throw error;
        }
        process.stdout.write(`V77_PROFILE=ATTESTED\nOVERLAY_SHA256=${bundle.overlaySha256}\nATTESTATION_SHA256=${bundle.attestationSha256}\n`);
        return;
    }
    if (action === 'validate') {
        if (args.length !== 14) throw new Error('usage_validate_invalid');
        const [
            overlayPath, attestationPath, permitPath, release, commit, tree, tag,
            permitId, nowIso, manifestSha256, releaseMetadataSha256,
            stagingCompleteSha256, publicationMetadataSha256, publicationCompleteSha256
        ] = args;
        const attestationContent = fs.readFileSync(attestationPath, 'utf8');
        const permitContent = fs.readFileSync(permitPath, 'utf8');
        const attestation = JSON.parse(attestationContent);
        const permit = JSON.parse(permitContent);
        if (attestationContent !== canonicalJson(attestation)) throw new Error('attestation_not_canonical');
        if (permitContent !== canonicalJson(permit)) throw new Error('permit_not_canonical');
        const result = validateCanaryControllerV77Bundle({
            overlay: fs.readFileSync(overlayPath, 'utf8'),
            attestation,
            permit,
            nowMs: Date.parse(nowIso),
            expected: {
                release,
                commit,
                tree,
                tag,
                permitId,
                baselineRelease: CANARY_CONTROLLER_V77_BASE_RELEASE,
                baselineCommit: CANARY_CONTROLLER_V77_BASE_COMMIT,
                baselineTree: CANARY_CONTROLLER_V77_BASE_TREE,
                baselineTag: CANARY_CONTROLLER_V77_BASE_TAG,
                qaPhone: CANARY_V75_QA_PHONE,
                manifestSha256,
                releaseMetadataSha256,
                stagingCompleteSha256,
                publicationMetadataSha256,
                publicationCompleteSha256
            }
        });
        process.stdout.write(`V77_BUNDLE=VALID\nOVERLAY_SHA256=${result.overlaySha256}\nATTESTATION_SHA256=${result.attestationSha256}\n`);
        return;
    }
    if (action === 'health') {
        if (args.length !== 1) throw new Error('usage_health_invalid');
        assertCanaryControllerV77Health(JSON.parse(fs.readFileSync(args[0], 'utf8')));
        process.stdout.write('V77_HEALTH=VALID\n');
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
