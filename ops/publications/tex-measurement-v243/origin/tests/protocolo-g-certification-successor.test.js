const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const hash = (relative) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, relative))).digest('hex');
const certification = require('../config/protocolo-g-certification-20260926-freeze.json');
const successor = require('../config/protocolo-g-mobile-layout-20260927-freeze.json');
const twoStep = require('../config/protocolo-g-mobile-two-step-20260927-freeze.json');
const copySuccessor = require('../config/protocolo-g-mobile-cta-copy-20260927-freeze.json');
const stageActivation = require('../config/protocolo-g-vsl-stage-install-20260927-freeze.json');
const versionBust = require('../config/protocolo-g-stage-install-url-version-20260928-freeze.json');
const v153 = require('../config/vturb-native-v153-freeze.json');

test('certification successor preserves historical freezes and current protected files', () => {
  assert.equal(certification.parentFreeze, v153.freezeId);
  assert.equal(successor.parentFreeze, certification.freezeId);
  assert.equal(successor.parentCertificationSha256, hash('config/protocolo-g-certification-20260926-freeze.json'));
  assert.equal(successor.policy.historicalFreezesImmutable, true);
  for (const [file, expected] of Object.entries(certification.historicalFreezeSha256)) {
    assert.equal(hash(file), expected, `historical freeze changed: ${file}`);
  }
  assert.equal(successor.policy.scope, 'MOBILE_LAYOUT_SPACING_ONLY');
  assert.equal(successor.policy.functionalFileChangesAuthorized, true);
  assert.equal(successor.policy.desktopLayoutUnchanged, true);
  assert.equal(twoStep.parentFreeze, successor.freezeId);
  assert.equal(twoStep.parentFreezeSha256, hash('config/protocolo-g-mobile-layout-20260927-freeze.json'));
  assert.equal(twoStep.rollback.baselineHtmlSha256, successor.protectedFiles['private/vsl/protocolo-g.html']);
  assert.equal(twoStep.runtimeContract.ctaStartSeconds, 2137);
  assert.equal(twoStep.runtimeContract.ctaTrigger, 'VTURB_CALLACTION');
  assert.equal(twoStep.policy.desktopChanged, false);
  assert.equal(twoStep.policy.playerChanged, false);
  assert.equal(twoStep.policy.trackingChanged, false);
  assert.equal(copySuccessor.parentFreeze, twoStep.freezeId);
  assert.equal(copySuccessor.parentFreezeSha256, hash('config/protocolo-g-mobile-two-step-20260927-freeze.json'));
  assert.equal(copySuccessor.policy.scope, 'MOBILE_CTA_COPY_ONLY');
  assert.equal(copySuccessor.policy.buttonTextOnly, true);
  assert.equal(copySuccessor.runtimeContract.buttonText, 'Hola, quiero el tratamiento Tex Ultra');
  assert.equal(copySuccessor.runtimeContract.ctaStartSeconds, 2137);
  assert.equal(stageActivation.parentFreeze, copySuccessor.freezeId);
  assert.equal(stageActivation.parentFreezeSha256, hash('config/protocolo-g-mobile-cta-copy-20260927-freeze.json'));
  assert.equal(stageActivation.policy.scope, 'PROTOCOLO_G_VSL_STAGE_INSTALL_ONLY');
  assert.equal(stageActivation.policy.canonicalInstallCallOnly, true);
  assert.equal(stageActivation.runtimeContract.ctaStartSeconds, 2137);
  assert.equal(stageActivation.runtimeContract.ctaTrigger, 'VTURB_CALLACTION');
  assert.equal(versionBust.parentFreeze, stageActivation.freezeId);
  assert.equal(versionBust.parentFreezeSha256, hash('config/protocolo-g-vsl-stage-install-20260927-freeze.json'));
  assert.equal(versionBust.policy.scope, 'PROTOCOLO_G_STAGE_ASSET_URL_VERSION_ONLY');
  assert.equal(versionBust.policy.htmlSrcParameterOnly, true);
  assert.equal(versionBust.runtimeContract.bridgeVersion, '20260928-stage-install-1');
  assert.equal(versionBust.runtimeContract.ctaStartSeconds, 2137);
  assert.equal(versionBust.runtimeContract.ctaTrigger, 'VTURB_CALLACTION');
  assert.equal(versionBust.validation.stagePersisted, true);
  for (const [file, expected] of Object.entries({ ...versionBust.protectedFiles, ...require('../scripts/lib/protocolo-g-baseline-reconciliation-20261117.cjs').reconcile(root).protectedFiles, ...require('../scripts/lib/tex-measurement-maintenance-v243.cjs').validate(root).protectedFiles })) assert.equal(hash(file), expected, `stage successor protected file changed: ${file}`);
  for (const [file, expected] of Object.entries({ ...versionBust.protectedFiles, ...require('../scripts/lib/protocolo-g-baseline-reconciliation-20261117.cjs').reconcile(root).protectedFiles, ...require('../scripts/lib/tex-measurement-maintenance-v243.cjs').validate(root).protectedFiles })) {
    assert.equal(hash(file), expected, `protected file changed: ${file}`);
  }
});

