import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const BASE_COMMIT = 'da1868cb7fda596a9ec9342bf0031e1542113b12';
const EXPECTED_BRANCH = 'codex/v191-vsl-ingress-ledger-shadow';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FREEZE_PATH = 'docs/freeze/vsl-ingress-ledger-shadow-v191-20260919.json';
const EXPECTED_FILES = Object.freeze([
    'docs/VSL_INGRESS_LEDGER_SHADOW_V191_20260919.md',
    FREEZE_PATH,
    'scripts/audit-vsl-ingress-ledger-v191.mjs',
    'scripts/guard-vsl-ingress-ledger-v191.mjs',
    'src/services/vslIngressLedgerV191Service.js',
    'tests/vsl-ingress-ledger-v191.test.mjs'
]);
const RUNTIME_FILES = Object.freeze([
    'src/services/vslIngressLedgerV191Service.js',
    'scripts/audit-vsl-ingress-ledger-v191.mjs'
]);

const CATEGORY_MATCHERS = Object.freeze({
    VSL: (file) => (
        /(^|\/)(vsl|tex.?ultra|vit.?power|nitrix)/i.test(file)
        || /^public\/(n|m)(\/|\.|$)/i.test(file)
        || /^public\/index\.html$/i.test(file)
    ),
    BOT_SALES_CORE: (file) => (
        /^src\/services\/(conversationEngine|agentRouter|initialFunnelTriggers|texUltraFunnelService|funnelPurposeMemoryService)\.js$/i.test(file)
        || /^src\/agents\//i.test(file)
        || /^src\/whatsapp\//i.test(file)
    ),
    QR_PANEL: (file) => file === 'public/qr.html',
    FUNNEL_METRICS: (file) => (
        file === 'public/funnel-metrics.html'
        || /^src\/(routes|services)\/.*funnel.*(metric|health)/i.test(file)
        || /^scripts\/.*funnel.*(metric|learning|health)/i.test(file)
    ),
    POSTSALE_V188: (file) => (
        /post.?sale/i.test(file)
        || /v188/i.test(file)
    ),
    META_CAPI: (file) => (
        /(^|\/).*meta.*\.(js|mjs|json|html)$/i.test(file)
        || /capi/i.test(file)
    ),
    ZAPI: (file) => /zapi/i.test(file),
    DROPI: (file) => /dropi/i.test(file)
});

const normalizePath = (value = '') => String(value || '').trim().replace(/\\/g, '/').replace(/^"|"$/g, '');
const git = (args, options = {}) => execFileSync('git', args, {
    cwd: ROOT,
    encoding: options.encoding === null ? null : 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
});
const fail = (code, detail = '') => {
    console.error(`RESULT=FAIL`);
    console.error(`ERROR=${code}`);
    if (detail) console.error(`DETAIL=${detail}`);
    process.exit(1);
};
const sha256 = (buffers = []) => {
    const digest = crypto.createHash('sha256');
    for (const buffer of buffers) digest.update(buffer);
    return digest.digest('hex');
};
const readUtf8 = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
const baseFiles = git(['ls-tree', '-r', '--name-only', BASE_COMMIT])
    .split(/\r?\n/)
    .map(normalizePath)
    .filter(Boolean);

const aggregateCategoryHash = (matcher) => {
    const files = baseFiles.filter(matcher).sort();
    if (!files.length) fail('EMPTY_HASH_CATEGORY');
    const chunks = [];
    for (const file of files) {
        const body = fs.readFileSync(path.join(ROOT, file));
        chunks.push(Buffer.from(`${file}\0`, 'utf8'), body, Buffer.from('\0', 'utf8'));
    }
    return { files: files.length, hash: sha256(chunks) };
};

if (process.argv.includes('--print-base-hashes')) {
    const hashLocks = Object.fromEntries(
        Object.entries(CATEGORY_MATCHERS).map(([name, matcher]) => [
            name,
            aggregateCategoryHash(matcher)
        ])
    );
    console.log(JSON.stringify(hashLocks, null, 2));
    process.exit(0);
}

const branch = git(['branch', '--show-current']).trim();
if (branch !== EXPECTED_BRANCH) fail('WRONG_BRANCH', branch);
try {
    git(['cat-file', '-e', `${BASE_COMMIT}^{commit}`]);
    git(['merge-base', '--is-ancestor', BASE_COMMIT, 'HEAD']);
} catch (error) {
    fail('BASE_NOT_ANCESTOR', error.stderr?.toString?.().trim() || 'git ancestry check failed');
}

const diffEntries = git(['diff', '--name-status', BASE_COMMIT, '--'])
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
        const [status, ...parts] = line.split('\t');
        return { status, file: normalizePath(parts.at(-1)) };
    });
const statusEntries = git(['status', '--porcelain=v1', '--untracked-files=all'])
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => ({ status: line.slice(0, 2), file: normalizePath(line.slice(3)) }));
const allowed = new Set(EXPECTED_FILES);
const changedFiles = new Set([
    ...diffEntries.map((entry) => entry.file),
    ...statusEntries.map((entry) => entry.file)
]);

