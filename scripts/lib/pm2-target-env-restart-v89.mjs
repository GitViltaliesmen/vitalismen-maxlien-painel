import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const [pm2ModuleRootRaw, processName, targetNodeOptions] = process.argv.slice(2);
const clean = (value) => String(value || '').trim();
const pm2ModuleRoot = path.resolve(clean(pm2ModuleRootRaw));
const expectedNodeOptions = '--import=file:///opt/vitalismen-automacao/current/scripts/lib/ec-runtime-successor-v97-context.mjs';

if (clean(process.env.NODE_OPTIONS)) throw new Error('[EC-BOT-CORE-CONTROL-PLANE-V89] controller_node_options_must_start_empty');
if (processName !== 'vitalismen-automation') throw new Error('[EC-BOT-CORE-CONTROL-PLANE-V89] process_name_invalid');
if (targetNodeOptions !== expectedNodeOptions) throw new Error('[EC-BOT-CORE-CONTROL-PLANE-V89] target_node_options_invalid');
const packagePath = path.join(pm2ModuleRoot, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
if (packageJson.name !== 'pm2' || !/^6\./.test(clean(packageJson.version))) {
    throw new Error('[EC-BOT-CORE-CONTROL-PLANE-V89] pm2_package_invalid');
}

process.env.NODE_OPTIONS = targetNodeOptions;
process.env.npm_config_node_options = '';
const require = createRequire(packagePath);
const pm2 = require(pm2ModuleRoot);

const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('[EC-BOT-CORE-CONTROL-PLANE-V89] pm2_restart_timeout')), 20_000).unref();
});
const restart = new Promise((resolve, reject) => {
    pm2.connect((connectError) => {
        if (connectError) return reject(connectError);
        pm2.restart(processName, { updateEnv: true }, (restartError, applications) => {
            if (restartError) return reject(restartError);
            const matches = (Array.isArray(applications) ? applications : [applications])
                .filter((entry) => entry?.name === processName || entry?.pm2_env?.name === processName);
            if (matches.length !== 1) return reject(new Error('[EC-BOT-CORE-CONTROL-PLANE-V89] pm2_restart_identity_invalid'));
            resolve();
        });
    });
});

try {
    await Promise.race([restart, timeout]);
    process.stdout.write('PM2_TARGET_ENV_RESTART_V89=PASS\n');
} finally {
    try { pm2.disconnect(); } catch {}
}
