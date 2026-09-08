import { spawnSync } from 'node:child_process';
import process from 'node:process';

const scripts = process.argv.slice(2).map((value) => String(value || '').trim()).filter(Boolean);
if (!scripts.length || scripts.some((script) => !/^[a-z0-9:_-]+$/i.test(script))) {
    throw new Error('V144 npm script ausente ou invalido.');
}

const preload = new URL('./lib/ec-runtime-successor-v144-context.mjs', import.meta.url).href;
const existing = String(process.env.NODE_OPTIONS || '').trim();
const nodeOptions = [existing, `--import=${preload}`].filter(Boolean).join(' ');
const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm';

for (const script of scripts) {
    const result = spawnSync(`${npmExecutable} run ${script}`, [], {
        cwd: process.cwd(),
        env: { ...process.env, NODE_OPTIONS: nodeOptions },
        stdio: 'inherit',
        shell: true
    });
    if (result.error) throw result.error;
    if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);
}
