import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';

const root = process.cwd();
const read = relativePath => fs.readFileSync(new URL(`../${relativePath}`, import.meta.url));
const hash = relativePath => crypto.createHash('sha256').update(read(relativePath)).digest('hex');
const canonicalStagingPreload = new URL('../scripts/lib/ec-runtime-successor-v97-context.mjs', import.meta.url).href;

test('a cadeia canônica carrega V186 antes de V168B e reproduz o guard V71 do staging', () => {
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const result = spawnSync(npm, ['run', 'guard:runtime-chain-v71'], {
        cwd: root,
        encoding: 'utf8',
        shell: true,
        env: {
            ...process.env,
            NODE_OPTIONS: `--import=${canonicalStagingPreload}`,
            V186_CANONICAL_SUCCESSOR_AUDIT: '1',
            V152_B_SHADOW_TEST_CONTEXT: 'true'
        }
    });
    const output = `${result.stdout || ''}\n${result.stderr || ''}`;
    assert.equal(result.status, 0, output);
    const contextIndex = output.indexOf('[V186] CONTEXT_LOADED_BEFORE_V168B=YES');
    const recognitionIndex = output.indexOf('[V186] V168B_PUBLIC_FUNNEL_METRICS_OVERRIDE_RECOGNIZED=YES');
    assert.notEqual(contextIndex, -1, output);
    assert.notEqual(recognitionIndex, -1, output);
    assert.ok(contextIndex < recognitionIndex, output);
    assert.doesNotMatch(output, /\[V168B preload\].*funnel-metrics/);
});

test('V186 conserva todos os arquivos congelados V185 byte a byte', () => {
    const v185 = JSON.parse(read('docs/freeze/v185-metrics-radar-readonly-20260918.json').toString('utf8'));
    for (const [file, expected] of Object.entries(v185.protectedFiles)) assert.equal(hash(file), expected, file);
});

test('V186 registra a interseção ancestral completa e explícita sem wildcard', () => {
    const manifest = JSON.parse(read('docs/freeze/ec-v185-canonical-successor-v186-20260918.json').toString('utf8'));
    assert.deepEqual(manifest.ancestorProtectedIntersection, [
        'public/funnel-metrics.html',
        'src/routes/funnelMetrics.js'
    ]);
    assert.equal(manifest.ancestorManifestScan.totalJsonFiles, 248);
    assert.equal(manifest.ancestorManifestScan.withProtectedFiles, 181);
    assert.equal(manifest.ancestorManifestScan.intersectionOccurrences, 19);
    assert.equal(manifest.overrides.some(file => /[*?\[\]]/.test(file)), false);
});

test('V186 preserva a ponte V184 e acrescenta somente a linhagem autorizada', () => {
    const source = read('scripts/lib/ec-runtime-successor-v186-context.mjs').toString('utf8');
    assert.match(source, /Object\.getOwnPropertyDescriptor\(globalThis, V170_CONTEXT_KEY\)/);
    assert.match(source, /predecessorDescriptor\.set\.call\(globalThis, value\)/);
    assert.match(source, /\.\.\.\(inherited\?\.authorizedFiles \|\| \[\]\)/);
    assert.match(source, /\.\.\.\(inherited\?\.protectedFiles \|\| \{\}\)/);
});
