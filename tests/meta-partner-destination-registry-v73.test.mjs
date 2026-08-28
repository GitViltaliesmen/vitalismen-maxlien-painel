import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import healthRoutes from '../src/routes/health.js';
import {
    META_DESTINATION_ROUTES,
    META_EC_TEX_ULTRA_PROTOCOLO_G_LOCKED_DATASET_ID,
    publicMetaDestinationDescriptor,
    resolveMetaDestination
} from '../src/services/metaDestinationRegistryService.js';
import {
    getMetaConfigForCountry,
    getMetaConfigForOrder,
    getPublicMetaDestinationForRoute,
    sendBrowserServerEvent
} from '../src/services/metaConversionsService.js';
import { runMetaDestinationCli } from '../scripts/manage-meta-destinations-v73.mjs';

const PRIMARY_DATASET = '1468946114265008';
const PARTNER_DATASET = '9988776655443322';
const LEGACY_TOKEN = 'token-legacy-sintetico-nao-real-v73';
const PARTNER_TOKEN = 'token-partner-sintetico-nao-real-v73';
const VERIFIED_AT = '2026-08-28T03:00:00.000Z';

const createWorkspace = () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'meta-registry-v73-'));
    return {
        directory,
        registryPath: path.join(directory, 'meta-destinations.json'),
        secretsPath: path.join(directory, 'meta-destinations.secrets.json')
    };
};

const registryDocument = ({ activePrimary = 'ec-primary', profiles = {} } = {}) => ({
    version: 1,
    updatedAt: VERIFIED_AT,
    activeRoutes: {
        [META_DESTINATION_ROUTES.EC_DEFAULT]: activePrimary,
        [META_DESTINATION_ROUTES.EC_TEX_ULTRA_PROTOCOLO_G]: 'ec-protocolo-g'
    },
    profiles: {
        'ec-primary': {
            label: 'EC principal',
            route: META_DESTINATION_ROUTES.EC_DEFAULT,
            datasetId: PRIMARY_DATASET,
            browserPixelId: PRIMARY_DATASET,
            accessTokenRefs: ['env:META_ACCESS_TOKEN_EC'],
            browserDeploymentVerifiedAt: VERIFIED_AT,
            enabled: true
        },
        'ec-protocolo-g': {
            label: 'EC Protocolo G',
            route: META_DESTINATION_ROUTES.EC_TEX_ULTRA_PROTOCOLO_G,
            datasetId: META_EC_TEX_ULTRA_PROTOCOLO_G_LOCKED_DATASET_ID,
            browserPixelId: META_EC_TEX_ULTRA_PROTOCOLO_G_LOCKED_DATASET_ID,
            accessTokenRefs: ['env:META_ACCESS_TOKEN_EC'],
            browserDeploymentVerifiedAt: VERIFIED_AT,
            enabled: true
        },
        ...profiles
    }
});

const writeJson = (filePath, value) => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
    fs.chmodSync(filePath, 0o600);
};

const withWorkspace = async (operation) => {
    const workspace = createWorkspace();
    try {
        return await operation(workspace);
    } finally {
        fs.rmSync(workspace.directory, { recursive: true, force: true });
    }
};

test('ausência do registry preserva exatamente o contrato EC legado e isola env sintético', () => {
    const env = {
        META_PIXEL_ID_EC: PRIMARY_DATASET,
        META_ACCESS_TOKEN_EC: LEGACY_TOKEN
    };
    const destination = getMetaConfigForCountry('EC', env);
    assert.equal(destination.pixelId, PRIMARY_DATASET);
    assert.equal(destination.accessToken, LEGACY_TOKEN);
    assert.equal(destination.route, META_DESTINATION_ROUTES.EC_DEFAULT);
    assert.deepEqual(Object.keys(destination).sort(), ['accessToken', 'pixelId', 'route']);
    const descriptor = publicMetaDestinationDescriptor(destination);
    assert.equal(descriptor.browserPixelId, PRIMARY_DATASET);
    assert.equal(descriptor.browserServerSynchronized, true);
    assert.equal(descriptor.source, 'legacy_env');
});

