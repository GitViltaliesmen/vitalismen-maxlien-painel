'use strict';

// Root-owned runtime attestations extend the existing deploy-state/receipt model.
// This module never writes files, loads application code, or calls a provider.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

const sha = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
const same = (a, b, label) => assert.equal(JSON.stringify(a), JSON.stringify(b), label);
const digest = (value) => assert.match(value, /^[0-9a-f]{64}$/, 'invalid SHA256');
const exact = (object, keys, label) => same(Object.keys(object).sort(), [...keys].sort(), label);
const within = (file, roots) => roots.some((root) => file.startsWith(`${path.resolve(root)}${path.sep}`));

function protectedRead(file, { uid = 0, modes = [0o400, 0o600], roots } = {}) {
    assert.equal(path.resolve(file), file, 'noncanonical evidence path');
    if (roots) assert.ok(within(file, roots), 'evidence outside allowed roots');
    assert.equal(fs.realpathSync(file), file, 'symlink evidence path');
    const stat = fs.lstatSync(file);
    assert.ok(stat.isFile() && !stat.isSymbolicLink(), 'evidence must be a regular file');
    assert.equal(stat.uid, uid, 'evidence owner');
    assert.equal(stat.gid, uid, 'evidence group');
    assert.ok(modes.includes(stat.mode & 0o777), 'evidence permissions');
    return fs.readFileSync(file);
}

function changedKeys(before, after) {
    const expression = /^([A-Z][A-Z0-9_]*)=([^\r\n]*)/gm;
    const parse = (buffer) => {
        const entries = new Map();
        for (const match of buffer.toString('latin1').matchAll(expression)) {
            const values = entries.get(match[1]) || [];
            values.push(match[2]);
            entries.set(match[1], values);
        }
        return entries;
    };
    const old = parse(before), next = parse(after);
    const changed = [...new Set([...old.keys(), ...next.keys()])]
        .filter((key) => JSON.stringify(old.get(key)) !== JSON.stringify(next.get(key))).sort();
    for (const key of changed) {
        assert.ok(old.get(key)?.length === 1 && next.get(key)?.length === 1,
            'missing or duplicate changed environment key');
    }
    const mask = (buffer) => buffer.toString('latin1').replace(expression,
        (line, key) => changed.includes(key) ? `${key}=[REDACTED]` : line);
    assert.ok(mask(before) === mask(after), 'unexpected non-key environment mutation');
    return changed;
}

