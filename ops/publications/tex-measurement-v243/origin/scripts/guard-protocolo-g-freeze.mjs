#!/usr/bin/env node
import { createRequire } from 'node:module';

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(rootDir, relative), 'utf8'));
const manifest = readJson('config/protocolo-g-freeze.json');
const v148 = readJson('config/meta-funnel-v148-freeze.json');
const v150 = readJson('config/meta-funnel-v150-r5-freeze.json');
const v151 = readJson('config/whatsapp-v151-r2-freeze.json');
const v152 = readJson('config/vturb-native-v152-freeze.json');
const v153 = readJson('config/vturb-native-v153-freeze.json');
const certification = readJson('config/protocolo-g-certification-20260926-freeze.json');
const mobileLayoutSuccessor = readJson('config/protocolo-g-mobile-layout-20260927-freeze.json');
const mobileTwoStepSuccessor = readJson('config/protocolo-g-mobile-two-step-20260927-freeze.json');
const mobileCtaCopySuccessor = readJson('config/protocolo-g-mobile-cta-copy-20260927-freeze.json');
const stageActivationSuccessor = readJson('config/protocolo-g-vsl-stage-install-20260927-freeze.json');
const versionBustSuccessor = readJson('config/protocolo-g-stage-install-url-version-20260928-freeze.json');

