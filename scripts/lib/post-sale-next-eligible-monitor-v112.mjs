import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
    POST_SALE_NEXT_ELIGIBLE_V112_ARM_PHRASE,
    POST_SALE_NEXT_ELIGIBLE_V112_PERMIT_TTL_DAYS,
    assertPostSaleNextEligibleMonitorV112Manifest
} from '../../src/services/postSaleNextEligibleMonitorV112Service.js';

const action = String(process.argv[2] || 'inspect').trim().toLowerCase();
const clean = (value = '') => String(value ?? '').trim();
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const canonical = (value) => `${JSON.stringify(value, null, 2)}\n`;
const fail = (reason) => { throw new Error(`[POST-SALE-NEXT-ELIGIBLE-V112] ${reason}`); };
const exactRelease = (value) => /^[0-9]{8}T[0-9]{6}Z_production-[0-9]{8}-[0-9a-f]{7}$/.test(clean(value));
const exactCommit = (value) => /^[0-9a-f]{40}$/.test(clean(value));
const exactTree = (value) => /^[0-9a-f]{40}$/.test(clean(value));

const assertRootOnlyRegularFile = (file) => {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) fail('permit_not_regular');
    if (process.platform !== 'win32' && stat.uid !== 0) fail('permit_not_root_owned');
    if (process.platform !== 'win32' && (stat.mode & 0o077) !== 0) fail('permit_permissions_too_open');
};

const readPermit = (file) => {
    assertRootOnlyRegularFile(file);
    const content = fs.readFileSync(file, 'utf8');
    const permit = JSON.parse(content);
    if (content !== canonical(permit)) fail('permit_not_canonical');
    return permit;
};

const manifestResult = assertPostSaleNextEligibleMonitorV112Manifest();

if (action === 'inspect') {
    process.stdout.write(`${JSON.stringify({
        status: 'PASS',
        version: 112,
        manifestSha256: manifestResult.manifestSha256,
        singleUse: true,
        batchMax: 1,
        dailyLimit: 1,
        providerCallsWhileDetecting: 0,
        mongoMutationsWhileDetecting: 0
    }, null, 2)}\n`);
    process.exit(0);
}

if (action === 'create') {
    const [releaseDir, release, commit, tree, permitFile, permitId, createdAt, expiresAt, phrase] = process.argv.slice(3);
    if (clean(phrase) !== POST_SALE_NEXT_ELIGIBLE_V112_ARM_PHRASE) fail('authorization_phrase_invalid');
    if (!path.isAbsolute(releaseDir) || !exactRelease(release) || path.basename(releaseDir) !== release) fail('release_invalid');
    if (!exactCommit(commit) || !exactTree(tree)) fail('source_identity_invalid');
    if (!path.isAbsolute(permitFile) || !/^[A-Za-z0-9][A-Za-z0-9._-]{5,120}$/.test(clean(permitId))) fail('permit_target_invalid');
    if (fs.existsSync(permitFile)) fail('permit_already_exists');
    const created = new Date(createdAt);
    const expires = new Date(expiresAt);
    const maxTtlMs = POST_SALE_NEXT_ELIGIBLE_V112_PERMIT_TTL_DAYS * 24 * 60 * 60 * 1000;
    if (!Number.isFinite(created.getTime()) || !Number.isFinite(expires.getTime())
        || expires <= created || expires.getTime() - created.getTime() > maxTtlMs + 60_000) fail('permit_time_invalid');
    const payload = {
        version: 112,
        profile: 'EC_POST_SALE_TRANSACTIONAL',
        status: 'ARMED_WAITING_NATURAL_ELIGIBLE',
        singleUse: true,
        release,
        releaseDir,
        commit,
        tree,
        permitId: clean(permitId),
        createdAt: created.toISOString(),
        expiresAt: expires.toISOString(),
        batchMax: 1,
        dailyLimit: 1,
        backlogEnabled: false,
        dropiAutomaticEnabled: false,
        metaRetroactiveEnabled: false,
        promoteBeyondOne: false,
        manifestSha256: manifestResult.manifestSha256,
        authorizationSha256: sha256(POST_SALE_NEXT_ELIGIBLE_V112_ARM_PHRASE)
    };
    const fd = fs.openSync(permitFile, 'wx', 0o600);
    try {
        fs.writeFileSync(fd, canonical(payload), 'utf8');
        fs.fsyncSync(fd);
    } finally {
        fs.closeSync(fd);
    }
    fs.chmodSync(permitFile, 0o600);
    process.stdout.write(`${JSON.stringify({ status: 'READY', permitId: payload.permitId, expiresAt: payload.expiresAt })}\n`);
    process.exit(0);
}

if (action === 'validate') {
    const [releaseDir, release, commit, tree, permitFile, permitId, nowAt] = process.argv.slice(3);
    const permit = readPermit(permitFile);
    const now = new Date(nowAt);
    if (!Number.isFinite(now.getTime()) || now < new Date(permit.createdAt) || now >= new Date(permit.expiresAt)) fail('permit_expired_or_not_yet_valid');
    if (permit.version !== 112 || permit.profile !== 'EC_POST_SALE_TRANSACTIONAL'
        || permit.status !== 'ARMED_WAITING_NATURAL_ELIGIBLE' || permit.singleUse !== true
        || permit.releaseDir !== releaseDir || permit.release !== release
        || permit.commit !== commit || permit.tree !== tree || permit.permitId !== permitId
        || permit.batchMax !== 1 || permit.dailyLimit !== 1
        || permit.backlogEnabled !== false || permit.dropiAutomaticEnabled !== false
        || permit.metaRetroactiveEnabled !== false || permit.promoteBeyondOne !== false
        || permit.manifestSha256 !== manifestResult.manifestSha256
        || permit.authorizationSha256 !== sha256(POST_SALE_NEXT_ELIGIBLE_V112_ARM_PHRASE)) {
        fail('permit_identity_or_policy_invalid');
    }
    process.stdout.write(`${JSON.stringify({ status: 'PASS', permitId, release, batchMax: 1 })}\n`);
    process.exit(0);
}

fail('usage_inspect_create_validate');