test('registry válido usa o mesmo ID no Browser Pixel e no CAPI sem expor token', async () => withWorkspace((workspace) => {
    writeJson(workspace.registryPath, registryDocument());
    const env = {
        META_DESTINATION_REGISTRY_PATH: workspace.registryPath,
        META_DESTINATION_SECRETS_PATH: workspace.secretsPath,
        META_ACCESS_TOKEN_EC: LEGACY_TOKEN
    };
    const destination = resolveMetaDestination({
        route: META_DESTINATION_ROUTES.EC_DEFAULT,
        env,
        legacyConfig: {}
    });
    assert.equal(destination.pixelId, PRIMARY_DATASET);
    assert.equal(destination.browserPixelId, PRIMARY_DATASET);
    assert.equal(destination.accessToken, LEGACY_TOKEN);
    assert.equal(destination.browserServerSynchronized, true);
    assert.equal(destination.source, 'shared_registry');

    const publicDescriptor = publicMetaDestinationDescriptor(destination);
    assert.equal(publicDescriptor.datasetId, PRIMARY_DATASET);
    assert.equal(publicDescriptor.browserPixelId, PRIMARY_DATASET);
    assert.equal(publicDescriptor.available, true);
    assert.equal(publicDescriptor.tokenConfigured, true);
    assert.equal(JSON.stringify(publicDescriptor).includes(LEGACY_TOKEN), false);
    assert.equal(Object.hasOwn(publicDescriptor, 'accessToken'), false);
}));

test('registry é recarregado por leitura e troca perfil ativo sem reiniciar processo', async () => withWorkspace((workspace) => {
    const partnerProfile = {
        'ec-partner-next': {
            label: 'EC parceiro futuro',
            route: META_DESTINATION_ROUTES.EC_DEFAULT,
            datasetId: PARTNER_DATASET,
            browserPixelId: PARTNER_DATASET,
            accessTokenRefs: ['env:META_ACCESS_TOKEN_PARTNER'],
            browserDeploymentVerifiedAt: VERIFIED_AT,
            enabled: true
        }
    };
    writeJson(workspace.registryPath, registryDocument({ profiles: partnerProfile }));
    const env = {
        META_DESTINATION_REGISTRY_PATH: workspace.registryPath,
        META_ACCESS_TOKEN_EC: LEGACY_TOKEN,
        META_ACCESS_TOKEN_PARTNER: PARTNER_TOKEN
    };
    assert.equal(getMetaConfigForCountry('EC', env).pixelId, PRIMARY_DATASET);
    writeJson(workspace.registryPath, registryDocument({
        activePrimary: 'ec-partner-next',
        profiles: partnerProfile
    }));
    const switched = getMetaConfigForCountry('EC', env);
    assert.equal(switched.pixelId, PARTNER_DATASET);
    assert.equal(switched.browserPixelId, PARTNER_DATASET);
    assert.equal(switched.accessToken, PARTNER_TOKEN);
    assert.equal(switched.profile, 'ec-partner-next');
}));

