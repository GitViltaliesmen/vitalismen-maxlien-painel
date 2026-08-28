import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
    OFFICIAL_GITHUB_CLONE_URL,
    PRODUCTION_BRANCH,
    remoteTagCommitFromLsRemote,
    validateReleaseSource
} from './release-source-policy.mjs';

const root = process.cwd();
const confirm = process.env.VITALISMEN_DEPLOY_CONFIRM === 'YES';
const activate = process.env.VITALISMEN_DEPLOY_ACTIVATE === 'YES';
const host = process.env.VITALISMEN_DEPLOY_HOST || 'root@maxlien.shop';
const key = process.env.VITALISMEN_DEPLOY_KEY || path.join(
    process.env.USERPROFILE || process.env.HOME || '',
    '.ssh',
    'vps_auditoria_codex_ec_20260719'
);
const baseDir = process.env.VITALISMEN_DEPLOY_BASE_DIR || '/opt/vitalismen-automacao';
const deployTag = String(process.env.VITALISMEN_DEPLOY_TAG || '').trim();
const postSaleCompatibility = Object.freeze({
    runtimeVersion: 66,
    readsDataCompatibilityThrough: 66,
    writesDataCompatibilityVersion: 66,
    requiresRollbackTargetPreflight: true
});

if (activate) {
    console.error('[DEPLOY-INTEGRATION-V29.1] ativação direta bloqueada; use o helper root transacional com permit de uso único.');
    process.exit(78);
}

const run = (cmd, args, options = {}) => {
    console.log(`$ ${cmd} ${args.join(' ')}`);
    execFileSync(cmd, args, {
        cwd: options.cwd || root,
        env: options.env || process.env,
        stdio: 'inherit',
        timeout: options.timeout || 120000
    });
};

const output = (cmd, args) => execFileSync(cmd, args, {
    cwd: root,
    encoding: 'utf8',
    timeout: 30000
}).trim();

const commandExists = (cmd) => {
    try {
        execFileSync(cmd, ['--version'], {
            cwd: root,
            stdio: 'ignore',
            timeout: 10000
        });
        return true;
    } catch {
        return false;
    }
};

const assertSafeRemotePath = (value, label) => {
    if (!/^\/[A-Za-z0-9._/-]+$/.test(value) || value.includes('..')) {
        throw new Error(`[DEPLOY] ${label} invalido: ${value}`);
    }
};

const assertSafeReleaseName = (value) => {
    if (!/^[A-Za-z0-9._-]{1,140}$/.test(value)) {
        throw new Error(`[DEPLOY] Nome de release invalido: ${value}`);
    }
};

const officialLocalRoots = new Set([
    '/home/codex/workspaces/maxlien-vitalismen'
]);
if (!root.endsWith('Vitalismen Automacao') && !officialLocalRoots.has(root)) {
    console.error(`[DEPLOY] Pasta errada: ${root}`);
    process.exit(1);
}

assertSafeRemotePath(baseDir, 'diretorio base');

const branch = output('git', ['branch', '--show-current']);
const commit = output('git', ['rev-parse', 'HEAD']).toLowerCase();
const status = output('git', ['status', '--porcelain=v1', '--untracked-files=all']);
const originUrl = output('git', ['remote', 'get-url', 'origin']);
let tagCommit = '';
let remoteProductionCommit = '';
let remoteTagCommit = '';

if (deployTag) {
    try {
        tagCommit = output('git', ['rev-list', '-n', '1', deployTag]).toLowerCase();
    } catch {
        tagCommit = '';
    }
}

try {
    remoteProductionCommit = output('git', [
        'ls-remote',
        '--heads',
        'origin',
        `refs/heads/${PRODUCTION_BRANCH}`
    ]).split(/\s+/, 1)[0]?.toLowerCase() || '';
    const remoteTags = output('git', [
        'ls-remote',
        '--tags',
        'origin',
        `refs/tags/${deployTag}`,
        `refs/tags/${deployTag}^{}`
    ]);
    remoteTagCommit = remoteTagCommitFromLsRemote(remoteTags, deployTag).toLowerCase();
} catch {
    remoteProductionCommit = '';
    remoteTagCommit = '';
}

const releaseSource = validateReleaseSource({
    status,
    branch,
    commit,
    tag: deployTag,
    tagCommit,
    originUrl,
    remoteProductionCommit,
    remoteTagCommit
});

const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const releaseName = process.env.VITALISMEN_DEPLOY_RELEASE || `${timestamp}_${deployTag}`;
assertSafeReleaseName(releaseName);
const releaseDir = `${baseDir}/releases/${releaseName}`;
assertSafeRemotePath(releaseDir, 'diretorio da release');

if (!confirm) {
    console.error([
        '[DEPLOY] Fonte oficial validada, mas deploy bloqueado por seguranca.',
        `Repositorio: ${releaseSource.repository}`,
        `Branch: ${releaseSource.branch}`,
        `Commit: ${releaseSource.commit}`,
        `Tag: ${releaseSource.tag}`,
        '',
        'Para enviar sem ativar:',
        `VITALISMEN_DEPLOY_TAG=${deployTag} VITALISMEN_DEPLOY_CONFIRM=YES npm run deploy:vps`,
        '',
        'A ativação não é aceita por este comando. Use o helper root transacional somente após staging e permit de uso único.'
    ].join('\n'));
    process.exit(1);
}

