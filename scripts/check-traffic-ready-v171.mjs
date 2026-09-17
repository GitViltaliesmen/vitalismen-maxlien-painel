import fs from 'node:fs';
import { evaluateTrafficReadinessV171 } from '../src/services/trafficReadinessV171Service.js';

const valueAfter = (flag) => {
    const index = process.argv.indexOf(flag);
    return index >= 0 ? process.argv[index + 1] : '';
};
const readJson = (file, label) => {
    if (!file) throw new Error(`${label}_FILE_REQUIRED`);
    return JSON.parse(fs.readFileSync(file, 'utf8'));
};

const result = evaluateTrafficReadinessV171({
    health: readJson(valueAfter('--health'), 'HEALTH'),
    vslEntry: readJson(valueAfter('--vsl-entry'), 'VSL_ENTRY'),
    panelPass: valueAfter('--panel') === 'PASS',
    authPass: valueAfter('--auth') === 'PASS'
});
console.log(`TRAFFIC_READY=${result.status}`);
console.log(`TRAFFIC_READY_REASONS=${result.reasons.join(',') || 'none'}`);
if (!result.ready) process.exitCode = 1;

