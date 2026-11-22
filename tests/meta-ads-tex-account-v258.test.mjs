import test from 'node:test';
import assert from 'node:assert/strict';
import { loadMetaAdsInsights } from '../src/services/metaAdsInsightsService.js';

test('Tex account fails closed when its scoped ads_read token is absent', async () => {
    let calls = 0;
    const result = await loadMetaAdsInsights({
        now: new Date('2026-11-22T03:00:00Z'),
        accountId: '1088255310505694',
        accountName: 'MANUELA_SANTOS_LATAM_CO',
        token: '',
        env: { META_ACCESS_TOKEN: 'other-site-token' },
        cacheFile: 'C:/no-such-vitalismen-tex-cache.json',
        fetchImpl: async () => { calls += 1; throw Error('must not use other token'); }
    });
    assert.equal(result.status, 'unavailable');
    assert.equal(result.errorCode, 'META_ADS_ACCESS_TOKEN_EC_MISSING');
    assert.equal(calls, 0);
});
