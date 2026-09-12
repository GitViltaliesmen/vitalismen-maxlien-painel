'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { validateRuntimeConfigSuccessor, changedKeys, keyPresenceDelta,
    _validateExplicitAdditionForTests: validateExplicitAddition,
    _validateExplicitReceiptPermissionsForTests: validateExplicitReceiptPermissions
} = require('../ops/lib/runtime-config-successor-v1.cjs');
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
    const options = { uid: fs.statSync(root).uid, attestationDirectory: directory, evidenceRoots: [evidence], toolingPaths: tools.map((x) => x.path) };
    return { root, facts, record, options, file, seal, put, validate: () => validateRuntimeConfigSuccessor(facts, options) };
}

function additionFixture(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-config-addition-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const evidenceRoot = path.join(root, 'evidence');
    fs.mkdirSync(evidenceRoot, { mode: 0o700 });
    const uid = fs.statSync(root).uid;
    const put = (file, bytes, mode = 0o600) => {
        fs.writeFileSync(file, bytes, { mode }); fs.chmodSync(file, mode); return file;
    };
    const before = Buffer.from('EXISTING=before\nKEEP=unchanged\n');
    const after = Buffer.from('EXISTING=after\nKEEP=unchanged\nWHATSAPP_BLOCKED_SESSION_IDS=synthetic\n');
    const backup = put(path.join(evidenceRoot, 'predecessor.env'), before);
    const evidencePath = path.join(evidenceRoot, 'hostinger-channel-freeze.json');
    const evidence = {
        schemaVersion: 1, operation: 'V151-R2', newPhone: '5531971862958', defaultPhone: '5531971862958',
        defaultPhoneEc: '5531971862958', oldPhone: '5515991418416', statusOld: 'BLOCKED_INACTIVE_PRESERVED',
        oldBlocked: true, oldPaused: true, oldActiveReferences: [], transportOfficial: 'zapi', transportReady: true,
        providerHealth: 'online', activeConfigUsesNew: true, productionFileChanged: '.env', envBackup: backup
    };
    const evidenceBytes = Buffer.from(`${JSON.stringify(evidence, null, 2)}\n`);
    put(evidencePath, evidenceBytes);
    const policy = {
        attestationVersion: 'V70_RUNTIME_CONFIG_SUCCESSOR_V151_R2_R1',
        predecessorRelease: '20260911T015641Z_production-20260911-59d12bf',
        predecessorBackupPath: backup, predecessorConfigSha256: sha(before), successorConfigSha256: sha(after),
        addedKeys: ['WHATSAPP_BLOCKED_SESSION_IDS'], removedKeys: [], evidencePath, evidenceSha256: sha(evidenceBytes)
    };
    const record = { ...policy, addedKeys: [...policy.addedKeys], removedKeys: [], createdAt: new Date().toISOString() };
    const facts = { releaseName: policy.predecessorRelease, originalEnvSha256: policy.predecessorConfigSha256,
        actualEnvSha256: policy.successorConfigSha256 };
    const context = { uid, evidenceRoots: [evidenceRoot], current: after,
        buffer: Buffer.from(`${JSON.stringify(record, null, 2)}\n`) };
    const resealContext = () => { context.buffer = Buffer.from(`${JSON.stringify(record, null, 2)}\n`); };
    const setAfter = (bytes) => {
        context.current = bytes; policy.successorConfigSha256 = sha(bytes);
        record.successorConfigSha256 = policy.successorConfigSha256;
        facts.actualEnvSha256 = policy.successorConfigSha256; resealContext();
    };
    return { root, uid, evidenceRoot, backup, evidencePath, evidence, policy, record, facts, context,
        resealContext, setAfter, validate: () => validateExplicitAddition(record, facts, context, policy) };
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
test('rejects writable legacy attestation', (t) => { const x = fixture(t); fs.chmodSync(x.file, 0o600); assert.throws(x.validate, /permissions|legacy attestation mode/); });
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
test('preserves unchanged duplicate keys byte for byte while validating a separate rotation', () => {
    assert.deepEqual(changedKeys(Buffer.from('A=old\nD=one\nD=two\n'),
        Buffer.from('A=new\nD=one\nD=two\n')), ['A']);
});
test('rejects changing or reordering any occurrence of a duplicate key', () => {
    const before = Buffer.from('A=old\nD=one\nD=two\n');
    assert.throws(() => changedKeys(before, Buffer.from('A=new\nD=one\nD=three\n')), /duplicate/);
    assert.throws(() => changedKeys(before, Buffer.from('A=new\nD=two\nD=one\n')), /duplicate/);
});
test('non-key mutation errors never disclose environment values', () => {
    assert.throws(() => changedKeys(Buffer.from('A=private_sentinel\n# old\n'), Buffer.from('A=private_sentinel\n# new\n')), (e) => !e.message.includes('private_sentinel') && /non-key/.test(e.message));
});

test('detects one explicit key addition without treating existing-key rotation as another addition', () => {
    assert.deepEqual(keyPresenceDelta(Buffer.from('A=old\n'), Buffer.from('A=new\nB=value\n')),
        { addedKeys: ['B'], removedKeys: [] });
});
test('accepts the exact WHATSAPP_BLOCKED_SESSION_IDS transition with valid V151-R2 evidence', (t) => {
    const x = additionFixture(t);
    assert.equal(x.validate().status, 'AUTHORIZED_RUNTIME_SUCCESSOR_EXPLICIT_KEY_ADDITION');
});
test('rejects an unexpected second added key', (t) => {
    const x = additionFixture(t);
    x.setAfter(Buffer.from('EXISTING=after\nKEEP=unchanged\nWHATSAPP_BLOCKED_SESSION_IDS=synthetic\nUNEXPECTED=value\n'));
    assert.throws(x.validate, /unexpected added/);
});
test('rejects every removed key', (t) => {
    const x = additionFixture(t);
    fs.writeFileSync(x.backup, 'EXISTING=before\nKEEP=unchanged\nREMOVE_ME=value\n');
    const before = fs.readFileSync(x.backup);
    x.policy.predecessorConfigSha256 = sha(before); x.record.predecessorConfigSha256 = sha(before);
    x.facts.originalEnvSha256 = sha(before); x.resealContext();
    assert.throws(x.validate, /unexpected removed/);
});
test('rejects a wrong successor hash', (t) => {
    const x = additionFixture(t); x.facts.actualEnvSha256 = 'b'.repeat(64);
    assert.throws(x.validate, /successor facts/);
});
test('rejects a missing predecessor backup', (t) => {
    const x = additionFixture(t); fs.unlinkSync(x.backup);
    assert.throws(x.validate);
});
test('rejects missing V151-R2 evidence', (t) => {
    const x = additionFixture(t); fs.unlinkSync(x.evidencePath);
    assert.throws(x.validate);
});
test('rejects altered or unrelated V151-R2 evidence', (t) => {
    const x = additionFixture(t); fs.appendFileSync(x.evidencePath, ' ');
    assert.throws(x.validate, /evidence hash/);
});
test('rejects wildcard additions even when a supplied policy repeats the wildcard', (t) => {
    const x = additionFixture(t); x.policy.addedKeys = ['*']; x.record.addedKeys = ['*']; x.resealContext();
    assert.throws(x.validate, /allowlist|wildcard/);
});
test('rejects a secret-bearing extra receipt field', (t) => {
    const x = additionFixture(t); x.record.secretValue = 'synthetic_secret_should_be_rejected'; x.resealContext();
    assert.throws(x.validate, /attestation keys/);
});
test('requires explicit-addition receipt and seal mode 0600 with the expected owner', (t) => {
    const x = additionFixture(t);
    const receipt = path.join(x.root, 'receipt.json'); const seal = path.join(x.root, 'receipt.json.sha256');
    fs.writeFileSync(receipt, '{}\n', { mode: 0o600 }); fs.writeFileSync(seal, `${sha('{}\n')}\n`, { mode: 0o600 });
    fs.chmodSync(receipt, 0o600); fs.chmodSync(seal, 0o600);
    assert.doesNotThrow(() => validateExplicitReceiptPermissions(receipt, seal, x.uid));
    fs.chmodSync(receipt, 0o640);
    assert.throws(() => validateExplicitReceiptPermissions(receipt, seal, x.uid), /permissions/);
    fs.chmodSync(receipt, 0o600);
    assert.throws(() => validateExplicitReceiptPermissions(receipt, seal, x.uid + 1), /owner/);
});
