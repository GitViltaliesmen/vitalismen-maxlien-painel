'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { validateRuntimeConfigSuccessor, changedKeys } = require('../ops/lib/runtime-config-successor-v1.cjs');
const sha = (x) => crypto.createHash('sha256').update(x).digest('hex');

function fixture(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-config-successor-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const directory = path.join(root, 'attestations');
    const evidence = path.join(root, 'evidence');
    const release = path.join(root, 'release');
    for (const dir of [directory, evidence, release]) fs.mkdirSync(dir, { mode: 0o700 });
    const put = (file, bytes, mode = 0o400) => { fs.writeFileSync(file, bytes, { mode }); fs.chmodSync(file, mode); return { path: file, sha256: sha(bytes) }; };
    const before = Buffer.from('META_ACCESS_TOKEN=synthetic_old\nOTHER=synthetic_protected\n');
    const after = Buffer.from('META_ACCESS_TOKEN=synthetic_new\nOTHER=synthetic_protected\n');
    const old = put(path.join(evidence, 'before.env'), before, 0o600);
    put(path.join(release, '.env'), after, 0o600);
    const proof = put(path.join(evidence, 'authorization.json'), '{}\n');
    const tools = [put(path.join(root, 'helper'), 'helper\n', 0o755), put(path.join(root, 'validator'), 'validator\n')];
    const facts = { releaseName: '20260908T234113Z_production-20260908-4d848d7', releaseDirectory: release,
        commit: '4'.repeat(40), tree: '5'.repeat(40), functionalPayloadSha256: '6'.repeat(64),
        originalEnvSha256: sha(before), actualEnvSha256: sha(after), metadataHashes: { source: '7'.repeat(64), staging: '8'.repeat(64), publication: '9'.repeat(64), publicationComplete: 'a'.repeat(64) } };
    const record = { version: 1, status: 'AUTHORIZED_RUNTIME_CONFIG_SUCCESSOR', createdAt: new Date().toISOString(),
        reason: 'AUTHORIZED_POST_FREEZE_SECRET_OR_CONFIG_ROTATION', baseRelease: facts.releaseName,
        baseCommit: facts.commit, baseTree: facts.tree, functionalPayloadSha256: facts.functionalPayloadSha256,
        originalEnvSha256: facts.originalEnvSha256, authorizedSuccessorEnvSha256: facts.actualEnvSha256,
        metadataHashes: facts.metadataHashes, authorizedChangedKeys: ['META_ACCESS_TOKEN'],
        changes: [{ timestamp: '2026-09-09T23:22:57Z', actionType: 'AUTHORIZED_SECRET_ROTATION', before: old,
            afterSha256: sha(after), changedKeyNames: ['META_ACCESS_TOKEN'], provenance: [proof] }],
        authorizationEvidence: [proof], toolingFiles: tools, noSecretValues: true };
    const file = path.join(directory, `${facts.releaseName}.json`);
    const seal = () => { const bytes = `${JSON.stringify(record, null, 2)}\n`; put(file, bytes); put(`${file}.sha256`, `${sha(bytes)}\n`); };
    seal();
    const options = { uid: process.getuid(), attestationDirectory: directory, evidenceRoots: [evidence], toolingPaths: tools.map((x) => x.path) };
    return { root, facts, record, options, file, seal, put, validate: () => validateRuntimeConfigSuccessor(facts, options) };
}