if (!fs.existsSync(key)) {
    console.error(`[DEPLOY] Chave SSH nao encontrada: ${key}`);
    process.exit(1);
}

run(process.execPath, ['scripts/official-state-audit.mjs'], {
    timeout: 60000,
    env: { ...process.env, OFFICIAL_AUDIT_SKIP_VPS: 'true' }
});

run(process.execPath, ['scripts/guard-freeze-lock-ec.mjs'], {
    timeout: 60000
});

const releaseMetadata = {
    ...releaseSource,
    createdAt: new Date().toISOString(),
    releaseName,
    postSaleCompatibility
};
const metadataJson = `${JSON.stringify(releaseMetadata, null, 2)}\n`;
const metadataBase64 = Buffer.from(metadataJson, 'utf8').toString('base64');

run('ssh', [
    '-i', key,
    '-o', 'StrictHostKeyChecking=accept-new',
    host,
    `mkdir -p ${baseDir}/releases && test ! -e ${releaseDir}`
], { timeout: 60000 });

let temporaryRoot = '';
try {
    if (commandExists('rsync')) {
        if (!commandExists('tar')) throw new Error('[DEPLOY] tar e obrigatorio para montar a arvore exata do commit.');
        temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vitalismen-release-'));
        const archivePath = path.join(temporaryRoot, 'release.tar');
        const sourceDir = path.join(temporaryRoot, 'source');
        fs.mkdirSync(sourceDir);
        run('git', ['archive', '--format=tar', '-o', archivePath, commit]);
        run('tar', ['-xf', archivePath, '-C', sourceDir]);
        fs.writeFileSync(path.join(sourceDir, '.release-source.json'), metadataJson, 'utf8');
        run('rsync', [
            '-az',
            '--delete',
            '-e', `ssh -i ${key} -o StrictHostKeyChecking=accept-new`,
            `${sourceDir}/`,
            `${host}:${releaseDir}/`
        ], { timeout: 300000 });
    } else {
        console.log('[DEPLOY] rsync indisponivel; clonando a branch production diretamente do GitHub oficial.');
        run('ssh', [
            '-i', key,
            '-o', 'StrictHostKeyChecking=accept-new',
            host,
            [
                `git clone --single-branch --branch ${PRODUCTION_BRANCH} ${OFFICIAL_GITHUB_CLONE_URL} ${releaseDir}`,
                `test "$(git -C ${releaseDir} rev-parse HEAD)" = "${commit}"`,
                `rm -rf ${releaseDir}/.git`,
                `printf '%s' '${metadataBase64}' | base64 -d > ${releaseDir}/.release-source.json`
            ].join(' && ')
        ], { timeout: 300000 });
    }
} finally {
    if (temporaryRoot) {
        const resolvedTemporary = path.resolve(temporaryRoot);
        const resolvedSystemTemp = path.resolve(os.tmpdir());
        if (resolvedTemporary.startsWith(`${resolvedSystemTemp}${path.sep}`)) {
            fs.rmSync(resolvedTemporary, { recursive: true, force: true });
        }
    }
}

run('ssh', [
    '-i', key,
    '-o', 'StrictHostKeyChecking=accept-new',
    host,
    [
        `test -f ${releaseDir}/.release-source.json`,
        `chmod 600 ${releaseDir}/.release-source.json`,
        `cd ${releaseDir}`,
        'npm ci --omit=dev'
    ].join(' && ')
], { timeout: 300000 });

run('ssh', [
    '-i', key,
    '-o', 'StrictHostKeyChecking=accept-new',
    host,
    [
        `if [ -f ${baseDir}/current/.env ]; then cp ${baseDir}/current/.env ${releaseDir}/.env; chmod 600 ${releaseDir}/.env; fi`,
        `test -f ${releaseDir}/.env`
    ].join(' && ')
], { timeout: 60000 });

run('ssh', [
    '-i', key,
    '-o', 'StrictHostKeyChecking=accept-new',
    host,
    [
        `cd ${releaseDir}`,
        `node scripts/assert-post-sale-data-compatibility-v66.mjs --runtime=${postSaleCompatibility.runtimeVersion}`,
        'npm run guard:predeploy-v71',
        'npm run senior:check',
        'npm run guard:ec-product-micro-layer',
        'npm run guard:ec-dropi-catalog',
        'npm run guard:pickup-notifications',
        'npm run guard:whatsapp-status-contacts',
        'npm run test:operational-labels',
        'npm run test:pickup-notifications',
        'npm run guard:freeze-lock'
    ].join(' && ')
], { timeout: 180000 });

console.log(`[DEPLOY] Release exata ${commit} enviada para ${host}:${releaseDir}`);
console.log('[DEPLOY] Release não ativada. Current e PM2 permanecem inalterados; ativação exige helper root transacional.');
