import crypto from 'node:crypto';
import fs from 'node:fs';

const successorOverrideKey = '__VITALISMEN_SUCCESSOR_OVERRIDE_FILES';
const v78ManifestPath = 'docs/freeze/ec-bot-core-structural-safety-v78-20260829.json';
const v79ManifestPath = 'docs/freeze/ec-bot-core-readiness-v79-20260829.json';
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const readManifest = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const v78 = readManifest(v78ManifestPath);
const v79 = readManifest(v79ManifestPath);

if (
    sha256(v78ManifestPath) !== '46a9363f203c9e2f4d574e286d2c361b4bd3bb915ee2f0b2398b04af624e12e1'
    || v78.version !== 78
    || v79.version !== 79
    || v79.parentVersion !== 'V78'
    || v79.parentManifestSha256 !== '46a9363f203c9e2f4d574e286d2c361b4bd3bb915ee2f0b2398b04af624e12e1'
    || v79.deployment?.ready !== true
    || (v79.deployment?.blockers || []).length !== 0
) {
    throw new Error('[EC-BOT-CORE-READINESS-V79-CONTEXT] identidade ou readiness inválida.');
}

const inherited = Array.isArray(globalThis[successorOverrideKey])
    ? globalThis[successorOverrideKey]
    : [];
globalThis[successorOverrideKey] = [...new Set([
    ...inherited,
    ...(v78.declaredAncestorOverrides || []),
    ...(v79.declaredAncestorOverrides || [])
])];

const runningNpmCli = process.argv.some((argument) => /(?:^|[\\/])npm-cli\.js$/i.test(String(argument || '')));
if (!runningNpmCli) {
    const ownPreload = '--import=./scripts/lib/ec-bot-core-readiness-v79-successor-context.mjs';
    const remainingOptions = String(process.env.NODE_OPTIONS || '')
        .split(/\s+/)
        .filter(Boolean)
        .filter((option) => option !== ownPreload)
        .join(' ');
    if (remainingOptions) process.env.NODE_OPTIONS = remainingOptions;
    else delete process.env.NODE_OPTIONS;
}