test('only native VTurb CTA remains, with CSP-safe legacy ID and first-party visit bridge', () => {
  const html = read('private/vsl/protocolo-g.html');
  const bridge = read('public/assets/js/meta-ec-protocolo-g-bridge.js');
  const pixel = read('public/assets/js/pixel.js');
  const route = read('routes/metaEcProtocoloGBridge.js');
  assert.equal(successor.runtimeContract.ctaStart, '35:37');
  assert.equal(successor.runtimeContract.ctaStartSeconds, 2137);
  assert.equal(successor.runtimeContract.legacyCtaId, 'preco_89');
  assert.equal(successor.runtimeContract.legacyCtaIdIsPriceRule, false);
  assert.equal(successor.runtimeContract.phone, '5531971862958');
  assert.equal(successor.runtimeContract.productKey, 'tex_ultra_ec');
  assert.equal(successor.runtimeContract.funnel, 'PROTOCOLO_G');
  assert.match(html, /function installMobileTwoStepCta/);
  assert.match(html, /ResizeObserver/);
  assert.match(html, /form\.__pgMobileVisibilityObserver\s*=\s*visibilityObserver/);
  assert.match(html, /primary\.textContent\s*=\s*'Hola, quiero el tratamiento Tex Ultra';/);
  assert.equal(copySuccessor.runtimeContract.buttonText, 'Hola, quiero el tratamiento Tex Ultra');
  assert.match(html, /primary\.scrollIntoView/);
  assert.doesNotMatch(html.slice(html.indexOf('function installMobileTwoStepCta'), html.indexOf('function withAddedLines')), /setInterval|currentTime|2137|35:37/);
  assert.match(html, /<vturb-smartplayer\s+id="ab-6a6023ffd403aabb02392eb9"/);
  assert.equal((html.match(/\/assets\/js\/meta-ec-protocolo-g-bridge\.js/g) || []).length, 1);
  assert.match(html, /meta-ec-protocolo-g-bridge\.js\?v=20260928-stage-install-1/);
  assert.match(html, /getElementById\('preco_89'\)/);
  assert.match(html, /removeAttribute\('onclick'\)/);
  assert.match(html, /addEventListener\('click'/);
  assert.doesNotMatch(html, /tracking-protocolo-g-formulario-20260815\.js|protocolo-g-early-cta|open-modal-button/);
  assert.doesNotMatch(bridge, /createEarlyCta|protocolo-g-early-cta|open-modal-button/);
  assert.match(bridge, /__META_EC_PG_API__/);
  assert.match(bridge, /\/api\/public\/meta-ec-protocolo-g\/bridge/);
  const install = bridge.slice(bridge.indexOf('  function install(rootObject)'));
  assert.equal((install.match(/installConversionStages\(rootObject\)/g) || []).length, 1);
  assert.match(bridge, /function installConversionStages\(rootObject\)/);
  assert.match(route, /router\.post\('\/bridge'/);
  assert.match(route, /router\.post\('\/stage'/);
  assert.match(pixel, /PROTOCOLO_G_CANONICAL_PIXEL_ID\s*=\s*'920532663934291'/);
  assert.match(pixel, /fbq\('trackSingle', PROTOCOLO_G_CANONICAL_PIXEL_ID/);
});
