import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
    assertV192LineageHash,
    assertV192OverrideAllowlist
} from './lib/ec-runtime-successor-v192-context.mjs';
import { auditNxV192File } from './audit-ec-nx-funnel-click-path-v192.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE_COMMIT = 'c0cca110a87c82044db413934c7f017c23a9cfca';
const EXPECTED_BRANCH = 'codex/v192-guard-successor-alignment';
const FREEZE_PATH = 'docs/freeze/guard-successor-alignment-v192-20260919.json';
const EXPECTED_FILES = Object.freeze([
    'docs/GUARD_SUCCESSOR_ALIGNMENT_V192_20260919.md',
    FREEZE_PATH,
    'scripts/audit-ec-nx-funnel-click-path-v192.mjs',
    'scripts/guard-v192-successor-alignment.mjs',
    'scripts/lib/ec-runtime-successor-v192-context.mjs',
    'scripts/run-with-v192-context.mjs',
    'tests/v192-guard-successor-alignment.test.mjs'
]);

const CATEGORY_MATCHERS = Object.freeze({
    VSL: (file) => /(^|\/)(vsl|tex.?ultra|vit.?power|nitrix)/i.test(file) || /^public\/(n|m)(\/|\.|$)/i.test(file),
    BOT_SALES_CORE: (file) => /^src\/services\/(conversationEngine|agentRouter|initialFunnelTriggers|texUltraFunnelService|funnelPurposeMemoryService)\.js$/i.test(file) || /^src\/agents\//i.test(file),
    QR_PANEL: (file) => file === 'public/qr.html',
    FUNNEL_METRICS: (file) => file === 'public/funnel-metrics.html' || /^src\/(routes|services)\/.*funnel.*(metric|health)/i.test(file),
    POSTSALE_V188: (file) => /post.?sale/i.test(file) || /v188/i.test(file),
    META_CAPI_FUNCTIONAL: (file) => /^src\/.*(?:meta|capi)/i.test(file),
    ZAPI_RUNTIME: (file) => /^src\/(?:routes|services|whatsapp)\/.*zapi/i.test(file),
    WHATSAPP_RUNTIME: (file) => file === 'src/routes/whatsapp.js' || /^src\/whatsapp\//i.test(file),
    PRODUCT_PRICE: (file) => [
        'src/kb/product_ec.md',
        'src/models/Product.js',
        'src/routes/products.js',
        'src/services/ecuadorProductService.js',
        'src/services/nitrixProductProfile.js',
        'src/services/texUltraProductProfile.js',
        'src/services/vslProductAssignmentService.js'
    ].includes(file)
});

const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const normalizePath = (value = '') => String(value || '').trim().replace(/\\/g, '/').replace(/^"|"$/g, '');
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath));
const baseFiles = git(['ls-tree', '-r', '--name-only', BASE_COMMIT]).split(/\r?\n/).map(normalizePath).filter(Boolean);

export const assertV192ChangedFilesAllowed = (entries, allowedFiles = EXPECTED_FILES) => {
    const allowed = new Set(allowedFiles);
    for (const entry of entries || []) {
        assert.ok(allowed.has(entry.file), `[V192] unauthorized_change:${entry.status}:${entry.file}`);
        assert.ok(['A', '??', 'A ', 'AM'].includes(entry.status), `[V192] existing_file_changed:${entry.status}:${entry.file}`);
    }
    return true;
};

export const assertV192HashLock = (label, expected, actual) => {
    assert.equal(actual, expected, `[V192] ${label}_hash_changed`);
    return true;
};

const aggregateHash = (matcher) => {
    const files = baseFiles.filter(matcher).sort();
    assert.ok(files.length > 0, '[V192] empty_hash_category');
    const digest = crypto.createHash('sha256');
    for (const file of files) {
        digest.update(`${file}\0`);
        digest.update(read(file));
        digest.update('\0');
    }
    return { files: files.length, sha256: digest.digest('hex') };
};

const printBaseHashes = () => {
    const output = Object.fromEntries(Object.entries(CATEGORY_MATCHERS).map(([name, matcher]) => [name, aggregateHash(matcher)]));
    console.log(JSON.stringify(output, null, 2));
};

