import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import dotenv from 'dotenv';
import {
    POST_SALE_TRANSACTIONAL_V105_MODE,
    POST_SALE_TRANSACTIONAL_V105_VERSION,
    assertPostSaleTransactionalV105Configuration,
    assertPostSaleTransactionalV105Health,
    assertPostSaleTransactionalV105Manifest,
    buildPostSaleTransactionalV105Overlay,
    serializePostSaleTransactionalV105Overlay
} from '../../src/services/postSaleTransactionalControlPlaneV105Service.js';

export const POST_SALE_V105_ACTIVATION_PHRASE = 'I_UNDERSTAND_POST_SALE_V105_BATCH_ONE';
export const POST_SALE_V105_BRIDGE_PHRASE = 'I_UNDERSTAND_POST_SALE_V105_BRIDGE_NO_REPLAY';
export const POST_SALE_V105_MAX_PERMIT_MS = 10 * 60 * 1000;

const exactRelease = (value) => /^[0-9]{8}T[0-9]{6}Z_production-[0-9]{8}-[0-9a-f]{7}$/.test(String(value || ''));
const exactSha1 = (value) => /^[0-9a-f]{40}$/.test(String(value || ''));
const exactTag = (value) => /^production-[0-9]{8}-[0-9a-f]{7}$/.test(String(value || ''));
const exactPermitId = (value) => /^[A-Za-z0-9][A-Za-z0-9_-]{7,99}$/.test(String(value || ''));
const canonical = (value) => `${JSON.stringify(value, null, 2)}\n`;
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const readCanonical = (file, label) => {
    const content = fs.readFileSync(file, 'utf8');
    const value = JSON.parse(content);
    if (content !== canonical(value)) throw new Error(`${label}_not_canonical`);
    return value;
};
const assertWindow = ({ createdAt, expiresAt, now = new Date() }) => {
    const created = Date.parse(createdAt);
    const expires = Date.parse(expiresAt);
    const nowMs = new Date(now).getTime();
    if (!Number.isFinite(created) || !Number.isFinite(expires)
        || created > nowMs + 60_000 || expires <= nowMs || expires <= created
        || expires - created > POST_SALE_V105_MAX_PERMIT_MS) throw new Error('permit_window_invalid');
};
export const resolvePostSaleV105PublishedReleaseIdentity = (releaseDir, release) => {
    if (!exactRelease(release) || path.basename(releaseDir) !== release) throw new Error('release_invalid');
    const sourcePath = path.join(releaseDir, '.release-source.json');
    const publicationPath = path.join(releaseDir, '.release-publication.json');
    const completePath = path.join(releaseDir, '.publication-complete.json');
    const sourceBuffer = fs.readFileSync(sourcePath);
    const publicationBuffer = fs.readFileSync(publicationPath);
    const source = readCanonical(sourcePath, 'release_metadata');
    const publication = readCanonical(publicationPath, 'release_publication');
    const complete = readCanonical(completePath, 'publication_complete');
    const commit = String(source.functionalCommit || source.commit || '').toLowerCase();
    const tree = String(source.functionalTree || '').toLowerCase();
    const tag = String(publication.publicationTag || '').trim();
    if (!exactSha1(commit) || !exactSha1(tree) || !exactTag(tag)
        || source.publicationStatus !== 'staged_candidate'
        || publication.status !== 'production_published'
        || publication.release !== release
        || String(publication.functionalCommit || '').toLowerCase() !== commit
        || String(publication.functionalTree || '').toLowerCase() !== tree
        || publication.releaseMetadataSha256 !== sha256(sourceBuffer)
        || complete.status !== 'complete' || complete.publicationStatus !== 'production_published'
        || complete.release !== release || complete.publicationTag !== tag
        || String(complete.functionalCommit || '').toLowerCase() !== commit
        || String(complete.functionalTree || '').toLowerCase() !== tree
        || complete.publicationMetadataSha256 !== sha256(publicationBuffer)
        || release.slice(-7) !== commit.slice(0, 7) || tag.slice(-7) !== commit.slice(0, 7)) {
        throw new Error('published_release_identity_invalid');
    }
    return { release, commit, tree, tag };
};

