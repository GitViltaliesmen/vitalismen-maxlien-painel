import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const confirm = process.env.VITALISMEN_DEPLOY_CONFIRM === 'YES';
const activate = process.env.VITALISMEN_DEPLOY_ACTIVATE === 'YES';
const host = process.env.VITALISMEN_DEPLOY_HOST || 'root@maxlien.shop';
const key = process.env.VITALISMEN_DEPLOY_KEY || path.join(process.env.HOME || '', '.ssh', 'vps_auditoria_codex');
const releaseName = process.env.VITALISMEN_DEPLOY_RELEASE || new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
const baseDir = process.env.VITALISMEN_DEPLOY_BASE_DIR || '/opt/vitalismen-automacao';
const releaseDir = `${baseDir}/releases/${releaseName}`;

const run = (cmd, args, options = {}) => {
    console.log(`$ ${cmd} ${args.join(' ')}`);
    execFileSync(cmd, args, {
        cwd: root,
        stdio: 'inherit',
        timeout: options.timeout || 120000
    });
};

if (!root.endsWith('Vitalismen Automacao')) {
    console.error(`[DEPLOY] Pasta errada: ${root}`);
    process.exit(1);
}

if (!fs.existsSync(key)) {
    console.error(`[DEPLOY] Chave SSH nao encontrada: ${key}`);
    process.exit(1);
}

if (!confirm) {
    console.error([
        '[DEPLOY] Bloqueado por seguranca.',
        'Este comando so sobe para o VPS quando voce confirmar explicitamente:',
        '',
        'VITALISMEN_DEPLOY_CONFIRM=YES npm run deploy:vps',
        '',
        'Para tambem apontar /opt/vitalismen-automacao/current para o release enviado:',
        'VITALISMEN_DEPLOY_CONFIRM=YES VITALISMEN_DEPLOY_ACTIVATE=YES npm run deploy:vps'
    ].join('\n'));
    process.exit(1);
}

run(process.execPath, ['scripts/official-state-audit.mjs'], { timeout: 60000 });

run('ssh', [
    '-i', key,
    '-o', 'StrictHostKeyChecking=accept-new',
    host,
    `mkdir -p ${releaseDir} ${baseDir}/backups && cd ${baseDir}/current && npm run senior:check`
], { timeout: 60000 });

run('rsync', [
    '-az',
    '--delete',
    '--exclude', '.git/',
    '--exclude', '.env',
    '--exclude', '.local/',
    '--exclude', 'auth_info_baileys/',
    '--exclude', 'node_modules/',
    '--exclude', 'public/media/generated/',
    '--exclude', 'public/media/templates/CO/',
    '-e', `ssh -i ${key} -o StrictHostKeyChecking=accept-new`,
    './',
    `${host}:${releaseDir}/`
], { timeout: 300000 });

run('ssh', [
    '-i', key,
    '-o', 'StrictHostKeyChecking=accept-new',
    host,
    [
        `cd ${releaseDir}`,
        'npm ci --omit=dev',
        'npm run senior:check'
    ].join(' && ')
], { timeout: 300000 });

if (activate) {
    run('ssh', [
        '-i', key,
        '-o', 'StrictHostKeyChecking=accept-new',
        host,
        `ln -sfn ${releaseDir} ${baseDir}/current && ls -la ${baseDir}/current`
    ], { timeout: 60000 });
}

console.log(`[DEPLOY] Release enviado para ${host}:${releaseDir}`);
console.log(activate
    ? '[DEPLOY] Release ativado em /opt/vitalismen-automacao/current. Restart PM2 deve ser decisao explicita.'
    : '[DEPLOY] Release nao ativado. Revise no VPS antes de apontar current/restart PM2.');