test('binding mantém sessão aberta no mesmo Dataset durante uma troca ativa', async () => withWorkspace(async (workspace) => {
    const partnerProfile = {
        'ec-partner-next': {
            label: 'EC parceiro futuro',
            route: META_DESTINATION_ROUTES.EC_DEFAULT,
            datasetId: PARTNER_DATASET,
            browserPixelId: PARTNER_DATASET,
            accessTokenRefs: ['env:META_ACCESS_TOKEN_PARTNER'],
            browserDeploymentVerifiedAt: VERIFIED_AT,
            enabled: true
        }
    };
    writeJson(workspace.registryPath, registryDocument({ profiles: partnerProfile }));
    const env = {
        META_DESTINATION_REGISTRY_PATH: workspace.registryPath,
        META_ACCESS_TOKEN_EC: LEGACY_TOKEN,
        META_ACCESS_TOKEN_PARTNER: PARTNER_TOKEN
    };
    const bindingNow = Date.parse('2026-08-28T04:00:00.000Z');
    const browserDestination = getPublicMetaDestinationForRoute(
        META_DESTINATION_ROUTES.EC_DEFAULT,
        env,
        { now: bindingNow }
    );
    assert.equal(browserDestination.datasetId, PRIMARY_DATASET);
    assert.equal(browserDestination.bindingVersion, 1);
    assert.match(browserDestination.binding, /^[A-Za-z0-9_-]{40,64}$/);
    assert.equal(JSON.stringify(browserDestination).includes(LEGACY_TOKEN), false);

    writeJson(workspace.registryPath, registryDocument({
        activePrimary: 'ec-partner-next',
        profiles: partnerProfile
    }));
    const oldSession = await sendBrowserServerEvent({
        country: 'EC',
        eventName: 'Lead',
        event_id: 'BINDING_OLD_SESSION_V73',
        external_id: 'binding-old-session-v73',
        meta_destination: browserDestination
    }, null, { dryRun: true, env, now: bindingNow + 1_000 });
    assert.equal(oldSession.ok, true);
    assert.equal(oldSession.datasetId, PRIMARY_DATASET);
    assert.equal(oldSession.datasetRoute, META_DESTINATION_ROUTES.EC_DEFAULT);

    const newSession = await sendBrowserServerEvent({
        country: 'EC',
        eventName: 'Lead',
        event_id: 'BINDING_NEW_SESSION_V73',
        external_id: 'binding-new-session-v73'
    }, null, { dryRun: true, env, now: bindingNow + 1_000 });
    assert.equal(newSession.ok, true);
    assert.equal(newSession.datasetId, PARTNER_DATASET);

    const tampered = await sendBrowserServerEvent({
        country: 'EC',
        eventName: 'Lead',
        event_id: 'BINDING_TAMPERED_V73',
        external_id: 'binding-tampered-v73',
        meta_destination: { ...browserDestination, datasetId: PARTNER_DATASET }
    }, null, { dryRun: true, env, now: bindingNow + 1_000 });
    assert.equal(tampered.ok, false);
    assert.equal(tampered.error, 'META pixel config missing for country');
}));

test('caminho de registry explicitamente configurado e ausente falha fechado', async () => withWorkspace((workspace) => {
    const destination = getMetaConfigForCountry('EC', {
        META_DESTINATION_REGISTRY_PATH: workspace.registryPath,
        META_PIXEL_ID_EC: PRIMARY_DATASET,
        META_ACCESS_TOKEN_EC: LEGACY_TOKEN
    });
    assert.equal(destination.pixelId, null);
    assert.equal(destination.errorCode, 'META_DESTINATION_REGISTRY_MISSING');
    assert.match(destination.route, /registry_blocked$/);
}));

test('divergência Browser/CAPI falha fechada e não volta ao pixel legado', async () => withWorkspace((workspace) => {
    const invalid = registryDocument();
    invalid.profiles['ec-primary'].browserPixelId = PARTNER_DATASET;
    writeJson(workspace.registryPath, invalid);
    const destination = getMetaConfigForCountry('EC', {
        META_DESTINATION_REGISTRY_PATH: workspace.registryPath,
        META_PIXEL_ID_EC: PRIMARY_DATASET,
        META_ACCESS_TOKEN_EC: LEGACY_TOKEN
    });
    assert.equal(destination.pixelId, null);
    assert.equal(destination.browserPixelId, null);
    assert.equal(destination.accessToken, null);
    assert.equal(destination.browserServerSynchronized, false);
    assert.equal(destination.errorCode, 'META_BROWSER_SERVER_DATASET_MISMATCH');
    assert.match(destination.route, /registry_blocked$/);
}));