if (v148.parentFreeze !== manifest.freezeId || v148.policy.publicationAllowed !== false) {
  throw new Error('Invalid V148 successor');
}
if (v150.parentFreeze !== v148.freezeId || v150.policy.publicationAllowed !== false) {
  throw new Error('Invalid V150-R5 successor chain');
}
if (v150.parentCandidate?.commit !== '058b1d05759ff9979cb0b34a1113fbc8f97e4961'
    || v150.parentCandidate?.tree !== '82c169feb6099e8e24f74199e57894bd49a3f7e2') {
  throw new Error('Invalid V150-R4 parent identity');
}
if (v151.parentFreeze !== v150.freezeId
    || v151.oldPhone !== '5515991418416'
    || v151.newPhone !== '5531971862958'
    || v151.policy?.publicationAllowed !== true
    || v151.policy?.pixelChanged !== false
    || v151.policy?.vturbChanged !== false
    || v151.policy?.attributionLogicChanged !== false) {
  throw new Error('Invalid V151-R2 WhatsApp successor');
}
if (v152.parentFreeze !== v151.freezeId
    || v152.officialUrl !== 'https://vilaliemen.shop/protocolo-g'
    || v152.policy?.publicationAllowed !== true
    || v152.policy?.checkoutOwner !== 'VTURB_NATIVE'
    || v152.policy?.vturbPlayerChanged !== false
    || v152.policy?.pixelChanged !== false
    || v152.policy?.customProgressStagesLoaded !== false
    || v152.policy?.customCheckoutInterceptorLoaded !== false) {
  throw new Error('Invalid V152 VTurb native successor');
}
if (v153.parentFreeze !== v152.freezeId
    || v153.officialUrl !== 'https://vilaliemen.shop/protocolo-g'
    || v153.policy?.publicationAllowed !== true
    || v153.policy?.checkoutOwner !== 'VTURB_NATIVE'
    || v153.policy?.abTestPreserved !== true
    || v153.policy?.vslHtmlChanged !== false
    || v153.policy?.videoChanged !== false
    || v153.policy?.playerIdChanged !== false
    || v153.policy?.pixelChanged !== false
    || v153.runtimeContract?.playerId !== 'ab-6a6023ffd403aabb02392eb9'
    || v153.runtimeContract?.videoId !== '6a6020a20dd89f38387b2d51'
    || v153.runtimeContract?.ctaStart !== '35:37'
    || v153.runtimeContract?.phone !== '5531971862958'
    || v153.runtimeContract?.message !== 'Hola, quiero el tratamiento Tex Ultra.'
    || v153.runtimeContract?.targetUrl !== 'https://wa.me/5531971862958?text=Hola%2C%20quiero%20el%20tratamiento%20Tex%20Ultra.'
    || v153.runtimeContract?.oldPhoneReferenceInActiveCta !== 0
    || v153.runtimeContract?.trustedClickVerified !== true
    || v153.runtimeContract?.externalNavigationAborted !== true
    || v153.runtimeContract?.whatsappMessageSent !== false) {
  throw new Error('Invalid V153 VTurb native CTA successor');
}
if (certification.parentFreeze !== v153.freezeId
    || certification.policy?.historicalFreezesImmutable !== true
    || certification.policy?.ctaSource !== 'VTURB_ONLY'
    || certification.policy?.secondaryCtaAllowed !== false
    || certification.policy?.firstPartyBridgeRequired !== true
    || certification.runtimeContract?.ctaStart !== '35:37'
    || certification.runtimeContract?.ctaStartSeconds !== 2137
    || certification.runtimeContract?.phone !== '5531971862958'
    || certification.runtimeContract?.productKey !== 'tex_ultra_ec'
    || certification.runtimeContract?.funnel !== 'PROTOCOLO_G') {
  throw new Error('Invalid Protocolo G certification successor');
}
if (mobileLayoutSuccessor.parentFreeze !== certification.freezeId
    || mobileLayoutSuccessor.parentCertificationSha256 !== sha256(path.join(rootDir, 'config/protocolo-g-certification-20260926-freeze.json'))
    || mobileLayoutSuccessor.policy?.scope !== 'MOBILE_LAYOUT_SPACING_ONLY'
    || mobileLayoutSuccessor.policy?.functionalFileChangesAuthorized !== true
    || mobileLayoutSuccessor.policy?.desktopLayoutUnchanged !== true
    || mobileLayoutSuccessor.runtimeContract?.ctaStart !== certification.runtimeContract.ctaStart
    || mobileLayoutSuccessor.runtimeContract?.ctaStartSeconds !== certification.runtimeContract.ctaStartSeconds
    || mobileLayoutSuccessor.runtimeContract?.playerId !== certification.runtimeContract.playerId) {
  throw new Error('Invalid Protocolo G mobile layout successor');
}
if (mobileTwoStepSuccessor.parentFreeze !== mobileLayoutSuccessor.freezeId
    || mobileTwoStepSuccessor.parentFreezeSha256 !== sha256(path.join(rootDir, 'config/protocolo-g-mobile-layout-20260927-freeze.json'))
    || mobileTwoStepSuccessor.policy?.scope !== 'MOBILE_TWO_STEP_CTA'
    || mobileTwoStepSuccessor.policy?.ctaSource !== 'VTURB_ONLY'
    || mobileTwoStepSuccessor.policy?.playerChanged !== false
    || mobileTwoStepSuccessor.policy?.desktopChanged !== false
    || mobileTwoStepSuccessor.policy?.trackingChanged !== false
    || mobileTwoStepSuccessor.runtimeContract?.ctaStartSeconds !== 2137
    || mobileTwoStepSuccessor.runtimeContract?.ctaTrigger !== 'VTURB_CALLACTION'
    || mobileTwoStepSuccessor.runtimeContract?.playerId !== mobileLayoutSuccessor.runtimeContract.playerId) {
  throw new Error('Invalid Protocolo G mobile two-step successor');
}
if (mobileCtaCopySuccessor.parentFreeze !== mobileTwoStepSuccessor.freezeId
    || mobileCtaCopySuccessor.parentFreezeSha256 !== sha256(path.join(rootDir, 'config/protocolo-g-mobile-two-step-20260927-freeze.json'))
    || mobileCtaCopySuccessor.policy?.scope !== 'MOBILE_CTA_COPY_ONLY'
    || mobileCtaCopySuccessor.policy?.buttonTextOnly !== true
    || mobileCtaCopySuccessor.runtimeContract?.buttonText !== 'Hola, quiero el tratamiento Tex Ultra'
    || mobileCtaCopySuccessor.runtimeContract?.ctaStartSeconds !== 2137
    || mobileCtaCopySuccessor.runtimeContract?.ctaTrigger !== 'VTURB_CALLACTION'
    || mobileCtaCopySuccessor.runtimeContract?.formReveal !== mobileTwoStepSuccessor.runtimeContract.formReveal) {
  throw new Error('Invalid Protocolo G mobile CTA copy successor');
}
if (stageActivationSuccessor.parentFreeze !== mobileCtaCopySuccessor.freezeId
    || stageActivationSuccessor.parentFreezeSha256 !== sha256(path.join(rootDir, 'config/protocolo-g-mobile-cta-copy-20260927-freeze.json'))
    || stageActivationSuccessor.policy?.scope !== 'PROTOCOLO_G_VSL_STAGE_INSTALL_ONLY'
    || stageActivationSuccessor.policy?.canonicalInstallCallOnly !== true
    || stageActivationSuccessor.runtimeContract?.ctaStartSeconds !== 2137
    || stageActivationSuccessor.runtimeContract?.ctaTrigger !== 'VTURB_CALLACTION'
    || stageActivationSuccessor.policy?.botChanged !== false
    || stageActivationSuccessor.policy?.zapiChanged !== false
    || stageActivationSuccessor.policy?.vslCtaChanged !== false) {
  throw new Error('Invalid Protocolo G VSL stage install successor');
}
if (versionBustSuccessor.parentFreeze !== stageActivationSuccessor.freezeId
    || versionBustSuccessor.parentFreezeSha256 !== sha256(path.join(rootDir, 'config/protocolo-g-vsl-stage-install-20260927-freeze.json'))
    || versionBustSuccessor.policy?.scope !== 'PROTOCOLO_G_STAGE_ASSET_URL_VERSION_ONLY'
    || versionBustSuccessor.policy?.htmlSrcParameterOnly !== true
    || versionBustSuccessor.runtimeContract?.ctaStartSeconds !== 2137
    || versionBustSuccessor.runtimeContract?.ctaTrigger !== 'VTURB_CALLACTION'
    || versionBustSuccessor.runtimeContract?.bridgeVersion !== '20260928-stage-install-1'
    || versionBustSuccessor.validation?.stagePersisted !== true) {
  throw new Error('Invalid Protocolo G stage asset version successor');
}
for (const [file, expected] of Object.entries(certification.historicalFreezeSha256 || {})) {
  if (sha256(path.join(rootDir, file)) !== expected) {
    throw new Error('Historical freeze changed: ' + file);
  }
}

