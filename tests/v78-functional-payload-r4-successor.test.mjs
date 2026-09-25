import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
    calculateR4PublishedFunctionalPayloadSha256V78
} from '../scripts/lib/ec-bot-core-operational-contract-v78.mjs';
import {
    calculateFunctionalPayloadSha256V78
} from '../src/services/mutableRuntimeArtifactV78Service.js';

const file = (root, relative, value) => {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, value);
    return target;
};

test('R4 exclui apenas a attestation gerada; business e control-plane continuam no hash', t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vitalismen-v78-r4-payload-'));
    t.after(() => {
        assert.ok(path.basename(root).startsWith('vitalismen-v78-r4-payload-'));
        fs.rmSync(root, { recursive: true, force: true });
    });
    file(root, 'src/routes/shipments.js', 'shipments-original\n');
    file(root, 'src/services/meta.js', 'meta-original\n');
    file(root, 'src/services/zapi.js', 'zapi-original\n');
    file(root, 'ops/vitalismen-rollback-v201-r4.mjs', 'rollback-original\n');
    const beforePublication = calculateFunctionalPayloadSha256V78(root);
    const attestation = file(root, '.r4-operational-attestation.json', '{"generated":true}\n');
    assert.notEqual(calculateFunctionalPayloadSha256V78(root), beforePublication);
    assert.equal(calculateR4PublishedFunctionalPayloadSha256V78(root), beforePublication);
    fs.writeFileSync(attestation, '{"generated":"changed"}\n');
    assert.equal(calculateR4PublishedFunctionalPayloadSha256V78(root), beforePublication);

    for (const relative of [
        'src/routes/shipments.js', 'src/services/meta.js', 'src/services/zapi.js',
        'ops/vitalismen-rollback-v201-r4.mjs'
    ]) {
        const target = path.join(root, relative);
        const original = fs.readFileSync(target);
        fs.writeFileSync(target, 'tampered\n');
        assert.notEqual(calculateR4PublishedFunctionalPayloadSha256V78(root), beforePublication,
            `${relative} não pode ser excluído`);
        fs.writeFileSync(target, original);
        assert.equal(calculateR4PublishedFunctionalPayloadSha256V78(root), beforePublication);
    }
    file(root, 'src/unknown-business.js', 'unknown\n');
    assert.notEqual(calculateR4PublishedFunctionalPayloadSha256V78(root), beforePublication);
    fs.unlinkSync(path.join(root, 'src/unknown-business.js'));
    assert.equal(calculateR4PublishedFunctionalPayloadSha256V78(root), beforePublication);
    fs.unlinkSync(path.join(root, 'src/routes/shipments.js'));
    assert.notEqual(calculateR4PublishedFunctionalPayloadSha256V78(root), beforePublication);
});

test('R4 rejeita attestation insegura', t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vitalismen-v78-r4-payload-'));
    t.after(() => {
        assert.ok(path.basename(root).startsWith('vitalismen-v78-r4-payload-'));
        fs.rmSync(root, { recursive: true, force: true });
    });
    file(root, 'src/index.js', 'safe\n');
    assert.throws(() => calculateR4PublishedFunctionalPayloadSha256V78(root));
    fs.mkdirSync(path.join(root, '.r4-operational-attestation.json'));
    assert.throws(() => calculateR4PublishedFunctionalPayloadSha256V78(root),
        /r4_generated_attestation_unsafe/);
});
