import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const browser = fs.readFileSync('src/services/droppiEcuadorBrowserService.js', 'utf8');
const routes = fs.readFileSync('src/routes/shipments.js', 'utf8');
const pipeline = browser.slice(browser.indexOf('const submitOrderInPanel ='), browser.indexOf('const findMatchingPanelText ='));

const fixture = ({ existing = false, ambiguous = false, invalidDestination = false } = {}) => {
    const calls = [];
    const context = vm.createContext({
        console, ORDER_CREATION_WAIT_MS: 10000, DROPI_BFF_CREATE_ENDPOINT: 'fixture-only',
        createPageDiagnosticsCollector: () => () => [], createShippingQuoteCollector: () => () => ({}),
        buildEcuadorProductBffQuote: async (_page, payload) => {
            calls.push('quote:' + payload.productKey);
            if (invalidDestination) throw new Error('AUTHORITATIVE_CITY_NOT_FOUND');
            return { latestQuote: {}, chosenCarrier: 'SERVIENTREGA' };
        },
        fillOrderFormInPanel: () => assert.fail('nao retornar ao caminho antigo'),
        findExistingDropiOrderForManualSubmission: async () => { calls.push('lookup'); return existing ? { id: 'fixture-existing-id' } : null; },
        existingDropiOrderResult: row => ({ verifiedDropiOrderId: row.id, reconciledExisting: true }),
        submitOrderViaDropiApi: async () => {
            calls.push('POST');
            return ambiguous ? { ok: false, errorCode: 'TIMEOUT', lifecycle: { requestDispatched: true } }
                : { ok: true, status: 200, body: { isSuccess: true, objects: { id: 'fixture-created-id' } } };
        },
        buildDropiBffSubmitError: ({ code }) => new Error(code),
        waitForOrderCreationResult: async () => ({ ok: true }),
        findOrderViaOrdersApi: async () => ({ panelMatched: true }),
        confirmOrderInOrdersPanel: () => assert.fail('API confirmou'),
        buildNotReadyError: message => new Error(message)
    });
    vm.runInContext(pipeline + '\nglobalThis.submit = submitOrderInPanel;', context);
    return { calls, submit: productKey => context.submit({ page: { waitForLoadState: async () => {} }, payload: { productKey, phone: 'fixture-phone' } }) };
};

for (const product of ['tex_ultra_ec', 'nitrix_ec', 'vit_power_ec']) {
    test(`${product}: cotacao, consulta autoritativa, exatamente um POST e ID confirmado em fixture`, async () => {
        const run = fixture();
        const result = await run.submit(product);
        assert.deepEqual(run.calls, ['quote:' + product, 'lookup', 'POST']);
        assert.equal(result.verifiedDropiOrderId, 'fixture-created-id');
    });
    test(`${product}: encontrado autoritativamente resulta em zero POST`, async () => {
        const run = fixture({ existing: true });
        const result = await run.submit(product);
        assert.deepEqual(run.calls, ['quote:' + product, 'lookup']);
        assert.equal(result.reconciledExisting, true);
    });
}

test('timeout depois do despacho consulta novamente e encerra sem retry de POST', async () => {
    const run = fixture({ ambiguous: true });
    await assert.rejects(() => run.submit('nitrix_ec'), /TIMEOUT/);
    assert.deepEqual(run.calls, ['quote:nitrix_ec', 'lookup', 'POST', 'lookup']);
});

test('destino invalido para antes do POST, sem inventar cidade', async () => {
    const run = fixture({ invalidDestination: true });
    await assert.rejects(() => run.submit('vit_power_ec'), /AUTHORITATIVE_CITY_NOT_FOUND/);
    assert.deepEqual(run.calls, ['quote:vit_power_ec']);
});

test('fila existente: double click executa transporte uma vez; ID persistido executa zero vezes', async () => {
    const source = routes.slice(routes.indexOf('const enqueueDropiSubmitJob ='), routes.indexOf('const getPendingDropiEcOrders ='));
    for (const existingId of ['', 'fixture-existing-id']) {
        let posts = 0;
        const shipment = { orderId: 'EC-FIXTURE-1', raw: { dropiOrderId: existingId } };
        const context = vm.createContext({
            console, activeDropiSubmitJobs: new Set(), dropiSubmitQueue: Promise.resolve(),
            markDropiSubmitQueued: async value => value,
            Shipment: { findOne: async () => shipment },
            alreadySubmittedResponse: (_order, value) => value.raw.dropiOrderId ? { alreadySubmitted: true } : null,
            submitDroppiEcuadorOrder: async () => { posts++; return { ok: true, dropiOrderId: 'fixture-new-id' }; },
            handleDropiSubmitResult: async ({ result }) => result,
            markManualSendRequired: () => assert.fail('nao esperado')
        });
        vm.runInContext(source + '\nglobalThis.enqueue = enqueueDropiSubmitJob;', context);
        const args = { order: { orderId: 'EC-FIXTURE-1' }, shipment };
        await Promise.all([context.enqueue(args), context.enqueue(args)]);
        await vm.runInContext('dropiSubmitQueue', context);
        assert.equal(posts, existingId ? 0 : 1);
        assert.equal(context.activeDropiSubmitJobs.size, 0);
    }
});
