import fs from 'fs';
import os from 'os';
import path from 'path';

const root = process.cwd();
const markerPath = path.join(root, '.vitalismen-official-root');
const packagePath = path.join(root, 'package.json');
const localOfficialPath = '/Users/greson/Documents/Vitalismen Automacao';
const windowsOfficialPath = path.join(
    os.homedir(),
    'Documents',
    'SITES',
    'MAXLIENSHOP_JULHO_2026',
    'Vitalismen Automacao'
);
const vpsOfficialPath = '/opt/vitalismen-automacao/current';
const codexOfficialWorkspace = '/home/codex/workspaces/maxlien-vitalismen';

const normalizePath = (value) => {
    try {
        return fs.realpathSync(value);
    } catch {
        return path.resolve(value);
    }
};

const fail = (message) => {
    console.error('\n[VITALISMEN-OFFICIAL-ROOT] BLOQUEADO\n');
    console.error(message);
    console.error('\nCaminho unico local permitido:');
    console.error(`  ${localOfficialPath}`);
    console.error(`  ${windowsOfficialPath}`);
    console.error(`  ${codexOfficialWorkspace}`);
    console.error('\nCaminho oficial VPS permitido:');
    console.error(`  ${vpsOfficialPath}`);
    console.error('\nPare aqui e reabra o projeto pelo caminho oficial antes de continuar.\n');
    process.exit(1);
};

const allowedRoots = new Set([
    normalizePath(localOfficialPath),
    normalizePath(windowsOfficialPath),
    normalizePath(codexOfficialWorkspace),
    normalizePath(vpsOfficialPath)
]);

const currentRoot = normalizePath(root);
if (!allowedRoots.has(currentRoot)) {
    fail(`Raiz atual fora do caminho oficial: ${root}`);
}

if (!fs.existsSync(markerPath)) {
    fail(`Marcador oficial ausente: ${markerPath}`);
}

const marker = fs.readFileSync(markerPath, 'utf8');
if (!/VITALISMEN_OFFICIAL_PROJECT=vit_power_ec/.test(marker)) {
    fail('Marcador oficial invalido: falta VITALISMEN_OFFICIAL_PROJECT=vit_power_ec.');
}

if (!/DO_NOT_USE_PARALLEL_AUTOMATION_PROJECTS=true/.test(marker)) {
    fail('Marcador oficial invalido: falta DO_NOT_USE_PARALLEL_AUTOMATION_PROJECTS=true.');
}

if (!fs.existsSync(packagePath)) {
    fail('package.json ausente na raiz oficial.');
}

const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
if (pkg.name !== 'vitalismen-automation') {
    fail(`package.json nao parece ser o projeto Vitalismen oficial: name=${pkg.name || 'vazio'}`);
}

console.log(`[VITALISMEN-OFFICIAL-ROOT] OK: ${root}`);
