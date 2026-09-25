import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const [pm2ModuleRootRaw, processName, targetNodeOptions, releaseDirRaw] = process.argv.slice(2);
const clean = (value) => String(value || '').trim();
const pm2ModuleRoot = path.resolve(clean(pm2ModuleRootRaw));

if (clean(process.env.NODE_OPTIONS)) throw new Error('[EC-BOT-CORE-CONTROL-PLANE-V89] controller_node_options_must_start_empty');
if (processName !== 'vitalismen-automation') throw new Error('[EC-BOT-CORE-CONTROL-PLANE-V89] process_name_invalid');
if (process.argv.length !== 6) throw new Error('[EC-BOT-CORE-CONTROL-PLANE-V89] exact_arguments_required');
const releaseDir = fs.realpathSync(clean(releaseDirRaw));
if (!releaseDir.startsWith('/opt/vitalismen-automacao/releases/')
    || fs.realpathSync('/opt/vitalismen-automacao/current') !== releaseDir) {
    throw new Error('[EC-BOT-CORE-CONTROL-PLANE-V89] current_release_identity_invalid');
}
const regular = file => {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('controller_release_file_unsafe');
    return fs.readFileSync(file);
};
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const sourceBytes = regular(path.join(releaseDir, '.release-source.json'));
const source = JSON.parse(sourceBytes.toString('utf8'));
if (sourceBytes.toString('utf8') !== `${JSON.stringify(source, null, 2)}\n`
    || source.releaseName !== path.basename(releaseDir)) {
    throw new Error('controller_release_source_invalid');
}
if (source.functionalCommit === '641759b160c2b91e95a3f1df371ad372a74d72e1'
    && source.functionalTree === '1feb02ad1a3f2ae266ef519bf33426b91ac80aa3') {
    if (!/^\d{8}T\d{6}Z_production-\d{8}-641759b$/.test(source.releaseName)
        || sha256(regular(path.join(releaseDir,
            'docs/freeze/ec-bot-core-overlay-preload-v201-20260924.json')))
            !== 'e8b82901e8faa4cda1d37a013fd2698401bad9c2039b702e637b88d5e4e56bee'
        || targetNodeOptions !== '--import=file:///opt/vitalismen-automacao/current/scripts/lib/ec-runtime-successor-v199-context.mjs') {
        throw new Error('controller_v201_v199_identity_invalid');
    }
} else {
    const authorityPath = path.join(releaseDir,
        'scripts/lib/unified-successor-v202-r4-authority.mjs');
    if (sha256(regular(authorityPath))
        !== '4039aa24456156411a2e1f1601812a245e624a15e979f3cc8c0b2778b63c91d8') {
        throw new Error('controller_r4_authority_hash_invalid');
    }
    const { assertNodeOptionsForRelease } = await import(pathToFileURL(authorityPath).href);
    assertNodeOptionsForRelease(releaseDir, targetNodeOptions, { requireAttestation: true });
}
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
    process.stdout.write('PM2_TARGET_ENV_RESTART_V78_R4=PASS\n');
} finally {
    try { pm2.disconnect(); } catch {}
}
