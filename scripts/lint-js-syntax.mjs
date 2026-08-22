import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const roots = ['src', 'scripts', 'tests'];
const extensions = new Set(['.js', '.mjs', '.cjs']);
const files = [];

const walk = (relativePath) => {
    const absolutePath = path.resolve(relativePath);
    if (!fs.existsSync(absolutePath)) return;
    for (const entry of fs.readdirSync(absolutePath, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        const childRelativePath = path.join(relativePath, entry.name);
        if (entry.isDirectory()) {
            walk(childRelativePath);
        } else if (extensions.has(path.extname(entry.name).toLowerCase())) {
            files.push(childRelativePath);
        }
    }
};

roots.forEach(walk);
files.sort((left, right) => left.localeCompare(right));

const failures = [];
for (const file of files) {
    const result = spawnSync(process.execPath, ['--check', file], {
        cwd: process.cwd(),
        encoding: 'utf8'
    });
    if (result.status !== 0) {
        failures.push({
            file,
            output: `${result.stdout || ''}${result.stderr || ''}`.trim()
        });
    }
}

if (failures.length) {
    console.error(`LINT_JS_SYNTAX=FAIL files=${failures.length}/${files.length}`);
    for (const failure of failures) {
        console.error(`\n${failure.file}\n${failure.output}`);
    }
    process.exit(1);
}

console.log(`LINT_JS_SYNTAX=OK files=${files.length}`);
