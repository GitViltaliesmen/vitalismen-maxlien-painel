import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

let parentURL, readerURL, browserURL;
export function initialize({ root, reconcilerSha256, readerSha256 }) {
    const digest = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    const parent = root + '/src/services/postSaleDropiTrackingReconcilerV194Service.js';
    const reader = root + '/src/services/postSaleDropiReadOnlyV210Service.js';
    assert.equal(digest(parent), reconcilerSha256, 'EC_POSTSALE_FROZEN_RECONCILER_CHANGED');
    assert.equal(digest(reader), readerSha256, 'EC_POSTSALE_SEALED_READER_CHANGED');
    parentURL = pathToFileURL(parent).href;
    readerURL = pathToFileURL(reader).href;
    browserURL = pathToFileURL(root + '/src/services/droppiEcuadorBrowserService.js').href;
}
export async function resolve(specifier, context, nextResolve) {
    const result = await nextResolve(specifier, context);
    // One dependency edge only. All other browser imports and V75 guards remain intact.
    if (context.parentURL === parentURL && result.url === browserURL) return { ...result, url: readerURL };
    return result;
}
