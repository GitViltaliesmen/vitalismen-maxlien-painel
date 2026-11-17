import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const sha256 = (file) => crypto.createHash('sha256')
  .update(fs.readFileSync(path.join(root, file)))
  .digest('hex');

const expectedHashes = {
  'colombia.js': '9e1c960f681ba813484a3ea4c8a54eed8d92800b35b8c9e018c922b3192be7ea',
  'vturb.js': 'f2a4a661ecee613905415cd94c213df237c5452b4d195d2cf331426f51c3761a',
  'whatsapp.js': '26522bffb9bb6faf627ecad3a1da6691c6fdac235e06fce856eb45ad56858ab8',
  'audio/whatsapp.js': '7e8ca81a9f52416c41c2461717de55fd5eebf029db64b1abe67344e51242c7ab',
  'routes/orders.js': '2514cf1920714a747e9d7a63a4835832d9d327b10497f6ce7ecaa2fba2f7a5e7',
  'routes/public.js': '77a2477b7a6d334b7faabdb48e5721ab239e20762ad4fc5e18f4e1ccf3817c74',
  'metaCapi.js': '00d680e50c23ad2d1a49b493bb151dce3a513b747ef443306d3744a707ed7fcf',
  'public/assets/js/pixel.js': '89449a5822f996725bb8be68058c5363bf62d17a8bb7c7c8ffe0cc306a29937a',
  'public/assets/js/tracking-protocolo-g-formulario-20260815.js': 'da4a9415211991cf6669cea2734c1abecc3f516d00f6330c3feb9761ee7839f9',
  'public/protocolo-co.html': '46e5ad2d8e6806d3bbb0e6d4f120500516eb7ffda615a0d1cf553319fc824213',
  'protocolo-co.html': '42991d72e1f7151fd0954151c536399151304912cbe5d17b5ce75cd16cba5586'
};

const parent = readJson('config/protocolo-g-freeze.json');
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
if (v148.parentFreeze !== parent.freezeId
    || v150.parentFreeze !== v148.freezeId
    || v151.parentFreeze !== v150.freezeId
    || v152.parentFreeze !== v151.freezeId
    || v153.parentFreeze !== v152.freezeId
    || v153.policy?.checkoutOwner !== 'VTURB_NATIVE'
    || v153.policy?.abTestPreserved !== true
    || v153.runtimeContract?.phone !== '5531971862958'
    || v153.runtimeContract?.message !== 'Hola, quiero el tratamiento Tex Ultra.'
    || v153.runtimeContract?.oldPhoneReferenceInActiveCta !== 0
    || certification.parentFreeze !== v153.freezeId
    || certification.policy?.historicalFreezesImmutable !== true
    || certification.policy?.ctaSource !== 'VTURB_ONLY'
    || certification.policy?.secondaryCtaAllowed !== false
    || certification.policy?.firstPartyBridgeRequired !== true
    || certification.runtimeContract?.ctaStart !== '35:37'
    || certification.runtimeContract?.ctaStartSeconds !== 2137) {
  throw new Error('invalid successor chain');
}
if (mobileLayoutSuccessor.parentFreeze !== certification.freezeId
    || mobileLayoutSuccessor.parentCertificationSha256 !== sha256('config/protocolo-g-certification-20260926-freeze.json')
    || mobileLayoutSuccessor.policy?.scope !== 'MOBILE_LAYOUT_SPACING_ONLY'
    || mobileLayoutSuccessor.policy?.functionalFileChangesAuthorized !== true
    || mobileLayoutSuccessor.policy?.desktopLayoutUnchanged !== true
    || mobileLayoutSuccessor.runtimeContract?.ctaStart !== certification.runtimeContract.ctaStart
    || mobileLayoutSuccessor.runtimeContract?.ctaStartSeconds !== certification.runtimeContract.ctaStartSeconds
    || mobileLayoutSuccessor.runtimeContract?.playerId !== certification.runtimeContract.playerId) {
  throw new Error('invalid mobile layout successor');
}
if (mobileTwoStepSuccessor.parentFreeze !== mobileLayoutSuccessor.freezeId
    || mobileTwoStepSuccessor.parentFreezeSha256 !== sha256('config/protocolo-g-mobile-layout-20260927-freeze.json')
    || mobileTwoStepSuccessor.policy?.scope !== 'MOBILE_TWO_STEP_CTA'
    || mobileTwoStepSuccessor.policy?.ctaSource !== 'VTURB_ONLY'
    || mobileTwoStepSuccessor.policy?.playerChanged !== false
    || mobileTwoStepSuccessor.runtimeContract?.ctaStartSeconds !== 2137
    || mobileTwoStepSuccessor.runtimeContract?.ctaTrigger !== 'VTURB_CALLACTION') {
  throw new Error('invalid mobile two-step successor');
}
if (mobileCtaCopySuccessor.parentFreeze !== mobileTwoStepSuccessor.freezeId
    || mobileCtaCopySuccessor.parentFreezeSha256 !== sha256('config/protocolo-g-mobile-two-step-20260927-freeze.json')
    || mobileCtaCopySuccessor.policy?.scope !== 'MOBILE_CTA_COPY_ONLY'
    || mobileCtaCopySuccessor.policy?.buttonTextOnly !== true
    || mobileCtaCopySuccessor.runtimeContract?.buttonText !== 'Hola, quiero el tratamiento Tex Ultra'
    || mobileCtaCopySuccessor.runtimeContract?.ctaStartSeconds !== 2137
    || mobileCtaCopySuccessor.runtimeContract?.ctaTrigger !== 'VTURB_CALLACTION') {
  throw new Error('invalid mobile CTA copy successor');
}
const baselineReconciliation = createRequire(import.meta.url)('./lib/protocolo-g-baseline-reconciliation-20261117.cjs').reconcile(root);
const maintenanceV243=createRequire(import.meta.url)('./lib/tex-measurement-maintenance-v243.cjs').validate(root);
Object.assign(expectedHashes, v148.protectedFiles, v150.protectedFiles, v151.protectedFiles, v152.protectedFiles, v153.protectedFiles, certification.protectedFiles, mobileLayoutSuccessor.protectedFiles, mobileTwoStepSuccessor.protectedFiles, mobileCtaCopySuccessor.protectedFiles, stageActivationSuccessor.protectedFiles, versionBustSuccessor.protectedFiles, baselineReconciliation.protectedFiles, maintenanceV243.protectedFiles);

