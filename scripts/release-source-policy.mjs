export const OFFICIAL_GITHUB_REPOSITORY = 'GitViltaliesmen/vitalismen-maxlien-painel';
export const OFFICIAL_GITHUB_CLONE_URL = `https://github.com/${OFFICIAL_GITHUB_REPOSITORY}.git`;
export const PRODUCTION_BRANCH = 'production';

const COMMIT_PATTERN = /^[0-9a-f]{40}$/;
const PRODUCTION_TAG_PATTERN = /^production-(\d{8})-([0-9a-f]{7})$/;

export const repositoryFromRemoteUrl = (value = '') => {
    let remote = String(value || '').trim().replace(/\\/g, '/').replace(/\.git$/i, '');
    if (!remote) return '';

    try {
        const parsed = new URL(remote);
        remote = parsed.pathname;
    } catch {
        const scpSeparator = remote.indexOf(':');
        if (scpSeparator >= 0) remote = remote.slice(scpSeparator + 1);
    }

    return remote.replace(/^\/+/, '').replace(/\.git$/i, '');
};

export const remoteTagCommitFromLsRemote = (output = '', tag = '') => {
    const target = `refs/tags/${tag}`;
    const entries = String(output || '').trim().split(/\r?\n/).filter(Boolean).map((line) => {
        const [commit = '', ref = ''] = line.trim().split(/\s+/, 2);
        return { commit, ref };
    });
    return entries.find((entry) => entry.ref === `${target}^{}`)?.commit
        || entries.find((entry) => entry.ref === target)?.commit
        || '';
};

export const validateReleaseSource = ({
    status = '',
    branch = '',
    commit = '',
    tag = '',
    tagCommit = '',
    originUrl = '',
    remoteProductionCommit = '',
    remoteTagCommit = ''
} = {}) => {
    const failures = [];
    const normalizedCommit = String(commit || '').trim().toLowerCase();
    const normalizedTagCommit = String(tagCommit || '').trim().toLowerCase();
    const normalizedRemoteProduction = String(remoteProductionCommit || '').trim().toLowerCase();
    const normalizedRemoteTag = String(remoteTagCommit || '').trim().toLowerCase();
    const tagMatch = String(tag || '').trim().match(PRODUCTION_TAG_PATTERN);
    const repository = repositoryFromRemoteUrl(originUrl);

    if (String(status || '').trim()) failures.push('a arvore Git possui alteracoes locais ou arquivos nao rastreados');
    if (branch !== PRODUCTION_BRANCH) failures.push(`a branch deve ser ${PRODUCTION_BRANCH}, atual: ${branch || '(vazia)'}`);
    if (!COMMIT_PATTERN.test(normalizedCommit)) failures.push('o commit local nao e um SHA-1 completo');
    if (!tagMatch) failures.push('a tag deve seguir production-AAAAMMDD-abcdef0');
    if (tagMatch && COMMIT_PATTERN.test(normalizedCommit) && tagMatch[2] !== normalizedCommit.slice(0, 7)) {
        failures.push('o SHA curto da tag nao corresponde ao commit local');
    }
    if (normalizedTagCommit !== normalizedCommit) failures.push('a tag local nao aponta para o commit atual');
    if (repository.toLowerCase() !== OFFICIAL_GITHUB_REPOSITORY.toLowerCase()) {
        failures.push(`origin deve apontar para ${OFFICIAL_GITHUB_REPOSITORY}, atual: ${repository || '(vazio)'}`);
    }
    if (normalizedRemoteProduction !== normalizedCommit) failures.push('origin/production nao aponta para o commit local');
    if (normalizedRemoteTag !== normalizedCommit) failures.push('a tag de producao ainda nao aponta para o commit no GitHub');

    if (failures.length) {
        throw new Error(`[RELEASE-SOURCE] Deploy bloqueado:\n- ${failures.join('\n- ')}`);
    }

    return {
        repository: OFFICIAL_GITHUB_REPOSITORY,
        branch: PRODUCTION_BRANCH,
        commit: normalizedCommit,
        tag
    };
};
