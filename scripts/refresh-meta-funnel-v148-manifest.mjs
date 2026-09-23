import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const changed = execFileSync('git', ['diff', '--name-only', 'f7927a9a8720d64f3c8ba5f02dcd290f2774f08f'], { encoding: 'utf8' }).trim().split(/\r?\n/);
const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { encoding: 'utf8' }).trim().split(/\r?\n/);
const files = [...new Set([...changed, ...untracked])].filter(f => /^(src|scripts)\//.test(f) || f === 'package.json').sort();
const parent = JSON.parse(fs.readFileSync('docs/freeze/ec-all-postsale-dedupe-v147-r6r2-20260910.json'));
const preserved = Object.keys({ ...parent.preservedFiles, ...parent.protectedFiles }).filter(f => !files.includes(f));
const manifest = { freezeId: 'EC_META_FUNNEL_V148_20260910', parentCommit: 'f7927a9a8720d64f3c8ba5f02dcd290f2774f08f',
    parentTree: '0bfa0d9e298045764dad86ec3096186d6880daba', policy: { publicationAllowed: false, metaRetroactive: false,
        productionChanged: false, realMetaEvents: 0, postSaleChanged: false }, overrides: files,
    protectedFiles: Object.fromEntries(files.map(f => [f, hash(f)])),
    preservedFiles: Object.fromEntries(preserved.sort().map(f => [f, hash(f)])) };
fs.writeFileSync('docs/freeze/ec-meta-funnel-v148-20260910.json', JSON.stringify(manifest, null, 2) + '\n');
