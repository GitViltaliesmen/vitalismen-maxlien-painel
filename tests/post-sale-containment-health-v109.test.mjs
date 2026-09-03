import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { assertPostSaleContainmentHealthV109Manifest } from '../src/services/postSaleContainmentHealthV109Service.js';

test('containment aguarda health V78 depois do restart antes de arquivar', () => {
    const source = fs.readFileSync('ops/post-sale-v105', 'utf8');
    const restoreIndex = source.indexOf('restore_bot_core()');
    const restartIndex = source.indexOf('restart_with_loaded_profile "$release_dir"', restoreIndex);
    const retryIndex = source.indexOf('for attempt in $(seq 1 30)', restartIndex);
    const statusIndex = source.indexOf('./ops/ec-bot-core-v78 status', retryIndex);
    const archiveIndex = source.indexOf('archive_activation_bundle', statusIndex);
    assert.ok(restoreIndex >= 0 && restartIndex > restoreIndex);
    assert.ok(retryIndex > restartIndex && statusIndex > retryIndex);
    assert.ok(archiveIndex > statusIndex);
    assert.match(source, /sleep 2/);
    assert.match(source, /return 1/);
});

test('manifesto V109 preserva lote único e efeitos externos zerados', () => {
    const result = assertPostSaleContainmentHealthV109Manifest();
    assert.equal(result.ready, true);
    assert.equal(result.manifest.policy.batchOnceMarkerPreserved, true);
    assert.equal(result.manifest.policy.externalEffectsAllowed, false);
});
