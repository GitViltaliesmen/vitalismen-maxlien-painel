import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import test from 'node:test';

const root = process.cwd();
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const packageLockSource = fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8');
const packageLock = JSON.parse(packageLockSource);
const packages = packageLock.packages || {};

test('V59 congela Baileys estavel e remove protobufjs vulneravel da cadeia libsignal', () => {
    const baileys = packages['node_modules/@whiskeysockets/baileys'];
    const libsignal = packages['node_modules/@whiskeysockets/baileys/node_modules/libsignal'];

    assert.equal(packageJson.dependencies['@whiskeysockets/baileys'], '^6.7.21');
    assert.equal(baileys?.version, '6.7.24');
    assert.equal(libsignal?.version, '6.0.0');
    assert.match(libsignal?.resolved || '', /bcea72df9ec34d9d9140ab30619cf479c7c144c7$/);
    assert.equal(libsignal?.dependencies?.protobufjs, '^7.5.5');
    assert.equal(packages['node_modules/protobufjs']?.version, '7.6.5');
    assert.equal(packages['node_modules/libsignal'], undefined);
    assert.doesNotMatch(packageLockSource, /protobufjs-6\.8\.8\.tgz|1c30d7d7e76a3b0aa120b04dc6a26f5a12dccf67/);
});

test('V59 carrega Baileys e libsignal sem abrir conexao ou enviar mensagem', async () => {
    const baileysModule = await import('@whiskeysockets/baileys');
    assert.equal(typeof baileysModule.default, 'function');
    assert.equal(typeof baileysModule.useMultiFileAuthState, 'function');
    assert.ok(baileysModule.proto?.Message);

    const baileysRequire = createRequire(
        path.join(root, 'node_modules/@whiskeysockets/baileys/package.json')
    );
    const libsignalPath = baileysRequire.resolve('libsignal');
    const libsignalPackage = JSON.parse(fs.readFileSync(
        path.join(path.dirname(libsignalPath), 'package.json'),
        'utf8'
    ));
    const libsignalModule = baileysRequire('libsignal');

    assert.equal(libsignalPackage.version, '6.0.0');
    assert.equal(typeof libsignalModule.SessionBuilder, 'function');
    assert.equal(typeof libsignalModule.SessionCipher, 'function');
});