const profilePath = v150.trackingProfile?.file;
const profile = readJson(profilePath);
if (profile.profileId !== v150.trackingProfile.profileId
    || profile.version !== v150.trackingProfile.version
    || profile.profileHash !== v150.trackingProfile.profileHash
    || String(profile.browserPixelId) !== String(v150.trackingProfile.browserPixelId)
    || String(profile.businessDatasetId) !== String(v150.trackingProfile.businessDatasetId)
    || profile.domain !== 'vilaliemen.shop') {
  throw new Error('Invalid V150 tracking profile identity');
}

const baselineReconciliation = createRequire(import.meta.url)('./lib/protocolo-g-baseline-reconciliation-20261117.cjs').reconcile(rootDir);
const maintenanceV243=createRequire(import.meta.url)('./lib/tex-measurement-maintenance-v243.cjs').validate(rootDir);
Object.assign(manifest.files, v148.protectedFiles, v150.protectedFiles, v151.protectedFiles, v152.protectedFiles, v153.protectedFiles, certification.protectedFiles, mobileLayoutSuccessor.protectedFiles, mobileTwoStepSuccessor.protectedFiles, mobileCtaCopySuccessor.protectedFiles, stageActivationSuccessor.protectedFiles, versionBustSuccessor.protectedFiles, baselineReconciliation.protectedFiles, maintenanceV243.protectedFiles);
manifest.serverScope.sha256 = baselineReconciliation.serverScopeSha256;
const failures = [];

function relativePath(filePath) {
  return path.relative(rootDir, filePath).split(path.sep).join('/');
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function listFiles(dirPath) {
  const files = [];
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(entryPath));
    if (entry.isFile()) files.push(relativePath(entryPath));
  }
  return files.sort();
}

for (const [fileName, expectedHash] of Object.entries(manifest.files)) {
  const filePath = path.join(rootDir, ...fileName.split('/'));
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    failures.push(fileName + ': arquivo congelado ausente');
    continue;
  }
  const actualHash = sha256(filePath);
  if (actualHash !== expectedHash) {
    failures.push(fileName + ': SHA-256 esperado ' + expectedHash + ', encontrado ' + actualHash);
  }
}

