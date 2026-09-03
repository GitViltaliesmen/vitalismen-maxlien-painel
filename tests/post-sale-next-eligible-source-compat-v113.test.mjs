import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

import {
    normalizeModernReleaseSourceV113,
    assertPostSaleNextEligibleSourceCompatibilityV113Manifest
} from '../src/services/postSaleNextEligibleSourceCompatibilityV113Service.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tree = '1c6639ced97dfce384c765a0d80432da84822367';

await import('../scripts/lib/ec-runtime-successor-v97-context.mjs');

test('V113 aliases functionalTree only when legacy tree is absent', () => {
    const modern = { commit: '86e4b14052b5e41360dab84be25c09df450733c8', functionalTree: tree };
    const adapted = normalizeModernReleaseSourceV113(modern);
    assert.equal(adapted.tree, tree);
    assert.equal(Object.hasOwn(modern, 'tree'), false);

    const legacy = { functionalTree: tree, tree: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' };
    assert.equal(normalizeModernReleaseSourceV113(legacy), legacy);
    const invalid = { functionalTree: 'invalid' };
    assert.equal(normalizeModernReleaseSourceV113(invalid), invalid);
});

test('V113 preload adapts a real filesystem read without writing metadata', () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'vitalismen-v113-'));
    const file = path.join(temp, '.release-source.json');
    const source = { commit: '86e4b14052b5e41360dab84be25c09df450733c8', functionalTree: tree };
    const original = `${JSON.stringify(source, null, 2)}\n`;
    fs.writeFileSync(file, original);
    try {
        const script = 'const fs=require("node:fs");const x=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(x.tree||"")';
        const output = execFileSync(process.execPath, [
            `--import=${pathToFileURL(path.join(root, 'scripts/lib/post-sale-next-eligible-source-compat-v113.mjs')).href}`,
            '-e', script, file
        ], { cwd: root, encoding: 'utf8' });
        assert.equal(output, tree);
        assert.equal(fs.readFileSync(file, 'utf8'), original);
    } finally {
        fs.rmSync(temp, { recursive: true, force: true });
    }
});

test('V113 manifest preserves V112 and freezes only additive compatibility files', () => {
    const result = assertPostSaleNextEligibleSourceCompatibilityV113Manifest();
    assert.equal(result.ready, true);
    assert.deepEqual(result.manifest.declaredAncestorOverrides, []);
    assert.deepEqual(result.manifest.modifiedAncestorProtectedFiles, []);
    assert.equal(result.manifest.policy.metadataWrites, 0);
    assert.equal(result.manifest.policy.batchMax, 1);
    assert.equal(result.manifest.policy.promoteBeyondOne, false);
});
