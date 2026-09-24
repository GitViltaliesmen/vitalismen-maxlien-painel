import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MANIFEST = 'docs/freeze/repurchase-v141-v185-governance-successor-v202-r1-20260924.json';
const originalReadFileSync = fs.readFileSync.bind(fs);
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const blobOid = bytes => crypto.createHash('sha1')
    .update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes]))
    .digest('hex');

const expected = {
    freezeId: 'REPURCHASE_V141_TO_V185_GOVERNANCE_V202_R1_20260924',
    version: 'V202-R1',
    baseCommit: '790a5079b7cd4693127f84d933809042dfc018be',
    baseTree: '92fab5b70d2f028293661bbc2393be6c08afb740',
    functionalCommit: 'd333c9b3bdeb57644ce78b7f0575301fd9a102dd',
    parentManifest: 'docs/freeze/repurchase-v141-v185-governance-successor-v202-20260924.json',
    parentManifestSha256: '2fff4cafc641a97b6047745f54e0e42cd242cdb98d22e4cc7a97c3f5c4c7a129',
    v141SourceCommit: 'c68163e1013782e013456baeba65538770a7c220',
    v141SourceDate: '2026-09-08T02:50:37-03:00',
    canonicalFiles: {
        'tests/meta-funnel-reconciliation-v141.test.mjs': {
            blobOid: '24cc12a272a050579242c3db39c260ad47d4ff1a',
            sha256: 'ddac187d2b43cd29808845d1c7b961fac38e51eae7f945784de0a744d9e7db42'
        },
        'docs/freeze/v185-metrics-radar-readonly-20260918.json': {
            blobOid: '93604765b8d3ab8c069537d3b4413c35da141d2e',
            sha256: '4434eece40862a52fb2db8cc6dc27c3c7de4f5c35f6dc931b203750d553363e7'
        },
        'docs/freeze/ec-v185-canonical-successor-v186-20260918.json': {
            blobOid: 'e125033ec308fc62e1bee3030a5af91f23b06366',
            sha256: '86f20f710d132991d95838a6ca4b474ff1814ce0f46b317debfaa63d707422e7'
        },
        'public/funnel-metrics.html': {
            blobOid: '497522fd7f666e480763e6aff66619f1561a3b62',
            sha256: '2231774777477240d46eae5021a2f2408ce3bffbf31d85a4807b84c5d7045b18'
        }
    },
    historicalV202Files: {
        'docs/freeze/repurchase-v141-v185-governance-successor-v202-20260924.json': '2fff4cafc641a97b6047745f54e0e42cd242cdb98d22e4cc7a97c3f5c4c7a129',
        'scripts/guard-repurchase-v141-v185-governance-v202.mjs': '9e0ac170ab8fca0a463d4126243afbd63a62cdcbbe625b6afaa6cc2fa82e7ffe',
        'scripts/run-repurchase-v141-v185-governance-v202.mjs': '8a35130e70dcd0cddc42a345aeae9b14d5d4a00a5a11d03a6825d820ea9c91b7',
        'tests/repurchase-v141-v185-governance-v202.test.mjs': '9c2d9699d8df0d26e5ada030a13332f8b16aaf9587d6aaeb449021bc70e37a04'
    },
    policy: {
        failClosed: true,
        allowedWorktreeEol: 'UNIFORM_LF_OR_CRLF',
        canonicalIdentity: 'GIT_BLOB_OID_AND_SHA256',
        historicalV202FilesChanged: false,
        functionalFilesChanged: false,
        productionChanged: false
    }
};

export const assertManifestBytes = bytes => {
    const text = bytes.toString('utf8');
    const candidate = JSON.parse(text);
    assert.equal(text, `${JSON.stringify(candidate, null, 2)}\n`, 'V202_R1_MANIFEST_NOT_CANONICAL');
    assert.deepEqual(candidate, expected, 'V202_R1_MANIFEST_INVALID');
    return candidate;
};

const manifestBytes = originalReadFileSync(path.join(ROOT, MANIFEST));
assertManifestBytes(manifestBytes);

export const assertHistoricalV202Files = () => {
    for (const [relative, hash] of Object.entries(expected.historicalV202Files)) {
        assert.equal(sha256(originalReadFileSync(path.join(ROOT, relative))), hash,
            `V202_R1_HISTORICAL_FILE_CHANGED:${relative}`);
    }
    return true;
};

export const assertCanonicalBuffer = (relative, raw) => {
    const identity = expected.canonicalFiles[relative];
    assert.ok(identity, `V202_R1_UNAUTHORIZED_CANONICAL_FILE:${relative}`);
    assert.ok(Buffer.isBuffer(raw), `V202_R1_BUFFER_REQUIRED:${relative}`);
    const source = raw.toString('utf8');
    const crlf = (source.match(/\r\n/g) || []).length;
    const linefeeds = (source.match(/\n/g) || []).length;
    assert.equal((source.match(/\r(?!\n)/g) || []).length, 0,
        `V202_R1_BARE_CR_FORBIDDEN:${relative}`);
    assert.ok(crlf === 0 || crlf === linefeeds,
        `V202_R1_MIXED_EOL_FORBIDDEN:${relative}`);
    const canonical = Buffer.from(source.replace(/\r\n/g, '\n'), 'utf8');
    assert.equal(sha256(canonical), identity.sha256,
        `V202_R1_CANONICAL_SHA_INVALID:${relative}`);
    assert.equal(blobOid(canonical), identity.blobOid,
        `V202_R1_GIT_BLOB_INVALID:${relative}`);
    return canonical;
};

assertHistoricalV202Files();
for (const relative of Object.keys(expected.canonicalFiles)) {
    assertCanonicalBuffer(relative, originalReadFileSync(path.join(ROOT, relative)));
}

const absoluteCanonicalPaths = new Map(Object.keys(expected.canonicalFiles).map(relative => [
    path.resolve(ROOT, relative).toLowerCase(), relative
]));
const bridgeReadFileSync = (file, options) => {
    const absolute = typeof file === 'string'
        ? path.resolve(file).toLowerCase()
        : file instanceof URL ? fileURLToPath(file).toLowerCase() : null;
    const relative = absoluteCanonicalPaths.get(absolute);
    if (!relative) return originalReadFileSync(file, options);
    const canonical = assertCanonicalBuffer(relative, originalReadFileSync(file));
    const encoding = typeof options === 'string' ? options : options?.encoding;
    return encoding ? canonical.toString(encoding) : canonical;
};

fs.readFileSync = bridgeReadFileSync;
globalThis.__VITALISMEN_V202_R1_GOVERNANCE_CONTEXT = Object.freeze({
    loaded: true,
    freezeId: expected.freezeId,
    manifestSha256: sha256(manifestBytes),
    bridgeReadFileSync
});
