import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

import './ec-runtime-successor-v144-bootstrap-context.mjs';

const FREEZE_PATH = 'docs/freeze/guard-successor-alignment-v192-20260919.json';
const V171_PATH = 'docs/freeze/ec-traffic-restoration-v171-20260917.json';
const V185_PATH = 'docs/freeze/v185-metrics-radar-readonly-20260918.json';
const EXPECTED_OVERRIDES = Object.freeze([
    '.github/workflows/ec-panel-quality.yml',
    'src/routes/zapi.js',
    'src/routes/whatsapp.js'
]);

const readText = (relativePath) => fs.readFileSync(new URL(`../../${relativePath}`, import.meta.url), 'utf8');
const sha256Text = (value) => crypto.createHash('sha256').update(value).digest('hex');
const sha256File = (relativePath) => sha256Text(readText(relativePath));
const readCanonicalJson = (relativePath, label) => {
    const text = readText(relativePath);
    const value = JSON.parse(text);
    assert.equal(text, `${JSON.stringify(value, null, 2)}\n`, `[V192] ${label}_manifest_not_canonical`);
    return { text, value };
};

export const assertV192OverrideAllowlist = (overrides) => {
    const normalized = [...new Set((overrides || []).map((value) => String(value || '').trim()))].sort();
    assert.equal(normalized.some((file) => !file || /[*?\[\]]/.test(file)), false, '[V192] wildcard_or_empty_override');
    assert.deepEqual(normalized, [...EXPECTED_OVERRIDES].sort(), '[V192] override_allowlist_mismatch');
    return normalized;
};

export const assertV192LineageHash = ({ path, actualSha256, expectedSha256 } = {}) => {
    assert.ok(EXPECTED_OVERRIDES.includes(path), `[V192] unauthorized_lineage_path:${path}`);
    assert.match(String(actualSha256 || ''), /^[a-f0-9]{64}$/, `[V192] invalid_actual_sha:${path}`);
    assert.equal(actualSha256, expectedSha256, `[V192] successor_hash_mismatch:${path}`);
    return true;
};

const freeze = readCanonicalJson(FREEZE_PATH, 'v192');
const v171 = readCanonicalJson(V171_PATH, 'v171');
const v185 = readCanonicalJson(V185_PATH, 'v185');
const manifest = freeze.value;

assert.equal(manifest.freezeId, 'GUARD_SUCCESSOR_ALIGNMENT_V192_20260919');
assert.equal(manifest.version, 'V192');
assert.equal(manifest.baseCommit, 'c0cca110a87c82044db413934c7f017c23a9cfca');
assert.equal(manifest.branch, 'codex/v192-guard-successor-alignment');
assert.equal(manifest.policy.guardLineageOnly, true);
assert.equal(manifest.policy.runtimeFilesChanged, 0);
assert.equal(manifest.policy.guardsBypassed, false);
assert.equal(manifest.policy.productionChanged, false);
assertV192OverrideAllowlist(manifest.authorizedOverrides.map((entry) => entry.path));

assert.equal(v171.value.freezeId, 'EC_TRAFFIC_RESTORATION_V171_20260917');
assert.equal(v185.value.freezeId, 'V185_METRICS_RADAR_READONLY_20260918');
assert.equal(sha256Text(v171.text), manifest.successorManifests[V171_PATH]);
assert.equal(sha256Text(v185.text), manifest.successorManifests[V185_PATH]);

const expectedLineage = {
    '.github/workflows/ec-panel-quality.yml': {
        sha256: v171.value.protectedFiles['.github/workflows/ec-panel-quality.yml'],
        source: V171_PATH
    },
    'src/routes/zapi.js': {
        sha256: v171.value.protectedFiles['src/routes/zapi.js'],
        source: V171_PATH
    },
    'src/routes/whatsapp.js': {
        sha256: v185.value.hashLocks['src/routes/whatsapp.js'],
        source: V185_PATH
    }
};

for (const entry of manifest.authorizedOverrides) {
    const expected = expectedLineage[entry.path];
    assert.ok(expected, `[V192] lineage_not_declared:${entry.path}`);
    assert.equal(entry.successorManifest, expected.source, `[V192] lineage_source_mismatch:${entry.path}`);
    assert.equal(entry.successorManifestSha256, manifest.successorManifests[expected.source], `[V192] lineage_manifest_hash_mismatch:${entry.path}`);
    assert.equal(entry.currentSha256, expected.sha256, `[V192] lineage_declared_hash_mismatch:${entry.path}`);
    assertV192LineageHash({
        path: entry.path,
        actualSha256: sha256File(entry.path),
        expectedSha256: expected.sha256
    });
}

globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES = [
    ...new Set([
        ...(globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES || []),
        ...EXPECTED_OVERRIDES
    ])
];

globalThis.__VITALISMEN_V192_GUARD_SUCCESSOR_CONTEXT = Object.freeze({
    loaded: true,
    freezeId: manifest.freezeId,
    baseCommit: manifest.baseCommit,
    manifestSha256: sha256Text(freeze.text),
    authorizedOverrides: EXPECTED_OVERRIDES,
    lineage: Object.freeze(Object.fromEntries(
        manifest.authorizedOverrides.map((entry) => [entry.path, Object.freeze({ ...entry })])
    )),
    policy: Object.freeze({ ...manifest.policy })
});

if (process.env.V192_SUCCESSOR_AUDIT === '1') {
    console.log('[V192] SUCCESSOR_CONTEXT=LOADED');
    console.log(`[V192] AUTHORIZED_OVERRIDES=${EXPECTED_OVERRIDES.join(',')}`);
}
