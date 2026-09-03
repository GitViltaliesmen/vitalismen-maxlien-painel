import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    assertModernReleaseSourceValidationV103,
    MODERN_RELEASE_SOURCE_VALIDATION_V103_OVERRIDE_KEY
} from '../src/services/modernReleaseSourceValidationV103Service.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const helper = fs.readFileSync(path.join(root, 'ops', 'vitalismen-stage'), 'utf8');
const start = helper.indexOf('detect_source_process_state()');
const end = helper.indexOf('\nvalidate_successor_release()', start);
const block = helper.slice(start, end);
const modernStart = block.indexOf('if [[ -f "$source_current/.release-source.json"');
const modernEnd = block.indexOf('return 0', modernStart);
const modern = block.slice(modernStart, modernEnd);

test('V103 valida release moderna ativa pelas attestations sem exigir diretório Git', () => {
    assert.match(modern, /validate_successor_release "\$source_current" "\$source_release_name"/);
    assert.doesNotMatch(modern, /git_cmd[^\n]+source_current[^\n]+rev-parse/);
    assert.match(modern, /source_provenance_commit="\$candidate_commit"/);
    assert.match(modern, /source_provenance_tree="\$candidate_tree"/);
});

test('V103 exige publicação válida e mantém metadata moderna fail-closed', () => {
    assert.match(modern, /candidate_publication_status/);
    assert.match(modern, /production_published/);
    assert.match(helper, /release-source ausente/);
    assert.match(helper, /envelope de publicação parcial/);
    assert.match(helper, /tag remota não aponta para o functionalCommit/);
});

test('V103 preserva integralmente o caminho LEGACY_BASELINE_VERIFIED da V102', () => {
    assert.match(block, /validate_legacy_baseline_attestation_live/);
    assert.match(block, /source_provenance_type="LEGACY_BASELINE_VERIFIED"/);
    globalThis[MODERN_RELEASE_SOURCE_VALIDATION_V103_OVERRIDE_KEY] = ['ops/vitalismen-stage'];
    const result = assertModernReleaseSourceValidationV103();
    assert.equal(result.ready, true);
});
