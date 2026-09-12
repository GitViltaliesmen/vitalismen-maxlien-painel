#!/usr/bin/env node
'use strict';

// One-shot, fail-closed materializer for the exact V151-R2 runtime transition.
// It never prints or changes environment values.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const {
    validateRuntimeConfigSuccessor,
    _V151_R2_POLICY: policy
} = require('/usr/local/lib/vitalismen-deploy/runtime-config-successor-v1.cjs');

const sha = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
const directory = '/var/lib/vitalismen-deploy/runtime-config-successors';
const receiptPath = path.join(directory, `${policy.predecessorRelease}.json`);
const sealPath = `${receiptPath}.sha256`;
const releaseDirectory = `/opt/vitalismen-automacao/releases/${policy.predecessorRelease}`;

assert.equal(process.getuid(), 0, 'root execution required');
assert.equal(process.getgid(), 0, 'root group required');
assert.equal(fs.realpathSync('/opt/vitalismen-automacao/current'), releaseDirectory, 'unexpected current release');
assert.ok(!fs.existsSync(receiptPath) && !fs.existsSync(sealPath), 'successor receipt already exists');

const record = {
    predecessorRelease: policy.predecessorRelease,
    predecessorBackupPath: policy.predecessorBackupPath,
    predecessorConfigSha256: policy.predecessorConfigSha256,
    successorConfigSha256: policy.successorConfigSha256,
    addedKeys: [...policy.addedKeys],
    removedKeys: [...policy.removedKeys],
    evidencePath: policy.evidencePath,
    evidenceSha256: policy.evidenceSha256,
    attestationVersion: policy.attestationVersion,
    createdAt: new Date().toISOString()
};
const bytes = Buffer.from(`${JSON.stringify(record, null, 2)}\n`);
const seal = Buffer.from(`${sha(bytes)}\n`);
let receiptCreated = false;
let sealCreated = false;

try {
    fs.writeFileSync(receiptPath, bytes, { flag: 'wx', mode: 0o600 });
    receiptCreated = true;
    fs.chownSync(receiptPath, 0, 0);
    fs.chmodSync(receiptPath, 0o600);
    fs.writeFileSync(sealPath, seal, { flag: 'wx', mode: 0o600 });
    sealCreated = true;
    fs.chownSync(sealPath, 0, 0);
    fs.chmodSync(sealPath, 0o600);

    const result = validateRuntimeConfigSuccessor({
        releaseName: policy.predecessorRelease,
        releaseDirectory,
        originalEnvSha256: policy.predecessorConfigSha256,
        actualEnvSha256: policy.successorConfigSha256
    });
    process.stdout.write(`${JSON.stringify({
        status: result.status,
        receiptPath,
        receiptSha256: result.attestationSha256,
        predecessorConfigSha256: result.originalEnvSha256,
        successorConfigSha256: result.authorizedEnvSha256,
        addedKeys: result.addedKeys,
        removedKeys: result.removedKeys
    })}\n`);
} catch (error) {
    if (sealCreated) fs.unlinkSync(sealPath);
    if (receiptCreated) fs.unlinkSync(receiptPath);
    throw error;
}
