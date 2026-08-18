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
assert.deepEqual(offsetsFrom(minimumSteps), [2000, 6000, 27000, 55000, 90000]);

const maximumSteps = buildTexUltraInitialSteps({
    anchor,
    randomBetweenFn: (_minimum, maximum) => maximum
});
assert.deepEqual(offsetsFrom(maximumSteps), [6000, 14000, 39000, 72000, 112000]);

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
    previous: { greeting: { sentAt: '2026-08-01T23:59:00.000Z' } },
    randomBetweenFn: (minimum) => minimum
});
assert.equal(resumed.greeting.sentAt, '2026-08-01T23:59:00.000Z');
assert.deepEqual(offsetsFrom(resumed).slice(1), [4000, 25000, 53000, 88000]);

console.log('OK: cadencia inicial Tex Ultra envia texto e um unico audio antes das demais etapas (90-112s).');