test('registry público rejeita campos extras que poderiam esconder token ou configuração paralela', async () => withWorkspace((workspace) => {
    const invalid = registryDocument();
    invalid.profiles['ec-primary'].accessToken = LEGACY_TOKEN;
    writeJson(workspace.registryPath, invalid);
    const destination = getMetaConfigForCountry('EC', {
        META_DESTINATION_REGISTRY_PATH: workspace.registryPath,
        META_ACCESS_TOKEN_EC: LEGACY_TOKEN
    });
    assert.equal(destination.pixelId, null);
    assert.equal(destination.errorCode, 'META_DESTINATION_SCHEMA_UNKNOWN_FIELD');
    assert.equal(JSON.stringify(destination).includes(LEGACY_TOKEN), false);
}));

test('caminho relativo de secrets falha fechado mesmo quando o registry é válido', async () => withWorkspace((workspace) => {
    writeJson(workspace.registryPath, registryDocument());
    const destination = getMetaConfigForCountry('EC', {
        META_DESTINATION_REGISTRY_PATH: workspace.registryPath,
        META_DESTINATION_SECRETS_PATH: 'relative/meta-secrets.json',
        META_ACCESS_TOKEN_EC: LEGACY_TOKEN
    });
    assert.equal(destination.pixelId, null);
    assert.equal(destination.errorCode, 'META_DESTINATION_SECRETS_PATH_INVALID');
}));

test('Dataset dedicado Protocolo G continua congelado e falha fechado se for substituído', async () => withWorkspace((workspace) => {
    const invalid = registryDocument();
    invalid.profiles['ec-protocolo-g'].datasetId = PARTNER_DATASET;
    invalid.profiles['ec-protocolo-g'].browserPixelId = PARTNER_DATASET;
    writeJson(workspace.registryPath, invalid);
    const order = {
        country: 'EC',
        tracking: { productKey: 'tex_ultra_ec', product: 'TEX_ULTRA', funnel: 'PROTOCOLO_G' }
    };
    const destination = getMetaConfigForOrder(order, {
        META_DESTINATION_REGISTRY_PATH: workspace.registryPath,
        META_ACCESS_TOKEN_EC: LEGACY_TOKEN
    });
    assert.equal(destination.pixelId, null);
    assert.equal(destination.errorCode, 'META_PROTOCOLO_G_DATASET_LOCKED');
}));

test('token secret: é lido somente de arquivo 0600 e nunca aparece no descritor público', async () => withWorkspace((workspace) => {
    const secretToken = 'token-secret-sintetico-nao-real-v73';
    const document = registryDocument();
    document.profiles['ec-primary'].accessTokenRefs = ['secret:ec_primary_v2'];
    writeJson(workspace.registryPath, document);
    writeJson(workspace.secretsPath, { version: 1, tokens: { ec_primary_v2: secretToken } });
    const destination = resolveMetaDestination({
        route: META_DESTINATION_ROUTES.EC_DEFAULT,
        env: {
            META_DESTINATION_REGISTRY_PATH: workspace.registryPath,
            META_DESTINATION_SECRETS_PATH: workspace.secretsPath
        }
    });
    assert.equal(destination.accessToken, secretToken);
    assert.equal(destination.tokenSource, 'secret:ec_primary_v2');
    assert.equal(JSON.stringify(publicMetaDestinationDescriptor(destination)).includes(secretToken), false);
}));

