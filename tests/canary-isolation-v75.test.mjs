import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
    CANARY_V75_QA_PHONE,
    CANARY_V75_RECIPIENT_LIST_FLAGS,
    CANARY_V75_REQUIRED_FALSE_FLAGS,
    CANARY_V75_REQUIRED_TRUE_FLAGS,
    buildCanaryV75RecipientQuery,
    evaluateCanaryV75ExternalEffect,
    evaluateCanaryV75Recipient,
    resolveCanaryV75Configuration
} from '../src/services/canaryIsolationV75Service.js';
import { automatedVslEntryAgentForState } from '../src/services/agentRouter.js';
import { vslNitrixSourceConfirmed } from '../src/services/nitrixFastStateService.js';
import { publicEcVslProductFromBody } from '../src/routes/whatsapp.js';
import {
    sendBrowserServerEvent,
    sendPurchaseEventForOrder
} from '../src/services/metaConversionsService.js';
import { syncActiveDroppiEcuadorOrdersFromPanel } from '../src/services/droppiEcuadorBrowserService.js';

const read = (file) => fs.readFileSync(file, 'utf8');

const completeCanaryEnv = (overrides = {}) => {
    const env = {
        NODE_ENV: 'production',
        DISABLE_SCHEDULER: '0',
        DROPPI_EC_ACTIVE_SYNC_MODE: 'REPORT_ONLY',
        POST_SALE_V66_MUTATIONS_AUTHORIZATION: 'I_UNDERSTAND_V66_OPERATIONAL_MUTATIONS',
        META_TEST_EVENT_CODE_EC: '',
        META_TEST_EVENT_CODE: '',
        VITALISMEN_CANARY_V75_ENABLED: 'true'
    };
    for (const flag of CANARY_V75_REQUIRED_TRUE_FLAGS) env[flag] = 'true';
    for (const flag of CANARY_V75_REQUIRED_FALSE_FLAGS) env[flag] = 'false';
    for (const flag of CANARY_V75_RECIPIENT_LIST_FLAGS) env[flag] = CANARY_V75_QA_PHONE;
    return { ...env, ...overrides };
};

const withProcessEnv = async (values, operation) => {
    const previous = new Map(Object.keys(values).map((key) => [key, process.env[key]]));
    Object.assign(process.env, values);
    try {
        return await operation();
    } finally {
        for (const [key, value] of previous) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    }
};

test('V75 permanece dormente até ser armada por sua flag explícita', () => {
    assert.deepEqual(resolveCanaryV75Configuration({}), {
        enabled: false,
        ready: false,
        qaPhone: CANARY_V75_QA_PHONE,
        failures: []
    });

    const operationalWithoutV75 = resolveCanaryV75Configuration({
        VIT_POWER_OPERATIONAL_AUTOMATION_APPROVED: 'true',
        WHATSAPP_AUTOMATION_PILOT_ONLY: 'true'
    });
    assert.equal(operationalWithoutV75.enabled, false);
    assert.equal(operationalWithoutV75.ready, false);
    assert.deepEqual(operationalWithoutV75.failures, []);

    const productionPilotWithoutV75 = resolveCanaryV75Configuration({
        NODE_ENV: 'production',
        VIT_POWER_OPERATIONAL_AUTOMATION_APPROVED: 'true',
        WHATSAPP_AUTOMATION_PILOT_ONLY: 'true'
    });
    assert.equal(productionPilotWithoutV75.enabled, true);
    assert.equal(productionPilotWithoutV75.ready, false);
    assert.ok(productionPilotWithoutV75.failures.includes('VITALISMEN_CANARY_V75_ENABLED_must_be_true'));
});

test('contrato completo aceita somente todas as flags acopladas e cinco allowlists unitárias', () => {
    const ready = resolveCanaryV75Configuration(completeCanaryEnv());
    assert.equal(ready.enabled, true);
    assert.equal(ready.ready, true);
    assert.deepEqual(ready.failures, []);

    for (const flag of CANARY_V75_RECIPIENT_LIST_FLAGS) {
        const invalid = resolveCanaryV75Configuration(completeCanaryEnv({
            [flag]: `${CANARY_V75_QA_PHONE},593991234567`
        }));
        assert.equal(invalid.ready, false, `${flag} não pode aceitar segundo destinatário`);
        assert.ok(invalid.failures.includes(`${flag}_must_contain_only_QA`));
    }
});

