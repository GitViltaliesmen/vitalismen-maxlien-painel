import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
    R5_CONTROL_PATHS,
    R5_PARENT_COMMIT,
    R5_PARENT_TREE,
    R5_PARENT_CHECKPOINT_SHA256,
    R5_PARENT_RELEASE,
    R5_ROLLBACK_BUNDLE_HASHES,
    readR5Manifest,
    validateR5Manifest,
    validateR5Checkpoint
} from '../scripts/lib/unified-successor-v202-r5-authority.mjs';

const manifestFile = readR5Manifest();
const manifest = manifestFile.value;
const checkpoint = {
    checkpointId: 'CHECKPOINT_R5_TEX_ULTRA_LOCALITY_ANTIREPEAT_AUTHORITY',
    status: 'FROZEN',
    parentCheckpointId: 'CHECKPOINT_R4_V78_CONTROLLER_PIN_AUTHORITY',
    parentCheckpointSha256: R5_PARENT_CHECKPOINT_SHA256,
    parentCommit: R5_PARENT_COMMIT,
    parentTree: R5_PARENT_TREE,
    project: 'MAXLIEN EC - VITALISMEN OFICIAL',
    commit: 'a'.repeat(40),
    tree: 'b'.repeat(40),
    manifestSha256: manifestFile.sha256,
    controlHashes: Object.fromEntries(R5_CONTROL_PATHS.map((file) => [file, 'c'.repeat(64)])),
    functionalHashes: manifest.functionalFiles,
    regressionHashes: manifest.regressionFiles,
    rollbackRelease: R5_PARENT_RELEASE,
    rollbackBundleHashes: R5_ROLLBACK_BUNDLE_HASHES
};
const clone = (value) => structuredClone(value);

test('R5 exige pai R4 exato, somente dois patches e testes pinados', () => {
    assert.equal(validateR5Manifest(clone(manifest)).version, 'V202-R5');
    assert.equal(Object.keys(manifest.functionalFiles).length, 2);
    assert.equal(Object.keys(manifest.regressionFiles).length, 2);
    assert.ok(manifest.allowedDeltaPaths.includes('ops/vitalismen-stage'));
    assert.ok(manifest.allowedDeltaPaths.includes('src/services/ecBotCoreOperationalV78Service.js'));
});

test('R5 falha fechado para ampliação de diff ou troca de hash funcional', () => {
    const broadened = clone(manifest);
    broadened.allowedDeltaPaths.push('src/routes/zapi.js');
    assert.throws(() => validateR5Manifest(broadened), /R5_DELTA_NOT_SORTED|R5_DELTA/);
    const changedPatch = clone(manifest);
    changedPatch.functionalFiles['src/whatsapp/sendText.js'] = '0'.repeat(64);
    assert.throws(() => validateR5Manifest(changedPatch));
});

test('checkpoint R5 exige pai imutável, controles exatos e rollback fe32da0', () => {
    assert.equal(validateR5Checkpoint(clone(checkpoint), manifestFile.sha256).status, 'FROZEN');
    for (const change of [
        (value) => { value.parentCheckpointSha256 = '0'.repeat(64); },
        (value) => { value.commit = R5_PARENT_COMMIT; },
        (value) => { value.controlHashes['ops/vitalismen-stage'] = '0'; },
        (value) => { value.rollbackRelease = 'other'; }
    ]) {
        const invalid = clone(checkpoint);
        change(invalid);
        assert.throws(() => validateR5Checkpoint(invalid, manifestFile.sha256));
    }
});

test('sucessor V71 executa predeploy da candidata R5 com preload atestado', () => {
    const helper = fs.readFileSync(new URL('../ops/vitalismen-stage', import.meta.url), 'utf8');
    const r5 = helper.split('elif [[ "$release_guard_node_options" == *unified-successor-v202-r5-preload.mjs ]]; then')[1]
        .split('\nelse\n')[0];
    assert.ok(r5.includes('successor_guard_node_options "$current_before"'));
    assert.ok(r5.includes('R5 exige a release R4 fe32da0 exata'));
    assert.match(r5, /predeploy_command=\("\$env_cmd" -C "\$release_dir"\s+npm_config_node_options="\$release_guard_node_options"\s+"\$npm_cmd" run guard:predeploy-v71\)/);
    assert.doesNotMatch(r5, /predeploy_command=\("\$env_cmd" -C "\$current_before"/);
});

test('R5 sucede somente helper e shipments com identidades exatas no staging', () => {
    const helper = fs.readFileSync(new URL('../ops/vitalismen-stage', import.meta.url), 'utf8');
    const preload = fs.readFileSync(new URL('../scripts/lib/unified-successor-v202-r5-preload.mjs', import.meta.url), 'utf8');
    const successor = fs.readFileSync(new URL('../scripts/lib/unified-successor-v202-r5-predeploy-v71-context.mjs', import.meta.url), 'utf8');
    assert.ok(manifest.allowedDeltaPaths.includes('scripts/lib/unified-successor-v202-r5-predeploy-v71-context.mjs'));
    assert.ok(R5_CONTROL_PATHS.includes('scripts/lib/unified-successor-v202-r5-predeploy-v71-context.mjs'));
    assert.match(helper, /target_node_options="--import=file:\/\/\/opt\/vitalismen-automacao\/current\/scripts\/lib\/ec-runtime-successor-v97-context\.mjs"/);
    assert.match(helper, /target_node_options="--import=file:\/\/\/opt\/vitalismen-automacao\/current\/\$target_preload_relative"/);
    assert.match(preload, /realpathSync\('\/opt\/vitalismen-automacao\/current'\) !== root/);
    assert.match(successor, /803481d66f89b235e3d1451050dfe3d64764389f14aa6596bba65cf381e18f99/);
    assert.match(successor, /7d1f8c4737d36a97ec7c6ec8dc7d0881387f4a18ea999928891d6090bf71c5f0/);
    assert.match(successor, /1be80bc61829c56060fd67d1c7248068983a7ac7ddd1d61b2b9e371bdbe49af0/);
    assert.match(successor, /c083862ea7123d854fd7260375632d1f4535451b26a53f1e9edf38d7b6ab0ef8/);
});
