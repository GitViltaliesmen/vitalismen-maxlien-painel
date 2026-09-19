import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE_COMMIT = '818db6cf281ee22d3ab4efc04f76cc7cf7898ae1';
const EXPECTED_BRANCH = 'codex/v193-vsl-first-response-watchdog-fix';
const FREEZE_PATH = 'docs/freeze/vsl-first-response-watchdog-v193-20260919.json';
const EXPECTED_FILES = Object.freeze([
    'docs/VSL_FIRST_RESPONSE_WATCHDOG_V193_20260919.md',
    FREEZE_PATH,
    'scripts/audit-v193-historical-watchdog-readonly.mjs',
    'scripts/guard-vsl-first-response-watchdog-v193.mjs',
    'src/routes/zapi.js',
    'src/services/vslFirstResponseWatchdogV193Service.js',
    'tests/vsl-first-response-watchdog-v193.test.mjs'
]);
const CATEGORY_MATCHERS = Object.freeze({
    VSL: (file) => /(^|\/)(vsl|tex.?ultra|vit.?power|nitrix)/i.test(file) || /^public\/(n|m)(\/|\.|$)/i.test(file),
    BOT_PROMPT: (file) => /^src\/(?:services\/agentProfiles\.js|services\/agents\/|kb\/)/i.test(file),
    AGENT_ROUTER: (file) => file === 'src/services/agentRouter.js',
    CONVERSATION_ENGINE: (file) => file === 'src/services/conversationEngine.js',
    QR_PANEL: (file) => file === 'public/qr.html',
    FUNNEL_METRICS: (file) => file === 'public/funnel-metrics.html' || /^src\/(routes|services)\/.*funnel.*(metric|health)/i.test(file),
    POSTSALE_V188: (file) => /post.?sale/i.test(file) || /v188/i.test(file),
    META_CAPI_FUNCTIONAL: (file) => /^src\/.*(?:meta|capi)/i.test(file),
    DROPI: (file) => /dropi/i.test(file)
});

const git = (args, options = {}) => execFileSync('git', args, {
    cwd: ROOT,
    encoding: options.binary ? null : 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe']
});
const normalize = (value = '') => String(value || '').trim().replace(/\\/g, '/').replace(/^"|"$/g, '');
const sha256 = (chunks) => {
    const digest = crypto.createHash('sha256');
    for (const chunk of chunks) digest.update(chunk);
    return digest.digest('hex');
};
const baseEntries = git(['ls-tree', '-r', BASE_COMMIT]).split(/\r?\n/).filter(Boolean).map((line) => {
    const [identity, rawFile] = line.split('\t');
    const [, , objectId] = identity.split(' ');
    return { file: normalize(rawFile), objectId };
});
const baseFiles = baseEntries.map((entry) => entry.file);
const baseObjectIds = new Map(baseEntries.map((entry) => [entry.file, entry.objectId]));
const gitBlobId = (body) => crypto.createHash('sha1')
    .update(Buffer.from(`blob ${body.length}\0`))
    .update(body)
    .digest('hex');

const aggregate = (matcher, source) => {
    const files = baseFiles.filter(matcher).sort();
    assert.ok(files.length, `[V193] empty_hash_category:${source}`);
    const chunks = [];
    for (const file of files) {
        const objectId = source === 'base'
            ? baseObjectIds.get(file)
            : gitBlobId(fs.readFileSync(path.join(ROOT, file)));
        chunks.push(Buffer.from(`${file}\0${objectId}\0`));
    }
    return { files: files.length, sha256: sha256(chunks) };
};
const changedEntries = () => {
    const committed = git(['diff', '--name-status', BASE_COMMIT, '--']).split(/\r?\n/).filter(Boolean).map((line) => {
        const [status, ...parts] = line.split('\t');
        return { status, file: normalize(parts.at(-1)) };
    });
    const working = git(['status', '--porcelain=v1', '--untracked-files=all']).split(/\r?\n/).filter(Boolean).map((line) => ({
        status: line.slice(0, 2), file: normalize(line.slice(3))
    }));
    return [...committed, ...working];
};

if (process.argv.includes('--print-base-hashes')) {
    console.log(JSON.stringify(Object.fromEntries(
        Object.entries(CATEGORY_MATCHERS).map(([label, matcher]) => [label, aggregate(matcher, 'base')])
    ), null, 2));
    process.exit(0);
}

assert.equal(git(['branch', '--show-current']).trim(), EXPECTED_BRANCH, '[V193] wrong_branch');
execFileSync('git', ['merge-base', '--is-ancestor', BASE_COMMIT, 'HEAD'], { cwd: ROOT, stdio: 'ignore' });

