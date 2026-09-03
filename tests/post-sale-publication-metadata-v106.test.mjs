import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { resolvePostSaleV105PublishedReleaseIdentity } from '../scripts/lib/post-sale-transactional-control-plane-v105.mjs';
import {
    POST_SALE_PUBLICATION_METADATA_V106_OVERRIDE_KEY,
    assertPostSalePublicationMetadataV106Manifest
} from '../src/services/postSalePublicationMetadataV106Service.js';
import {
    POST_SALE_HEALTH_ENVELOPE_V107_OVERRIDE_KEY,
    assertPostSaleHealthEnvelopeV107Manifest
} from '../src/services/postSaleHealthEnvelopeV107Service.js';
import { assertPostSaleEligibleBatchV108Manifest } from '../src/services/postSaleEligibleBatchV108Service.js';

await import('../scripts/lib/ec-runtime-successor-v97-context.mjs');

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const writeCanonical = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);

test('identidade publicada V105 lê o envelope V70 sem adulterar release-source', () => {
    const release = '20260903T040000Z_production-20260903-1234567';
    const commit = `1234567${'a'.repeat(33)}`;
    const tree = 'b'.repeat(40);
    const tag = 'production-20260903-1234567';
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'post-sale-v106-'));
    const releaseDir = path.join(parent, release);
    fs.mkdirSync(releaseDir);
    try {
        const source = { publicationStatus: 'staged_candidate', functionalCommit: commit, functionalTree: tree };
        const sourceBuffer = Buffer.from(`${JSON.stringify(source, null, 2)}\n`);
        fs.writeFileSync(path.join(releaseDir, '.release-source.json'), sourceBuffer);
        const publication = {
            status: 'production_published', release, functionalCommit: commit, functionalTree: tree,
            publicationTag: tag, releaseMetadataSha256: sha256(sourceBuffer)
        };
        const publicationBuffer = Buffer.from(`${JSON.stringify(publication, null, 2)}\n`);
        fs.writeFileSync(path.join(releaseDir, '.release-publication.json'), publicationBuffer);
        writeCanonical(path.join(releaseDir, '.publication-complete.json'), {
            status: 'complete', publicationStatus: 'production_published', release,
            functionalCommit: commit, functionalTree: tree, publicationTag: tag,
            publicationMetadataSha256: sha256(publicationBuffer)
        });

        assert.deepEqual(resolvePostSaleV105PublishedReleaseIdentity(releaseDir, release), {
            release, commit, tree, tag
        });
        source.publicationStatus = 'production_published';
        writeCanonical(path.join(releaseDir, '.release-source.json'), source);
        assert.throws(
            () => resolvePostSaleV105PublishedReleaseIdentity(releaseDir, release),
            /published_release_identity_invalid/
        );
    } finally {
        fs.rmSync(parent, { recursive: true, force: true });
    }
});

test('manifesto V106 protege o binding ao envelope de publicação V70', () => {
    const latest = assertPostSaleEligibleBatchV108Manifest();
    const previousHealthOverrides = Array.isArray(globalThis[POST_SALE_HEALTH_ENVELOPE_V107_OVERRIDE_KEY])
        ? globalThis[POST_SALE_HEALTH_ENVELOPE_V107_OVERRIDE_KEY]
        : [];
    globalThis[POST_SALE_HEALTH_ENVELOPE_V107_OVERRIDE_KEY] = [
        ...new Set([...previousHealthOverrides, ...latest.overrides])
    ];
    const successor = assertPostSaleHealthEnvelopeV107Manifest();
    const previousPublicationOverrides = Array.isArray(globalThis[POST_SALE_PUBLICATION_METADATA_V106_OVERRIDE_KEY])
        ? globalThis[POST_SALE_PUBLICATION_METADATA_V106_OVERRIDE_KEY]
        : [];
    globalThis[POST_SALE_PUBLICATION_METADATA_V106_OVERRIDE_KEY] = [
        ...new Set([...previousPublicationOverrides, ...latest.overrides, ...successor.overrides])
    ];
    const result = assertPostSalePublicationMetadataV106Manifest();
    assert.equal(result.ready, true);
    assert.equal(result.manifest.policy.releaseSourceRemainsStagedCandidate, true);
    assert.equal(result.manifest.policy.externalEffectsAllowed, false);
});
