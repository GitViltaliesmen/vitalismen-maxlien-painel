import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
    R4_CHECKPOINT_PATH, R4_ATTESTATION_NAME, R4_MANIFEST_PATH,
    R4_PRELOAD_PATH, R4_GUARD_PATH, R4_RUNNER_PATH,
    verifyMaterializedRelease, assertNodeOptionsForRelease
} from '../scripts/lib/unified-successor-v202-r4-authority.mjs';

const root = fs.realpathSync(process.argv[2]);
const v201 = '/opt/vitalismen-automacao/releases/20260924T120000Z_production-20260924-641759b';
const preload = `--import=file://${root}/scripts/lib/unified-successor-v202-r4-preload.mjs`;
const v199Options = '--import=file:///opt/vitalismen-automacao/current/scripts/lib/ec-runtime-successor-v199-context.mjs';
const r4Options = '--import=file:///opt/vitalismen-automacao/current/scripts/lib/unified-successor-v202-r4-preload.mjs';
let negatives = 0;
const expectBlock = (label, fn) => {
    assert.throws(fn, label);
    negatives += 1;
};
const temporaryChange = (file, write, check) => {
    const original = fs.readFileSync(file);
    const mode = fs.statSync(file).mode & 0o777;
    fs.chmodSync(file, 0o600);
    try {
        write(file, original);
        check();
    } finally {
        fs.writeFileSync(file, original);
        fs.chmodSync(file, mode);
    }
    verifyMaterializedRelease(root);
};
const missing = (file, label, check) => {
    const backup = `${file}.r4-negative-${process.pid}`;
    assert.ok(!fs.existsSync(backup));
    fs.renameSync(file, backup);
    try { expectBlock(label, check); }
    finally { fs.renameSync(backup, file); }
    verifyMaterializedRelease(root);
};
verifyMaterializedRelease(root);
missing(R4_CHECKPOINT_PATH, 'checkpoint ausente',
    () => verifyMaterializedRelease(root));
missing(R4_CHECKPOINT_PATH, 'checkpoint arbitrário não substitui o fixo', () => {
    const before = process.env.VITALISMEN_R4_CHECKPOINT_PATH;
    process.env.VITALISMEN_R4_CHECKPOINT_PATH = `${R4_CHECKPOINT_PATH}.r4-negative-${process.pid}`;
    try { verifyMaterializedRelease(root); }
    finally {
        if (before === undefined) delete process.env.VITALISMEN_R4_CHECKPOINT_PATH;
        else process.env.VITALISMEN_R4_CHECKPOINT_PATH = before;
    }
});
for (const envKey of ['VITALISMEN_R4_EXPECTED_COMMIT', 'VITALISMEN_R4_EXPECTED_TREE']) {
    missing(R4_CHECKPOINT_PATH, `${envKey} sozinho não autoriza`, () => {
        const before = process.env[envKey];
        process.env[envKey] = 'a'.repeat(40);
        try { verifyMaterializedRelease(root); }
        finally {
            if (before === undefined) delete process.env[envKey];
            else process.env[envKey] = before;
        }
    });
}
temporaryChange(R4_CHECKPOINT_PATH, (file, original) => {
    const value = JSON.parse(original);
    value.status = 'UNFROZEN';
    fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}, () => expectBlock('checkpoint adulterado', () => verifyMaterializedRelease(root)));
const attestation = path.join(root, R4_ATTESTATION_NAME);
missing(attestation, 'attestation ausente', () => verifyMaterializedRelease(root));
for (const field of ['commit', 'tree', 'manifestSha256', 'preloadSha256',
    'guardSha256', 'runnerSha256']) {
    temporaryChange(attestation, (file, original) => {
        const value = JSON.parse(original);
        value[field] = field === 'commit' || field === 'tree' ? 'a'.repeat(40) : 'a'.repeat(64);
        fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
    }, () => expectBlock(`attestation ${field} adulterada`,
        () => verifyMaterializedRelease(root)));
}
for (const relative of [R4_MANIFEST_PATH, R4_PRELOAD_PATH, R4_GUARD_PATH, R4_RUNNER_PATH,
    'src/routes/shipments.js']) {
    temporaryChange(path.join(root, relative), (file, original) =>
        fs.writeFileSync(file, Buffer.concat([original, Buffer.from('\n')])),
    () => expectBlock(`arquivo materializado ${relative} adulterado`,
        () => verifyMaterializedRelease(root)));
}
expectBlock('R4 com V199', () => assertNodeOptionsForRelease(root, v199Options,
    { requireAttestation: true }));
expectBlock('V201 com R4', () => assertNodeOptionsForRelease(v201, r4Options));
assert.equal(assertNodeOptionsForRelease(root, r4Options,
    { requireAttestation: true }), r4Options);
assert.equal(assertNodeOptionsForRelease(v201, v199Options), v199Options);
const historicalPreload = path.join(v201, 'scripts/lib/ec-runtime-successor-v199-context.mjs');
missing(historicalPreload, 'V199 ausente', () => verifyMaterializedRelease(root));
const v146 = path.join(v201, 'scripts/lib/ec-runtime-successor-v146-context.mjs');
const v146Backup = `${v146}.r4-negative-${process.pid}`;
assert.ok(!fs.existsSync(v146Backup));
fs.renameSync(v146, v146Backup);
try {
    const result = spawnSync(process.execPath, ['--import', preload.slice('--import='.length),
        '--input-type=module', '-e', ''], { cwd: root, encoding: 'utf8', timeout: 90_000 });
    assert.notEqual(result.status, 0, 'V146 ausente deve bloquear --import');
    negatives += 1;
} finally {
    fs.renameSync(v146Backup, v146);
}
verifyMaterializedRelease(root);
process.stdout.write(`NEGATIVE_OPERATIONAL_MATRIX=${negatives}/${negatives}_PASS\n`);
