import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

await import('../src/services/inboundMediaPathPortabilityFreezeRuntimeGuardV38.js');

import { inboundMediaStorageRoot } from '../src/services/inboundMediaStorageService.js';

const read = (relativePath) => fs.readFileSync(relativePath, 'utf8');
const sha256 = (relativePath) => crypto.createHash('sha256').update(fs.readFileSync(relativePath)).digest('hex');
const manifest = JSON.parse(read('docs/freeze/inbound-media-path-portability-v38-20260822.json'));
const parent = fs.readFileSync('docs/freeze/panel-zapi-auth-status-v37-20260822.json');

test('V38 sucede exatamente V37 com ativação transacional autorizada', () => {
    assert.equal(manifest.parentFreezeId, 'panel-zapi-auth-status-v37-20260822');
    assert.equal(crypto.createHash('sha256').update(parent).digest('hex'), manifest.parentManifestSha256);
    assert.equal(manifest.status, 'activation_approved');
    assert.equal(manifest.publicationStatus, 'authorized_for_controlled_activation');
    assert.equal(manifest.operatorActivationApproval?.status, 'approved_in_thread');
    assert.equal(manifest.policy.applicationRuntimeChanged, false);
    assert.equal(manifest.policy.linuxProductionPathContractChanged, false);
});

test('serviço de mídia permanece byte a byte igual ao contrato V30', () => {
    const v30 = JSON.parse(read('docs/freeze/media-durability-auth-v30-20260821.json'));
    assert.equal(
        sha256('src/services/inboundMediaStorageService.js'),
        v30.protectedFiles['src/services/inboundMediaStorageService.js']
    );
});

test('caminho Linux só representa a raiz oficial quando o runtime é POSIX', () => {
    const linuxReleaseRoot = '/opt/vitalismen-automacao/releases/20260821T000000Z_candidate';
    const expected = process.platform === 'win32'
        ? path.join(path.resolve(linuxReleaseRoot), '.runtime', 'media', 'inbound')
        : '/opt/vitalismen-automacao/shared/media/inbound';
    assert.equal(inboundMediaStorageRoot({}, linuxReleaseRoot), expected);
});

test('raiz local usa separadores nativos e permanece isolada em .runtime', () => {
    const localRoot = '/tmp/vitalismen-candidate';
    assert.equal(
        inboundMediaStorageRoot({}, localRoot),
        path.join(path.resolve(localRoot), '.runtime', 'media', 'inbound')
    );
});

test('deploy V38 é liberado somente pela autorização explícita de ativação', () => {
    const result = spawnSync(process.execPath, ['scripts/assert-inbound-media-path-portability-activation-approved-v38.mjs'], {
        cwd: process.cwd(),
        encoding: 'utf8'
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(`${result.stdout}\n${result.stderr}`, /autorização explícita de ativação verificada/);
});
