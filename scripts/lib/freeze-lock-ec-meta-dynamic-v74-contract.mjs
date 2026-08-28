import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const V74_FREEZE_ID = 'freeze-lock-ec-meta-dynamic-v74';
export const V74_SUCCESSOR_PATH = 'FREEZE_LOCK_EC_V74.json';
export const V74_LEGACY_FREEZE_PATH = 'FREEZE_LOCK_EC.json';
export const V74_LEGACY_FREEZE_SHA256 = '38fb689fe10e9d8d2794397ace313e0a71cbcf131691e7b87ac8b3aaa2be0603';
export const V74_PARENT_MANIFEST_SHA256 = 'f3892d723313493b9a3ecd88cba0635e912d8c7a3a7fc954ff3cd8cbc9cdb836';
export const V74_PARENT_FREEZE_SHA256 = '081d9ead48a78296b60ad4b3204facb1d773f411645dc1a35304f9bc44c83153';
export const V74_CURRENT_EC_DATASET_ID = '1468946114265008';
export const V74_LOCKED_SECONDARY_DATASET_ID = '2048099902484149';

const dynamicSourceFiles = Object.freeze([
    'public/n/index.html',
    'src/routes/health.js',
    'src/routes/orders.js',
    'src/routes/whatsapp.js',
    'src/services/conversationEngine.js',
    'src/services/metaConversionsService.js',
    'src/services/metaDestinationRegistryService.js',
    'src/services/texUltraFunnelService.js'
]);

const expectedOverrides = Object.freeze([
    Object.freeze({
        overrideId: 'meta-pixel-fixed-id-to-dynamic-destination',
        ruleId: 'meta_pixel_lead_ec_dataset',
        checkIndex: 0,
        expectedCheck: Object.freeze({
            type: 'includes',
            file: 'public/n/index.html',
            value: "fbq('init', '1468946114265008');"
        }),
        replacementContract: 'dynamic_browser_dataset_from_redacted_registry_endpoint'
    }),
    Object.freeze({
        overrideId: 'meta-lead-helper-to-v73-async-once-semantics',
        ruleId: 'meta_pixel_lead_ec_dataset',
        checkIndex: 1,
        expectedCheck: Object.freeze({
            type: 'includes',
            file: 'public/n/index.html',
            value: 'window.__mvpMarkLeadOnce = markLeadOnce;'
        }),
        replacementContract: 'v73_async_queue_then_session_lead_once_with_stable_event_id'
    }),
    Object.freeze({
        overrideId: 'site-entry-fixed-id-to-dynamic-destination',
        ruleId: 'site_entry_lead_panel_path_before_vsl_ab_ec',
        checkIndex: 4,
        expectedCheck: Object.freeze({
            type: 'includes',
            file: 'public/n/index.html',
            value: "fbq('init', '1468946114265008');"
        }),
        replacementContract: 'public_destination_then_browser_init_then_lead_and_vsl_path'
    })
]);

const normalize = (value) => String(value ?? '').replace(/\r\n/g, '\n');
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const stable = (value) => JSON.stringify(value);
const count = (body, regex) => (String(body).match(regex) || []).length;

const checkIdentity = (ruleId, checkIndex, check) => stable({
    ruleId,
    checkIndex,
    expectedCheck: {
        type: check?.type,
        file: check?.file,
        value: check?.value
    }
});

const expectedOverrideIdentities = new Map(expectedOverrides.map((override) => [
    checkIdentity(override.ruleId, override.checkIndex, override.expectedCheck),
    override
]));

const push = (failures, condition, message) => {
    if (!condition) failures.push(message);
};

const include = (failures, body, value, label) => push(
    failures,
    normalize(body).includes(normalize(value)),
    `${label}: trecho obrigatório ausente: ${value}`
);

const exactCount = (failures, body, regex, expected, label) => push(
    failures,
    count(body, regex) === expected,
    `${label}: contagem esperada ${expected}, encontrada ${count(body, regex)}`
);

