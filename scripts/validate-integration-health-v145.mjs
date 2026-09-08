import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

// Unit/fixture execution only. Never load production credentials or start the application.
if (!fs.existsSync('.git') || fs.existsSync('.release-source.json')) {
    throw new Error('Execute o validador na worktree Git isolada, nunca em uma release.');
}
const preload = new URL('./lib/ec-runtime-successor-v145-context.mjs', import.meta.url).href;
const env = { ...process.env, NODE_ENV: 'test', NODE_OPTIONS: `--import=${preload}` };
// dotenv.config() also runs in a legacy audio import. Empty existing keys preserve library
// context for mocked routes, while senior-guard still reads the safe .env fixture from disk.
for (const key of ['VIT_POWER_OPERATIONAL_AUTOMATION_APPROVED', 'SAFE_OBSERVATION_POLICY',
    'VITALISMEN_STRICT_READ_ONLY', 'DISABLE_SCHEDULER', 'POST_SALE_V66_MUTATIONS_ENABLED',
    'DROPPI_EC_ACTIVE_SYNC_MODE']) env[key] = '';
for (const key of Object.keys(env)) {
    if (/^(?:MONGODB_URI|ZAPI_.*TOKEN|ZAPI_INSTANCE_ID|META_.*TOKEN|OPENAI_API_KEY|DROPPI_.*PASSWORD|DROPI_.*TOKEN)$/.test(key)) delete env[key];
}
const focused = ['tests/ec-dropi-human-authorization-v138.test.mjs', 'tests/ec-dropi-status-postsale-v139.test.mjs',
    'tests/ec-phone-servientrega-reconciliation-v140.test.mjs', 'tests/meta-creative-read-v141.test.mjs',
    'tests/meta-funnel-reconciliation-v141.test.mjs', 'tests/panel-new-dropi-persistence-v142.test.mjs',
    'tests/v141-v142-convergence-v143.test.mjs', 'tests/meta-purchase-after-manual-dropi-v144.test.mjs',
    'tests/integration-health-capi-queue-v145.test.mjs', 'tests/funnel-metrics-route.test.mjs'];
const modes = {
    focused: [process.execPath, ['--test', ...focused]],
    test: [process.platform === 'win32' ? 'npm.cmd' : 'npm', ['test']],
    senior: [process.execPath, ['scripts/run-with-v144-context.mjs', 'senior:check']],
    environment: [process.execPath, ['--test', 'tests/meta-ec-protocolo-g-attribution-v61.test.mjs', 'tests/protocolo-g-conversion-v62.test.mjs']]
};
const mode = modes[process.argv[2] || 'focused'];
if (!mode) throw new Error('Modo de validação V145 inválido.');
const result = spawnSync(mode[0], mode[1], { env, stdio: 'inherit', shell: process.platform === 'win32' && mode[0] === 'npm.cmd' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
