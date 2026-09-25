import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const V201_COMMIT = '641759b160c2b91e95a3f1df371ad372a74d72e1';
const V201_TREE = '1feb02ad1a3f2ae266ef519bf33426b91ac80aa3';
const V201_MANIFEST_SHA256 = 'e8b82901e8faa4cda1d37a013fd2698401bad9c2039b702e637b88d5e4e56bee';
const PARENT_MANIFESTS = Object.freeze({
    'docs/freeze/ec-bot-core-lifecycle-boot-v88-20260830.json':
        '3777e44a6166d6367121bcf98964f5be45c079b96d1824894b773e4e6461ad13',
    'docs/freeze/ec-bot-core-control-plane-v89-20260830.json':
        '1af1407c551392ad4f292bff3a94019996f778c515b30415e146b6998b2180f8',
    'docs/freeze/ec-vsl-dashboard-ingress-v90-20260830.json':
        '321ac50d2bd28d8a0487b325bc6448741b4f7ef8eeb21497d30db0aef19d97f6',
    'docs/freeze/ec-operational-guard-context-v97-20260830.json':
        '68d060e1596c03e2058546ae13841db5fb02e7a23869394c4a67a7087874caa1'
});

const R4_HASHES = Object.freeze({
    'docs/ARQUITETURA_AUTOMACAO_OFICIAL.md': '9630ffe01ccf73f8d161643a04cc69bf84f007a249206189fefe3ee4ad9c6db8',
    'docs/ARQUIVOS_OFICIAIS.md': 'aadaa264fc5065701e5cb24d080e6f66338a80c3b5ec043b6d0c3a440b408256',
    'docs/EC_BOT_CORE_CONTROL_PLANE_FREEZE_V89_20260830.md': '3afc6c7cad6a33649ae58da105026861960cc337d1e4dced105402cef9eb5a1e',
    'docs/EC_BOT_CORE_LIFECYCLE_BOOT_FREEZE_V88_20260830.md': '625df3c50f5901f24c229313a3155d4f32e23b806465e5226302d9c9d253285a',
    'docs/EC_OPERATIONAL_GUARD_CONTEXT_FREEZE_V97_20260830.md': 'a27593a80e5ca8ddb156d94add6ccf418e4c14b822d5bd635d339b115ea3d255',
    'docs/EC_VSL_DASHBOARD_INGRESS_FREEZE_V90_20260830.md': '5e4cbfcc06c53e429ba8e96da31fdda398a44c90121c6ab3e5c7f48796535ff7',
    'docs/evidence/ec-bot-core-control-plane-v89-attestation-20260830.json': 'abe2421b2a030a1ff54fcc7dad570dc1776dd196f8f0f3489f903493fc876729',
    'docs/evidence/ec-bot-core-lifecycle-boot-v88-attestation-20260830.json': 'b05feba078747cffe784152badfbd0ec3ba95e5898ebc6e336ef49e0ba840a55',
    'docs/evidence/ec-operational-guard-context-v97-attestation-20260830.json': 'f5a9ac6e0acbb56ec23207f9235564e070b037758f52d56cc62ce90672b49349',
    'docs/evidence/ec-vsl-dashboard-ingress-v90-attestation-20260830.json': '63e01b91ee92f8b0e5a6db0cfb05cca1869c2e0c251a47eedf09a93e4301e273',
    'ops/ec-bot-core-v78': 'b85bf93d8edf0cbb4908685745ea5467d98f5d03be07f129077d11faf69b7411',
    'ops/vitalismen-stage': 'aae221b6a19fd6e25c521ff2bae714fc246693122e2d4b58a10382336e1d4af1',
    'scripts/guard-ec-bot-core-control-plane-v89.mjs': '3cea6b0f38104a9aa6064fa354dbe618dd4e7a2512af40855b78b19cd8fe7b26',
    'scripts/guard-ec-bot-core-lifecycle-boot-v88.mjs': 'f22fd9a9396f82307791fa650ca81e557d75c21cda2698770932afcaacd6ae40',
    'scripts/guard-ec-operational-guard-context-v97.mjs': '5c04a575e54695992680c75e930a7290d1a71f786660858bb66c76385994202d',
    'scripts/guard-ec-vsl-dashboard-ingress-v90.mjs': '306c12c73667d64b25d80cd010df793fa466108b0a01089cdedddcc7030725b3',
    'scripts/lib/ec-bot-core-control-plane-v89-successor-context.mjs': '25d024b8b28f940f3d5ad1d3469e3ede86995eb1dd448efec69de57e02100bb1',
    'scripts/lib/ec-bot-core-lifecycle-boot-v88-successor-context.mjs': '79439f79c0081cf895587eaf7bae7aa5ba9c90fecc0664bd38ed14fb55abfd8d',
    'scripts/lib/ec-bot-core-operational-contract-v78.mjs': '622cf6f5fb5539ec6dfef2860bf81516bbac592ab677de7906b886ae10c160a9',
    'scripts/lib/ec-runtime-successor-v97-context.mjs': '295db36fbaecb3baaa7451f1ccb5c0435868c6bf7ddf471ef05a8c2ce99f13d9',
    'scripts/lib/pm2-target-env-restart-v89.mjs': '7517ccc94c137dd40dc7122cb46bc3313a2bf22643c7352c210abb28ca8b3a7f',
    'scripts/run-deploy-guard-ancestry-predeploy-v91.mjs': '3803c93e304ed0a973d1b008adf828b4758e34a113173e6d5af6792c33b1ac4f',
    'src/index.js': 'e63cfa73692b122d949ecbeb597cfb43761b2c555b6923afb8e7eb61eadc7b8f',
    'src/routes/zapi.js': '8dc6888f21514fbe1cc8dfa52aa97c552fe8883926ceb550509ef4a069580608',
    'src/services/canaryControllerV77Service.js': '14713f12aba3e4163dd5c528790a404c56ee9336bdb4491d0d8da7df38ad3f30',
    'src/services/ecBotCoreControlPlaneFreezeRuntimeGuardV89.js': '7eea985787bdf8ecb72390e8e3673463292654a911eec58787996380353e6cc9',
    'src/services/ecBotCoreControlPlaneV89Service.js': '3f63edc57e61bdf19604d553c452b92e87465c2069b1177fa63fc32ad2290084',
    'src/services/ecBotCoreLifecycleBootFreezeRuntimeGuardV88.js': '1ef46b6a1a743236b1e4bd0b9ffa6d89b8a4667ac6233f4146a1eb56c7abfc81',
    'src/services/ecBotCoreLifecycleBootV88Service.js': '6f409f6450c6cd4a9b67b94a5dc49e4acd710b5c38325055822b6c5dfa4da2dc',
    'src/services/ecBotCoreOperationalV78Service.js': 'bfd27de60c06ea0925c03cfbebe48383a321c6146a55997ad1b3672349ccc6fa',
    'src/services/ecBotCoreRuntimeIntegrationV78Service.js': '08826c013878df41fe54996502112e50fbcd62ebce63da064628e9355d4849c8',
    'src/services/ecBotCoreStructuralSafetyFreezeRuntimeGuardV78.js': '0046c7c5439f1f7b358d932dc460d0349de755bd26f24fa57fb164bbf29429d1',
    'src/services/ecOfficialVslEntryV78Service.js': '4a145b538d990124b21939934d6e81cdfcadcdae3157fec4f58a6cd94146085b',
    'src/services/ecOperationalGuardContextFreezeRuntimeGuardV97.js': 'b1c7707f16c8571311558c3d0bd93bc061bad48aa65b37773d8429514a9d88c8',
    'src/services/ecOperationalGuardContextV97Service.js': '2571d3bcad015284af1f2f981fb2e611b65fa6f06cbc18fb576728ec05c3063d',
    'src/services/ecRuntimeTransientResetV96Service.js': 'bbb3eb8978e8e07df27db6ddfdcce31783ac8a19d92ad3325bcdcf113624ffc0',
    'src/services/ecVslDashboardIngressFreezeRuntimeGuardV90.js': '031216723a82282d49c24305060bfcb126a2af9479795abd5bf476f60330847d',
    'src/services/ecVslDashboardIngressV90Service.js': '6f4ac2308743b4caea4e156b6c1ebc4dc2e546356b586bcf9c110550f4dddf87',
    'tests/ec-bot-core-control-plane-v89.test.mjs': '432416d7a6e397206024795f5fc6c64e78853d67cda0e7e7837a0f48a87ea136',
    'tests/ec-bot-core-lifecycle-boot-v88.test.mjs': '37af91ea5a27ea36feae8297e5f68ad6ac205570d0cfd76e770a772bc2e5f601',
    'tests/ec-operational-guard-context-v97.test.mjs': '8197735e6d0da83d15277cde363578584e13e41c371d6510f49c0679759edd64',
    'tests/ec-runtime-current-binding-v94.test.mjs': '305b95fbb7dffc16e4726afe19ef01fe2136a8136551351476395d8eee572ecd',
    'tests/ec-runtime-safe-reset-v95.test.mjs': 'cb99b19da6e50925e3fc5b3f05a0f2726e4800caf9b4e35e980fcdf931368b4e',
    'tests/ec-runtime-successor-v93.test.mjs': 'db09308c119f381ad77521bd8015377e5206e9a6f5fba30bd0dcbe200814a97b',
    'tests/ec-runtime-transient-reset-v96.test.mjs': 'b9312f14b86bbf923dc5d146e5ce14a4eb56a9c64277e804012bbb7017178012',
    'tests/ec-vsl-dashboard-ingress-v90.test.mjs': '228029e88644f03f3eed7312cbc9814075d59dc97dc25b0eb0b073a666220fa3',
});
const V201_OVERRIDES = Object.freeze({
    'ops/vitalismen-stage': '803481d66f89b235e3d1451050dfe3d64764389f14aa6596bba65cf381e18f99',
    'scripts/lib/ec-bot-core-operational-contract-v78.mjs':
        'f9443719e9cde0ea18368a0537736ebd5d872e9dd635c565d1793f5e2ef7f97e',
    'src/services/ecBotCoreOperationalV78Service.js':
        'ae22a945d345f8935cbf81aeab4c09f6814057e715f2e2b4a5a9cd87d9be3788'
});
const R4_SUCCESSOR_OVERRIDES = Object.freeze({
    'ops/vitalismen-stage': '8786027df77ac1988a450c72f06b2c202b5de0fd68e2100766ddfc706e6e9e8d',
    'src/services/ecBotCoreOperationalV78Service.js':
        'eb7220726d892228df9a453dfa5692a8ede6f55e5146c173a972cc16909dbbe3',
    'scripts/lib/ec-bot-core-operational-contract-v78.mjs':
        '23b5ac9e682720291bdb2afd02207e5c0642c6ff1b5274b94ce3f13feb08ce2a'
});
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const regularBytes = file => {
    const stat = fs.lstatSync(file);
    assert.ok(stat.isFile() && !stat.isSymbolicLink(), `V78_PARENT_UNSAFE_FILE:${file}`);
    return fs.readFileSync(file);
};
const canonicalJson = file => {
    const text = regularBytes(file).toString('utf8');
    const value = JSON.parse(text);
    assert.equal(text, `${JSON.stringify(value, null, 2)}\n`, `V78_PARENT_NONCANONICAL:${file}`);
    return value;
};
const protectedPath = (root, relative) => {
    assert.match(relative, /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9_.\-/]+$/,
        'V78_PARENT_PATH_INVALID');
    const file = path.resolve(root, relative);
    assert.ok(file.startsWith(`${root}${path.sep}`), 'V78_PARENT_PATH_OUTSIDE_RELEASE');
    let current = root;
    const segments = relative.split('/');
    for (let index = 0; index < segments.length; index += 1) {
        current = path.join(current, segments[index]);
        const stat = fs.lstatSync(current);
        assert.equal(stat.isSymbolicLink(), false,
            `V78_PARENT_SYMLINK_ESCAPE:${relative}`);
        assert.ok(index === segments.length - 1 ? stat.isFile() : stat.isDirectory(),
            `V78_PARENT_PATH_TYPE_INVALID:${relative}`);
    }
    return file;
};