const checkLegacyRule = ({ failures, rule, check, body }) => {
    const type = String(check.type || '').trim();
    const value = normalize(check.value || '');
    const label = `${rule.id} :: ${check.file}`;
    if (!type) return failures.push(`${label}: check sem tipo`);
    if (!value && type !== 'exists') return failures.push(`${label}: check sem valor`);
    if (type === 'exists') return;
    if (type === 'includes') return push(failures, body.includes(value), `${label}: trecho obrigatório ausente: ${value.slice(0, 180)}`);
    if (type === 'excludes') return push(failures, !body.includes(value), `${label}: trecho proibido voltou: ${value.slice(0, 180)}`);
    if (type === 'regexIncludes') return push(
        failures,
        new RegExp(value, check.flags || '').test(body),
        `${label}: regex obrigatória não encontrada: ${value}`
    );
    if (type === 'regexExcludes') return push(
        failures,
        !new RegExp(value, check.flags || '').test(body),
        `${label}: regex proibida voltou: ${value}`
    );
    failures.push(`${label}: tipo de check desconhecido: ${type}`);
};

const assertSuccessorEnvelope = ({ failures, legacyFreezeBytes, successor, parentManifestBytes, parentFreezeBytes }) => {
    push(failures, sha256(legacyFreezeBytes) === V74_LEGACY_FREEZE_SHA256, 'FREEZE_LOCK_EC.json legado não está byte-intacto');
    push(failures, successor?.freezeId === V74_FREEZE_ID, 'freezeId sucessor V74 inválido');
    push(failures, successor?.parentFreezeId === 'meta-partner-destination-registry-v73', 'parentFreezeId V73 inválido');
    push(failures, successor?.parentV73Commit === '6c759973f2d4de3f49bf8157a5a449b8aba4e894', 'commit pai V73 inválido');
    push(failures, successor?.parentV73Tree === '545089287546a4c51ad58cc93690014297a29a4c', 'tree pai V73 inválida');
    push(failures, successor?.parentV73ManifestSha256 === V74_PARENT_MANIFEST_SHA256, 'SHA declarado do manifesto V73 inválido');
    push(failures, sha256(parentManifestBytes) === V74_PARENT_MANIFEST_SHA256, 'manifesto V73 pai divergente');
    push(failures, successor?.parentV73FreezeSha256 === V74_PARENT_FREEZE_SHA256, 'SHA declarado do freeze V73 inválido');
    push(failures, sha256(parentFreezeBytes) === V74_PARENT_FREEZE_SHA256, 'documento freeze V73 pai divergente');
    push(failures, successor?.legacyFreezePath === V74_LEGACY_FREEZE_PATH, 'caminho do freeze legado inválido');
    push(failures, successor?.legacyFreezeSha256 === V74_LEGACY_FREEZE_SHA256, 'SHA declarado do freeze legado inválido');
    push(failures, successor?.rootCause === 'LEGACY_FREEZE_CONTRACT_INCOMPATIBLE_WITH_V73_DYNAMIC_META_DESTINATION', 'root cause V74 inválida');
    push(failures, successor?.status === 'implementation_validated', 'status do contrato sucessor inválido');
    push(failures, successor?.country === 'EC', 'país do contrato sucessor inválido');

    const policy = successor?.policy || {};
    const policyChecks = [
        [policy.contractVersion === 74, 'versão de contrato V74 inválida'],
        [policy.legacyFreezePreserved === true, 'preservação do freeze legado não declarada'],
        [policy.authorizedLegacyOverrideCount === 3, 'quantidade de overrides autorizados deve ser exatamente 3'],
        [policy.fixedPixelRequiredInHtml === false, 'Pixel fixo não pode ser requerido no HTML'],
        [policy.dynamicDestinationRequired === true, 'destino Meta dinâmico deve ser obrigatório'],
        [policy.publicEndpoint === 'GET /api/health/meta-destination', 'endpoint público V73 inválido'],
        [policy.publicEndpointRedacted === true, 'endpoint público precisa permanecer redacted'],
        [policy.browserCapiDatasetEqualityRequired === true, 'igualdade Browser/CAPI deve ser obrigatória'],
        [policy.lockedSecondaryDatasetId === V74_LOCKED_SECONDARY_DATASET_ID, 'Dataset secundário congelado divergente'],
        [policy.currentEcDatasetId === V74_CURRENT_EC_DATASET_ID, 'Dataset EC atual divergente'],
        [policy.leadOnceRequired === true, 'Lead once deve permanecer obrigatório'],
        [policy.eventIdDedupRequired === true, 'eventID/dedup deve permanecer obrigatório'],
        [policy.duplicatePurchasePathsAllowed === false, 'Purchase duplicado não pode ser autorizado'],
        [policy.bindingHmacRequired === true, 'binding HMAC deve permanecer obrigatório'],
        [policy.bindingMaximumLifetimeHours === 6, 'binding deve ter vida máxima de 6 horas'],
        [policy.registryOutsideGitAndRelease === true, 'registry deve permanecer fora do Git/release'],
        [policy.registryAndSecretsRoot0600 === true, 'registry/segredos devem permanecer root:root 0600'],
        [policy.tokenBrowserExposureAllowed === false, 'token no Browser não pode ser autorizado'],
        [policy.datasetChangeAuthorized === false, 'V74 não pode autorizar troca de Dataset'],
        [policy.tokenChangeAuthorized === false, 'V74 não pode autorizar troca de token'],
        [policy.registryActivationAuthorized === false, 'V74 não pode autorizar ativação do registry'],
        [policy.metaEventsAuthorized === false, 'V74 não pode autorizar eventos Meta'],
        [policy.productionMutationAuthorized === false, 'V74 não pode autorizar mutação de produção']
    ];
    for (const [condition, message] of policyChecks) push(failures, condition, message);

    push(
        failures,
        stable(successor?.overriddenLegacyChecks) === stable(expectedOverrides),
        'lista de overrides V74 não corresponde exatamente aos três checks autorizados'
    );
};