const profile = readJson(v150.trackingProfile.file);
const errors = [];
for (const [file, expected] of Object.entries(certification.historicalFreezeSha256 || {})) {
  if (sha256(file) !== expected) errors.push(`${file}: freeze histórico modificado`);
}
if (profile.profileId !== v150.trackingProfile.profileId
    || profile.version !== v150.trackingProfile.version
    || profile.profileHash !== v150.trackingProfile.profileHash
    || String(profile.browserPixelId) !== String(v150.trackingProfile.browserPixelId)
    || String(profile.businessDatasetId) !== String(v150.trackingProfile.businessDatasetId)
    || profile.domain !== 'vilaliemen.shop'
    || profile.eventSourceUrl !== 'https://vilaliemen.shop/protocolo-g') {
  errors.push('tracking profile V150 não corresponde ao successor manifest');
}
if (!/^\d+$/.test(String(profile.browserPixelId || ''))) {
  errors.push('tracking profile V150 não possui browser pixel numérico explícito');
}

for (const [file, expected] of Object.entries(expectedHashes)) {
  if (!fs.existsSync(path.join(root, file))) {
    errors.push(`${file}: ausente`);
    continue;
  }
  const actual = sha256(file);
  if (actual !== expected) errors.push(`${file}: esperado ${expected}, encontrado ${actual}`);
}

const envExamplePath = path.join(root, '.env.example');
if (fs.existsSync(envExamplePath)) {
  const envExample = fs.readFileSync(envExamplePath, 'utf8');
  if (/^META_(?:CAPI_)?ACCESS_TOKEN[^=]*=\S+/m.test(envExample)) {
    errors.push('.env.example contém credencial Meta preenchida');
  }
  if (/EAA[A-Za-z0-9]{20,}/.test(envExample)) errors.push('.env.example contém possível Access Token');
}

const html = fs.readFileSync(path.join(root, 'private/vsl/protocolo-g.html'), 'utf8');
if (!html.includes('id="ab-6a6023ffd403aabb02392eb9"')) errors.push('player VTurb protegido foi alterado');
if (!/\/assets\/js\/pixel\.js/.test(html)) errors.push('pixel local protegido não está carregado');
if ((html.match(/\/assets\/js\/meta-ec-protocolo-g-bridge\.js/g) || []).length !== 1) errors.push('ponte first-party oficial deve carregar uma única vez');
if (/tracking-protocolo-g-formulario-20260815\.js/.test(html)) errors.push('V152 não deve carregar o interceptador de checkout');
const browser = fs.readFileSync(path.join(root, 'public/assets/js/meta-ec-protocolo-g-bridge.js'), 'utf8');
if (/protocolo-g-early-cta|createEarlyCta|open-modal-button/.test(html + browser)) errors.push('CTA secundária ou interceptador antigo encontrado');
if (!/__META_EC_PG_API__/.test(browser) || !/getElementById\('preco_89'\)/.test(html) || !/removeAttribute\('onclick'\)/.test(html)) errors.push('ponte first-party ou listener CSP-safe ausente');
const install = browser.slice(browser.indexOf('  function install(rootObject)'));
if ((install.match(/installConversionStages\(rootObject\)/g) || []).length !== 1) errors.push('canonical VSL stage installer must be called exactly once from install');
if (!/salesBranchIdentity\(rootObject\)/.test(install)) errors.push('V148 rendered branch gate missing');
if (!/verifiedSalesRoots\.add\(rootObject\)/.test(install)) errors.push('V148-A1 immutable SALES identity missing');
if (stageActivationSuccessor.parentFreeze !== mobileCtaCopySuccessor.freezeId
    || stageActivationSuccessor.parentFreezeSha256 !== sha256('config/protocolo-g-mobile-cta-copy-20260927-freeze.json')
    || stageActivationSuccessor.policy?.scope !== 'PROTOCOLO_G_VSL_STAGE_INSTALL_ONLY'
    || stageActivationSuccessor.policy?.canonicalInstallCallOnly !== true
    || stageActivationSuccessor.runtimeContract?.ctaStartSeconds !== 2137
    || stageActivationSuccessor.runtimeContract?.ctaTrigger !== 'VTURB_CALLACTION') errors.push('VSL stage install successor does not preserve frozen CTA behavior');