export async function assertEcBotCoreParentProtectionR4(releaseDir) {
    const root = fs.realpathSync(releaseDir);
    const source = canonicalJson(path.join(root, '.release-source.json'));
    assert.equal(source.releaseName, path.basename(root), 'V78_PARENT_RELEASE_PATH_INVALID');
    const commit = String(source.functionalCommit || '').toLowerCase();
    const tree = String(source.functionalTree || '').toLowerCase();
    let identity;
    if (commit === V201_COMMIT && tree === V201_TREE) {
        assert.match(source.releaseName, /^\d{8}T\d{6}Z_production-\d{8}-641759b$/,
            'V78_PARENT_V201_RELEASE_INVALID');
        const published = canonicalJson(path.join(root, '.publication-complete.json'));
        assert.equal(published.status, 'complete', 'V78_PARENT_V201_NOT_PUBLISHED');
        assert.equal(published.functionalCommit, commit, 'V78_PARENT_V201_COMMIT_INVALID');
        assert.equal(published.functionalTree, tree, 'V78_PARENT_V201_TREE_INVALID');
        assert.equal(sha256(regularBytes(path.join(root,
            'docs/freeze/ec-bot-core-overlay-preload-v201-20260924.json'))),
        V201_MANIFEST_SHA256, 'V78_PARENT_V201_MANIFEST_INVALID');
        identity = 'V201';
    } else {
        const authority = await import(pathToFileURL(path.join(root,
            'scripts/lib/unified-successor-v202-r4-authority.mjs')).href);
        const verified = authority.verifyMaterializedRelease(root);
        assert.equal(verified.checkpoint.r4OperationalCommit, commit,
            'V78_PARENT_R4_COMMIT_INVALID');
        assert.equal(verified.checkpoint.r4OperationalTree, tree,
            'V78_PARENT_R4_TREE_INVALID');
        assert.equal(verified.attestation.commit, commit,
            'V78_PARENT_R4_ATTESTATION_COMMIT_INVALID');
        assert.equal(verified.attestation.tree, tree,
            'V78_PARENT_R4_ATTESTATION_TREE_INVALID');
        identity = verified.checkpoint.checkpointId ===
            'CHECKPOINT_R4_V78_CONTROL_PLANE_AUTHORITY' ? 'R4_SUCCESSOR' : 'R4';
    }
    const enumerated = new Set();
    for (const [relative, expected] of Object.entries(PARENT_MANIFESTS)) {
        const file = protectedPath(root, relative);
        assert.equal(sha256(regularBytes(file)), expected,
            `V78_PARENT_MANIFEST_INVALID:${relative}`);
        const manifest = canonicalJson(file);
        for (const relativePath of Object.keys(manifest.protectedFiles || {})) {
            enumerated.add(relativePath);
        }
    }
    assert.deepEqual([...enumerated].sort(), Object.keys(R4_HASHES).sort(),
        'V78_PARENT_PROTECTED_SET_INVALID');
    const expectedHashes = identity === 'V201'
        ? { ...R4_HASHES, ...V201_OVERRIDES }
        : identity === 'R4_SUCCESSOR'
            ? { ...R4_HASHES, ...R4_SUCCESSOR_OVERRIDES } : R4_HASHES;
    for (const [relative, expected] of Object.entries(expectedHashes)) {
        const actual = sha256(regularBytes(protectedPath(root, relative)));
        assert.equal(actual, expected, `V78_PARENT_PROTECTED_FILE_INVALID:${relative}`);
    }
    return Object.freeze({ ok: true, identity, commit, tree,
        parentManifestCount: Object.keys(PARENT_MANIFESTS).length,
        protectedFileCount: enumerated.size });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        assert.equal(process.argv.length, 3, 'V78_PARENT_USAGE_INVALID');
        const result = await assertEcBotCoreParentProtectionR4(process.argv[2]);
        process.stdout.write(`V78_PARENT_PROTECTION=PASS\nIDENTITY=${result.identity}\nPROTECTED_FILES=${result.protectedFileCount}\n`);
    } catch (error) {
        process.stderr.write(`ERRO: ${error.message}\n`);
        process.exitCode = 1;
    }
}
