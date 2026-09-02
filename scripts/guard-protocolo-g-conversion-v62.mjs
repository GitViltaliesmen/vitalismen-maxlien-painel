import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

const read = (relativePath) => fs.readFileSync(relativePath, 'utf8');
const sha256 = (relativePath) => crypto.createHash('sha256')
    .update(fs.readFileSync(relativePath))
    .digest('hex');

const contract = read('src/services/metaProtocoloGAttributionService.js');
const receiver = read('src/routes/whatsapp.js');
const visitModel = read('src/models/VslVisit.js');
const metricsRoute = read('src/routes/funnelMetrics.js');
const metrics = read('src/services/funnelMetricsService.js');
const dashboard = read('public/funnel-metrics.html');
const packageJson = JSON.parse(read('package.json'));
const manifest = JSON.parse(read('docs/freeze/protocolo-g-conversion-v62-20260826.json'));
const v71Manifest = JSON.parse(read('docs/freeze/strict-read-only-observation-safety-v71-20260827.json'));
const v73Manifest = JSON.parse(read('docs/freeze/meta-partner-destination-registry-v73-20260828.json'));
const v75Manifest = JSON.parse(read('docs/freeze/canary-isolation-safety-v75-20260828.json'));
const v78Manifest = JSON.parse(read('docs/freeze/ec-bot-core-structural-safety-v78-20260829.json'));
const v99Manifest = JSON.parse(read('docs/freeze/ec-repurchase-registration-v99-20260902.json'));
const stageRoute = receiver.split("router.post('/vsl-stage', async")[1]
    ?.split("router.post('/vsl-entry', async")[0] || '';

assert.equal(manifest.status, 'activation_approved');
assert.equal(manifest.publicationStatus, 'authorized_for_controlled_activation');
assert.equal(manifest.policy?.earlySecondaryCtaSeconds, 720);
assert.equal(manifest.policy?.vturbFinalCtaPreserved, true);
assert.equal(manifest.policy?.stageCreatesMetaConversion, false);
assert.equal(manifest.policy?.stageCreatesPanelLead, false);
assert.equal(manifest.policy?.stageRotatesSeller, false);
assert.equal(manifest.policy?.stageSendsWhatsapp, false);

assert.match(contract, /PROTOCOLO_G_STAGE_FIELDS/);
assert.match(contract, /validateVilaliemenProtocoloGStageContract/);
for (const stage of [
    'landing',
    'video_started',
    'watched_25',
    'watched_50',
    'early_cta_visible',
    'form_opened',
    'form_submitted'
]) assert.match(contract, new RegExp(stage));
assert.match(contract, /body\.clicked !== false/);
assert.match(contract, /invalid_skip_meta/);

assert.match(stageRoute, /protocoloGStages\.\$\{contract\.stageField\}/);
assert.match(stageRoute, /\$min/);
assert.match(stageRoute, /status\(202\)/);
assert.doesNotMatch(stageRoute, /nextSellerForNewLead|registerVslClickInPanel|sendVslLeadForVisit|sendBrowserMetaEvent|sendText|sendAudio|sendImage|sendVideo/);

assert.match(visitModel, /protocoloGStages:/);
assert.match(visitModel, /earlyCtaVisibleAt: Date/);
assert.match(visitModel, /formSubmittedAt: Date/);
assert.match(metricsRoute, /protocoloGStages/);
assert.match(metrics, /protocoloG:/);
assert.match(metrics, /isEcuadorTexUltraProtocoloG/);
assert.match(dashboard, /Protocolo G — Tex Ultra/);
assert.match(dashboard, /Não mistura outras VSLs do Equador/);
assert.match(dashboard, /CTA secundária aos 12 minutos/);
assert.match(dashboard, /Dia a dia — EC geral/);
assert.match(packageJson.scripts['senior:check'], /protocolo-g-conversion-v62\.test\.mjs/);
assert.match(packageJson.scripts['deploy:v62'], /assert-protocolo-g-conversion-activation-approved-v62\.mjs/);

