import 'dotenv/config';
import { searchDroppiEcuadorOrdersFromPanel } from '../src/services/droppiEcuadorBrowserService.js';

const args = process.argv.slice(2);
const readArg = (name, fallback = '') => {
    const index = args.indexOf(`--${name}`);
    return index === -1 ? fallback : args[index + 1] || fallback;
};

const limit = Math.max(1, Math.min(Number.parseInt(readArg('limit', '20'), 10) || 20, 100));
const optionNames = new Set(['--limit', '--terms']);
const positional = [];
for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (optionNames.has(arg)) {
        index += 1;
    } else if (!arg.startsWith('--')) {
        positional.push(arg);
    }
}
const terms = [
    ...positional,
    ...String(readArg('terms', '') || '').split(',')
]
    .map((term) => String(term || '').trim())
    .filter(Boolean);

if (!terms.length) {
    console.error('Uso: node scripts/search-dropi-panel-orders.mjs 2395 185156989 --limit 20');
    process.exit(1);
}

const result = await searchDroppiEcuadorOrdersFromPanel({ terms, limit });
console.log(JSON.stringify(result, null, 2));
