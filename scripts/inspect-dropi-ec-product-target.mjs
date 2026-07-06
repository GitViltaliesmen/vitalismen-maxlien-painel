import 'dotenv/config';
import { inspectDroppiEcuadorProductTarget } from '../src/services/droppiEcuadorBrowserService.js';

const product = process.argv[2] || 'Nitrix';
const result = await inspectDroppiEcuadorProductTarget({ product });

console.log(JSON.stringify({
    ok: result.ok,
    target: result.target,
    matchCount: result.matchCount,
    matches: result.matches,
    sampleCards: result.sampleCards,
    url: result.url,
    bodyText: result.bodyText
}, null, 2));

