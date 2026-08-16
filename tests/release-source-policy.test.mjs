import test from 'node:test';
import assert from 'node:assert/strict';
import {
    OFFICIAL_GITHUB_REPOSITORY,
    remoteTagCommitFromLsRemote,
    repositoryFromRemoteUrl,
    validateReleaseSource
} from '../scripts/release-source-policy.mjs';

const commit = 'dbe5f3af960cb0b48009ac81736b552d54e910b5';
const approved = (overrides = {}) => ({
    status: '',
    branch: 'production',
    commit,
    tag: 'production-20260815-dbe5f3a',
    tagCommit: commit,
    originUrl: 'git@github-vitalismen-ec:GitViltaliesmen/vitalismen-maxlien-painel.git',
    remoteProductionCommit: commit,
    remoteTagCommit: commit,
    ...overrides
});

test('normaliza URLs HTTPS, SSH e alias SSH para o repositorio oficial', () => {
    assert.equal(repositoryFromRemoteUrl(
        'https://github.com/GitViltaliesmen/vitalismen-maxlien-painel.git'
    ), OFFICIAL_GITHUB_REPOSITORY);
    assert.equal(repositoryFromRemoteUrl(
        'ssh://git@github.com/GitViltaliesmen/vitalismen-maxlien-painel.git'
    ), OFFICIAL_GITHUB_REPOSITORY);
    assert.equal(repositoryFromRemoteUrl(
        'git@github-vitalismen-ec:GitViltaliesmen/vitalismen-maxlien-painel.git'
    ), OFFICIAL_GITHUB_REPOSITORY);
});

test('aceita somente uma producao limpa e publicada no GitHub por branch e tag', () => {
    assert.deepEqual(validateReleaseSource(approved()), {
        repository: OFFICIAL_GITHUB_REPOSITORY,
        branch: 'production',
        commit,
        tag: 'production-20260815-dbe5f3a'
    });
});

test('bloqueia arvore suja, branch errada, repositorio errado e refs divergentes', () => {
    for (const invalid of [
        { status: ' M src/index.js' },
        { branch: 'staging' },
        { originUrl: 'https://github.com/outro/projeto.git' },
        { tag: 'release-livre' },
        { tagCommit: 'a'.repeat(40) },
        { remoteProductionCommit: 'b'.repeat(40) },
        { remoteTagCommit: 'c'.repeat(40) }
    ]) {
        assert.throws(() => validateReleaseSource(approved(invalid)), /Deploy bloqueado/);
    }
});

test('prefere o commit descascado de tag anotada no ls-remote', () => {
    const tagObject = '1'.repeat(40);
    const output = `${tagObject}\trefs/tags/production-20260815-dbe5f3a\n`
        + `${commit}\trefs/tags/production-20260815-dbe5f3a^{}`;
    assert.equal(remoteTagCommitFromLsRemote(output, 'production-20260815-dbe5f3a'), commit);
});