for (const entry of diffEntries) {
    if (!allowed.has(entry.file)) fail('UNAUTHORIZED_DIFF_PATH', `${entry.status}:${entry.file}`);
    if (entry.status !== 'A') fail('EXISTING_FILE_CHANGED', `${entry.status}:${entry.file}`);
}
for (const entry of statusEntries) {
    if (!allowed.has(entry.file)) fail('UNAUTHORIZED_WORKTREE_PATH', `${entry.status}:${entry.file}`);
    if (!['??', 'A ', 'AM'].includes(entry.status)) fail('EXISTING_FILE_CHANGED', `${entry.status}:${entry.file}`);
}
for (const file of EXPECTED_FILES) {
    if (!fs.existsSync(path.join(ROOT, file))) fail('EXPECTED_FILE_MISSING', file);
    if (!changedFiles.has(file)) fail('EXPECTED_FILE_NOT_ADDED_FROM_BASE', file);
}
if (changedFiles.size !== EXPECTED_FILES.length) fail('UNEXPECTED_CHANGE_COUNT', String(changedFiles.size));

const mutationPatterns = [
    /\.save\s*\(/,
    /\.create\s*\(/,
    /\.insert(?:One|Many)\s*\(/,
    /\.update(?:One|Many)\s*\(/,
    /\.findOneAndUpdate\s*\(/,
    /\.replaceOne\s*\(/,
    /\.bulkWrite\s*\(/,
    /\.delete(?:One|Many)\s*\(/
];
const forbiddenRuntimePatterns = [
    /from\s+['"].*zapiClient/i,
    /from\s+['"].*agentRouter/i,
    /routeIncomingMessage\s*\(/,
    /\.(?:sendMessage|sendText|sendAudio|sendPurchase)\s*\(/,
    /from\s+['"].*(?:metaConversions|metaAttribution|dropi)/i,
    /\b(?:sendMeta|publishMeta|submitDropi|createDropi|updateDropi)\w*\s*\(/i
];
for (const file of RUNTIME_FILES) {
    const source = readUtf8(file);
    for (const pattern of [...mutationPatterns, ...forbiddenRuntimePatterns]) {
        if (pattern.test(source)) fail('FORBIDDEN_RUNTIME_CAPABILITY', `${file}:${pattern}`);
    }
}

const serviceSource = readUtf8(RUNTIME_FILES[0]);
for (const requiredReadPrimitive of ['.find(', '.select(', '.sort(', '.lean(']) {
    if (!serviceSource.includes(requiredReadPrimitive)) fail('READ_PRIMITIVE_MISSING', requiredReadPrimitive);
}
if (!serviceSource.includes('message.isFromMe === true')) fail('OUTBOUND_PROOF_NOT_EXPLICIT');
if (!serviceSource.includes("`${provider}:${providerMessageId}`")) fail('CANONICAL_IDENTITY_MISSING');
if (!serviceSource.includes('V191_QA_PHONE')) fail('QA_EXCLUSION_MISSING');

const freeze = JSON.parse(readUtf8(FREEZE_PATH));
if (freeze.version !== 'V191') fail('FREEZE_VERSION_MISMATCH');
if (freeze.baseCommit !== BASE_COMMIT) fail('FREEZE_BASE_MISMATCH');
if (freeze.branch !== EXPECTED_BRANCH) fail('FREEZE_BRANCH_MISMATCH');
if (JSON.stringify([...freeze.allowedFiles].sort()) !== JSON.stringify([...EXPECTED_FILES].sort())) {
    fail('FREEZE_ALLOWLIST_MISMATCH');
}

const categoryResults = {};
for (const [name, matcher] of Object.entries(CATEGORY_MATCHERS)) {
    const baseline = aggregateCategoryHash(matcher);
    const candidate = aggregateCategoryHash(matcher);
    const diff = baseline.hash === candidate.hash ? 0 : 1;
    if (diff !== 0) fail(`${name}_HASH_CHANGED`, `${baseline.hash}:${candidate.hash}`);
    if (freeze.hashLocks?.[name]?.sha256 !== baseline.hash) fail(`${name}_FREEZE_HASH_MISMATCH`);
    if (Number(freeze.hashLocks?.[name]?.files) !== baseline.files) fail(`${name}_FREEZE_FILE_COUNT_MISMATCH`);
    categoryResults[name] = { ...baseline, diff };
}

console.log('RESULT=PASS');
console.log('MODE=READ_ONLY_SHADOW');
console.log(`V191_BRANCH=${branch}`);
console.log(`BASE_COMMIT=${BASE_COMMIT}`);
console.log(`FILES_ADDED=${EXPECTED_FILES.length}`);
console.log('FUNCTIONAL_EXISTING_FILES_CHANGED=0');
console.log('DATABASE_MUTATION_CAPABILITIES=0');
console.log('WHATSAPP_OUTBOUND_CAPABILITIES=0');
console.log('ORDER_MUTATION_CAPABILITIES=0');
console.log('META_EVENT_CAPABILITIES=0');
console.log('DROPI_MUTATION_CAPABILITIES=0');
for (const [name, result] of Object.entries(categoryResults)) {
    console.log(`${name}_HASH_FILES=${result.files}`);
    console.log(`${name}_HASH_SHA256=${result.hash}`);
    console.log(`${name}_HASH_DIFF=${result.diff}`);
}
console.log('PRODUCTION_DEPLOYED=NO');
console.log('STAGE_DEPLOYED=NO');
console.log('SHADOW_ACTIVATED=NO');
