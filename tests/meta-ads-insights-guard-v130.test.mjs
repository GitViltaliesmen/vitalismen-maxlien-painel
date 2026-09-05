import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { assertMetaAdsInsightsV130 } from '../scripts/guard-meta-ads-insights-v130.mjs';

test('V130 protege a integracao Meta Ads sem autorizar mutacao de anuncios ou CAPI', () => {
    const manifest = assertMetaAdsInsightsV130();
    assert.equal(manifest.status, 'implementation_validated_configuration_pending');
    assert.ok(manifest.overrides.includes('public/funnel-metrics.html'));
    assert.ok(manifest.overrides.includes('src/routes/funnelMetrics.js'));
    assert.ok(manifest.protectedFiles['src/services/metaAdsInsightsService.js']);
    const source = fs.readFileSync('src/services/metaAdsInsightsService.js', 'utf8');
    assert.match(source, /\/insights\?/);
    assert.doesNotMatch(source, /method:\s*['"]POST['"]/);
    assert.doesNotMatch(source, /campaigns.*POST|adsets.*POST|ads.*POST/);
});