function validateRuntimeConfigSuccessor(facts, options = {}) {
    const uid = options.uid ?? 0;
    const directory = options.attestationDirectory || '/var/lib/vitalismen-deploy/runtime-config-successors';
    const evidenceRoots = options.evidenceRoots || [
        '/var/lib/vitalismen-deploy/receipts',
        '/var/lib/vitalismen-deploy/evidence',
        '/var/lib/vitalismen-deploy/secret-backups',
        '/opt/vitalismen-automacao/backups'
    ];
    assert.match(facts.releaseName, /^[0-9]{8}T[0-9]{6}Z_production-[0-9]{8}-[0-9a-f]{7}$/, 'release name');
    const dirStat = fs.lstatSync(directory);
    assert.ok(dirStat.isDirectory() && !dirStat.isSymbolicLink(), 'attestation directory type');
    assert.equal(fs.realpathSync(directory), directory, 'attestation directory symlink');
    assert.equal(dirStat.uid, uid, 'attestation directory owner');
    assert.equal(dirStat.gid, uid, 'attestation directory group');
    assert.equal(dirStat.mode & 0o777, 0o700, 'attestation directory mode');
    const file = path.join(directory, `${facts.releaseName}.json`);
    const buffer = protectedRead(file, { uid, modes: [0o400] });
    const seal = protectedRead(`${file}.sha256`, { uid, modes: [0o400] }).toString('utf8');
    assert.equal(seal, `${sha(buffer)}\n`, 'runtime attestation seal');
    const record = JSON.parse(buffer.toString('utf8'));
    assert.equal(buffer.toString('utf8'), `${JSON.stringify(record, null, 2)}\n`, 'attestation serialization');
    exact(record, ['version', 'status', 'createdAt', 'reason', 'baseRelease', 'baseCommit', 'baseTree',
        'functionalPayloadSha256', 'originalEnvSha256', 'authorizedSuccessorEnvSha256', 'metadataHashes',
        'authorizedChangedKeys', 'changes', 'authorizationEvidence', 'toolingFiles', 'noSecretValues'], 'attestation keys');
    assert.equal(record.version, 1, 'attestation version');
    assert.equal(record.status, 'AUTHORIZED_RUNTIME_CONFIG_SUCCESSOR', 'attestation status');
    assert.equal(record.reason, 'AUTHORIZED_POST_FREEZE_SECRET_OR_CONFIG_ROTATION', 'attestation reason');
    assert.equal(record.noSecretValues, true, 'secret-free attestation required');
    assert.ok(Number.isFinite(Date.parse(record.createdAt)) && Date.parse(record.createdAt) <= Date.now() + 60000, 'attestation date');
    for (const [key, expected] of Object.entries({
        baseRelease: facts.releaseName, baseCommit: facts.commit, baseTree: facts.tree,
        functionalPayloadSha256: facts.functionalPayloadSha256,
        originalEnvSha256: facts.originalEnvSha256,
        authorizedSuccessorEnvSha256: facts.actualEnvSha256
    })) assert.equal(record[key], expected, `runtime attestation ${key}`);
    assert.notEqual(record.originalEnvSha256, record.authorizedSuccessorEnvSha256, 'empty successor chain');
    same(record.metadataHashes, facts.metadataHashes, 'immutable metadata binding');
    digest(record.originalEnvSha256); digest(record.authorizedSuccessorEnvSha256);
    const proof = (item, modes = [0o400, 0o600]) => {
        exact(item, ['path', 'sha256'], 'evidence reference keys'); digest(item.sha256);
        const data = protectedRead(item.path, { uid, modes, roots: evidenceRoots });
        assert.equal(sha(data), item.sha256, 'provenance evidence hash');
        return data;
    };
    assert.ok(record.authorizationEvidence.length > 0, 'authorization evidence absent');
    record.authorizationEvidence.forEach((item) => proof(item));
    const expectedTooling = options.toolingPaths || [
        '/usr/local/sbin/vitalismen-stage',
        '/usr/local/lib/vitalismen-deploy/runtime-config-successor-v1.cjs'
    ];
    same(record.toolingFiles.map((x) => x.path), expectedTooling, 'tooling paths');
    for (const item of record.toolingFiles) {
        exact(item, ['path', 'sha256'], 'tooling reference keys'); digest(item.sha256);
        assert.equal(sha(protectedRead(item.path, { uid, modes: [0o400, 0o444, 0o644, 0o755] })), item.sha256, 'tooling hash');
    }
    const envFile = path.join(facts.releaseDirectory, '.env');
    const current = protectedRead(envFile, { uid, modes: [0o600] });
    assert.equal(sha(current), facts.actualEnvSha256, 'runtime env changed during validation');
    assert.ok(record.changes.length > 0 && record.changes.length <= 32, 'invalid finite successor chain');
    let previousHash = record.originalEnvSha256, previousTime = 0;
    const keys = new Set();
    for (let index = 0; index < record.changes.length; index++) {
        const change = record.changes[index];
        exact(change, ['timestamp', 'actionType', 'before', 'afterSha256', 'changedKeyNames', 'provenance'], 'change keys');
        assert.equal(change.actionType, 'AUTHORIZED_SECRET_ROTATION', 'change type');
        const timestamp = Date.parse(change.timestamp);
        assert.ok(timestamp >= previousTime && timestamp <= Date.parse(record.createdAt), 'change chronology');
        previousTime = timestamp;
        assert.equal(change.before.sha256, previousHash, 'broken runtime hash chain');
        const before = proof(change.before);
        const after = index + 1 < record.changes.length ? proof(record.changes[index + 1].before) : current;
        digest(change.afterSha256);
        assert.equal(sha(after), change.afterSha256, 'successor payload hash');
        const changed = changedKeys(before, after);
        assert.ok(changed.length > 0, 'empty environment change');
        same(changed, change.changedKeyNames, 'unexpected changed environment keys');
        changed.forEach((key) => keys.add(key));
        assert.ok(change.provenance.length > 0, 'change provenance absent');
        change.provenance.forEach((item) => proof(item));
        previousHash = change.afterSha256;
    }
    assert.equal(previousHash, facts.actualEnvSha256, 'latest runtime hash mismatch');
    same([...keys].sort(), record.authorizedChangedKeys, 'authorized key set mismatch');
    return Object.freeze({ status: 'AUTHORIZED_RUNTIME_SUCCESSOR', originalEnvSha256: record.originalEnvSha256,
        authorizedEnvSha256: record.authorizedSuccessorEnvSha256, attestationSha256: sha(buffer) });
}

module.exports = { validateRuntimeConfigSuccessor, changedKeys };
