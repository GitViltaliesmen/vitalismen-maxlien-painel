import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const command = process.argv.slice(2);
const allowedCommands = new Set([
    ['npm', 'run', 'senior:check'].join('\0'),
    ['node', 'scripts/guard-meta-ec-protocolo-g-attribution-v61.mjs'].join('\0'),
    ['node', 'scripts/guard-protocolo-g-conversion-v62.mjs'].join('\0'),
    ['node', 'scripts/guard-protocolo-g-ad-metrics-v63.mjs'].join('\0'),
    ['node', 'scripts/audit-ec-nx-funnel-click-path-v192.mjs'].join('\0'),
    ['node', 'scripts/guard-v192-successor-alignment.mjs'].join('\0'),
    ['node', '--test', 'tests/v192-guard-successor-alignment.test.mjs'].join('\0'),
    ['node', '--test', 'tests/vsl-ingress-ledger-v191.test.mjs'].join('\0'),
    ['node', 'scripts/guard-vsl-ingress-ledger-v191.mjs'].join('\0')
]);

if (!allowedCommands.has(command.join('\0'))) {
    throw new Error(`V192_COMMAND_NOT_ALLOWED:${command.join(' ')}`);
}

const preload = new URL('./lib/ec-runtime-successor-v192-context.mjs', import.meta.url).href;
const existingNodeOptions = String(process.env.NODE_OPTIONS || '').trim();
const nodeOptions = [existingNodeOptions, `--import=${preload}`].filter(Boolean).join(' ');
const npmCli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
const executable = command[0] === 'npm' && process.platform === 'win32' ? process.execPath : command[0];
const executableArgs = command[0] === 'npm' && process.platform === 'win32'
    ? [npmCli, ...command.slice(1)]
    : command.slice(1);
const result = spawnSync(executable, executableArgs, {
    cwd: process.cwd(),
    env: {
        ...process.env,
        NODE_OPTIONS: nodeOptions,
        V152_B_SHADOW_TEST_CONTEXT: 'true'
    },
    stdio: 'inherit',
    shell: false
});

if (result.error) throw result.error;
if (result.signal) throw new Error(`V192_COMMAND_SIGNAL:${result.signal}`);
if ((result.status ?? 1) !== 0) throw new Error(`V192_COMMAND_FAILED:${command.join(' ')}:${result.status}`);
