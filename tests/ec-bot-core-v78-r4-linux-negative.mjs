import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
    assertNodeOptionsForRelease,
    verifyMaterializedRelease
} from '../scripts/lib/unified-successor-v202-r4-authority.mjs';
import {
    inspectPublishedEcBotCoreV78Release,
    validateEcBotCoreOperationalBundleV78
} from '../scripts/lib/ec-bot-core-operational-contract-v78.mjs';
import {
    EC_BOT_CORE_V199_NODE_OPTIONS,
    EC_BOT_CORE_R4_NODE_OPTIONS,
    EC_BOT_CORE_V78_NODE_OPTIONS,
    assertEcBotCoreV78Health,
    selectEcBotCoreV78PreloadForRelease
} from '../src/services/ecBotCoreOperationalV78Service.js';

assert.equal(process.platform, 'linux');
assert.equal(process.argv.length, 7, 'fixture_args_invalid');
const [releaseRaw, v201Raw, overlayPath, attestationPath, permitPath] = process.argv.slice(2);
const releaseDir = fs.realpathSync(releaseRaw);
const v201Dir = fs.realpathSync(v201Raw);
const identity = inspectPublishedEcBotCoreV78Release({
    releaseDir, release: path.basename(releaseDir)
});
const bundle = {
    overlay: fs.readFileSync(overlayPath, 'utf8'),
    attestation: JSON.parse(fs.readFileSync(attestationPath, 'utf8')),
    permit: JSON.parse(fs.readFileSync(permitPath, 'utf8'))
};
const expected = { ...identity, permitId: bundle.permit.permitId };
const nowMs = Date.parse(bundle.permit.createdAt) + 60_000;
let negatives = 0;
const blocked = (label, fn) => { assert.throws(fn, undefined, label); negatives += 1; };
const validate = changes => validateEcBotCoreOperationalBundleV78({
    ...bundle, nowMs, expected, ...changes
});

verifyMaterializedRelease(releaseDir);
assert.equal(assertNodeOptionsForRelease(releaseDir, EC_BOT_CORE_R4_NODE_OPTIONS,
    { requireAttestation: true }), EC_BOT_CORE_R4_NODE_OPTIONS);
assert.equal(assertNodeOptionsForRelease(v201Dir, EC_BOT_CORE_V199_NODE_OPTIONS),
    EC_BOT_CORE_V199_NODE_OPTIONS);
assert.equal(selectEcBotCoreV78PreloadForRelease(identity), EC_BOT_CORE_R4_NODE_OPTIONS);
assert.equal(validate().ok, true);

blocked('V201 + R4', () => assertNodeOptionsForRelease(v201Dir, EC_BOT_CORE_R4_NODE_OPTIONS));
blocked('R4 + V199', () => assertNodeOptionsForRelease(releaseDir, EC_BOT_CORE_V199_NODE_OPTIONS));
blocked('R4 + V97', () => assertNodeOptionsForRelease(releaseDir, EC_BOT_CORE_V78_NODE_OPTIONS));
blocked('wrong commit', () => selectEcBotCoreV78PreloadForRelease({
    ...identity, commit: '0'.repeat(40)
}));
blocked('wrong tree', () => selectEcBotCoreV78PreloadForRelease({
    ...identity, tree: '0'.repeat(40)
}));
blocked('unknown release', () => selectEcBotCoreV78PreloadForRelease({
    ...identity, release: '20260924T000000Z_production-20260924-0000000'
}));
blocked('wrong bundle identity', () => validate({ expected: { ...expected, commit: '0'.repeat(40) } }));
blocked('wrong preload', () => validate({ overlay: bundle.overlay.replace(
    EC_BOT_CORE_R4_NODE_OPTIONS, EC_BOT_CORE_V199_NODE_OPTIONS) }));
blocked('wrong manifest', () => selectEcBotCoreV78PreloadForRelease({
    ...identity, successorManifestSha256: '0'.repeat(64)
}));
blocked('wrong attestation', () => validate({
    attestation: { ...bundle.attestation, tree: '0'.repeat(40) }
}));
blocked('wrong permit', () => validate({
    permit: { ...bundle.permit, permitId: 'ec-bot-core-v78-wrong-001' }
}));
blocked('expired permit', () => validate({ nowMs: Date.parse(bundle.permit.expiresAt) + 1 }));
const originalEnvCommit = process.env.VITALISMEN_R4_EXPECTED_COMMIT;
const originalEnvTree = process.env.VITALISMEN_R4_EXPECTED_TREE;
process.env.VITALISMEN_R4_EXPECTED_COMMIT = '0'.repeat(40);
process.env.VITALISMEN_R4_EXPECTED_TREE = '0'.repeat(40);
try {
    blocked('env-only identity', () => selectEcBotCoreV78PreloadForRelease({
        ...identity, commit: '0'.repeat(40), tree: '0'.repeat(40)
    }));
} finally {
    if (originalEnvCommit === undefined) delete process.env.VITALISMEN_R4_EXPECTED_COMMIT;
    else process.env.VITALISMEN_R4_EXPECTED_COMMIT = originalEnvCommit;
    if (originalEnvTree === undefined) delete process.env.VITALISMEN_R4_EXPECTED_TREE;
    else process.env.VITALISMEN_R4_EXPECTED_TREE = originalEnvTree;
}
const health = {
    status: 'online', engine: 'Z-API', zapi: { connected: true, outboundBlocked: false },
    automationSafety: { mode: 'EC_BOT_CORE_OPERATIONAL', botCoreOperational: true,
        mutatingSchedulers: 0, dropiApplyAllowed: false, metaPurchaseAllowed: false }
};
const meta = { datasetId: '1468946114265008', browserPixelId: '1468946114265008',
    browserServerSynchronized: true };
assert.equal(assertEcBotCoreV78Health(health, meta).ok, true);
blocked('health without Z-API', () => assertEcBotCoreV78Health({
    ...health, zapi: { ...health.zapi, connected: false }
}, meta));
assert.equal(negatives, 14);
process.stdout.write('V78_R4_NEGATIVE_MATRIX=14/14_PASS\n');
process.stdout.write('R4_V78_SELECTION=PASS\nR4_BUNDLE_VALIDATION=PASS\n');
process.stdout.write('R4_PM2_TARGET=PASS\nR4_HEALTH_CONTRACT=PASS\n');
process.stdout.write('V201_V199_SELECTION=PASS\n');