export const createPostSaleV105BridgePermit = ({ identity, permitId, createdAt, expiresAt }) => {
    if (!exactPermitId(permitId)) throw new Error('permit_id_invalid');
    return {
        version: POST_SALE_TRANSACTIONAL_V105_VERSION,
        kind: 'V66_COMPATIBILITY_BRIDGE_NO_REPLAY',
        status: 'authorized',
        singleUse: true,
        ...identity,
        permitId,
        createdAt,
        expiresAt
    };
};

export const validatePostSaleV105BridgePermit = ({ permit, identity, permitId, now = new Date() }) => {
    const expectedKeys = [
        'version', 'kind', 'status', 'singleUse', 'release', 'commit', 'tree', 'tag',
        'permitId', 'createdAt', 'expiresAt'
    ].sort();
    if (JSON.stringify(Object.keys(permit || {}).sort()) !== JSON.stringify(expectedKeys)
        || permit.version !== POST_SALE_TRANSACTIONAL_V105_VERSION
        || permit.kind !== 'V66_COMPATIBILITY_BRIDGE_NO_REPLAY'
        || permit.status !== 'authorized' || permit.singleUse !== true
        || permit.release !== identity.release || permit.commit !== identity.commit
        || permit.tree !== identity.tree || permit.tag !== identity.tag
        || permit.permitId !== permitId) throw new Error('bridge_permit_identity_invalid');
    assertWindow({ ...permit, now });
    return { ok: true };
};

export const createPostSaleV105ActivationBundle = ({
    releaseDir,
    release,
    overlayFile,
    attestationFile,
    permitFile,
    permitId,
    createdAt,
    expiresAt
}) => {
    const manifest = assertPostSaleTransactionalV105Manifest();
    const identity = resolvePostSaleV105PublishedReleaseIdentity(releaseDir, release);
    const baseEnv = dotenv.parse(fs.readFileSync(path.join(releaseDir, '.env'), 'utf8'));
    const overlay = buildPostSaleTransactionalV105Overlay({ baseEnv });
    assertPostSaleTransactionalV105Configuration({ ...baseEnv, ...overlay });
    const attestation = {
        version: POST_SALE_TRANSACTIONAL_V105_VERSION,
        profile: POST_SALE_TRANSACTIONAL_V105_MODE,
        ...identity,
        manifestSha256: manifest.manifestSha256,
        profileSha256: overlay.VITALISMEN_EC_POSTSALE_TRANSACTIONAL_PROFILE_SHA256,
        batchMax: 1,
        dailyMax: 1,
        historicalBacklogEnabled: false,
        dropiMode: 'REPORT_ONLY',
        dropiApplyAllowed: false,
        metaRetroactiveAllowed: false,
        createdAt
    };
    const permit = {
        version: POST_SALE_TRANSACTIONAL_V105_VERSION,
        kind: 'POST_SALE_TRANSACTIONAL_BATCH_ONE',
        status: 'authorized',
        singleUse: true,
        ...identity,
        permitId,
        profileSha256: overlay.VITALISMEN_EC_POSTSALE_TRANSACTIONAL_PROFILE_SHA256,
        createdAt,
        expiresAt
    };
    if (!exactPermitId(permitId)) throw new Error('permit_id_invalid');
    fs.writeFileSync(overlayFile, serializePostSaleTransactionalV105Overlay(overlay), { mode: 0o400, flag: 'wx' });
    fs.writeFileSync(attestationFile, canonical(attestation), { mode: 0o400, flag: 'wx' });
    fs.writeFileSync(permitFile, canonical(permit), { mode: 0o600, flag: 'wx' });
    return { identity, overlay, attestation, permit };
};

