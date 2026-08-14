const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const release = JSON.parse(fs.readFileSync(path.join(root, 'release.json'), 'utf8'));
const html = fs.readFileSync(path.join(root, 'sidepanel.html'), 'utf8');
const launcher = fs.readFileSync(path.join(root, 'whatsapp-funnel-launcher.js'), 'utf8');

assert.equal(release.version, manifest.version);
assert.match(html, new RegExp(`Extensão v${manifest.version.replaceAll('.', '\\.')}`));
assert.match(launcher, new RegExp(`INSTALL_VERSION = '${manifest.version.replaceAll('.', '\\.')}';`));
assert.match(launcher, new RegExp(`data-toolbar-version="${manifest.version.replaceAll('.', '\\.')}"`, 'g'));
assert.ok(
    html.indexOf('customer-data-normalizer.js') < html.indexOf('conversation-data-extractor.js'),
    'o normalizador deve carregar antes do extrator'
);
assert.ok(
    html.indexOf('customer-data-normalizer.js') < html.indexOf('agency-catalog.js'),
    'o normalizador deve carregar antes do catálogo de agências'
);

console.log('extension release integrity: ok');
