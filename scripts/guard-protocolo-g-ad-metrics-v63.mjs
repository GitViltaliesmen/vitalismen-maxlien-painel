import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

const read = (relativePath) => fs.readFileSync(relativePath, 'utf8');
const sha256 = (relativePath) => crypto.createHash('sha256')
    .update(fs.readFileSync(relativePath))
    .digest('hex');

const service = read('src/services/funnelMetricsService.js');
const route = read('src/routes/funnelMetrics.js');
const dashboard = read('public/funnel-metrics.html');
const entry = read('src/services/ecEngagementFreezeRuntimeGuardV40.js');
const packageJson = JSON.parse(read('package.json'));
const manifest = JSON.parse(read('docs/freeze/protocolo-g-ad-metrics-v63-20260826.json'));
const v71Manifest = JSON.parse(read('docs/freeze/strict-read-only-observation-safety-v71-20260827.json'));
const v73Manifest = JSON.parse(read('docs/freeze/meta-partner-destination-registry-v73-20260828.json'));
const v75Manifest = JSON.parse(read('docs/freeze/canary-isolation-safety-v75-20260828.json'));
const v78Manifest = JSON.parse(read('docs/freeze/ec-bot-core-structural-safety-v78-20260829.json'));

assert.equal(manifest.freezeId, 'protocolo-g-ad-metrics-v63-20260826');
assert.equal(manifest.parentFreezeId, 'protocolo-g-conversion-v62-20260826');
assert.equal(manifest.status, 'activation_approved');
assert.equal(manifest.publicationStatus, 'authorized_for_controlled_activation');
assert.equal(manifest.policy?.measurementStartedAt, '2026-08-26T05:13:18.000Z');
assert.equal(manifest.policy?.perAdBreakdown, true);
assert.equal(manifest.policy?.minimumLandingSample, 20);
assert.equal(manifest.policy?.vslFilesChanged, false);
assert.equal(manifest.policy?.metaAdsChanged, false);
assert.equal(manifest.policy?.commercialFlowChanged, false);
assert.equal(manifest.policy?.historicalDataMutated, false);

assert.match(service, /PROTOCOLO_G_MEASUREMENT_STARTED_AT = '2026-08-26T05:13:18\.000Z'/);
assert.match(service, /const protocoloGRowsByAd = new Map\(\)/);
assert.match(service, /addProtocoloGAdMetric/);
assert.match(service, /version: 'V63'/);
assert.match(service, /measurementStartedAt: PROTOCOLO_G_MEASUREMENT_STARTED_AT/);
assert.match(service, /ads: protocoloGAds/);
for (const field of [
    'campaignId',
    'adsetId',
    'adId',
    'tracking.productKey',
    'tracking.funnel',
    'tracking.utm_campaign',
    'tracking.utm_content'
]) assert.match(route, new RegExp(field.replace('.', '\\.')));
assert.match(dashboard, /Por anúncio — somente pós-correção/);
assert.match(dashboard, /Válido desde/);
assert.match(dashboard, /Amostra \$\{landings\}\/20/);
assert.match(entry, /runtimeGuardChainFreezeRuntimeGuardV67\.js/);
assert.match(packageJson.scripts.test, /guard:protocolo-g-ad-metrics-v63/);
assert.match(packageJson.scripts['senior:check'], /protocolo-g-ad-metrics-v63\.test\.mjs/);
assert.match(packageJson.scripts['deploy:v63'], /assert-protocolo-g-ad-metrics-activation-approved-v63\.mjs/);

const activationRecord = read('docs/PROTOCOLO_G_CONVERSION_ACTIVATION_RESULT_V62_20260826.md');
for (const hash of [
    '7722081940ceb74b21939e88b54b29f9fb05da9f9e37e87258a4edbd2149f5dd',
    '59b1d47e1c9d7613d1fc30884ce7df78080f9544c730e9435079a0aa39bdfe7b',
    'e0904cae1d97ce20b6493aad28b538650ada24c501b38e6a9e382d145e4dccd9'
]) assert.match(activationRecord, new RegExp(hash));

const preservedHashes = {
    'src/routes/whatsapp.js': '6975e0973ee873721128e6174d1b150a8c07d823e5bd519fcd1faafd94de8506',
    'src/services/metaProtocoloGAttributionService.js': '8fc9e5ea520df1c251e3564faf968eb0badb488be5320c7615f7c959fe3fa9fe',
    'src/models/VslVisit.js': '3d1018f8d7d1652fdddabecf4656a59a9ae8a96fe422992df102a4c348a46dc6',
    'public/qr.html': 'ec3b7cf3bc159c3a560bbfb56e6c7edb1478aac1d28a89ecf2292f43ab03c633',
    'public/n/index.html': 'ae4f5a3440d8ec94baa8dee68566c260e3888737df447d562d4ed1d9f689ba5e',
    'src/routes/orders.js': '725cebc3da1bbedc215e71383bfd820d0fc4fbf6f0a33c5bffbc89d7f702d82e',
    'src/services/droppiEcuadorService.js': '57e22ebf69a412fec6a9a97a53604f2af9194e12fe973843cb12ccb73552339a'
};
for (const [relativePath, expectedHash] of Object.entries(preservedHashes)) {
    const actualHash = sha256(relativePath);
    if (
        v71Manifest.declaredAncestorOverrides?.includes(relativePath)
        && v71Manifest.protectedFiles?.[relativePath] === actualHash
    ) continue;
    if (
        v73Manifest.declaredAncestorOverrides?.includes(relativePath)
        && v73Manifest.protectedFiles?.[relativePath] === actualHash
    ) continue;
    if (
        v75Manifest.declaredAncestorOverrides?.includes(relativePath)
        && v75Manifest.protectedFiles?.[relativePath] === actualHash
    ) continue;
    if (
        v78Manifest.declaredAncestorOverrides?.includes(relativePath)
        && v78Manifest.protectedFiles?.[relativePath] === actualHash
    ) continue;
    const v65SuccessorHashes = {
        'src/routes/whatsapp.js': '8ec8ad1c4a7946216bdb88dc6f8290d6fd8f1bd9f68af865db678fb36f7e9bd7',
        'public/qr.html': '5609edb70cc89a6471ae6a46bba9948f798cb0e093a97b7dd0ff3cb14b5376e0',
        'src/services/droppiEcuadorService.js': '0d312e3ea55db172f0f29b9419f205fcb1c18c867202126df9d5b9f58d2da1c4'
    };
    if (v65SuccessorHashes[relativePath]) {
        assert.ok(
            [expectedHash, v65SuccessorHashes[relativePath]].includes(actualHash),
            `${relativePath} protegido foi alterado fora da sucessao V65`
        );
        continue;
    }
    if (relativePath === 'src/services/droppiEcuadorService.js') {
        assert.ok(
            [
                expectedHash,
                'dd45007880275c71828641009cfd71bcb19dc5bf0e2b95a9200e61ee3d0110d8'
            ].includes(actualHash),
            `${relativePath} protegido foi alterado fora da sucessao V64`
        );
        continue;
    }
    assert.equal(actualHash, expectedHash, `${relativePath} protegido foi alterado`);
}

console.log('PROTOCOLO_G_AD_METRICS_V63_GUARD=OK');