test('endpoint público de configuração retorna somente destino sincronizado e redigido', async () => withWorkspace(async (workspace) => {
    writeJson(workspace.registryPath, registryDocument());
    const previous = {
        registry: process.env.META_DESTINATION_REGISTRY_PATH,
        secrets: process.env.META_DESTINATION_SECRETS_PATH,
        pixel: process.env.META_PIXEL_ID_EC,
        token: process.env.META_ACCESS_TOKEN_EC
    };
    process.env.META_DESTINATION_REGISTRY_PATH = workspace.registryPath;
    process.env.META_DESTINATION_SECRETS_PATH = workspace.secretsPath;
    process.env.META_PIXEL_ID_EC = PRIMARY_DATASET;
    process.env.META_ACCESS_TOKEN_EC = LEGACY_TOKEN;
    const layer = healthRoutes.stack.find((item) => item.route?.path === '/meta-destination');
    assert.ok(layer);
    let statusCode = 0;
    let payload = null;
    const headers = {};
    const res = {
        set(name, value) { headers[name] = value; return this; },
        status(code) { statusCode = code; return this; },
        json(value) { payload = value; return value; }
    };
    try {
        layer.route.stack.at(-1).handle({}, res);
    } finally {
        const restore = (key, value) => {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        };
        restore('META_DESTINATION_REGISTRY_PATH', previous.registry);
        restore('META_DESTINATION_SECRETS_PATH', previous.secrets);
        restore('META_PIXEL_ID_EC', previous.pixel);
        restore('META_ACCESS_TOKEN_EC', previous.token);
    }
    assert.equal(statusCode, 200);
    assert.equal(headers['Cache-Control'], 'no-store, max-age=0');
    assert.equal(payload.ok, true);
    assert.equal(payload.destination.datasetId, PRIMARY_DATASET);
    assert.equal(payload.destination.browserPixelId, PRIMARY_DATASET);
    assert.equal(payload.destination.available, true);
    assert.equal(Object.hasOwn(payload.destination, 'accessToken'), false);
    assert.equal(JSON.stringify(payload).includes(LEGACY_TOKEN), false);
}));

