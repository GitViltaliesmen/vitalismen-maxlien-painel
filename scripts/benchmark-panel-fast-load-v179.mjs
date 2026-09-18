import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

import { projectPanelCustomerReadModel } from '../src/services/panelCustomerReadModelService.js';

const recordCount = 219;
const states = Array.from({ length: recordCount }, (_, index) => ({
    countryCode: 'EC',
    phoneDigits: `59399${String(index).padStart(7, '0')}`,
    metadata: {
        customerDraft: {
            name: `Cliente QA ${index}`,
            phone: `+59399${String(index).padStart(7, '0')}`,
            country: 'EC',
            city: 'Quito',
            province: 'Pichincha',
            address: `Calle QA ${index}`,
            reference: 'Casa azul',
            deliveryMode: 'home',
            agencyName: `Agencia QA ${index}`,
            status: 'novo',
            flowDataOk: {
                name: true,
                phone: true,
                city: true,
                province: true,
                address: true
            }
        }
    }
}));

const project = (includeCustomerDataResolution) => {
    const startedAt = performance.now();
    const output = states.map((contactState) => projectPanelCustomerReadModel({
        contactState,
        fallbackPhone: contactState.phoneDigits,
        includeCustomerDataResolution
    }));
    return {
        elapsedMs: Number((performance.now() - startedAt).toFixed(2)),
        bytes: Buffer.byteLength(JSON.stringify(output)),
        detailedRecords: output.filter((item) => item.customerDataResolution).length
    };
};

const detailed = project(true);
const fast = project(false);
const payloadReductionPercent = Number(((1 - fast.bytes / detailed.bytes) * 100).toFixed(1));
const measuredTimeReductionPercent = Number(((1 - fast.elapsedMs / detailed.elapsedMs) * 100).toFixed(1));

assert.equal(detailed.detailedRecords, recordCount);
assert.equal(fast.detailedRecords, 0);
assert.ok(fast.bytes < detailed.bytes * 0.5, `fast_payload_not_reduced:${fast.bytes}/${detailed.bytes}`);

console.log(`V179_BENCHMARK_RECORDS=${recordCount}`);
console.log(`V179_DETAILED_MS=${detailed.elapsedMs}`);
console.log(`V179_FAST_MS=${fast.elapsedMs}`);
console.log(`V179_DETAILED_BYTES=${detailed.bytes}`);
console.log(`V179_FAST_BYTES=${fast.bytes}`);
console.log(`V179_MEASURED_TIME_REDUCTION_PERCENT=${measuredTimeReductionPercent}`);
console.log(`V179_PAYLOAD_REDUCTION_PERCENT=${payloadReductionPercent}`);
console.log('V179_SYNTHETIC_BENCHMARK=PASS');
