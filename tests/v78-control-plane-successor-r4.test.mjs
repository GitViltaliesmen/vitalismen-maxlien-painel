import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    R4_CHECKPOINT_PATH, R4_MANIFEST_PATH, validateR4Manifest
} from '../scripts/lib/unified-successor-v202-r4-authority.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(root, relative));
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const oid = bytes => crypto.createHash('sha1')
    .update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes])).digest('hex');
const parent = '9d640d2700f91675f06b136cd6fe02695596e8cf';

test('controller sucessor altera somente o pin da autoridade; lógica canônica 32f6 permanece', () => {
    const relative = 'scripts/lib/pm2-target-env-restart-v78-r4.mjs';
    const historical = execFileSync('git', ['show', `${parent}:${relative}`], { cwd: root });
    assert.equal(sha256(historical),
        '32f6ac2488823a723be1c0b0f1774e2037c1ae13d9964a9143a84ad76bb3a330');
    const current = read(relative);
    const oldAuthority = '4039aa24456156411a2e1f1601812a245e624a15e979f3cc8c0b2778b63c91d8';
    const newAuthority = sha256(read('scripts/lib/unified-successor-v202-r4-authority.mjs'));
    assert.ok(current.toString().includes(newAuthority));
    assert.deepEqual(Buffer.from(current.toString().replace(newAuthority, oldAuthority)), historical);
    const helper = read('ops/ec-bot-core-v78-successor-r4').toString();
    assert.ok(helper.includes(sha256(current)), 'helper não fixa o controller sucessor exato');
    assert.match(helper, /activation_node_options.*unified-successor-v202-r4-preload\.mjs/);
    assert.match(helper, /rollback_executor.*ops\/vitalismen-rollback-v201-r4\.mjs/);
    assert.match(helper, /V201_AUTO_ROLLBACK=PASS/);
});

test('manifesto novo fixa helper de stage e preserva exatamente 83 identidades', () => {
    assert.equal(R4_CHECKPOINT_PATH,
        '/var/lib/vitalismen-deploy/CHECKPOINT_R4_CONTROL_PLANE_SUCCESSOR_AUTHORITY.json');
    assert.equal(R4_MANIFEST_PATH,
        'docs/freeze/unified-successor-v47-v77h2-v202-r4-control-plane-20260925.json');
    const manifest = validateR4Manifest(JSON.parse(read(R4_MANIFEST_PATH)));
    const stage = manifest.allowlist.find(entry => entry.path === 'ops/vitalismen-stage');
    const bytes = read('ops/vitalismen-stage');
    assert.equal(stage.gitBlobOid, oid(bytes));
    assert.equal(stage.canonicalSha256, sha256(bytes));
    assert.equal(stage.evidence, 'CHECKPOINT_R4_CONTROL_PLANE_SUCCESSOR_AUTHORITY');
    assert.equal(manifest.allowlistCount, 83);
    const historical = JSON.parse(execFileSync('git', ['show',
        `${parent}:docs/freeze/unified-successor-v47-v77h2-v202-r4-20260924.json`],
    { cwd: root }));
    assert.deepEqual(manifest.allowlist.filter(x => x.path !== 'ops/vitalismen-stage'),
        historical.allowlist.filter(x => x.path !== 'ops/vitalismen-stage'));
});