test('accepts a sealed authorized successor with unchanged code and original envelopes', (t) => {
    const x = fixture(t); assert.equal(x.validate().authorizedEnvSha256, x.facts.actualEnvSha256);
});
test('verifies every link of a two-step rotation with the original hash preserved', (t) => {
    const x = fixture(t);
    const intermediate = x.put(path.join(x.options.evidenceRoots[0], 'intermediate.env'),
        'META_ACCESS_TOKEN=synthetic_intermediate\nOTHER=synthetic_protected\n', 0o600);
    const last = { ...x.record.changes[0], timestamp: '2026-09-09T23:23:00Z', before: intermediate };
    x.record.changes[0].afterSha256 = intermediate.sha256;
    x.record.changes.push(last); x.seal();
    assert.equal(x.validate().originalEnvSha256, x.facts.originalEnvSha256);
    fs.appendFileSync(intermediate.path, '# tamper\n');
    assert.throws(x.validate, /evidence hash/);
});
test('rejects restoring the original env when a successor has been attested', (t) => {
    const x = fixture(t);
    fs.copyFileSync(x.record.changes[0].before.path, path.join(x.facts.releaseDirectory, '.env'));
    x.facts.actualEnvSha256 = x.facts.originalEnvSha256;
    assert.throws(x.validate, /authorizedSuccessorEnvSha256/);
});
for (const field of ['commit', 'tree', 'functionalPayloadSha256', 'originalEnvSha256', 'actualEnvSha256']) {
    test(`rejects changed ${field}`, (t) => { const x = fixture(t); x.facts[field] = 'b'.repeat(x.facts[field].length); assert.throws(x.validate); });
}
test('rejects changed original metadata', (t) => { const x = fixture(t); x.facts.metadataHashes = { ...x.facts.metadataHashes, staging: 'b'.repeat(64) }; assert.throws(x.validate); });
test('rejects missing seal', (t) => { const x = fixture(t); fs.unlinkSync(`${x.file}.sha256`); assert.throws(x.validate); });
test('rejects tampered attestation before parsing', (t) => { const x = fixture(t); fs.appendFileSync(x.file, ' '); assert.throws(x.validate, /seal/); });
test('rejects unknown attestation fields', (t) => { const x = fixture(t); x.record.ignoreMismatch = true; x.seal(); assert.throws(x.validate); });
test('rejects writable attestation', (t) => { const x = fixture(t); fs.chmodSync(x.file, 0o600); assert.throws(x.validate, /permissions/); });
test('rejects writable attestation directory', (t) => { const x = fixture(t); fs.chmodSync(x.options.attestationDirectory, 0o777); assert.throws(x.validate, /mode/); });
test('rejects wrong owner', (t) => { const x = fixture(t); x.options.uid++; assert.throws(x.validate, /owner/); });
test('rejects attestation symlink', (t) => { const x = fixture(t); fs.renameSync(x.file, `${x.file}.real`); fs.symlinkSync(`${x.file}.real`, x.file); assert.throws(x.validate, /symlink/); });
test('rejects provenance path traversal', (t) => { const x = fixture(t); x.record.changes[0].before.path = `${x.root}/evidence/../evidence/before.env`; x.seal(); assert.throws(x.validate, /noncanonical/); });
test('rejects modified receipt', (t) => { const x = fixture(t); fs.appendFileSync(x.record.authorizationEvidence[0].path, ' '); assert.throws(x.validate, /evidence hash/); });
test('rejects missing approval evidence', (t) => { const x = fixture(t); x.record.authorizationEvidence = []; x.seal(); assert.throws(x.validate, /authorization evidence/); });
test('rejects unexpected key changes even with a resealed document', (t) => { const x = fixture(t); x.record.changes[0].changedKeyNames = ['OTHER']; x.seal(); assert.throws(x.validate, /unexpected changed/); });
test('rejects broken chain', (t) => { const x = fixture(t); x.record.changes[0].before.sha256 = 'b'.repeat(64); x.seal(); assert.throws(x.validate, /broken runtime/); });
test('rejects future change', (t) => { const x = fixture(t); x.record.changes[0].timestamp = '2099-01-01T00:00:00Z'; x.seal(); assert.throws(x.validate, /chronology/); });
test('rejects missing per-change provenance', (t) => { const x = fixture(t); x.record.changes[0].provenance = []; x.seal(); assert.throws(x.validate, /provenance/); });
test('rejects modified tooling', (t) => { const x = fixture(t); fs.appendFileSync(x.record.toolingFiles[0].path, ' '); assert.throws(x.validate, /tooling hash/); });
test('rejects environment mutation after the fingerprint was collected', (t) => { const x = fixture(t); fs.appendFileSync(path.join(x.facts.releaseDirectory, '.env'), '# unexpected\n'); assert.throws(x.validate, /changed during validation/); });
test('rejects duplicate keys without disclosing values', () => {
    assert.throws(() => changedKeys(Buffer.from('A=private_sentinel\nA=x\n'), Buffer.from('A=y\n')), (e) => !e.message.includes('private_sentinel') && /duplicate/.test(e.message));
});
test('non-key mutation errors never disclose environment values', () => {
    assert.throws(() => changedKeys(Buffer.from('A=private_sentinel\n# old\n'), Buffer.from('A=private_sentinel\n# new\n')), (e) => !e.message.includes('private_sentinel') && /non-key/.test(e.message));
});