const preservedHashes = {
    'src/routes/zapi.js': '90598abc9fa5fce58ad69d0c70596c8c2cb803dd899080a43412b5e21b9c2670',
    'src/services/zapiClient.js': '175d7a3121686f1c629df7d1cd668c6960c9ffcec370d78d7c15142de9e6eb0c',
    'src/whatsapp/zapiOutboundRouting.js': 'cd65958d66ff007680f4e24fb70def251e803bf24ea36c8b3b706f584ed333ca',
    'public/n/index.html': 'ae4f5a3440d8ec94baa8dee68566c260e3888737df447d562d4ed1d9f689ba5e',
    'public/qr.html': 'ec3b7cf3bc159c3a560bbfb56e6c7edb1478aac1d28a89ecf2292f43ab03c633',
    'src/routes/orders.js': '725cebc3da1bbedc215e71383bfd820d0fc4fbf6f0a33c5bffbc89d7f702d82e',
    'src/routes/shipments.js': 'c9576c0950a7faaf3e85ce575df14ce6154df0548587a9d7139cecd67c73f87a',
    'src/services/droppiEcuadorService.js': '57e22ebf69a412fec6a9a97a53604f2af9194e12fe973843cb12ccb73552339a',
    'src/services/droppiEcuadorBrowserService.js': 'fd779e9b893717eab9509b2db67ef2460578038f4df183789128046ed14c15d8',
    'src/services/conversationEngine.js': 'b12ba1013c99b9fa808f028346a007be977048985d5975d7c9754dd3c8e91f0d',
    'src/services/texUltraFunnelService.js': '27d4ea57c122012492f634d804b929c58e17b31010483f024983e8b4907a47d2'
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
    if (
        v99Manifest.declaredAncestorOverrides?.includes(relativePath)
        && v99Manifest.protectedFiles?.[relativePath] === actualHash
    ) continue;
    const v64SuccessorHashes = {
        'src/routes/shipments.js': '85edd653db5b6094e3b0dafcfc41afebf8fb9a54912d4d5d3208f0d194ae6ab4',
        'src/services/droppiEcuadorService.js': 'dd45007880275c71828641009cfd71bcb19dc5bf0e2b95a9200e61ee3d0110d8'
    };
    const v65SuccessorHashes = {
        'public/qr.html': '5609edb70cc89a6471ae6a46bba9948f798cb0e093a97b7dd0ff3cb14b5376e0',
        'src/routes/shipments.js': 'a36ca83ee8fe0f4e44b07a71871e45f688b3d54e238fd8f21ef3a1b8283f74ab',
        'src/services/droppiEcuadorService.js': '0d312e3ea55db172f0f29b9419f205fcb1c18c867202126df9d5b9f58d2da1c4',
        'src/services/droppiEcuadorBrowserService.js': '0f4337dcb0fa39f622d1404dc261af507758bcfa2a17d65cd38caf6eb1f1790b',
        'src/services/conversationEngine.js': '234a0432b77072021f76133417f2da5a25f871cf8fcba82513296e5b12ac0497'
    };
    const v66SuccessorHashes = {
        'src/services/droppiEcuadorBrowserService.js': '94327ca6380064800d112fcbd666ce4b2779e18b249bb66a05747d9915399d43'
    };
    if (v64SuccessorHashes[relativePath] || v65SuccessorHashes[relativePath] || v66SuccessorHashes[relativePath]) {
        assert.ok(
            [expectedHash, v64SuccessorHashes[relativePath], v65SuccessorHashes[relativePath], v66SuccessorHashes[relativePath]].filter(Boolean).includes(actualHash),
            `${relativePath} protegido foi alterado fora da sucessao V64/V65/V66`
        );
        continue;
    }
    assert.equal(actualHash, expectedHash, `${relativePath} protegido foi alterado`);
}

console.log('PROTOCOLO_G_CONVERSION_V62_GUARD=OK');