if (versionBustSuccessor.parentFreeze !== stageActivationSuccessor.freezeId
    || versionBustSuccessor.parentFreezeSha256 !== sha256('config/protocolo-g-vsl-stage-install-20260927-freeze.json')
    || versionBustSuccessor.policy?.scope !== 'PROTOCOLO_G_STAGE_ASSET_URL_VERSION_ONLY'
    || versionBustSuccessor.policy?.htmlSrcParameterOnly !== true
    || versionBustSuccessor.runtimeContract?.ctaStartSeconds !== 2137
    || versionBustSuccessor.runtimeContract?.ctaTrigger !== 'VTURB_CALLACTION'
    || versionBustSuccessor.runtimeContract?.bridgeVersion !== '20260928-stage-install-1'
    || versionBustSuccessor.validation?.stagePersisted !== true) errors.push('stage URL version successor is invalid');

const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
if (/routes\/metaEcProtocoloGBridge/.test(server) || /api\/public\/meta-ec-protocolo-g/.test(server)) {
  errors.push('bridge MAXLIEN deve permanecer fora do fluxo do servidor restaurado');
}

const fixturePath = path.join(root, 'tests/fixtures/meta-ec-protocolo-g-maxlien-payload.json');
if (!fs.existsSync(fixturePath)) {
  errors.push('fixture oficial do payload MAXLIEN não existe');
} else {
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  if (fixture.country !== 'EC' || fixture.productKey !== 'tex_ultra_ec'
      || fixture.product !== 'TEX_ULTRA' || fixture.funnel !== 'PROTOCOLO_G') {
    errors.push('fixture oficial não fecha a identidade EC + TEX_ULTRA + PROTOCOLO_G');
  }
  if (!fixture.external_id || fixture.external_id !== fixture.visitorId) errors.push('fixture oficial não preserva external_id/visitorId');
  if (!fixture.attribution_captured_at || fixture.skipMeta !== true) errors.push('fixture oficial não contém timestamp de atribuição e skipMeta=true');
  if (!/^fb\.1\.\d{10,13}\.[^\s]+$/.test(String(fixture.fbp || ''))) errors.push('fixture oficial não contém fbp sintético válido para matching');
  if (/EAA[A-Za-z0-9]{20,}/.test(JSON.stringify(fixture))) errors.push('fixture oficial contém possível segredo Meta');
}

for (const file of ['routes/metaEcProtocoloGBridge.js', 'public/assets/js/meta-ec-protocolo-g-bridge.js']) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  if (/TEST71700/.test(source)) errors.push(`${file}: contém test_event_code encerrado`);
  if (/EAA[A-Za-z0-9]{20,}/.test(source)) errors.push(`${file}: possível Access Token no source`);
  if (/['"]\/n\/?['"]/.test(source)) errors.push(`${file}: referência indevida a /n/`);
}

if (errors.length) {
  console.error('GUARD META EC PROTOCOLO G: FALHOU');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('GUARD PROTOCOLO G CERTIFICATION: OK');
console.log(`PROTOCOLO_G -> ${profile.profileId}@${profile.version} -> ${profile.browserPixelId}`);
console.log('SUCCESSOR CHAIN: V148 -> V150-R5 -> V151-R2 -> V152 -> V153 -> CERTIFICATION -> MOBILE_LAYOUT -> MOBILE_TWO_STEP -> MOBILE_CTA_COPY -> VSL_STAGE_INSTALL -> STAGE_URL_VERSION');
console.log('PIXEL/PLAYER VTURB/A-B: INTACTOS; CTA 35:37 -> WHATSAPP 2958; CHECKOUT OWNER: VTURB_NATIVE');
console.log('COLÔMBIA/TELEDONE/Z-API/WHATSAPP/PAYMENTS/DROPI: INTACTOS');