const html = fs.readFileSync(path.join(rootDir, 'private/vsl/protocolo-g.html'), 'utf8');
const browserBridge = fs.readFileSync(path.join(rootDir, 'public/assets/js/meta-ec-protocolo-g-bridge.js'), 'utf8');
if ((html.match(/\/assets\/js\/meta-ec-protocolo-g-bridge\.js/g) || []).length !== 1) {
  failures.push('HTML deve carregar exatamente uma ponte first-party');
}
if (!/getElementById\('preco_89'\)/.test(html)
    || !/removeAttribute\('onclick'\)/.test(html)
    || !/addEventListener\('click'/.test(html)) {
  failures.push('CTA VTurb deve preservar ID legado e listener CSP-safe');
}
if (/protocolo-g-early-cta|createEarlyCta|open-modal-button/.test(html + browserBridge)) {
  failures.push('CTA secundária ou interceptador antigo encontrado');
}
if (!/pg-mobile-primary-cta/.test(html)
    || !/ResizeObserver/.test(html)
    || !/form\.__pgMobileVisibilityObserver\s*=\s*visibilityObserver/.test(html)
    || /setInterval|currentTime|2137|35:37/.test(html.slice(html.indexOf('function installMobileTwoStepCta'), html.indexOf('function withAddedLines')))
    || !/primary\.scrollIntoView\(\{ behavior: 'smooth', block: 'nearest' \}\)/.test(html)
    || !/form\.scrollIntoView\(\{ behavior: 'smooth', block: 'start' \}\)/.test(html)) {
  failures.push('Fluxo mobile em duas etapas ausente ou com timer/lógica temporal paralela');
}
if ((html.match(/primary\.textContent\s*=\s*'Hola, quiero el tratamiento Tex Ultra';/g) || []).length !== 1) {
  failures.push('Texto do botão mobile Protocolo G diverge da copy aprovada');
}
if (!/__META_EC_PG_API__/.test(browserBridge)
    || !/BRIDGE_URL\s*=\s*'\/api\/public\/meta-ec-protocolo-g\/bridge'/.test(browserBridge)) {
  failures.push('Ponte first-party de persistência ausente');
}
const bridgeInstall = browserBridge.slice(browserBridge.indexOf('  function install(rootObject)'));
if ((bridgeInstall.match(/installConversionStages\(rootObject\)/g) || []).length !== 1) {
  failures.push('Instalação canônica de estágios VSL deve ocorrer exatamente uma vez dentro de install');
}

const informativeDir = path.join(rootDir, 'public', 'verdevibe', 'dist');
const actualInformativeTree = listFiles(informativeDir);
const expectedInformativeTree = [...manifest.informativeTree].sort();
if (JSON.stringify(actualInformativeTree) !== JSON.stringify(expectedInformativeTree)) {
  failures.push(
    'public/verdevibe/dist: árvore esperada ' +
    JSON.stringify(expectedInformativeTree) +
    ', encontrada ' +
    JSON.stringify(actualInformativeTree)
  );
}

const serverPath = path.join(rootDir, manifest.serverScope.file);
const serverSource = fs.readFileSync(serverPath, 'utf8');
const scopeStart = serverSource.indexOf(manifest.serverScope.startMarker);
const scopeEnd = serverSource.indexOf(manifest.serverScope.endMarker, scopeStart);
if (scopeStart < 0 || scopeEnd < 0 || scopeEnd <= scopeStart) {
  failures.push('server.js: marcadores do contrato /protocolo-g ausentes ou fora de ordem');
} else {
  const scopeHash = crypto.createHash('sha256')
    .update(serverSource.slice(scopeStart, scopeEnd))
    .digest('hex');
  if (scopeHash !== manifest.serverScope.sha256) {
    failures.push(
      'server.js: contrato /protocolo-g esperado ' +
      manifest.serverScope.sha256 +
      ', encontrado ' +
      scopeHash
    );
  }
}

if (failures.length > 0) {
  console.error('GUARD PROTOCOLO G FREEZE: FAIL');
  for (const failure of failures) console.error('- ' + failure);
  process.exit(1);
}

console.log('GUARD PROTOCOLO G FREEZE: PASS');
console.log('- successor chain: V148 -> V150-R5 -> V151-R2 -> V152 -> V153 -> CERTIFICATION -> MOBILE_LAYOUT -> MOBILE_TWO_STEP -> MOBILE_CTA_COPY -> VSL_STAGE_INSTALL -> STAGE_URL_VERSION');
console.log('- checkout owner: ' + v153.policy.checkoutOwner);
console.log('- VTurb CTA: 35:37 -> WhatsApp 2958; A/B preservado em 100% TexUltra');
console.log('- tracking profile: ' + profile.profileId + '@' + profile.version);
console.log('- browser pixel: ' + profile.browserPixelId);
console.log('- smartphone: ' + manifest.variants.smartphone.header);
console.log('- desktop/tablet/unknown: ' + manifest.variants.desktopTabletUnknown.header);
console.log('- arquivos congelados: ' + Object.keys(manifest.files).length);
console.log('- contrato server.js: ' + manifest.serverScope.sha256);
