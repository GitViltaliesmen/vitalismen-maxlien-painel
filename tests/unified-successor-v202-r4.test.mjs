import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
    assertBaseIdentity,
    assertCanonicalEntry,
    assertExternalLocks,
    assertRequiredContexts,
    assertRestored,
    assertSpecialIdentities,
    assertUnifiedManifest,
    BASE_HEAD,
    BASE_TREE,
    MANIFEST_PATH,
    PRELOAD_PATH,
    PRELOAD_SHA256,
    SHA
} from '../scripts/guard-unified-successor-v202-r4.mjs';

const root = path.resolve(import.meta.dirname, '..');
const manifestBytes = fs.readFileSync(path.join(root, MANIFEST_PATH));
const preloadBytes = fs.readFileSync(path.join(root, PRELOAD_PATH));
const manifest = assertUnifiedManifest(manifestBytes, preloadBytes);
const copy = () => structuredClone(manifest);
const changed = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const entry = manifest.allowlist.find(item => item.path === 'src/routes/shipments.js');
const oid = execFileSync('git', ['rev-parse', `HEAD:${entry.path}`], {
    cwd: root, encoding: 'utf8'
}).trim();
const blob = execFileSync('git', ['cat-file', 'blob', oid], { cwd: root });

test('R4 01 HEAD errado bloqueia', () => {
    assert.throws(() => assertBaseIdentity({ baseHead: '0'.repeat(40),
        baseTree: BASE_TREE, headIsDescendant: true }), /R4_BASE_HEAD_CHANGED/);
});
test('R4 02 TREE errada bloqueia', () => {
    assert.throws(() => assertBaseIdentity({ baseHead: BASE_HEAD,
        baseTree: '0'.repeat(40), headIsDescendant: true }), /R4_BASE_TREE_CHANGED/);
});
test('R4 03 blob diferente bloqueia', () => {
    assert.throws(() => assertCanonicalEntry(entry, oid, Buffer.concat([blob, Buffer.from('x')]), blob),
        /R4_GIT_OBJECT_INVALID/);
});
test('R4 04 blob ausente bloqueia', () => {
    assert.throws(() => assertCanonicalEntry(entry, oid, null, blob), /R4_BLOB_MISSING/);
});
test('R4 05 allowlist extra bloqueia mesmo com novo hash fornecido', () => {
    const value = copy();
    value.allowlist.push({ ...entry, path: 'src/extra.js' });
    const bytes = changed(value);
    assert.throws(() => assertUnifiedManifest(bytes, preloadBytes, SHA(bytes), PRELOAD_SHA256),
        /83/);
});
test('R4 06 allowlist incompleta bloqueia mesmo com novo hash fornecido', () => {
    const value = copy();
    value.allowlist.pop();
    const bytes = changed(value);
    assert.throws(() => assertUnifiedManifest(bytes, preloadBytes, SHA(bytes), PRELOAD_SHA256),
        /83/);
});
test('R4 07 manifesto adulterado bloqueia', () => {
    assert.throws(() => assertUnifiedManifest(Buffer.concat([manifestBytes, Buffer.from('x')]),
        preloadBytes), /R4_MANIFEST_TAMPERED/);
});
test('R4 08 preload adulterado bloqueia', () => {
    assert.throws(() => assertUnifiedManifest(manifestBytes,
        Buffer.concat([preloadBytes, Buffer.from('x')])), /R4_PRELOAD_TAMPERED/);
});
test('R4 09 V199 ausente bloqueia', () => {
    assert.throws(() => assertRequiredContexts({ v199: false, v146: true }),
        /R4_V199_CONTEXT_MISSING/);
});
test('R4 10 V146 ausente bloqueia', () => {
    assert.throws(() => assertRequiredContexts({ v199: true, v146: false }),
        /R4_V146_CONTEXT_MISSING/);
});
test('R4 11 SHA antigo de shipments bloqueia', () => {
    const value = copy();
    value.allowlist.find(item => item.path === entry.path).canonicalSha256 =
        '1be80bc61829c56060fd67d1c7248068983a7ac7ddd1d61b2b9e371bdbe49af0';
    assert.throws(() => assertSpecialIdentities(value), /R4_SHIPMENTS_UNAUTHORIZED/);
});
test('R4 12 SHA desconhecido de shipments bloqueia', () => {
    const value = copy();
    value.allowlist.find(item => item.path === entry.path).canonicalSha256 = '0'.repeat(64);
    assert.throws(() => assertSpecialIdentities(value), /R4_SHIPMENTS_UNAUTHORIZED/);
});
test('R4 13 assert-official-root não autorizado bloqueia', () => {
    const value = copy();
    value.allowlist.find(item => item.path === 'scripts/assert-official-root.mjs')
        .canonicalSha256 = '0'.repeat(64);
    assert.throws(() => assertSpecialIdentities(value), /R4_OFFICIAL_ROOT_UNAUTHORIZED/);
});
test('R4 14 contexto vazado bloqueia', () => {
    assert.throws(() => assertRestored(new Map(), new Map([['__VITALISMEN_TEST', true]])),
        /R4_CONTEXT_LEAK/);
});
test('R4 15 Dropi externo habilitado bloqueia', () => {
    assert.throws(() => assertExternalLocks(manifest.externalEffectLocks,
        { DROPPI_EC_ACTIVE_SYNC_ENABLED: 'true' }), /R4_EXTERNAL_EFFECT_ENABLED/);
});
test('R4 16 Purchase externo habilitado bloqueia', () => {
    assert.throws(() => assertExternalLocks(manifest.externalEffectLocks,
        { VITALISMEN_META_PURCHASE_ENABLED: 'true' }), /R4_EXTERNAL_EFFECT_ENABLED/);
});
test('R4 17 commit base não ancestral bloqueia', () => {
    assert.throws(() => assertBaseIdentity({ baseHead: BASE_HEAD, baseTree: BASE_TREE,
        headIsDescendant: false }), /R4_HEAD_NOT_DESCENDANT/);
});
test('R4 18 alteração semântica do worktree bloqueia', () => {
    assert.throws(() => assertCanonicalEntry(entry, oid, blob,
        Buffer.concat([blob, Buffer.from('x')])), /R4_SEMANTIC_DIFF/);
});
test('R4 positivo: manifesto, identidades especiais, bytes e locks', () => {
    assert.equal(assertSpecialIdentities(manifest), true);
    assert.equal(assertCanonicalEntry(entry, oid, blob, blob), true);
    assert.equal(assertExternalLocks(manifest.externalEffectLocks), true);
    assert.equal(assertRequiredContexts({ v199: true, v146: true }), true);
});
