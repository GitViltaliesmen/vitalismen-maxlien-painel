import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import test from 'node:test';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
const legacyPreload = new URL('../scripts/lib/ec-runtime-successor-v97-context.mjs', import.meta.url).href;
const successorPreload = new URL('../scripts/lib/ec-runtime-successor-v199-context.mjs', import.meta.url).href;

test('o preload canônico registra V184 antes do runtime guard V51', () => {
    assert.equal(globalThis.__VITALISMEN_V199_EC_BOT_CORE_HEALTH_META_CONTEXT?.loaded, true);
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const runWithPreload = (preload) => spawnSync(npm, ['run', 'guard:runtime-chain-v71'], {
        cwd: root,
        encoding: 'utf8',
        shell: true,
        env: {
            ...process.env,
            NODE_OPTIONS: `--import=${preload}`,
            V184_CANONICAL_SUCCESSOR_AUDIT: '1',
            V152_B_SHADOW_TEST_CONTEXT: 'true'
        }
    });
    const legacy = runWithPreload(legacyPreload);
    assert.notEqual(legacy.status, 0, 'V97 ancestral não pode aprovar o hash V195 sem contexto sucessor');
    assert.match(`${legacy.stdout || ''}\n${legacy.stderr || ''}`,
        /\[V184\/V193\] v183_file_invalid:scripts\/lib\/ec-runtime-successor-v170-context\.mjs/);

    const result = runWithPreload(successorPreload);
    const output = `${result.stdout || ''}\n${result.stderr || ''}`;
    assert.equal(result.status, 0, output);
    const contextIndex = output.indexOf('[V184] CONTEXT_LOADED_BEFORE_V51=YES');
    const v51Index = output.indexOf('[PANEL-CUSTOMER-SELECTION-V51] geração da seleção');
    assert.notEqual(contextIndex, -1, output);
    assert.notEqual(v51Index, -1, output);
    assert.ok(contextIndex < v51Index, output);
    assert.doesNotMatch(output, /alteração não autorizada/);
});

test('V184 preserva byte a byte os arquivos funcionais V183', () => {
    const manifest = JSON.parse(read('docs/freeze/ec-v181-v183-canonical-successor-v184-20260918.json'));
    const functional = new Set(['public/qr.html', 'src/routes/shipments.js', 'src/services/servientregaEcuadorAgencyService.js']);
    for (const file of functional) assert.equal(manifest.v183FunctionalFileHashes[file], manifest.protectedFiles[file]);
    assert.equal(manifest.policy.functionalCodeChanged, false);
});

test('V184 enumera a interseção ancestral sem wildcard', () => {
    const manifest = JSON.parse(read('docs/freeze/ec-v181-v183-canonical-successor-v184-20260918.json'));
    assert.deepEqual(manifest.v179ToV183AncestorIntersection, [
        'public/qr.html',
        'scripts/lib/ec-runtime-successor-v170-context.mjs',
        'scripts/test-panel-customer-selection-browser-v51.mjs',
        'src/routes/shipments.js',
        'src/services/servientregaEcuadorAgencyService.js'
    ]);
    assert.equal(manifest.overrides.some((file) => /[*?\[\]]/.test(file)), false);
    assert.equal(manifest.declaredAncestorOverrides.includes('scripts/lib/ec-runtime-successor-v144-bootstrap-context.mjs'), true);
});
