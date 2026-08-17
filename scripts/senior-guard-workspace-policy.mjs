import path from 'node:path';

export const OFFICIAL_GITHUB_REPOSITORY = 'GitViltaliesmen/vitalismen-maxlien-painel';

export const isOfficialGithubActionsWorkspace = ({ env = {}, cwd = '' } = {}) => {
    const workspace = String(env.GITHUB_WORKSPACE || '').trim();
    if (!workspace) return false;
    return env.CI === 'true'
        && env.GITHUB_ACTIONS === 'true'
        && env.GITHUB_REPOSITORY === OFFICIAL_GITHUB_REPOSITORY
        && path.resolve(String(cwd || '')) === path.resolve(workspace);
};
