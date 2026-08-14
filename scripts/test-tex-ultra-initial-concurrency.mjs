import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
    buildTexUltraInitialSteps,
    TEX_ULTRA_INITIAL_CADENCE,
    TEX_ULTRA_INITIAL_WAVE_JOIN_MS
} from '../src/services/texUltraInitialLayerService.js';

const root = process.cwd();
const source = fs.readFileSync(path.join(root, 'src/services/texUltraInitialLayerService.js'), 'utf8');
const contactCount = 50;
const batchAnchor = new Date('2026-08-03T00:00:00.000Z');
const maximumDelay = (_minimum, maximum) => maximum;

const completions = Array.from({ length: contactCount }, (_, index) => {
    const joinOffsetMs = Math.floor((TEX_ULTRA_INITIAL_WAVE_JOIN_MS * index) / (contactCount - 1));
    const anchor = new Date(batchAnchor.getTime() + joinOffsetMs);
    const steps = buildTexUltraInitialSteps({ anchor, randomBetweenFn: maximumDelay });
    const offerAt = new Date(steps.offer.dueAt).getTime();
    return { anchor: anchor.getTime(), offerAt };
});

for (const contact of completions) {
    assert.equal(contact.offerAt - contact.anchor, 128000);
}

const batchElapsedMs = Math.max(...completions.map(({ offerAt }) => offerAt)) - batchAnchor.getTime();
const sequentialElapsedMs = contactCount * 128000;
assert.equal(batchElapsedMs, 128000 + TEX_ULTRA_INITIAL_WAVE_JOIN_MS);
assert.ok(batchElapsedMs < sequentialElapsedMs / 40);

assert.deepEqual(
    TEX_ULTRA_INITIAL_CADENCE.map(({ key }) => key),
    ['intro01', 'intro02', 'proof', 'bottle', 'offer']
);
assert.match(source, /const flowTimers = new Map\(\)/);
assert.match(source, /flowTimers\.set\(flow\.id, timers\)/);
assert.match(source, /executeScheduledStep\(\{ contactStateId, flowId: flow\.id, stepKey: definition\.key \}\)/);
assert.match(source, /const outcome = await withLayerSendQueue\(async \(\) =>/);

console.log('OK: 50 contatos mantêm cronômetros próprios; o lote conclui em até 148s teóricos, não 6.400s sequenciais.');