export const validatePostSaleV105ActivationBundle = ({
    releaseDir,
    release,
    overlayFile,
    attestationFile,
    permitFile,
    permitId,
    now = new Date()
}) => {
    const manifest = assertPostSaleTransactionalV105Manifest();
    const identity = resolvePostSaleV105PublishedReleaseIdentity(releaseDir, release);
    const baseEnv = dotenv.parse(fs.readFileSync(path.join(releaseDir, '.env'), 'utf8'));
    const expectedOverlay = buildPostSaleTransactionalV105Overlay({ baseEnv });
    const actualOverlay = dotenv.parse(fs.readFileSync(overlayFile, 'utf8'));
    const attestation = readCanonical(attestationFile, 'attestation');
    const permit = readCanonical(permitFile, 'permit');
    if (serializePostSaleTransactionalV105Overlay(actualOverlay) !== serializePostSaleTransactionalV105Overlay(expectedOverlay)) {
        throw new Error('overlay_invalid');
    }
    assertPostSaleTransactionalV105Configuration({ ...baseEnv, ...actualOverlay });
    if (attestation.release !== identity.release || attestation.commit !== identity.commit
        || attestation.tree !== identity.tree || attestation.tag !== identity.tag
        || attestation.manifestSha256 !== manifest.manifestSha256
        || attestation.profileSha256 !== expectedOverlay.VITALISMEN_EC_POSTSALE_TRANSACTIONAL_PROFILE_SHA256
        || attestation.batchMax !== 1 || attestation.dailyMax !== 1
        || attestation.historicalBacklogEnabled !== false || attestation.dropiMode !== 'REPORT_ONLY'
        || attestation.dropiApplyAllowed !== false || attestation.metaRetroactiveAllowed !== false) {
        throw new Error('attestation_invalid');
    }
    if (permit.kind !== 'POST_SALE_TRANSACTIONAL_BATCH_ONE' || permit.status !== 'authorized'
        || permit.singleUse !== true || permit.release !== identity.release || permit.commit !== identity.commit
        || permit.tree !== identity.tree || permit.tag !== identity.tag || permit.permitId !== permitId
        || permit.profileSha256 !== expectedOverlay.VITALISMEN_EC_POSTSALE_TRANSACTIONAL_PROFILE_SHA256) {
        throw new Error('activation_permit_identity_invalid');
    }
    assertWindow({ ...permit, now });
    return { ok: true, identity, overlay: actualOverlay, attestation, permit };
};

const [action, ...args] = process.argv.slice(2);
if (action === 'inspect') {
    assertPostSaleTransactionalV105Manifest();
    process.stdout.write('POST_SALE_V105_INSPECT=PASS\n');
} else if (action === 'bridge-create') {
    const [releaseDir, release, permitFile, permitId, createdAt, expiresAt, phrase] = args;
    if (phrase !== POST_SALE_V105_BRIDGE_PHRASE) throw new Error('bridge_authorization_phrase_invalid');
    const identity = resolvePostSaleV105PublishedReleaseIdentity(releaseDir, release);
    const permit = createPostSaleV105BridgePermit({ identity, permitId, createdAt, expiresAt });
    fs.writeFileSync(permitFile, canonical(permit), { mode: 0o600, flag: 'wx' });
} else if (action === 'bridge-validate') {
    const [releaseDir, release, permitFile, permitId, nowIso] = args;
    const identity = resolvePostSaleV105PublishedReleaseIdentity(releaseDir, release);
    validatePostSaleV105BridgePermit({ permit: readCanonical(permitFile, 'bridge_permit'), identity, permitId, now: nowIso });
} else if (action === 'create') {
    const [releaseDir, release, overlayFile, attestationFile, permitFile, permitId, createdAt, expiresAt, phrase] = args;
    if (phrase !== POST_SALE_V105_ACTIVATION_PHRASE) throw new Error('activation_authorization_phrase_invalid');
    createPostSaleV105ActivationBundle({ releaseDir, release, overlayFile, attestationFile, permitFile, permitId, createdAt, expiresAt });
} else if (action === 'validate') {
    const [releaseDir, release, overlayFile, attestationFile, permitFile, permitId, nowIso] = args;
    validatePostSaleV105ActivationBundle({ releaseDir, release, overlayFile, attestationFile, permitFile, permitId, now: nowIso });
} else if (action === 'health') {
    const [healthFile] = args;
    assertPostSaleTransactionalV105Health(readCanonical(healthFile, 'health'));
} else if (action) {
    throw new Error('usage: inspect|bridge-create|bridge-validate|create|validate|health');
}
