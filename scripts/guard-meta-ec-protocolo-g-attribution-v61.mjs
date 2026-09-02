import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

await import('../src/services/ecEngagementFreezeRuntimeGuardV40.js');

const read = (relativePath) => fs.readFileSync(relativePath, 'utf8');
const sha256 = (relativePath) => crypto.createHash('sha256')
    .update(fs.readFileSync(relativePath))
    .digest('hex');

const contract = read('src/services/metaProtocoloGAttributionService.js');
const receiver = read('src/routes/whatsapp.js');
const bridge = read('src/services/metaAttributionBridgeService.js');
const attribution = read('src/services/metaAttributionService.js');
const meta = read('src/services/metaConversionsService.js');
const orderModel = read('src/models/Order.js');
const visitModel = read('src/models/VslVisit.js');
const correlationModel = read('src/models/MetaAttributionCorrelation.js');
const metrics = read('src/services/funnelMetricsService.js');
const dashboard = read('public/funnel-metrics.html');
const capiRoutingFreezeGuard = read('scripts/guard-meta-capi-routing-freeze-v61.mjs');
const packageJson = JSON.parse(read('package.json'));
const manifest = JSON.parse(read('docs/freeze/meta-ec-protocolo-g-attribution-v61-20260824.json'));
const v71Manifest = JSON.parse(read('docs/freeze/strict-read-only-observation-safety-v71-20260827.json'));
const v73Manifest = JSON.parse(read('docs/freeze/meta-partner-destination-registry-v73-20260828.json'));
const v75Manifest = JSON.parse(read('docs/freeze/canary-isolation-safety-v75-20260828.json'));
const v78Manifest = JSON.parse(read('docs/freeze/ec-bot-core-structural-safety-v78-20260829.json'));
const v99Manifest = JSON.parse(read('docs/freeze/ec-repurchase-registration-v99-20260902.json'));
const localFixturePath = 'tests/fixtures/meta-ec-protocolo-g-maxlien-payload.json';
const officialFixtureSha256 = 'ce253997d309e5ab921f94506a119302d3bf12d5560aa1fdac8b5c9ee4b5afe8';

assert.equal(sha256(localFixturePath), officialFixtureSha256, 'fixture local Vilaliemen divergiu do SHA oficial');
assert.equal(manifest.localContractGate?.fixtureExecutionPath, localFixturePath);
assert.equal(manifest.localContractGate?.fixtureSha256, officialFixtureSha256);
assert.equal(manifest.localContractGate?.sourceProject, 'VILALIEMEN_PROTOCOLO_G_OFICIAL');
assert.equal(manifest.localContractGate?.vilaliemenCommit, 'ad0ad71bda41e52cbfb4462527b2a38c31005718');
assert.equal(manifest.localContractGate?.externalFixtureAccessRequired, false);
assert.doesNotMatch(
    read('tests/meta-ec-protocolo-g-attribution-v61.test.mjs'),
    /\/home\/codex\/workspaces\//,
    'teste contratual V61 não pode depender de caminho absoluto de workspace'
);

