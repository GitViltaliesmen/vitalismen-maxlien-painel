import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = 'docs/freeze/repurchase-v100-v99-eol-successor-v202-r3-20260924.json';
const MANIFEST_SHA256 = '0ebca31779fa390d77f223d77f070788ac7ff92f2ea9c1c253404cc45952c0c3';
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const blobOid = bytes => crypto.createHash('sha1')
    .update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes])).digest('hex');

export const assertV100R3ManifestBytes = bytes => {
    const text = bytes.toString('utf8');
    const value = JSON.parse(text);
    assert.equal(text, `${JSON.stringify(value, null, 2)}\n`, 'V100_R3_MANIFEST_NOT_CANONICAL');
    assert.equal(sha256(bytes), MANIFEST_SHA256, 'V100_R3_MANIFEST_TAMPERED');
    assert.equal(value.freezeId, 'REPURCHASE_V100_V99_EOL_SUCCESSOR_V202_R3_20260924');
    assert.equal(value.version, 'V202-R3');
    assert.equal(value.policy.canonicalIdentity, 'GIT_BLOB_OID_AND_SHA256');
    assert.equal(value.policy.failClosed, true);
    return value;
};

export const assertV100R3CanonicalFile = ({ relative, worktree, blob, oid, identity }) => {
    assert.ok(Buffer.isBuffer(worktree) && Buffer.isBuffer(blob),
        `V100_R3_BYTES_REQUIRED:${relative}`);
    assert.equal(oid, identity.blobOid, `V100_R3_GIT_OID_INVALID:${relative}`);
    assert.equal(blobOid(blob), identity.blobOid, `V100_R3_GIT_BLOB_INVALID:${relative}`);
    assert.equal(sha256(blob), identity.sha256, `V100_R3_GIT_SHA_INVALID:${relative}`);
    const source = worktree.toString('utf8');
    assert.deepEqual(Buffer.from(source, 'utf8'), worktree, `V100_R3_UTF8_INVALID:${relative}`);
    const crlf = (source.match(/\r\n/g) || []).length;
    const linefeeds = (source.match(/\n/g) || []).length;
    assert.equal((source.match(/\r(?!\n)/g) || []).length, 0,
        `V100_R3_BARE_CR_FORBIDDEN:${relative}`);
    assert.ok(crlf === 0 || crlf === linefeeds, `V100_R3_MIXED_EOL_FORBIDDEN:${relative}`);
    const normalized = Buffer.from(source.replace(/\r\n/g, '\n'), 'utf8');
    assert.deepEqual(normalized, blob, `V100_R3_SEMANTIC_DIFF:${relative}`);
    assert.equal(sha256(normalized), identity.sha256, `V100_R3_WORKTREE_SHA_INVALID:${relative}`);
    return true;
};

export const assertV100R3Successor = ({
    context = globalThis.__VITALISMEN_V202_R2_SUCCESSOR_CONTEXT,
    read = relative => fs.readFileSync(path.join(ROOT, relative)),
    gitOid = relative => execFileSync('git', ['rev-parse', `HEAD:${relative}`], {
        cwd: ROOT, encoding: 'utf8'
    }).trim(),
    gitBlob = oid => execFileSync('git', ['cat-file', 'blob', oid], { cwd: ROOT })
} = {}) => {
    assert.equal(context?.loaded, true, 'V100_R3_SUCCESSOR_CONTEXT_REQUIRED');
    assert.equal(context.freezeId, 'REPURCHASE_V141_TO_V185_GOVERNANCE_V202_R2_20260924',
        'V100_R3_WRONG_CONTEXT');
    const manifest = assertV100R3ManifestBytes(read(MANIFEST));
    assert.equal(context.baseCommit, manifest.baseCommit, 'V100_R3_BASE_COMMIT_INVALID');
    assert.equal(context.baseTree, manifest.baseTree, 'V100_R3_BASE_TREE_INVALID');
    assert.equal(sha256(read(manifest.parentManifest)), manifest.parentManifestSha256,
        'V100_R3_PARENT_MANIFEST_INVALID');
    assert.equal(manifest.policy.historicalV100Preserved, true);
    assert.equal(manifest.policy.historicalV100CurrentGate, false);
    const entries = [manifest.historicalV100Test, ...Object.entries(manifest.v99Evidence)
        .map(([relative, identity]) => ({ path: relative, ...identity }))];
    for (const entry of entries) {
        const oid = gitOid(entry.path);
        assertV100R3CanonicalFile({
            relative: entry.path,
            worktree: read(entry.path),
            blob: gitBlob(oid),
            oid,
            identity: entry
        });
    }
    const v100Manifest = JSON.parse(read('docs/freeze/ec-repurchase-panel-precedence-v100-20260902.json'));
    const expected = Object.values(manifest.v99Evidence).map(identity => identity.sha256);
    assert.deepEqual([
        v100Manifest.parentManifestSha256,
        v100Manifest.parentFreezeSha256,
        v100Manifest.parentAttestationSha256
    ], expected, 'V100_R3_HISTORICAL_EXPECTATIONS_CHANGED');
    const v100Service = read('src/services/ecRepurchasePanelPrecedenceV100Service.js').toString('utf8');
    for (const hash of expected) {
        assert.ok(v100Service.includes(`'${hash}'`), `V100_R3_SERVICE_EXPECTATION_MISSING:${hash}`);
    }
    return Object.freeze({
        contract: 'V202-R3',
        v99BlobIdentity: 'PASS',
        v99SemanticDiff: 'NONE',
        v100HistoricalPreserved: true,
        v100Successor: 'PASS'
    });
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    assertV100R3Successor();
    console.log('V100_R3_SUCCESSOR_GUARD=PASS');
}