test('destinatário V75 é igualdade integral: nenhum sufixo, cliente real, oficial ou vazio atravessa', () => {
    const env = completeCanaryEnv();
    assert.equal(evaluateCanaryV75Recipient(CANARY_V75_QA_PHONE, { env }).allowed, true);
    assert.equal(evaluateCanaryV75Recipient(`+55 (15) 99803-8637@s.whatsapp.net`, { env }).allowed, true);
    assert.equal(evaluateCanaryV75Recipient('593991234567', { env }).allowed, false);
    assert.equal(evaluateCanaryV75Recipient('5515991418416', { env }).allowed, false);
    assert.equal(evaluateCanaryV75Recipient(`593${CANARY_V75_QA_PHONE}`, { env }).allowed, false);
    assert.equal(evaluateCanaryV75Recipient('', { env }).allowed, false);
    assert.equal(evaluateCanaryV75Recipient(CANARY_V75_QA_PHONE, {
        env: completeCanaryEnv({ PICKUP_PROOF_SWEEP_ENABLED: 'false' })
    }).allowed, false);
});

test('consulta Mongo do canário usa telefone completo e falha fechada quando a configuração diverge', () => {
    const query = buildCanaryV75RecipientQuery('client.phone', completeCanaryEnv());
    const matcher = query['client.phone'];
    assert.ok(matcher instanceof RegExp);
    assert.equal(matcher.test('+55 (15) 99803-8637'), true);
    assert.equal(matcher.test(CANARY_V75_QA_PHONE), true);
    assert.equal(matcher.test(`593${CANARY_V75_QA_PHONE}`), false);
    assert.equal(matcher.test(`${CANARY_V75_QA_PHONE}0`), false);
    assert.deepEqual(
        buildCanaryV75RecipientQuery('client.phone', completeCanaryEnv({ DISABLE_SCHEDULER: '1' })),
        { _id: { $exists: false } }
    );
});

test('/n/ sempre resolve Tex Ultra, inclusive contra chave Nitrix legada, sem capturar /nitrix', () => {
    assert.equal(publicEcVslProductFromBody({
        path: '/n/',
        productKey: 'nitrix_ec'
    }).productKey, 'tex_ultra_ec');
    assert.equal(publicEcVslProductFromBody({
        event_source_url: 'https://ec.maxlien.shop/n/?utm_source=qa',
        productKey: 'nitrix_ec'
    }).productKey, 'tex_ultra_ec');
    assert.equal(publicEcVslProductFromBody({
        event_source_url: 'ec.maxlien.shop/n/',
        productKey: 'nitrix_ec'
    }).productKey, 'tex_ultra_ec');
    assert.equal(publicEcVslProductFromBody({
        path: '/nitrix/',
        productKey: 'nitrix_ec'
    }).productKey, 'nitrix_ec');
});

test('predicado Nitrix rejeita origem /n/ conflitante e aceita somente origem Nitrix explícita', () => {
    const legacyConflict = {
        human: { lastManualBy: 'vsl_ec' },
        metadata: {
            productKey: 'nitrix_ec',
            vslProductKey: 'nitrix_ec',
            vslProductSource: 'ec_nitrix_vsl',
            vslPath: '/n/',
            vslEntryPanelLead: true,
            customerDraft: { productKey: 'nitrix_ec' }
        }
    };
    assert.equal(vslNitrixSourceConfirmed(legacyConflict), false);
    assert.equal(automatedVslEntryAgentForState(legacyConflict), '');
    assert.equal(vslNitrixSourceConfirmed({
        ...legacyConflict,
        metadata: { ...legacyConflict.metadata, vslPath: '', vslSourceUrl: 'ec.maxlien.shop/n/' }
    }), false);

    const explicitNitrix = {
        ...legacyConflict,
        metadata: {
            ...legacyConflict.metadata,
            vslPath: '/nitrix/',
            vslProductSource: 'ec_nitrix_vsl'
        }
    };
    assert.equal(vslNitrixSourceConfirmed(explicitNitrix), true);
    assert.equal(automatedVslEntryAgentForState(explicitNitrix), 'nitrix_ec');
});

