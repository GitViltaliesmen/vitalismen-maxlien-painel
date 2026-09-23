import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const V198_MANIFEST_PATH = 'docs/freeze/tex-ultra-first-reply-source-dedupe-v198-20260923.json';
export const V198_WORKFLOW_PATH = '.github/workflows/ec-panel-quality.yml';
export const V198_WORKFLOW_SHA256 = '8c8cf3833c19e9ad05557146aaecbcacae27a9901389dccd91a36f185d3ca9b9';
export const V198_OFFICIAL_FILES_PATH = 'docs/ARQUIVOS_OFICIAIS.md';
export const V198_OFFICIAL_FILES_SHA256 = 'aadaa264fc5065701e5cb24d080e6f66338a80c3b5ec043b6d0c3a440b408256';
export const V198_PRELOAD_PATH = 'scripts/lib/ec-runtime-successor-v198-context.mjs';
export const V198_ALLOWED_COMMAND = Object.freeze(['npm', 'run', 'senior:check']);

const modulePath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(modulePath), '..');
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

export const readV198Manifest = (root = projectRoot) => {
    const text = fs.readFileSync(path.join(root, V198_MANIFEST_PATH), 'utf8');
    const manifest = JSON.parse(text);
    assert.equal(text, `${JSON.stringify(manifest, null, 2)}\n`, 'V198_MANIFEST_NOT_CANONICAL');
    assert.equal(manifest.freezeId, 'TEX_ULTRA_FIRST_REPLY_SOURCE_DEDUPE_V198_20260923');
    assert.equal(manifest.version, 'V198');
    assert.equal(manifest.canonicalPreload, V198_PRELOAD_PATH);
    assert.deepEqual(manifest.allowedCommands, [V198_ALLOWED_COMMAND]);
    assert.equal(manifest.policy?.guardsBypassed, false);
    assert.equal(manifest.policy?.productionChanged, false);
    return manifest;
};

export const runV198SeniorCheck = ({
    root = projectRoot,
    command = process.argv.slice(2),
    environment = process.env,
    stdio = 'inherit'
} = {}) => {
    readV198Manifest(root);
    assert.deepEqual(command, V198_ALLOWED_COMMAND, `V198_COMMAND_NOT_ALLOWED:${command.join(' ')}`);
    assert.equal(sha256(fs.readFileSync(path.join(root, V198_WORKFLOW_PATH))), V198_WORKFLOW_SHA256, 'V198_WORKFLOW_HASH_MISMATCH');
    assert.equal(sha256(fs.readFileSync(path.join(root, V198_OFFICIAL_FILES_PATH))), V198_OFFICIAL_FILES_SHA256, 'V198_OFFICIAL_FILES_HASH_MISMATCH');

    const preloadPath = path.join(root, V198_PRELOAD_PATH);
    assert.ok(fs.existsSync(preloadPath), 'V198_CANONICAL_PRELOAD_MISSING');
    const nodeOptions = [
        String(environment.NODE_OPTIONS || '').trim(),
        `--import=${pathToFileURL(preloadPath).href}`
    ].filter(Boolean).join(' ');
    const npmCli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
    const executable = process.platform === 'win32' ? process.execPath : command[0];
    const executableArgs = process.platform === 'win32' ? [npmCli, ...command.slice(1)] : command.slice(1);
    const result = spawnSync(executable, executableArgs, {
        cwd: root,
        env: { ...environment, NODE_OPTIONS: nodeOptions },
        stdio,
        shell: false
    });

    if (result.error) throw result.error;
    if (result.signal) throw new Error(`V198_COMMAND_SIGNAL:${result.signal}`);
    if ((result.status ?? 1) !== 0) throw new Error(`V198_COMMAND_FAILED:${command.join(' ')}:${result.status}`);
    return { status: result.status, preloadPath };
};

if (process.argv[1] && path.resolve(process.argv[1]) === modulePath) runV198SeniorCheck();
