import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { loadMetaAdsInsights } from '../src/services/metaAdsInsightsService.js';

for (const urlTags of ['utm_source=meta&utm_content={{ad.id}}', undefined]) {
    test(`criativo Meta preserva URL tags ${urlTags ? 'presentes' : 'ausentes'} no cache`, async (t) => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'v141-creative-read-'));
        const cacheFile = path.join(dir, 'ec.json');
        t.after(() => {
            fs.rmSync(cacheFile, { force: true });
            fs.rmdirSync(dir);
        });
        const calls = [];
        const result = await loadMetaAdsInsights({
            accountId: '123',
            env: { META_ACCESS_TOKEN: 'fixture-only' },
            now: new Date('2026-09-07T20:00:00.000Z'),
            startDay: '2026-09-06',
            endDay: '2026-09-07',
            cacheFile,
            fetchImpl: async (target, options) => {
                const url = new URL(target);
                calls.push({ url, options });
                if (url.pathname.endsWith('/insights')) {
                    return Response.json({ data: [{
                        ad_id: '456', ad_name: 'Fixture EC',
                        date_start: '2026-09-06', impressions: '10', spend: '1'
                    }] });
                }
                assert.equal(url.pathname, '/v26.0/456');
                const fields = url.searchParams.get('fields') || '';
                const adFields = fields.replace(/creative\{[^}]*\}/, 'creative').split(',');
                // Graph rejects url_tags on the Ad object; it belongs to AdCreative.
                if (adFields.includes('url_tags')) {
                    return Response.json({ error: { code: 100, message: 'Invalid Ad field' } }, { status: 400 });
                }
                const creativeFields = fields.match(/creative\{([^}]*)\}/)?.[1].split(',') || [];
                return Response.json({
                    id: '456', name: 'Fixture EC', effective_status: 'ACTIVE',
                    creative: {
                        id: '789', name: 'Fixture creative',
                        ...(creativeFields.includes('url_tags') && urlTags !== undefined ? { url_tags: urlTags } : {})
                    }
                });
            }
        });
        assert.equal(result.source, 'live');
        assert.equal(result.fetchStatus, 'ok');
        assert.equal(result.creativeMapping[0].adId, '456');
        assert.equal(result.creativeMapping[0].creativeId, '789');
        assert.equal(result.creativeMapping[0].urlTags, urlTags || '');
        assert.equal(result.creativeMapping[0].errorCode, undefined);
        const saved = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        assert.equal(saved.creativeMapping[0].urlTags, urlTags || '');
        assert.equal(calls.length, 2);
        for (const { url, options } of calls) {
            assert.equal(options.method, 'GET');
            assert.equal(options.headers.Authorization, 'Bearer fixture-only');
            assert.equal(url.href.includes('fixture-only'), false);
        }
        assert.equal(JSON.stringify(saved).includes('fixture-only'), false);
    });
}