test('Meta é bloqueada antes de enriquecimento, payload ou rede no canário', async () => {
    const env = completeCanaryEnv();
    let touched = false;
    const browser = await sendBrowserServerEvent({ country: 'EC' }, null, {
        env,
        fetchImpl: async () => {
            touched = true;
            throw new Error('network_must_not_run');
        }
    });
    const purchase = await sendPurchaseEventForOrder({ country: 'EC' }, {
        env,
        attributionEnricher: async () => {
            touched = true;
            throw new Error('enrichment_must_not_run');
        }
    });
    assert.equal(browser.reason, 'canary_v75_meta_blocked');
    assert.equal(purchase.reason, 'canary_v75_meta_blocked');
    assert.equal(touched, false);
});

test('Dropi é bloqueado antes de ciclo, banco ou navegador no canário', { concurrency: false }, async () => {
    await withProcessEnv(completeCanaryEnv(), async () => {
        const result = await syncActiveDroppiEcuadorOrdersFromPanel({ mode: 'APPLY' });
        assert.equal(result.blocked, true);
        assert.equal(result.reason, 'canary_v75_dropi_blocked');
        assert.equal(result.mode, 'REPORT_ONLY');
        assert.equal(result.dryRun, true);
        assert.deepEqual(result.synced, []);
    });
});

test('efeitos externos permanecem bloqueados mesmo quando o telefone QA é válido', () => {
    const env = completeCanaryEnv();
    assert.equal(evaluateCanaryV75ExternalEffect('dropi', env).allowed, false);
    assert.equal(evaluateCanaryV75ExternalEffect('meta', env).allowed, false);
});

test('integrações críticas mantêm gate antes de persistência/provider e filtro nos quatro schedulers', () => {
    const zapiClient = read('src/services/zapiClient.js');
    const zapiRoute = read('src/routes/zapi.js');
    const whatsappRoute = read('src/routes/whatsapp.js');
    const dispatcher = read('src/whatsapp/dispatcher.js');
    const router = read('src/services/agentRouter.js');
    const status = read('src/services/shipmentStatusDispatcherService.js');
    const pickup = read('src/services/shipmentMessageService.js');
    const expanded = read('src/services/postSalePickupReconciliationService.js');
    const decision = read('src/services/postSaleNotificationDecisionService.js');
    const meta = read('src/services/metaConversionsService.js');
    const dropi = read('src/services/droppiEcuadorBrowserService.js');
    const senior = read('scripts/senior-guard.mjs');

    assert.ok(zapiClient.indexOf("assertCanaryV75Recipient(cleanPhone, { surface: 'zapi_provider_text' })") < zapiClient.indexOf('await axios.post'));
    assert.match(zapiRoute, /canaryV75InboundDecision\(payload, 'zapi_received_webhook'\)/);
    assert.match(whatsappRoute, /vslCanaryV75AcceptedPayload\(body, country, 'vsl_entry'\)/);
    assert.match(dispatcher, /surface: 'baileys_dispatcher_inbound'/);
    const routeIncomingStart = router.indexOf('export const routeIncomingMessage');
    assert.ok(router.indexOf("surface: 'agent_router_inbound'", routeIncomingStart) < router.indexOf('findContinuityContactState', routeIncomingStart));
    assert.match(status, /buildCanaryV75RecipientQuery\('client\.phone'\)/);
    assert.match(status, /processCarrierStatusSweep[\s\S]*canaryV75SchedulerShipmentAllowed/);
    assert.match(pickup, /processPickupProofSweep[\s\S]*buildCanaryV75RecipientQuery/);
    assert.match(pickup, /processShipmentPickupReminders[\s\S]*canaryV75SchedulerShipmentAllowed/);
    assert.match(expanded, /processExpandedPickupConfirmationSweep[\s\S]*buildCanaryV75RecipientQuery/);
    assert.match(decision, /canaryV75SchedulerShipmentAllowed/);
    assert.ok(meta.indexOf("canaryV75BlockedResult('meta'") < meta.indexOf('attributionEnricher'));
    assert.match(dropi, /assertCanaryV75ExternalEffectBlocked\('dropi'\)/);
    assert.match(senior, /PICKUP_PROOF_SWEEP_ENABLED', 'true'/);
    assert.match(senior, /PICKUP_PROOF_SWEEP_ENABLED', 'false'/);
});
