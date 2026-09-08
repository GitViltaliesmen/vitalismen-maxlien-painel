import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

import { assertV141V142ConvergenceV143 } from '../scripts/guard-v141-v142-convergence-v143.mjs';
import { ensurePurchaseAfterHumanDropiSuccessV141 } from '../src/routes/shipments.js';
import { loadMetaAdsInsights } from '../src/services/metaAdsInsightsService.js';

const policySource = fs.readFileSync('public/panel-intelligence/panel-new-dropi-persistence-v142.js', 'utf8');
const sandbox = { console };
sandbox.globalThis = sandbox;
vm.runInNewContext(policySource, sandbox);
const panelPolicy = sandbox.VitalismenPanelNewDropiPersistenceV142;

test('V143 protege simultaneamente os deltas congelados V141 e V142', () => {
    const manifest = assertV141V142ConvergenceV143();
    assert.equal(manifest.mergeBase, '13e752adc08cd089181eeebe2ff527dbe97f5fa9');
    assert.equal(manifest.policy.productionChanged, false);
    assert.equal(manifest.policy.crossLayerIsolation, true);
});

test('refresh Meta somente GET não altera a decisão pura de preparação manual V142', async () => {
    const cacheFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'v143-meta-')), 'ec.json');
    const methods = [];
    const meta = await loadMetaAdsInsights({
        days: 1,
        now: new Date('2026-09-08T20:00:00.000Z'),
        startDay: '2026-09-08',
        endDay: '2026-09-08',
        accountId: 'fixture-account',
        env: { META_ACCESS_TOKEN: 'fixture' },
        cacheFile,
        fetchImpl: async (url, options) => {
            methods.push(options.method);
            if (String(url).includes('/insights?')) {
                return new Response(JSON.stringify({ data: [] }), { status: 200 });
            }
            return new Response(JSON.stringify({ data: [] }), { status: 200 });
        }
    });
    const decision = panelPolicy.buildConfirmedAdminLeadPreparation({
        chat: { orderId: 'EC-ADMIN-9999' },
        draft: {
            orderId: 'EC-ADMIN-9999', status: 'confirmado', country: 'EC', name: 'CLIENTE TESTE',
            phone: '+593999999999', city: 'Quito', province: 'Pichincha', address: 'Agencia fixture',
            deliveryMode: 'agency', agencyId: 'fixture', agencyName: 'Agencia fixture', quantity: 3,
            total: 80.99, productKey: 'tex_ultra_ec'
        },
        customerDataResolution: { version: 28, orderDataReady: true }
    });
    assert.equal(meta.fetchStatus, 'ok');
    assert.equal(methods.every((method) => method === 'GET'), true);
    assert.equal(decision.endpoint, '/api/shipments/droppi/ec/admin-leads/9999/configure-order');
    assert.equal(decision.body.quantity, 3);
});

test('preparação Dropi não envia CAPI sem autorização e sucesso legítimos', async () => {
    let purchaseCalls = 0;
    const result = await ensurePurchaseAfterHumanDropiSuccessV141({
        order: { orderId: 'EC-ADMIN-FIXTURE', tracking: {} },
        shipment: { automation: {} },
        dropiResult: { ok: true },
        purchaseSender: async () => { purchaseCalls += 1; return { ok: true }; }
    });
    assert.equal(result.reason, 'human_dropi_authorization_missing');
    assert.equal(purchaseCalls, 0);
});

test('timer Meta permanece em cinco minutos e o painel não contém envio automático', () => {
    const timer = fs.readFileSync('ops/systemd/vitalismen-meta-ads-insights-v141.timer', 'utf8');
    const panel = fs.readFileSync('public/qr.html', 'utf8');
    const prepareStart = panel.indexOf('const prepareConfirmedAdminLeadForDropi = async');
    const prepareEnd = panel.indexOf('const applyLeadStatusUpdateLocally', prepareStart);
    const prepare = panel.slice(prepareStart, prepareEnd);
    assert.match(timer, /OnUnitActiveSec=5min/);
    assert.match(prepare, /api\(decision\.endpoint/);
    assert.doesNotMatch(prepare, /authorize-submit|submitDropiOrder|meta-events/);
});

test('V143 fixa os hashes VSL externos conhecidos sem incorporar conteúdo ao Git', () => {
    const manifest = JSON.parse(fs.readFileSync('docs/freeze/ec-v141-v142-convergence-v143-20260908.json', 'utf8'));
    assert.deepEqual(manifest.vslHashes, {
        publicSha256: 'ddf1a65ff3696a10ce7105523397592a85566cb837447210eecb100d3953cf27',
        privateSha256: '5db8590e5187cb3704f8bf2af11599c0a521d1858a799a7cca9c0afb95dbf6f7',
        bridgeJsSha256: 'e0904cae1d97ce20b6493aad28b538650ada24c501b38e6a9e382d145e4dccd9',
        bridgeRouteSha256: '7722081940ceb74b21939e88b54b29f9fb05da9f9e37e87258a4edbd2149f5dd'
    });
});
