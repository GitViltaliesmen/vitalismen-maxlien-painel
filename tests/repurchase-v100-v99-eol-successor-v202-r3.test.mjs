import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import '../scripts/lib/repurchase-v141-v185-governance-v202-r2-context.mjs';
import {
    assertV100R3CanonicalFile,
    assertV100R3ManifestBytes,
    assertV100R3Successor
} from '../scripts/guard-repurchase-v100-v99-eol-successor-v202-r3.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = 'docs/freeze/repurchase-v100-v99-eol-successor-v202-r3-20260924.json';
const read = relative => fs.readFileSync(path.join(ROOT, relative));
const blob = oid => execFileSync('git', ['cat-file', 'blob', oid], { cwd: ROOT });
const manifest = assertV100R3ManifestBytes(read(MANIFEST));

test('V100 successor validates all three V99 canonical Git blobs and preserves the historical test', () => {
    const result = assertV100R3Successor();
    assert.equal(result.v99BlobIdentity, 'PASS');
    assert.equal(result.v99SemanticDiff, 'NONE');
    assert.equal(result.v100HistoricalPreserved, true);
    assert.equal(result.v100Successor, 'PASS');
});

for (const [relative, identity] of Object.entries(manifest.v99Evidence)) {
    test(`wrong canonical V99 blob is blocked: ${relative}`, () => {
        assert.throws(() => assertV100R3Successor({
            gitBlob: oid => oid === identity.blobOid ? Buffer.from('wrong blob') : blob(oid)
        }), /V100_R3_GIT_BLOB_INVALID/);
    });
}

test('semantic worktree change is blocked even if the Git blob remains correct', () => {
    const target = Object.keys(manifest.v99Evidence)[0];
    const changed = Buffer.from(read(target));
    changed[0] ^= 1;
    assert.throws(() => assertV100R3Successor({
        read: relative => relative === target ? changed : read(relative)
    }), /V100_R3_SEMANTIC_DIFF/);
});

test('wrong blob OID is blocked independently of SHA-256', () => {
    const relative = Object.keys(manifest.v99Evidence)[0];
    const identity = manifest.v99Evidence[relative];
    assert.throws(() => assertV100R3CanonicalFile({
        relative,
        worktree: read(relative),
        blob: blob(identity.blobOid),
        oid: '0'.repeat(40),
        identity
    }), /V100_R3_GIT_OID_INVALID/);
});

test('tampered successor manifest is blocked', () => {
    const changed = Buffer.from(read(MANIFEST).toString('utf8').replace('V202-R3', 'V202-XX'));
    assert.throws(() => assertV100R3ManifestBytes(changed), /V100_R3_MANIFEST_TAMPERED/);
    assert.throws(() => assertV100R3Successor({
        read: relative => relative === MANIFEST ? changed : read(relative)
    }), /V100_R3_MANIFEST_TAMPERED/);
});

test('missing successor context is blocked without loading the preload implicitly', () => {
    assert.throws(() => assertV100R3Successor({ context: null }),
        /V100_R3_SUCCESSOR_CONTEXT_REQUIRED/);
    const run = spawnSync(process.execPath,
        ['scripts/guard-repurchase-v100-v99-eol-successor-v202-r3.mjs'], {
            cwd: ROOT,
            encoding: 'utf8',
            env: { ...process.env, NODE_OPTIONS: '' }
        });
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, /V100_R3_SUCCESSOR_CONTEXT_REQUIRED/);
});

test('changed historical V100 test is blocked', () => {
    const target = manifest.historicalV100Test.path;
    const changed = Buffer.from(read(target));
    changed[0] ^= 1;
    assert.throws(() => assertV100R3Successor({
        read: relative => relative === target ? changed : read(relative)
    }), /V100_R3_SEMANTIC_DIFF/);
});

test('changed V100 freeze expectations are blocked', () => {
    const target = 'docs/freeze/ec-repurchase-panel-precedence-v100-20260902.json';
    const changed = JSON.parse(read(target).toString('utf8'));
    changed.parentManifestSha256 = '0'.repeat(64);
    assert.throws(() => assertV100R3Successor({
        read: relative => relative === target ? Buffer.from(JSON.stringify(changed)) : read(relative)
    }), /V100_R3_HISTORICAL_EXPECTATIONS_CHANGED/);
});
