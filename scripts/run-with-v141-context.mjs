import { spawnSync } from 'node:child_process';
import process from 'node:process';

const script = String(process.argv[2] || '').trim();
if (!script || !/^[a-z0-9:_-]+$/i.test(script)) throw new Error('V141 npm script ausente ou invalido.');

const preload = new URL('./lib/ec-runtime-successor-v141-context.mjs', import.meta.url).href;
const nodeOptions = [String(process.env.NODE_OPTIONS || '').trim(), `--import=${preload}`].filter(Boolean).join(' ');
const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const result = spawnSync(`${npmExecutable} run ${script}`, [], {
    cwd: process.cwd(),
    env: { ...process.env, NODE_OPTIONS: nodeOptions },
    stdio: 'inherit',
    shell: true
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);

