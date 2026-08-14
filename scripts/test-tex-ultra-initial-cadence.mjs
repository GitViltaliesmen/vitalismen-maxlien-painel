import assert from 'node:assert/strict';
import {
    buildTexUltraInitialSteps,
    TEX_ULTRA_INITIAL_CADENCE
} from '../src/services/texUltraInitialLayerService.js';

const anchor = new Date('2026-08-02T00:00:00.000Z');
const offsetsFrom = (steps) => TEX_ULTRA_INITIAL_CADENCE.map(({ key }) => (
    new Date(steps[key].dueAt).getTime() - anchor.getTime()
));

const minimumSteps = buildTexUltraInitialSteps({
    anchor,
    randomBetweenFn: (minimum) => minimum
});
assert.deepEqual(offsetsFrom(minimumSteps), [2000, 13000, 34000, 62000, 97000]);

const maximumSteps = buildTexUltraInitialSteps({
    anchor,
    randomBetweenFn: (_minimum, maximum) => maximum
});
assert.deepEqual(offsetsFrom(maximumSteps), [10000, 30000, 55000, 88000, 128000]);

for (const steps of [minimumSteps, maximumSteps]) {
    let previousDueAt = anchor.getTime();
    for (const { key } of TEX_ULTRA_INITIAL_CADENCE) {
        const step = steps[key];
        const dueAt = new Date(step.dueAt).getTime();
        assert.equal(step.timingMode, 'cumulative_between_steps');
        assert.equal(dueAt - previousDueAt, step.delayMs);
        previousDueAt = dueAt;
    }
}

const resumed = buildTexUltraInitialSteps({
    anchor,
    previous: { intro01: { sentAt: '2026-08-01T23:59:00.000Z' } },
    randomBetweenFn: (minimum) => minimum
});
assert.equal(resumed.intro01.sentAt, '2026-08-01T23:59:00.000Z');
assert.deepEqual(offsetsFrom(resumed).slice(1), [11000, 32000, 60000, 95000]);

console.log('OK: cadencia inicial Tex Ultra usa intervalos cumulativos entre etapas (97-128s).');