test('VSL /n/ resolve configuração server-side e bloqueia fallback silencioso e noscript fixo', () => {
    const page = fs.readFileSync(new URL('../public/n/index.html', import.meta.url), 'utf8');
    const whatsappRoute = fs.readFileSync(new URL('../src/routes/whatsapp.js', import.meta.url), 'utf8');
    const leadsRoute = fs.readFileSync(new URL('../src/routes/leads.js', import.meta.url), 'utf8');
    assert.match(page, /CONFIG_URL = "\/api\/health\/meta-destination"/);
    assert.match(page, /destination\.available/);
    assert.match(page, /destination\.bindingVersion/);
    assert.match(page, /meta_destination/);
    assert.match(page, /__MAXLIEN_META_PIXEL_READY/);
    assert.match(page, /Promise\.resolve\(metaReady\).*\.then\(sendEntry\)/s);
    assert.match(page, /meta_browser_server_mismatch/);
    assert.match(page, /Browser Pixel bloqueado/);
    assert.doesNotMatch(page, /page_fallback/);
    assert.doesNotMatch(page, /facebook\.com\/tr\?id=/);
    assert.doesNotMatch(page, /fbq\(['"]init['"],\s*['"]\d{8,25}['"]/);
    assert.doesNotMatch(page, /META_ACCESS_TOKEN_EC/);
    assert.match(whatsappRoute, /meta_destination: body\.meta_destination \?\? body\.metaDestination/);
    assert.match(leadsRoute, /meta_destination: body\?\.meta_destination \?\? body\?\.metaDestination/);
});

test('binding malformado presente falha fechado em vez de cair no perfil ativo', async () => {
    const result = await sendBrowserServerEvent({
        country: 'EC',
        eventName: 'Lead',
        event_id: 'BINDING_MALFORMED_V73',
        external_id: 'binding-malformed-v73',
        meta_destination: 'not-an-object'
    }, null, {
        dryRun: true,
        env: {
            META_PIXEL_ID_EC: PRIMARY_DATASET,
            META_ACCESS_TOKEN_EC: LEGACY_TOKEN
        }
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, 'META pixel config missing for country');
});

test('helper gera plano de parceiro sem troca de Pixel, token, mutação de runtime ou restart', async () => withWorkspace(async (workspace) => {
    const env = {
        META_DESTINATION_REGISTRY_PATH: workspace.registryPath,
        META_DESTINATION_SECRETS_PATH: workspace.secretsPath,
        META_PIXEL_ID_EC: PRIMARY_DATASET,
        META_ACCESS_TOKEN_EC: LEGACY_TOKEN,
        META_DESTINATION_CHANGE_APPROVED: 'I_UNDERSTAND_META_BROWSER_SERVER_ATOMIC_CHANGE',
        META_DESTINATION_TEST_MODE: 'true'
    };
    const bootstrap = await runMetaDestinationCli({
        argv: ['bootstrap', `--browser-verified-at=${VERIFIED_AT}`, '--apply'],
        env
    });
    assert.equal(bootstrap.mode, 'APPLY');
    const plan = await runMetaDestinationCli({
        argv: ['plan-partner', '--business-id=123456789012345', '--ad-account-id=987654321098765'],
        env
    });
    assert.equal(plan.mode, 'SHARE_EXISTING_DATASET_WITH_PARTNER');
    assert.equal(plan.datasetId, PRIMARY_DATASET);
    assert.equal(plan.runtimeChangeRequired, false);
    assert.equal(plan.siteRestartRequired, false);
    assert.equal(plan.profile, 'ec-primary');
    assert.match(plan.steps.join(' '), /Não criar Pixel paralelo/);
    assert.equal(JSON.stringify(plan).includes(LEGACY_TOKEN), false);
}));

test('plano de parceiro sempre usa o perfil ativo e recusa perfil histórico', async () => withWorkspace(async (workspace) => {
    const profiles = {
        'ec-partner-next': {
            label: 'EC parceiro ativo',
            route: META_DESTINATION_ROUTES.EC_DEFAULT,
            datasetId: PARTNER_DATASET,
            browserPixelId: PARTNER_DATASET,
            accessTokenRefs: ['env:META_ACCESS_TOKEN_PARTNER'],
            browserDeploymentVerifiedAt: VERIFIED_AT,
            enabled: true
        }
    };
    writeJson(workspace.registryPath, registryDocument({ activePrimary: 'ec-partner-next', profiles }));
    const env = {
        META_DESTINATION_REGISTRY_PATH: workspace.registryPath,
        META_DESTINATION_SECRETS_PATH: workspace.secretsPath,
        META_DESTINATION_TEST_MODE: 'true'
    };
    const plan = await runMetaDestinationCli({
        argv: ['plan-partner', '--business-id=123456789012345', '--ad-account-id=987654321098765'],
        env
    });
    assert.equal(plan.profile, 'ec-partner-next');
    assert.equal(plan.datasetId, PARTNER_DATASET);
    await assert.rejects(runMetaDestinationCli({
        argv: [
            'plan-partner', '--business-id=123456789012345', '--ad-account-id=987654321098765',
            '--profile=ec-primary'
        ],
        env
    }), /não é o perfil ativo/);
}));

test('helper rejeita caminhos relativos antes de qualquer leitura ou escrita', async () => {
    await assert.rejects(runMetaDestinationCli({
        argv: ['status', '--registry=relative/meta.json', '--secrets=relative/secrets.json'],
        env: { META_DESTINATION_TEST_MODE: 'true' }
    }), /caminhos absolutos/);
});

test('lock existente bloqueia mutação concorrente antes de criar o registry', async () => withWorkspace(async (workspace) => {
    const lockPath = path.join(path.dirname(workspace.registryPath), '.meta-destination-change.lock');
    fs.writeFileSync(lockPath, '{"owner":"other-process"}\n', { mode: 0o600 });
    const env = {
        META_DESTINATION_REGISTRY_PATH: workspace.registryPath,
        META_DESTINATION_SECRETS_PATH: workspace.secretsPath,
        META_PIXEL_ID_EC: PRIMARY_DATASET,
        META_ACCESS_TOKEN_EC: LEGACY_TOKEN,
        META_DESTINATION_CHANGE_APPROVED: 'I_UNDERSTAND_META_BROWSER_SERVER_ATOMIC_CHANGE',
        META_DESTINATION_TEST_MODE: 'true'
    };
    await assert.rejects(runMetaDestinationCli({
        argv: ['bootstrap', `--browser-verified-at=${VERIFIED_AT}`, '--apply'],
        env
    }), /Outra alteração Meta está em andamento/);
    assert.equal(fs.existsSync(workspace.registryPath), false);
    assert.equal(fs.existsSync(lockPath), true);
}));

test('helper impede editar perfil ativo e só ativa perfil completo em operação atômica', async () => withWorkspace(async (workspace) => {
    const env = {
        META_DESTINATION_REGISTRY_PATH: workspace.registryPath,
        META_DESTINATION_SECRETS_PATH: workspace.secretsPath,
        META_PIXEL_ID_EC: PRIMARY_DATASET,
        META_ACCESS_TOKEN_EC: LEGACY_TOKEN,
        META_DESTINATION_CHANGE_APPROVED: 'I_UNDERSTAND_META_BROWSER_SERVER_ATOMIC_CHANGE',
        META_DESTINATION_TEST_MODE: 'true'
    };
    await runMetaDestinationCli({
        argv: ['bootstrap', `--browser-verified-at=${VERIFIED_AT}`, '--apply'],
        env
    });
    await assert.rejects(runMetaDestinationCli({
        argv: [
            'upsert-profile', '--profile=ec-primary', `--route=${META_DESTINATION_ROUTES.EC_DEFAULT}`,
            `--dataset-id=${PARTNER_DATASET}`, '--token-refs=env:META_ACCESS_TOKEN_EC',
            `--browser-verified-at=${VERIFIED_AT}`, '--apply'
        ],
        env
    }), /Perfil ativo é imutável/);

    await runMetaDestinationCli({
        argv: [
            'upsert-profile', '--profile=ec-partner-next', `--route=${META_DESTINATION_ROUTES.EC_DEFAULT}`,
            `--dataset-id=${PARTNER_DATASET}`, '--token-refs=env:META_ACCESS_TOKEN_PARTNER',
            `--browser-verified-at=${VERIFIED_AT}`, '--apply'
        ],
        env
    });
    await assert.rejects(runMetaDestinationCli({
        argv: [
            'activate-profile', `--route=${META_DESTINATION_ROUTES.EC_DEFAULT}`,
            '--profile=ec-partner-next', '--apply'
        ],
        env
    }), /expected-current-profile/);

    await assert.rejects(runMetaDestinationCli({
        argv: [
            'activate-profile', `--route=${META_DESTINATION_ROUTES.EC_DEFAULT}`,
            '--profile=ec-partner-next', '--expected-current-profile=ec-primary',
            `--expected-next-dataset-id=${PARTNER_DATASET}`, '--apply'
        ],
        env
    }), /Ativação bloqueada/);

    env.META_ACCESS_TOKEN_PARTNER = PARTNER_TOKEN;
    const activated = await runMetaDestinationCli({
        argv: [
            'activate-profile', `--route=${META_DESTINATION_ROUTES.EC_DEFAULT}`,
            '--profile=ec-partner-next', '--expected-current-profile=ec-primary',
            `--expected-next-dataset-id=${PARTNER_DATASET}`, '--apply'
        ],
        env
    });
    assert.equal(activated.registry.activeRoutes[META_DESTINATION_ROUTES.EC_DEFAULT], 'ec-partner-next');
    const live = resolveMetaDestination({
        route: META_DESTINATION_ROUTES.EC_DEFAULT,
        env
    });
    assert.equal(live.pixelId, PARTNER_DATASET);
    assert.equal(live.browserPixelId, PARTNER_DATASET);
    assert.equal(live.accessToken, PARTNER_TOKEN);
}));
