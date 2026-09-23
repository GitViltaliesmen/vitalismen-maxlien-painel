import 'dotenv/config';

import { loadMetaAdsInsights } from '../src/services/metaAdsInsightsService.js';

const days = Math.min(90, Math.max(1, Number.parseInt(
    process.env.META_ADS_INSIGHTS_REFRESH_DAYS_EC || '7',
    10
) || 7));

const result = await loadMetaAdsInsights({ days, now: new Date() });
const safe = {
    version: 'V141',
    status: result.status,
    source: result.source,
    fetchStatus: result.fetchStatus,
    stale: result.stale,
    startDay: result.startDay || '',
    endDay: result.endDay || '',
    dataThrough: result.dataThrough || '',
    fetchedAt: result.fetchedAt || null,
    lastSuccessAt: result.lastSuccessAt || null,
    lastError: result.lastError || (result.errorCode ? { code: result.errorCode } : null),
    rowCount: Array.isArray(result.rows) ? result.rows.length : 0,
    adCount: Array.isArray(result.ads) ? result.ads.length : 0
};

process.stdout.write(`${JSON.stringify(safe)}\n`);
if (result.fetchStatus !== 'ok' || result.stale === true || result.status !== 'available') {
    process.exitCode = 1;
}