const assertDynamicContract = ({ failures, source }) => {
    const page = source('public/n/index.html');
    const health = source('src/routes/health.js');
    const registry = source('src/services/metaDestinationRegistryService.js');
    const conversions = source('src/services/metaConversionsService.js');
    const whatsapp = source('src/routes/whatsapp.js');
    const orders = source('src/routes/orders.js');
    const conversation = source('src/services/conversationEngine.js');
    const funnel = source('src/services/texUltraFunnelService.js');

    for (const [value, label] of [
        ['var CONFIG_URL = "/api/health/meta-destination";', 'VSL destination endpoint'],
        ['fetch(CONFIG_URL, { cache: "no-store", credentials: "same-origin" })', 'VSL destination fetch'],
        ['if (!destination.browserServerSynchronized)', 'VSL Browser/CAPI synchronization'],
        ['if (!validPixelId(destination.browserPixelId))', 'VSL Browser Dataset validation'],
        ['var pixelId = destination.browserPixelId;', 'VSL dynamic Browser Dataset'],
        ["fbq('init', pixelId);", 'VSL dynamic Pixel initialization'],
        ['window.__MAXLIEN_META_DESTINATION = destination;', 'VSL session destination'],
        ['window.__MAXLIEN_META_PIXEL_READY = loadDestination().then', 'VSL asynchronous initialization'],
        ['pendingLeadEventIds = [];', 'VSL pending Lead reset'],
        ['queued.forEach(function(eventId){ window.__mvpMarkLeadOnce(eventId); });', 'VSL queued Lead drain'],
        ['if (sessionStorage.getItem("lead_sent") === "1") return;', 'VSL Lead once read'],
        ['sessionStorage.setItem("lead_sent", "1");', 'VSL Lead once write'],
        ['if (leadEventId) fbq(\'track\', \'Lead\', {}, { eventID: leadEventId });', 'VSL Lead eventID'],
        ['window.__MAXLIEN_PAGEVIEW_EVENT_ID = eventId;', 'VSL PageView stable eventID'],
        ['fbq("track", "PageView", {}, { eventID: eventId });', 'VSL PageView Browser eventID'],
        ['window.__mvpMarkLeadOnce(eventId)', 'VSL Lead helper call'],
        ['eventId: eventId', 'VSL server Lead eventID'],
        ['ecApiPath("/api/meta-events")', 'VSL server Lead endpoint'],
        ['<div id="vturbMount"></div>', 'VSL mount after Meta initialization']
    ]) include(failures, page, value, label);

    push(
        failures,
        page.indexOf('var CONFIG_URL = "/api/health/meta-destination";') < page.indexOf('<div id="vturbMount"></div>'),
        'site entry deve resolver o destino Meta antes do mount da VSL'
    );
    push(
        failures,
        !/fbq\s*\(\s*['"]init['"]\s*,\s*['"]\d{8,25}['"]\s*\)/.test(page),
        'Pixel fixo/hardcoded reapareceu no HTML; destino concorrente bloqueado'
    );
    push(
        failures,
        !/(?:META_ACCESS_TOKEN|access_token|app[_-]?secret|hmac[_-]?secret|authorization\s*:\s*['"]?bearer)/i.test(page),
        'token ou segredo Meta exposto no Browser'
    );
    exactCount(failures, page, /window\.__mvpMarkLeadOnce\s*=\s*function/g, 2, 'VSL wrappers Lead V73');
    exactCount(failures, page, /fbq\s*\(\s*['"]track['"]\s*,\s*['"]Lead['"]/g, 2, 'VSL emissões condicionais do único Lead');
    exactCount(failures, page, /window\.__mvpMarkLeadOnce\s*\(\s*eventId\s*\)/g, 2, 'VSL pontos autorizados do Lead (dreno e ação)');
    exactCount(failures, page, /fbq\s*\(\s*['"]track['"]\s*,\s*['"]Purchase['"]/g, 0, 'Browser Purchase');

    for (const [value, label] of [
        ["router.get('/meta-destination'", 'health destination route'],
        ['getPublicMetaDestinationForRoute(META_DESTINATION_ROUTES.EC_DEFAULT)', 'health destination resolver'],
        ['destination.available === true && destination.browserServerSynchronized === true', 'health Browser/CAPI equality'],
        ["res.set('Cache-Control', 'no-store, max-age=0')", 'health no-store'],
        ['return res.status(available ? 200 : 503).json({', 'health 200/503 fail-closed'],
        ['destination', 'health redacted descriptor']
    ]) include(failures, health, value, label);
    push(
        failures,
        !/(?:accessToken|access_token|appSecret|app_secret|hmacSecret|hmac_secret|bearerToken|credentials)\s*:/i.test(health),
        'endpoint Meta público expõe chave de segredo/token'
    );

    for (const [value, label] of [
        [`export const META_EC_TEX_ULTRA_PROTOCOLO_G_LOCKED_DATASET_ID = '${V74_LOCKED_SECONDARY_DATASET_ID}';`, 'Dataset congelado'],
        ["export const DEFAULT_META_DESTINATION_REGISTRY_PATH = '/opt/vitalismen-automacao/shared/config/meta-destinations.json';", 'registry fora do release'],
        ["export const DEFAULT_META_DESTINATION_SECRETS_PATH = '/opt/vitalismen-automacao/shared/secrets/meta-destinations.json';", 'segredos fora do release'],
        ['if (browserPixelId !== datasetId)', 'registry Browser/CAPI equality'],
        ["'META_BROWSER_SERVER_DATASET_MISMATCH'", 'registry mismatch fail-closed'],
        ['stat.mode & 0o077', 'registry modo 0600'],
        ['stat.uid !== 0 || stat.gid !== 0', 'registry root:root'],
        ["'META_DESTINATION_REGISTRY_OWNER'", 'registry ownership error'],
        ['export const publicMetaDestinationDescriptor', 'descritor público redacted'],
        ['datasetId,', 'descritor Dataset CAPI'],
        ['browserPixelId,', 'descritor Dataset Browser'],
        ['browserServerSynchronized: synchronized', 'descritor igualdade Browser/CAPI'],
        ['tokenConfigured: Boolean(destination.accessToken)', 'descritor booleano sem token']
    ]) include(failures, registry, value, label);
    const publicDescriptor = registry.slice(registry.indexOf('export const publicMetaDestinationDescriptor'));
    push(
        failures,
        !/(?:accessToken|tokenSource)\s*:/.test(publicDescriptor),
        'descritor público não pode serializar accessToken/tokenSource'
    );

    for (const [value, label] of [
        ['return resolveMetaDestination({', 'CAPI usa registry resolver'],
        ['route: META_DESTINATION_ROUTES.EC_DEFAULT', 'CAPI usa rota EC ativa'],
        ['const destination = activeDestinationForRoute(route, env);', 'endpoint usa destino CAPI ativo'],
        ['const descriptor = publicMetaDestinationDescriptor(destination);', 'endpoint redige destino ativo'],
        ['const META_DESTINATION_BINDING_TTL_MS = 6 * 60 * 60 * 1000;', 'binding máximo 6 horas'],
        [".createHmac('sha256'", 'binding HMAC'],
        ['crypto.timingSafeEqual(expectedBuffer, actualBuffer)', 'binding timing-safe'],
        ['destination.pixelId !== datasetId', 'binding mantém Dataset da sessão'],
        ['configForBrowserEvent({ route: expectedRoute, event, req, env, now: options.now })', 'Lead CAPI valida binding Browser'],
        ['event_id: eventId', 'CAPI event_id'],
        ["event_name: 'Purchase'", 'Purchase CAPI único'],
        ['const eventId = order?.orderId || order?._id?.toString();', 'Purchase identity']
    ]) include(failures, conversions, value, label);
    exactCount(failures, conversions, /event_name\s*:\s*['"]Purchase['"]/g, 1, 'definição CAPI Purchase');

    for (const [body, label] of [
        [whatsapp, 'whatsapp'],
        [orders, 'orders'],
        [conversation, 'conversationEngine'],
        [funnel, 'texUltraFunnelService']
    ]) exactCount(
        failures,
        body,
        /sendPurchaseEventForOrder\s*\(\s*order\s*\)/g,
        1,
        `caminho Purchase ${label}`
    );
    include(failures, whatsapp, 'if (!order.tracking?.metaPurchaseSentAt)', 'Purchase lock WhatsApp');
    include(failures, whatsapp, 'order.tracking.metaPurchaseEventId = result.eventId || order.orderId;', 'Purchase eventID WhatsApp');
};

export const evaluateFreezeLockEcMetaDynamicV74 = ({
    legacyFreezeBytes,
    legacyFreeze,
    successor,
    parentManifestBytes,
    parentFreezeBytes,
    readSource
}) => {
    const failures = [];
    const warnings = [];
    const overridesApplied = [];
    const source = (relativeFile, optional = false) => {
        const body = readSource(relativeFile);
        if (body === undefined || body === null) {
            if (optional) warnings.push(`${relativeFile} não encontrado`);
            else failures.push(`${relativeFile} não encontrado`);
            return '';
        }
        return normalize(body);
    };

    assertSuccessorEnvelope({ failures, legacyFreezeBytes, successor, parentManifestBytes, parentFreezeBytes });
    const rules = Array.isArray(legacyFreeze?.rules) ? legacyFreeze.rules : [];
    if (!rules.length) failures.push('FREEZE_LOCK_EC.json não possui regras ativas');
    for (const rule of rules) {
        if (rule.status === 'inactive') continue;
        const checks = Array.isArray(rule.checks) ? rule.checks : [];
        if (!rule.id) failures.push('regra sem id no FREEZE_LOCK_EC.json');
        if (!checks.length) failures.push(`${rule.id}: regra sem checks`);
        for (const [checkIndex, check] of checks.entries()) {
            const identity = checkIdentity(rule.id, checkIndex, check);
            if (expectedOverrideIdentities.has(identity)) {
                overridesApplied.push(expectedOverrideIdentities.get(identity).overrideId);
                continue;
            }
            const body = source(check.file, Boolean(check.optional));
            if (!body && check.optional) continue;
            checkLegacyRule({ failures, rule, check, body });
        }
    }
    push(
        failures,
        stable(overridesApplied) === stable(expectedOverrides.map(({ overrideId }) => overrideId)),
        'os três overrides legados não foram aplicados uma única vez e na posição autorizada'
    );
    assertDynamicContract({ failures, source });
    return {
        ok: failures.length === 0,
        failures,
        warnings,
        overridesApplied,
        legacyActiveRuleCount: rules.filter((rule) => rule.status !== 'inactive').length
    };
};

export const loadFreezeLockEcMetaDynamicV74Workspace = (root = process.cwd()) => {
    const readBytes = (relativeFile) => fs.readFileSync(path.join(root, relativeFile));
    const legacyFreezeBytes = readBytes(V74_LEGACY_FREEZE_PATH);
    const successorBytes = readBytes(V74_SUCCESSOR_PATH);
    const successor = JSON.parse(successorBytes.toString('utf8'));
    const legacyFreeze = JSON.parse(legacyFreezeBytes.toString('utf8'));
    const parentManifestBytes = readBytes(successor.parentV73ManifestPath);
    const parentFreezeBytes = readBytes(successor.parentV73FreezePath);
    const allLegacyFiles = (legacyFreeze.rules || []).flatMap((rule) => (rule.checks || []).map((check) => check.file));
    const files = [...new Set([...allLegacyFiles, ...dynamicSourceFiles])];
    const sources = new Map(files.map((relativeFile) => {
        const absolute = path.join(root, relativeFile);
        return [relativeFile, fs.existsSync(absolute) ? fs.readFileSync(absolute, 'utf8') : undefined];
    }));
    return {
        legacyFreezeBytes,
        legacyFreeze,
        successor,
        parentManifestBytes,
        parentFreezeBytes,
        sources,
        readSource: (relativeFile) => sources.get(relativeFile)
    };
};

export const assertFreezeLockEcMetaDynamicV74 = (input) => {
    const result = evaluateFreezeLockEcMetaDynamicV74(input);
    if (!result.ok) {
        throw new Error(`[FREEZE-LOCK-EC-META-DYNAMIC-V74] contrato inválido:\n- ${result.failures.join('\n- ')}`);
    }
    return result;
};