assert.match(contract, /META_EC_TEX_ULTRA_PROTOCOLO_G_DATASET_ID = '2048099902484149'/);
assert.match(contract, /validateVilaliemenProtocoloGContract/);
assert.match(contract, /external_id/);
assert.match(contract, /attributionCapturedAt: parseAttributionCapturedAt/);
assert.match(contract, /invalid_event_source_url/);
assert.match(receiver, /router\.post\('\/vsl-entry', async/);
assert.match(receiver, /invalid_protocolo_g_contract/);
assert.match(receiver, /campaignId: protocoloGContract\s+\? incomingTracking\.campaign_id \|\| ''/);
assert.match(receiver, /attributionCapturedAt: protocoloGContract\s+\? incomingTracking\.attributionCapturedAt \|\| null/);
assert.match(receiver, /attributionTrackingFromContactState/);
assert.doesNotMatch(receiver, /ip: order\?\.tracking\?\.ip \|\| req\?\.ip/);
assert.match(bridge, /MetaAttributionCorrelation/);
assert.match(bridge, /AMBIGUOUS/);
assert.match(bridge, /UNMATCHED/);
assert.match(attribution, /attributionClaimedAt: \{ \$exists: true, \$ne: null \}/);
assert.match(attribution, /'attributionCapturedAt'/);
assert.match(attribution, /lookbackDays = 30/);
assert.match(orderModel, /campaign_id: String/);
assert.match(orderModel, /adset_id: String/);
assert.match(orderModel, /ad_id: String/);
assert.match(orderModel, /attributionCapturedAt: Date/);
assert.match(visitModel, /campaignId:/);
assert.match(visitModel, /attributionCapturedAt: Date/);
assert.match(correlationModel, /'CLAIMED', 'AMBIGUOUS', 'UNMATCHED'/);
assert.match(meta, /ec_tex_ultra_protocolo_g/);
assert.match(meta, /META_ACCESS_TOKEN_EC_TEX_ULTRA_PROTOCOLO_G \|\| env\.META_ACCESS_TOKEN_EC/);
assert.match(meta, /trustedProtocoloGUserAgent/);
assert.match(meta, /PROTOCOLO_G_EVENT_SOURCE_URL/);
assert.equal(manifest.policy.legacyEcServerTokenPreserved, true);
assert.equal(manifest.policy.protocoloGDatasetFailClosed, true);
assert.equal(manifest.policy.otherEcUsesDedicatedDataset, false);
assert.equal(manifest.policy.metaServerTokenFrontendExposureAllowed, false);
assert.equal(manifest.policy.freezeLockBehavioralGuard, 'scripts/guard-meta-capi-routing-freeze-v61.mjs');
assert.match(capiRoutingFreezeGuard, /getMetaConfigForCountry\('EC'\)/);
assert.match(capiRoutingFreezeGuard, /sendPurchaseEventForOrder/);
assert.match(capiRoutingFreezeGuard, /sendBrowserServerEvent/);
assert.match(capiRoutingFreezeGuard, /META_EC_TEX_ULTRA_PROTOCOLO_G_DATASET_ID/);
assert.match(capiRoutingFreezeGuard, /META_ACCESS_TOKEN_EC_TEX_ULTRA_PROTOCOLO_G/);
assert.match(packageJson.scripts['guard:freeze-lock'], /guard-meta-capi-routing-freeze-v61\.mjs/);
assert.match(metrics, /recentAttributionOrders/);
assert.match(dashboard, /Atribuição EC por pedido/);
assert.match(dashboard, /Campaign ID/);
assert.match(packageJson.scripts['senior:check'], /meta-ec-protocolo-g-attribution-v61\.test\.mjs/);
assert.match(packageJson.scripts['deploy:ec-safe'], /assert-meta-ec-protocolo-g-attribution-activation-approved-v61\.mjs/);
assert.match(packageJson.scripts['deploy:vps'], /assert-meta-ec-protocolo-g-attribution-activation-approved-v61\.mjs/);

const protectedHashes = {
    'src/routes/zapi.js': '90598abc9fa5fce58ad69d0c70596c8c2cb803dd899080a43412b5e21b9c2670',
    'src/services/zapiClient.js': '175d7a3121686f1c629df7d1cd668c6960c9ffcec370d78d7c15142de9e6eb0c',
    'src/whatsapp/zapiOutboundRouting.js': 'cd65958d66ff007680f4e24fb70def251e803bf24ea36c8b3b706f584ed333ca',
    'public/n/index.html': 'ae4f5a3440d8ec94baa8dee68566c260e3888737df447d562d4ed1d9f689ba5e',
    'public/qr.html': 'ec3b7cf3bc159c3a560bbfb56e6c7edb1478aac1d28a89ecf2292f43ab03c633',
    'src/routes/orders.js': '725cebc3da1bbedc215e71383bfd820d0fc4fbf6f0a33c5bffbc89d7f702d82e',
    'src/routes/shipments.js': 'c9576c0950a7faaf3e85ce575df14ce6154df0548587a9d7139cecd67c73f87a',
    'src/services/droppiEcuadorService.js': '57e22ebf69a412fec6a9a97a53604f2af9194e12fe973843cb12ccb73552339a',
    'src/services/droppiEcuadorBrowserService.js': 'fd779e9b893717eab9509b2db67ef2460578038f4df183789128046ed14c15d8',
    'src/routes/webhook.js': 'e678f6453342543ff6f15db56bbe4bc4255cd22164424c4e2b6f8c1bf5f71637',
    'src/services/conversationEngine.js': 'b12ba1013c99b9fa808f028346a007be977048985d5975d7c9754dd3c8e91f0d',
    'src/services/texUltraFunnelService.js': '27d4ea57c122012492f634d804b929c58e17b31010483f024983e8b4907a47d2'
};

for (const [relativePath, expectedHash] of Object.entries(protectedHashes)) {
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

console.log('META_EC_PROTOCOLO_G_ATTRIBUTION_V61_GUARD=OK');