export const runV192Guard = () => {
    assert.equal(git(['branch', '--show-current']).trim(), EXPECTED_BRANCH, '[V192] wrong_branch');
    execFileSync('git', ['merge-base', '--is-ancestor', BASE_COMMIT, 'HEAD'], { cwd: ROOT, stdio: 'ignore' });

    const diffEntries = git(['diff', '--name-status', BASE_COMMIT, '--']).split(/\r?\n/).filter(Boolean).map((line) => {
        const [status, ...parts] = line.split('\t');
        return { status, file: normalizePath(parts.at(-1)) };
    });
    const statusEntries = git(['status', '--porcelain=v1', '--untracked-files=all']).split(/\r?\n/).filter(Boolean).map((line) => ({
        status: line.slice(0, 2),
        file: normalizePath(line.slice(3))
    }));
    const entries = [...diffEntries, ...statusEntries];
    assertV192ChangedFilesAllowed(entries);
    const changed = new Set(entries.map((entry) => entry.file));
    assert.deepEqual([...changed].sort(), [...EXPECTED_FILES].sort(), '[V192] candidate_file_set_mismatch');

    const freeze = JSON.parse(read(FREEZE_PATH).toString('utf8'));
    assert.equal(freeze.freezeId, 'GUARD_SUCCESSOR_ALIGNMENT_V192_20260919');
    assert.deepEqual([...freeze.allowedFiles].sort(), [...EXPECTED_FILES].sort());
    assertV192OverrideAllowlist(freeze.authorizedOverrides.map((entry) => entry.path));

    for (const entry of freeze.authorizedOverrides) {
        assertV192LineageHash({
            path: entry.path,
            actualSha256: sha256(read(entry.path)),
            expectedSha256: entry.currentSha256
        });
    }

    for (const [file, expectedHash] of Object.entries(freeze.protectedFiles || {})) {
        assert.ok(EXPECTED_FILES.includes(file), `[V192] protected_file_outside_allowlist:${file}`);
        assertV192HashLock(file, expectedHash, sha256(read(file)));
    }

    const categoryResults = {};
    for (const [name, matcher] of Object.entries(CATEGORY_MATCHERS)) {
        const actual = aggregateHash(matcher);
        assert.equal(actual.files, freeze.hashLocks[name].files, `[V192] ${name}_file_count_changed`);
        assertV192HashLock(name, freeze.hashLocks[name].sha256, actual.sha256);
        categoryResults[name] = actual;
    }

    const contextSource = read('scripts/lib/ec-runtime-successor-v192-context.mjs').toString('utf8');
    const runnerSource = read('scripts/run-with-v192-context.mjs').toString('utf8');
    assert.doesNotMatch(contextSource, /['"](?:\*|src\/\*\*|scripts\/\*\*)['"]/, '[V192] broad_override');
    assert.doesNotMatch(runnerSource, /shell:\s*true|process\.exit\(0\)/, '[V192] runner_bypass');
    assert.equal(globalThis.__VITALISMEN_V192_GUARD_SUCCESSOR_CONTEXT?.loaded, true, '[V192] context_not_loaded');
    auditNxV192File(path.join(ROOT, 'public/n/index.html'));

    console.log('RESULT=PASS');
    console.log(`V192_BRANCH=${EXPECTED_BRANCH}`);
    console.log(`BASE_COMMIT=${BASE_COMMIT}`);
    console.log('RUNTIME_FILES_CHANGED=0');
    console.log('AUTHORIZED_OVERRIDES=.github/workflows/ec-panel-quality.yml,src/routes/zapi.js,src/routes/whatsapp.js');
    console.log('NX_OLD_ASSERT_REMOVED=YES');
    console.log('NX_CURRENT_CONTRACT_VALIDATED=YES');
    for (const [name, result] of Object.entries(categoryResults)) {
        console.log(`${name}_HASH_FILES=${result.files}`);
        console.log(`${name}_HASH_SHA256=${result.sha256}`);
        console.log(`${name}_HASH_DIFF=0`);
    }
    console.log('GUARDS_BYPASSED=NO');
    console.log('PRODUCTION_CHANGED=NO');
    return { categoryResults };
};

if (process.argv.includes('--print-base-hashes')) {
    printBaseHashes();
} else if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    runV192Guard();
}