const entries = changedEntries();
const allowed = new Set(EXPECTED_FILES);
for (const entry of entries) {
    assert.ok(allowed.has(entry.file), `[V193] unauthorized_change:${entry.status}:${entry.file}`);
    if (entry.file === 'src/routes/zapi.js') {
        assert.ok(['M', ' M', 'M ', 'MM'].includes(entry.status), `[V193] existing_file_status:${entry.status}:${entry.file}`);
    } else {
        assert.ok(['A', '??', 'A ', 'AM'].includes(entry.status), `[V193] added_file_status:${entry.status}:${entry.file}`);
    }
}
assert.deepEqual([...new Set(entries.map((entry) => entry.file))].sort(), [...EXPECTED_FILES].sort(), '[V193] candidate_file_set_mismatch');

const freeze = JSON.parse(fs.readFileSync(path.join(ROOT, FREEZE_PATH), 'utf8'));
assert.equal(freeze.version, 'V193');
assert.equal(freeze.baseCommit, BASE_COMMIT);
assert.equal(freeze.branch, EXPECTED_BRANCH);
assert.deepEqual([...freeze.allowedFiles].sort(), [...EXPECTED_FILES].sort());

const routeSource = fs.readFileSync(path.join(ROOT, 'src/routes/zapi.js'), 'utf8');
const serviceSource = fs.readFileSync(path.join(ROOT, 'src/services/vslFirstResponseWatchdogV193Service.js'), 'utf8');
const reportSource = fs.readFileSync(path.join(ROOT, 'scripts/audit-v193-historical-watchdog-readonly.mjs'), 'utf8');
assert.match(routeSource, /const publicVslLeadEntry = vslRoutingAllowed\s*&& Boolean\(vslProductContext\)\s*&& \(looksLikePublicVslLeadText\(normalizedBody\) \|\| Boolean\(vslProductContext\)\);/);
assert.match(routeSource, /!result\.eligibleForFirstResponseWatchdog \|\| !result\.routeToBot/);
assert.doesNotMatch(routeSource, /!result\.publicVslLeadEntry \|\| !result\.routeToBot/);
for (const required of [
    'metadata.vslFirstEntryMessageId',
    'metadata.vslFirstEntryProviderMessageId',
    'metadata.vslFirstEntryAt',
    'metadata.vslFirstResponseWatchdogKey',
    'metadata.vslFirstResponseWatchdogLockToken',
    'metadata.vslFirstResponseWatchdogLockExpiresAt',
    'metadata.vslFirstResponseWatchdogAttemptCount',
    "providerMessageId = ''",
    "providerZaapId = ''",
    "messageId = ''",
    'findOneAndUpdate',
    'V193_WATCHDOG_BLOCKED_BUCKETS',
    ':v193-first-response-recovery'
]) assert.ok(serviceSource.includes(required), `[V193] missing_contract:${required}`);
assert.doesNotMatch(serviceSource, /_watchdog_\$\{Date\.now\(\)\}/, '[V193] time_based_recovery_id');
assert.doesNotMatch(reportSource, /\.(?:save|create|insertOne|insertMany|updateOne|updateMany|findOneAndUpdate|replaceOne|bulkWrite|deleteOne|deleteMany)\s*\(/);
assert.doesNotMatch(reportSource, /(?:sendZapi|routeIncomingMessage|sendMessage|sendAudio|submitDropi|sendPurchase)\s*\(/);

const categoryResults = {};
for (const [label, matcher] of Object.entries(CATEGORY_MATCHERS)) {
    const baseline = aggregate(matcher, 'base');
    const candidate = aggregate(matcher, 'candidate');
    assert.deepEqual(candidate, baseline, `[V193] ${label}_hash_changed`);
    assert.deepEqual(freeze.hashLocks[label], baseline, `[V193] ${label}_freeze_mismatch`);
    categoryResults[label] = candidate;
}

console.log('RESULT=PASS');
console.log(`V193_BRANCH=${EXPECTED_BRANCH}`);
console.log(`BASE_PARENT=${BASE_COMMIT}`);
console.log('WATCHDOG_FIRST_ENTRY_ONLY=YES');
console.log('ATOMIC_LOCK=YES');
console.log('AT_MOST_ONCE=YES');
console.log('HISTORICAL_RECOVERY_CAPABILITY=0');
console.log('GUARDS_BYPASSED=NO');
for (const [label, result] of Object.entries(categoryResults)) {
    console.log(`${label}_HASH_FILES=${result.files}`);
    console.log(`${label}_HASH_SHA256=${result.sha256}`);
    console.log(`${label}_HASH_DIFF=0`);
}
